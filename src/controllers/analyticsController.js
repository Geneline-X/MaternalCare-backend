import { fhirStore } from "../models/FhirStore.js"
import User from "../models/User.js"

/**
 * Get analytics metrics for reports dashboard
 */
export const getAnalyticsMetrics = async (req, res, next) => {
  try {
    const { timeframe = "1month" } = req.query
    const doctorId = req.user.id

    // Calculate date range based on timeframe
    const now = new Date()
    let startDate

    switch (timeframe) {
      case "1month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "3months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case "6months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      case "1year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // Get doctor's patients
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const patientIds = [...new Set(appointments.map((apt) => apt.patientId))]

    // Total patients
    const totalPatients = patientIds.length

    // New patients in timeframe
    const newPatients = await User.countDocuments({
      role: "patient",
      createdAt: { $gte: startDate },
    })

    // Completed pregnancies in timeframe
    const allPregnancies = await fhirStore.search("EpisodeOfCare", { status: "finished" })
    const completedPregnancies = allPregnancies.filter((pregnancy) => {
      const endDate = new Date(pregnancy.period?.end)
      const patientId = pregnancy.patient?.reference?.split("/")[1]
      return endDate >= startDate && patientIds.includes(patientId)
    }).length

    // Average visits per patient
    const totalAppointments = appointments.filter((apt) => apt.status === "fulfilled").length
    const averageVisits = totalPatients > 0 ? Math.round(totalAppointments / totalPatients) : 0

    // Mock satisfaction score (would come from patient feedback)
    const satisfactionScore = 4.2

    res.json({
      success: true,
      data: {
        totalPatients,
        newPatients,
        completedPregnancies,
        averageVisits,
        satisfactionScore,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get chart data for analytics visualization
 */
export const getAnalyticsCharts = async (req, res, next) => {
  try {
    const { chartType, timeframe = "3months" } = req.query
    const doctorId = req.user.id

    // Calculate date range
    const now = new Date()
    let startDate, months

    switch (timeframe) {
      case "1month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        months = 1
        break
      case "3months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        months = 3
        break
      case "6months":
        startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        months = 6
        break
      case "1year":
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1)
        months = 12
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        months = 3
    }

    const data = {}

    if (chartType === "trends" || !chartType) {
      // Patient trends over time
      const labels = []
      const patientCounts = []

      for (let i = 0; i < months; i++) {
        const monthStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1)
        const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0)

        const monthlyPatients = await User.countDocuments({
          role: "patient",
          createdAt: { $gte: monthStart, $lte: monthEnd },
        })

        labels.push(monthStart.toLocaleDateString("en-US", { month: "short", year: "numeric" }))
        patientCounts.push(monthlyPatients)
      }

      data.patientTrends = {
        labels,
        datasets: [
          {
            data: patientCounts,
            color: (opacity = 1) => `rgba(54, 162, 235, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      }
    }

    if (chartType === "risk" || !chartType) {
      // Risk distribution
      const appointments = await fhirStore.search("Appointment", { doctorId })
      const patientIds = [...new Set(appointments.map((apt) => apt.patientId))]

      const allFlags = await fhirStore.search("Flag", { status: "active" })
      const highRiskCount = allFlags.filter((flag) =>
        patientIds.includes(flag.subject?.reference?.split("/")[1]),
      ).length

      const lowRiskCount = patientIds.length - highRiskCount

      data.riskDistribution = [
        {
          name: "Low Risk",
          population: lowRiskCount,
          color: "#4CAF50",
          legendFontColor: "#7F7F7F",
          legendFontSize: 15,
        },
        {
          name: "High Risk",
          population: highRiskCount,
          color: "#FF6384",
          legendFontColor: "#7F7F7F",
          legendFontSize: 15,
        },
      ]
    }

    if (chartType === "age" || !chartType) {
      // Gestational age distribution
      const pregnancies = await fhirStore.search("EpisodeOfCare", { status: "active" })
      const appointments = await fhirStore.search("Appointment", { doctorId })
      const patientIds = [...new Set(appointments.map((apt) => apt.patientId))]

      const doctorPregnancies = pregnancies.filter((pregnancy) =>
        patientIds.includes(pregnancy.patient?.reference?.split("/")[1]),
      )

      // Group by trimester
      const firstTrimester = doctorPregnancies.filter((p) => {
        const gestationalAge =
          p.extension?.find((ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/gestational-age")
            ?.valueQuantity?.value || 0
        return gestationalAge <= 12
      }).length

      const secondTrimester = doctorPregnancies.filter((p) => {
        const gestationalAge =
          p.extension?.find((ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/gestational-age")
            ?.valueQuantity?.value || 0
        return gestationalAge > 12 && gestationalAge <= 28
      }).length

      const thirdTrimester = doctorPregnancies.filter((p) => {
        const gestationalAge =
          p.extension?.find((ext) => ext.url === "http://prestack.com/fhir/StructureDefinition/gestational-age")
            ?.valueQuantity?.value || 0
        return gestationalAge > 28
      }).length

      data.gestationalAge = {
        labels: ["1st Trimester", "2nd Trimester", "3rd Trimester"],
        datasets: [
          {
            data: [firstTrimester, secondTrimester, thirdTrimester],
            color: (opacity = 1) => `rgba(255, 159, 64, ${opacity})`,
          },
        ],
      }
    }

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get population health insights and recommendations
 */
export const getAnalyticsInsights = async (req, res, next) => {
  try {
    const { timeframe = "3months" } = req.query
    const doctorId = req.user.id

    // Get doctor's patients and their data
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const patientIds = [...new Set(appointments.map((apt) => apt.patientId))]

    const insights = []

    // Positive trend: Increasing appointment completion rate
    const completedAppointments = appointments.filter((apt) => apt.status === "fulfilled").length
    const completionRate =
      appointments.length > 0 ? ((completedAppointments / appointments.length) * 100).toFixed(1) : 0

    if (completionRate > 80) {
      insights.push({
        id: "completion_rate",
        type: "positive",
        title: "High Appointment Completion Rate",
        description: `${completionRate}% of appointments are being completed successfully.`,
        actionItems: ["Continue current scheduling practices", "Consider expanding appointment availability"],
      })
    }

    // Concern: High-risk patients
    const allFlags = await fhirStore.search("Flag", { status: "active" })
    const highRiskCount = allFlags.filter((flag) => patientIds.includes(flag.subject?.reference?.split("/")[1])).length

    if (highRiskCount > 0) {
      insights.push({
        id: "high_risk_patients",
        type: "concern",
        title: "High-Risk Patients Require Attention",
        description: `${highRiskCount} patients are flagged as high-risk and need closer monitoring.`,
        actionItems: [
          "Schedule more frequent check-ups",
          "Review care plans for high-risk patients",
          "Consider specialist referrals",
        ],
      })
    }

    // Recommendation: Form completion tracking
    const questionnaires = await fhirStore.search("Questionnaire", { status: "active" })
    const responses = await fhirStore.search("QuestionnaireResponse", {})

    if (questionnaires.length > 0 && responses.length < questionnaires.length * patientIds.length * 0.5) {
      insights.push({
        id: "form_completion",
        type: "recommendation",
        title: "Improve Patient Form Completion",
        description: "Patient form completion rates could be improved with better engagement strategies.",
        actionItems: [
          "Send reminder notifications for pending forms",
          "Simplify form questions and instructions",
          "Provide incentives for form completion",
        ],
      })
    }

    res.json({
      success: true,
      data: insights,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Generate and export analytics report
 */
export const exportAnalyticsReport = async (req, res, next) => {
  try {
    const { format, includeCharts, includePatientData, includeHealthMetrics, dateRange } = req.body

    // For now, return a mock download URL
    // In a real implementation, you would generate the actual report file
    const fileName = `analytics_report_${new Date().toISOString().split("T")[0]}.${format}`
    const downloadUrl = `/api/downloads/${fileName}`

    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName,
        fileSize: 1024000, // Mock file size
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      },
      message: "Report generated successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}
