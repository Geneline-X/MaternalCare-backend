import User from "../models/User.js"
import { NotFoundError } from "../utils/errors.js"

// Helper function to format doctor data
const formatDoctorData = (doctor) => {
  // Ensure we have safe defaults for all fields
  const safeDoctor = {
    _id: doctor._id,
    name: '',
    firstName: '',
    lastName: '',
    email: '',
    role: 'doctor',
    profession: 'General Practitioner',
    experienceYears: 0,
    picture: '',
    facilityId: null,
    bio: '',
    specialties: [],
    languages: [],
    education: [],
    certifications: [],
    ...doctor.toObject ? doctor.toObject() : doctor // Handle both Mongoose docs and plain objects
  };

  // Ensure name is always derived from firstName and lastName if not set
  if (!safeDoctor.name && (safeDoctor.firstName || safeDoctor.lastName)) {
    safeDoctor.name = [safeDoctor.firstName, safeDoctor.lastName].filter(Boolean).join(' ').trim();
  }

  // Ensure required fields have values
  return {
    id: safeDoctor._id || safeDoctor.id,
    name: safeDoctor.name || 'Unknown Doctor',
    firstName: safeDoctor.firstName || '',
    lastName: safeDoctor.lastName || '',
    email: safeDoctor.email || '',
    role: safeDoctor.role || 'doctor',
    profession: safeDoctor.profession || 'General Practitioner',
    experienceYears: parseInt(safeDoctor.experienceYears) || 0,
    picture: safeDoctor.picture || '',
    facilityId: safeDoctor.facilityId || null,
    bio: safeDoctor.bio || '',
    specialties: Array.isArray(safeDoctor.specialties) ? safeDoctor.specialties : [],
    languages: Array.isArray(safeDoctor.languages) ? safeDoctor.languages : [],
    education: Array.isArray(safeDoctor.education) ? safeDoctor.education : [],
    certifications: Array.isArray(safeDoctor.certifications) ? safeDoctor.certifications : []
  };
}

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
/**
 * @route   PUT /api/users/doctors/:id
 * @desc    Update a doctor's profile
 * @access  Private - Doctor can update own profile, Admin can update any
 */
export const updateDoctorProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Ensure the user has permission to update this profile
    if (req.auth.role !== 'admin' && req.auth.userId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile'
      });
    }

    // Allowed fields that can be updated
    const allowedUpdates = [
      'firstName', 'lastName', 'profession', 'experienceYears',
      'bio', 'specialties', 'languages', 'education', 'certifications'
    ];
    
    // Filter updates to only include allowed fields
    const validUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    // Find and update the doctor
    const doctor = await User.findOneAndUpdate(
      { _id: id, role: 'doctor' },
      { $set: validUpdates },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // Update Clerk metadata
    try {
      await clerkClient.users.updateUser(doctor.clerkId, {
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        unsafeMetadata: {
          ...doctor.unsafeMeta,
          firstName: doctor.firstName,
          lastName: doctor.lastName,
          profession: doctor.profession,
          experienceYears: doctor.experienceYears?.toString()
        }
      });
    } catch (clerkError) {
      console.error('Failed to update Clerk metadata:', clerkError);
      // Continue even if Clerk update fails
    }

    res.json({
      success: true,
      data: formatDoctorData(doctor)
    });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error updating doctor profile',
      error: error.message
    });
  }
};

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

export const getPatients = async (req, res) => {
    try {
        const patient = await User.find({
            role: 'patient'
        })
        .select('-__v -createdAt -updatedAt -unsafeMeta -clerkData')
        .lean()

        if (!patient) {
            throw new NotFoundError('Patient not found')
        }

        res.json({
            success: true,
            data: patient
        })
    } catch (error) {
        console.error('Error fetching patient:', error)
        const statusCode = error.statusCode || 500
        res.status(statusCode).json({
            success: false,
            message: error.message || 'Server error while fetching patient',
            error: error.message
        })
    }
}