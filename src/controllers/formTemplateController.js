import { fhirStore } from "../models/FhirStore.js"
import { sendNotification } from "../services/notificationService.js"
import User from "../models/User.js"

/**
 * Get all form templates - FIXED to match frontend expectations
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
          category: questionnaire.code?.[0]?.coding?.[0]?.display || "",
        }
      }),
    )

    // Apply pagination
    const startIndex = (_page - 1) * _count
    const paginatedForms = formsWithStats.slice(startIndex, startIndex + _count)

    // FIXED: Match frontend expected structure
    res.json({
      success: true,
      data: {
        data: paginatedForms, // Nested data structure as expected
        pagination: {
          page: Number.parseInt(_page),
          limit: Number.parseInt(_count),
          total: formsWithStats.length,
          totalPages: Math.ceil(formsWithStats.length / _count),
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create a new form template - FIXED to handle frontend field structure
 */
export const createFormTemplate = async (req, res, next) => {
  try {
    const { title, description, category, status = "draft", fields, version = "1.0" } = req.body

    // Validate required fields
    if (!title || !description || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and fields are required",
      })
    }

    // Convert frontend fields to FHIR Questionnaire items
    const items = fields.map((field, index) => {
      const item = {
        linkId: field.id || `q${index + 1}`,
        text: field.label,
        type: mapFieldTypeToFhir(field.type),
        required: field.required || false,
      }

      // Add options for select/radio/checkbox fields
      if (field.options && Array.isArray(field.options)) {
        item.answerOption = field.options.map((option) => ({
          valueString: option,
          valueCoding: {
            code: option.toLowerCase().replace(/\s+/g, "_"),
            display: option,
          },
        }))
      }

      // Add help text if provided
      if (field.helpText) {
        item.extension = [
          {
            url: "http://hl7.org/fhir/StructureDefinition/questionnaire-help",
            valueString: field.helpText,
          },
        ]
      }

      // Add placeholder if provided
      if (field.placeholder) {
        item.extension = item.extension || []
        item.extension.push({
          url: "http://prestack.com/fhir/StructureDefinition/questionnaire-placeholder",
          valueString: field.placeholder,
        })
      }

      return item
    })

    const questionnaire = {
      resourceType: "Questionnaire",
      status: status,
      title: title,
      description: description,
      version: version,
      date: new Date().toISOString(),
      publisher: req.user.name || `${req.user.firstName} ${req.user.lastName}` || "PreSTrack System",
      item: items,
    }

    // Add category if provided
    if (category) {
      questionnaire.code = [
        {
          coding: [
            {
              system: "http://prestack.com/fhir/form-categories",
              code: category.toLowerCase().replace(/\s+/g, "_"),
              display: category,
            },
          ],
        },
      ]
    }

    const createdQuestionnaire = await fhirStore.create("Questionnaire", questionnaire)

    // FIXED: Return structure that matches frontend expectations
    res.status(201).json({
      success: true,
      data: {
        id: createdQuestionnaire.id,
        title: createdQuestionnaire.title,
        description: createdQuestionnaire.description,
        category: category || "",
        status: createdQuestionnaire.status,
        version: createdQuestionnaire.version,
        fields: fields, // Return original fields structure
        createdBy: questionnaire.publisher,
        createdAt: createdQuestionnaire.date,
        updatedAt: createdQuestionnaire.meta?.lastUpdated || createdQuestionnaire.date,
        completedCount: 0,
        totalSent: 0,
      },
      message: "Form template created successfully",
    })
  } catch (error) {
    console.error("Error creating form template:", error)
    next(error)
  }
}

/**
 * Send form to selected patients - FIXED to match frontend expectations
 */
export const sendFormToPatients = async (req, res, next) => {
  try {
    const { formId, patientIds, message, priority = "medium" } = req.body

    // Validate required fields
    if (!formId || !patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Form ID and patient IDs are required",
      })
    }

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
        const notificationMessage = message || `You have a new form to complete: ${questionnaire.title}.`

        await sendNotification({
          subject: { reference: `Patient/${patientId}` },
          payload: notificationMessage,
          recipients: [{ reference: `Patient/${patientId}` }],
          type: "form_assignment",
          priority: priority,
          metadata: {
            formId: formId,
            formTitle: questionnaire.title,
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
        console.error(`Error sending form to patient ${patientId}:`, error)
        results.push({
          patientId,
          patientName: "Unknown Patient",
          status: "failed",
          error: error.message,
        })
        failedCount++
      }
    }

    // FIXED: Return structure that matches frontend expectations
    res.json({
      success: true,
      data: {
        formId,
        sentCount,
        failedCount,
        totalRequested: patientIds.length,
        results: results,
      },
      message: `Form sent to ${sentCount} patients successfully`,
    })
  } catch (error) {
    console.error("Error sending form to patients:", error)
    next(error)
  }
}

