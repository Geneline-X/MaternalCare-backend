import fhirStore from "../models/fhirStore.js"
import { sendNotification } from "../services/notificationService.js"

// Get all flags
export const getFlags = async (req, res, next) => {
  try {
    // If patient role, ensure they can only see their own flags
    if (req.user.role === "patient") {
      req.query.subject = `Patient/${req.user.id}`
    }

    const flags = await fhirStore.search("Flag", req.query)
    res.json(flags)
  } catch (error) {
    next(error)
  }
}

// Get a specific flag
export const getFlag = async (req, res, next) => {
  try {
    const flag = await fhirStore.read("Flag", req.params.id)

    // If patient role, ensure they can only see their own flags
    if (req.user.role === "patient") {
      const patientId = flag.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden: You can only access your own data" })
      }
    }

    res.json(flag)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new flag
export const createFlag = async (req, res, next) => {
  try {
    const flag = req.body

    // Validate required fields
    if (!flag.code) {
      return res.status(400).json({ message: "Flag code is required" })
    }

    if (!flag.subject) {
      return res.status(400).json({ message: "Flag subject is required" })
    }

    if (!flag.status) {
      return res.status(400).json({ message: "Flag status is required" })
    }

    // Check for duplicate flags
    const existingFlags = await fhirStore.search("Flag", {
      subject: flag.subject.reference,
      "code.coding.code": flag.code.coding[0].code,
    })

    if (existingFlags.length > 0) {
      return res.status(409).json({ message: "Flag already exists for this condition and patient" })
    }

    // Create the flag
    const createdFlag = await fhirStore.create("Flag", flag)

    // Send notification for the new flag
    await sendNotification({
      subject: flag.subject,
      payload: `High-risk condition flagged: ${flag.code.coding[0].display}`,
      recipients: [{ reference: `Practitioner/${req.user.id}` }, flag.subject],
    })

    res.status(201).json(createdFlag)
  } catch (error) {
    next(error)
  }
}

// Update a flag
export const updateFlag = async (req, res, next) => {
  try {
    const flag = req.body
    const updatedFlag = await fhirStore.update("Flag", req.params.id, flag)
    res.json(updatedFlag)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete a flag
export const deleteFlag = async (req, res, next) => {
  try {
    await fhirStore.delete("Flag", req.params.id)
    res.json({ message: `Flag ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}
