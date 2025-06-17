import { fhirStore } from "../models/FhirStore.js"
import { logger } from "../utils/logger.js"

// Map QuestionnaireResponse to FHIR resources
export const mapQuestionnaireResponseToResources = async (questionnaireResponse) => {
  try {
    // Get the questionnaire
    const questionnaireId = questionnaireResponse.questionnaire.split("/")[1]
    const questionnaire = await fhirStore.read("Questionnaire", questionnaireId)

    // Initialize resources to be created
    const resources = []

    // Get patient reference
    const patientReference = questionnaireResponse.subject?.reference
    if (!patientReference) {
      throw new Error("QuestionnaireResponse must have a subject reference")
    }

    // Extract patient ID
    const patientId = patientReference.split("/")[1]

    // Check if this is a patient registration form
    if (questionnaireId === "pregnancy-patient-registration") {
      // Create or update Patient resource
      let patient
      try {
        patient = await fhirStore.read("Patient", patientId)
      } catch (error) {
        // Patient doesn't exist, create a new one
        patient = {
          resourceType: "Patient",
          id: patientId,
          name: [{ given: [], family: "" }],
          telecom: [],
        }
      }

      // Map questionnaire items to patient fields
      questionnaireResponse.item.forEach((item) => {
        const answer = item.answer?.[0]
        if (!answer) return

        switch (item.linkId) {
          case "firstName":
            if (!patient.name[0].given) patient.name[0].given = []
            patient.name[0].given[0] = answer.valueString
            break
          case "lastName":
            patient.name[0].family = answer.valueString
            break
          case "gender":
            patient.gender = answer.valueString.toLowerCase()
            break
          case "birthDate":
            patient.birthDate = answer.valueDate
            break
          case "district":
            if (!patient.address) patient.address = [{}]
            patient.address[0].district = answer.valueString
            break
          case "chiefdom":
            if (!patient.address) patient.address = [{}]
            patient.address[0].city = answer.valueString
            break
        }
      })

      // Update or create the patient
      const updatedPatient = patient.id
        ? await fhirStore.update("Patient", patient.id, patient)
        : await fhirStore.create("Patient", patient)

      resources.push(updatedPatient)

      // Check for pregnancy status
      const pregnancyItem = questionnaireResponse.item.find((item) => item.linkId === "pregnancyStatus")
      if (pregnancyItem && pregnancyItem.answer && pregnancyItem.answer[0].valueBoolean) {
        // Create Observation for pregnancy status
        const observation = {
          resourceType: "Observation",
          status: "final",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "82810-3",
                display: "Pregnancy status",
              },
            ],
          },
          subject: { reference: patientReference },
          valueCodeableConcept: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "77386006",
                display: "Pregnant",
              },
            ],
          },
          effectiveDateTime: new Date().toISOString(),
        }

        const createdObservation = await fhirStore.create("Observation", observation)
        resources.push(createdObservation)

        // Create a CarePlan for prenatal visits
        const carePlan = {
          resourceType: "CarePlan",
          status: "active",
          intent: "plan",
          title: "Prenatal Care Plan",
          subject: { reference: patientReference },
          period: {
            start: new Date().toISOString(),
            end: new Date(new Date().setMonth(new Date().getMonth() + 9)).toISOString(),
          },
          activity: [
            {
              detail: {
                status: "scheduled",
                description: "First Trimester Checkup",
                scheduledTiming: {
                  repeat: {
                    boundsPeriod: {
                      start: new Date().toISOString(),
                      end: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
                    },
                  },
                },
              },
            },
            {
              detail: {
                status: "scheduled",
                description: "Second Trimester Checkup",
                scheduledTiming: {
                  repeat: {
                    boundsPeriod: {
                      start: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
                      end: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString(),
                    },
                  },
                },
              },
            },
            {
              detail: {
                status: "scheduled",
                description: "Third Trimester Checkup",
                scheduledTiming: {
                  repeat: {
                    boundsPeriod: {
                      start: new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString(),
                      end: new Date(new Date().setMonth(new Date().getMonth() + 9)).toISOString(),
                    },
                  },
                },
              },
            },
          ],
        }

        const createdCarePlan = await fhirStore.create("CarePlan", carePlan)
        resources.push(createdCarePlan)
      }
    } else {
      // Handle other questionnaire types
      // Map to appropriate resources based on questionnaire type

      // Extract vital signs and create observations
      const vitalSignMappings = {
        "blood-pressure-systolic": {
          code: "8480-6",
          display: "Systolic blood pressure",
          unit: "mm[Hg]",
          system: "http://unitsofmeasure.org",
        },
        "blood-pressure-diastolic": {
          code: "8462-4",
          display: "Diastolic blood pressure",
          unit: "mm[Hg]",
          system: "http://unitsofmeasure.org",
        },
        "heart-rate": {
          code: "8867-4",
          display: "Heart rate",
          unit: "/min",
          system: "http://unitsofmeasure.org",
        },
        "respiratory-rate": {
          code: "9279-1",
          display: "Respiratory rate",
          unit: "/min",
          system: "http://unitsofmeasure.org",
        },
        "body-temperature": {
          code: "8310-5",
          display: "Body temperature",
          unit: "Cel",
          system: "http://unitsofmeasure.org",
        },
        "body-weight": {
          code: "29463-7",
          display: "Body weight",
          unit: "kg",
          system: "http://unitsofmeasure.org",
        },
        "body-height": {
          code: "8302-2",
          display: "Body height",
          unit: "cm",
          system: "http://unitsofmeasure.org",
        },
      }

      // Process each item in the response
      for (const item of questionnaireResponse.item) {
        const mapping = vitalSignMappings[item.linkId]
        if (mapping && item.answer && item.answer[0]) {
          const answer = item.answer[0]
          let value

          if (answer.valueQuantity) {
            value = answer.valueQuantity.value
          } else if (answer.valueInteger) {
            value = answer.valueInteger
          } else if (answer.valueDecimal) {
            value = answer.valueDecimal
          } else {
            continue // Skip if no numeric value
          }

          // Create observation
          const observation = {
            resourceType: "Observation",
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: mapping.code,
                  display: mapping.display,
                },
              ],
            },
            subject: { reference: patientReference },
            effectiveDateTime: questionnaireResponse.authored || new Date().toISOString(),
            valueQuantity: {
              value: value,
              unit: mapping.unit,
              system: mapping.system,
              code: mapping.unit,
            },
          }

          const createdObservation = await fhirStore.create("Observation", observation)
          resources.push(createdObservation)
        }
      }
    }

    return resources
  } catch (error) {
    logger.error("Error mapping QuestionnaireResponse to resources:", error)
    throw error
  }
}

