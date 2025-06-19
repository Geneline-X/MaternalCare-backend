# Doctor Screens API Specifications

This document outlines the API specifications for integrating the doctor's screens in the maternal healthcare application. Each screen's components are listed, followed by the required API endpoints with request and response formats.

## Authentication
All endpoints require Clerk authentication via a JWT token in the `Authorization` header:
- `Authorization: Bearer YOUR_CLERK_TOKEN`
- Role-based access: Most endpoints require `role: doctor` in Clerk's `unsafeMetadata`.

## Screens and API Endpoints

### Dashboard
**File Path**: `app/(doctor)/dashboard.tsx`
**Description**: Main dashboard providing overview of patients, appointments, and analytics for doctors
**Components**:
- Doctor Profile Header: Displays doctor information and online status
- Notification Button: Shows unread notification count
- Search Bar: Global search with suggestions and real-time results
- Overview Cards: Display key metrics (total pregnancies, patients, high-risk cases, appointments)
- Quick Action Buttons: Navigate to add patient, add pregnancy, schedule visit
- Analytics Charts: Line chart for patient trends, bar chart for weekly visits
- Today's Schedule: List of appointments with patient details and status
- Search Results Modal: Displays filtered search results by type

#### API Endpoints for Dashboard

##### GET /api/fhir/dashboard/metrics
**Description**: Retrieve key dashboard metrics for overview cards
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    totalPregnancies: number;
    totalPatients: number;
    highRiskCases: number;
    scheduledAppointments: number;
    newPatientsThisMonth: number;
    completedPregnanciesThisMonth: number;
  };
  timestamp: string;
}
```
**Example**:
```json
// Response
{
  "success": true,
  "data": {
    "totalPregnancies": 47,
    "totalPatients": 124,
    "highRiskCases": 8,
    "scheduledAppointments": 23,
    "newPatientsThisMonth": 18,
    "completedPregnanciesThisMonth": 12
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

##### GET /api/fhir/dashboard/analytics
**Description**: Retrieve analytics data for dashboard charts
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `startDate`: string, optional, ISO date format
  - `endDate`: string, optional, ISO date format
  - `chartType`: string, optional, values: "trends" | "visits"
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    monthlyTrends: {
      labels: string[];
      datasets: Array<{
        data: number[];
        color?: (opacity?: number) => string;
        strokeWidth?: number;
      }>;
    };
    weeklyVisits: {
      labels: string[];
      datasets: Array<{
        data: number[];
        color?: (opacity?: number) => string;
      }>;
    };
  };
  timestamp: string;
}
```

##### GET /api/fhir/dashboard/schedule/today
**Description**: Retrieve today's appointment schedule
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    appointments: Array<{
      id: string;
      patientId: string;
      patientName: string;
      time: string;
      type: string;
      status: "confirmed" | "pending" | "cancelled";
      duration: number;
      notes?: string;
    }>;
  };
  timestamp: string;
}
```

