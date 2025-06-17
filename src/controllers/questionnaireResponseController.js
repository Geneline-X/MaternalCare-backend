import fhirStore from "../models/fhirStore.js"
import { validateQuestionnaireResponse } from "../services/fhirService.js"
import { sendNotification } from "../services/notificationService.js"
import { logger } from "../utils/logger.js"

/**
 * Get all questionnaire responses with filtering
 */
export const getQuestionnaireResponses = async (req, res, next) => {
  try {
    // If patient role, ensure they can only see their own responses
    if (req.user.role === "patient") {
      req.query.subject = `Patient/${req.user.id}`
    }

    // Handle facility-based access for healthcare providers
    if (req.user.role === "practitioner" && req.user.facilityId) {
      // Get patients associated with this facility
      const facilityPatients = await fhirStore.search("Patient", {
        "organization.reference": `Organization/${req.user.facilityId}`,
      })

      // If no specific patient is requested, limit to facility patients
      if (!req.query.subject) {
        const patientIds = facilityPatients.map((patient) => patient.id)
        if (patientIds.length === 0) {
          return res.json([]) // No patients in facility
        }
        // Add patient filter
        req.query["subject:in"] = patientIds.map((id) => `Patient/${id}`).join(",")
      }
    }

    // Support pagination
    const limit = Number.parseInt(req.query._count || "20", 10)
    const offset = Number.parseInt(req.query._offset || "0", 10)

    // Support sorting
    const sort = req.query._sort || "-authored" // Default sort by authored date desc

    // Get responses with filters
    const responses = await fhirStore.search("QuestionnaireResponse", req.query)

    // Add pagination metadata
    const total = responses.length
    const paginatedResponses = responses.slice(offset, offset + limit)

    // Add links for pagination
    const links = []
    if (offset > 0) {
      links.push({
        relation: "prev",
        url: `/QuestionnaireResponse?_count=${limit}&_offset=${Math.max(0, offset - limit)}`,
      })
    }
    if (offset + limit < total) {
      links.push({
        relation: "next",
        url: `/QuestionnaireResponse?_count=${limit}&_offset=${offset + limit}`,
      })
    }

    // Format response in FHIR bundle format
    const bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total,
      link: links,
      entry: paginatedResponses.map((resource) => ({
        resource,
        search: {
          mode: "match",
        },
      })),
    }

    res.json(bundle)
  } catch (error) {
    logger.error("Error getting questionnaire responses", { error: error.message, userId: req.user.id })
    next(error)
  }
}

/**
 * Get form submissions for mobile (user-friendly format)
 */
export const getFormSubmissions = async (req, res, next) => {
  try {
    const patientId = req.user.id
    const { limit = 20, formId, status } = req.query

    const searchParams = {
      subject: `Patient/${patientId}`,
    }

    if (formId) {
      searchParams.questionnaire = `Questionnaire/${formId}`
    }

    if (status) {
      searchParams.status = status
    }

    const responses = await fhirStore.search("QuestionnaireResponse", searchParams)

    const submissions = await Promise.all(
      responses.slice(0, limit).map(async (response) => {
        const questionnaireId = response.questionnaire?.split("/")[1]
        let questionnaire = null

        try {
          questionnaire = await fhirStore.read("Questionnaire", questionnaireId)
        } catch (error) {
          logger.warn("Error fetching questionnaire", {
            error: error.message,
            questionnaireId,
          })
        }

        return {
          id: response.id,
          formId: questionnaireId,
          formTitle: questionnaire?.title || "Health Assessment",
          submittedAt: response.authored,
          status: response.status,
          responses:
            response.item?.reduce((acc, item) => {
              acc[item.linkId] = extractAnswerValue(item.answer?.[0])
              return acc
            }, {}) || {},
        }
      }),
    )

    res.json({
      success: true,
      data: {
        submissions: submissions.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
      },
    })
  } catch (error) {
    logger.error("Error getting form submissions", { error: error.message, userId: req.user.id })
    next(error)
  }
}

/**
 * Get a specific questionnaire response
 */
