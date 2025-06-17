import nodemailer from "nodemailer"
import fhirStore from "../models/fhirStore.js"

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
      const recipientType = recipient.reference.split("/")[0]
      const recipientId = recipient.reference.split("/")[1]

      let recipientResource
      try {
        recipientResource = await fhirStore.read(recipientType, recipientId)
      } catch (error) {
        console.error(`Recipient not found: ${recipient.reference}`)
        continue
      }

      // Get email from resource
      let email
      if (recipientType === "Patient" || recipientType === "Practitioner") {
        email = recipientResource.telecom?.find((t) => t.system === "email")?.value
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
          html: `<p>${payload}</p>`,
        })

        console.log(`Email sent to ${email}`)
      } catch (error) {
        console.error(`Error sending email to ${email}:`, error)
      }
    }

    return createdCommunication
  } catch (error) {
    console.error("Error sending notification:", error)
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
            await sendNotification({
              subject: { reference: patientReference },
              payload: `Missed appointment: ${activity.detail.description}`,
              recipients: [{ reference: "Practitioner/prac123" }, { reference: patientReference }],
            })
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking missed appointments:", error)
    throw error
  }
}
