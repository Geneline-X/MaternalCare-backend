// Mock FHIR store for development
class FhirStore {
  constructor() {
    this.resources = {
      Questionnaire: [],
      QuestionnaireResponse: [],
      Patient: [],
      Observation: [],
      Encounter: [],
      CarePlan: [],
      Flag: [],
      Communication: [],
      Practitioner: [],
      PractitionerRole: [],
      Organization: [], // FHIR Organizations (facilities)
      Location: [], // FHIR Locations (physical places within organizations)
      HealthcareService: [], // FHIR HealthcareServices (services offered)
    }

    // Seed with initial data
    this.seedData()
  }

  // Seed the store with initial FHIR-compliant data
  seedData() {
    // Add a practitioner
    this.resources.Practitioner.push({
      resourceType: "Practitioner",
      id: "prac123",
      identifier: [{ system: "http://prestack.com/email", value: "toby@gmail.com" }],
      name: [{ given: ["Toby"], family: "Wales" }],
    })

    // Add a practitioner role
    this.resources.PractitionerRole.push({
      resourceType: "PractitionerRole",
      id: "pr123",
      practitioner: { reference: "Practitioner/prac123" },
      organization: { reference: "Organization/org123" },
      code: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/practitioner-role", code: "doctor" }] }],
    })

    // Add an organization
    this.resources.Organization.push({
      resourceType: "Organization",
      id: "org123",
      name: "PreSTrack Clinic",
      address: [{ city: "Freetown", country: "Sierra Leone" }],
    })

    // Add FHIR Organizations (Facilities)
    this.resources.Organization.push({
      resourceType: "Organization",
      id: "org-fgh-001",
      identifier: [
        {
          system: "http://prestack.com/organization-id",
          value: "FGH001",
        },
        {
          system: "http://sierra-leone.gov/facility-license",
          value: "SL-HOSP-001",
        },
      ],
      active: true,
      type: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/organization-type",
              code: "prov",
              display: "Healthcare Provider",
            },
          ],
        },
      ],
      name: "Freetown General Hospital",
      alias: ["FGH"],
      telecom: [
        {
          system: "phone",
          value: "+232-22-222-222",
          use: "work",
        },
        {
          system: "email",
          value: "info@fgh.sl",
          use: "work",
        },
        {
          system: "url",
          value: "https://fgh.sl",
          use: "work",
        },
      ],
      address: [
        {
          use: "work",
          type: "physical",
          line: ["Connaught Hospital Road"],
          city: "Freetown",
          state: "Western Area",
          postalCode: "00232",
          country: "Sierra Leone",
        },
      ],
      contact: [
        {
          purpose: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/contactentity-type",
                code: "ADMIN",
                display: "Administrative",
              },
            ],
          },
          name: {
            text: "Hospital Administration",
          },
          telecom: [
            {
              system: "phone",
              value: "+232-22-222-222",
              use: "work",
            },
          ],
        },
      ],
      extension: [
        {
          url: "http://prestack.com/fhir/StructureDefinition/organization-registration-code",
          valueString: "FGH2024REG",
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/organization-public-registration",
          valueBoolean: true,
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/organization-capacity",
          extension: [
            {
              url: "beds",
              valueInteger: 200,
            },
            {
              url: "staff",
              valueInteger: 150,
            },
          ],
        },
      ],
    })

    this.resources.Organization.push({
      resourceType: "Organization",
      id: "org-bgh-001",
      identifier: [
        {
          system: "http://prestack.com/organization-id",
          value: "BGH001",
        },
        {
          system: "http://sierra-leone.gov/facility-license",
          value: "SL-HOSP-002",
        },
      ],
      active: true,
      type: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/organization-type",
              code: "prov",
              display: "Healthcare Provider",
            },
          ],
        },
      ],
      name: "Bo Government Hospital",
      alias: ["BGH"],
      telecom: [
        {
          system: "phone",
          value: "+232-32-222-333",
          use: "work",
        },
        {
          system: "email",
          value: "info@bgh.sl",
          use: "work",
        },
      ],
      address: [
        {
          use: "work",
          type: "physical",
          line: ["Hospital Road"],
          city: "Bo",
          state: "Southern Province",
          postalCode: "00232",
          country: "Sierra Leone",
        },
      ],
      extension: [
        {
          url: "http://prestack.com/fhir/StructureDefinition/organization-registration-code",
          valueString: "BGH2024REG",
        },
        {
          url: "http://prestack.com/fhir/StructureDefinition/organization-public-registration",
          valueBoolean: true,
        },
      ],
    })

    // Add FHIR Locations for physical places within organizations
    this.resources.Location.push({
      resourceType: "Location",
      id: "loc-fgh-maternity",
      identifier: [
        {
          system: "http://prestack.com/location-id",
          value: "FGH-MAT-001",
        },
      ],
      status: "active",
      name: "Maternity Ward",
      description: "Maternity and delivery services",
      mode: "instance",
      type: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
              code: "MATWRD",
              display: "Maternity Ward",
            },
          ],
        },
      ],
      physicalType: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/location-physical-type",
            code: "wa",
            display: "Ward",
          },
        ],
      },
      managingOrganization: {
        reference: "Organization/org-fgh-001",
        display: "Freetown General Hospital",
      },
      position: {
        longitude: -13.2317,
        latitude: 8.4657,
      },
    })

    // Add FHIR HealthcareServices
    this.resources.HealthcareService.push({
      resourceType: "HealthcareService",
      id: "hs-fgh-prenatal",
      identifier: [
        {
          system: "http://prestack.com/healthcare-service-id",
          value: "FGH-PRENATAL-001",
        },
      ],
      active: true,
      providedBy: {
        reference: "Organization/org-fgh-001",
        display: "Freetown General Hospital",
      },
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/service-category",
              code: "35",
              display: "Mental Health",
            },
          ],
        },
      ],
      type: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "386637004",
              display: "Prenatal care",
            },
          ],
        },
      ],
      specialty: [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "394586005",
              display: "Gynecology",
            },
          ],
        },
      ],
      location: [
        {
          reference: "Location/loc-fgh-maternity",
          display: "Maternity Ward",
        },
      ],
      name: "Prenatal Care Services",
      comment: "Comprehensive prenatal care including regular checkups, screenings, and education",
      availableTime: [
        {
          daysOfWeek: ["mon", "tue", "wed", "thu", "fri"],
          availableStartTime: "08:00:00",
          availableEndTime: "17:00:00",
        },
        {
          daysOfWeek: ["sat"],
          availableStartTime: "09:00:00",
          availableEndTime: "13:00:00",
        },
      ],
    })

    // Add a patient
    this.resources.Patient.push({
      resourceType: "Patient",
      id: "pat123",
      identifier: [{ system: "http://prestack.com/email", value: "patient@example.com" }],
      name: [{ given: ["Aminata"], family: "Sesay" }],
      telecom: [
        { system: "phone", value: "+1234567890" },
        { system: "email", value: "patient@example.com" },
      ],
      gender: "female",
      birthDate: "1990-01-01",
    })

    // Add a patient with proper FHIR structure
    this.resources.Patient.push({
      resourceType: "Patient",
      id: "pat123",
      identifier: [
        {
          system: "http://prestack.com/patient-id",
          value: "FGH-PAT-001",
        },
        {
          system: "http://prestack.com/email",
          value: "patient@example.com",
        },
      ],
      active: true,
      name: [
        {
          given: ["Aminata"],
          family: "Sesay",
          use: "official",
        },
      ],
      telecom: [
        {
          system: "phone",
          value: "+1234567890",
          use: "mobile",
        },
        {
          system: "email",
          value: "patient@example.com",
          use: "home",
        },
      ],
      gender: "female",
      birthDate: "1990-01-01",
      address: [
        {
          use: "home",
          type: "physical",
          line: ["123 Main Street"],
          city: "Freetown",
          state: "Western Area",
          postalCode: "00232",
          country: "Sierra Leone",
        },
      ],
      managingOrganization: {
        reference: "Organization/org-fgh-001",
        display: "Freetown General Hospital",
      },
      generalPractitioner: [
        {
          reference: "PractitionerRole/pr123",
          display: "Dr. Toby Wales",
        },
      ],
    })

    // Add a questionnaire
    this.resources.Questionnaire.push({
      resourceType: "Questionnaire",
      id: "pregnancy-patient-registration",
      status: "active",
      title: "Patient Registration Form",
      item: [
        { linkId: "firstName", text: "First Name", type: "string", required: true },
        { linkId: "lastName", text: "Last Name", type: "string", required: true },
        {
          linkId: "gender",
          text: "Gender",
          type: "choice",
          required: true,
          answerOption: [{ valueString: "Female" }, { valueString: "Male" }],
        },
        { linkId: "birthDate", text: "Date of Birth", type: "date", required: true },
        {
          linkId: "district",
          text: "District",
          type: "choice",
          required: true,
          answerOption: [
            { valueString: "Western Area Urban" },
            { valueString: "Western Area Rural" },
            { valueString: "Bo" },
          ],
        },
        {
          linkId: "chiefdom",
          text: "Chiefdom",
          type: "choice",
          required: false,
          enableWhen: [{ question: "district", operator: "=", answerString: "Bo" }],
          answerOption: [{ valueString: "Badjia" }, { valueString: "Bagbo" }, { valueString: "Bagbwe" }],
        },
        {
          linkId: "pregnancyStatus",
          text: "Are you pregnant?",
          type: "boolean",
          enableWhen: [{ question: "gender", operator: "=", answerString: "Female" }],
        },
      ],
    })

    // Add a questionnaire
    this.resources.Questionnaire.push({
      resourceType: "Questionnaire",
      id: "pregnancy-patient-registration",
      url: "http://prestack.com/fhir/Questionnaire/pregnancy-patient-registration",
      version: "1.0.0",
      name: "PregnancyPatientRegistration",
      title: "Patient Registration Form",
      status: "active",
      experimental: false,
      date: "2024-01-01",
      publisher: "PreSTrack System",
      description: "Patient registration form for prenatal care services",
      jurisdiction: [
        {
          coding: [
            {
              system: "urn:iso:std:iso:3166",
              code: "SL",
              display: "Sierra Leone",
            },
          ],
        },
      ],
      purpose: "To collect essential patient information for prenatal care registration",
      item: [
        {
          linkId: "firstName",
          text: "First Name",
          type: "string",
          required: true,
        },
        {
          linkId: "lastName",
          text: "Last Name",
          type: "string",
          required: true,
        },
        {
          linkId: "gender",
          text: "Gender",
          type: "choice",
          required: true,
          answerOption: [
            {
              valueCoding: {
                system: "http://hl7.org/fhir/administrative-gender",
                code: "female",
                display: "Female",
              },
            },
            {
              valueCoding: {
                system: "http://hl7.org/fhir/administrative-gender",
                code: "male",
                display: "Male",
              },
            },
          ],
        },
        {
          linkId: "birthDate",
          text: "Date of Birth",
          type: "date",
          required: true,
        },
        {
          linkId: "district",
          text: "District",
          type: "choice",
          required: true,
          answerOption: [
            { valueString: "Western Area Urban" },
            { valueString: "Western Area Rural" },
            { valueString: "Bo" },
          ],
        },
        {
          linkId: "chiefdom",
          text: "Chiefdom",
          type: "choice",
          required: false,
          enableWhen: [
            {
              question: "district",
              operator: "=",
              answerString: "Bo",
            },
          ],
          answerOption: [{ valueString: "Badjia" }, { valueString: "Bagbo" }, { valueString: "Bagbwe" }],
        },
        {
          linkId: "pregnancyStatus",
          text: "Are you pregnant?",
          type: "boolean",
          enableWhen: [
            {
              question: "gender",
              operator: "=",
              answerCoding: {
                system: "http://hl7.org/fhir/administrative-gender",
                code: "female",
              },
            },
          ],
        },
      ],
    })
  }

  // Generic CRUD operations
  async create(resourceType, resource) {
    if (!this.resources[resourceType]) {
      throw new Error(`Invalid resource type: ${resourceType}`)
    }

    // Generate ID if not provided
    if (!resource.id) {
      resource.id = `${resourceType.toLowerCase()}-${Date.now()}`
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

    this.resources[resourceType].push(resource)
    return resource
  }

  async read(resourceType, id) {
    if (!this.resources[resourceType]) {
      throw new Error(`Invalid resource type: ${resourceType}`)
    }

    const resource = this.resources[resourceType].find((r) => r.id === id)
    if (!resource) {
      throw new Error(`Resource not found: ${resourceType}/${id}`)
    }

    return resource
  }

  async search(resourceType, params = {}) {
    if (!this.resources[resourceType]) {
      throw new Error(`Invalid resource type: ${resourceType}`)
    }

    let results = [...this.resources[resourceType]]

    // Filter by identifier
    if (params.identifier) {
      results = results.filter(
        (r) =>
          r.identifier &&
          r.identifier.some((id) => id.value === params.identifier || `${id.system}|${id.value}` === params.identifier),
      )
    }

    // Filter by name (for Organization, Patient, etc.)
    if (params.name) {
      results = results.filter((r) => {
        if (r.name) {
          if (typeof r.name === "string") {
            return r.name.toLowerCase().includes(params.name.toLowerCase())
          }
          if (Array.isArray(r.name)) {
            return r.name.some((name) => {
              if (typeof name === "string") {
                return name.toLowerCase().includes(params.name.toLowerCase())
              }
              if (name.text) {
                return name.text.toLowerCase().includes(params.name.toLowerCase())
              }
              return false
            })
          }
        }
        return false
      })
    }

    // Filter by active status
    if (params.active !== undefined) {
      const activeValue = params.active === "true"
      results = results.filter((r) => r.active === activeValue)
    }

    // Filter by type (for Organizations)
    if (params.type && resourceType === "Organization") {
      results = results.filter(
        (r) =>
          r.type &&
          r.type.some(
            (type) =>
              type.coding &&
              type.coding.some((coding) => coding.code === params.type || coding.display === params.type),
          ),
      )
    }

    // Filter by subject (e.g., Patient/123)
    if (params.subject) {
      results = results.filter((r) => r.subject && r.subject.reference === params.subject)
    }

    // Filter by patient (e.g., Patient/123)
    if (params.patient) {
      results = results.filter((r) => r.subject && r.subject.reference === params.patient)
    }

    // Filter by questionnaire (e.g., Questionnaire/123)
    if (params.questionnaire) {
      results = results.filter((r) => r.questionnaire === params.questionnaire)
    }

    // Filter by status
    if (params.status) {
      results = results.filter((r) => r.status === params.status)
    }

    // Filter by date range
    if (params.date) {
      // Implement date filtering logic
    }

    // Implement _count parameter
    if (params._count) {
      const count = Number.parseInt(params._count)
      results = results.slice(0, count)
    }

    return results
  }

  async update(resourceType, id, resource) {
    if (!this.resources[resourceType]) {
      throw new Error(`Invalid resource type: ${resourceType}`)
    }

    const index = this.resources[resourceType].findIndex((r) => r.id === id)
    if (index === -1) {
      throw new Error(`Resource not found: ${resourceType}/${id}`)
    }

    // Ensure ID and resourceType are preserved
    resource.id = id
    resource.resourceType = resourceType

    // Update meta information
    const currentResource = this.resources[resourceType][index]
    resource.meta = {
      ...currentResource.meta,
      versionId: (Number.parseInt(currentResource.meta?.versionId || "1") + 1).toString(),
      lastUpdated: new Date().toISOString(),
    }

    this.resources[resourceType][index] = resource
    return resource
  }

  async delete(resourceType, id) {
    if (!this.resources[resourceType]) {
      throw new Error(`Invalid resource type: ${resourceType}`)
    }

    const index = this.resources[resourceType].findIndex((r) => r.id === id)
    if (index === -1) {
      throw new Error(`Resource not found: ${resourceType}/${id}`)
    }

    this.resources[resourceType].splice(index, 1)
    return { message: `${resourceType}/${id} deleted successfully` }
  }
}

// Create singleton instance
const fhirStore = new FhirStore()

export default fhirStore
