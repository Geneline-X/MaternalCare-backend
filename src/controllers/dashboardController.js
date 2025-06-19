import { fhirStore } from "../models/FhirStore.js"
import User from "../models/User.js"

/**
 * Get dashboard metrics for doctors
 */
export const getDashboardMetrics = async (req, res, next) => {
  try {
    const doctorId = req.user.id
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))
    const startOfWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // Get all appointments for this doctor
    const allAppointments = await fhirStore.search("Appointment", { doctorId })

    // Get all patients managed by this doctor (from appointments)
    const patientIds = [...new Set(allAppointments.map((apt) => apt.patientId))]
    const totalPatients = patientIds.length

    // Today's appointments
    const todayAppointments = allAppointments.filter((apt) => {
      const aptDate = new Date(apt.date)
      return aptDate >= startOfDay && aptDate <= endOfDay
    })

    // This week's appointments
    const weekAppointments = allAppointments.filter((apt) => {
      const aptDate = new Date(apt.date)
      return aptDate >= startOfWeek
    })

    // This month's appointments
    const monthAppointments = allAppointments.filter((apt) => {
      const aptDate = new Date(apt.date)
      return aptDate >= startOfMonth
    })

    // Get high-risk flags for doctor's patients
    const allFlags = await fhirStore.search("Flag", { status: "active" })
    const highRiskPatients = allFlags.filter((flag) =>
      patientIds.includes(flag.subject?.reference?.split("/")[1]),
    ).length

    // Get recent observations for analytics
    const recentObservations = await fhirStore.search("Observation", {})
    const doctorPatientObservations = recentObservations.filter((obs) =>
      patientIds.includes(obs.subject?.reference?.split("/")[1]),
    )

    // Pending appointments
    const pendingAppointments = allAppointments.filter((apt) => apt.status === "pending").length

    const metrics = {
      totalPatients,
      todayAppointments: todayAppointments.length,
      weeklyAppointments: weekAppointments.length,
      monthlyAppointments: monthAppointments.length,
      pendingAppointments,
      highRiskPatients,
      completedAppointments: allAppointments.filter((apt) => apt.status === "fulfilled").length,
      cancelledAppointments: allAppointments.filter((apt) => apt.status === "cancelled").length,
      recentObservationsCount: doctorPatientObservations.length,
    }

    res.json({
      metrics,
      period: {
        today: startOfDay.toISOString(),
        weekStart: startOfWeek.toISOString(),
        monthStart: startOfMonth.toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get dashboard analytics in the format expected by React Native Chart Kit
 */
export const getDashboardAnalytics = async (req, res, next) => {
    try {
      const doctorId = req.user.id
      const now = new Date()
  
      // Get appointments for this doctor
      const allAppointments = await fhirStore.search("Appointment", { doctorId })
  
      // Monthly trends (last 6 months)
      const monthlyData = []
      const monthLabels = []
  
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
  
        const monthName = date.toLocaleDateString("en-US", { month: "short" })
        monthLabels.push(monthName)
  
        const monthAppointments = allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date)
          return aptDate >= date && aptDate < nextMonth
        })
  
        monthlyData.push(monthAppointments.length)
      }
  
      // Weekly visits (last 7 days)
      const weeklyData = []
      const weekLabels = []
  
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)
  
        const dayName = date.toLocaleDateString("en-US", { weekday: "short" })
        weekLabels.push(dayName)
  
        const dayAppointments = allAppointments.filter((apt) => {
          const aptDate = new Date(apt.date)
          return aptDate >= date && aptDate < nextDay
        })
  
        weeklyData.push(dayAppointments.length)
      }
  
      const analytics = {
        monthlyTrends: {
          labels: monthLabels,
          datasets: [
            {
              data: monthlyData,
              color: (opacity = 1) => `rgba(47, 128, 237, ${opacity})`,
              strokeWidth: 2,
            },
          ],
        },
        weeklyVisits: {
          labels: weekLabels,
          datasets: [
            {
              data: weeklyData,
              color: (opacity = 1) => `rgba(39, 174, 96, ${opacity})`,
            },
          ],
        },
      }
  
      res.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      next(error)
    }
  }

/**
 * Get today's schedule for doctor
 */
