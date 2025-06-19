import { fhirStore } from "../models/FhirStore.js"
import { sendAppointmentNotification } from "../services/notificationService.js"
import User from "../models/User.js"

export const getAppointments = async (req, res, next) => {
  try {
    console.log("🔍 Getting appointments for user:", req.user)
    console.log("🔍 Query params:", req.query)

    const { doctorId, status, date } = req.query
    const searchParams = {}

    // For patients, only show their own appointments
    if (req.user.role === "patient") {
      searchParams.patientId = req.user.id // Changed from patient reference to direct patientId
      console.log("👤 Patient search - patientId:", req.user.id)
    } else {
      // For doctors/nurses/admins, allow filtering by patientId if provided
      const { patientId } = req.query
      if (patientId) {
        searchParams.patientId = patientId
        console.log("🏥 Healthcare provider search - patientId:", patientId)
      }
    }

    if (doctorId) {
      searchParams.doctorId = doctorId
      console.log("👨‍⚕️ Filtering by doctorId:", doctorId)
    }
    if (status) {
      searchParams.status = status
      console.log("📊 Filtering by status:", status)
    }
    if (date) {
      searchParams.date = date
      console.log("📅 Filtering by date:", date)
    }

    console.log("🔍 Final search params:", searchParams)

    const appointments = await fhirStore.search("Appointment", searchParams)
    console.log("📋 Found appointments:", appointments.length)

    // If no appointments found, let's debug what's in the database
    if (appointments.length === 0) {
      console.log("🔍 No appointments found, checking all appointments in database...")
      const allAppointments = await fhirStore.search("Appointment", {})
      console.log("📊 Total appointments in database:", allAppointments.length)

      if (allAppointments.length > 0) {
        console.log("📋 Sample appointment structure:", JSON.stringify(allAppointments[0], null, 2))
      }
    }

    // Populate doctor information from users table
    const appointmentsWithDoctorInfo = await Promise.all(
      appointments.map(async (appointment) => {
        if (appointment.doctorId) {
          try {
            const doctor = await User.findById(appointment.doctorId).select("firstName lastName email role")
            if (doctor) {
              appointment.doctorInfo = {
                id: doctor._id,
                name: `${doctor.firstName} ${doctor.lastName}`,
                email: doctor.email,
                role: doctor.role,
              }
            }
          } catch (error) {
            console.log(`Could not fetch doctor info for ${appointment.doctorId}:`, error.message)
          }
        }
        return appointment
      }),
    )

    res.json(appointmentsWithDoctorInfo)
  } catch (error) {
    console.error("❌ Error in getAppointments:", error)
    next(error)
  }
}

export const getAppointment = async (req, res, next) => {
  try {
    let appointment = await fhirStore.read("Appointment", req.params.id)
    if (!appointment) {
      return res.status(404).json({ 
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code: "not-found",
          details: { text: `Appointment with id ${req.params.id} not found` }
        }]
      })
    }

    // Check if patient can access this appointment
    if (req.user.role === "patient") {
      if (appointment.patientId !== req.user.id) {
        return res.status(403).json({
          resourceType: "OperationOutcome",
          issue: [{
            severity: "error",
            code: "forbidden",
            details: { text: "You can only access your own appointments" }
          }]
        })
      }
    }

    // Ensure the response is a proper FHIR resource
    if (!appointment.resourceType) {
      appointment = {
        resourceType: "Appointment",
        id: appointment.id || appointment._id,
        status: appointment.status || "booked",
        ...appointment
      }
    }

    // Populate doctor information as an extension
    if (appointment.doctorId) {
      try {
        const doctor = await User.findById(appointment.doctorId).select("firstName lastName email role")
        if (doctor) {
          if (!appointment.extension) {
            appointment.extension = [];
          }
          appointment.extension.push({
            url: "http://example.org/fhir/StructureDefinition/doctor-info",
            extension: [
              { url: "id", valueString: doctor._id.toString() },
              { url: "name", valueString: `${doctor.firstName} ${doctor.lastName}` },
              { url: "email", valueString: doctor.email },
              { url: "role", valueString: doctor.role }
            ]
          });
        }
      } catch (error) {
        console.error(`Could not fetch doctor info for ${appointment.doctorId}:`, error.message)
      }
    }

    res.json(appointment)
  } catch (error) {
    console.error("Error in getAppointment:", error);
    next({
      resourceType: "OperationOutcome",
      issue: [{
        severity: "error",
        code: "exception",
        details: { text: error.message }
      }]
    })
  }
}

