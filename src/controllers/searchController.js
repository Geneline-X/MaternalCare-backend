export const searchAll = async (req, res, next) => {
    try {
      const { q, limit = 10, types } = req.query
  
      if (!q || q.trim().length === 0) {
        return res.json({
          success: true,
          data: {
            results: [],
            totalCount: 0,
            searchTime: 0,
          },
          timestamp: new Date().toISOString(),
        })
      }
  
      const searchStartTime = Date.now()
      const searchQuery = q.toLowerCase().trim()
      const searchTypes = types ? types.split(",") : ["patient", "appointment", "health", "form"]
      const results = []
  
      // Search patients
      if (searchTypes.includes("patient")) {
        const patients = await fhirStore.search("Patient", {})
        const matchingPatients = patients
          .filter((patient) => {
            const name = patient.name?.[0]
            const fullName = `${name?.given?.join(" ") || ""} ${name?.family || ""}`.toLowerCase()
            const email = patient.telecom?.find((t) => t.system === "email")?.value?.toLowerCase() || ""
  
            return fullName.includes(searchQuery) || email.includes(searchQuery)
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
          })
        })
      }
  
      // Search appointments
      if (searchTypes.includes("appointment")) {
        const appointments = await fhirStore.search("Appointment", {})
        const matchingAppointments = appointments
          .filter((apt) => {
            const description = (apt.description || "").toLowerCase()
            const comment = (apt.comment || "").toLowerCase()
  
            return description.includes(searchQuery) || comment.includes(searchQuery)
          })
          .slice(0, Math.floor(limit / searchTypes.length))
  
        for (const appointment of matchingAppointments) {
          // Get patient name for subtitle
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
          })
        }
      }
  
      // Search health data (observations)
      if (searchTypes.includes("health")) {
        const observations = await fhirStore.search("Observation", {})
        const matchingObservations = observations
          .filter((obs) => {
            const code = obs.code?.coding?.[0]?.display?.toLowerCase() || ""
            const notes = obs.note?.[0]?.text?.toLowerCase() || ""
  
            return code.includes(searchQuery) || notes.includes(searchQuery)
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
          })
        })
      }
  
      // Search forms (questionnaires)
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
          })
        })
      }
  
      const searchTime = Date.now() - searchStartTime
  
      res.json({
        success: true,
        data: {
          results: results.slice(0, limit),
          totalCount: results.length,
          searchTime,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      next(error)
    }
  }
  