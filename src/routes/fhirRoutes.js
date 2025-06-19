import express from "express"
import { authenticate } from "../middlewares/auth.js"
import { transformToFhir, transformFromFhir } from "../middlewares/fhirTransform.js"

// Import all controllers
import {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
} from "../controllers/patientController.js"
import {
  getObservations,
  getObservation,
  createObservation,
  updateObservation,
  deleteObservation,
} from "../controllers/observationController.js"
import {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAvailableDoctors,
} from "../controllers/appointmentController.js"
import {
  getQuestionnaires,
  getQuestionnaire,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
} from "../controllers/questionnaireController.js"
import {
  getQuestionnaireResponses,
  getQuestionnaireResponse,
  createQuestionnaireResponse,
  updateQuestionnaireResponse,
  deleteQuestionnaireResponse,
} from "../controllers/questionnaireResponseController.js"
import { getFlags, getFlag, createFlag, updateFlag, deleteFlag } from "../controllers/flagController.js"
import {
  getCarePlans,
  getCarePlan,
  createCarePlan,
  updateCarePlan,
  deleteCarePlan,
} from "../controllers/carePlanController.js"
import {
  getEncounters,
  getEncounter,
  createEncounter,
  updateEncounter,
  deleteEncounter,
} from "../controllers/encounterController.js"
import {
  getCommunications,
  getCommunication,
  createCommunication,
  updateCommunication,
  deleteCommunication,
  markAsRead,
  getNotificationCounts,
} from "../controllers/communicationController.js"

// Import new controllers at the top
import { getDashboardMetrics, getPatientAnalytics, getTodaySchedule } from "../controllers/dashboardController.js"
import { searchAll } from "../controllers/searchController.js"
import {
  createPregnancy,
  getCurrentPregnancy,
  updatePregnancy,
  completePregnancy,
} from "../controllers/pregnancyController.js"

// Import new controllers
import {
  getHealthMetrics,
  getHealthMetricsSummary,
  getHealthMetricsTrends,
} from "../controllers/healthMetricsController.js"
import {
  getFormTemplates,
  createFormTemplate,
  sendFormToPatients,
  updateFormTemplate,
  deleteFormTemplate,
} from "../controllers/formTemplateController.js"
import {
  getAnalyticsMetrics,
  getAnalyticsCharts,
  getAnalyticsInsights,
  exportAnalyticsReport,
} from "../controllers/analyticsController.js"
import { getAvailableTimeSlots } from "../controllers/scheduleController.js"
import { getPatientSummary } from "../controllers/patientController.js"
import { getEnhancedDashboardMetrics } from "../controllers/dashboardController.js"

const router = express.Router()

// Apply authentication to all routes
router.use(authenticate)

// Apply FHIR transformation middleware for all routes
router.use(transformToFhir) // Transform REST requests to FHIR
router.use(transformFromFhir) // Ensure FHIR responses

// Patient routes
router.get("/Patient", getPatients)
router.get("/Patient/:id", getPatient)
router.post("/Patient", createPatient)
router.put("/Patient/:id", updatePatient)
router.delete("/Patient/:id", deletePatient)

// Observation routes
router.get("/Observation", getObservations)
router.get("/Observation/:id", getObservation)
router.post("/Observation", createObservation)
router.put("/Observation/:id", updateObservation)
router.delete("/Observation/:id", deleteObservation)

// Appointment routes
router.get("/Appointment", getAppointments)
router.get("/Appointment/:id", getAppointment)
router.post("/Appointment", createAppointment)
router.put("/Appointment/:id", updateAppointment)
router.delete("/Appointment/:id", deleteAppointment)

// Available doctors route
router.get("/doctors", getAvailableDoctors)

// Questionnaire routes (forms)
router.get("/Questionnaire", getQuestionnaires)
router.get("/Questionnaire/:id", getQuestionnaire)
router.post("/Questionnaire", createQuestionnaire)
router.put("/Questionnaire/:id", updateQuestionnaire)
router.delete("/Questionnaire/:id", deleteQuestionnaire)

// QuestionnaireResponse routes (form submissions)
router.get("/QuestionnaireResponse", getQuestionnaireResponses)
router.get("/QuestionnaireResponse/:id", getQuestionnaireResponse)
router.post("/QuestionnaireResponse", createQuestionnaireResponse)
router.put("/QuestionnaireResponse/:id", updateQuestionnaireResponse)
router.delete("/QuestionnaireResponse/:id", deleteQuestionnaireResponse)

// Flag routes (alerts)
router.get("/Flag", getFlags)
router.get("/Flag/:id", getFlag)
router.post("/Flag", createFlag)
router.put("/Flag/:id", updateFlag)
router.delete("/Flag/:id", deleteFlag)

// CarePlan routes
router.get("/CarePlan", getCarePlans)
router.get("/CarePlan/:id", getCarePlan)
router.post("/CarePlan", createCarePlan)
router.put("/CarePlan/:id", updateCarePlan)
router.delete("/CarePlan/:id", deleteCarePlan)

// Encounter routes
router.get("/Encounter", getEncounters)
router.get("/Encounter/:id", getEncounter)
router.post("/Encounter", createEncounter)
router.put("/Encounter/:id", updateEncounter)
router.delete("/Encounter/:id", deleteEncounter)

// Communication/Notification routes
router.get("/Communication", getCommunications)
router.get("/Communication/counts", getNotificationCounts)
router.get("/Communication/:id", getCommunication)
router.post("/Communication", createCommunication)
router.put("/Communication/:id", updateCommunication)
router.put("/Communication/:id/read", markAsRead)
router.delete("/Communication/:id", deleteCommunication)

// Add these routes after the existing routes, before export default router

// Dashboard routes
router.get("/dashboard/metrics", getDashboardMetrics)
router.get("/dashboard/analytics", getPatientAnalytics)
router.get("/dashboard/schedule/today", getTodaySchedule)

// Search routes
router.get("/search", searchAll)

// Pregnancy management routes (FHIR EpisodeOfCare)
router.post("/pregnancy", createPregnancy)
router.get("/pregnancy/current/:patientId", getCurrentPregnancy)
router.get("/pregnancy/current", getCurrentPregnancy) // For patients to get their own
router.put("/pregnancy/:pregnancyId", updatePregnancy)
router.put("/pregnancy/:pregnancyId/complete", completePregnancy)

// Enhanced dashboard routes
router.get("/dashboard/enhanced-metrics", getEnhancedDashboardMetrics)

// Patient summary routes
router.get("/patients/summary", getPatientSummary)

// Health metrics routes
router.get("/health-metrics", getHealthMetrics)
router.get("/health-metrics/summary", getHealthMetricsSummary)
router.get("/health-metrics/trends", getHealthMetricsTrends)

// Form template routes
router.get("/forms/templates", getFormTemplates)
router.post("/forms/templates", createFormTemplate)
router.post("/forms/send", sendFormToPatients)
router.put("/forms/templates/:formId", updateFormTemplate)
router.delete("/forms/templates/:formId", deleteFormTemplate)

// Analytics routes
router.get("/analytics/metrics", getAnalyticsMetrics)
router.get("/analytics/charts", getAnalyticsCharts)
router.get("/analytics/insights", getAnalyticsInsights)
router.post("/analytics/export", exportAnalyticsReport)

// Schedule availability routes
router.get("/schedule/availability", getAvailableTimeSlots)

// Enhanced communication routes
router.put("/Communication/mark-all-read", markAsRead)

export default router
