import { Router } from "express"
import { requireAuth } from "@clerk/express"
import authController from "../controllers/authController.js"
import { authenticate, authorize, requireRole, auditLog } from "../middlewares/auth.js"
import { authRateLimit } from "../middlewares/security.js"
import { PERMISSIONS } from "../config/permissions.js"

const router = Router()

/**
 * @route GET /api/auth/status
 * @desc Get the current authentication status from Clerk
 * @access Public (but processes auth if present)
 */
router.get("/status", authController.getAuthStatus)

/**
 * @route POST /api/auth/webhook
 * @desc Handle Clerk webhooks
 * @access Public
 */
router.post("/webhook", authRateLimit, authController.handleUserWebhook)

/**
 * @route GET /api/auth/me
 * @desc Get current user profile with permissions
 * @access Private
 */
router.get("/me", requireAuth(), authenticate, auditLog("GET_USER_PROFILE"), authController.getCurrentUser)

/**
 * @route PUT /api/auth/users/:userId/role
 * @desc Update user role (admin only)
 * @access Private - Admin only
 */
router.put(
  "/users/:userId/role",
  requireAuth(),
  authenticate,
  authorize(PERMISSIONS.USER_UPDATE_ALL),
  auditLog("UPDATE_USER_ROLE"),
  authController.updateUserRole,
)

/**
 * @route PUT /api/auth/users/:userId/facility
 * @desc Assign user to facility (admin/doctor only)
 * @access Private - Admin/Doctor only
 */
router.put(
  "/users/:userId/facility",
  requireAuth(),
  authenticate,
  requireRole("admin", "doctor"),
  auditLog("ASSIGN_USER_FACILITY"),
  authController.assignUserToFacility,
)

/**
 * @route GET /api/auth/users/role/:role
 * @desc Get users by role (admin/doctor only)
 * @access Private - Admin/Doctor only
 */
router.get(
  "/users/role/:role",
  requireAuth(),
  authenticate,
  authorize(PERMISSIONS.USER_READ_ALL),
  auditLog("GET_USERS_BY_ROLE"),
  authController.getUsersByRole,
)

export default router
