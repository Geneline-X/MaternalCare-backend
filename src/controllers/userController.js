import User from "../models/User.js"

/**
 * @route   GET /api/users/doctors
 * @desc    Get all doctors
 * @access  Private
 */
export const getAllDoctors = async (req, res) => {
  try {
    const doctors = await User.find({ role: 'doctor' })
      .select('-__v -createdAt -updatedAt')
      .lean()
    
    res.json({
      success: true,
      count: doctors.length,
      data: doctors
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
