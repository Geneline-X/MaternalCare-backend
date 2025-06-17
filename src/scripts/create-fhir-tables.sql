-- Create FHIR tables for PostgreSQL

-- Patient table
CREATE TABLE IF NOT EXISTS patient (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questionnaire table
CREATE TABLE IF NOT EXISTS questionnaire (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QuestionnaireResponse table
CREATE TABLE IF NOT EXISTS questionnaire_response (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  patient_id VARCHAR(64) REFERENCES patient(id),
  questionnaire_id VARCHAR(64) REFERENCES questionnaire(id),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Observation table
CREATE TABLE IF NOT EXISTS observation (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  patient_id VARCHAR(64) REFERENCES patient(id),
  code VARCHAR(64),
  value_quantity NUMERIC,
  value_string TEXT,
  value_boolean BOOLEAN,
  effective_date TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flag table
CREATE TABLE IF NOT EXISTS flag (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  patient_id VARCHAR(64) REFERENCES patient(id),
  code VARCHAR(64),
  status VARCHAR(20),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication table
CREATE TABLE IF NOT EXISTS communication (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  patient_id VARCHAR(64) REFERENCES patient(id),
  sender_type VARCHAR(20),
  sender_id VARCHAR(64),
  recipient_type VARCHAR(20),
  recipient_id VARCHAR(64),
  medium VARCHAR(20),
  sent_date TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CarePlan table
CREATE TABLE IF NOT EXISTS care_plan (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  patient_id VARCHAR(64) REFERENCES patient(id),
  status VARCHAR(20),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Encounter table
CREATE TABLE IF NOT EXISTS encounter (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  patient_id VARCHAR(64) REFERENCES patient(id),
  status VARCHAR(20),
  class VARCHAR(20),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Practitioner table
CREATE TABLE IF NOT EXISTS practitioner (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  name VARCHAR(100),
  email VARCHAR(100),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PractitionerRole table
CREATE TABLE IF NOT EXISTS practitioner_role (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  practitioner_id VARCHAR(64) REFERENCES practitioner(id),
  organization_id VARCHAR(64),
  role VARCHAR(20),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization table
CREATE TABLE IF NOT EXISTS organization (
  id VARCHAR(64) PRIMARY KEY,
  resource JSONB NOT NULL,
  name VARCHAR(100),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_resource ON patient USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_questionnaire_resource ON questionnaire USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_questionnaire_response_resource ON questionnaire_response USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_observation_resource ON observation USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_observation_code ON observation(code);
CREATE INDEX IF NOT EXISTS idx_observation_patient_id ON observation(patient_id);
CREATE INDEX IF NOT EXISTS idx_flag_resource ON flag USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_flag_patient_id ON flag(patient_id);
CREATE INDEX IF NOT EXISTS idx_communication_resource ON communication USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_communication_patient_id ON communication(patient_id);
CREATE INDEX IF NOT EXISTS idx_care_plan_resource ON care_plan USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_care_plan_patient_id ON care_plan(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounter_resource ON encounter USING GIN (resource);
CREATE INDEX IF NOT EXISTS idx_encounter_patient_id ON encounter(patient_id);
