import { fhirStore } from "../models/FhirStore.js"
import { sendNotification } from "../services/notificationService.js"
import User from "../models/User.js"

/**
 * Get all form templates
 */
export const getFormTemplates = async (req, res, next) => {
  try {
    const { status, _page = 1, _count = 20 } = req.query

    // Get questionnaires (form templates)
    let questionnaires = await fhirStore.search("Questionnaire", {})

    // Filter by status if provided
    if (status) {
      questionnaires = questionnaires.filter((q) => q.status === status)
    }

    // Get response counts for each form
    const formsWithStats = await Promise.all(
      questionnaires.map(async (questionnaire) => {
        const responses = await fhirStore.search("QuestionnaireResponse", {
          questionnaire: `Questionnaire/${questionnaire.id}`,
        })

        return {
          id: questionnaire.id,
          title: questionnaire.title || "Untitled Form",
          description: questionnaire.description || "",
          version: questionnaire.version || "1.0",
          status: questionnaire.status || "draft",
          completedCount: responses.length,
          totalSent: responses.length, // For now, assume all responses were sent
          lastUpdated: questionnaire.meta?.lastUpdated || questionnaire.date,
          createdBy: questionnaire.publisher || req.user.name,
        }
      }),
    )

    // Apply pagination
    const startIndex = (_page - 1) * _count
    const paginatedForms = formsWithStats.slice(startIndex, startIndex + _count)

    res.json({
      data: paginatedForms,
      pagination: {
        page: Number.parseInt(_page),
        limit: Number.parseInt(_count),
        total: formsWithStats.length,
        totalPages: Math.ceil(formsWithStats.length / _count),
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new form template
 */
export const createFormTemplate = async (req, res, next) => {
  try {
    const { title, description, category, status = "draft", fields, version = "1.0" } = req.body

    // Convert fields to FHIR Questionnaire items
    const items = fields.map((field, index) => ({
      linkId: field.id || `q${index + 1}`,
      text: field.label,
      type: mapFieldTypeToFhir(field.type),
      required: field.required || false,
      ...(field.options && {
        answerOption: field.options.map((option) => ({
          valueString: option,
          valueCoding: {
            code: option.toLowerCase().replace(/\s+/g, "_"),
            display: option,
          },
        })),
      }),
      ...(field.helpText && {
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/questionnaire-help",
            valueString: field.helpText,
          },
        ],
      }),
    }))

    const questionnaire = {
      resourceType: "Questionnaire",
      status: status,
      title: title,
      description: description,
      version: version,
      date: new Date().toISOString(),
      publisher: req.user.name || "PreSTrack System",
      item: items,
      ...(category && {
        code: [
          {
            coding: [
              {
                system: "http://prestack.com/fhir/form-categories",
                code: category.toLowerCase().replace(/\s+/g, "_"),
                display: category,
              },
            ],
          },
        ],
      }),
    }

    const createdQuestionnaire = await fhirStore.create("Questionnaire", questionnaire)

    res.status(201).json({
      success: true,
      data: {
        id: createdQuestionnaire.id,
        title: createdQuestionnaire.title,
        description: createdQuestionnaire.description,
        category: category,
        status: createdQuestionnaire.status,
        version: createdQuestionnaire.version,
        fields: fields,
        createdBy: req.user.name,
        createdAt: createdQuestionnaire.date,
        updatedAt: createdQuestionnaire.meta?.lastUpdated,
        completedCount: 0,
        totalSent: 0,
      },
      message: "Form template created successfully",
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Send form to selected patients
 */
export const sendFormToPatients = async (req, res, next) => {
  try {
    const { formId, patientIds, message, dueDate, priority = "medium" } = req.body

    // Validate form exists
    const questionnaire = await fhirStore.read("Questionnaire", formId)
    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }

    const results = []
    let sentCount = 0
    let failedCount = 0

    // Send to each patient
    for (const patientId of patientIds) {
      try {
        const patient = await User.findById(patientId).select("firstName lastName email")
        if (!patient) {
          results.push({
            patientId,
            patientName: "Unknown Patient",
            status: "failed",
            error: "Patient not found",
          })
          failedCount++
          continue
        }

        // Create notification for patient
        const notificationMessage =
          message ||
          `You have a new form to complete: ${questionnaire.title}. ${dueDate ? `Please complete by ${new Date(dueDate).toLocaleDateString()}.` : ""}`

        await sendNotification({
          subject: { reference: `Patient/${patientId}` },
          payload: notificationMessage,
          recipients: [{ reference: `Patient/${patientId}` }],
          type: "form_assignment",
          priority: priority,
          metadata: {
            formId: formId,
            dueDate: dueDate,
          },
        })

        results.push({
          patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          status: "sent",
          sentAt: new Date().toISOString(),
        })
        sentCount++
      } catch (error) {
        results.push({
          patientId,
          patientName: "Unknown Patient",
          status: "failed",
          error: error.message,
        })
        failedCount++
      }
    }

    res.json({
      success: true,
      data: {
        formId,
        sentCount,
        failedCount,
        sentTo: results,
      },
      message: "Form sent successfully",
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Update form template
 */
export const updateFormTemplate = async (req, res, next) => {
  try {
    const { formId } = req.params
    const { title, description, category, status, fields, version } = req.body

    const existingQuestionnaire = await fhirStore.read("Questionnaire", formId)
    if (!existingQuestionnaire) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }

    // Convert fields to FHIR items if provided
    let items = existingQuestionnaire.item
    if (fields) {
      items = fields.map((field, index) => ({
        linkId: field.id || `q${index + 1}`,
        text: field.label,
        type: mapFieldTypeToFhir(field.type),
        required: field.required || false,
        ...(field.options && {
          answerOption: field.options.map((option) => ({
            valueString: option,
            valueCoding: {
              code: option.toLowerCase().replace(/\s+/g, "_"),
              display: option,
            },
          })),
        }),
      }))
    }

    const updatedQuestionnaire = {
      ...existingQuestionnaire,
      title: title || existingQuestionnaire.title,
      description: description || existingQuestionnaire.description,
      status: status || existingQuestionnaire.status,
      version: version || existingQuestionnaire.version,
      item: items,
      date: new Date().toISOString(),
    }

    const result = await fhirStore.update("Questionnaire", formId, updatedQuestionnaire)

    res.json({
      success: true,
      data: result,
      message: "Form template updated successfully",
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Delete form template
 */
export const deleteFormTemplate = async (req, res, next) => {
  try {
    const { formId } = req.params

    // Check if form has any responses
    const responses = await fhirStore.search("QuestionnaireResponse", {
      questionnaire: `Questionnaire/${formId}`,
    })

    if (responses.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete form template with existing responses",
      })
    }

    await fhirStore.delete("Questionnaire", formId)

    res.json({
      success: true,
      message: "Form template deleted successfully",
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }
    next(error)
  }
}

// Helper function to map field types to FHIR types
function mapFieldTypeToFhir(fieldType) {
  const typeMap = {
    text: "string",
    textarea: "text",
    number: "integer",
    date: "date",
    select: "choice",
    radio: "choice",
    checkbox: "choice",
    file: "attachment",
  }
  return typeMap[fieldType] || "string"
}
