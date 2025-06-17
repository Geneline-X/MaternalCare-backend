import { fhirStore } from "../models/FhirStore.js"
import { sendNotification } from "../services/notificationService.js"

export const getAppointments = async (req, res, next) => {
  try {
    const { patientId, doctorId, status, date } = req.query

    const searchParams = {}
    if (patientId) searchParams.patient = `Patient/${patientId}`
    if (doctorId) searchParams.practitioner = `Practitioner/${doctorId}`
    if (status) searchParams.status = status
    if (date) searchParams.date = date

    const appointments = await fhirStore.search("Appointment", searchParams)
    res.json(appointments)
  } catch (error) {
    next(error)
  }
}

export const getAppointment = async (req, res, next) => {
  try {
    const appointment = await fhirStore.read("Appointment", req.params.id)
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }
    res.json(appointment)
  } catch (error) {
    next(error)
  }
}

export const createAppointment = async (req, res, next) => {
  try {
    const appointment = req.body

    // Basic validation
    if (!appointment.participant || appointment.participant.length === 0) {
      return res.status(400).json({ message: "Appointment participants are required" })
    }

    // Set default values
    appointment.status = appointment.status || "booked"
    appointment.minutesDuration = appointment.minutesDuration || 30

    // Create the appointment
    const createdAppointment = await fhirStore.create("Appointment", appointment)

    // 🔔 SEND APPOINTMENT CREATED NOTIFICATION
    try {
      const patientRef = appointment.participant.find((p) => p.actor?.reference?.startsWith("Patient/"))?.actor
        ?.reference
      const practitionerRef = appointment.participant.find((p) => p.actor?.reference?.startsWith("Practitioner/"))
        ?.actor?.reference

      if (patientRef) {
        const appointmentDate = new Date(appointment.start).toLocaleDateString()
        const appointmentTime = new Date(appointment.start).toLocaleTimeString()

        await sendNotification({
          subject: { reference: patientRef },
          payload: `New appointment scheduled for ${appointmentDate} at ${appointmentTime}. Please arrive 15 minutes early.`,
          recipients: [{ reference: patientRef }, ...(practitionerRef ? [{ reference: practitionerRef }] : [])],
        })
      }
    } catch (notificationError) {
      console.log("Appointment creation notification failed:", notificationError.message)
    }

    res.status(201).json(createdAppointment)
  } catch (error) {
    next(error)
  }
}

export const updateAppointment = async (req, res, next) => {
  try {
    const existingAppointment = await fhirStore.read("Appointment", req.params.id)
    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    const updatedAppointment = await fhirStore.update("Appointment", req.params.id, req.body)

    // 🔔 SEND STATUS CHANGE NOTIFICATION
    if (req.body.status && req.body.status !== existingAppointment.status) {
      try {
        const patientRef = existingAppointment.participant.find((p) => p.actor?.reference?.startsWith("Patient/"))
          ?.actor?.reference
        const practitionerRef = existingAppointment.participant.find((p) =>
          p.actor?.reference?.startsWith("Practitioner/"),
        )?.actor?.reference

        if (patientRef) {
          let message = `Your appointment status has been updated to: ${req.body.status}`

          if (req.body.status === "confirmed") {
            message = "Your appointment has been confirmed. We look forward to seeing you!"
          } else if (req.body.status === "cancelled") {
            message = "Your appointment has been cancelled. Please contact us to reschedule."
          } else if (req.body.status === "fulfilled") {
            message = "Your appointment has been completed. Thank you for visiting us!"
          }

          await sendNotification({
            subject: { reference: patientRef },
            payload: message,
            recipients: [{ reference: patientRef }, ...(practitionerRef ? [{ reference: practitionerRef }] : [])],
          })
        }
      } catch (notificationError) {
        console.log("Appointment update notification failed:", notificationError.message)
      }
    }

    res.json(updatedAppointment)
  } catch (error) {
    next(error)
  }
}

export const deleteAppointment = async (req, res, next) => {
  try {
    const appointment = await fhirStore.read("Appointment", req.params.id)
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    await fhirStore.delete("Appointment", req.params.id)

    // 🔔 SEND CANCELLATION NOTIFICATION
    try {
      const patientRef = appointment.participant.find((p) => p.actor?.reference?.startsWith("Patient/"))?.actor
        ?.reference
      const practitionerRef = appointment.participant.find((p) => p.actor?.reference?.startsWith("Practitioner/"))
        ?.actor?.reference

      if (patientRef) {
        const appointmentDate = new Date(appointment.start).toLocaleDateString()

        await sendNotification({
          subject: { reference: patientRef },
          payload: `Your appointment scheduled for ${appointmentDate} has been cancelled. Please contact us to reschedule if needed.`,
          recipients: [{ reference: patientRef }, ...(practitionerRef ? [{ reference: practitionerRef }] : [])],
        })
      }
    } catch (notificationError) {
      console.log("Appointment cancellation notification failed:", notificationError.message)
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
}

export const completeAppointment = async (req, res, next) => {
  try {
    const appointment = await fhirStore.read("Appointment", req.params.id)
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    // Update appointment status
    const updatedAppointment = await fhirStore.update("Appointment", req.params.id, {
      ...appointment,
      status: "fulfilled",
    })

    // 🔔 SEND COMPLETION NOTIFICATION
    try {
      const patientRef = appointment.participant.find((p) => p.actor?.reference?.startsWith("Patient/"))?.actor
        ?.reference
      const practitionerRef = appointment.participant.find((p) => p.actor?.reference?.startsWith("Practitioner/"))
        ?.actor?.reference

      if (patientRef) {
        await sendNotification({
          subject: { reference: patientRef },
          payload: `Your appointment has been completed successfully. Thank you for visiting us! If you have any follow-up questions, please don't hesitate to contact us.`,
          recipients: [{ reference: patientRef }, ...(practitionerRef ? [{ reference: practitionerRef }] : [])],
        })
      }
    } catch (notificationError) {
      console.log("Appointment completion notification failed:", notificationError.message)
    }

    res.json({
      appointment: updatedAppointment,
    })
  } catch (error) {
    next(error)
  }
}