##### GET /api/fhir/search
**Description**: Global search functionality for patients, appointments, and health data
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `q`: string, required, search query
  - `limit`: number, optional, default 10
  - `types`: string, optional, comma-separated values: "patient,appointment,health,form"
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    results: Array<{
      id: string;
      type: "patient" | "appointment" | "health" | "form";
      title: string;
      subtitle: string;
      category: string;
    }>;
    totalCount: number;
    searchTime: number;
  };
  timestamp: string;
}
```

### Add Patient
**File Path**: `app/(doctor)/add-patient.tsx`
**Description**: Form for registering new patients with personal and medical information
**Components**:
- Personal Information Form: First name, last name, email, phone, DOB, address inputs
- Emergency Contact Form: Contact name and phone inputs
- Medical Information Form: Blood type, insurance, medical history, allergies, medications inputs
- High Risk Toggle: Switch to mark patient as high-risk
- Form Validation: Error display for required fields
- Save/Cancel Buttons: Submit form or navigate back

#### API Endpoints for Add Patient

##### POST /api/fhir/Patient
**Description**: Create a new patient record
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
```typescript
{
  name: Array<{
    given: string[];
    family: string;
  }>;
  telecom: Array<{
    system: "phone" | "email";
    value: string;
  }>;
  gender: "male" | "female" | "other";
  birthDate: string; // ISO date format
  address?: Array<{
    line: string[];
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  medicalHistory?: string;
  allergies?: string;
  currentMedications?: string;
  isHighRisk: boolean;
  bloodType?: string;
  insurance?: string;
}
```
**Response**:
- **Status**: `201 Created`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    id: string;
    resourceType: "Patient";
    name: Array<{
      given: string[];
      family: string;
    }>;
    telecom: Array<{
      system: string;
      value: string;
    }>;
    gender: string;
    birthDate: string;
    meta: {
      lastUpdated: string;
      versionId: string;
    };
  };
  message: string;
  timestamp: string;
}
```
**Example**:
```json
// Request
{
  "name": [{"given": ["Sarah"], "family": "Johnson"}],
  "telecom": [
    {"system": "email", "value": "sarah.johnson@email.com"},
    {"system": "phone", "value": "+1-555-123-4567"}
  ],
  "gender": "female",
  "birthDate": "1995-03-15",
  "emergencyContact": {
    "name": "John Johnson",
    "relationship": "spouse",
    "phone": "+1-555-123-4568"
  },
  "isHighRisk": false,
  "bloodType": "O+"
}
// Response
{
  "success": true,
  "data": {
    "id": "patient-123",
    "resourceType": "Patient",
    "name": [{"given": ["Sarah"], "family": "Johnson"}],
    "telecom": [
      {"system": "email", "value": "sarah.johnson@email.com"},
      {"system": "phone", "value": "+1-555-123-4567"}
    ],
    "gender": "female",
    "birthDate": "1995-03-15",
    "meta": {
      "lastUpdated": "2024-01-15T10:30:00Z",
      "versionId": "1"
    }
  },
  "message": "Patient created successfully",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Add Pregnancy
**File Path**: `app/(doctor)/add-pregnancy.tsx`
**Description**: Form for creating pregnancy records linked to existing patients
**Components**:
- Patient Selection Modal: Searchable list of existing patients
- Risk Level Selection Modal: Low, medium, high risk options with color coding
- Pregnancy Details Form: LMP, due date, current week, complications inputs
- Health Status Form: Current symptoms, blood pressure, weight, height inputs
- Lifestyle Factors Toggles: Prenatal vitamins, smoking, alcohol consumption switches
- Notes Input: Additional observations text area
- Save/Cancel Buttons: Submit form or navigate back

#### API Endpoints for Add Pregnancy

##### GET /api/fhir/Patient
**Description**: Retrieve list of patients for selection modal
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `_page`: number, optional, default 1
  - `_count`: number, optional, default 20
  - `name`: string, optional, search by name
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

##### POST /api/fhir/pregnancy
**Description**: Create a new pregnancy record (EpisodeOfCare)
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
```typescript
{
  patientId: string;
  lastMenstrualPeriod: string; // ISO date format
  estimatedDueDate: string; // ISO date format
  currentWeek: number;
  riskLevel: "low" | "medium" | "high";
  complications?: string;
  previousPregnancies?: string;
  currentSymptoms?: string;
  bloodPressure?: string;
  weight?: number;
  height?: number;
  prenatalVitamins: boolean;
  smokingStatus: boolean;
  alcoholConsumption: boolean;
  notes?: string;
}
```
**Response**:
- **Status**: `201 Created`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    id: string;
    resourceType: "EpisodeOfCare";
    status: "active";
    patient: {
      reference: string;
    };
    period: {
      start: string;
      end?: string;
    };
    extension: Array<{
      url: string;
      valueString?: string;
      valueInteger?: number;
      valueBoolean?: boolean;
    }>;
    meta: {
      lastUpdated: string;
      versionId: string;
    };
  };
  message: string;
  timestamp: string;
}
```

### Schedule Visit
**File Path**: `app/(doctor)/schedule-visit.tsx`
**Description**: Form for scheduling patient appointments with various visit types
**Components**:
- Patient Selection Modal: List of patients with contact information
- Visit Type Selection Modal: Routine, ultrasound, follow-up, emergency, consultation options
- Time Slot Selection Modal: Available time slots in grid layout
- Date/Time Inputs: Date picker and time selector
- Location Input: Clinic room or video call location
- Notes Input: Additional instructions text area
- Schedule/Cancel Buttons: Create appointment or navigate back

#### API Endpoints for Schedule Visit

##### POST /api/fhir/Appointment
**Description**: Create a new appointment
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
```typescript
{
  status: "proposed" | "pending" | "booked";
  serviceType?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  }>;
  start: string; // ISO datetime
  end: string; // ISO datetime
  participant: Array<{
    actor: {
      reference: string; // Patient reference
    };
    status: "accepted" | "declined" | "tentative";
  }>;
  comment?: string;
  location?: string;
}
```
**Response**:
- **Status**: `201 Created`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    id: string;
    resourceType: "Appointment";
    status: string;
    start: string;
    end: string;
    participant: Array<{
      actor: {
        reference: string;
      };
      status: string;
    }>;
    meta: {
      lastUpdated: string;
      versionId: string;
    };
  };
  message: string;
  timestamp: string;
}
```

##### GET /api/fhir/schedule/availability
**Description**: Get available time slots for appointment scheduling
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `date`: string, required, ISO date format
  - `duration`: number, optional, appointment duration in minutes
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    date: string;
    timeSlots: Array<{
      time: string;
      available: boolean;
      duration: number;
      appointmentId?: string;
    }>;
  };
  timestamp: string;
}
```

