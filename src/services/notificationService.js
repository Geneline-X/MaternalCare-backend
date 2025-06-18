import nodemailer from "nodemailer"
import { fhirStore } from "../models/FhirStore.js"
import User from "../models/User.js"

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Send notification (store in database only, no email)
export const sendNotification = async ({ subject, payload, recipients, type = "general" }) => {
  try {
    // Create Communication resource that both patient and doctor can access
    const communication = {
      resourceType: "Communication",
      status: "completed",
      subject: subject,
      recipient: recipients,
      payload: [{ contentString: payload }],
      sent: new Date().toISOString(),
      category: [{ text: type }],
      // Add metadata for easier querying
      notificationType: type,
      isRead: false, // Track if notification has been read
    }

    const createdCommunication = await fhirStore.create("Communication", communication)
    console.log(`✅ Notification stored in database for ${recipients.length} recipients`)

    return createdCommunication
  } catch (error) {
    console.error("❌ Error storing notification:", error)
    throw error
  }
}

// Send appointment-specific notifications
export const sendAppointmentNotification = async ({
  patientId,
  doctorId,
  message,
  type = "appointment",
  appointmentId = null,
}) => {
  try {
    const recipients = []

    // Add patient as recipient
    if (patientId) {
      recipients.push({ reference: `User/${patientId}` })
    }

    // Add doctor as recipient
    if (doctorId) {
      recipients.push({ reference: `User/${doctorId}` })
    }

    const notification = await sendNotification({
      subject: { reference: `User/${patientId}` }, // Subject is the patient
      payload: message,
      recipients: recipients,
      type: type,
    })

    // Add appointment reference if provided
    if (appointmentId) {
      notification.appointmentReference = `Appointment/${appointmentId}`
      await fhirStore.update("Communication", notification.id, notification)
    }

    return notification
  } catch (error) {
    console.error("❌ Error sending appointment notification:", error)
    throw error
  }
}

// Get notifications for a specific user
export const getUserNotifications = async (userId, options = {}) => {
  try {
    const { unreadOnly = false, type = null, limit = 50 } = options

    // Search for communications where user is a recipient
    const searchParams = {
      recipient: `User/${userId}`,
    }

    if (type) {
      searchParams.category = type
    }

    if (limit) {
      searchParams._count = limit
    }

    let notifications = await fhirStore.search("Communication", searchParams)

    // Filter by read status if requested
    if (unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead)
    }

    // Sort by date (newest first)
    notifications.sort((a, b) => new Date(b.sent) - new Date(a.sent))

    // Add sender information
    const notificationsWithSenderInfo = await Promise.all(
      notifications.map(async (notification) => {
        if (notification.subject?.reference) {
          const [, senderId] = notification.subject.reference.split("/")
          try {
            const sender = await User.findById(senderId).select("firstName lastName role")
            if (sender) {
              notification.senderInfo = {
                id: sender._id,
                name: `${sender.firstName} ${sender.lastName}`,
                role: sender.role,
              }
            }
          } catch (error) {
            console.log(`Could not fetch sender info: ${error.message}`)
          }
        }
        return notification
      }),
    )

    return notificationsWithSenderInfo
  } catch (error) {
    console.error("❌ Error getting user notifications:", error)
    throw error
  }
}

// Mark notification as read
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await fhirStore.read("Communication", notificationId)

    // Check if user is a recipient of this notification
    const isRecipient = notification.recipient.some((r) => r.reference === `User/${userId}`)
    if (!isRecipient) {
      throw new Error("User is not a recipient of this notification")
    }

    // Mark as read
    notification.isRead = true
    notification.readAt = new Date().toISOString()
    notification.readBy = `User/${userId}`

    const updatedNotification = await fhirStore.update("Communication", notificationId, notification)
    console.log(`✅ Notification ${notificationId} marked as read by user ${userId}`)

    return updatedNotification
  } catch (error) {
    console.error("❌ Error marking notification as read:", error)
    throw error
  }
}

// Get notification counts for a user
export const getNotificationCounts = async (userId) => {
  try {
    const allNotifications = await getUserNotifications(userId)
    const unreadNotifications = await getUserNotifications(userId, { unreadOnly: true })

    const counts = {
      total: allNotifications.length,
      unread: unreadNotifications.length,
      byType: {},
    }

    // Count by type
    allNotifications.forEach((notification) => {
      const type = notification.notificationType || "general"
      counts.byType[type] = (counts.byType[type] || 0) + 1
    })

    return counts
  } catch (error) {
    console.error("❌ Error getting notification counts:", error)
    throw error
  }
}

// Check for missed appointments (keep this for scheduled tasks)
export const checkMissedAppointments = async () => {
  try {
    // Get all pending appointments that are past their scheduled time
    const now = new Date()
    const appointments = await fhirStore.search("Appointment", { status: "pending" })

    for (const appointment of appointments) {
      if (appointment.start) {
        const appointmentTime = new Date(appointment.start)

        // If appointment time has passed by more than 30 minutes
        if (now.getTime() - appointmentTime.getTime() > 30 * 60 * 1000) {
          await sendAppointmentNotification({
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            message: `Missed appointment: Your appointment scheduled for ${appointmentTime.toLocaleDateString()} at ${appointmentTime.toLocaleTimeString()} was not attended.`,
            type: "missed_appointment",
            appointmentId: appointment.id,
          })

          // Update appointment status to no-show
          await fhirStore.update("Appointment", appointment.id, {
            ...appointment,
            status: "noshow",
          })
        }
      }
    }
  } catch (error) {
    console.error("❌ Error checking missed appointments:", error)
    throw error
  }
}