/**
 * Update form template - ENHANCED
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
    if (fields && Array.isArray(fields)) {
      items = fields.map((field, index) => {
        const item = {
          linkId: field.id || `q${index + 1}`,
          text: field.label,
          type: mapFieldTypeToFhir(field.type),
          required: field.required || false,
        }

        if (field.options && Array.isArray(field.options)) {
          item.answerOption = field.options.map((option) => ({
            valueString: option,
            valueCoding: {
              code: option.toLowerCase().replace(/\s+/g, "_"),
              display: option,
            },
          }))
        }

        if (field.helpText) {
          item.extension = [
            {
              url: "http://hl7.org/fhir/StructureDefinition/questionnaire-help",
              valueString: field.helpText,
            },
          ]
        }

        return item
      })
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

    // Update category if provided
    if (category) {
      updatedQuestionnaire.code = [
        {
          coding: [
            {
              system: "http://prestack.com/fhir/form-categories",
              code: category.toLowerCase().replace(/\s+/g, "_"),
              display: category,
            },
          ],
        },
      ]
    }

    const result = await fhirStore.update("Questionnaire", formId, updatedQuestionnaire)

    res.json({
      success: true,
      data: result,
      message: "Form template updated successfully",
    })
  } catch (error) {
    console.error("Error updating form template:", error)
    next(error)
  }
}

/**
 * Delete form template - ENHANCED
 */
export const deleteFormTemplate = async (req, res, next) => {
  try {
    const { formId } = req.params

    // Check if form exists
    const existingQuestionnaire = await fhirStore.read("Questionnaire", formId)
    if (!existingQuestionnaire) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }

    // Check if form has any responses
    const responses = await fhirStore.search("QuestionnaireResponse", {
      questionnaire: `Questionnaire/${formId}`,
    })

    if (responses.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete form template. It has ${responses.length} existing responses.`,
        data: {
          responseCount: responses.length,
        },
      })
    }

    await fhirStore.delete("Questionnaire", formId)

    res.json({
      success: true,
      data: {
        deletedFormId: formId,
        deletedAt: new Date().toISOString(),
      },
      message: "Form template deleted successfully",
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }
    console.error("Error deleting form template:", error)
    next(error)
  }
}

/**
 * Get single form template by ID
 */
export const getFormTemplate = async (req, res, next) => {
  try {
    const { formId } = req.params

    const questionnaire = await fhirStore.read("Questionnaire", formId)
    if (!questionnaire) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }

    // Convert FHIR items back to frontend field structure
    const fields =
      questionnaire.item?.map((item) => ({
        id: item.linkId,
        type: mapFhirTypeToField(item.type),
        label: item.text,
        required: item.required || false,
        placeholder:
          item.extension?.find(
            (ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/questionnaire-placeholder",
          )?.valueString || "",
        helpText:
          item.extension?.find((ext) => ext.url === "http://hl7.org/fhir/StructureDefinition/questionnaire-help")
            ?.valueString || "",
        options: item.answerOption?.map((option) => option.valueString) || undefined,
      })) || []

    // Get response statistics
    const responses = await fhirStore.search("QuestionnaireResponse", {
      questionnaire: `Questionnaire/${formId}`,
    })

    res.json({
      success: true,
      data: {
        id: questionnaire.id,
        title: questionnaire.title,
        description: questionnaire.description,
        category: questionnaire.code?.[0]?.coding?.[0]?.display || "",
        status: questionnaire.status,
        version: questionnaire.version,
        fields: fields,
        createdBy: questionnaire.publisher,
        createdAt: questionnaire.date,
        updatedAt: questionnaire.meta?.lastUpdated || questionnaire.date,
        completedCount: responses.length,
        totalSent: responses.length,
      },
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      })
    }
    console.error("Error getting form template:", error)
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

// Helper function to map FHIR types back to field types
function mapFhirTypeToField(fhirType) {
  const typeMap = {
    string: "text",
    text: "textarea",
    integer: "number",
    date: "date",
    choice: "select", // Default choice type
    attachment: "file",
  }
  return typeMap[fhirType] || "text"
}