### Patients
**File Path**: `app/(doctor)/patients.tsx`
**Description**: List view of all patients with summary information and navigation to patient details
**Components**:
- Patient Summary Cards: Total patients, high risk count, due soon count
- Patient List Items: Name, condition, age, phone, pregnancy week, risk level, last visit
- Risk Level Badges: Color-coded indicators for low/medium/high risk
- Add Patient Button: Navigate to add patient form
- Refresh Control: Pull-to-refresh functionality
- Patient Navigation: Tap to view patient details

#### API Endpoints for Patients

##### GET /api/fhir/Patient
**Description**: Retrieve paginated list of patients with pregnancy information
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `_page`: number, optional, default 1
  - `_count`: number, optional, default 20
  - `_include`: string, optional, "Patient:pregnancy" to include pregnancy data
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    condition: string;
    lastVisit: string;
    age: number;
    phone: string;
    pregnancyWeek?: number;
    riskLevel: "Low" | "Medium" | "High";
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

##### GET /api/fhir/patients/summary
**Description**: Get patient summary statistics
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    totalPatients: number;
    highRiskPatients: number;
    dueSoonPatients: number;
    newPatientsThisMonth: number;
  };
  timestamp: string;
}
```

### Health Monitoring
**File Path**: `app/(doctor)/health-monitoring.tsx`
**Description**: Monitor patient health metrics with alerts and trend analysis
**Components**:
- Summary Cards: Normal, low, high reading counts with icons
- Alert Trend Chart: Line chart showing weekly alert patterns
- Filter Buttons: All, high, low, normal status filters
- Health Metrics List: Patient name, metric type, value, status, trend, timestamp
- Status Badges: Color-coded indicators for health metric status
- Trend Icons: Visual indicators for increasing/decreasing/stable trends
- Action Buttons: Contact patient or review metric options for alerts

#### API Endpoints for Health Monitoring

##### GET /api/fhir/health-metrics
**Description**: Retrieve health metrics with filtering and pagination
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `status`: string, optional, values: "normal" | "high" | "low" | "critical"
  - `_page`: number, optional, default 1
  - `_count`: number, optional, default 20
  - `patientId`: string, optional, filter by specific patient
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  data: Array<{
    id: string;
    patientName: string;
    patientId: string;
    metric: "Blood Pressure" | "Fetal Heart Rate" | "Weight Gain" | "Glucose Level";
    value: string;
    unit: string;
    status: "normal" | "high" | "low" | "critical";
    timestamp: string;
    normalRange: string;
    trend: "increasing" | "decreasing" | "stable";
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

##### GET /api/fhir/health-metrics/summary
**Description**: Get health metrics summary for dashboard cards
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    normalCount: number;
    lowCount: number;
    highCount: number;
    criticalCount: number;
  };
  timestamp: string;
}
```

