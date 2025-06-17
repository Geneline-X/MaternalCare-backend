import fetch from "node-fetch"
import dotenv from "dotenv"
import chalk from "chalk"
import { createServer } from "http"
import open from "open"
import { parse } from "url"

// Load environment variables
dotenv.config()

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3000/api"
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"
const TEST_SERVER_PORT = 3456

/**
 * Create a simple server to capture the token from the frontend
 * @returns {Promise<string>} The captured token
 */
function createTokenCaptureServer() {
  return new Promise((resolve) => {
    let tokenCaptured = false

    const server = createServer((req, res) => {
      const { pathname, query } = parse(req.url, true)

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*")
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type")

      if (req.method === "OPTIONS") {
        res.writeHead(200)
        res.end()
        return
      }

      if (pathname === "/capture-token") {
        const token = query.token

        if (token) {
          tokenCaptured = true

          // Send success response
          res.writeHead(200, { "Content-Type": "text/html" })
          res.end(`
            <html>
              <body>
                <h1>Token Captured Successfully!</h1>
                <p>You can close this window and return to the terminal.</p>
                <script>
                  window.close();
                </script>
              </body>
            </html>
          `)

          // Close the server and resolve the promise with the token
          setTimeout(() => {
            server.close()
            resolve(token)
          }, 1000)
        } else {
          res.writeHead(400, { "Content-Type": "text/plain" })
          res.end("No token provided")
        }
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not found")
      }
    })

    server.listen(TEST_SERVER_PORT, () => {
      console.log(chalk.green(`Token capture server running on http://localhost:${TEST_SERVER_PORT}`))
    })

    // Timeout after 5 minutes
    setTimeout(
      () => {
        if (!tokenCaptured) {
          console.log(chalk.red("Token capture timed out after 5 minutes"))
          server.close()
          resolve(null)
        }
      },
      5 * 60 * 1000,
    )
  })
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
    })

    const data = await response.json().catch(() => ({}))
    return { status: response.status, data }
  } catch (error) {
    console.error(`Error making request to ${url}:`, error.message)
    return { status: 500, data: { error: error.message } }
  }
}

/**
 * Test the authentication flow
 * @param {string} token - Authentication token
 */
async function testAuthFlow(token) {
  console.log(chalk.blue("\n=== Testing Authentication Flow ==="))

  if (!token) {
    console.log(chalk.red("No token provided. Authentication tests cannot proceed."))
    return
  }

  // Test authentication status
  console.log(chalk.yellow("\nTesting authentication status:"))
  const statusResponse = await makeRequest("/auth/status", token)
  console.log(`Status: ${statusResponse.status}`)
  console.log("Response:", statusResponse.data)

  // Test user profile
  console.log(chalk.yellow("\nTesting user profile:"))
  const profileResponse = await makeRequest("/auth/me", token)

  if (profileResponse.status === 200) {
    console.log(chalk.green("✓ Authentication successful"))
    console.log("User data:", profileResponse.data)

    // Extract user role
    const userRole = profileResponse.data.role
    console.log(chalk.blue(`\nDetected user role: ${userRole}`))

    // Test role-specific endpoints
    await testRoleSpecificEndpoints(token, userRole)
  } else {
    console.log(chalk.red("✗ Authentication failed"))
    console.log("Error:", profileResponse.data)
  }
}

/**
 * Test role-specific endpoints
 * @param {string} token - Authentication token
 * @param {string} role - User role
 */
async function testRoleSpecificEndpoints(token, role) {
  console.log(chalk.blue("\n=== Testing Role-Specific Endpoints ==="))

  // Define test cases based on role
  const testCases = []

  // Common test cases for all roles
  testCases.push({
    name: "Get own profile",
    endpoint: "/auth/me",
    method: "GET",
    expectedStatus: 200,
  })

  // Role-specific test cases
  if (role === "doctor" || role === "nurse") {
    testCases.push({
      name: "Get all patients",
      endpoint: "/fhir/Patient",
      method: "GET",
      expectedStatus: 200,
    })
  }

  if (role === "doctor") {
    testCases.push({
      name: "Create questionnaire",
      endpoint: "/fhir/Questionnaire",
      method: "POST",
      body: {
        status: "active",
        title: "Test Questionnaire",
        item: [],
      },
      expectedStatus: 201,
    })
  }

  // Run the tests
  for (const testCase of testCases) {
    console.log(chalk.yellow(`\nTesting: ${testCase.name}`))

    const options = {
      method: testCase.method,
      ...(testCase.body && { body: JSON.stringify(testCase.body) }),
    }

    const response = await makeRequest(testCase.endpoint, token, options)

    if (response.status === testCase.expectedStatus) {
      console.log(chalk.green(`✓ Test passed (${response.status})`))
    } else {
      console.log(chalk.red(`✗ Test failed - expected ${testCase.expectedStatus}, got ${response.status}`))
      console.log("Response:", response.data)
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold("=== Clerk Authentication Test Tool ==="))
  console.log("This tool will help you test the authentication flow with your backend API.")
  console.log("API URL:", API_URL)

  // Check if API is running
  try {
    const healthCheck = await makeRequest("/health")
    if (healthCheck.status !== 200) {
      console.error(chalk.red("Error: API server is not responding. Please make sure it's running."))
      process.exit(1)
    }

    console.log(chalk.green("✓ API server is running"))
  } catch (error) {
    console.error(chalk.red("Error: Could not connect to API server."), error.message)
    process.exit(1)
  }

  // Check if token is provided in environment variables
  const envToken = process.env.TEST_TOKEN

  if (envToken) {
    console.log(chalk.green("Found token in environment variables. Using it for testing."))
    await testAuthFlow(envToken)
  } else {
    console.log(chalk.yellow("No token found in environment variables."))
    console.log("Please log in through the frontend to capture a token.")

    // Create a token capture server
    console.log(chalk.blue("\nStarting token capture server..."))

    // Generate the token capture URL
    const captureUrl = `http://localhost:${TEST_SERVER_PORT}/capture-token`

    // Generate the frontend URL with redirect
    const loginUrl = `${FRONTEND_URL}/login?redirect=${encodeURIComponent(captureUrl)}`

    console.log(chalk.blue(`\nOpening browser to: ${loginUrl}`))
    console.log("Please log in through the frontend to continue.")

    // Open the browser to the login page
    await open(loginUrl)

    // Wait for token capture
    const token = await createTokenCaptureServer()

    if (token) {
      console.log(chalk.green("\nToken captured successfully!"))
      console.log("You can add this token to your .env file for future tests:")
      console.log(`TEST_TOKEN=${token}`)

      await testAuthFlow(token)
    } else {
      console.log(chalk.red("\nFailed to capture token."))
      console.log("You can manually add a token to your .env file and run this script again.")
    }
  }
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red("An error occurred:"), error)
  process.exit(1)
})
