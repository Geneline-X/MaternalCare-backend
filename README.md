# PreSTrack Backend API

A Node.js Express server with ES modules for the PreSTrack pregnancy service and tracking healthcare application.

## Key Features Implemented

### 1. Dynamic Forms
- FHIR Questionnaire and QuestionnaireResponse resources for patient registration and prenatal visits
- Dynamic form logic via `enableWhen` conditions (e.g., show pregnancy status if gender is female)
- Validation of form submissions against questionnaire schemas
- Automatic mapping of responses to FHIR resources (Patient, Observation, CarePlan)
- Support for standard codes (LOINC, SNOMED CT) for interoperability

### 2. Flagging High-Risk Cases
- Automatic detection of high-risk conditions:
  - Hypertension (BP > 140/90 mmHg)
  - Abnormal fetal heart rate (< 110 or > 160 bpm)
  - High-risk maternal age (< 18 or > 35)
- Creation of FHIR Flag resources with standard SNOMED CT codes
- Idempotency checks to prevent duplicate flags
- Notification triggers for newly detected high-risk conditions

### 3. Automated Notifications
- Email notifications via Nodemailer for high-risk flags and missed appointments
- Storage as FHIR Communication resources with proper references
- Synchronous notification delivery for simplicity
- Support for multiple recipients (doctors, nurses, patients)
- Audit trail of all notifications

### 4. SMS Submission
- Twilio integration for inbound/outbound SMS
- Patient identification via phone number matching with Patient.telecom
- Parsing of SMS content using regex patterns:
  - Weight measurements (e.g., "Weight 70 kg")
  - Blood pressure readings (e.g., "BP 120/80")
  - Visit confirmations (e.g., "Confirm visit")
- Mapping of SMS data to FHIR resources (Observation, Encounter)
- High-risk condition detection from SMS submissions

### 5. Analytics Endpoint for Real-Time Charts
- Data aggregation for Chart.js-compatible output
- Support for filtering by facility, date range, and patient
- Metrics include:
  - High-risk cases by type
  - Prenatal visits by month
  - Observations (weight, blood pressure, etc.) by month
- In-memory caching for performance
- Role-based access control (patients see only their own data)

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js        # MongoDB connection
│   ├── controllers/
│   │   ├── analyticsController.js
│   │   ├── authController.js
│   │   ├── carePlanController.js
│   │   ├── communicationController.js
│   │   ├── encounterController.js
│   │   ├── flagController.js
│   │   ├── observationController.js
│   │   ├── patientController.js
│   │   ├── questionnaireController.js
│   │   ├── questionnaireResponseController.js
│   │   └── smsController.js
│   ├── middlewares/
│   │   ├── auth.js            # JWT authentication and role-based access
│   │   └── errorHandler.js    # Global error handling
│   ├── models/
│   │   ├── FhirStore.js       # Mock FHIR store
│   │   └── User.js            # User model for authentication
│   ├── routes/
│   │   ├── analyticsRoutes.js # Analytics endpoints
│   │   ├── authRoutes.js      # Authentication endpoints
│   │   ├── fhirRoutes.js      # FHIR resource endpoints
│   │   ├── index.js           # Route aggregation
│   │   └── smsRoutes.js       # SMS endpoints
│   ├── scripts/               # Database scripts and utilities
│   │   ├── check-missed-appointments.js
│   │   ├── create-fhir-tables.sql
│   │   ├── seed-database.js
│   │   ├── seed-fhir-data.sql
│   │   └── test-api.js
│   ├── services/
│   │   ├── fhirService.js     # FHIR mapping logic
│   │   ├── flagService.js     # High-risk condition detection
│   │   ├── notificationService.js # Email notifications
│   │   └── smsService.js      # Twilio SMS handling
│   └── server.js              # Main server file
├── .env.template              # Environment variables template
├── Dockerfile                 # Docker configuration
└── package.json               # Dependencies and scripts
```

## Authentication

The implementation uses Keycloak OAuth 2.0 with the Authorization Code Grant flow:

- `/api/auth/login` redirects to Keycloak's login page
- `/api/auth/callback` exchanges the code for a JWT token
- JWT contains user details (`id`, `email`, `role`, `facilityId`)
- JWT validation middleware checks signature and expiry
- Role-based access control via `restrictTo('doctor', 'nurse', 'patient')` middleware
- Patient data access restriction via `restrictToOwnData` middleware

Example JWT payload:
```json
{
  "id": "prac123",
  "email": "toby@gmail.com",
  "role": "doctor",
  "facilityId": "org123",
  "exp": 1718505600
}

