import userService from "../services/userService.js"
import fhirStore from "../models/fhirStore.js"
import { Webhook } from "svix"

/**
 * Webhook handler for Clerk user events with signature verification
 */
export const handleUserWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET is not set")
      return res.status(500).json({ error: "Webhook secret not configured" })
    }

    const svix_id = req.headers["svix-id"]
    const svix_timestamp = req.headers["svix-timestamp"]
    const svix_signature = req.headers["svix-signature"]

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: "Missing webhook headers" })
    }

    // Verify the webhook
    const wh = new Webhook(webhookSecret)
    let evt

    try {
      evt = wh.verify(JSON.stringify(req.body), {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      })
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return res.status(400).json({ error: "Invalid webhook signature" })
    }

    const { type, data } = evt

    console.log(`Received verified webhook event: ${type}`)

    // Handle user creation/update events
    if (type === "user.created" || type === "user.updated") {
      try {
        await userService.createOrUpdateUser(data)
        console.log(`Successfully processed ${type} for user ${data.id}`)
      } catch (error) {
        console.error(`Error processing ${type}:`, error)
        // Don't fail the webhook for non-critical errors
        if (error.message.includes("duplicate key")) {
          console.log("User already exists, continuing...")
        } else {
          throw error
        }
      }
    }

    // Handle user deletion event
    else if (type === "user.deleted") {
      try {
        await userService.deleteUser(data.id)
        console.log(`Successfully processed user deletion for user ${data.id}`)
      } catch (error) {
        console.error(`Error deleting user ${data.id}:`, error)
        // Log but don't fail - user might not exist in our DB
      }
    }

    res.status(200).json({ received: true, processed: type })
  } catch (error) {
    console.error("Webhook error:", error)
    res.status(500).json({
      error: "Webhook handler failed",
      details: process.env.NODE_ENV === "development" ? error.message : "Internal server error",
    })
  }
}

/**
 * Complete user registration with FHIR Organization (facility)
 */