##### GET /api/fhir/health-metrics/trends
**Description**: Get weekly alert trends for chart display
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `weeks`: number, optional, default 7
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    labels: string[];
    datasets: Array<{
      data: number[];
      color: (opacity?: number) => string;
      strokeWidth: number;
    }>;
  };
  timestamp: string;
}
```

### Notifications
**File Path**: `app/(doctor)/notifications.tsx`
**Description**: Manage and send notifications with filtering and composition capabilities
**Components**:
- Notification List Items: Title, message, type icon, timestamp, patient name, read status
- Unread Badge: Count of unread notifications in header
- Search Bar: Filter notifications by content
- Filter Tabs: All, unread, high priority filters
- Mark All Read Button: Bulk action for unread notifications
- Compose Modal: Create new notifications with recipient, subject, message, priority, type
- Notification Types: Emergency, appointment, patient update, reminder, system icons
- Priority Levels: Low, medium, high selection buttons

#### API Endpoints for Notifications

##### GET /api/fhir/Communication
**Description**: Retrieve notifications with filtering and pagination
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `status`: string, optional, values: "read" | "unread"
  - `priority`: string, optional, values: "low" | "medium" | "high"
  - `_page`: number, optional, default 1
  - `_count`: number, optional, default 20
  - `search`: string, optional, search in title and message
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  data: Array<{
    id: string;
    title: string;
    message: string;
    type: "appointment" | "patient_update" | "emergency" | "reminder" | "system";
    timestamp: string;
    isRead: boolean;
    priority: "low" | "medium" | "high";
    patientName?: string;
    actionRequired?: boolean;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

##### POST /api/fhir/Communication
**Description**: Create and send a new notification
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
```typescript
{
  recipient: string; // Patient ID or doctor ID
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  type: "appointment" | "patient_update" | "reminder" | "general";
}
```
**Response**:
- **Status**: `201 Created`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    id: string;
    resourceType: "Communication";
    status: "completed";
    subject: {
      text: string;
    };
    payload: Array<{
      contentString: string;
    }>;
    sent: string;
    meta: {
      lastUpdated: string;
      versionId: string;
    };
  };
  message: string;
  timestamp: string;
}
```

##### PUT /api/fhir/Communication/{id}/read
**Description**: Mark notification as read
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  message: string;
  timestamp: string;
}
```

##### PUT /api/fhir/Communication/mark-all-read
**Description**: Mark all notifications as read
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    updatedCount: number;
  };
  message: string;
  timestamp: string;
}
```

### Dynamic Forms
**File Path**: `app/(doctor)/dynamic-form.tsx`
**Description**: Manage form templates for patient data collection
**Components**:
- Forms List Items: Title, description, completion stats
- Add Form Button: Navigate to form creation
- Delete Form Button: Remove form template
- Form Stats: Completed count and total sent metrics

#### API Endpoints for Dynamic Forms

### Create Form
**File Path**: `app/(doctor)/create.tsx`
**Description**: Screen for creating custom forms that can be sent to patients for data collection
**Components**:
- Form title and description inputs: Collect basic form metadata
- Category input: Optional categorization for form organization
- Field type selector modal: Choose from text, textarea, number, date, select, radio, checkbox, file upload
- Field editor components: Configure each field with label, placeholder, help text, validation rules
- Options manager: For select/radio/checkbox fields, manage available options
- Required field toggle: Mark fields as mandatory
- Patient selection modal: Choose which patients to send the form to
- Preview modal: Preview the form before publishing
- Action buttons: Save as draft, publish, or send to patients

#### API Endpoints for Create Form