export const getQuestionnaireResponse = async (req, res, next) => {
  try {
    const response = await fhirStore.read("QuestionnaireResponse", req.params.id)

    // If patient role, ensure they can only see their own responses
    if (req.user.role === "patient") {
      const patientId = response.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({
          error: {
            code: "forbidden",
            message: "You can only access your own data",
          },
        })
      }
    }

    // If practitioner with facility, check if patient belongs to facility
    if (req.user.role === "practitioner" && req.user.facilityId) {
      const patientId = response.subject?.reference?.split("/")[1]
      if (patientId) {
        try {
          const patient = await fhirStore.read("Patient", patientId)
          const patientFacilityId = patient.managingOrganization?.reference?.split("/")[1]
          if (patientFacilityId !== req.user.facilityId) {
            return res.status(403).json({
              error: {
                code: "forbidden",
                message: "This patient is not associated with your facility",
              },
            })
          }
        } catch (error) {
          // If patient not found, deny access
          return res.status(403).json({
            error: {
              code: "forbidden",
              message: "Access denied",
            },
          })
        }
      }
    }

    res.json(response)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        error: {
          code: "not_found",
          message: `QuestionnaireResponse ${req.params.id} not found`,
        },
      })
    }
    logger.error("Error getting questionnaire response", {
      error: error.message,
      userId: req.user.id,
      responseId: req.params.id,
    })
    next(error)
  }
}

/**
 * Create/Submit questionnaire response (handles both FHIR and simple formats)
 */
export const createQuestionnaireResponse = async (req, res, next) => {
  try {
    let response = req.body

    // If it's a simple form submission, convert to FHIR QuestionnaireResponse
    if (req.body.formId && req.body.answers && !req.body.resourceType) {
      const { formId, patientId, answers, submittedAt, status = "completed" } = req.body

      // Get the questionnaire to validate against
      let questionnaire
      try {
        questionnaire = await fhirStore.read("Questionnaire", formId)
      } catch (error) {
        return res.status(400).json({
          error: {
            code: "invalid_questionnaire",
            message: `Questionnaire ${formId} not found`,
          },
        })
      }

      // Convert simple format to FHIR format
      response = {
        resourceType: "QuestionnaireResponse",
        status: status,
        subject: { reference: `Patient/${patientId || req.user.id}` },
        questionnaire: `Questionnaire/${formId}`,
        authored: submittedAt || new Date().toISOString(),
        author: { reference: `Patient/${patientId || req.user.id}` },
        item: Object.entries(answers).map(([questionId, answer]) => ({
          linkId: questionId,
          answer: formatAnswerValue(answer, questionnaire),
        })),
      }
    }

    // Validate required fields
    if (!response.questionnaire) {
      return res.status(400).json({
        error: {
          code: "missing_field",
          message: "Questionnaire reference is required",
        },
      })
    }

    if (!response.status) {
      return res.status(400).json({
        error: {
          code: "missing_field",
          message: "Status is required",
        },
      })
    }

    if (!response.item || !Array.isArray(response.item)) {
      return res.status(400).json({
        error: {
          code: "missing_field",
          message: "Response items are required",
        },
      })
    }

    // If patient role, ensure they can only submit their own responses
    if (req.user.role === "patient") {
      const patientId = response.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({
          error: {
            code: "forbidden",
            message: "You can only submit your own data",
          },
        })
      }
    }

    // Get the questionnaire to validate against
    const questionnaireId = response.questionnaire.split("/")[1]
    let questionnaire
    try {
      questionnaire = await fhirStore.read("Questionnaire", questionnaireId)
    } catch (error) {
      return res.status(400).json({
        error: {
          code: "invalid_questionnaire",
          message: `Questionnaire ${questionnaireId} not found`,
        },
      })
    }

    // Validate the response against the questionnaire
    const validationResult = await validateQuestionnaireResponse(response, questionnaire)
    if (!validationResult.valid) {
      return res.status(400).json({
        error: {
          code: "validation_error",
          message: validationResult.message,
          details: validationResult.details,
        },
      })
    }

    // Create the questionnaire response
    const createdResponse = await fhirStore.create("QuestionnaireResponse", response)

    // Store the created resource for middleware
    res.locals.createdResource = createdResponse

    // 🔔 SEND FORM SUBMISSION NOTIFICATIONS
    try {
      const patientRef = createdResponse.subject
      const questionnaireTitle = questionnaire.title || "Health Assessment"

      // Check if response contains concerning answers
      const hasConcerningAnswers = checkForConcerningAnswers(createdResponse, questionnaire)

      if (hasConcerningAnswers) {
        // Send urgent notification to healthcare provider
        await sendNotification({
          subject: patientRef,
          payload: `🚨 URGENT: Patient has submitted concerning responses in "${questionnaireTitle}". Please review immediately.`,
          recipients: [{ reference: `Practitioner/${req.user.facilityId ? "prac123" : req.user.id}` }, patientRef],
        })
      } else {
        // Send regular submission confirmation
        await sendNotification({
          subject: patientRef,
          payload: `Thank you for completing "${questionnaireTitle}". Your responses have been recorded and will be reviewed by your healthcare provider.`,
          recipients: [patientRef, { reference: `Practitioner/${req.user.facilityId ? "prac123" : req.user.id}` }],
        })
      }
    } catch (notificationError) {
      logger.error("Questionnaire response notification failed", {
        error: notificationError.message,
        responseId: createdResponse.id,
      })
    }

    // Return success response
    res.status(201).json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "information",
          code: "created",
          details: {
            text: "QuestionnaireResponse created successfully",
          },
        },
      ],
      response: createdResponse,
    })
  } catch (error) {
    logger.error("Error creating questionnaire response", { error: error.message, userId: req.user.id })
    next(error)
  }
}

