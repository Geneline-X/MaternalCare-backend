import { v4 as uuidv4 } from "uuid"

// Transform REST API requests to FHIR format
export const transformToFhir = (req, res, next) => {
  if (req.method === "GET") {
    return next() // No transformation needed for GET requests
  }

  try {
    const restData = req.body

    // Skip transformation if already in FHIR format
    if (restData.resourceType) {
      return next()
    }

    let fhirResource = {}
    const resourceType = getResourceTypeFromPath(req.path)

    switch (resourceType) {
      case "Patient":
        fhirResource = transformPatientToFhir(restData)
        break
      case "Appointment":
        fhirResource = transformAppointmentToFhir(restData)
        break
      case "Observation":
        fhirResource = transformObservationToFhir(restData)
        break
      case "Questionnaire":
        fhirResource = transformQuestionnaireToFhir(restData)
        break
      case "QuestionnaireResponse":
        fhirResource = transformQuestionnaireResponseToFhir(restData)
        break
      case "Flag":
        fhirResource = transformFlagToFhir(restData)
        break
      case "Communication":
        fhirResource = transformCommunicationToFhir(restData)
        break
      case "CarePlan":
        fhirResource = transformCarePlanToFhir(restData)
        break
      case "Encounter":
        fhirResource = transformEncounterToFhir(restData)
        break
      default:
        return next() // No transformation for unknown resource types
    }

    req.body = fhirResource
    next()
  } catch (error) {
    res.status(400).json({
      error: "Invalid request format",
      details: error.message,
    })
  }
}

// Transform FHIR responses back to FHIR format (keep as FHIR)
export const transformFromFhir = (req, res, next) => {
  const originalJson = res.json

  res.json = function (data) {
    try {
      // Always return FHIR format as requested
      return originalJson.call(this, data)
    } catch (error) {
      console.error("Error in response transformation:", error)
      return originalJson.call(this, data)
    }
  }

  next()
}

// Helper function to extract resource type from URL path
function getResourceTypeFromPath(path) {
  const pathParts = path.split("/")
  const fhirIndex = pathParts.indexOf("fhir")
  if (fhirIndex !== -1 && fhirIndex + 1 < pathParts.length) {
    return pathParts[fhirIndex + 1]
  }
  return null
}

// Patient transformations
function transformPatientToFhir(restData) {
  return {
    resourceType: "Patient",
    id: restData.id || uuidv4(),
    active: restData.active !== false,
    name: [
      {
        given: restData.firstName ? [restData.firstName] : [],
        family: restData.lastName || "",
      },
    ],
    gender: restData.gender?.toLowerCase(),
    birthDate: restData.birthDate,
    telecom: [
      ...(restData.phone
        ? [
            {
              system: "phone",
              value: restData.phone,
              use: "mobile",
            },
          ]
        : []),
      ...(restData.email
        ? [
            {
              system: "email",
              value: restData.email,
            },
          ]
        : []),
    ],
    address: restData.address
      ? [
          {
            line: [restData.address.street],
            city: restData.address.city,
            district: restData.address.district,
            state: restData.address.state,
            postalCode: restData.address.postalCode,
            country: restData.address.country,
          },
        ]
      : [],
  }
}

// Appointment transformations - Updated to reference User instead of Practitioner
function transformAppointmentToFhir(restData) {
  // Calculate start and end times
  const startDateTime = `${restData.date}T${restData.time}:00.000Z`
  const endDateTime = calculateEndTime(startDateTime, restData.duration || 30)

  return {
    resourceType: "Appointment",
    id: restData.id || uuidv4(),
    status: restData.status || "pending",
    appointmentType: {
      coding: [
        {
          system: "http://terminology.hl7.org/CodeSystem/v2-0276",
          code: restData.appointmentType || "routine",
          display: capitalizeFirst(restData.appointmentType || "routine"),
        },
      ],
    },
    description: restData.reason || "",
    start: startDateTime,
    end: endDateTime,
    minutesDuration: restData.duration || 30,
    comment: restData.notes || "",
    // Store the actual user IDs for easy reference
    patientId: restData.patientId,
    doctorId: restData.doctorId,
    participant: [
      {
        actor: { reference: `Patient/${restData.patientId}` },
        required: "required",
        status: "accepted",
      },
      {
        actor: { reference: `User/${restData.doctorId}` }, // Changed to reference User
        required: "required",
        status: "accepted",
      },
    ],
    // Add custom extensions for additional fields
    extension: [
      {
        url: "http://prestack.com/fhir/StructureDefinition/preferred-contact",
        valueString: restData.preferredContact || "phone",
      },
      {
        url: "http://prestack.com/fhir/StructureDefinition/reminder-enabled",
        valueBoolean: restData.reminderEnabled !== false,
      },
    ],
  }
}

// Observation transformations
function transformObservationToFhir(restData) {
  return {
    resourceType: "Observation",
    id: restData.id || uuidv4(),
    status: restData.status || "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: restData.code || "8310-5",
          display: restData.name || restData.display || "Body temperature",
        },
      ],
    },
    subject: {
      reference: `Patient/${restData.patientId}`,
    },
    effectiveDateTime: restData.date || new Date().toISOString(),
    valueQuantity: restData.value
      ? {
          value: Number.parseFloat(restData.value),
          unit: restData.unit || "",
          system: "http://unitsofmeasure.org",
        }
      : undefined,
    valueString: restData.valueString,
    valueBoolean: restData.valueBoolean,
    note: restData.notes
      ? [
          {
            text: restData.notes,
          },
        ]
      : [],
  }
}