export const createAppointment = async (req, res, next) => {
  try {
    const appointment = req.body

    // Automatically set patientId from authenticated user
    if (req.user.role === "patient") {
      appointment.patientId = req.user.id
    } else {
      // For non-patients (doctors/nurses/admins), patientId must be provided
      if (!appointment.patientId) {
        return res.status(400).json({ message: "Patient ID is required" })
      }
    }

    // Basic validation
    if (!appointment.doctorId) {
      return res.status(400).json({ message: "Doctor ID is required" })
    }

    // Validate that the doctor exists and has the right role
    const doctor = await User.findById(appointment.doctorId)
    if (!doctor) {
      return res.status(400).json({ message: "Doctor not found" })
    }
    if (!["doctor", "nurse", "admin"].includes(doctor.role)) {
      return res.status(400).json({ message: "Selected user is not a healthcare provider" })
    }

    if (!appointment.date) {
      return res.status(400).json({ message: "Appointment date is required" })
    }
    if (!appointment.time) {
      return res.status(400).json({ message: "Appointment time is required" })
    }

    // Set default values
    appointment.status = appointment.status || "pending"
    appointment.duration = appointment.duration || 30
    appointment.appointmentType = appointment.appointmentType || "routine"
    appointment.reminderEnabled = appointment.reminderEnabled !== false

    console.log("📝 Creating appointment:", JSON.stringify(appointment, null, 2))

    // Create the appointment
    const createdAppointment = await fhirStore.create("Appointment", appointment)

    // 🔔 CREATE NOTIFICATION
    try {
      const appointmentDate = new Date(`${appointment.date}T${appointment.time}:00`).toLocaleDateString()
      const appointmentTime = new Date(`${appointment.date}T${appointment.time}:00`).toLocaleTimeString()

      let notificationMessage = `New appointment scheduled with Dr. ${doctor.firstName} ${doctor.lastName} for ${appointmentDate} at ${appointmentTime}.`

      if (appointment.status === "pending") {
        notificationMessage += " Your appointment is pending confirmation."
      } else {
        notificationMessage += " Please arrive 15 minutes early."
      }

      if (appointment.reminderEnabled) {
        notificationMessage += " You will receive a reminder before your appointment."
      }

      // Send notification to both patient and doctor
      await sendAppointmentNotification({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        message: notificationMessage,
        type: "appointment_created",
        appointmentId: createdAppointment.id,
      })
    } catch (notificationError) {
      console.log("Appointment creation notification failed:", notificationError.message)
    }

    // Add doctor info to response
    createdAppointment.doctorInfo = {
      id: doctor._id,
      name: `${doctor.firstName} ${doctor.lastName}`,
      email: doctor.email,
      role: doctor.role,
    }

    console.log("✅ Created appointment:", createdAppointment.id)
    res.status(201).json(createdAppointment)
  } catch (error) {
    console.error("❌ Error creating appointment:", error)
    next(error)
  }
}

