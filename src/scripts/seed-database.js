import mongoose from "mongoose"
import dotenv from "dotenv"
import User from "../models/User.js"

dotenv.config()

const MONGO_URI = process.env.MONGO_URI

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGO_URI)
    console.log("MongoDB connected successfully")

    // Clear existing users
    await User.deleteMany({})

    // Create doctor user
    await User.create({
      clerkId: "doctor_clerk_id", // This would be replaced with actual Clerk IDs in production
      email: "toby@gmail.com",
      name: "Toby Wales",
      role: "doctor",
      facilityId: "org123",
    })

    // Create nurse user
    await User.create({
      clerkId: "nurse_clerk_id", // This would be replaced with actual Clerk IDs in production
      email: "nurse@example.com",
      name: "Nurse Example",
      role: "nurse",
      facilityId: "org123",
    })

    // Create patient user
    await User.create({
      clerkId: "patient_clerk_id", // This would be replaced with actual Clerk IDs in production
      email: "patient@example.com",
      name: "Aminata Sesay",
      role: "patient",
    })

    console.log("Database seeded successfully")
    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()