## FHIR Compliance

All resources follow FHIR R4 standards with proper references and standard codes:

### Resources Implemented

- `Questionnaire` - Define forms with items, enableWhen conditions
- `QuestionnaireResponse` - Store form submissions
- `Patient` - Store patient demographics
- `Observation` - Store clinical measurements
- `Flag` - Mark high-risk conditions
- `Communication` - Log notifications and SMS
- `CarePlan` - Schedule prenatal visits
- `Encounter` - Record patient visits
- `Practitioner` - Store healthcare provider details
- `PractitionerRole` - Define provider roles
- `Organization` - Store facility information


### Standard Codes

- LOINC codes for observations:

- `82810-3` - Pregnancy status
- `55284-4` - Blood pressure
- `29463-7` - Body weight
- `8867-4` - Heart rate



- SNOMED CT codes for conditions:

- `77386006` - Pregnant
- `38341003` - Hypertension
- `364612004` - Abnormal fetal heart rate
- `134441001` - Teenage pregnancy
- `127364007` - Elderly primigravida



## Security

- JWT validation for all protected endpoints
- Role-based access control:

- `doctor` - Full access to all resources
- `nurse` - Read/write access to most resources, no delete
- `patient` - Read/write access to own data only



- Patients restricted to their own data via `restrictToOwnData` middleware
- Phone number validation for SMS interactions
- Input sanitization for SMS parsing
- Password hashing with bcrypt
- Error handling that doesn't expose sensitive information


## Testing and Deployment

### Testing

- Sample scripts for testing API endpoints in `src/scripts/test-api.js`
- Database seeding scripts for development and testing
- Validation of all inputs before processing


### Deployment

- Docker configuration for containerized deployment
- Environment variable templates for configuration
- Compatible with Render hosting platform
- Scalable architecture with separation of concerns


## How to Use

### 1. Setup Environment Variables

Copy `.env.template` to `.env` and fill in your credentials:

```
MONGO_URI=mongodb://localhost:27017/prestrack
JWT_SECRET=your-jwt-secret
OAUTH_AUTH_URL=https://<keycloak-url>/realms/PreSTrack/protocol/openid-connect/auth
OAUTH_TOKEN_URL=https://<keycloak-url>/realms/PreSTrack/protocol/openid-connect/token
OAUTH_CLIENT_ID=prestrack-client
OAUTH_CLIENT_SECRET=<keycloak-client-secret>
OAUTH_CALLBACK_URL=https://staging-prestack.onrender.com/api/auth/callback
TWILIO_ACCOUNT_SID=<twilio-sid>
TWILIO_AUTH_TOKEN=<twilio-token>
TWILIO_PHONE_NUMBER=<twilio-number>
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<your-email>
EMAIL_PASS=<your-app-password>
PORT=3000
```

2. Install Dependencies
```
npm install
```

3. Seed the Database
```
npm run seed-database
```

4. Run the Server
```
npm start
```
For development with auto-reload:
```
npm run dev
```

5. Test the API
```
npm run test-api
```
6. Deploy with Docker
```
docker build -t prestrack-backend .
docker run -p 3000:3000 --env-file .env prestrack-backend
```

### Sample API Requests

#### Authentication
# Login (redirects to Keycloak)
```
curl -L http://localhost:3000/api/auth/login
```
# Get profile (with JWT)
```
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3000/api/auth/profile
```

#### FHIR Resources