/**
 * Update a questionnaire response
 */
export const updateQuestionnaireResponse = async (req, res, next) => {
  try {
    const response = req.body
    const responseId = req.params.id

    // Get existing response
    let existingResponse
    try {
      existingResponse = await fhirStore.read("QuestionnaireResponse", responseId)
    } catch (error) {
      return res.status(404).json({
        error: {
          code: "not_found",
          message: `QuestionnaireResponse ${responseId} not found`,
        },
      })
    }

    // If patient role, ensure they can only update their own responses
    if (req.user.role === "patient") {
      const patientId = existingResponse.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({
          error: {
            code: "forbidden",
            message: "You can only update your own data",
          },
        })
      }
    }

    // Check if response is in a state that can be updated
    if (existingResponse.status === "completed" && !["admin", "superadmin"].includes(req.user.role)) {
      return res.status(400).json({
        error: {
          code: "invalid_state",
          message: "Completed responses cannot be modified",
        },
      })
    }

    // Validate the updated response
    const questionnaireId = existingResponse.questionnaire.split("/")[1]
    let questionnaire
    try {
      questionnaire = await fhirStore.read("Questionnaire", questionnaireId)
    } catch (error) {
      return res.status(400).json({
        error: {
          code: "invalid_questionnaire",
          message: `Questionnaire ${questionnaireId} not found`,
        },
      })
    }

    // Validate the response against the questionnaire
    const validationResult = await validateQuestionnaireResponse(response, questionnaire)
    if (!validationResult.valid) {
      return res.status(400).json({
        error: {
          code: "validation_error",
          message: validationResult.message,
          details: validationResult.details,
        },
      })
    }

    // Update the response
    const updatedResponse = await fhirStore.update("QuestionnaireResponse", responseId, response)

    // 🔔 SEND UPDATE NOTIFICATION IF STATUS CHANGED TO COMPLETED
    if (existingResponse.status !== "completed" && updatedResponse.status === "completed") {
      try {
        const patientRef = updatedResponse.subject
        const questionnaireTitle = questionnaire.title || "Health Assessment"

        await sendNotification({
          subject: patientRef,
          payload: `Your "${questionnaireTitle}" has been updated and completed. Thank you for providing the additional information.`,
          recipients: [patientRef, { reference: `Practitioner/${req.user.facilityId ? "prac123" : req.user.id}` }],
        })
      } catch (notificationError) {
        logger.error("Questionnaire response update notification failed", {
          error: notificationError.message,
          responseId: updatedResponse.id,
        })
      }
    }

    res.json(updatedResponse)
  } catch (error) {
    logger.error("Error updating questionnaire response", {
      error: error.message,
      userId: req.user.id,
      responseId: req.params.id,
    })
    next(error)
  }
}

/**
 * Delete a questionnaire response
 */
