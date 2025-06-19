# Backend Testing Guide

This document provides instructions for testing the backend API with Clerk authentication integration.

## Table of Contents

- [Setup](#setup)
- [Environment Configuration](#environment-configuration)
- [Authentication Testing](#authentication-testing)
- [API Endpoint Testing](#api-endpoint-testing)
- [Webhook Testing](#webhook-testing)
- [Role-Based Access Testing](#role-based-access-testing)
- [Troubleshooting](#troubleshooting)

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make sure MongoDB is running locally or configure a remote MongoDB instance

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/prestrack

# Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_WEBHOOK_SECRET=your_clerk_webhook_secret
```

Replace the placeholder values with your actual credentials.

### Next Steps

To get successful test results, you need to generate and use valid test tokens:

1. **Generate test tokens** using the script I provided:

```shellscript
npm run generate:tokens
```


2. **Add the generated tokens to your `.env` file**:

```plaintext
TEST_DOCTOR_TOKEN=your_generated_token
TEST_NURSE_TOKEN=your_generated_token
TEST_PATIENT_TOKEN=your_generated_token
```


3. **Run the tests again**:

```shellscript
npm run test:auth
```




Keep in mind that these are mock tokens for testing purposes. In a real application, you would get actual Clerk tokens from your frontend after a user logs in.

If you want to test with real Clerk tokens, you would need to:

1. Log in through your frontend application
2. Extract the token from the browser (using developer tools)
3. Add that token to your `.env` file


Would you like me to explain how to set up the Clerk integration more thoroughly, or would you prefer to proceed with generating test tokens?

To configure the generation, complete these steps:

## Authentication Testing

### 1. Test Clerk Middleware Integration

Start the server:

```bash
npm run dev
```

Make a request to a protected endpoint without authentication:

```bash
curl http://localhost:3000/api/auth/me
```

Expected result: 401 Unauthorized response

### 2. Test Authentication Status Endpoint

```bash
curl http://localhost:3000/api/auth/status
```

Expected result: JSON response with authentication status (unauthenticated)

### 3. Test Authentication with Clerk Token

Get a valid Clerk session token from your frontend application or Clerk dashboard.

```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/auth/me
```

Expected result: User profile information if token is valid

## API Endpoint Testing

### Test Protected FHIR Endpoints

#### Get Questionnaires (requires authentication)

```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Questionnaire
```

Expected result: List of questionnaires if authenticated

#### Get Patients (requires doctor/nurse role)

```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Patient
```

Expected result: 
- Success with list of patients if authenticated as doctor/nurse
- 403 Forbidden if authenticated as patient

### Test Analytics Endpoint

```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/analytics/pregnancy
```

Expected result: Analytics data if authenticated with appropriate role

## Complete API Endpoint Reference

This section provides curl commands for testing all available endpoints in the API.

### Authentication Endpoints

#### Get Authentication Status
```bash
curl http://localhost:3000/api/auth/status
```

#### Get Current User Profile
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/auth/me
```

#### Webhook Endpoint (POST)
```bash
# Note: Typically called by Clerk, not manually
curl -X POST -H "Content-Type: application/json" -H "clerk-signature: YOUR_SIGNATURE" -d '{"type":"user.created","data":{}}' http://localhost:3000/api/auth/webhook
```

### Authentication Endpoints

#### Get Authentication Status
```bash
curl -X GET http://localhost:3000/api/auth/status
```

#### Handle Webhook
```bash
curl -X POST -H "Content-Type: application/json" -H "clerk-signature: YOUR_SIGNATURE" -d '{"type":"user.created","data":{}}' http://localhost:3000/api/auth/webhook
```

#### Get Current User Profile
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/auth/me
```

#### Update User Role (Admin only)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{"role":"admin"}' http://localhost:3000/api/auth/users/USER_ID/role
```

### FHIR Resource Endpoints

#### Patient Endpoints

##### Get All Patients
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Patient
```

##### Get Specific Patient
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Patient/PATIENT_ID
```

##### Create Patient
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "resourceType": "Patient",
  "name": [{"given": ["John"], "family": "Doe"}],
  "gender": "male",
  "birthDate": "1990-01-01"
}' http://localhost:3000/api/fhir/Patient
```

#### Observation Endpoints

##### Get All Observations
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Observation
```

##### Get Specific Observation
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Observation/OBSERVATION_ID
```

##### Create Observation
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [{"system": "http://loinc.org", "code": "85354-9", "display": "Blood pressure"}]
  },
  "subject": {"reference": "Patient/PATIENT_ID"},
  "effectiveDateTime": "2023-01-01T12:00:00Z",
  "valueQuantity": {"value": 120, "unit": "mmHg"}
}' http://localhost:3000/api/fhir/Observation
```

#### Appointment Endpoints

##### Get All Appointments
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Appointment
```

##### Create Appointment
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "resourceType": "Appointment",
  "status": "booked",
  "serviceType": [{"coding": [{"system": "http://snomed.info/sct", "code": "185349003"}]}],
  "start": "2023-01-15T10:00:00Z",
  "end": "2023-01-15T10:30:00Z",
  "participant": [
    {"actor": {"reference": "Practitioner/PRACTITIONER_ID"}, "status": "accepted"},
    {"actor": {"reference": "Patient/PATIENT_ID"}, "status": "accepted"}
  ]
}' http://localhost:3000/api/fhir/Appointment
```

### Mobile App Endpoints

#### Patient Management

##### Get Mobile Patients (Doctor/Nurse only)
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/patients
```

##### Get Patient Details
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/patients/PATIENT_ID
```

#### Pregnancy Management

##### Get Current Pregnancy
```bash
# For doctors accessing patient records
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/pregnancies/current/PATIENT_ID

# For patients accessing their own records
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/pregnancies/current
```

#### Health Metrics

##### Get Patient Health Metrics (Doctor/Nurse)
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/health-metrics/patient/PATIENT_ID
```

##### Get My Health Metrics (Patient)
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/health-metrics/my-metrics
```

#### Messaging

##### Get Conversations
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/messages/conversations
```

##### Send Message
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "conversationId": "CONVERSATION_ID",
  "content": "Hello, how are you?",
  "attachments": []
}' http://localhost:3000/api/mobile/messages
```

#### File Upload

##### Upload File
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -F "file=@/path/to/file.jpg" http://localhost:3000/api/mobile/files/upload
```

### Analytics Endpoints

#### Get Pregnancy Analytics
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/analytics/pregnancy
```

### Available Doctors

##### Get Available Doctors
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/doctors
```

### Communication Endpoints

##### Get All Communications
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Communication
```

##### Get Notification Counts
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Communication/counts
```

##### Mark Notification as Read
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Communication/MESSAGE_ID/read
```

### Care Plan Endpoints

##### Get All Care Plans
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/CarePlan
```

### Flag Endpoints (Alerts)

##### Get All Flags
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Flag
```

### Encounter Endpoints

##### Get All Encounters
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Encounter
```

### Questionnaire Response Endpoints

##### Submit Questionnaire Response
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "resourceType": "QuestionnaireResponse",
  "questionnaire": "Questionnaire/QUESTIONNAIRE_ID",
  "status": "completed",
  "subject": {"reference": "Patient/PATIENT_ID"},
  "item": [
    {
      "linkId": "question1",
      "text": "What is your name?",
      "answer": [{"valueString": "John Doe"}]
    }
  ]
}' http://localhost:3000/api/fhir/QuestionnaireResponse
```

### User Management

#### Get Users by Role
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/auth/users/role/doctor
```

#### Assign User to Facility
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{"facilityId": "FACILITY_ID"}' http://localhost:3000/api/auth/users/USER_ID/facility
```

### Forms & Questionnaires

#### Get Patient Forms
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/forms/patient-forms
```

#### Submit Form
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "formId": "FORM_ID",
  "responses": {
    "question1": "Answer 1",
    "question2": "Answer 2"
  }
}' http://localhost:3000/api/mobile/form-submissions
```

### File Management

#### Get User Files
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/files
```

#### Delete File
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/mobile/files/FILE_ID
```

#### Questionnaire Endpoints

##### Get All Questionnaires
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Questionnaire
```

##### Get Specific Questionnaire
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Questionnaire/QUESTIONNAIRE_ID
```

##### Create Questionnaire (Doctor role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "resourceType": "Questionnaire",
  "status": "active",
  "title": "New Questionnaire",
  "item": [
    {
      "linkId": "question1",
      "text": "Sample Question",
      "type": "string"
    }
  ]
}' http://localhost:3000/api/fhir/Questionnaire
```

##### Update Questionnaire (Doctor role required)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "active",
  "title": "Updated Questionnaire",
  "item": [
    {
      "linkId": "question1",
      "text": "Updated Question",
      "type": "string"
    }
  ]
}' http://localhost:3000/api/fhir/Questionnaire/questionnaire-id
```

##### Delete Questionnaire (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Questionnaire/questionnaire-id
```

#### QuestionnaireResponse Endpoints

##### Get All QuestionnaireResponses
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/QuestionnaireResponse
```

##### Get Specific QuestionnaireResponse
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/QuestionnaireResponse/response-id
```

##### Create QuestionnaireResponse
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "questionnaire": "Questionnaire/pregnancy-patient-registration",
  "status": "completed",
  "subject": {
    "reference": "Patient/YOUR_PATIENT_ID"
  },
  "item": [
    {
      "linkId": "firstName",
      "answer": [
        {
          "valueString": "Jane"
        }
      ]
    },
    {
      "linkId": "lastName",
      "answer": [
        {
          "valueString": "Doe"
        }
      ]
    }
  ]
}' http://localhost:3000/api/fhir/QuestionnaireResponse
```

##### Update QuestionnaireResponse
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "questionnaire": "Questionnaire/pregnancy-patient-registration",
  "status": "completed",
  "subject": {
    "reference": "Patient/YOUR_PATIENT_ID"
  },
  "item": [
    {
      "linkId": "firstName",
      "answer": [
        {
          "valueString": "Jane"
        }
      ]
    },
    {
      "linkId": "lastName",
      "answer": [
        {
          "valueString": "Smith"
        }
      ]
    }
  ]
}' http://localhost:3000/api/fhir/QuestionnaireResponse/response-id
```

##### Delete QuestionnaireResponse (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/QuestionnaireResponse/response-id
```

#### Patient Endpoints

##### Get All Patients (Doctor/Nurse role required)
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Patient
```

##### Get Specific Patient
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Patient/patient-id
```

##### Create Patient (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "name": [
    {
      "given": ["Jane"],
      "family": "Doe"
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+1234567890"
    },
    {
      "system": "email",
      "value": "jane.doe@example.com"
    }
  ],
  "gender": "female",
  "birthDate": "1990-01-01"
}' http://localhost:3000/api/fhir/Patient
```

##### Update Patient
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "name": [
    {
      "given": ["Jane"],
      "family": "Smith"
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+1234567890"
    },
    {
      "system": "email",
      "value": "jane.smith@example.com"
    }
  ],
  "gender": "female",
  "birthDate": "1990-01-01"
}' http://localhost:3000/api/fhir/Patient/patient-id
```

##### Delete Patient (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Patient/patient-id
```

#### Observation Endpoints

##### Get All Observations
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Observation
```

##### Get Specific Observation
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Observation/observation-id
```

##### Create Observation (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "29463-7",
        "display": "Body Weight"
      }
    ],
    "text": "Weight"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "valueQuantity": {
    "value": 70,
    "unit": "kg",
    "system": "http://unitsofmeasure.org",
    "code": "kg"
  },
  "effectiveDateTime": "2023-06-01T12:00:00Z"
}' http://localhost:3000/api/fhir/Observation
```

##### Update Observation (Doctor/Nurse role required)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "29463-7",
        "display": "Body Weight"
      }
    ],
    "text": "Weight"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "valueQuantity": {
    "value": 72,
    "unit": "kg",
    "system": "http://unitsofmeasure.org",
    "code": "kg"
  },
  "effectiveDateTime": "2023-06-01T12:00:00Z"
}' http://localhost:3000/api/fhir/Observation/observation-id
```

##### Delete Observation (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Observation/observation-id
```