##### Questionnaires
# Get all questionnaires
```
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3000/api/fhir/Questionnaire
```
# Get specific questionnaire
```
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3000/api/fhir/Questionnaire/pregnancy-patient-registration
```
# Create questionnaire (doctor only)
```
curl -X POST -H "Authorization: Bearer <jwt-token>" -H "Content-Type: application/json" -d '{
  "resourceType": "Questionnaire",
  "status": "active",
  "title": "Postpartum Checkup",
  "item": [
    {"linkId": "weight", "text": "Weight (kg)", "type": "decimal", "required": true},
    {"linkId": "bp", "text": "Blood Pressure", "type": "string", "required": true},
    {"linkId": "concerns", "text": "Any concerns?", "type": "text"}
  ]
}' http://localhost:3000/api/fhir/Questionnaire
QuestionnaireResponses
# Submit questionnaire response
curl -X POST -H "Authorization: Bearer <jwt-token>" -H "Content-Type: application/json" -d '{
  "resourceType": "QuestionnaireResponse",
  "questionnaire": "Questionnaire/pregnancy-patient-registration",
  "status": "completed",
  "subject": { "reference": "Patient/pat123" },
  "item": [
    { "linkId": "firstName", "answer": [{ "valueString": "Aminata" }] },
    { "linkId": "lastName", "answer": [{ "valueString": "Sesay" }] },
    { "linkId": "gender", "answer": [{ "valueString": "Female" }] },
    { "linkId": "birthDate", "answer": [{ "valueDate": "1990-01-01" }] },
    { "linkId": "district", "answer": [{ "valueString": "Western Area Urban" }] },
    { "linkId": "pregnancyStatus", "answer": [{ "valueBoolean": true }] }
  ]
}' http://localhost:3000/api/fhir/QuestionnaireResponse
```

##### Observations
# Create observation
```
curl -X POST -H "Authorization: Bearer <jwt-token>" -H "Content-Type: application/json" -d '{
  "resourceType": "Observation",
  "status": "final",
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "29463-7",
        "display": "Body Weight"
      }
    ]
  },
  "subject": { "reference": "Patient/pat123" },
  "valueQuantity": {
    "value": 65,
    "unit": "kg",
    "system": "http://unitsofmeasure.org",
    "code": "kg"
  }
}' http://localhost:3000/api/fhir/Observation
```

##### Flags
# Get flags for a patient
```
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3000/api/fhir/Flag?subject=Patient/pat123
```
# Create a flag
```
curl -X POST -H "Authorization: Bearer <jwt-token>" -H "Content-Type: application/json" -d '{
  "resourceType": "Flag",
  "status": "active",
  "code": {
    "coding": [
      {
        "system": "http://snomed.info/sct",
        "code": "38341003",
        "display": "Hypertension"
      }
    ]
  },
  "subject": { "reference": "Patient/pat123" }
}' http://localhost:3000/api/fhir/Flag
```

##### SMS
# Simulate inbound SMS
```
curl -X POST -H "Content-Type: application/json" -d '{
  "From": "+1234567890",
  "Body": "Weight 70 kg"
}' http://localhost:3000/api/sms/inbound
```
# Send outbound SMS
```
curl -X POST -H "Authorization: Bearer <jwt-token>" -H "Content-Type: application/json" -d '{
  "patientId": "pat123",
  "message": "Your next appointment is scheduled for tomorrow"
}' http://localhost:3000/api/sms/outbound
```

##### Analytics
# Get pregnancy analytics
```
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3000/api/analytics/pregnancy
```
# Get analytics with filters
```
curl -H "Authorization: Bearer <jwt-token>" http://localhost:3000/api/analytics/pregnancy?facilityId=org123&startDate=2025-01-01&endDate=2025-06-30
```

### License
MIT



### To configure the generation, complete these steps:
``` 
<StepsCard steps={[{type: "add-env-var", stepName: "EMAIL_HOST"},{type: "add-env-var", stepName: "EMAIL_PORT"},{type: "add-env-var", stepName: "EMAIL_USER"},{type: "add-env-var", stepName: "EMAIL_PASS"},{type: "add-env-var", stepName: "TWILIO_ACCOUNT_SID"},{type: "add-env-var", stepName: "TWILIO_AUTH_TOKEN"},{type: "add-env-var", stepName: "TWILIO_PHONE_NUMBER"},{type: "add-env-var", stepName: "API_URL"},{type: "run-script", stepName: "src/scripts/seed-database.js"},{type: "run-script", stepName: "src/scripts/create-fhir-tables.sql"},{type: "run-script", stepName: "src/scripts/seed-fhir-data.sql"},{type: "run-script", stepName: "src/scripts/test-api.js"},{type: "run-script", stepName: "src/scripts/check-missed-appointments.js"}]} />
```
