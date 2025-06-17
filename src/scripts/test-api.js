import fetch from "node-fetch"
import dotenv from "dotenv"

dotenv.config()

const API_URL = process.env.API_URL || "http://localhost:3000/api"
let clerkToken = ""

// Test authentication
const testAuth = async () => {
  try {
    console.log("Testing authentication...")

    // This is a mock test since we can't fully test Clerk flow in a script
    console.log("Clerk authentication would redirect to Clerk login page")
    console.log("After successful login, Clerk would handle the session")

    // For testing purposes, we'll use a mock token
    clerkToken = "mock-clerk-token"

    console.log("Authentication test completed")
  } catch (error) {
    console.error("Authentication test failed:", error)
  }
}

// Test questionnaire endpoints
const testQuestionnaires = async () => {
  try {
    console.log("\nTesting questionnaire endpoints...")

    // Get all questionnaires
    const questionnairesResponse = await fetch(`${API_URL}/fhir/Questionnaire`, {
      headers: { Authorization: `Bearer ${clerkToken}` },
    })

    const questionnaires = await questionnairesResponse.json()
    console.log(`Found ${questionnaires.length} questionnaires`)

    // Get a specific questionnaire
    if (questionnaires.length > 0) {
      const questionnaireId = questionnaires[0].id
      const questionnaireResponse = await fetch(`${API_URL}/fhir/Questionnaire/${questionnaireId}`, {
        headers: { Authorization: `Bearer ${clerkToken}` },
      })

      const questionnaire = await questionnaireResponse.json()
      console.log(`Retrieved questionnaire: ${questionnaire.title || questionnaire.id}`)
    }

    console.log("Questionnaire endpoints test completed")
  } catch (error) {
    console.error("Questionnaire endpoints test failed:", error)
  }
}

// Test patient endpoints
const testPatients = async () => {
  try {
    console.log("\nTesting patient endpoints...")

    // Get all patients
    const patientsResponse = await fetch(`${API_URL}/fhir/Patient`, {
      headers: { Authorization: `Bearer ${clerkToken}` },
    })

    const patients = await patientsResponse.json()
    console.log(`Found ${patients.length} patients`)

    // Get a specific patient
    if (patients.length > 0) {
      const patientId = patients[0].id
      const patientResponse = await fetch(`${API_URL}/fhir/Patient/${patientId}`, {
        headers: { Authorization: `Bearer ${clerkToken}` },
      })

      const patient = await patientResponse.json()
      console.log(`Retrieved patient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`)
    }

    console.log("Patient endpoints test completed")
  } catch (error) {
    console.error("Patient endpoints test failed:", error)
  }
}

// Test analytics endpoint
const testAnalytics = async () => {
  try {
    console.log("\nTesting analytics endpoint...")

    const analyticsResponse = await fetch(`${API_URL}/analytics/pregnancy`, {
      headers: { Authorization: `Bearer ${clerkToken}` },
    })

    const analytics = await analyticsResponse.json()
    console.log("Retrieved analytics data with labels:", analytics.labels)
    console.log(`Found ${analytics.datasets.length} datasets`)

    console.log("Analytics endpoint test completed")
  } catch (error) {
    console.error("Analytics endpoint test failed:", error)
  }
}

// Run all tests
const runTests = async () => {
  try {
    await testAuth()
    await testQuestionnaires()
    await testPatients()
    await testAnalytics()

    console.log("\nAll tests completed")
  } catch (error) {
    console.error("Tests failed:", error)
  }
}

runTests()
