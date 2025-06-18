import nodemailer from "nodemailer"
import { fhirStore } from "../models/FhirStore.js"
import User from "../models/User.js"

// Create nodemailer transporter
const transporter = nodemailer.createTransporter({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

// Send notification
export const sendNotification = async ({ subject, payload, recipients }) => {
  try {
    // Create Communication resource
    const communication = {
      resourceType: "Communication",
      status: "completed",
      subject: subject,
      recipient: recipients,
      payload: [{ contentString: payload }],
      sent: new Date().toISOString(),
      medium: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode", code: "EMAIL" }] }],
    }

    const createdCommunication = await fhirStore.create("Communication", communication)

    // Send email notifications
    for (const recipient of recipients) {
      const [recipientType, recipientId] = recipient.reference.split("/")

      let recipientResource
      let email

      try {
        if (recipientType === "Patient" || recipientType === "User") {
          // Fetch from MongoDB users collection
          recipientResource = await User.findById(recipientId)
          if (recipientResource) {
            email = recipientResource.email
          }
        } else {
          // For other FHIR resources, try to fetch from FHIR store
          recipientResource = await fhirStore.read(recipientType, recipientId)
          if (recipientResource && recipientResource.telecom) {
            email = recipientResource.telecom.find((t) => t.system === "email")?.value
          }
        }
      } catch (error) {
        console.error(`Recipient not found: ${recipient.reference}`, error.message)
        continue
      }

      if (!recipientResource) {
        console.error(`Recipient not found: ${recipient.reference}`)
        continue
      }

      if (!email) {
        console.error(`No email found for recipient: ${recipient.reference}`)
        continue
      }

      // Send email
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "PreSTrack Notification",
          text: payload,
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">PreSTrack Notification</h2>
            <p style="font-size: 16px; line-height: 1.5;">${payload}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              This is an automated message from PreSTrack. Please do not reply to this email.
            </p>
          </div>`,
        })

        console.log(`✅ Email sent to ${email} (${recipient.reference})`)
      } catch (error) {
        console.error(`❌ Error sending email to ${email}:`, error.message)
      }
    }

    return createdCommunication
  } catch (error) {
    console.error("❌ Error sending notification:", error)
    throw error
  }
}

// Enhanced notification service with user lookup
export const sendUserNotification = async ({ userId, subject, message, type = "general" }) => {
  try {
    const user = await User.findById(userId)
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    if (!user.email) {
      throw new Error(`No email found for user: ${userId}`)
    }

    // Create Communication resource
    const communication = {
      resourceType: "Communication",
      status: "completed",
      subject: { reference: `User/${userId}` },
      recipient: [{ reference: `User/${userId}` }],
      payload: [{ contentString: message }],
      sent: new Date().toISOString(),
      medium: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationMode", code: "EMAIL" }] }],
      category: [{ text: type }],
    }

    const createdCommunication = await fhirStore.create("Communication", communication)

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: subject || "PreSTrack Notification",
      text: message,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">PreSTrack</h2>
        <h3 style="color: #374151;">${subject || "Notification"}</h3>
        <p style="font-size: 16px; line-height: 1.5;">${message}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
        <p style="font-size: 12px; color: #6b7280;">
          Hello ${user.firstName} ${user.lastName},<br>
          This is an automated message from PreSTrack. Please do not reply to this email.
        </p>
      </div>`,
    })

    console.log(`✅ Notification sent to ${user.email} (${user.firstName} ${user.lastName})`)
    return createdCommunication
  } catch (error) {
    console.error("❌ Error sending user notification:", error)
    throw error
  }
}

// Check for missed appointments
export const checkMissedAppointments = async () => {
  try {
    // Get all active care plans
    const carePlans = await fhirStore.search("CarePlan", { status: "active" })

    for (const carePlan of carePlans) {
      const patientReference = carePlan.subject?.reference
      if (!patientReference) continue

      // Check each activity
      for (const activity of carePlan.activity || []) {
        if (activity.detail?.status !== "scheduled") continue

        const scheduledPeriod = activity.detail?.scheduledTiming?.repeat?.boundsPeriod
        if (!scheduledPeriod || !scheduledPeriod.end) continue

        const endDate = new Date(scheduledPeriod.end)
        const now = new Date()

        // If end date has passed
        if (endDate < now) {
          // Check if there's an encounter for this activity
          const encounters = await fhirStore.search("Encounter", {
            subject: patientReference,
            date: `ge${scheduledPeriod.start}&le${scheduledPeriod.end}`,
          })

          // If no encounters found, send a missed appointment notification
          if (encounters.length === 0) {
            const [, patientId] = patientReference.split("/")
            await sendUserNotification({
              userId: patientId,
              subject: "Missed Appointment",
              message: `Missed appointment: ${activity.detail.description}`,
              type: "missed_appointment",
            })
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Error checking missed appointments:", error)
    throw error
  }
}

// Send appointment-specific notifications
export const sendAppointmentNotification = async ({ patientId, doctorId, message, type = "appointment" }) => {
  try {
    const notifications = []

    // Send to patient
    if (patientId) {
      const patientNotification = await sendUserNotification({
        userId: patientId,
        subject: "Appointment Update",
        message,
        type,
      })
      notifications.push(patientNotification)
    }

    // Send to doctor
    if (doctorId) {
      const doctorNotification = await sendUserNotification({
        userId: doctorId,
        subject: "Appointment Update",
        message,
        type,
      })
      notifications.push(doctorNotification)
    }

    return notifications
  } catch (error) {
    console.error("❌ Error sending appointment notifications:", error)
    throw error
  }
}
