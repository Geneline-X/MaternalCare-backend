# API Documentation

## Base URL
`http://your-domain.com/api`

## Authentication
All endpoints (except `/auth/*`) require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Table of Contents
1. [Authentication](#authentication-endpoints)
2. [Appointments](#appointment-endpoints)
3. [FHIR Resources](#fhir-endpoints)
4. [SMS](#sms-endpoints)
5. [Analytics](#analytics-endpoints)
6. [Mobile](#mobile-endpoints)

## Authentication Endpoints

### Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Description**: Authenticate user and get JWT token
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
- **Response**:
  ```json
  {
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "role": "patient|doctor|admin"
    }
  }
  ```

## Appointment Endpoints

### Get Doctor's Appointments
- **URL**: `/appointments/doctor/:doctorId`
- **Method**: `GET`
- **Query Params**:
  - `date` (optional): Filter by date (YYYY-MM-DD)
  - `status` (optional): Filter by status
- **Response**:
  ```json
  [
    {
      "id": "appointment_id",
      "patientName": "John Doe",
      "dateTime": "2025-06-20T10:00:00Z",
      "status": "booked",
      "gestationalWeek": 24
    }
  ]
  ```

### Create Appointment
- **URL**: `/appointments`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "patientId": "patient_id",
    "doctorId": "doctor_id",
    "dateTime": "2025-06-20T10:00:00Z",
    "reason": "Routine checkup"
  }
  ```
- **Response**:
  ```json
  {
    "id": "new_appointment_id",
    "status": "booked",
    "createdAt": "2025-06-16T15:30:00Z"
  }
  ```

## FHIR Endpoints

### Search Patients
- **URL**: `/fhir/Patient`
- **Method**: `GET`
- **Query Params**:
  - `name` (optional): Search by patient name
  - `birthdate` (optional): Filter by birthdate
- **Response**: FHIR Bundle of Patient resources

### Get Patient by ID
- **URL**: `/fhir/Patient/:id`
- **Method**: `GET`
- **Response**: FHIR Patient resource

## SMS Endpoints

### Send SMS
- **URL**: `/sms/send`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "to": "+1234567890",
    "message": "Your appointment is confirmed"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "messageId": "message_123"
  }
  ```

## Analytics Endpoints

### Get Appointments Analytics
- **URL**: `/analytics/appointments`
- **Method**: `GET`
- **Query Params**:
  - `startDate`: Start date (YYYY-MM-DD)
  - `endDate`: End date (YYYY-MM-DD)
  - `doctorId` (optional): Filter by doctor
- **Response**:
  ```json
  {
    "totalAppointments": 42,
    "completed": 35,
    "cancelled": 5,
    "noShow": 2,
    "byDay": [
      {"date": "2025-06-01", "count": 5},
      {"date": "2025-06-02", "count": 7}
    ]
  }
  ```

## Mobile Endpoints

### Get Mobile Dashboard
- **URL**: `/mobile/dashboard`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "upcomingAppointments": [
      {
        "id": "appt_123",
        "dateTime": "2025-06-20T10:00:00Z",
        "doctorName": "Dr. Smith",
        "specialty": "Obstetrics"
      }
    ],
    "unreadMessages": 3,
    "dueForms": ["Prenatal Form"]
  }
  ```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "No authorization token was found"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "The requested resource was not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting
- All endpoints are rate limited to 100 requests per minute per IP address.
- Authentication endpoints have a lower limit of 10 requests per minute.

## Versioning
- Current API version: v1
- Include the version in the Accept header: `Accept: application/vnd.yourapi.v1+json`

## Support
For any questions or issues, please contact support@example.com