##### POST /api/fhir/forms/templates
**Description**: Create a new form template (draft or published)
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
\`\`\`typescript
{
  title: string
  description: string
  category?: string
  status: "draft" | "active"
  fields: Array<{
    type: "text" | "textarea" | "number" | "date" | "select" | "radio" | "checkbox" | "file"
    label: string
    required: boolean
    placeholder?: string
    helpText?: string
    options?: string[] // For select/radio/checkbox fields
    validation?: {
      min?: number
      max?: number
      pattern?: string
      minLength?: number
      maxLength?: number
      customMessage?: string
    }
  }>
  version: string
}
\`\`\`
**Response**:
- **Status**: `201 Created`
- **Body**:
\`\`\`typescript
{
  success: true
  data: {
    id: string
    title: string
    description: string
    category?: string
    status: "draft" | "active"
    version: string
    fields: FormField[]
    createdBy: string
    createdAt: string
    updatedAt: string
    completedCount: number
    totalSent: number
  }
  message: "Form template created successfully"
}
\`\`\`
**Example**:
\`\`\`json
// Request
{
  "title": "Prenatal Nutrition Assessment",
  "description": "Weekly nutrition tracking for pregnant patients",
  "category": "Nutrition",
  "status": "active",
  "fields": [
    {
      "type": "text",
      "label": "Patient Name",
      "required": true,
      "placeholder": "Enter your full name"
    },
    {
      "type": "select",
      "label": "Prenatal Vitamin",
      "required": true,
      "options": ["Yes, daily", "Yes, occasionally", "No"],
      "helpText": "Are you taking prenatal vitamins?"
    }
  ],
  "version": "1.0"
}
// Response
{
  "success": true,
  "data": {
    "id": "form_123",
    "title": "Prenatal Nutrition Assessment",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
\`\`\`

##### POST /api/fhir/forms/send
**Description**: Send a published form to selected patients
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
\`\`\`typescript
{
  formId: string
  patientIds: string[]
  message?: string
  dueDate?: string
  priority?: "low" | "medium" | "high"
}
\`\`\`
**Response**:
- **Status**: `200 OK`
- **Body**:
\`\`\`typescript
{
  success: true
  data: {
    formId: string
    sentCount: number
    failedCount: number
    sentTo: Array<{
      patientId: string
      patientName: string
      status: "sent" | "failed"
      sentAt?: string
      error?: string
    }>
  }
  message: "Form sent successfully"
}
\`\`\`
**Example**:
\`\`\`json
// Request
{
  "formId": "form_123",
  "patientIds": ["patient_456", "patient_789"],
  "message": "Please complete this nutrition assessment by Friday",
  "dueDate": "2024-01-20T23:59:59Z",
  "priority": "medium"
}
// Response
{
  "success": true,
  "data": {
    "formId": "form_123",
    "sentCount": 2,
    "failedCount": 0,
    "sentTo": [
      {
        "patientId": "patient_456",
        "patientName": "Sarah Johnson",
        "status": "sent",
        "sentAt": "2024-01-15T10:35:00Z"
      }
    ]
  }
}
\`\`\`

##### GET /api/fhir/Patient
**Description**: Get list of patients for form distribution (used in patient selection modal)
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `_page`: number, optional (default: 1)
  - `_count`: number, optional (default: 20)
  - `search`: string, optional (search by name or email)
  - `active`: boolean, optional (filter active patients only)
**Response**:
- **Status**: `200 OK`
- **Body**:
\`\`\`typescript
{
  success: true
  data: Array<{
    id: string
    name: string
    email: string
    phone?: string
    dateOfBirth: string
    gender: string
    active: boolean
    lastVisit?: string
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
\`\`\`

##### PUT /api/fhir/forms/templates/{formId}
**Description**: Update an existing form template
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**: Same as POST /api/fhir/forms/templates
**Response**:
- **Status**: `200 OK`
- **Body**: Same as POST /api/fhir/forms/templates

##### DELETE /api/fhir/forms/templates/{formId}
**Description**: Delete a form template (only if no submissions exist)
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
\`\`\`typescript
{
  success: true
  message: "Form template deleted successfully"
}


##### GET /api/fhir/forms
**Description**: Retrieve list of form templates
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `status`: string, optional, values: "active" | "draft" | "archived"
  - `_page`: number, optional, default 1
  - `_count`: number, optional, default 20
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  data: Array<{
    id: string;
    title: string;
    description: string;
    version: string;
    status: "active" | "draft" | "archived";
    completedCount: number;
    totalSent: number;
    lastUpdated: string;
    createdBy: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

##### DELETE /api/fhir/forms/{id}
**Description**: Delete a form template
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  message: string;
  timestamp: string;
}
```

