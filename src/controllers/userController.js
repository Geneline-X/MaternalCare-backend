import User from "../models/User.js"
import { NotFoundError } from "../utils/errors.js"

// Helper function to format doctor data
const formatDoctorData = (doctor) => ({
  id: doctor._id,
  name: doctor.name,
  firstName: doctor.firstName,
  lastName: doctor.lastName,
  email: doctor.email,
  role: doctor.role,
  profession: doctor.profession || 'General Practitioner',
  experienceYears: doctor.experienceYears || 0,
  picture: doctor.picture,
  facilityId: doctor.facilityId,
  bio: doctor.bio || '',
  specialties: doctor.specialties || [],
  languages: doctor.languages || [],
  education: doctor.education || [],
  certifications: doctor.certifications || []
})

/**
 * @route   GET /api/users/doctors
 * @desc    Get all doctors
 * @access  Private
 */
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('-__v -createdAt -updatedAt -unsafeMeta -clerkData')
      .lean()
    
    const formattedDoctors = doctors.map(formatDoctorData)
    
    res.json({
      success: true,
      count: formattedDoctors.length,
      data: formattedDoctors
    })
  } catch (error) {
    console.error('Error fetching doctors:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while fetching doctors',
      error: error.message
    })
  }
}

/**
 * @route   GET /api/users/doctors/:id
 * @desc    Get a single doctor by ID
 * @access  Private
 */
export const getDoctorById = async (req, res) => {
  try {
    const doctor = await User.findOne({ 
      _id: req.params.id, 
      role: 'doctor' 
    })
    .select('-__v -createdAt -updatedAt -unsafeMeta -clerkData')
    .lean()

    if (!doctor) {
      throw new NotFoundError('Doctor not found')
    }

    res.json({
      success: true,
      data: formatDoctorData(doctor)
    })
  } catch (error) {
    console.error('Error fetching doctor:', error)
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Server error while fetching doctor',
      error: error.message
    })
  }
}
