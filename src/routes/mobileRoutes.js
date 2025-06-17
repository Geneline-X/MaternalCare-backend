import { Router } from "express"
import { requireAuth } from "@clerk/express"
import { authenticate, requireRole, enforceDataOwnership, auditLog } from "../middlewares/auth.js"
import mobileController from "../controllers/mobileController.js"
import appointmentController from "../controllers/appointmentController.js"
import messageController from "../controllers/messageController.js"
import notificationController from "../controllers/notificationController.js"
import formController from "../controllers/formController.js"
import fileController, { upload } from "../controllers/fileController.js"

const router = Router()

// Apply authentication to all mobile routes
router.use(requireAuth())
router.use(authenticate)

// Doctor Dashboard & Analytics
router.get(
  "/analytics/dashboard",
  requireRole("doctor"),
  auditLog("GET_DOCTOR_DASHBOARD"),
  mobileController.getDoctorDashboard,
)

// Patient Management (Doctor)
router.get(
  "/patients",
  requireRole("doctor", "nurse"),
  auditLog("GET_MOBILE_PATIENTS"),
  mobileController.getMobilePatients,
)

router.get(
  "/patients/:id",
  requireRole("doctor", "nurse", "patient"),
  enforceDataOwnership,
  auditLog("GET_MOBILE_PATIENT_DETAILS"),
  mobileController.getMobilePatientDetails,
)

router.post(
  "/patients",
  requireRole("doctor", "nurse"),
  auditLog("CREATE_MOBILE_PATIENT"),
  mobileController.createMobilePatient,
)

// Pregnancy Dashboard (Patient)
router.get(
  "/pregnancies/current/:patientId",
  requireRole("doctor", "nurse"),
  auditLog("GET_CURRENT_PREGNANCY"),
  mobileController.getCurrentPregnancy,
)

router.get(
  "/pregnancies/current",
  requireRole("patient"),
  auditLog("GET_MY_CURRENT_PREGNANCY"),
  mobileController.getCurrentPregnancy,
)

// Health Metrics
router.get(
  "/health-metrics/patient/:patientId",
  requireRole("doctor", "nurse"),
  auditLog("GET_PATIENT_HEALTH_METRICS"),
  mobileController.getMobileHealthMetrics,
)

router.get(
  "/health-metrics/my-metrics",
  requireRole("patient"),
  auditLog("GET_MY_HEALTH_METRICS"),
  mobileController.getMyHealthMetrics,
)

// Appointments
router.get(
  "/appointments/doctor/:doctorId",
  requireRole("doctor"),
  auditLog("GET_DOCTOR_APPOINTMENTS"),
  appointmentController.getDoctorAppointments,
)

router.get(
  "/appointments/my-appointments",
  requireRole("patient"),
  auditLog("GET_PATIENT_APPOINTMENTS"),
  appointmentController.getPatientAppointments,
)

router.post(
  "/appointments",
  requireRole("doctor", "nurse"),
  auditLog("CREATE_APPOINTMENT"),
  appointmentController.createAppointment,
)

router.post(
  "/appointments/request",
  requireRole("patient"),
  auditLog("REQUEST_APPOINTMENT"),
  appointmentController.requestAppointment,
)

// Messaging
router.get("/messages/conversations", auditLog("GET_CONVERSATIONS"), messageController.getConversations)

router.get(
  "/messages/conversation/:conversationId",
  auditLog("GET_CONVERSATION_MESSAGES"),
  messageController.getConversationMessages,
)

router.post("/messages", auditLog("SEND_MESSAGE"), messageController.sendMessage)

// Notifications
router.get("/notifications", auditLog("GET_NOTIFICATIONS"), notificationController.getNotifications)

router.put("/notifications/:id/read", auditLog("MARK_NOTIFICATION_READ"), notificationController.markNotificationRead)

router.post("/notifications/register-device", auditLog("REGISTER_DEVICE"), notificationController.registerDevice)

// Forms & Questionnaires
router.get(
  "/forms/patient-forms",
  requireRole("patient"),
  auditLog("GET_PATIENT_FORMS"),
  formController.getPatientForms,
)

router.get("/forms/:id", auditLog("GET_FORM_DETAILS"), formController.getFormDetails)

router.post("/form-submissions", requireRole("patient"), auditLog("SUBMIT_FORM"), formController.submitForm)

router.get(
  "/form-submissions",
  requireRole("patient"),
  auditLog("GET_FORM_SUBMISSIONS"),
  formController.getFormSubmissions,
)

// File Upload - Fixed route
router.post("/files/upload", upload.single("file"), auditLog("UPLOAD_FILE"), fileController.uploadFile)

router.get("/files", auditLog("GET_USER_FILES"), fileController.getUserFiles)

router.delete("/files/:id", auditLog("DELETE_FILE"), fileController.deleteFile)

export default router