export const updateAppointment = async (req, res, next) => {
  try {
    const existingAppointment = await fhirStore.read("Appointment", req.params.id)
    if (!existingAppointment) {
      return res.status(404).json({ message: "Appointment not found" })
    }

    // Check if patient can update this appointment
    if (req.user.role === "patient") {
      if (existingAppointment.patientId !== req.user.id) {
        return res.status(403).json({
          message: "You can only update your own appointments",
          code: "DATA_OWNERSHIP_VIOLATION",
        })
      }

      // Patients can only update certain fields
      const allowedFields = ["notes", "reason", "preferredContact", "reminderEnabled"]
      const updateData = {}
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field]
        }
      })
      req.body = updateData
    }

    // If doctorId is being updated, validate the new doctor
    if (req.body.doctorId && req.body.doctorId !== existingAppointment.doctorId) {
      const doctor = await User.findById(req.body.doctorId)
      if (!doctor) {
        return res.status(400).json({ message: "Doctor not found" })
      }
      if (!["doctor", "nurse", "admin"].includes(doctor.role)) {
        return res.status(400).json({ message: "Selected user is not a healthcare provider" })
      }
    }

    const updatedAppointment = await fhirStore.update("Appointment", req.params.id, req.body)

    // 🔔 SEND STATUS CHANGE NOTIFICATION
    if (req.body.status && req.body.status !== existingAppointment.status) {
      try {
        let message = `Your appointment status has been updated to: ${req.body.status}`

        if (req.body.status === "confirmed") {
          message = "Your appointment has been confirmed. We look forward to seeing you!"
        } else if (req.body.status === "cancelled") {
          message = "Your appointment has been cancelled. Please contact us to reschedule."
        } else if (req.body.status === "fulfilled") {
          message = "Your appointment has been completed. Thank you for visiting us!"
        }

        await sendAppointmentNotification({
          patientId: updatedAppointment.patientId,
          doctorId: updatedAppointment.doctorId,
          message,
          type: "appointment_updated",
          appointmentId: updatedAppointment.id,
        })
      } catch (notificationError) {
        console.log("Appointment update notification failed:", notificationError.message)
      }
    }

    // Add doctor info to response
    if (updatedAppointment.doctorId) {
      try {
        const doctor = await User.findById(updatedAppointment.doctorId).select("firstName lastName email role")
        if (doctor) {
          updatedAppointment.doctorInfo = {
            id: doctor._id,
            name: `${doctor.firstName} ${doctor.lastName}`,
            email: doctor.email,
            role: doctor.role,
          }
        }
      } catch (error) {
        console.log(`Could not fetch doctor info: ${error.message}`)
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

    // Check if patient can delete this appointment
    if (req.user.role === "patient") {
      if (appointment.patientId !== req.user.id) {
        return res.status(403).json({
          message: "You can only delete your own appointments",
          code: "DATA_OWNERSHIP_VIOLATION",
        })
      }
    }

    await fhirStore.delete("Appointment", req.params.id)

    // 🔔 SEND CANCELLATION NOTIFICATION
    try {
      const appointmentDate = new Date(appointment.start).toLocaleDateString()

      await sendAppointmentNotification({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        message: `Your appointment scheduled for ${appointmentDate} has been cancelled. Please contact us to reschedule if needed.`,
        type: "appointment_cancelled",
        appointmentId: appointment.id,
      })
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

    // Only doctors/nurses/admins can complete appointments
    if (req.user.role === "patient") {
      return res.status(403).json({
        message: "Patients cannot complete appointments",
        code: "INSUFFICIENT_PERMISSIONS",
      })
    }

    // Update appointment status
    const updatedAppointment = await fhirStore.update("Appointment", req.params.id, {
      ...appointment,
      status: "fulfilled",
    })

    // 🔔 SEND COMPLETION NOTIFICATION
    try {
      await sendAppointmentNotification({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        message: `Your appointment has been completed successfully. Thank you for visiting us! If you have any follow-up questions, please don't hesitate to contact us.`,
        type: "appointment_completed",
        appointmentId: appointment.id,
      })
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

// New endpoint to get available doctors
export const getAvailableDoctors = async (req, res, next) => {
  try {
    const doctors = await User.find({
      role: { $in: ["doctor", "nurse"] },
      active: { $ne: false },
    }).select("firstName lastName email role specialization")

    const formattedDoctors = doctors.map((doctor) => ({
      id: doctor._id,
      name: `${doctor.firstName} ${doctor.lastName}`,
      email: doctor.email,
      role: doctor.role,
      specialization: doctor.specialization || "General Practice",
    }))

    res.json(formattedDoctors)
  } catch (error) {
    next(error)
  }
}
