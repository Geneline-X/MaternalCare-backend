// Define permissions for each role
export const PERMISSIONS = {
  // User management permissions
  USER_READ_OWN: "user:read:own",
  USER_READ_ALL: "user:read:all",
  USER_UPDATE_OWN: "user:update:own",
  USER_UPDATE_ALL: "user:update:all",
  USER_DELETE: "user:delete",

  // Patient data permissions
  PATIENT_READ_OWN: "patient:read:own",
  PATIENT_READ_ALL: "patient:read:all",
  PATIENT_CREATE: "patient:create",
  PATIENT_UPDATE_OWN: "patient:update:own",
  PATIENT_UPDATE_ALL: "patient:update:all",
  PATIENT_DELETE: "patient:delete",

  // Organization permissions (FHIR Organizations = Facilities)
  ORGANIZATION_READ: "organization:read",
  ORGANIZATION_CREATE: "organization:create",
  ORGANIZATION_UPDATE: "organization:update",
  ORGANIZATION_DELETE: "organization:delete",

  // FHIR resource permissions
  FHIR_READ_OWN: "fhir:read:own",
  FHIR_READ_ALL: "fhir:read:all",
  FHIR_CREATE: "fhir:create",
  FHIR_UPDATE_OWN: "fhir:update:own",
  FHIR_UPDATE_ALL: "fhir:update:all",
  FHIR_DELETE: "fhir:delete",

  // Questionnaire permissions
  QUESTIONNAIRE_READ: "questionnaire:read",
  QUESTIONNAIRE_CREATE: "questionnaire:create",
  QUESTIONNAIRE_UPDATE: "questionnaire:update",
  QUESTIONNAIRE_DELETE: "questionnaire:delete",

  // Analytics permissions
  ANALYTICS_READ_OWN: "analytics:read:own",
  ANALYTICS_READ_ALL: "analytics:read:all",

  // Communication permissions
  COMMUNICATION_READ_OWN: "communication:read:own",
  COMMUNICATION_READ_ALL: "communication:read:all",
  COMMUNICATION_SEND: "communication:send",

  // System permissions
  SYSTEM_ADMIN: "system:admin",
  SYSTEM_LOGS: "system:logs",
}

// Define role-based permissions
export const ROLE_PERMISSIONS = {
  patient: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.PATIENT_READ_OWN,
    PERMISSIONS.PATIENT_UPDATE_OWN,
    PERMISSIONS.ORGANIZATION_READ, // Can read organizations for registration
    PERMISSIONS.FHIR_READ_OWN,
    PERMISSIONS.FHIR_UPDATE_OWN,
    PERMISSIONS.QUESTIONNAIRE_READ,
    PERMISSIONS.ANALYTICS_READ_OWN,
    PERMISSIONS.COMMUNICATION_READ_OWN,
  ],
  nurse: [
    PERMISSIONS.USER_READ_OWN,
    PERMISSIONS.USER_UPDATE_OWN,
    PERMISSIONS.PATIENT_READ_ALL,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.PATIENT_UPDATE_ALL,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.FHIR_READ_ALL,
    PERMISSIONS.FHIR_CREATE,
    PERMISSIONS.FHIR_UPDATE_ALL,
    PERMISSIONS.QUESTIONNAIRE_READ,
    PERMISSIONS.ANALYTICS_READ_ALL,
    PERMISSIONS.COMMUNICATION_READ_ALL,
    PERMISSIONS.COMMUNICATION_SEND,
  ],
  doctor: [
    PERMISSIONS.USER_READ_ALL,
    PERMISSIONS.USER_UPDATE_ALL,
    PERMISSIONS.PATIENT_READ_ALL,
    PERMISSIONS.PATIENT_CREATE,
    PERMISSIONS.PATIENT_UPDATE_ALL,
    PERMISSIONS.PATIENT_DELETE,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE, // Can update their organization
    PERMISSIONS.FHIR_READ_ALL,
    PERMISSIONS.FHIR_CREATE,
    PERMISSIONS.FHIR_UPDATE_ALL,
    PERMISSIONS.FHIR_DELETE,
    PERMISSIONS.QUESTIONNAIRE_READ,
    PERMISSIONS.QUESTIONNAIRE_CREATE,
    PERMISSIONS.QUESTIONNAIRE_UPDATE,
    PERMISSIONS.QUESTIONNAIRE_DELETE,
    PERMISSIONS.ANALYTICS_READ_ALL,
    PERMISSIONS.COMMUNICATION_READ_ALL,
    PERMISSIONS.COMMUNICATION_SEND,
  ],
  admin: [
    ...Object.values(PERMISSIONS), // Admin has all permissions
  ],
}

