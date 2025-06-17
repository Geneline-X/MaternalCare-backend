import dotenv from "dotenv"
import { createHmac } from "crypto"
import readline from "readline"

// Load environment variables
dotenv.config()

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

/**
 * Generate a mock JWT token for testing
 * NOTE: This is NOT a real Clerk token and should ONLY be used for testing
 * when you don't have access to real tokens from the frontend
 *
 * @param {string} userId - User ID to include in the token
 * @param {string} role - User role (doctor, nurse, patient)
 * @returns {string} Mock JWT token
 */
function generateMockToken(userId, role) {
  // Create a header
  const header = {
    alg: "HS256",
    typ: "JWT",
  }

  // Create a payload with minimal Clerk-like structure
  const payload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours from now
    iat: Math.floor(Date.now() / 1000),
    iss: "clerk.test.mock",
    nbf: Math.floor(Date.now() / 1000),
    auth: {
      userId: userId,
    },
    metadata: {
      role: role,
    },
  }

  // Base64 encode the header and payload
  const base64Header = Buffer.from(JSON.stringify(header)).toString("base64").replace(/=/g, "")
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64").replace(/=/g, "")

  // Create a signature using a secret key
  const secretKey = process.env.CLERK_SECRET_KEY || "test-secret-key"
  const signature = createHmac("sha256", secretKey)
    .update(`${base64Header}.${base64Payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  // Return the complete token
  return `${base64Header}.${base64Payload}.${signature}`
}

/**
 * Main function to generate test tokens
 */
async function generateTestTokens() {
  console.log("=== Test Token Generator ===")
  console.log("This script generates mock tokens for testing purposes only.")
  console.log("WARNING: These tokens are NOT real Clerk tokens and should only be used for testing.\n")

  // Get user input
  const doctorId = (await askQuestion('Enter doctor user ID (or leave empty for "doctor_123"): ')) || "doctor_123"
  const nurseId = (await askQuestion('Enter nurse user ID (or leave empty for "nurse_123"): ')) || "nurse_123"
  const patientId = (await askQuestion('Enter patient user ID (or leave empty for "patient_123"): ')) || "patient_123"

  // Generate tokens
  const doctorToken = generateMockToken(doctorId, "doctor")
  const nurseToken = generateMockToken(nurseId, "nurse")
  const patientToken = generateMockToken(patientId, "patient")

  // Display tokens and instructions
  console.log("\n=== Generated Test Tokens ===")
  console.log("\nDoctor Token:")
  console.log(doctorToken)

  console.log("\nNurse Token:")
  console.log(nurseToken)

  console.log("\nPatient Token:")
  console.log(patientToken)

  console.log("\n=== Add to .env file ===")
  console.log("Add these lines to your .env file:")
  console.log(`TEST_DOCTOR_TOKEN=${doctorToken}`)
  console.log(`TEST_NURSE_TOKEN=${nurseToken}`)
  console.log(`TEST_PATIENT_TOKEN=${patientToken}`)

  console.log("\nIMPORTANT: These are mock tokens for testing only.")
  console.log("For production, use real Clerk tokens from your frontend application.")

  rl.close()
}

/**
 * Helper function to ask a question and get user input
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User input
 */
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// Run the script
generateTestTokens()