// Questionnaire transformations
function transformQuestionnaireToFhir(restData) {
  return {
    resourceType: "Questionnaire",
    id: restData.id || uuidv4(),
    status: restData.status || "active",
    title: restData.title,
    description: restData.description,
    item:
      restData.questions?.map((q, index) => ({
        linkId: q.id || `q${index + 1}`,
        text: q.text || q.question,
        type: mapQuestionType(q.type),
        required: q.required || false,
        answerOption: q.options?.map((opt) => ({
          valueString: opt.value || opt,
          valueCoding: {
            code: opt.value || opt,
            display: opt.label || opt,
          },
        })),
      })) || [],
  }
}

// QuestionnaireResponse transformations
function transformQuestionnaireResponseToFhir(restData) {
  return {
    resourceType: "QuestionnaireResponse",
    id: restData.id || uuidv4(),
    status: restData.status || "completed",
    subject: {
      reference: `Patient/${restData.patientId}`,
    },
    questionnaire: `Questionnaire/${restData.questionnaireId || restData.formId}`,
    authored: restData.submittedAt || new Date().toISOString(),
    author: {
      reference: `Patient/${restData.patientId}`,
    },
    item: Object.entries(restData.answers || {}).map(([questionId, answer]) => ({
      linkId: questionId,
      answer: formatAnswerValue(answer),
    })),
  }
}

// Flag transformations
function transformFlagToFhir(restData) {
  return {
    resourceType: "Flag",
    id: restData.id || uuidv4(),
    status: restData.status || "active",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/flag-category",
            code: restData.category || "safety",
            display: restData.category || "Safety",
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: "http://snomed.info/sct",
          code: restData.code || "22253000",
          display: restData.condition || restData.description,
        },
      ],
      text: restData.description,
    },
    subject: {
      reference: `Patient/${restData.patientId}`,
    },
    period: {
      start: restData.startDate || new Date().toISOString(),
      end: restData.endDate,
    },
  }
}

// Communication transformations
function transformCommunicationToFhir(restData) {
  return {
    resourceType: "Communication",
    id: restData.id || uuidv4(),
    status: restData.status || "completed",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/communication-category",
            code: restData.type || "notification",
            display: restData.type || "Notification",
          },
        ],
      },
    ],
    subject: restData.patientId
      ? {
          reference: `Patient/${restData.patientId}`,
        }
      : undefined,
    recipient: restData.recipientId
      ? [
          {
            reference: `${restData.recipientType || "Patient"}/${restData.recipientId}`,
          },
        ]
      : [],
    sender: restData.senderId
      ? {
          reference: `${restData.senderType || "User"}/${restData.senderId}`, // Changed to User
        }
      : undefined,
    payload: [
      {
        contentString: restData.message || restData.content,
      },
    ],
    sent: restData.sentAt || new Date().toISOString(),
  }
}

// CarePlan transformations
function transformCarePlanToFhir(restData) {
  return {
    resourceType: "CarePlan",
    id: restData.id || uuidv4(),
    status: restData.status || "active",
    intent: restData.intent || "plan",
    title: restData.title,
    description: restData.description,
    subject: {
      reference: `Patient/${restData.patientId}`,
    },
    period: {
      start: restData.startDate || new Date().toISOString(),
      end: restData.endDate,
    },
    activity:
      restData.activities?.map((activity) => ({
        detail: {
          status: activity.status || "scheduled",
          description: activity.description,
          scheduledTiming: activity.schedule
            ? {
                repeat: {
                  frequency: activity.schedule.frequency,
                  period: activity.schedule.period,
                },
              }
            : undefined,
        },
      })) || [],
  }
}

// Encounter transformations
function transformEncounterToFhir(restData) {
  return {
    resourceType: "Encounter",
    id: restData.id || uuidv4(),
    status: restData.status || "finished",
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: restData.type || "AMB",
      display: restData.type === "AMB" ? "Ambulatory" : restData.type,
    },
    subject: {
      reference: `Patient/${restData.patientId}`,
    },
    participant: restData.doctorId
      ? [
          {
            individual: {
              reference: `User/${restData.doctorId}`, // Changed to User
            },
          },
        ]
      : [],
    period: {
      start: restData.startTime || new Date().toISOString(),
      end: restData.endTime,
    },
    reasonCode: restData.reason
      ? [
          {
            text: restData.reason,
          },
        ]
      : [],
  }
}

// Helper functions
function calculateEndTime(startTime, durationMinutes) {
  const start = new Date(startTime)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  return end.toISOString()
}

function mapQuestionType(restType) {
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
  return typeMap[restType] || "string"
}

function formatAnswerValue(answer) {
  if (typeof answer === "string") {
    return [{ valueString: answer }]
  } else if (typeof answer === "number") {
    return [{ valueInteger: answer }]
  } else if (typeof answer === "boolean") {
    return [{ valueBoolean: answer }]
  }
  return [{ valueString: String(answer) }]
}

// Helper function to capitalize first letter
function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default {
  transformToFhir,
  transformFromFhir,
}