#### Flag Endpoints

##### Get All Flags
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Flag
```

##### Get Specific Flag
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Flag/flag-id
```

##### Create Flag (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "active",
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "38341003",
        "display": "Hypertension"
      }
    ],
    "text": "High Blood Pressure"
  },
  "subject": {
    "reference": "Patient/patient-id"
  }
}' http://localhost:3000/api/fhir/Flag
```

##### Update Flag (Doctor/Nurse role required)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "inactive",
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "38341003",
        "display": "Hypertension"
      }
    ],
    "text": "High Blood Pressure - Resolved"
  },
  "subject": {
    "reference": "Patient/patient-id"
  }
}' http://localhost:3000/api/fhir/Flag/flag-id
```

##### Delete Flag (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Flag/flag-id
```

#### Communication Endpoints

##### Get All Communications
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Communication
```

##### Get Specific Communication
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Communication/communication-id
```

##### Create Communication (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "completed",
  "subject": {
    "reference": "Patient/patient-id"
  },
  "sender": {
    "reference": "Practitioner/practitioner-id"
  },
  "recipient": [
    {
      "reference": "Patient/patient-id"
    }
  ],
  "payload": [
    {
      "contentString": "Please remember your appointment tomorrow at 10:00 AM."
    }
  ],
  "sent": "2023-06-01T12:00:00Z"
}' http://localhost:3000/api/fhir/Communication
```

