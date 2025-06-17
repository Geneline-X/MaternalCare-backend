import { clerkClient } from "@clerk/express"
import { getRolePermissions, RESOURCE_PERMISSIONS } from "../config/permissions.js"
import User from "../models/User.js"

/**
 * Enhanced authentication middleware that verifies Clerk JWT and sets user context
 */
export const authenticate = async (req, res, next) => {
  try {
    // Check if req.auth exists and has userId (set by Clerk middleware)
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    let clerkUser
    try {
      // Get user from Clerk with retry logic
      clerkUser = await clerkClient.users.getUser(req.auth.userId)
    } catch (clerkError) {
      console.error("Clerk API error:", clerkError)

      if (clerkError.status === 404) {
        return res.status(401).json({
          message: "User not found in authentication provider",
          code: "USER_NOT_FOUND",
        })
      }

      if (clerkError.status === 401) {
        return res.status(401).json({
          message: "Invalid authentication token",
          code: "INVALID_TOKEN",
        })
      }

      // For other Clerk errors, return a generic auth error
      return res.status(401).json({
        message: "Authentication service error",
        code: "AUTH_SERVICE_ERROR",
      })
    }

    if (!clerkUser) {
      return res.status(401).json({
        message: "Invalid authentication token",
        code: "INVALID_TOKEN",
      })
    }

    // Get or create user in our database with retry logic
    let user
    try {
      user = await User.findOne({ clerkId: clerkUser.id })

      if (!user) {
        // Create user if doesn't exist
        const role = clerkUser.publicMetadata?.role || determineRoleFromEmail(clerkUser.emailAddresses[0]?.emailAddress)
        user = new User({
          clerkId: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          name:
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
            clerkUser.emailAddresses[0]?.emailAddress.split("@")[0],
          picture: clerkUser.imageUrl,
          role,
          facilityId: clerkUser.publicMetadata?.facilityId || null,
        })

        try {
          await user.save()
        } catch (saveError) {
          // Handle duplicate key error
          if (saveError.code === 11000) {
            user = await User.findOne({ clerkId: clerkUser.id })
            if (!user) {
              throw new Error("Failed to create or find user")
            }
          } else {
            throw saveError
          }
        }
      }
    } catch (dbError) {
      console.error("Database error during authentication:", dbError)
      return res.status(500).json({
        message: "Database service error",
        code: "DB_SERVICE_ERROR",
      })
    }

    // Set user context with permissions
    req.user = {
      id: user.clerkId,
      dbId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      facilityId: user.facilityId,
      permissions: getRolePermissions(user.role),
      clerkUser: clerkUser,
    }

    // Add session information
    req.session = {
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
      orgId: req.auth.orgId,
    }

    next()
  } catch (error) {
    console.error("Authentication error:", error)
    return res.status(500).json({
      message: "Authentication service error",
      code: "AUTH_SERVICE_ERROR",
    })
  }
}

/**
 * Authorization middleware that checks if user has required permissions
 */
export const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    // Check if user has any of the required permissions
    const hasRequiredPermission = requiredPermissions.some((permission) => req.user.permissions.includes(permission))

    if (!hasRequiredPermission) {
      return res.status(403).json({
        message: "Insufficient permissions",
        code: "INSUFFICIENT_PERMISSIONS",
        required: requiredPermissions,
        userRole: req.user.role,
      })
    }

    next()
  }
}

/**
 * Role-based authorization middleware
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient role permissions",
        code: "INSUFFICIENT_ROLE",
        required: allowedRoles,
        userRole: req.user.role,
      })
    }

    next()
  }
}

/**
 * Resource-based authorization middleware for FHIR resources
 */
export const authorizeResource = (resourceType, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        code: "AUTH_REQUIRED",
      })
    }

    const resourcePermissions = RESOURCE_PERMISSIONS[resourceType]
    if (!resourcePermissions) {
      return res.status(500).json({
        message: "Unknown resource type",
        code: "UNKNOWN_RESOURCE",
      })
    }

    const requiredPermissions = resourcePermissions[action]
    if (!requiredPermissions) {
      return res.status(500).json({
        message: "Unknown action",
        code: "UNKNOWN_ACTION",
      })
    }

    // Check if user has any of the required permissions for this resource/action
    const hasPermission = requiredPermissions.some((permission) => req.user.permissions.includes(permission))

    if (!hasPermission) {
      return res.status(403).json({
        message: `Insufficient permissions for ${action} on ${resourceType}`,
        code: "INSUFFICIENT_RESOURCE_PERMISSIONS",
        resource: resourceType,
        action: action,
        userRole: req.user.role,
        userPermissions: req.user.permissions,
        requiredPermissions: requiredPermissions,
      })
    }

    next()
  }
}

