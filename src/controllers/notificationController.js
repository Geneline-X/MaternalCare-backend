import { fhirStore } from "../models/FhirStore.js"

// Get notifications for user
export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id
    const userRole = req.user.role
    const { status = "unread", type, limit = 20 } = req.query

    // Search for Communications marked as notifications
    const searchParams = {
      recipient: `${userRole === "patient" ? "Patient" : "Practitioner"}/${userId}`,
      category: "notification",
    }

    if (status === "unread") {
      searchParams.status = "in-progress"
    } else if (status === "read") {
      searchParams.status = "completed"
    }

    const communications = await fhirStore.search("Communication", searchParams)

    // Format notifications for mobile
    const notifications = communications.slice(0, limit).map((comm) => {
      const notificationType = comm.reasonCode?.[0]?.coding?.[0]?.code || "system"

      return {
        id: comm.id,
        type: notificationType,
        title: getNotificationTitle(notificationType),
        message: comm.payload?.[0]?.contentString || "",
        timestamp: comm.sent || comm.received,
        read: comm.status === "completed",
        actionRequired: comm.priority === "urgent",
        data: {
          appointmentId: comm.about?.[0]?.reference?.split("/")[1] || null,
        },
      }
    })

    const unreadCount = notifications.filter((n) => !n.read).length

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

// Mark notification as read
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    const userRole = req.user.role

    // Get the communication
    const communication = await fhirStore.read("Communication", id)

    // Verify user has permission to mark this notification as read
    const recipientRef = communication.recipient?.[0]?.reference
    const expectedRef = `${userRole === "patient" ? "Patient" : "Practitioner"}/${userId}`

    if (recipientRef !== expectedRef) {
      return res.status(403).json({
        success: false,
        message: "You can only mark your own notifications as read",
      })
    }

    // Update status to completed (read)
    const updatedCommunication = {
      ...communication,
      status: "completed",
    }

    await fhirStore.update("Communication", id, updatedCommunication)

    res.json({
      success: true,
      message: "Notification marked as read",
    })
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({ success: false, message: "Notification not found" })
    }
    next(error)
  }
}

// Register device for push notifications
export const registerDevice = async (req, res, next) => {
  try {
    const { deviceToken, platform, deviceId } = req.body
    const userId = req.user.id
    const userRole = req.user.role

    // Create or update device registration
    // In a real implementation, you'd store this in a separate collection
    // For now, we'll create a Device resource
    const device = {
      resourceType: "Device",
      identifier: [
        {
          system: "http://prestack.com/device-id",
          value: deviceId,
        },
      ],
      status: "active",
      deviceName: [
        {
          name: `${platform} Device`,
          type: "user-friendly-name",
        },
      ],
      owner: {
        reference: `${userRole === "patient" ? "Patient" : "Practitioner"}/${userId}`,
      },
      note: [
        {
          text: `Push token: ${deviceToken}, Platform: ${platform}`,
        },
      ],
    }

    // Check if device already exists
    const existingDevices = await fhirStore.search("Device", {
      identifier: deviceId,
      owner: `${userRole === "patient" ? "Patient" : "Practitioner"}/${userId}`,
    })

    let result
    if (existingDevices.length > 0) {
      // Update existing device
      result = await fhirStore.update("Device", existingDevices[0].id, device)
    } else {
      // Create new device
      result = await fhirStore.create("Device", device)
    }

    res.json({
      success: true,
      data: {
        deviceId: result.id,
        message: "Device registered successfully",
      },
    })
  } catch (error) {
    next(error)
  }
}

// Helper function to get notification titles
function getNotificationTitle(type) {
  const titles = {
    appointment: "Appointment Reminder",
    health: "Health Update",
    medication: "Medication Reminder",
    baby_development: "Baby Development",
    system: "System Notification",
  }
  return titles[type] || "Notification"
}

export default {
  getNotifications,
  markNotificationRead,
  registerDevice,
}