export const deleteQuestionnaireResponse = async (req, res, next) => {
  try {
    const responseId = req.params.id

    // Get existing response
    let existingResponse
    try {
      existingResponse = await fhirStore.read("QuestionnaireResponse", responseId)
    } catch (error) {
      return res.status(404).json({
        error: {
          code: "not_found",
          message: `QuestionnaireResponse ${responseId} not found`,
        },
      })
    }

    // If patient role, ensure they can only delete their own responses
    if (req.user.role === "patient") {
      const patientId = existingResponse.subject?.reference?.split("/")[1]
      if (patientId !== req.user.id) {
        return res.status(403).json({
          error: {
            code: "forbidden",
            message: "You can only delete your own data",
          },
        })
      }
    }

    // Check if response can be deleted
    if (existingResponse.status === "completed" && !["admin", "superadmin"].includes(req.user.role)) {
      return res.status(400).json({
        error: {
          code: "invalid_state",
          message: "Completed responses cannot be deleted",
        },
      })
    }

    // Delete the response
    await fhirStore.delete("QuestionnaireResponse", responseId)

    // Return success response
    res.json({
      resourceType: "OperationOutcome",
      issue: [
        {
          severity: "information",
          code: "deleted",
          details: {
            text: `QuestionnaireResponse ${responseId} deleted successfully`,
          },
        },
      ],
    })
  } catch (error) {
    logger.error("Error deleting questionnaire response", {
      error: error.message,
      userId: req.user.id,
      responseId: req.params.id,
    })
    next(error)
  }
}

/**
 * Helper function to extract answer value from FHIR answer
 */
function extractAnswerValue(answer) {
  if (!answer) return null

  if (answer.valueString !== undefined) return answer.valueString
  if (answer.valueInteger !== undefined) return answer.valueInteger
  if (answer.valueDecimal !== undefined) return answer.valueDecimal
  if (answer.valueBoolean !== undefined) return answer.valueBoolean
  if (answer.valueDate !== undefined) return answer.valueDate
  if (answer.valueDateTime !== undefined) return answer.valueDateTime
  if (answer.valueTime !== undefined) return answer.valueTime
  if (answer.valueCoding?.display !== undefined) return answer.valueCoding.display
  if (answer.valueQuantity?.value !== undefined)
    return `${answer.valueQuantity.value} ${answer.valueQuantity.unit || ""}`

  return null
}

/**
 * Helper function to format answer value for FHIR
 */
function formatAnswerValue(answer, questionnaire) {
  if (answer === null || answer === undefined) {
    return []
  }

  // Find question type from questionnaire
  const findQuestionType = (linkId) => {
    const findInItems = (items) => {
      for (const item of items || []) {
        if (item.linkId === linkId) {
          return item.type
        }
        const found = findInItems(item.item)
        if (found) return found
      }
      return null
    }
    return findInItems(questionnaire.item) || "string"
  }

  if (typeof answer === "string") {
    return [{ valueString: answer }]
  } else if (typeof answer === "number") {
    if (Number.isInteger(answer)) {
      return [{ valueInteger: answer }]
    } else {
      return [{ valueDecimal: answer }]
    }
  } else if (typeof answer === "boolean") {
    return [{ valueBoolean: answer }]
  } else if (answer instanceof Date) {
    return [{ valueDateTime: answer.toISOString() }]
  } else if (typeof answer === "object" && answer.code && answer.display) {
    return [
      {
        valueCoding: {
          system: answer.system || "http://terminology.hl7.org/CodeSystem/v2-0203",
          code: answer.code,
          display: answer.display,
        },
      },
    ]
  }

  return [{ valueString: String(answer) }]
}

/**
 * Helper function to check for concerning answers in questionnaire response
 */
function checkForConcerningAnswers(response, questionnaire) {
  if (!response.item || !Array.isArray(response.item)) return false

  for (const item of response.item) {
    const answer = extractAnswerValue(item.answer?.[0])

    // Check for concerning keywords or values
    if (typeof answer === "string") {
      const concerningKeywords = [
        "severe",
        "extreme",
        "unbearable",
        "emergency",
        "urgent",
        "suicide",
        "harm",
        "danger",
        "crisis",
        "help",
      ]

      if (concerningKeywords.some((keyword) => answer.toLowerCase().includes(keyword.toLowerCase()))) {
        return true
      }
    }

    // Check for concerning numeric values (pain scales, etc.)
    if (typeof answer === "number") {
      // Pain scale 8-10 is concerning
      if (item.linkId.includes("pain") && answer >= 8) return true

      // Depression/anxiety scores above certain thresholds
      if (item.linkId.includes("depression") && answer >= 7) return true
      if (item.linkId.includes("anxiety") && answer >= 7) return true
    }

    // Check for concerning boolean answers
    if (typeof answer === "boolean" && answer === true) {
      if (item.linkId.includes("suicidal") || item.linkId.includes("harm") || item.linkId.includes("emergency")) {
        return true
      }
    }
  }

  return false
}
