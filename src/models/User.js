import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    firstName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: false,
    },
    picture: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["doctor", "nurse", "patient"],
      default: "patient",
    },
    facilityId: {
      type: String,
      default: null,
    },
    unsafeMeta: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },
    profession: {
      type: String,
      default: ''
    },
    experienceYears: {
      type: Number,
      default: 0
    },
  },
  {
    timestamps: true,
  },
)

const User = mongoose.model("User", userSchema)

export default User