export const getTodaySchedule = async (req, res, next) => {
    try {
      const doctorId = req.user.id
      const today = new Date()
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString().split("T")[0]
  
      console.log("Getting today's schedule for doctor:", doctorId, "date:", startOfDay)
  
      // Get today's appointments
      const appointments = await fhirStore.search("Appointment", {
        doctorId,
        date: startOfDay,
      })
  
      console.log("Found appointments:", appointments.length)
  
      // Sort by time
      const sortedAppointments = appointments.sort((a, b) => {
        const timeA = a.time || "00:00"
        const timeB = b.time || "00:00"
        return timeA.localeCompare(timeB)
      })
  
      // Transform appointments to match frontend expectations
      const transformedAppointments = await Promise.all(
        sortedAppointments.map(async (appointment) => {
          try {
            let patientName = "Unknown Patient"
  
            // Get patient info from User collection
            const patient = await User.findById(appointment.patientId).select("firstName lastName email")
            if (patient) {
              patientName = `${patient.firstName} ${patient.lastName}`
            } else {
              // Try to get FHIR Patient resource for additional info
              try {
                const fhirPatient = await fhirStore.read("Patient", appointment.patientId)
                if (fhirPatient && fhirPatient.name?.[0]) {
                  patientName = `${fhirPatient.name[0].given?.join(" ") || ""} ${fhirPatient.name[0].family || ""}`.trim()
                }
              } catch (fhirError) {
                console.log("Could not fetch FHIR patient:", fhirError.message)
              }
            }
  
            // Transform to frontend format
            return {
              id: appointment.id || appointment._id,
              patientId: appointment.patientId,
              patientName: patientName,
              time: appointment.time || "00:00",
              type: appointment.type || appointment.serviceType || "Consultation", // Default type
              status:
                appointment.status === "fulfilled"
                  ? "confirmed"
                  : appointment.status === "cancelled"
                    ? "cancelled"
                    : "pending",
              duration: appointment.duration || 30, // Default 30 minutes
              notes: appointment.notes || appointment.comment || undefined,
            }
          } catch (error) {
            console.log(`Could not transform appointment ${appointment.id}:`, error.message)
  
            // Return minimal appointment data on error
            return {
              id: appointment.id || appointment._id,
              patientId: appointment.patientId,
              patientName: "Unknown Patient",
              time: appointment.time || "00:00",
              type: "Consultation",
              status: "pending",
              duration: 30,
              notes: undefined,
            }
          }
        }),
      )
  
      // Return in the format expected by frontend
      res.json({
        success: true,
        data: {
          appointments: transformedAppointments,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      next(error)
    }
  }
/**
 * Get enhanced dashboard metrics for doctor overview cards
 */
export const getEnhancedDashboardMetrics = async (req, res, next) => {
  try {
    const doctorId = req.user.id
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // Get all appointments for this doctor
    const allAppointments = await fhirStore.search("Appointment", { doctorId })

    // Get all patients managed by this doctor
    const patientIds = [...new Set(allAppointments.map((apt) => apt.patientId))]

    // Get all active pregnancies (EpisodeOfCare)
    const allPregnancies = await fhirStore.search("EpisodeOfCare", { status: "active" })
    const doctorPregnancies = allPregnancies.filter((pregnancy) =>
      patientIds.includes(pregnancy.patient?.reference?.split("/")[1]),
    )

    // Get high-risk flags
    const allFlags = await fhirStore.search("Flag", { status: "active" })
    const highRiskPatients = allFlags.filter((flag) =>
      patientIds.includes(flag.subject?.reference?.split("/")[1]),
    ).length

    // Get scheduled appointments (pending + confirmed)
    const scheduledAppointments = allAppointments.filter((apt) => ["pending", "confirmed"].includes(apt.status)).length

    // Get new patients this month
    const newPatientsThisMonth = await User.countDocuments({
      role: "patient",
      createdAt: { $gte: startOfMonth },
    })

    // Get completed pregnancies this month
    const completedPregnanciesThisMonth = await fhirStore.search("EpisodeOfCare", {
      status: "finished",
    })
    const completedThisMonth = completedPregnanciesThisMonth.filter((pregnancy) => {
      const endDate = new Date(pregnancy.period?.end)
      return endDate >= startOfMonth
    }).length

    const metrics = {
      totalPregnancies: doctorPregnancies.length,
      totalPatients: patientIds.length,
      highRiskCases: highRiskPatients,
      scheduledAppointments,
      newPatientsThisMonth,
      completedPregnanciesThisMonth: completedThisMonth,
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}
