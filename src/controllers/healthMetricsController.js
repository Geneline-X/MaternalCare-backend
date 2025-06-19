import { fhirStore } from "../models/FhirStore.js"
import User from "../models/User.js"

/**
 * Get health metrics with filtering and pagination
 */
export const getHealthMetrics = async (req, res, next) => {
  try {
    const { status, patientId, _page = 1, _count = 20 } = req.query
    const doctorId = req.user.id

    // Get doctor's patients
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const doctorPatientIds = [...new Set(appointments.map((apt) => apt.patientId))]

    // Get all observations
    let observations = await fhirStore.search("Observation", {})

    // Filter by doctor's patients
    observations = observations.filter((obs) => {
      const obsPatientId = obs.subject?.reference?.split("/")[1]
      return doctorPatientIds.includes(obsPatientId)
    })

    // Filter by specific patient if requested
    if (patientId) {
      observations = observations.filter((obs) => obs.subject?.reference?.split("/")[1] === patientId)
    }

    // Process observations to determine status and trends
    const processedMetrics = await Promise.all(
      observations.map(async (obs) => {
        const patientId = obs.subject?.reference?.split("/")[1]
        const patient = await User.findById(patientId).select("firstName lastName")

        // Determine metric type and normal ranges
        const code = obs.code?.coding?.[0]?.code
        let metric = "Unknown"
        let normalRange = ""
        let metricStatus = "normal"

        switch (code) {
          case "55284-4": // Blood Pressure
            metric = "Blood Pressure"
            normalRange = "90-140/60-90 mmHg"
            const systolic = obs.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8480-6"))
              ?.valueQuantity?.value
            const diastolic = obs.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8462-4"))
              ?.valueQuantity?.value

            if ((systolic && systolic > 140) || (diastolic && diastolic > 90)) {
              metricStatus = "high"
            } else if ((systolic && systolic < 90) || (diastolic && diastolic < 60)) {
              metricStatus = "low"
            }
            break

          case "8867-4": // Fetal Heart Rate
            metric = "Fetal Heart Rate"
            normalRange = "110-160 bpm"
            const heartRate = obs.valueQuantity?.value
            if (heartRate > 160) metricStatus = "high"
            else if (heartRate < 110) metricStatus = "low"
            break

          case "29463-7": // Weight
            metric = "Weight Gain"
            normalRange = "11-16 kg total"
            metricStatus = "normal" // Would need baseline to determine
            break

          case "33747-0": // Glucose
            metric = "Glucose Level"
            normalRange = "70-140 mg/dL"
            const glucose = obs.valueQuantity?.value
            if (glucose > 140) metricStatus = "high"
            else if (glucose < 70) metricStatus = "low"
            break
        }

        // Filter by status if requested
        if (status && metricStatus !== status) {
          return null
        }

        return {
          id: obs.id,
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient",
          patientId,
          metric,
          value: obs.valueQuantity
            ? `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ""}`
            : obs.valueString || "N/A",
          unit: obs.valueQuantity?.unit || "",
          status: metricStatus,
          timestamp: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
          normalRange,
          trend: "stable", // Would need historical data to calculate
        }
      }),
    )

    // Filter out null values and apply pagination
    const validMetrics = processedMetrics.filter(Boolean)
    const startIndex = (_page - 1) * _count
    const paginatedMetrics = validMetrics.slice(startIndex, startIndex + _count)

    res.json({
      data: paginatedMetrics,
      pagination: {
        page: Number.parseInt(_page),
        limit: Number.parseInt(_count),
        total: validMetrics.length,
        totalPages: Math.ceil(validMetrics.length / _count),
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get health metrics summary for dashboard cards
 */
export const getHealthMetricsSummary = async (req, res, next) => {
  try {
    const doctorId = req.user.id

    // Get doctor's patients
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const doctorPatientIds = [...new Set(appointments.map((apt) => apt.patientId))]

    // Get all observations for doctor's patients
    const observations = await fhirStore.search("Observation", {})
    const doctorObservations = observations.filter((obs) => {
      const obsPatientId = obs.subject?.reference?.split("/")[1]
      return doctorPatientIds.includes(obsPatientId)
    })

    let normalCount = 0
    let lowCount = 0
    let highCount = 0
    let criticalCount = 0

    // Analyze each observation
    doctorObservations.forEach((obs) => {
      const code = obs.code?.coding?.[0]?.code
      let status = "normal"

      switch (code) {
        case "55284-4": // Blood Pressure
          const systolic = obs.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8480-6"))
            ?.valueQuantity?.value
          const diastolic = obs.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8462-4"))
            ?.valueQuantity?.value

          if ((systolic && systolic > 180) || (diastolic && diastolic > 110)) {
            status = "critical"
          } else if ((systolic && systolic > 140) || (diastolic && diastolic > 90)) {
            status = "high"
          } else if ((systolic && systolic < 90) || (diastolic && diastolic < 60)) {
            status = "low"
          }
          break

        case "8867-4": // Fetal Heart Rate
          const heartRate = obs.valueQuantity?.value
          if (heartRate > 180 || heartRate < 100) status = "critical"
          else if (heartRate > 160 || heartRate < 110) status = "high"
          break

        case "33747-0": // Glucose
          const glucose = obs.valueQuantity?.value
          if (glucose > 200) status = "critical"
          else if (glucose > 140) status = "high"
          else if (glucose < 70) status = "low"
          break
      }

      switch (status) {
        case "normal":
          normalCount++
          break
        case "low":
          lowCount++
          break
        case "high":
          highCount++
          break
        case "critical":
          criticalCount++
          break
      }
    })

    res.json({
      success: true,
      data: {
        normalCount,
        lowCount,
        highCount,
        criticalCount,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get weekly alert trends for chart display
 */
export const getHealthMetricsTrends = async (req, res, next) => {
  try {
    const { weeks = 7 } = req.query
    const doctorId = req.user.id

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)

    // Get doctor's patients
    const appointments = await fhirStore.search("Appointment", { doctorId })
    const doctorPatientIds = [...new Set(appointments.map((apt) => apt.patientId))]

    // Get observations within date range
    const observations = await fhirStore.search("Observation", {})
    const filteredObservations = observations.filter((obs) => {
      const obsDate = new Date(obs.effectiveDateTime || obs.issued)
      const obsPatientId = obs.subject?.reference?.split("/")[1]
      return obsDate >= startDate && obsDate <= endDate && doctorPatientIds.includes(obsPatientId)
    })

    // Group by week and count alerts
    const weeklyData = []
    const labels = []

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000)
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

      const weekObservations = filteredObservations.filter((obs) => {
        const obsDate = new Date(obs.effectiveDateTime || obs.issued)
        return obsDate >= weekStart && obsDate < weekEnd
      })

      // Count high/critical alerts for this week
      let alertCount = 0
      weekObservations.forEach((obs) => {
        const code = obs.code?.coding?.[0]?.code
        let isAlert = false

        switch (code) {
          case "55284-4": // Blood Pressure
            const systolic = obs.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8480-6"))
              ?.valueQuantity?.value
            const diastolic = obs.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8462-4"))
              ?.valueQuantity?.value

            if ((systolic && systolic > 140) || (diastolic && diastolic > 90)) {
              isAlert = true
            }
            break

          case "8867-4": // Fetal Heart Rate
            const heartRate = obs.valueQuantity?.value
            if (heartRate > 160 || heartRate < 110) isAlert = true
            break

          case "33747-0": // Glucose
            const glucose = obs.valueQuantity?.value
            if (glucose > 140 || glucose < 70) isAlert = true
            break
        }

        if (isAlert) alertCount++
      })

      weeklyData.push(alertCount)
      labels.push(`Week ${i + 1}`)
    }

    res.json({
      success: true,
      data: {
        labels,
        datasets: [
          {
            data: weeklyData,
            color: (opacity = 1) => `rgba(255, 99, 132, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}
