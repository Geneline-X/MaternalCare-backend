import fhirStore from "../models/fhirStore.js"
import { checkHighRiskConditions } from "../services/flagService.js"
import { sendNotification } from "../services/notificationService.js"

// Get all observations
export const getObservations = async (req, res, next) => {
  try {
    // If patient role, ensure they can only see their own observations
    if (req.user.role === "patient") {
      req.query.subject = `Patient/${req.user.id}`
    }

    const observations = await fhirStore.search("Observation", req.query)
    res.json(observations)
  } catch (error) {
    next(error)
  }
}

// Get a specific observation
export const getObservation = async (req, res, next) => {
  try {
    const observation = await fhirStore.read("Observation", req.params.id)

    // If patient role, ensure they can only see their own observations
    if (req.user.role === "patient") {
      const patientId = observation.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only access your own data" })
      }
    }

    res.json(observation)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new observation
export const createObservation = async (req, res, next) => {
  try {
    const observation = req.body

    // Validate required fields
    if (!observation.code) {
      return res.status(400).json({ message: "Observation code is required" })
    }

    if (!observation.subject) {
      return res.status(400).json({ message: "Observation subject is required" })
    }

    if (!observation.status) {
      return res.status(400).json({ message: "Observation status is required" })
    }

    // If patient role, ensure they can only submit their own observations
    if (req.user.role === "patient") {
      const patientId = observation.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only submit your own data" })
      }
    }

    // Create the observation
    const createdObservation = await fhirStore.create("Observation", observation)

    // 🔔 CHECK FOR HIGH-RISK CONDITIONS AND SEND NOTIFICATIONS
    try {
      const flags = await checkHighRiskConditions([createdObservation])

      // Send notifications for high-risk flags
      if (flags.length > 0) {
        for (const flag of flags) {
          await sendNotification({
            subject: flag.subject,
            payload: `⚠️ HIGH-RISK CONDITION DETECTED: ${flag.code.coding[0].display}. Please review patient data immediately.`,
            recipients: [{ reference: `Practitioner/${req.user.facilityId ? "prac123" : req.user.id}` }, flag.subject],
          })
        }
      }

      // 🔔 SEND GENERAL OBSERVATION NOTIFICATION FOR CRITICAL VALUES
      const isHighRisk = checkIfObservationIsHighRisk(createdObservation)
      if (isHighRisk && !flags.length) {
        await sendNotification({
          subject: createdObservation.subject,
          payload: `New health data recorded: ${getObservationDisplayName(createdObservation)}. Please review your recent readings.`,
          recipients: [
            createdObservation.subject,
            { reference: `Practitioner/${req.user.facilityId ? "prac123" : req.user.id}` },
          ],
        })
      }
    } catch (notificationError) {
      console.log("Observation notification failed:", notificationError.message)
    }

    res.status(201).json({
      observation: createdObservation,
    })
  } catch (error) {
    next(error)
  }
}

// Update an observation
export const updateObservation = async (req, res, next) => {
  try {
    const observation = req.body

    // If patient role, ensure they can only update their own observations
    if (req.user.role === "patient") {
      const existingObservation = await fhirStore.read("Observation", req.params.id)
      const patientId = existingObservation.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only update your own data" })
      }
    }

    const updatedObservation = await fhirStore.update("Observation", req.params.id, observation)
    res.json(updatedObservation)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete an observation
export const deleteObservation = async (req, res, next) => {
  try {
    await fhirStore.delete("Observation", req.params.id)
    res.json({ message: `Observation ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Helper function to check if observation has high-risk values
function checkIfObservationIsHighRisk(observation) {
  const value = observation.valueQuantity?.value
  const code = observation.code?.coding?.[0]?.code

  if (!value || !code) return false

  // Blood pressure checks
  if (code === "8480-6" && value > 140) return true // Systolic BP > 140
  if (code === "8462-4" && value > 90) return true // Diastolic BP > 90

  // Blood sugar checks
  if (code === "33747-0" && value > 200) return true // Random glucose > 200
  if (code === "88365-2" && value > 126) return true // Fasting glucose > 126

  // Heart rate checks
  if (code === "8867-4" && (value > 100 || value < 60)) return true // Heart rate outside 60-100

  // Temperature checks
  if (code === "8310-5" && (value > 38.5 || value < 35)) return true // Temperature outside normal range

  return false
}

// Helper function to get display name for observation
function getObservationDisplayName(observation) {
  const display = observation.code?.coding?.[0]?.display
  const value = observation.valueQuantity?.value
  const unit = observation.valueQuantity?.unit

  if (display && value) {
    return `${display}: ${value}${unit ? ` ${unit}` : ""}`
  }

  return display || "Health measurement"
}