##### GET /api/fhir/forms/{id}
**Description**: Get specific form template details
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    id: string;
    title: string;
    description: string;
    version: string;
    status: "active" | "draft" | "archived";
    fields: Array<{
      id: string;
      type: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
      label: string;
      required: boolean;
      options?: string[];
    }>;
    completedCount: number;
    totalSent: number;
    lastUpdated: string;
    createdBy: string;
  };
  timestamp: string;
}
```

### Reports Analytics
**File Path**: `app/(doctor)/report-analytics.tsx`
**Description**: Generate comprehensive analytics reports with charts and export capabilities
**Components**:
- Time Period Filters: 1M, 3M, 6M, 1Y selection buttons
- Key Metrics Cards: Total patients, new patients, completed pregnancies, avg visits, satisfaction
- Chart Toggle: Trends, risk distribution, gestational age selection
- Analytics Charts: Line chart, pie chart, bar chart with different datasets
- Chart Insights: Percentage changes and key statistics
- Population Health Insights: Positive trends, concerns, recommendations cards
- Export Buttons: PDF report and CSV data export options

#### API Endpoints for Reports Analytics

##### GET /api/fhir/analytics/metrics
**Description**: Get key analytics metrics for dashboard cards
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `timeframe`: string, optional, values: "1month" | "3months" | "6months" | "1year"
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    totalPatients: number;
    newPatients: number;
    completedPregnancies: number;
    averageVisits: number;
    satisfactionScore: number;
  };
  timestamp: string;
}
```

##### GET /api/fhir/analytics/charts
**Description**: Get chart data for analytics visualization
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `chartType`: string, required, values: "trends" | "risk" | "age"
  - `timeframe`: string, optional, values: "1month" | "3months" | "6months" | "1year"
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    patientTrends?: {
      labels: string[];
      datasets: Array<{
        data: number[];
        color: (opacity?: number) => string;
        strokeWidth: number;
      }>;
    };
    riskDistribution?: Array<{
      name: string;
      population: number;
      color: string;
      legendFontColor: string;
      legendFontSize: number;
    }>;
    gestationalAge?: {
      labels: string[];
      datasets: Array<{
        data: number[];
        color: (opacity?: number) => string;
      }>;
    };
  };
  timestamp: string;
}
```

##### GET /api/fhir/analytics/insights
**Description**: Get population health insights and recommendations
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
- **Query Parameters**:
  - `timeframe`: string, optional, values: "1month" | "3months" | "6months" | "1year"
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: Array<{
    id: string;
    type: "positive" | "concern" | "recommendation";
    title: string;
    description: string;
    actionItems: string[];
  }>;
  timestamp: string;
}
```

##### POST /api/fhir/analytics/export
**Description**: Generate and export analytics report
**Request**:
- **Headers**:
  - `Authorization: Bearer YOUR_CLERK_TOKEN`
  - `Content-Type: application/json`
- **Body**:
```typescript
{
  format: "pdf" | "csv";
  includeCharts: boolean;
  includePatientData: boolean;
  includeHealthMetrics: boolean;
  dateRange: {
    start: string; // ISO date
    end: string; // ISO date
  };
}
```
**Response**:
- **Status**: `200 OK`
- **Body**:
```typescript
{
  success: boolean;
  data: {
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    expiresAt: string;
  };
  message: string;
  timestamp: string;
}
```

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing authentication token",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Insufficient permissions for this resource",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Resource not found",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 422 Validation Error
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Invalid request data",
  "details": {
    "field": "error message"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Rate Limiting

All endpoints are subject to rate limiting:
- **Rate Limit**: 1000 requests per hour per user
- **Headers**: 
  - `X-RateLimit-Limit`: Maximum requests per hour
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when rate limit resets

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again later.",
  "retryAfter": 3600,
  "timestamp": "2024-01-15T10:30:00Z"
}
```