/**
 * Data ownership middleware - ensures patients can only access their own data
 */
export const enforceDataOwnership = (req, res, next) => {
  // Only apply to patient role
  if (req.user.role !== "patient") {
    return next()
  }

  // For GET /api/fhir/Patient (list all patients), patients should be forbidden
  if (req.path === "/Patient" && req.method === "GET" && !req.params.id) {
    return res.status(403).json({
      message: "Patients cannot access the list of all patients. Use /Patient/{your-id} to access your own record.",
      code: "DATA_OWNERSHIP_VIOLATION",
    })
  }

  // Extract patient ID from various sources
  const patientId = extractPatientId(req)

  // If accessing a specific patient resource, ensure it's their own
  if (patientId && patientId !== req.user.id) {
    return res.status(403).json({
      message: "You can only access your own data",
      code: "DATA_OWNERSHIP_VIOLATION",
    })
  }

  next()
}

/**
 * Facility-based authorization - ensures users can only access data from their facility
 */
export const enforceFacilityAccess = (req, res, next) => {
  // Skip for admin role
  if (req.user.role === "admin") {
    return next()
  }

  // Skip if user doesn't have a facility assigned
  if (!req.user.facilityId) {
    return next()
  }

  // Extract facility ID from request
  const facilityId = req.query.facilityId || req.body.facilityId

  if (facilityId && facilityId !== req.user.facilityId) {
    return res.status(403).json({
      message: "You can only access data from your assigned facility",
      code: "FACILITY_ACCESS_VIOLATION",
    })
  }

  next()
}

/**
 * Rate limiting middleware for sensitive operations
 */
export const rateLimitSensitive = (maxRequests = 10, windowMs = 60000) => {
  const requests = new Map()

  return (req, res, next) => {
    const key = req.user?.id || req.ip
    const now = Date.now()
    const windowStart = now - windowMs

    // Clean old entries
    const userRequests = requests.get(key) || []
    const validRequests = userRequests.filter((time) => time > windowStart)

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        message: "Too many requests",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: Math.ceil((validRequests[0] + windowMs - now) / 1000),
      })
    }

    validRequests.push(now)
    requests.set(key, validRequests)
    next()
  }
}

/**
 * Audit logging middleware
 */
export const auditLog = (action) => {
  return (req, res, next) => {
    const originalSend = res.send

    res.send = function (data) {
      // Log the action
      console.log(
        `[AUDIT] ${new Date().toISOString()} - User: ${req.user?.id} (${req.user?.role}) - Action: ${action} - Path: ${req.path} - Status: ${res.statusCode}`,
      )

      // Call original send
      originalSend.call(this, data)
    }

    next()
  }
}

// Helper functions
const determineRoleFromEmail = (email) => {
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

const extractPatientId = (req) => {
  return (
    req.params.id ||
    req.query.patientId ||
    req.body?.patientId ||
    (req.body?.subject && req.body.subject.split("/").pop()) ||
    (req.body?.resourceType === "Patient" && req.body.id)
  )
}

// Legacy middleware for backward compatibility
export const restrictTo = (...allowedRoles) => requireRole(...allowedRoles)
export const restrictToOwnData = enforceDataOwnership

/**
 * Middleware to handle authentication errors gracefully
 */
export const handleAuthErrors = (err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      message: "Invalid or expired token",
      code: "TOKEN_INVALID",
    })
  }

  if (err.message && err.message.includes("jwt")) {
    return res.status(401).json({
      message: "Token validation failed",
      code: "TOKEN_VALIDATION_FAILED",
    })
  }

  next(err)
}

export default {
  authenticate,
  authorize,
  requireRole,
  authorizeResource,
  enforceDataOwnership,
  enforceFacilityAccess,
  rateLimitSensitive,
  auditLog,
  restrictTo,
  restrictToOwnData,
  handleAuthErrors,
}