// Validate QuestionnaireResponse against Questionnaire
export const validateQuestionnaireResponse = async (questionnaireResponse, questionnaire) => {
  try {
    const errors = []

    // If questionnaire is a string reference, fetch the actual questionnaire
    let questionnaireObj = questionnaire
    if (typeof questionnaire === "string") {
      const questionnaireId = questionnaire.split("/")[1]
      questionnaireObj = await fhirStore.read("Questionnaire", questionnaireId)
    }

    // Validate required fields
    const requiredItems = findRequiredItems(questionnaireObj.item || [])

    for (const requiredItem of requiredItems) {
      const responseItem = findResponseItem(questionnaireResponse.item || [], requiredItem.linkId)

      if (!responseItem || !responseItem.answer || responseItem.answer.length === 0) {
        // Check if this item is conditionally required
        if (requiredItem.enableWhen && requiredItem.enableWhen.length > 0) {
          // Check if the condition is met
          const conditionMet = checkEnableWhenCondition(requiredItem.enableWhen, questionnaireResponse.item || [])

          // Only add error if condition is met and answer is missing
          if (conditionMet) {
            errors.push({
              field: requiredItem.linkId,
              message: `Missing required field: ${requiredItem.text}`,
              severity: "error",
            })
          }
        } else {
          // Unconditionally required
          errors.push({
            field: requiredItem.linkId,
            message: `Missing required field: ${requiredItem.text}`,
            severity: "error",
          })
        }
      }
    }

    // Validate answer types
    const allItems = findAllItems(questionnaireObj.item || [])

    for (const responseItem of questionnaireResponse.item || []) {
      const questionItem = allItems.find((item) => item.linkId === responseItem.linkId)

      if (questionItem && responseItem.answer && responseItem.answer.length > 0) {
        const answer = responseItem.answer[0]
        const validationError = validateAnswerType(answer, questionItem)

        if (validationError) {
          errors.push({
            field: responseItem.linkId,
            message: validationError,
            severity: "error",
          })
        }
      }
    }

    return {
      valid: errors.length === 0,
      message: errors.length > 0 ? `Validation failed with ${errors.length} errors` : "Validation successful",
      details: errors,
    }
  } catch (error) {
    logger.error("Error validating QuestionnaireResponse:", error)
    throw error
  }
}

// Helper functions for validation