// Helper function to check if a role has a specific permission
export const hasPermission = (role, permission) => {
  const rolePermissions = ROLE_PERMISSIONS[role] || []
  return rolePermissions.includes(permission)
}

// Helper function to get all permissions for a role
export const getRolePermissions = (role) => {
  return ROLE_PERMISSIONS[role] || []
}

// Resource-specific permission mappings (updated for FHIR compliance)
export const RESOURCE_PERMISSIONS = {
  Organization: {
    read: [PERMISSIONS.ORGANIZATION_READ],
    create: [PERMISSIONS.ORGANIZATION_CREATE],
    update: [PERMISSIONS.ORGANIZATION_UPDATE],
    delete: [PERMISSIONS.ORGANIZATION_DELETE],
  },
  Patient: {
    read: [PERMISSIONS.PATIENT_READ_OWN, PERMISSIONS.PATIENT_READ_ALL],
    create: [PERMISSIONS.PATIENT_CREATE],
    update: [PERMISSIONS.PATIENT_UPDATE_OWN, PERMISSIONS.PATIENT_UPDATE_ALL],
    delete: [PERMISSIONS.PATIENT_DELETE],
  },
  Questionnaire: {
    read: [PERMISSIONS.QUESTIONNAIRE_READ],
    create: [PERMISSIONS.QUESTIONNAIRE_CREATE],
    update: [PERMISSIONS.QUESTIONNAIRE_UPDATE],
    delete: [PERMISSIONS.QUESTIONNAIRE_DELETE],
  },
  QuestionnaireResponse: {
    read: [PERMISSIONS.FHIR_READ_OWN, PERMISSIONS.FHIR_READ_ALL],
    create: [PERMISSIONS.FHIR_CREATE],
    update: [PERMISSIONS.FHIR_UPDATE_OWN, PERMISSIONS.FHIR_UPDATE_ALL],
    delete: [PERMISSIONS.FHIR_DELETE],
  },
  Observation: {
    read: [PERMISSIONS.FHIR_READ_OWN, PERMISSIONS.FHIR_READ_ALL],
    create: [PERMISSIONS.FHIR_CREATE],
    update: [PERMISSIONS.FHIR_UPDATE_OWN, PERMISSIONS.FHIR_UPDATE_ALL],
    delete: [PERMISSIONS.FHIR_DELETE],
  },
  Flag: {
    read: [PERMISSIONS.FHIR_READ_OWN, PERMISSIONS.FHIR_READ_ALL],
    create: [PERMISSIONS.FHIR_CREATE],
    update: [PERMISSIONS.FHIR_UPDATE_OWN, PERMISSIONS.FHIR_UPDATE_ALL],
    delete: [PERMISSIONS.FHIR_DELETE],
  },
  Communication: {
    read: [PERMISSIONS.COMMUNICATION_READ_OWN, PERMISSIONS.COMMUNICATION_READ_ALL],
    create: [PERMISSIONS.COMMUNICATION_SEND],
    update: [PERMISSIONS.COMMUNICATION_SEND],
    delete: [PERMISSIONS.FHIR_DELETE],
  },
  CarePlan: {
    read: [PERMISSIONS.FHIR_READ_OWN, PERMISSIONS.FHIR_READ_ALL],
    create: [PERMISSIONS.FHIR_CREATE],
    update: [PERMISSIONS.FHIR_UPDATE_OWN, PERMISSIONS.FHIR_UPDATE_ALL],
    delete: [PERMISSIONS.FHIR_DELETE],
  },
  Encounter: {
    read: [PERMISSIONS.FHIR_READ_OWN, PERMISSIONS.FHIR_READ_ALL],
    create: [PERMISSIONS.FHIR_CREATE],
    update: [PERMISSIONS.FHIR_UPDATE_OWN, PERMISSIONS.FHIR_UPDATE_ALL],
    delete: [PERMISSIONS.FHIR_DELETE],
  },
}