##### Update Communication (Doctor/Nurse role required)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "completed",
  "subject": {
    "reference": "Patient/patient-id"
  },
  "sender": {
    "reference": "Practitioner/practitioner-id"
  },
  "recipient": [
    {
      "reference": "Patient/patient-id"
    }
  ],
  "payload": [
    {
      "contentString": "Your appointment has been rescheduled to 2:00 PM tomorrow."
    }
  ],
  "sent": "2023-06-01T12:00:00Z"
}' http://localhost:3000/api/fhir/Communication/communication-id
```

##### Delete Communication (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Communication/communication-id
```

#### CarePlan Endpoints

##### Get All CarePlans
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/CarePlan
```

##### Get Specific CarePlan
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/CarePlan/careplan-id
```

##### Create CarePlan (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "active",
  "intent": "plan",
  "title": "Prenatal Care Plan",
  "subject": {
    "reference": "Patient/patient-id"
  },
  "period": {
    "start": "2023-06-01T00:00:00Z",
    "end": "2024-03-01T00:00:00Z"
  },
  "activity": [
    {
      "detail": {
        "status": "scheduled",
        "description": "First Trimester Checkup",
        "scheduledTiming": {
          "repeat": {
            "boundsPeriod": {
              "start": "2023-06-01T00:00:00Z",
              "end": "2023-09-01T00:00:00Z"
            }
          }
        }
      }
    }
  ]
}' http://localhost:3000/api/fhir/CarePlan
```

##### Update CarePlan (Doctor/Nurse role required)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "active",
  "intent": "plan",
  "title": "Updated Prenatal Care Plan",
  "subject": {
    "reference": "Patient/patient-id"
  },
  "period": {
    "start": "2023-06-01T00:00:00Z",
    "end": "2024-03-01T00:00:00Z"
  },
  "activity": [
    {
      "detail": {
        "status": "scheduled",
        "description": "First Trimester Checkup - Updated",
        "scheduledTiming": {
          "repeat": {
            "boundsPeriod": {
              "start": "2023-06-15T00:00:00Z",
              "end": "2023-09-15T00:00:00Z"
            }
          }
        }
      }
    }
  ]
}' http://localhost:3000/api/fhir/CarePlan/careplan-id
```

