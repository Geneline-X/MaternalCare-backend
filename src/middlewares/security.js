import rateLimit from "express-rate-limit"

/**
 * Security middleware configuration
 */

// Rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: "Too many authentication attempts",
    code: "RATE_LIMIT_EXCEEDED",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiting for webhook endpoints
export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per minute
  message: {
    error: "Too many webhook requests",
    code: "WEBHOOK_RATE_LIMIT_EXCEEDED",
  },
  skip: (req) => {
    // Skip rate limiting for requests with valid webhook signatures
    return req.headers["svix-signature"] && process.env.NODE_ENV === "production"
  },
})

// CORS configuration
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      "http://localhost:3000",
      "http://localhost:3001",
      "https://localhost:3000",
      "https://localhost:3001",
    ].filter(Boolean)

    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("Not allowed by CORS"))
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "svix-id",
    "svix-timestamp",
    "svix-signature",
  ],
}

// Helmet configuration for security headers
export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.clerk.dev", "https://clerk.dev"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}

// Request sanitization
export const sanitizeRequest = (req, res, next) => {
  // Remove potentially dangerous characters from query parameters
  for (const key in req.query) {
    if (typeof req.query[key] === "string") {
      req.query[key] = req.query[key].replace(/[<>]/g, "")
    }
  }

  // Limit request body size
  if (req.body && JSON.stringify(req.body).length > 1024 * 1024) {
    // 1MB limit
    return res.status(413).json({
      error: "Request body too large",
      code: "PAYLOAD_TOO_LARGE",
    })
  }

  next()
}

// IP whitelist for webhook endpoints (optional)
export const webhookIPWhitelist = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV !== "production") {
    return next()
  }

  const allowedIPs = process.env.WEBHOOK_ALLOWED_IPS?.split(",") || []

  if (allowedIPs.length === 0) {
    return next() // No IP restriction if not configured
  }

  const clientIP = req.ip || req.connection.remoteAddress

  if (!allowedIPs.includes(clientIP)) {
    console.warn(`Webhook request from unauthorized IP: ${clientIP}`)
    return res.status(403).json({
      error: "Unauthorized IP address",
      code: "IP_NOT_ALLOWED",
    })
  }

  next()
}

export default {
  authRateLimit,
  webhookRateLimit,
  corsOptions,
  helmetConfig,
  sanitizeRequest,
  webhookIPWhitelist,
}
