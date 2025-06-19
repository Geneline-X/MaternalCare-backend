/**
 * Enhanced pregnancy controller that matches frontend expectations
 */
import { fhirStore } from "../models/FhirStore.js"
import { sendNotification } from "../services/notificationService.js"
import User from "../models/User.js"

/**
 * Create a new pregnancy (FHIR EpisodeOfCare) - FIXED VERSION
 */
export const createPregnancy = async (req, res, next) => {
  try {
    const {
      patientId,
      lastMenstrualPeriod,
      estimatedDueDate,
      currentWeek,
      riskLevel = "low",
      complications,
      previousPregnancies,
      currentSymptoms,
      bloodPressure,
      weight,
      height,
      prenatalVitamins,
      smokingStatus,
      alcoholConsumption,
      notes,
    } = req.body

    // Validate required fields
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: "Patient ID is required",
      })
    }

    if (!estimatedDueDate || !lastMenstrualPeriod) {
      return res.status(400).json({
        success: false,
        message: "Both estimated due date and last menstrual period are required",
      })
    }

    if (!currentWeek || !weight || !height) {
      return res.status(400).json({
        success: false,
        message: "Current week, weight, and height are required",
      })
    }

    // Validate patient exists
    const patient = await User.findById(patientId)
    if (!patient) {
      return res.status(400).json({
        success: false,
        message: "Patient not found",
      })
    }

    // Create FHIR EpisodeOfCare for pregnancy
    const pregnancyEpisode = {
      resourceType: "EpisodeOfCare",
      status: "active",
      type: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "118185001",
              display: "Pregnancy",
            },
          ],
        },
      ],
      patient: {
        reference: `Patient/${patientId}`,
        display: patient.name || `${patient.firstName} ${patient.lastName}`,
      },
      managingOrganization: req.user.facilityId
        ? {
            reference: `Organization/${req.user.facilityId}`,
          }
        : undefined,
      period: {
        start: new Date().toISOString(),
        end: new Date(estimatedDueDate).toISOString(),
      },
      careManager: {
        reference: `Practitioner/${req.user.id}`,
        display: req.user.name || `${req.user.firstName} ${req.user.lastName}`,
      },
      extension: [
        {
          url: "http://prestack.com/fhir/StructureDefinition/pregnancy-risk-level",
          valueString: riskLevel,
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/gestational-age",
          valueQuantity: {
            value: currentWeek,
            unit: "weeks",
            system: "http://unitsofmeasure.org",
            code: "wk",
          },
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/last-menstrual-period",
          valueDate: lastMenstrualPeriod,
        },
        // Add new extensions for additional data
        ...(complications
          ? [
              {
                url: "http://prestack.com/fhir/StructureDefinition/pregnancy-complications",
                valueString: complications,
              },
            ]
          : []),
        ...(previousPregnancies
          ? [
              {
                url: "http://prestack.com/fhir/StructureDefinition/previous-pregnancies",
                valueString: previousPregnancies,
              },
            ]
          : []),
        ...(currentSymptoms
          ? [
              {
                url: "http://prestack.com/fhir/StructureDefinition/current-symptoms",
                valueString: currentSymptoms,
              },
            ]
          : []),
        ...(bloodPressure
          ? [
              {
                url: "http://prestack.com/fhir/StructureDefinition/blood-pressure",
                valueString: bloodPressure,
              },
            ]
          : []),
        {
          url: "http://prestack.com/fhir/StructureDefinition/maternal-weight",
          valueQuantity: {
            value: weight,
            unit: "kg",
            system: "http://unitsofmeasure.org",
            code: "kg",
          },
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/maternal-height",
          valueQuantity: {
            value: height,
            unit: "cm",
            system: "http://unitsofmeasure.org",
            code: "cm",
          },
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/prenatal-vitamins",
          valueBoolean: prenatalVitamins,
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/smoking-status",
          valueBoolean: smokingStatus,
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/alcohol-consumption",
          valueBoolean: alcoholConsumption,
        },
      ],
    }

    if (notes) {
      pregnancyEpisode.note = [
        {
          text: notes,
          time: new Date().toISOString(),
          authorReference: {
            reference: `Practitioner/${req.user.id}`,
          },
        },
      ]
    }

    // Create the pregnancy episode
    const createdPregnancy = await fhirStore.create("EpisodeOfCare", pregnancyEpisode)

    // Create initial pregnancy condition
    const pregnancyCondition = {
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
              code: "encounter-diagnosis",
              display: "Encounter Diagnosis",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "77386006",
            display: "Pregnancy",
          },
        ],
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      context: {
        reference: `EpisodeOfCare/${createdPregnancy.id}`,
      },
      onsetDateTime: new Date().toISOString(),
      recordedDate: new Date().toISOString(),
      recorder: {
        reference: `Practitioner/${req.user.id}`,
      },
    }

    await fhirStore.create("Condition", pregnancyCondition)

    // Send notification to patient
    try {
      await sendNotification({
        subject: { reference: `Patient/${patientId}` },
        payload: `🤱 Your pregnancy care has been initiated. Estimated due date: ${new Date(estimatedDueDate).toLocaleDateString()}. We're here to support you throughout your journey!`,
        recipients: [{ reference: `Patient/${patientId}` }],
        type: "pregnancy_created",
      })
    } catch (notificationError) {
      console.log("Pregnancy notification failed:", notificationError.message)
    }

    // Return response in expected format
    res.status(201).json({
      success: true,
      data: {
        id: createdPregnancy.id,
        patientId,
        lastMenstrualPeriod,
        estimatedDueDate,
        currentWeek,
        riskLevel,
        status: "active",
        createdAt: new Date().toISOString(),
      },
      message: "Pregnancy record has been created successfully",
    })
  } catch (error) {
    console.error("Error creating pregnancy:", error)
    res.status(500).json({
      success: false,
      message: "Failed to create pregnancy record",
      error: error.message,
    })
  }
}