##### Delete CarePlan (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/CarePlan/careplan-id
```

#### Encounter Endpoints

##### Get All Encounters
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Encounter
```

##### Get Specific Encounter
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Encounter/encounter-id
```

##### Create Encounter (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "planned",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "period": {
    "start": "2023-06-15T10:00:00Z"
  },
  "reasonCode": [
    {
      "text": "Prenatal Visit"
    }
  ]
}' http://localhost:3000/api/fhir/Encounter
```

##### Update Encounter (Doctor/Nurse role required)
```bash
curl -X PUT -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "subject": {
    "reference": "Patient/patient-id"
  },
  "period": {
    "start": "2023-06-15T10:00:00Z",
    "end": "2023-06-15T10:30:00Z"
  },
  "reasonCode": [
    {
      "text": "Prenatal Visit"
    }
  ]
}' http://localhost:3000/api/fhir/Encounter/encounter-id
```

##### Delete Encounter (Doctor role required)
```bash
curl -X DELETE -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/fhir/Encounter/encounter-id
```

### SMS Endpoints

#### Handle Inbound SMS (Public)
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "From": "+1234567890",
  "Body": "Weight 70 kg"
}' http://localhost:3000/api/sms/inbound
```

#### Send Outbound SMS (Doctor/Nurse role required)
```bash
curl -X POST -H "Authorization: Bearer YOUR_CLERK_TOKEN" -H "Content-Type: application/json" -d '{
  "patientId": "patient-id",
  "message": "Your appointment is confirmed for tomorrow at 10:00 AM."
}' http://localhost:3000/api/sms/outbound
```

### Analytics Endpoints

#### Get Pregnancy Analytics
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" http://localhost:3000/api/analytics/pregnancy
```

