import { fhirStore } from "../models/FhirStore.js"
import { sendNotification } from "../services/notificationService.js"

// Get all care plans
export const getCarePlans = async (req, res, next) => {
  try {
    // If patient role, ensure they can only see their own care plans
    if (req.user.role === "patient") {
      req.query.subject = `Patient/${req.user.id}`
    }

    const carePlans = await fhirStore.search("CarePlan", req.query)
    res.json(carePlans)
  } catch (error) {
    next(error)
  }
}

// Get a specific care plan
export const getCarePlan = async (req, res, next) => {
  try {
    const carePlan = await fhirStore.read("CarePlan", req.params.id)

    // If patient role, ensure they can only see their own care plans
    if (req.user.role === "patient") {
      const patientId = carePlan.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only access your own data" })
      }
    }

    res.json(carePlan)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new care plan
export const createCarePlan = async (req, res, next) => {
  try {
    const carePlan = req.body

    // Validate required fields
    if (!carePlan.status) {
      return res.status(400).json({ message: "CarePlan status is required" })
    }

    if (!carePlan.subject) {
      return res.status(400).json({ message: "CarePlan subject is required" })
    }

    // Create the care plan
    const createdCarePlan = await fhirStore.create("CarePlan", carePlan)

    // 🔔 SEND CARE PLAN CREATED NOTIFICATION
    try {
      const patientRef = createdCarePlan.subject
      const planTitle = createdCarePlan.title || "Care Plan"

      await sendNotification({
        subject: patientRef,
        payload: `A new care plan "${planTitle}" has been created for you. Please review the activities and follow the recommendations provided.`,
        recipients: [patientRef],
      })
    } catch (notificationError) {
      console.log("Care plan creation notification failed:", notificationError.message)
    }

    res.status(201).json(createdCarePlan)
  } catch (error) {
    next(error)
  }
}

// Update a care plan
export const updateCarePlan = async (req, res, next) => {
  try {
    const carePlan = req.body
    const updatedCarePlan = await fhirStore.update("CarePlan", req.params.id, carePlan)

    // 🔔 SEND CARE PLAN UPDATED NOTIFICATION
    try {
      const patientRef = updatedCarePlan.subject
      const planTitle = updatedCarePlan.title || "Care Plan"

      await sendNotification({
        subject: patientRef,
        payload: `Your care plan "${planTitle}" has been updated. Please review the changes and follow the new recommendations.`,
        recipients: [patientRef],
      })
    } catch (notificationError) {
      console.log("Care plan update notification failed:", notificationError.message)
    }

    res.json(updatedCarePlan)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete a care plan
export const deleteCarePlan = async (req, res, next) => {
  try {
    await fhirStore.delete("CarePlan", req.params.id)
    res.json({ message: `CarePlan ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}
