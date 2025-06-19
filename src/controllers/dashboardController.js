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
 * Get patient analytics chart data
 */
export const getPatientAnalytics = async (req, res, next) => {
  try {
    const doctorId = req.user.id
    const { period = "month", type = "visits" } = req.query

    // Calculate date range based on period
    const now = new Date()
    let startDate
    let groupBy

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        groupBy = "day"
        break
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        groupBy = "day"
        break
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1)
        groupBy = "month"
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        groupBy = "day"
    }

    // Get appointments for analytics
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const filteredAppointments = appointments.filter((apt) => {
      const aptDate = new Date(apt.date)
      return aptDate >= startDate
    })

    // Group data by time period
    const chartData = []
    const dataMap = new Map()

    filteredAppointments.forEach((apt) => {
      const date = new Date(apt.date)
      let key

      if (groupBy === "day") {
        key = date.toISOString().split("T")[0] // YYYY-MM-DD
      } else if (groupBy === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` // YYYY-MM
      }

      if (!dataMap.has(key)) {
        dataMap.set(key, {
          date: key,
          visits: 0,
          newPatients: 0,
          completedVisits: 0,
        })
      }

      const entry = dataMap.get(key)
      entry.visits++

      if (apt.status === "fulfilled") {
        entry.completedVisits++
      }
    })

    // Convert map to array and sort by date
    const sortedData = Array.from(dataMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date))

    res.json({
      chartData: sortedData,
      period,
      type,
      summary: {
        totalVisits: filteredAppointments.length,
        completedVisits: filteredAppointments.filter((apt) => apt.status === "fulfilled").length,
        averagePerDay: Math.round(filteredAppointments.length / Math.max(1, sortedData.length)),
      },
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

    // Populate patient information
    const appointmentsWithPatients = await Promise.all(
      sortedAppointments.map(async (appointment) => {
        try {
          // Get patient info from User collection
          const patient = await User.findById(appointment.patientId).select("firstName lastName email")

          if (patient) {
            appointment.patientInfo = {
              id: patient._id,
              name: `${patient.firstName} ${patient.lastName}`,
              email: patient.email,
            }
          }

          // Try to get FHIR Patient resource for additional info
          try {
            const fhirPatient = await fhirStore.read("Patient", appointment.patientId)
            if (fhirPatient && !appointment.patientInfo) {
              appointment.patientInfo = {
                id: fhirPatient.id,
                name: fhirPatient.name?.[0]
                  ? `${fhirPatient.name[0].given?.join(" ") || ""} ${fhirPatient.name[0].family || ""}`.trim()
                  : "Unknown Patient",
                email: fhirPatient.telecom?.find((t) => t.system === "email")?.value || "",
              }
            }
          } catch (fhirError) {
            console.log("Could not fetch FHIR patient:", fhirError.message)
          }

          return appointment
        } catch (error) {
          console.log(`Could not fetch patient info for ${appointment.patientId}:`, error.message)
          return appointment
        }
      }),
    )

    res.json({
      date: startOfDay,
      appointments: appointmentsWithPatients,
      summary: {
        total: appointmentsWithPatients.length,
        pending: appointmentsWithPatients.filter((apt) => apt.status === "pending").length,
        confirmed: appointmentsWithPatients.filter((apt) => apt.status === "confirmed").length,
        completed: appointmentsWithPatients.filter((apt) => apt.status === "fulfilled").length,
      },
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
