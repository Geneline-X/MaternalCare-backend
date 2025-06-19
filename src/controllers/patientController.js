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

/**
 * Create a new patient - MATCHES FRONTEND FORM
 */
export const createPatient = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      emergencyContactName,
      emergencyContactPhone,
      medicalHistory,
      allergies,
      currentMedications,
      isHighRisk,
      bloodType,
      insurance,
    } = req.body

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !dateOfBirth ||
      !emergencyContactName ||
      !emergencyContactPhone
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      })
    }

    // Check if patient already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A patient with this email already exists",
      })
    }

    // Create User record first
    const userData = {
      firstName,
      lastName,
      email,
      phone,
      role: "patient",
      dateOfBirth: new Date(dateOfBirth),
      address,
      emergencyContact: {
        name: emergencyContactName,
        phone: emergencyContactPhone,
      },
      medicalInfo: {
        history: medicalHistory || "",
        allergies: allergies || "",
        currentMedications: currentMedications || "",
        bloodType: bloodType || "",
        insurance: insurance || "",
      },
      isHighRisk: isHighRisk || false,
      createdBy: req.user.id,
      createdAt: new Date(),
    }

    const createdUser = await User.create(userData)

    // Create FHIR Patient resource
    const fhirPatient = {
      resourceType: "Patient",
      id: createdUser._id.toString(),
      active: true,
      name: [
        {
          use: "official",
          family: lastName,
          given: [firstName],
        },
      ],
      telecom: [
        {
          system: "phone",
          value: phone,
          use: "mobile",
        },
        {
          system: "email",
          value: email,
          use: "home",
        },
      ],
      gender: "unknown", // Can be enhanced later
      birthDate: dateOfBirth,
      address: address
        ? [
            {
              use: "home",
              text: address,
              type: "physical",
            },
          ]
        : [],
      contact: [
        {
          relationship: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0131",
                  code: "EP",
                  display: "Emergency contact person",
                },
              ],
            },
          ],
          name: {
            text: emergencyContactName,
          },
          telecom: [
            {
              system: "phone",
              value: emergencyContactPhone,
            },
          ],
        },
      ],
      extension: [
        ...(bloodType
          ? [
              {
                url: "http://prestack.com/fhir/StructureDefinition/blood-type",
                valueString: bloodType,
              },
            ]
          : []),
        ...(insurance
          ? [
              {
                url: "http://prestack.com/fhir/StructureDefinition/insurance",
                valueString: insurance,
              },
            ]
          : []),
        {
          url: "http://prestack.com/fhir/StructureDefinition/high-risk",
          valueBoolean: isHighRisk,
        },
      ],
    }

    // Create FHIR Patient
    const createdFhirPatient = await fhirStore.create("Patient", fhirPatient)

    // Create medical history conditions if provided
    if (medicalHistory) {
      const historyCondition = {
        resourceType: "Condition",
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active",
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              code: "confirmed",
            },
          ],
        },
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-category",
                code: "problem-list-item",
                display: "Problem List Item",
              },
            ],
          },
        ],
        code: {
          text: "Medical History",
        },
        subject: {
          reference: `Patient/${createdUser._id}`,
        },
        note: [
          {
            text: medicalHistory,
            time: new Date().toISOString(),
          },
        ],
        recordedDate: new Date().toISOString(),
        recorder: {
          reference: `Practitioner/${req.user.id}`,
        },
      }

      await fhirStore.create("Condition", historyCondition)
    }

    // Create allergy intolerance if provided
    if (allergies) {
      const allergyIntolerance = {
        resourceType: "AllergyIntolerance",
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: "active",
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
              code: "confirmed",
            },
          ],
        },
        patient: {
          reference: `Patient/${createdUser._id}`,
        },
        code: {
          text: allergies,
        },
        recordedDate: new Date().toISOString(),
        recorder: {
          reference: `Practitioner/${req.user.id}`,
        },
      }

      await fhirStore.create("AllergyIntolerance", allergyIntolerance)
    }

    // Create high-risk flag if needed
    if (isHighRisk) {
      const highRiskFlag = {
        resourceType: "Flag",
        status: "active",
        category: [
          {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/flag-category",
                code: "clinical",
                display: "Clinical",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "15508007",
              display: "High risk patient",
            },
          ],
        },
        subject: {
          reference: `Patient/${createdUser._id}`,
        },
        period: {
          start: new Date().toISOString(),
        },
        author: {
          reference: `Practitioner/${req.user.id}`,
        },
      }

      await fhirStore.create("Flag", highRiskFlag)
    }

    res.status(201).json({
      success: true,
      data: {
        id: createdUser._id,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        isHighRisk,
        createdAt: createdUser.createdAt,
      },
      message: "Patient has been added successfully",
    })
  } catch (error) {
    console.error("Error creating patient:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create patient",
      error: error.message,
    })
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
