import winston from "winston"
import path from "path"
import fs from "fs"

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

// Define colors for each level
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
}

// Tell winston that you want to link the colors
winston.addColors(colors)

// Define which logs to print if you're in development or production
const level = () => {
  const env = process.env.NODE_ENV || "development"
  const isDevelopment = env === "development"
  return isDevelopment ? "debug" : "warn"
}

// Define different log formats
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
)

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console(),

  // File transport for errors
  new winston.transports.File({
    filename: path.join("logs", "error.log"),
    level: "error",
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join("logs", "all.log"),
  }),
]

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
})

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), "logs")
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Helper functions for different log levels
export const logError = (message, error = null) => {
  if (error) {
    logger.error(`${message}: ${error.message}`, { stack: error.stack })
  } else {
    logger.error(message)
  }
}

export const logWarn = (message) => {
  logger.warn(message)
}

export const logInfo = (message) => {
  logger.info(message)
}

export const logHttp = (message) => {
  logger.http(message)
}

export const logDebug = (message) => {
  logger.debug(message)
}

// FHIR-specific logging helpers
export const logFhirOperation = (operation, resourceType, resourceId = null, userId = null) => {
  const message = `FHIR ${operation}: ${resourceType}${resourceId ? ` (ID: ${resourceId})` : ""}${userId ? ` by user ${userId}` : ""}`
  logger.info(message)
}

export const logAuthEvent = (event, userId, details = null) => {
  const message = `AUTH ${event}: User ${userId}${details ? ` - ${details}` : ""}`
  logger.info(message)
}

export const logApiRequest = (method, url, userId = null, statusCode = null) => {
  const message = `API ${method} ${url}${userId ? ` by user ${userId}` : ""}${statusCode ? ` - ${statusCode}` : ""}`
  logger.http(message)
}

export const logValidationError = (resourceType, errors) => {
  const message = `VALIDATION ERROR for ${resourceType}: ${JSON.stringify(errors)}`
  logger.warn(message)
}

export const logOrchestrationEvent = (event, resourceType, resourceId, details = null) => {
  const message = `ORCHESTRATION ${event}: ${resourceType} ${resourceId}${details ? ` - ${details}` : ""}`
  logger.info(message)
}

export { logger }
export default logger
