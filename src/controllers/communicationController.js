import { fhirStore } from "../models/FhirStore.js"

// Get all communications
export const getCommunications = async (req, res, next) => {
  try {
    // If patient role, ensure they can only see their own communications
    if (req.user.role === "patient") {
      req.query.subject = `Patient/${req.user.id}`
    }

    const communications = await fhirStore.search("Communication", req.query)
    res.json(communications)
  } catch (error) {
    next(error)
  }
}

// Get a specific communication
export const getCommunication = async (req, res, next) => {
  try {
    const communication = await fhirStore.read("Communication", req.params.id)

    // If patient role, ensure they can only see their own communications
    if (req.user.role === "patient") {
      const patientId = communication.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only access your own data" })
      }
    }

    res.json(communication)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new communication
export const createCommunication = async (req, res, next) => {
  try {
    const communication = req.body

    // Validate required fields
    if (!communication.status) {
      return res.status(400).json({ message: "Communication status is required" })
    }

    if (!communication.payload || !Array.isArray(communication.payload) || communication.payload.length === 0) {
      return res.status(400).json({ message: "Communication payload is required" })
    }

    // Create the communication
    const createdCommunication = await fhirStore.create("Communication", communication)
    res.status(201).json(createdCommunication)
  } catch (error) {
    next(error)
  }
}

// Update a communication
export const updateCommunication = async (req, res, next) => {
  try {
    const communication = req.body
    const updatedCommunication = await fhirStore.update("Communication", req.params.id, communication)
    res.json(updatedCommunication)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete a communication
export const deleteCommunication = async (req, res, next) => {
  try {
    await fhirStore.delete("Communication", req.params.id)
    res.json({ message: `Communication ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}
