import fhirStore from "../models/fhirStore.js"

// Check for high-risk conditions in resources
export const checkHighRiskConditions = async (resources) => {
  try {
    const flags = []

    for (const resource of resources) {
      // Skip non-observation resources
      if (resource.resourceType !== "Observation") continue

      const patientReference = resource.subject?.reference
      if (!patientReference) continue

      // Check blood pressure (systolic > 140 or diastolic > 90)
      if (resource.code?.coding?.some((coding) => coding.code === "55284-4")) {
        const systolic = resource.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8480-6"))
          ?.valueQuantity?.value
        const diastolic = resource.component?.find((c) => c.code?.coding?.some((coding) => coding.code === "8462-4"))
          ?.valueQuantity?.value

        if ((systolic && systolic > 140) || (diastolic && diastolic > 90)) {
          // Check for existing hypertension flag
          const existingFlags = await fhirStore.search("Flag", {
            subject: patientReference,
            "code.coding.code": "38341003",
          })

          if (existingFlags.length === 0) {
            const flag = {
              resourceType: "Flag",
              status: "active",
              code: {
                coding: [
                  {
                    system: "http://snomed.info/sct",
                    code: "38341003",
                    display: "Hypertension",
                  },
                ],
                text: "High Blood Pressure",
              },
              subject: { reference: patientReference },
            }

            const createdFlag = await fhirStore.create("Flag", flag)
            flags.push(createdFlag)
          }
        }
      }

      // Check fetal heart rate (< 110 or > 160 bpm)
      if (resource.code?.coding?.some((coding) => coding.code === "8867-4")) {
        const heartRate = resource.valueQuantity?.value

        if (heartRate && (heartRate < 110 || heartRate > 160)) {
          // Check for existing abnormal fetal heart rate flag
          const existingFlags = await fhirStore.search("Flag", {
            subject: patientReference,
            "code.coding.code": "364612004",
          })

          if (existingFlags.length === 0) {
            const flag = {
              resourceType: "Flag",
              status: "active",
              code: {
                coding: [
                  {
                    system: "http://snomed.info/sct",
                    code: "364612004",
                    display: "Abnormal fetal heart rate",
                  },
                ],
                text: "Abnormal Fetal Heart Rate",
              },
              subject: { reference: patientReference },
            }

            const createdFlag = await fhirStore.create("Flag", flag)
            flags.push(createdFlag)
          }
        }
      }

      // Check maternal age (< 18 or > 35)
      if (resource.code?.coding?.some((coding) => coding.code === "82810-3")) {
        // Get patient
        const patientId = patientReference.split("/")[1]
        const patient = await fhirStore.read("Patient", patientId)

        if (patient.birthDate) {
          const birthDate = new Date(patient.birthDate)
          const age = (new Date() - birthDate) / (1000 * 60 * 60 * 24 * 365.25)

          if (age < 18 || age > 35) {
            // Check for existing high-risk age flag
            const existingFlags = await fhirStore.search("Flag", {
              subject: patientReference,
              "code.coding.code": age < 18 ? "134441001" : "127364007",
            })

            if (existingFlags.length === 0) {
              const flag = {
                resourceType: "Flag",
                status: "active",
                code: {
                  coding: [
                    {
                      system: "http://snomed.info/sct",
                      code: age < 18 ? "134441001" : "127364007",
                      display: age < 18 ? "Teenage pregnancy" : "Elderly primigravida",
                    },
                  ],
                  text: age < 18 ? "Teenage Pregnancy" : "Advanced Maternal Age",
                },
                subject: { reference: patientReference },
              }

              const createdFlag = await fhirStore.create("Flag", flag)
              flags.push(createdFlag)
            }
          }
        }
      }
    }

    return flags
  } catch (error) {
    console.error("Error checking high-risk conditions:", error)
    throw error
  }
}
