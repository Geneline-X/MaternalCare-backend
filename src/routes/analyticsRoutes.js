import { Router } from "express"
import { requireAuth } from "@clerk/express"
import { getPregnancyAnalytics } from "../controllers/analyticsController.js"
import { authenticate, authorize, enforceFacilityAccess, auditLog } from "../middlewares/auth.js"
import { PERMISSIONS } from "../config/permissions.js"

const router = Router()

// Apply authentication to all analytics routes
router.use(requireAuth())
router.use(authenticate)

// Analytics routes
router.get(
  "/pregnancy",
  authorize(PERMISSIONS.ANALYTICS_READ_OWN, PERMISSIONS.ANALYTICS_READ_ALL),
  enforceFacilityAccess,
  auditLog("GET_PREGNANCY_ANALYTICS"),
  getPregnancyAnalytics,
)

export default router