function findRequiredItems(items) {
  let requiredItems = []

  for (const item of items) {
    if (item.required === true) {
      requiredItems.push(item)
    }

    if (item.item && item.item.length > 0) {
      requiredItems = requiredItems.concat(findRequiredItems(item.item))
    }
  }

  return requiredItems
}

function findAllItems(items) {
  let allItems = []

  for (const item of items) {
    allItems.push(item)

    if (item.item && item.item.length > 0) {
      allItems = allItems.concat(findAllItems(item.item))
    }
  }

  return allItems
}

function findResponseItem(items, linkId) {
  for (const item of items) {
    if (item.linkId === linkId) {
      return item
    }

    if (item.item && item.item.length > 0) {
      const found = findResponseItem(item.item, linkId)
      if (found) return found
    }
  }

  return null
}

function checkEnableWhenCondition(enableWhen, responseItems) {
  // For simplicity, we'll just check the first condition
  // In a real implementation, you'd need to handle multiple conditions with AND/OR logic
  const condition = enableWhen[0]

  const questionItem = findResponseItem(responseItems, condition.question)
  if (!questionItem || !questionItem.answer || questionItem.answer.length === 0) {
    return false
  }

  const answer = questionItem.answer[0]

  switch (condition.operator) {
    case "=":
      if (condition.answerBoolean !== undefined && answer.valueBoolean === condition.answerBoolean) {
        return true
      }
      if (condition.answerString !== undefined && answer.valueString === condition.answerString) {
        return true
      }
      if (condition.answerInteger !== undefined && answer.valueInteger === condition.answerInteger) {
        return true
      }
      if (condition.answerDecimal !== undefined && answer.valueDecimal === condition.answerDecimal) {
        return true
      }
      if (condition.answerDate !== undefined && answer.valueDate === condition.answerDate) {
        return true
      }
      if (condition.answerDateTime !== undefined && answer.valueDateTime === condition.answerDateTime) {
        return true
      }
      if (
        condition.answerCoding !== undefined &&
        answer.valueCoding &&
        answer.valueCoding.system === condition.answerCoding.system &&
        answer.valueCoding.code === condition.answerCoding.code
      ) {
        return true
      }
      break
    case "!=":
      // Implement not equals logic
      break
    case ">":
      // Implement greater than logic
      break
    case "<":
      // Implement less than logic
      break
    case ">=":
      // Implement greater than or equal logic
      break
    case "<=":
      // Implement less than or equal logic
      break
  }

  return false
}

function validateAnswerType(answer, questionItem) {
  switch (questionItem.type) {
    case "boolean":
      if (answer.valueBoolean === undefined) {
        return `Expected boolean answer for ${questionItem.text}`
      }
      break
    case "decimal":
      if (answer.valueDecimal === undefined) {
        return `Expected decimal answer for ${questionItem.text}`
      }
      break
    case "integer":
      if (answer.valueInteger === undefined) {
        return `Expected integer answer for ${questionItem.text}`
      }
      break
    case "date":
      if (answer.valueDate === undefined) {
        return `Expected date answer for ${questionItem.text}`
      }
      break
    case "dateTime":
      if (answer.valueDateTime === undefined) {
        return `Expected dateTime answer for ${questionItem.text}`
      }
      break
    case "time":
      if (answer.valueTime === undefined) {
        return `Expected time answer for ${questionItem.text}`
      }
      break
    case "string":
    case "text":
      if (answer.valueString === undefined) {
        return `Expected text answer for ${questionItem.text}`
      }
      break
    case "url":
      if (answer.valueUri === undefined) {
        return `Expected URL answer for ${questionItem.text}`
      }
      break
    case "choice":
    case "open-choice":
      if (answer.valueCoding === undefined && answer.valueString === undefined) {
        return `Expected choice answer for ${questionItem.text}`
      }

      // If answerOption is provided, validate against allowed options
      if (answer.valueCoding && questionItem.answerOption && questionItem.answerOption.length > 0) {
        const validOption = questionItem.answerOption.some(
          (option) => option.valueCoding && option.valueCoding.code === answer.valueCoding.code,
        )

        if (!validOption) {
          return `Invalid option selected for ${questionItem.text}`
        }
      }
      break
    case "quantity":
      if (answer.valueQuantity === undefined) {
        return `Expected quantity answer for ${questionItem.text}`
      }
      break
    case "attachment":
      if (answer.valueAttachment === undefined) {
        return `Expected attachment answer for ${questionItem.text}`
      }
      break
    case "reference":
      if (answer.valueReference === undefined) {
        return `Expected reference answer for ${questionItem.text}`
      }
      break
  }

  return null
}
