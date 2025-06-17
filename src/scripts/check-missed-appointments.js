import dotenv from "dotenv"
import { checkMissedAppointments } from "../services/notificationService.js"

dotenv.config()

const run = async () => {
  try {
    console.log("Checking for missed appointments...")
    await checkMissedAppointments()
    console.log("Finished checking for missed appointments")
    process.exit(0)
  } catch (error) {
    console.error("Error checking missed appointments:", error)
    process.exit(1)
  }
}

run()
