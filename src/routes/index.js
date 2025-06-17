import { Router } from "express"
import authRoutes from "./authRoute.js"
import fhirRoutes from "./fhirRoutes.js"
import { getAllDoctors } from "../controllers/userController.js"

const router = Router()

/**
 * @route /api/users/doctors
 * @desc Get all doctors
 */
router.get('/users/doctors', getAllDoctors)

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
