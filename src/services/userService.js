import { clerkClient } from "@clerk/express"
import User from "../models/User.js"
import { getRolePermissions } from "../config/permissions.js"

/**
 * User service for managing user accounts and roles
 */
class UserService {
  /**
   * Create or update user from Clerk data with better error handling
   */
  async createOrUpdateUser(clerkUser) {
    console.log('Processing Clerk user data:', JSON.stringify(clerkUser, null, 2));
    
    // Extract data from the webhook payload
    const data = clerkUser.data || clerkUser;
    const clerkId = data.id;
    
    // Extract email from the email_addresses array
    let email = '';
    if (data.email_addresses?.length > 0) {
      const primaryEmail = data.email_addresses.find(
        e => e.id === data.primary_email_address_id
      ) || data.email_addresses[0];
      email = primaryEmail.email_address || '';
    }
    
    // Extract name from unsafe_metadata or other locations
    const unsafeMetadata = data.unsafe_metadata || {};
    const firstName = unsafeMetadata.firstName || data.first_name || '';
    const lastName = unsafeMetadata.lastName || data.last_name || '';
    const imageUrl = data.image_url || data.profile_image_url || '';

    if (!email) {
      console.error('No email found in Clerk user data. Available fields:', Object.keys(clerkUser));
      throw new Error("No email address found for user");
    }

    if (!clerkId) {
      console.error('No Clerk ID found in user data:', clerkUser);
      throw new Error("No Clerk ID found for user");
    }

    try {
      // Check if user exists in our database
      let user = await User.findOne({ clerkId })
      
      // Get role from unsafe_metadata or determine from email
      const role = (unsafeMetadata.role || this.determineRoleFromEmail(email) || 'patient').toLowerCase();

      // Prepare user data with all possible fields
      const userData = {
        clerkId,
        email,
        name: [firstName, lastName].filter(Boolean).join(" ").trim() || email.split("@")[0],
        firstName,
        lastName,
        picture: imageUrl,
        role,
        facilityId: unsafeMetadata.facilityId || null,
        lastSyncedAt: new Date(),
        clerkData: clerkUser // Store full Clerk data for debugging
      };
      
      console.log('Processed user data:', JSON.stringify(userData, null, 2));

      if (!user) {
        // Create new user
        user = new User(userData)
        await user.save()
        console.log(`Created new user: ${clerkId}`)
      } else {
        // Update existing user only if data has changed
        const hasChanges = Object.keys(userData).some((key) => {
          if (key === "lastSyncedAt") return true
          return JSON.stringify(user[key]) !== JSON.stringify(userData[key])
        })

        if (hasChanges) {
          user = await User.findByIdAndUpdate(user._id, { $set: userData }, { new: true })
          console.log(`Updated existing user: ${clerkId}`)
        }
      }

      // Update Clerk user metadata with role if not set
      if (!clerkUser.unsafeMetadata?.role) {
        try {
          await clerkClient.users.updateUser(clerkId, {
            unsafeMetadata: {
              ...clerkUser.unsafeMetadata,
              role,
            },
          })
        } catch (clerkError) {
          console.error(`Failed to update Clerk metadata for user ${clerkId}:`, clerkError)
          // Don't fail the operation if Clerk update fails
        }
      }

      return user
    } catch (error) {
      console.error(`Error creating/updating user ${clerkId}:`, error)
      throw error
    }
  }

  /**
   * Get user with permissions
   */
  async getUserWithPermissions(clerkId) {
    const user = await User.findOne({ clerkId })
    if (!user) {
      throw new Error("User not found")
    }

    return {
      ...user.toObject(),
      permissions: getRolePermissions(user.role),
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(clerkId, newRole, updatedBy) {
    // Validate role
    const validRoles = ["patient", "nurse", "doctor", "admin"]
    if (!validRoles.includes(newRole)) {
      throw new Error("Invalid role")
    }

    // Update in database
    const user = await User.findOneAndUpdate({ clerkId }, { role: newRole }, { new: true })

    if (!user) {
      throw new Error("User not found")
    }

    // Update in Clerk
    await clerkClient.users.updateUser(clerkId, {
      unsafeMetadata: {
        role: newRole,
      },
    })

    // Log the role change
    console.log(`[ROLE_CHANGE] User ${clerkId} role changed from ${user.role} to ${newRole} by ${updatedBy}`)

    return user
  }

  /**
   * Assign user to facility
   */
  async assignUserToFacility(clerkId, facilityId, assignedBy) {
    const user = await User.findOneAndUpdate({ clerkId }, { facilityId }, { new: true })

    if (!user) {
      throw new Error("User not found")
    }

    // Update in Clerk
    await clerkClient.users.updateUser(clerkId, {
      unsafeMetadata: {
        facilityId,
      },
    })

    // Log the facility assignment
    console.log(`[FACILITY_ASSIGNMENT] User ${clerkId} assigned to facility ${facilityId} by ${assignedBy}`)

    return user
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role) {
    return await User.find({ role })
  }

  /**
   * Get users by facility
   */
  async getUsersByFacility(facilityId) {
    return await User.find({ facilityId })
  }

  /**
   * Determine role from email patterns
   */
  determineRoleFromEmail(email) {
    const ROLE_EMAIL_PATTERNS = {
      doctor: /@(hospital|clinic|healthcare|medical)\./i,
      nurse: /@(nursing|hospital|clinic|healthcare)\./i,
    }

    for (const [role, pattern] of Object.entries(ROLE_EMAIL_PATTERNS)) {
      if (pattern.test(email)) {
        return role
      }
    }
    return "patient"
  }

  /**
   * Validate user permissions
   */
  validatePermissions(user, requiredPermissions) {
    const userPermissions = getRolePermissions(user.role)
    return requiredPermissions.every((permission) => userPermissions.includes(permission))
  }

  /**
   * Delete user from our database when deleted from Clerk
   */
  async deleteUser(clerkId) {
    try {
      const result = await User.findOneAndDelete({ clerkId })

      if (!result) {
        console.log(`User with clerkId ${clerkId} not found in database`)
        return null
      }

      console.log(`User ${clerkId} successfully deleted from database`)
      return result
    } catch (error) {
      console.error(`Error deleting user ${clerkId}:`, error)
      throw error
    }
  }

  /**
   * Check data consistency between Clerk and MongoDB
   */
  async checkDataConsistency(clerkId) {
    try {
      const [clerkUser, mongoUser] = await Promise.all([clerkClient.users.getUser(clerkId), User.findOne({ clerkId })])

      if (!clerkUser && mongoUser) {
        console.warn(`User ${clerkId} exists in MongoDB but not in Clerk`)
        return { consistent: false, issue: "mongo_orphan" }
      }

      if (clerkUser && !mongoUser) {
        console.warn(`User ${clerkId} exists in Clerk but not in MongoDB`)
        return { consistent: false, issue: "clerk_orphan" }
      }

      if (!clerkUser && !mongoUser) {
        return { consistent: true, issue: "both_missing" }
      }

      // Check if data is in sync
      const clerkEmail = clerkUser.emailAddresses?.[0]?.emailAddress
      const clerkName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim()

      if (mongoUser.email !== clerkEmail || mongoUser.name !== clerkName) {
        console.warn(`User ${clerkId} data is out of sync between Clerk and MongoDB`)
        return { consistent: false, issue: "data_mismatch" }
      }

      return { consistent: true }
    } catch (error) {
      console.error(`Error checking data consistency for user ${clerkId}:`, error)
      return { consistent: false, issue: "check_failed", error: error.message }
    }
  }
}

export default new UserService()
