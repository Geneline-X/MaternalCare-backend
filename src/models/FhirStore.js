import mongoose from "mongoose"

// Generic FHIR Resource Schema
const FhirResourceSchema = new mongoose.Schema(
  {
    resourceType: { type: String, required: true, index: true },
    id: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    meta: {
      versionId: String,
      lastUpdated: { type: Date, default: Date.now },
      profile: [String],
    },
  },
  {
    timestamps: true,
    collection: "fhir_resources",
  },
)

// Compound index for efficient queries
FhirResourceSchema.index({ resourceType: 1, id: 1 })
FhirResourceSchema.index({ resourceType: 1, "data.status": 1 })
FhirResourceSchema.index({ resourceType: 1, "data.participant.actor.reference": 1 })
FhirResourceSchema.index({ resourceType: 1, "data.doctorId": 1 }) // Index for doctor queries
FhirResourceSchema.index({ resourceType: 1, "data.patientId": 1 }) // Index for patient queries

const FhirResource = mongoose.model("FhirResource", FhirResourceSchema)

// Enhanced FHIR store with MongoDB persistence
class FhirStore {
  constructor() {
    console.log("🗄️ FhirStore initialized with MongoDB persistence")
  }

  // Generic CRUD operations with MongoDB
  async create(resourceType, resource) {
    try {
      // Generate ID if not provided
      if (!resource.id) {
        resource.id = `${resourceType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }

      // Add resourceType if not provided
      if (!resource.resourceType) {
        resource.resourceType = resourceType
      }

      // Add FHIR meta information
      if (!resource.meta) {
        resource.meta = {
          versionId: "1",
          lastUpdated: new Date().toISOString(),
          profile: [`http://prestack.com/fhir/StructureDefinition/${resourceType}`],
        }
      }

      // Save to MongoDB
      const fhirDoc = new FhirResource({
        resourceType,
        id: resource.id,
        data: resource,
        meta: resource.meta,
      })

      await fhirDoc.save()
      console.log(`✅ Created ${resourceType} with ID: ${resource.id} in MongoDB`)
      return resource
    } catch (error) {
      console.error(`❌ Error creating ${resourceType}:`, error)
      throw error
    }
  }

  async read(resourceType, id) {
    try {
      const fhirDoc = await FhirResource.findOne({ resourceType, id })
      if (!fhirDoc) {
        throw new Error(`Resource not found: ${resourceType}/${id}`)
      }
      return fhirDoc.data
    } catch (error) {
      console.error(`❌ Error reading ${resourceType}/${id}:`, error)
      throw error
    }
  }

  async search(resourceType, params = {}) {
    try {
      console.log(`🔍 Searching ${resourceType} with params:`, params)
      const query = { resourceType }

      // Build MongoDB query based on search parameters
      if (params.identifier) {
        query["data.identifier"] = {
          $elemMatch: {
            $or: [
              { value: params.identifier },
              { $expr: { $eq: [{ $concat: ["$system", "|", "$value"] }, params.identifier] } },
            ],
          },
        }
      }

      if (params.status) {
        query["data.status"] = params.status
      }

      // Updated to search by patientId directly
      if (params.patientId) {
        query["data.patientId"] = params.patientId
        console.log(`🔍 Filtering by patientId: ${params.patientId}`)
      }

      // Updated to search by doctorId instead of practitioner
      if (params.doctorId) {
        query["data.doctorId"] = params.doctorId
        console.log(`🔍 Filtering by doctorId: ${params.doctorId}`)
      }

      // Legacy support for patient reference format
      if (params.patient) {
        const patientId = params.patient.replace("Patient/", "")
        query["data.patientId"] = patientId
        console.log(`🔍 Filtering by patient reference: ${params.patient} -> patientId: ${patientId}`)
      }

      // Legacy support for doctor reference format
      if (params.doctor) {
        query["data.doctorId"] = params.doctor
        console.log(`🔍 Filtering by doctor: ${params.doctor}`)
      }

      if (params.date) {
        const startDate = new Date(params.date)
        const endDate = new Date(params.date)
        endDate.setDate(endDate.getDate() + 1)

        query["data.start"] = {
          $gte: startDate.toISOString(),
          $lt: endDate.toISOString(),
        }
      }

      if (params.email) {
        query.$or = [
          { "data.telecom": { $elemMatch: { system: "email", value: { $regex: params.email, $options: "i" } } } },
          {
            "data.identifier": {
              $elemMatch: { system: "http://prestack.com/email", value: { $regex: params.email, $options: "i" } },
            },
          },
        ]
      }

      console.log(`🔍 Final MongoDB query:`, JSON.stringify(query, null, 2))

      // Execute query
      let mongoQuery = FhirResource.find(query)

      if (params._count) {
        mongoQuery = mongoQuery.limit(Number.parseInt(params._count))
      }

      const results = await mongoQuery.exec()
      console.log(`📊 Found ${results.length} ${resourceType} resources`)

      return results.map((doc) => doc.data)
    } catch (error) {
      console.error(`❌ Error searching ${resourceType}:`, error)
      throw error
    }
  }

  async update(resourceType, id, resource) {
    try {
      const existingDoc = await FhirResource.findOne({ resourceType, id })
      if (!existingDoc) {
        throw new Error(`Resource not found: ${resourceType}/${id}`)
      }

      // Ensure ID and resourceType are preserved
      resource.id = id
      resource.resourceType = resourceType

      // Update meta information
      resource.meta = {
        ...existingDoc.data.meta,
        versionId: (Number.parseInt(existingDoc.data.meta?.versionId || "1") + 1).toString(),
        lastUpdated: new Date().toISOString(),
      }

      // Update in MongoDB
      await FhirResource.updateOne(
        { resourceType, id },
        {
          data: resource,
          meta: resource.meta,
        },
      )

      console.log(`✅ Updated ${resourceType} with ID: ${id} in MongoDB`)
      return resource
    } catch (error) {
      console.error(`❌ Error updating ${resourceType}/${id}:`, error)
      throw error
    }
  }

  async delete(resourceType, id) {
    try {
      // First verify the resource exists
      const existing = await FhirResource.findOne({ resourceType, id });
      if (!existing) {
        throw new Error(`Resource not found: ${resourceType}/${id}`);
      }

      // Now delete it
      const result = await FhirResource.deleteOne({ resourceType, id });
      
      if (result.deletedCount === 0) {
        throw new Error(`Failed to delete resource: ${resourceType}/${id}`);
      }

      console.log(`🗑️ Deleted ${resourceType} with ID: ${id} from MongoDB`);
      return { message: `${resourceType}/${id} deleted successfully` };
    } catch (error) {
      console.error(`❌ Error deleting ${resourceType}/${id}:`, error);
      throw error;
    }
  }

  // Helper method to get current data counts
  async getStats() {
    try {
      const pipeline = [{ $group: { _id: "$resourceType", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]

      const results = await FhirResource.aggregate(pipeline)
      const stats = {}
      results.forEach((item) => {
        stats[item._id] = item.count
      })

      return stats
    } catch (error) {
      console.error("❌ Error getting stats:", error)
      throw error
    }
  }

  // Helper method to clear all data (useful for testing)
  async clearAll() {
    try {
      await FhirResource.deleteMany({})
      console.log("🧹 Cleared all data from MongoDB")
    } catch (error) {
      console.error("❌ Error clearing data:", error)
      throw error
    }
  }
}

// Create singleton instance
export const fhirStore = new FhirStore()
