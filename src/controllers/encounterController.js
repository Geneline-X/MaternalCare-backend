import { fhirStore } from "../models/FhirStore.js"
import { sendNotification } from "../services/notificationService.js"

// Get all encounters
export const getEncounters = async (req, res, next) => {
  try {
    // If patient role, ensure they can only see their own encounters
    if (req.user.role === "patient") {
      req.query.subject = `Patient/${req.user.id}`
    }

    const encounters = await fhirStore.search("Encounter", req.query)
    res.json(encounters)
  } catch (error) {
    next(error)
  }
}

// Get a specific encounter
export const getEncounter = async (req, res, next) => {
  try {
    const encounter = await fhirStore.read("Encounter", req.params.id)

    // If patient role, ensure they can only see their own encounters
    if (req.user.role === "patient") {
      const patientId = encounter.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only access your own data" })
      }
    }

    res.json(encounter)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new encounter
export const createEncounter = async (req, res, next) => {
  try {
    const encounter = req.body

    // Validate required fields
    if (!encounter.status) {
      return res.status(400).json({ message: "Encounter status is required" })
    }

    if (!encounter.class) {
      return res.status(400).json({ message: "Encounter class is required" })
    }

    if (!encounter.subject) {
      return res.status(400).json({ message: "Encounter subject is required" })
    }

    // Create the encounter
    const createdEncounter = await fhirStore.create("Encounter", encounter)

    // 🔔 SEND ENCOUNTER STARTED NOTIFICATION
    if (encounter.status === "in-progress") {
      try {
        const patientRef = createdEncounter.subject
        const encounterType = createdEncounter.type?.[0]?.coding?.[0]?.display || "visit"

        await sendNotification({
          subject: patientRef,
          payload: `Your ${encounterType.toLowerCase()} has started. Please follow the instructions provided by your healthcare provider.`,
          recipients: [patientRef],
        })
      } catch (notificationError) {
        console.log("Encounter start notification failed:", notificationError.message)
      }
    }

    res.status(201).json(createdEncounter)
  } catch (error) {
    next(error)
  }
}

// Update an encounter
export const updateEncounter = async (req, res, next) => {
  try {
    const encounter = req.body
    const existingEncounter = await fhirStore.read("Encounter", req.params.id)
    const updatedEncounter = await fhirStore.update("Encounter", req.params.id, encounter)

    // 🔔 SEND ENCOUNTER COMPLETION NOTIFICATION
    if (req.body.status === "finished" && existingEncounter.status !== "finished") {
      try {
        const patientRef = updatedEncounter.subject
        const encounterType = updatedEncounter.type?.[0]?.coding?.[0]?.display || "visit"

        await sendNotification({
          subject: patientRef,
          payload: `Your ${encounterType.toLowerCase()} has been completed. Thank you for visiting us today!`,
          recipients: [patientRef],
        })
      } catch (notificationError) {
        console.log("Encounter completion notification failed:", notificationError.message)
      }
    }

    res.json(updatedEncounter)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete an encounter
export const deleteEncounter = async (req, res, next) => {
  try {
    await fhirStore.delete("Encounter", req.params.id)
    res.json({ message: `Encounter ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}
