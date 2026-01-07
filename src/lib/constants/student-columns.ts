/**
 * Student table column name constants
 * 
 * This file centralizes student column names to prevent schema drift.
 * All demographic fields that reference taxonomy_items use *_id suffix.
 * 
 * IMPORTANT: These are database column names, NOT taxonomy keys.
 * Taxonomy keys (used in taxonomies.key) are separate:
 * - Column: sex_id → Taxonomy key: "sex"
 * - Column: economic_status_id → Taxonomy key: "economic_status"
 * - Column: primary_language_id → Taxonomy key: "language"
 * - Column: guardian_relationship_id → Taxonomy key: "guardian_relationship"
 */

export const STUDENT_COLUMNS = {
  // Identity fields
  legalFirstName: "legal_first_name",
  legalLastName: "legal_last_name",
  preferredName: "preferred_name",
  dateOfBirth: "date_of_birth",
  sexId: "sex_id", // FK to taxonomy_items.id
  nationality: "nationality",
  studentNumber: "student_number",
  studentLrn: "student_lrn", // Learner Reference Number (LRN)
  status: "status", // FK to taxonomy_items.id (student_status)
  
  // Contact fields
  primaryEmail: "primary_email",
  phone: "phone",
  address: "address",
  emergencyContactName: "emergency_contact_name",
  emergencyContactPhone: "emergency_contact_phone",
  
  // Guardian fields
  guardianName: "guardian_name",
  guardianRelationshipId: "guardian_relationship_id", // FK to taxonomy_items.id
  guardianEmail: "guardian_email",
  guardianPhone: "guardian_phone",
  consentFlags: "consent_flags",
  
  // Demographics fields
  economicStatusId: "economic_status_id", // FK to taxonomy_items.id
  primaryLanguageId: "primary_language_id", // FK to taxonomy_items.id
  specialNeedsFlag: "special_needs_flag",
  
  // Education context fields
  previousSchool: "previous_school",
  entryType: "entry_type", // FK to taxonomy_items.id
  notes: "notes",
  
  // System fields
  admissionId: "admission_id",
  createdAt: "created_at",
  
  // Legacy fields (for backward compatibility)
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
} as const;

/**
 * Taxonomy key constants (used in taxonomies.key)
 * These are separate from column names and are used to fetch taxonomy items.
 */
export const TAXONOMY_KEYS = {
  sex: "sex",
  economicStatus: "economic_status",
  language: "language",
  guardianRelationship: "guardian_relationship",
  studentStatus: "student_status",
  entryType: "entry_type",
  attendanceStatus: "attendance_status",
} as const;

