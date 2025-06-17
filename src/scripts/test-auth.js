import fetch from "node-fetch"
import dotenv from "dotenv"
import chalk from "chalk"

// Load environment variables
dotenv.config()

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3000/api"
const TEST_TOKENS = {
  doctor: process.env.TEST_DOCTOR_TOKEN,
  nurse: process.env.TEST_NURSE_TOKEN,
  patient: process.env.TEST_PATIENT_TOKEN,
}

// Check if any tokens are available
const hasTokens = Object.values(TEST_TOKENS).some((token) => token)

if (!hasTokens) {
  console.warn(chalk.yellow("Warning: No test tokens found in environment variables."))
  console.log(chalk.yellow("Tests will run but authentication will likely fail."))
  console.log(chalk.yellow("Consider setting the following environment variables:"))
  console.log("  TEST_DOCTOR_TOKEN - A valid Clerk token for a doctor user")
  console.log("  TEST_NURSE_TOKEN - A valid Clerk token for a nurse user")
  console.log("  TEST_PATIENT_TOKEN - A valid Clerk token for a patient user")
  console.log("\nYou can get these tokens from your frontend application after logging in with each user type.")
  console.log("Or run the generate-test-token.js script to create mock tokens for testing.")

  // Set empty tokens to avoid undefined errors
  TEST_TOKENS.doctor = TEST_TOKENS.doctor || ""
  TEST_TOKENS.nurse = TEST_TOKENS.nurse || ""
  TEST_TOKENS.patient = TEST_TOKENS.patient || ""
}

/**
 * Make an authenticated request to the API
 * @param {string} endpoint - API endpoint path
 * @param {string} token - Authentication token
 * @param {Object} options - Additional fetch options
 * @returns {Promise<Object>} Response data
 */
async function makeRequest(endpoint, token = null, options = {}) {
  const url = `${API_URL}${endpoint}`
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      redirect: "manual", // Don't follow redirects automatically
    })

    // Check if we got redirected (status 301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location")
      return {
        status: response.status,
        data: {
          redirected: true,
          location,
          message: `Redirected to ${location}`,
        },
      }
    }

    const data = await response.json().catch(() => ({}))
    return { status: response.status, data }
  } catch (error) {
    console.error(`Error making request to ${url}:`, error.message)
    return { status: 500, data: { error: error.message } }
  }
}

/**
 * Test authentication status endpoint
 */
async function testAuthStatus() {
  console.log(chalk.blue("\n=== Testing Authentication Status Endpoint ==="))

  const response = await makeRequest("/auth/status")
  console.log(`Status: ${response.status}`)
  console.log("Response:", response.data)

  if (response.status === 200) {
    console.log(chalk.green("✓ Auth status endpoint is working"))
  } else {
    console.log(chalk.red("✗ Auth status endpoint failed"))
  }
}

/**
 * Test authentication with different user roles
 */
async function testUserAuthentication() {
  console.log(chalk.blue("\n=== Testing User Authentication ==="))

  for (const [role, token] of Object.entries(TEST_TOKENS)) {
    if (!token) {
      console.log(chalk.yellow(`\nSkipping ${role.toUpperCase()} authentication (no token provided)`))
      continue
    }

    console.log(chalk.yellow(`\nTesting ${role.toUpperCase()} authentication:`))

    const response = await makeRequest("/auth/me", token)
    console.log(`Status: ${response.status}`)

    if (response.status === 200) {
      console.log(chalk.green(`✓ ${role} authentication successful`))
      console.log("User data:", response.data)
    } else {
      console.log(chalk.red(`✗ ${role} authentication failed`))
      console.log("Error:", response.data)
    }
  }
}

/**
 * Test role-based access control
 */
async function testRoleBasedAccess() {
  console.log(chalk.blue("\n=== Testing Role-Based Access Control ==="))

  // Test endpoints with different permissions
  const testCases = [
    {
      name: "Get all patients",
      endpoint: "/fhir/Patient",
      method: "GET",
      expectedAccess: {
        doctor: true,
        nurse: true,
        patient: false,
      },
    },
    {
      name: "Create questionnaire",
      endpoint: "/fhir/Questionnaire",
      method: "POST",
      body: {
        status: "active",
        title: "Test Questionnaire",
        item: [],
      },
      expectedAccess: {
        doctor: true,
        nurse: false,
        patient: false,
      },
    },
    {
      name: "Get analytics",
      endpoint: "/analytics/pregnancy",
      method: "GET",
      expectedAccess: {
        doctor: true,
        nurse: true,
        patient: true, // Patient can access their own data
      },
    },
  ]

  for (const testCase of testCases) {
    console.log(chalk.yellow(`\nTesting: ${testCase.name}`))

    for (const [role, token] of Object.entries(TEST_TOKENS)) {
      if (!token) {
        console.log(chalk.yellow(`Skipping ${role} (no token provided)`))
        continue
      }

      const options = {
        method: testCase.method,
        ...(testCase.body && { body: JSON.stringify(testCase.body) }),
      }

      const response = await makeRequest(testCase.endpoint, token, options)
      const expectedResult = testCase.expectedAccess[role]
      const success = expectedResult ? response.status >= 200 && response.status < 300 : response.status === 403

      if (success) {
        console.log(chalk.green(`✓ ${role} access test passed (${response.status})`))
      } else {
        console.log(
          chalk.red(
            `✗ ${role} access test failed - expected ${expectedResult ? "success" : "403"}, got ${response.status}`,
          ),
        )
        console.log("Response:", response.data)
      }
    }
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log(chalk.bold("Starting Authentication Tests"))
  console.log("API URL:", API_URL)

  try {
    // Test server health
    console.log(chalk.yellow("Testing API server connection..."))
    const healthCheck = await makeRequest("/health")

    // Check if we got redirected to sign-in, which means the server is running
    if (healthCheck.status === 500 && healthCheck.data.error?.includes("redirect")) {
      console.log(chalk.yellow("⚠️ API server is redirecting to sign-in page"))
      console.log(chalk.green("✓ API server appears to be running, continuing with tests"))
    } else if (healthCheck.status !== 200) {
      // Try the root endpoint as a fallback
      const rootCheck = await makeRequest("/")
      if (rootCheck.status === 200 || (rootCheck.status === 500 && rootCheck.data.error?.includes("redirect"))) {
        console.log(chalk.yellow("⚠️ Health endpoint not available, but server appears to be running"))
        console.log(chalk.green("✓ Continuing with authentication tests"))
      } else {
        console.error(chalk.red("Error: API server is not responding. Please make sure it's running."))
        console.log(chalk.yellow("If the server is running, check that it's accessible at:", API_URL))
        console.log(chalk.yellow("You may need to update the API_URL in your .env file or script."))
        process.exit(1)
      }
    } else {
      console.log(chalk.green("✓ API server is running"))
    }

    // Run tests
    await testAuthStatus()
    await testUserAuthentication()
    await testRoleBasedAccess()

    console.log(chalk.bold.green("\n=== All tests completed ==="))
  } catch (error) {
    console.error(chalk.red("\nTest execution failed:"), error)
  }
}

// Run the tests
runTests()
