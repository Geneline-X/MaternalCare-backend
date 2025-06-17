import { logApiRequest } from "../utils/logger.js"

const requestLogger = (req, res, next) => {
  // Log the incoming request
  const userId = req.user?.id || "anonymous"
  logApiRequest(req.method, req.originalUrl, userId)

  // Capture the original res.end function
  const originalEnd = res.end

  // Override res.end to log the response
  res.end = function (chunk, encoding) {
    // Log the response
    logApiRequest(req.method, req.originalUrl, userId, res.statusCode)

    // Call the original res.end
    originalEnd.call(this, chunk, encoding)
  }

  next()
}

export default requestLogger
