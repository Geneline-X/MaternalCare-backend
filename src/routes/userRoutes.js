import express from 'express'
import { authenticate } from '../middlewares/auth.js'
import { 
  getAllDoctors, 
  getDoctorById, 
  updateDoctorProfile 
} from '../controllers/userController.js'

const router = express.Router()

/**
 * @route   GET /api/users/doctors
 * @desc    Get all doctors
 * @access  Private - Requires authentication
 */
router.get('/doctors', authenticate, (req, res, next) => {
  // Check if user has permission to view doctors
  if (!req.auth || !req.auth.userId) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - Authentication required'
    })
  }
  next()
}, getAllDoctors)

/**
 * @route   GET /api/users/doctors/:id
 * @desc    Get a single doctor by ID
 * @access  Private - Requires authentication
 */
// Get doctor by ID
router.get('/doctors/:id', authenticate, async (req, res, next) => {
  try {
    // Check if user has permission to view doctor details
    if (!req.auth || !req.auth.userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - Authentication required'
      })
    }
    
    // If the user is a patient, they can only view their own doctor's details
    if (req.auth.role === 'patient') {
      // Here you would typically check if this doctor is the patient's assigned doctor
      // For now, we'll just allow access to any doctor
    }
    
    next()
  } catch (error) {
    console.error('Error in doctor access middleware:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while verifying access',
      error: error.message
    })
  }
}, getDoctorById)

// Update doctor profile
router.put('/doctors/:id', authenticate, async (req, res, next) => {
  try {
    // Only allow doctors to update their own profile or admins to update any
    if (req.auth.role !== 'admin' && req.auth.userId !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }
    next();
  } catch (error) {
    console.error('Error in doctor update middleware:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying update permissions',
      error: error.message
    });
  }
}, updateDoctorProfile);

export default router
