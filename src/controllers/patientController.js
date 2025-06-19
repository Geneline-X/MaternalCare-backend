import { fhirStore } from "../models/FhirStore.js"
import User from "../models/User.js" // Declare the User variable

// Get all patients
export const getPatients = async (req, res, next) => {
  try {
    // Note: Authorization is already handled by middleware
    // The enforceDataOwnership middleware will block patients from reaching here
    // So we don't need additional role checks in the controller

    const patients = await fhirStore.search("Patient", req.query)
    res.json(patients)
  } catch (error) {
    next(error)
  }
}

// Get a specific patient
export const getPatient = async (req, res, next) => {
  try {
    const patient = await fhirStore.read("Patient", req.params.id)

    // If patient role, ensure they can only see their own data
    if (req.user.role === "patient" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "Forbidden: You can only access your own data" })
    }

    res.json(patient)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new patient
export const createPatient = async (req, res, next) => {
  try {
    const patient = req.body

    // Validate required fields
    if (!patient.name || !Array.isArray(patient.name) || patient.name.length === 0) {
      return res.status(400).json({ message: "Patient name is required" })
    }

    // Create the patient
    const createdPatient = await fhirStore.create("Patient", patient)
    res.status(201).json(createdPatient)
  } catch (error) {
    next(error)
  }
}

// Update a patient
export const updatePatient = async (req, res, next) => {
  try {
    const patient = req.body

    // If patient role, ensure they can only update their own data
    if (req.user.role === "patient" && req.user.id !== req.params.id) {
      return res.status(403).json({ message: "Forbidden: You can only update your own data" })
    }

    const updatedPatient = await fhirStore.update("Patient", req.params.id, patient)
    res.json(updatedPatient)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete a patient
export const deletePatient = async (req, res, next) => {
  try {
    await fhirStore.delete("Patient", req.params.id)
    res.json({ message: `Patient ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Get patient summary statistics for doctor dashboard
export const getPatientSummary = async (req, res, next) => {
  try {
    const doctorId = req.user.id

    // Get all appointments for this doctor to find their patients
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const patientIds = [...new Set(appointments.map((apt) => apt.patientId))]

    // Get high-risk flags for doctor's patients
    const allFlags = await fhirStore.search("Flag", { status: "active" })
    const highRiskPatients = allFlags.filter((flag) =>
      patientIds.includes(flag.subject?.reference?.split("/")[1]),
    ).length

    // Get pregnancies due soon (within 4 weeks)
    const allPregnancies = await fhirStore.search("EpisodeOfCare", { status: "active" })
    const fourWeeksFromNow = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000)
    const dueSoonPatients = allPregnancies.filter((pregnancy) => {
      const dueDate = new Date(pregnancy.period?.end)
      const patientId = pregnancy.patient?.reference?.split("/")[1]
      return patientIds.includes(patientId) && dueDate <= fourWeeksFromNow
    }).length

    // Get new patients this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const newPatientsThisMonth = await User.countDocuments({
      role: "patient",
      createdAt: { $gte: startOfMonth },
    })

    res.json({
      success: true,
      data: {
        totalPatients: patientIds.length,
        highRiskPatients,
        dueSoonPatients,
        newPatientsThisMonth,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}
