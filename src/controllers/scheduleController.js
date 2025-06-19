import { fhirStore } from "../models/FhirStore.js"

/**
 * Get available time slots for appointment scheduling
 */
export const getAvailableTimeSlots = async (req, res, next) => {
  try {
    const { date, duration = 30 } = req.query
    const doctorId = req.user.id

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date parameter is required",
      })
    }

    // Get existing appointments for the specified date
    const existingAppointments = await fhirStore.search("Appointment", {
      doctorId,
      date,
    })

    // Define working hours (9 AM to 5 PM)
    const workingHours = {
      start: 9,
      end: 17,
    }

    // Generate time slots
    const timeSlots = []
    const slotDuration = Number.parseInt(duration)

    for (let hour = workingHours.start; hour < workingHours.end; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`

        // Check if this time slot is already booked
        const isBooked = existingAppointments.some((apt) => {
          const aptTime = apt.time || new Date(apt.start).toTimeString().slice(0, 5)
          return aptTime === timeString
        })

        const bookedAppointment = existingAppointments.find((apt) => {
          const aptTime = apt.time || new Date(apt.start).toTimeString().slice(0, 5)
          return aptTime === timeString
        })

        timeSlots.push({
          time: timeString,
          available: !isBooked,
          duration: slotDuration,
          appointmentId: bookedAppointment?.id || undefined,
        })
      }
    }

    res.json({
      success: true,
      data: {
        date,
        timeSlots,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}
