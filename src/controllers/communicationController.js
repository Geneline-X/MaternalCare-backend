import { fhirStore } from "../models/FhirStore.js"
import {
  getUserNotifications,
  markNotificationAsRead,
  getNotificationCounts as getNotificationCountsService,
} from "../services/notificationService.js"

// Get all communications/notifications for the authenticated user
export const getCommunications = async (req, res, next) => {
  try {
    const { unreadOnly, type, limit } = req.query

    const options = {
      unreadOnly: unreadOnly === "true",
      type: type || null,
      limit: limit ? Number.parseInt(limit) : 50,
    }

    const notifications = await getUserNotifications(req.user.id, options)
    res.json(notifications)
  } catch (error) {
    next(error)
  }
}

// Get a specific communication
export const getCommunication = async (req, res, next) => {
  try {
    const communication = await fhirStore.read("Communication", req.params.id)

    // Check if user is a recipient of this communication
    const isRecipient = communication.recipient.some((r) => r.reference === `User/${req.user.id}`)
    if (!isRecipient) {
      return res.status(403).json({ message: "You can only access communications sent to you" })
    }

    res.json(communication)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Create a new communication (for direct messaging between users)
export const createCommunication = async (req, res, next) => {
  try {
    const { recipientId, message, type = "message" } = req.body

    // Validate required fields
    if (!recipientId) {
      return res.status(400).json({ message: "Recipient ID is required" })
    }
    if (!message) {
      return res.status(400).json({ message: "Message is required" })
    }

    const communication = {
      resourceType: "Communication",
      status: "completed",
      subject: { reference: `User/${req.user.id}` },
      recipient: [{ reference: `User/${recipientId}` }],
      payload: [{ contentString: message }],
      sent: new Date().toISOString(),
      category: [{ text: type }],
      notificationType: type,
      isRead: false,
    }

    const createdCommunication = await fhirStore.create("Communication", communication)
    res.status(201).json(createdCommunication)
  } catch (error) {
    next(error)
  }
}

// Mark a communication as read
export const markAsRead = async (req, res, next) => {
  try {
    const updatedCommunication = await markNotificationAsRead(req.params.id, req.user.id)
    res.json(updatedCommunication)
  } catch (error) {
    if (error.message.includes("not found") || error.message.includes("not a recipient")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Update a communication (limited functionality)
export const updateCommunication = async (req, res, next) => {
  try {
    const communication = await fhirStore.read("Communication", req.params.id)

    // Only allow marking as read/unread
    const allowedUpdates = { isRead: req.body.isRead }
    const updatedCommunication = await fhirStore.update("Communication", req.params.id, {
      ...communication,
      ...allowedUpdates,
    })

    res.json(updatedCommunication)
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Delete a communication (only sender can delete)
export const deleteCommunication = async (req, res, next) => {
  try {
    const communication = await fhirStore.read("Communication", req.params.id)

    // Only sender can delete
    const [, senderId] = communication.subject?.reference?.split("/") || []
    if (senderId !== req.user.id) {
      return res.status(403).json({ message: "You can only delete communications you sent" })
    }

    await fhirStore.delete("Communication", req.params.id)
    res.json({ message: `Communication ${req.params.id} deleted successfully` })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ message: error.message })
    }
    next(error)
  }
}

// Get notification counts for the authenticated user
export const getNotificationCounts = async (req, res, next) => {
  try {
    const counts = await getNotificationCountsService(req.user.id)
    res.json(counts)
  } catch (error) {
    next(error)
  }
}

// Mark all notifications as read for the authenticated user
export const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id

    // Get all unread communications for this user
    const unreadCommunications = await fhirStore.search("Communication", {})
    const userUnreadCommunications = unreadCommunications.filter((comm) => {
      const isRecipient = comm.recipient?.some((r) => r.reference === `User/${userId}`)
      return isRecipient && !comm.isRead
    })

    let updatedCount = 0

    // Mark each as read
    for (const communication of userUnreadCommunications) {
      try {
        await fhirStore.update("Communication", communication.id, {
          ...communication,
          isRead: true,
        })
        updatedCount++
      } catch (error) {
        console.log(`Failed to mark communication ${communication.id} as read:`, error.message)
      }
    }

    res.json({
      success: true,
      data: {
        updatedCount,
      },
      message: `Marked ${updatedCount} notifications as read`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
}
