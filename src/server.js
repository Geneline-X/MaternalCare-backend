import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import path from "path"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import connectDB from "./config/database.js"
import routes from "./routes/index.js"
import { errorHandler } from "./middlewares/errorHandler.js"
import requestLogger from "./middlewares/requestLogger.js"
import { logInfo, logError } from "./utils/logger.js"
import { clerkMiddleware, requireAuth } from "@clerk/express"

// Load environment variables
dotenv.config()

// Initialize express app
const app = express()

// Connect to MongoDB
connectDB()

// Security middleware
app.use(helmet())

// Configure CORS
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
})
app.use(limiter)

// Body parser middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Request logging middleware
app.use(requestLogger)

// Serve static files (for file uploads)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Initialize Clerk middleware
app.use(clerkMiddleware())

// Apply Clerk authentication for all routes except public ones
app.use((req, res, next) => {
  // Public paths that don't require authentication
  const publicPaths = ["/api/auth/webhook", "/health", "/api/health", "/", "/api/sms/inbound", "/uploads"]

  // Check if the current path is public
  if (publicPaths.some((path) => req.path.startsWith(path))) {
    return next()
  }

  // For /api/auth/status, we want to make it accessible but still process auth if present
  if (req.path === "/api/auth/status") {
    return next()
  }

  // Use requireAuth for protected routes
  return requireAuth()(req, res, next)
})

// Mount all routes under /api
app.use("/api", routes)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Default route
app.get("/", (req, res) => {
  res.json({
    message: "PreSTrack API is running",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    docs: "/api-docs",
    endpoints: {
      auth: "/api/auth",
      fhir: "/api/fhir",
      mobile: "/api/mobile",
      sms: "/api/sms",
      analytics: "/api/analytics",
    },
  })
})

// Error handling middleware
app.use(errorHandler)

// Start server
const PORT = process.env.PORT || 3000
const server = app.listen(PORT, () => {
  logInfo(`PreSTrack API server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logError("UNHANDLED REJECTION! 💥 Shutting down...", err)
  server.close(() => {
    process.exit(1)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logError("UNCAUGHT EXCEPTION! 💥 Shutting down...", err)
  server.close(() => {
    process.exit(1)
  })
})

export default app
