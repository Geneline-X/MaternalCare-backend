-- Seed FHIR data for PostgreSQL

-- Insert Organization
INSERT INTO organization (id, resource, name)
VALUES (
  'org123',
  '{
    "resourceType": "Organization",
    "id": "org123",
    "name": "PreSTrack Clinic",
    "address": [{"city": "Freetown", "country": "Sierra Leone"}]
  }',
  'PreSTrack Clinic'
) ON CONFLICT (id) DO NOTHING;

-- Insert Practitioner
INSERT INTO practitioner (id, resource, name, email)
VALUES (
  'prac123',
  '{
    "resourceType": "Practitioner",
    "id": "prac123",
    "identifier": [{"system": "http://prestack.com/email", "value": "toby@gmail.com"}],
    "name": [{"given": ["Toby"], "family": "Wales"}],
    "telecom": [{"system": "email", "value": "toby@gmail.com"}]
  }',
  'Toby Wales',
  'toby@gmail.com'
) ON CONFLICT (id) DO NOTHING;

-- Insert PractitionerRole
INSERT INTO practitioner_role (id, resource, practitioner_id, organization_id, role)
VALUES (
  'pr123',
  '{
    "resourceType": "PractitionerRole",
    "id": "pr123",
    "practitioner": {"reference": "Practitioner/prac123"},
    "organization": {"reference": "Organization/org123"},
    "code": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/practitioner-role", "code": "doctor"}]}]
  }',
  'prac123',
  'org123',
  'doctor'
) ON CONFLICT (id) DO NOTHING;

-- Insert Patient
INSERT INTO patient (id, resource)
VALUES (
  'pat123',
  '{
    "resourceType": "Patient",
    "id": "pat123",
    "identifier": [{"system": "http://prestack.com/email", "value": "patient@example.com"}],
    "name": [{"given": ["Aminata"], "family": "Sesay"}],
    "telecom": [
      {"system": "phone", "value": "+1234567890"},
      {"system": "email", "value": "patient@example.com"}
    ],
    "gender": "female",
    "birthDate": "1990-01-01"
  }'
) ON CONFLICT (id) DO NOTHING;

-- Insert Questionnaire
INSERT INTO questionnaire (id, resource)
VALUES (
  'pregnancy-patient-registration',
  '{
    "resourceType": "Questionnaire",
    "id": "pregnancy-patient-registration",
    "status": "active",
    "title": "Patient Registration Form",
    "item": [
      {"linkId": "firstName", "text": "First Name", "type": "string", "required": true},
      {"linkId": "lastName", "text": "Last Name", "type": "string", "required": true},
      {"linkId": "gender", "text": "Gender", "type": "choice", "required": true, "answerOption": [
        {"valueString": "Female"}, {"valueString": "Male"}
      ]},
      {"linkId": "birthDate", "text": "Date of Birth", "type": "date", "required": true},
      {"linkId": "district", "text": "District", "type": "choice", "required": true, "answerOption": [
        {"valueString": "Western Area Urban"}, {"valueString": "Western Area Rural"}, {"valueString": "Bo"}
      ]},
      {"linkId": "chiefdom", "text": "Chiefdom", "type": "choice", "required": false, "enableWhen": [
        {"question": "district", "operator": "=", "answerString": "Bo"}
      ], "answerOption": [
        {"valueString": "Badjia"}, {"valueString": "Bagbo"}, {"valueString": "Bagbwe"}
      ]},
      {"linkId": "pregnancyStatus", "text": "Are you pregnant?", "type": "boolean", "enableWhen": [
        {"question": "gender", "operator": "=", "answerString": "Female"}
      ]}
    ]
  }'
) ON CONFLICT (id) DO NOTHING;

-- Insert prenatal visit questionnaire
INSERT INTO questionnaire (id, resource)
VALUES (
  'prenatal-visit',
  '{
    "resourceType": "Questionnaire",
    "id": "prenatal-visit",
    "status": "active",
    "title": "Prenatal Visit Form",
    "item": [
      {"linkId": "weight", "text": "Weight (kg)", "type": "decimal", "required": true},
      {"linkId": "systolicBP", "text": "Systolic Blood Pressure (mmHg)", "type": "integer", "required": true},
      {"linkId": "diastolicBP", "text": "Diastolic Blood Pressure (mmHg)", "type": "integer", "required": true},
      {"linkId": "fetalHeartRate", "text": "Fetal Heart Rate (bpm)", "type": "integer", "required": true},
      {"linkId": "symptoms", "text": "Any symptoms?", "type": "text", "required": false},
      {"linkId": "nextVisit", "text": "Next Visit Date", "type": "date", "required": true}
    ]
  }'
) ON CONFLICT (id) DO NOTHING;