export const completeRegistration = async (req, res) => {
  try {
    const { organizationCode, organizationId, userType = "patient" } = req.body

    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    let organization = null

    // Validate FHIR Organization
    if (organizationCode) {
      // Search by identifier or registration code extension
      const organizations = await fhirStore.search("Organization", { active: "true" })

      organization = organizations.find((org) => {
        // Check main identifier
        const mainId = org.identifier?.find(
          (id) => id.system === "http://prestack.com/organization-id" && id.value === organizationCode.toUpperCase(),
        )

        // Check registration code extension
        const regCodeExt = org.extension?.find(
          (ext) =>
            ext.url === "http://prestack.com/fhir/StructureDefinition/organization-registration-code" &&
            ext.valueString === organizationCode,
        )

        return mainId || regCodeExt
      })
    } else if (organizationId) {
      organization = await fhirStore.read("Organization", organizationId)
    }

    if (!organization) {
      return res.status(400).json({
        message: "Invalid organization code or ID",
        code: "INVALID_ORGANIZATION",
      })
    }

    // Check if organization allows public registration for patients
    if (userType === "patient") {
      const publicRegExtension = organization.extension?.find(
        (ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/organization-public-registration",
      )

      if (publicRegExtension?.valueBoolean !== true) {
        return res.status(403).json({
          message: "This organization does not allow public patient registration",
          code: "REGISTRATION_NOT_ALLOWED",
        })
      }
    }

    // Update user with organization information
    const updatedUser = await userService.assignUserToFacility(req.user.id, organization.id, req.user.id)

    // Update role if specified and different from current
    if (userType && userType !== updatedUser.role) {
      await userService.updateUserRole(req.user.id, userType, req.user.id)
    }

    // Create FHIR Patient resource if user is a patient
    if (userType === "patient") {
      try {
        // Generate patient identifier
        const orgCode =
          organization.identifier?.find((id) => id.system === "http://prestack.com/organization-id")?.value ||
          organization.id

        const patientResource = {
          resourceType: "Patient",
          id: req.user.id,
          identifier: [
            {
              system: "http://prestack.com/patient-id",
              value: `${orgCode}-${req.user.id}`,
            },
            {
              system: "http://prestack.com/email",
              value: req.user.email,
            },
          ],
          active: true,
          name: [
            {
              use: "official",
              given: [req.user.name.split(" ")[0]],
              family: req.user.name.split(" ").slice(1).join(" ") || req.user.name.split(" ")[0],
            },
          ],
          telecom: [
            {
              system: "email",
              value: req.user.email,
              use: "home",
            },
          ],
          managingOrganization: {
            reference: `Organization/${organization.id}`,
            display: organization.name,
          },
          meta: {
            profile: ["http://prestack.com/fhir/StructureDefinition/Patient"],
          },
        }

        await fhirStore.create("Patient", patientResource)
      } catch (error) {
        console.error("Error creating patient FHIR resource:", error)
        // Don't fail the registration if FHIR creation fails
      }
    }

    res.json({
      message: "Registration completed successfully",
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: userType,
        facilityId: organization.id,
        organization: {
          id: organization.id,
          name: organization.name,
          code: organization.identifier?.find((id) => id.system === "http://prestack.com/organization-id")?.value,
          type: organization.type?.[0]?.coding?.[0]?.display,
        },
      },
    })
  } catch (error) {
    console.error("Complete registration error:", error)
    res.status(500).json({
      message: "Failed to complete registration",
      code: "REGISTRATION_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

/**
 * Get current user profile with permissions and FHIR Organization
 */
export const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    // Get user with permissions
    const user = await userService.getUserWithPermissions(req.user.id)

    // Get FHIR Organization information if user has one
    let organization = null
    if (user.facilityId) {
      try {
        organization = await fhirStore.read("Organization", user.facilityId)
      } catch (error) {
        console.error("Error fetching user organization:", error)
      }
    }

    // For patients, include their FHIR Patient resource
    if (user.role === "patient") {
      try {
        const patientResource = await fhirStore.read("Patient", user._id.toString())
        return res.json({
          ...user,
          organization,
          patientResource: patientResource || null,
        })
      } catch (error) {
        // If patient resource doesn't exist, continue without it
        return res.json({
          ...user,
          organization,
          patientResource: null,
        })
      }
    }

    res.json({
      ...user,
      organization,
    })
  } catch (error) {
    console.error("Get current user error:", error)
    res.status(500).json({
      message: "Failed to get user profile",
      code: "USER_PROFILE_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (req, res) => {
  try {
    const { userId, role } = req.body

    if (!userId || !role) {
      return res.status(400).json({
        message: "User ID and role are required",
        code: "MISSING_PARAMETERS",
      })
    }

    const updatedUser = await userService.updateUserRole(userId, role, req.user.id)

    res.json({
      message: "User role updated successfully",
      user: updatedUser,
    })
  } catch (error) {
    console.error("Update user role error:", error)
    res.status(500).json({
      message: "Failed to update user role",
      code: "ROLE_UPDATE_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

/**
 * Assign user to organization (admin/doctor only)
 */
export const assignUserToFacility = async (req, res) => {
  try {
    const { userId, facilityId } = req.body

    if (!userId || !facilityId) {
      return res.status(400).json({
        message: "User ID and facility ID are required",
        code: "MISSING_PARAMETERS",
      })
    }

    const updatedUser = await userService.assignUserToFacility(userId, facilityId, req.user.id)

    res.json({
      message: "User assigned to facility successfully",
      user: updatedUser,
    })
  } catch (error) {
    console.error("Assign user to facility error:", error)
    res.status(500).json({
      message: "Failed to assign user to facility",
      code: "FACILITY_ASSIGNMENT_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

/**
 * Get users by role (admin/doctor only)
 */
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params

    const users = await userService.getUsersByRole(role)

    res.json({
      users,
      count: users.length,
    })
  } catch (error) {
    console.error("Get users by role error:", error)
    res.status(500).json({
      message: "Failed to get users by role",
      code: "GET_USERS_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

/**
 * Get authentication status
 */
export const getAuthStatus = (req, res) => {
  try {
    const auth = req.auth || {}
    const isAuthenticated = !!auth.userId

    res.status(200).json({
      status: "success",
      authenticated: isAuthenticated,
      user: req.user
        ? {
            id: req.user.id,
            role: req.user.role,
            permissions: req.user.permissions,
            facilityId: req.user.facilityId,
          }
        : null,
      auth: {
        userId: auth.userId,
        sessionId: auth.sessionId,
        orgId: auth.orgId,
      },
    })
  } catch (error) {
    console.error("Auth status error:", error)
    res.status(500).json({
      status: "error",
      message: "Failed to get authentication status",
      code: "AUTH_STATUS_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
}

export default {
  handleUserWebhook,
  completeRegistration,
  getCurrentUser,
  updateUserRole,
  assignUserToFacility,
  getUsersByRole,
  getAuthStatus,
}