/**
 * Get current pregnancy for a patient
 */
export const getCurrentPregnancy = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.user.id

    // For patients, ensure they can only access their own pregnancy
    if (req.user.role === "patient" && patientId !== req.user.id) {
      return res.status(403).json({
        message: "You can only access your own pregnancy information",
      })
    }

    // Find active pregnancy episode
    const pregnancyEpisodes = await fhirStore.search("EpisodeOfCare", {
      patient: `Patient/${patientId}`,
      status: "active",
    })

    const currentPregnancy = pregnancyEpisodes.find(
      (episode) => episode.type?.[0]?.coding?.[0]?.code === "118185001", // Pregnancy SNOMED code
    )

    if (!currentPregnancy) {
      return res.status(404).json({ message: "No active pregnancy found" })
    }

    // Get related conditions
    const conditions = await fhirStore.search("Condition", {
      subject: `Patient/${patientId}`,
      context: `EpisodeOfCare/${currentPregnancy.id}`,
    })

    // Get recent observations
    const observations = await fhirStore.search("Observation", {
      subject: `Patient/${patientId}`,
    })

    // Filter pregnancy-related observations (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentObservations = observations
      .filter((obs) => {
        const obsDate = new Date(obs.effectiveDateTime || obs.issued)
        return obsDate >= thirtyDaysAgo
      })
      .slice(0, 10) // Latest 10 observations

    // Calculate pregnancy details
    const lmpExtension = currentPregnancy.extension?.find(
      (ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/last-menstrual-period",
    )
    const riskLevelExtension = currentPregnancy.extension?.find(
      (ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/pregnancy-risk-level",
    )

    const lastMenstrualPeriod = lmpExtension?.valueDate
    const estimatedDueDate = currentPregnancy.period?.end
    const riskLevel = riskLevelExtension?.valueString || "low"

    // Calculate current gestational age
    let gestationalAge = null
    if (lastMenstrualPeriod) {
      const lmpDate = new Date(lastMenstrualPeriod)
      const now = new Date()
      const daysDiff = Math.floor((now - lmpDate) / (1000 * 60 * 60 * 24))
      gestationalAge = {
        weeks: Math.floor(daysDiff / 7),
        days: daysDiff % 7,
      }
    }

    res.json({
      pregnancy: currentPregnancy,
      details: {
        lastMenstrualPeriod,
        estimatedDueDate,
        gestationalAge,
        riskLevel,
        status: currentPregnancy.status,
      },
      conditions,
      recentObservations,
      summary: {
        totalObservations: recentObservations.length,
        activeConditions: conditions.filter((c) => c.clinicalStatus?.coding?.[0]?.code === "active").length,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update pregnancy information
 */
export const updatePregnancy = async (req, res, next) => {
  try {
    const { pregnancyId } = req.params
    const updates = req.body

    const pregnancy = await fhirStore.read("EpisodeOfCare", pregnancyId)
    if (!pregnancy) {
      return res.status(404).json({ message: "Pregnancy not found" })
    }

    // Update allowed fields
    const updatedPregnancy = {
      ...pregnancy,
      ...updates,
      // Preserve important fields
      resourceType: "EpisodeOfCare",
      id: pregnancyId,
      patient: pregnancy.patient,
      type: pregnancy.type,
    }

    const result = await fhirStore.update("EpisodeOfCare", pregnancyId, updatedPregnancy)

    res.json(result)
  } catch (error) {
    next(error)
  }
}

/**
 * Complete/close pregnancy
 */
export const completePregnancy = async (req, res, next) => {
  try {
    const { pregnancyId } = req.params
    const { outcome, deliveryDate, notes } = req.body

    const pregnancy = await fhirStore.read("EpisodeOfCare", pregnancyId)
    if (!pregnancy) {
      return res.status(404).json({ message: "Pregnancy not found" })
    }

    // Update pregnancy status
    const updatedPregnancy = {
      ...pregnancy,
      status: "finished",
      period: {
        ...pregnancy.period,
        end: deliveryDate || new Date().toISOString(),
      },
    }

    if (notes) {
      updatedPregnancy.note = [
        ...(pregnancy.note || []),
        {
          text: notes,
          time: new Date().toISOString(),
          authorReference: {
            reference: `Practitioner/${req.user.id}`,
          },
        },
      ]
    }

    const result = await fhirStore.update("EpisodeOfCare", pregnancyId, updatedPregnancy)

    // Update related conditions
    const conditions = await fhirStore.search("Condition", {
      context: `EpisodeOfCare/${pregnancyId}`,
    })

    for (const condition of conditions) {
      if (condition.clinicalStatus?.coding?.[0]?.code === "active") {
        await fhirStore.update("Condition", condition.id, {
          ...condition,
          clinicalStatus: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
                code: "resolved",
              },
            ],
          },
          abatementDateTime: deliveryDate || new Date().toISOString(),
        })
      }
    }

    res.json({
      pregnancy: result,
      message: "Pregnancy completed successfully",
    })
  } catch (error) {
    next(error)
  }
}
