import { fhirStore } from "../models/FhirStore.js"

/**
 * Get all questionnaires
 */
export const getQuestionnaires = async (req, res, next) => {
  try {
    const filters = {}

    // Add filters from query params
    if (req.query.status) filters.status = req.query.status
    if (req.query.title) filters.title = req.query.title
    if (req.query.publisher) filters.publisher = req.query.publisher

    const questionnaires = await fhirStore.search("Questionnaire", filters)

    // Return user-friendly format for mobile/web clients
    if (req.headers["x-client-type"] === "mobile" || req.query.format === "simple") {
      const simplifiedQuestionnaires = questionnaires.map((q) => ({
        id: q.id,
        title: q.title,
        description: q.description || "",
        status: q.status,
        version: q.version,
        lastUpdated: q.meta?.lastUpdated,
        itemCount: q.item?.length || 0,
      }))

      return res.json({
        success: true,
        data: { questionnaires: simplifiedQuestionnaires },
      })
    }

    res.json(questionnaires)
  } catch (error) {
    next(error)
  }
}

// Get questionnaires for mobile/patient use (simplified format)
export const getPatientForms = async (req, res, next) => {
  try {
    const patientId = req.user.id
    const questionnaires = await fhirStore.search("Questionnaire", {
      status: "active",
    })

    // Check for existing responses
    const forms = await Promise.all(
      questionnaires.map(async (questionnaire) => {
        const responses = await fhirStore.search("QuestionnaireResponse", {
          questionnaire: `Questionnaire/${questionnaire.id}`,
          subject: `Patient/${patientId}`,
        })

        const hasResponse = responses.length > 0
        const latestResponse = responses.sort((a, b) => new Date(b.authored) - new Date(a.authored))[0]

        return {
          id: questionnaire.id,
          title: questionnaire.title || "Health Assessment",
          description: questionnaire.description || "Please complete this health assessment",
          status: hasResponse ? "completed" : "pending",
          estimatedTime: "5 minutes",
          category: questionnaire.code?.[0]?.coding?.[0]?.display || "health_tracking",
          lastCompleted: latestResponse?.authored || null,
        }
      }),
    )

    res.json({
      success: true,
      data: { forms },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a specific questionnaire
 */
export const getQuestionnaire = async (req, res, next) => {
  try {
    const { id } = req.params
    const questionnaire = await fhirStore.read("Questionnaire", id)

    // Return user-friendly format for mobile/web clients
    if (req.headers["x-client-type"] === "mobile" || req.query.format === "simple") {
      const simplified = {
        id: questionnaire.id,
        title: questionnaire.title,
        description: questionnaire.description || "",
        status: questionnaire.status,
        version: questionnaire.version,
        items: questionnaire.item || [],
        lastUpdated: questionnaire.meta?.lastUpdated,
      }

      return res.json({
        success: true,
        data: simplified,
      })
    }

    res.json(questionnaire)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Questionnaire not found",
      })
    }
    next(error)
  }
}

// Get form details for mobile (user-friendly format)
export const getFormDetails = async (req, res, next) => {
  try {
    const { id } = req.params
    const questionnaire = await fhirStore.read("Questionnaire", id)

    const formDetails = {
      id: questionnaire.id,
      title: questionnaire.title || "Health Assessment",
      description: questionnaire.description || "",
      instructions: questionnaire.purpose || "Please answer all questions honestly",
      estimatedTime: "5 minutes",
      questions:
        questionnaire.item?.map((item) => ({
          id: item.linkId,
          text: item.text,
          type: mapQuestionType(item.type),
          required: item.required || false,
          options:
            item.answerOption?.map((option) => ({
              value: option.valueCoding?.code || option.valueString,
              label: option.valueCoding?.display || option.valueString,
            })) || null,
        })) || [],
    }

    res.json({
      success: true,
      data: formDetails,
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: "Form not found" })
    }
    next(error)
  }
}

/**
 * Create a new questionnaire
 */
export const createQuestionnaire = async (req, res, next) => {
  try {
    let questionnaireData

    // Handle both FHIR format and simple REST format
    if (req.body.resourceType === "Questionnaire") {
      // Already in FHIR format
      questionnaireData = req.body
    } else {
      // Convert from simple REST format to FHIR
      questionnaireData = {
        resourceType: "Questionnaire",
        status: req.body.status || "active",
        title: req.body.title,
        description: req.body.description,
        version: req.body.version || "1.0.0",
        date: req.body.date || new Date().toISOString(),
        publisher: req.body.publisher || "PreSTrack System",
        item: req.body.items || req.body.questions || [],
      }
    }

    const questionnaire = await fhirStore.create("Questionnaire", questionnaireData)

    res.status(201).json({
      success: true,
      message: "Questionnaire created successfully",
      data: { questionnaire },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update a questionnaire
 */
export const updateQuestionnaire = async (req, res, next) => {
  try {
    const { id } = req.params
    let updateData

    // Handle both FHIR format and simple REST format
    if (req.body.resourceType === "Questionnaire") {
      updateData = req.body
    } else {
      // Convert from simple REST format
      const existing = await fhirStore.read("Questionnaire", id)
      updateData = {
        ...existing,
        title: req.body.title || existing.title,
        description: req.body.description || existing.description,
        status: req.body.status || existing.status,
        version: req.body.version || existing.version,
        item: req.body.items || req.body.questions || existing.item,
        date: new Date().toISOString(),
      }
    }

    const questionnaire = await fhirStore.update("Questionnaire", id, updateData)

    res.json({
      success: true,
      message: "Questionnaire updated successfully",
      data: { questionnaire },
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Questionnaire not found",
      })
    }
    next(error)
  }
}

/**
 * Delete a questionnaire
 */
export const deleteQuestionnaire = async (req, res, next) => {
  try {
    const { id } = req.params
    await fhirStore.delete("Questionnaire", id)

    res.json({
      success: true,
      message: "Questionnaire deleted successfully",
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Questionnaire not found",
      })
    }
    next(error)
  }
}

// Helper function
function mapQuestionType(type) {
  const typeMap = {
    text: "string",
    textarea: "text",
    number: "integer",
    decimal: "decimal",
    boolean: "boolean",
    select: "choice",
    radio: "choice",
    checkbox: "choice",
    date: "date",
    datetime: "dateTime",
  }
  return typeMap[type] || "string"
}
