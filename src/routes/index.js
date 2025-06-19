import { Router } from "express"
import authRoutes from "./authRoute.js"
import fhirRoutes from "./fhirRoutes.js"
import userRoutes from "./userRoutes.js"

const router = Router()

/**
 * @route /api/users
 * @desc User-related routes including doctor endpoints
 */
router.use('/users', userRoutes)

/**
 * @route /api/auth
 * @desc Authentication and user-related routes
 */
router.use("/auth", authRoutes)

/**
 * @route /api/fhir
 * @desc FHIR API endpoints for healthcare data
 */
router.use("/fhir", fhirRoutes)


// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

export default router
