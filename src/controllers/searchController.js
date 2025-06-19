import { fhirStore } from "../models/FhirStore.js" // Declare fhirStore
import User from "../models/User.js" // Declare User

export const enhancedSearchAll = async (req, res, next) => {
  try {
    const { q, limit = 10, types, doctorId } = req.query

    if (!q || q.trim().length === 0) {
      return res.json({
        success: true,
        data: {
          results: [],
          totalCount: 0,
          searchTime: 0,
          suggestions: ["high risk", "today", "due soon", "recent"], // Add search suggestions
        },
        timestamp: new Date().toISOString(),
      })
    }

    const searchStartTime = Date.now()
    const searchQuery = q.toLowerCase().trim()
    const searchTypes = types ? types.split(",") : ["patient", "appointment", "health", "form"]
    const results = []

    // Enhanced patient search with better matching
    if (searchTypes.includes("patient")) {
      const patients = await fhirStore.search("Patient", {})
      const matchingPatients = patients
        .filter((patient) => {
          const name = patient.name?.[0]
          const fullName = `${name?.given?.join(" ") || ""} ${name?.family || ""}`.toLowerCase()
          const email = patient.telecom?.find((t) => t.system === "email")?.value?.toLowerCase() || ""
          const phone = patient.telecom?.find((t) => t.system === "phone")?.value?.toLowerCase() || ""

          // Enhanced matching: exact match gets higher priority
          return (
            fullName.includes(searchQuery) ||
            email.includes(searchQuery) ||
            phone.includes(searchQuery) ||
            // Add partial matching for better UX
            searchQuery
              .split(" ")
              .some((term) => fullName.includes(term))
          )
        })
        .slice(0, Math.floor(limit / searchTypes.length))

      matchingPatients.forEach((patient) => {
        const name = patient.name?.[0]
        const fullName = `${name?.given?.join(" ") || ""} ${name?.family || ""}`.trim()
        const email = patient.telecom?.find((t) => t.system === "email")?.value || ""

        results.push({
          id: patient.id,
          type: "patient",
          title: fullName || "Unknown Patient",
          subtitle: email,
          category: "Patient",
          relevance: calculateRelevance(searchQuery, fullName + " " + email), // Add relevance scoring
        })
      })
    }

    // Enhanced appointment search with date filtering
    if (searchTypes.includes("appointment")) {
      const appointments = await fhirStore.search("Appointment", { doctorId }) // Filter by doctor
      const matchingAppointments = appointments
        .filter((apt) => {
          const description = (apt.description || "").toLowerCase()
          const comment = (apt.comment || "").toLowerCase()
          const status = (apt.status || "").toLowerCase()

          return (
            description.includes(searchQuery) ||
            comment.includes(searchQuery) ||
            status.includes(searchQuery) ||
            // Add date-based search
            (searchQuery.includes("today") && isToday(apt.start)) ||
            (searchQuery.includes("tomorrow") && isTomorrow(apt.start))
          )
        })
        .slice(0, Math.floor(limit / searchTypes.length))

      for (const appointment of matchingAppointments) {
        let patientName = "Unknown Patient"
        if (appointment.patientId) {
          try {
            const patient = await User.findById(appointment.patientId).select("firstName lastName")
            if (patient) {
              patientName = `${patient.firstName} ${patient.lastName}`
            }
          } catch (error) {
            console.log("Could not fetch patient name:", error.message)
          }
        }

        results.push({
          id: appointment.id,
          type: "appointment",
          title: appointment.description || "Appointment",
          subtitle: `${patientName} - ${new Date(appointment.start).toLocaleDateString()}`,
          category: "Appointment",
          relevance: calculateRelevance(searchQuery, appointment.description + " " + patientName),
        })
      }
    }

    // Enhanced health data search with risk-based filtering
    if (searchTypes.includes("health")) {
      const observations = await fhirStore.search("Observation", {})
      const matchingObservations = observations
        .filter((obs) => {
          const code = obs.code?.coding?.[0]?.display?.toLowerCase() || ""
          const notes = obs.note?.[0]?.text?.toLowerCase() || ""

          return (
            code.includes(searchQuery) ||
            notes.includes(searchQuery) ||
            // Add risk-based search
            (searchQuery.includes("high risk") && isHighRiskObservation(obs)) ||
            (searchQuery.includes("abnormal") && isAbnormalObservation(obs))
          )
        })
        .slice(0, Math.floor(limit / searchTypes.length))

      matchingObservations.forEach((observation) => {
        const code = observation.code?.coding?.[0]?.display || "Health Metric"
        const value = observation.valueQuantity
          ? `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ""}`
          : observation.valueString || "N/A"

        results.push({
          id: observation.id,
          type: "health",
          title: code,
          subtitle: `Value: ${value}`,
          category: "Health Data",
          relevance: calculateRelevance(searchQuery, code + " " + value),
        })
      })
    }

    // Form search remains the same but with relevance
    if (searchTypes.includes("form")) {
      const questionnaires = await fhirStore.search("Questionnaire", {})
      const matchingForms = questionnaires
        .filter((form) => {
          const title = (form.title || "").toLowerCase()
          const description = (form.description || "").toLowerCase()

          return title.includes(searchQuery) || description.includes(searchQuery)
        })
        .slice(0, Math.floor(limit / searchTypes.length))

      matchingForms.forEach((form) => {
        results.push({
          id: form.id,
          type: "form",
          title: form.title || "Untitled Form",
          subtitle: form.description || "No description",
          category: "Form",
          relevance: calculateRelevance(searchQuery, form.title + " " + form.description),
        })
      })
    }

    // Sort by relevance if available
    const sortedResults = results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, limit)

    const searchTime = Date.now() - searchStartTime

    res.json({
      success: true,
      data: {
        results: sortedResults,
        totalCount: results.length,
        searchTime,
        query: searchQuery,
        appliedFilters: searchTypes,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}

// Helper functions for enhanced search
function calculateRelevance(query, text) {
  if (!text) return 0
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100

  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 80

  // Contains query gets medium score
  if (lowerText.includes(lowerQuery)) return 60

  // Partial word matches get lower score
  const queryWords = lowerQuery.split(" ")
  const textWords = lowerText.split(" ")
  const matchingWords = queryWords.filter((qWord) => textWords.some((tWord) => tWord.includes(qWord)))

  return (matchingWords.length / queryWords.length) * 40
}

function isToday(dateString) {
  const date = new Date(dateString)
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

function isTomorrow(dateString) {
  const date = new Date(dateString)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return date.toDateString() === tomorrow.toDateString()
}

function isHighRiskObservation(observation) {
  // Add your high-risk detection logic here
  const value = observation.valueQuantity?.value
  const code = observation.code?.coding?.[0]?.code

  // Example: Blood pressure, glucose levels, etc.
  if (code === "blood-pressure" && value > 140) return true
  if (code === "glucose" && value > 200) return true

  return false
}

function isAbnormalObservation(observation) {
  // Add your abnormal value detection logic here
  return observation.interpretation?.some((interp) => interp.coding?.[0]?.code === "A") // Abnormal
}