#### Get Pregnancy Analytics with Filters
```bash
curl -H "Authorization: Bearer YOUR_CLERK_TOKEN" "http://localhost:3000/api/analytics/pregnancy?facilityId=org123&startDate=2023-01-01&endDate=2023-12-31"
```

### Health Check Endpoint

#### API Health Check
```bash
curl http://localhost:3000/health
```

#### API Root
```bash
curl http://localhost:3000/
```

## Webhook Testing

To test Clerk webhooks locally:

1. Install a tool like [ngrok](https://ngrok.com/) to expose your local server
   ```bash
   ngrok http 3000
   ```

2. Configure the webhook URL in your Clerk dashboard:
   - Go to Clerk Dashboard > Webhooks
   - Add a new endpoint with your ngrok URL (e.g., `https://your-ngrok-url.ngrok.io/api/auth/webhook`)
   - Select events like `user.created` and `user.updated`

3. Trigger webhook events:
   - Create a new user in your application
   - Update a user's profile

4. Check your server logs to verify webhook processing

## Role-Based Access Testing

### 1. Create Test Users with Different Roles

Create three users in your Clerk dashboard:
- Doctor: doctor@hospital.com
- Nurse: nurse@hospital.com
- Patient: patient@example.com

### 2. Test Role-Based Access Control

For each user type, test accessing the following endpoints:

#### Doctor Role
```bash
# Get all patients (should succeed)
curl -H "Authorization: Bearer DOCTOR_TOKEN" http://localhost:3000/api/fhir/Patient

# Create a questionnaire (should succeed)
curl -X POST -H "Authorization: Bearer DOCTOR_TOKEN" -H "Content-Type: application/json" -d '{"status":"active","title":"Test Questionnaire","item":[]}' http://localhost:3000/api/fhir/Questionnaire
```

#### Nurse Role
```bash
# Get all patients (should succeed)
curl -H "Authorization: Bearer NURSE_TOKEN" http://localhost:3000/api/fhir/Patient

# Create a questionnaire (should fail with 403)
curl -X POST -H "Authorization: Bearer NURSE_TOKEN" -H "Content-Type: application/json" -d '{"status":"active","title":"Test Questionnaire","item":[]}' http://localhost:3000/api/fhir/Questionnaire
```

#### Patient Role
```bash
# Get all patients (should fail with 403)
curl -H "Authorization: Bearer PATIENT_TOKEN" http://localhost:3000/api/fhir/Patient

# Get own patient record (should succeed)
curl -H "Authorization: Bearer PATIENT_TOKEN" http://localhost:3000/api/fhir/Patient/PATIENT_ID
```

## Automated Testing

Run the test script to automatically test API endpoints:

```bash
node src/scripts/test-api.js
```

This script will test authentication, questionnaires, patients, and analytics endpoints.

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

If you're getting 401 Unauthorized errors:
- Verify your Clerk token is valid and not expired
- Check that `CLERK_SECRET_KEY` is correctly set in your environment
- Ensure the token is being sent in the Authorization header correctly

#### 2. Role-Based Access Issues

If you're getting 403 Forbidden errors:
- Check that the user has the correct role in Clerk's public metadata
- Verify the `restrictTo` middleware is correctly configured
- Check server logs for any role determination issues

#### 3. Webhook Processing Failures

If webhooks aren't being processed:
- Verify the webhook URL is correctly configured in Clerk dashboard
- Check that your server is accessible from the internet (if using ngrok)
- Ensure `CLERK_WEBHOOK_SECRET` is correctly set for signature verification
- Check server logs for webhook processing errors

#### 4. Database Connection Issues

If you're experiencing database-related errors:
- Verify MongoDB is running and accessible
- Check that `MONGO_URI` is correctly set in your environment
- Look for connection errors in the server logs

### Debugging

To enable more detailed logging:

```bash
# Run with debug logging
DEBUG=clerk* npm run dev
```

This will show detailed Clerk authentication logs to help diagnose issues.

## Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
