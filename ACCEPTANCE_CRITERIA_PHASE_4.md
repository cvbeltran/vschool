# Acceptance Criteria
## Feature: Grade Translation & Reporting Layer (Phase 4)

---

## A. Grade Policy Definition

### A1. Grade Policy Creation
**Given** an Admin or Principal  
**When** they create a Grade Policy  
**Then** the Policy:
- has `policy_name`, `policy_type`, and optional `description`
- `policy_type` must be one of: 'letter_grade', 'descriptor', 'pass_fail' (no numeric)
- is scoped to organization (and optionally school/program)
- contains no computation fields
- defines translation rules only (not automatic application)

**And** the system does not auto-apply policies to learners.

---

### A2. Grading Scale Creation
**Given** a Grade Policy exists  
**When** an Admin creates Grading Scales  
**Then** each Scale:
- belongs to exactly one Policy
- has `grade_value` and optional `description`
- contains no computation logic
- contains no numeric computation fields

**And** scales define grade values only (no computation).

---

## B. Grade Records (Translation Layer)

### B1. Grade Creation (Human Action Required)
**Given** a Teacher or Admin  
**When** they create a Student Grade  
**Then** the Grade:
- requires explicit human action (cannot be auto-created)
- requires `student_id`, `school_year_id`, `term_period`, `grade_policy_id`, `grading_scale_id`
- has `status` of 'draft', 'pending_confirmation', 'confirmed', or 'overridden'
- may optionally reference Observations via `grade_entries` (read-only reference)
- contains no computed fields
- contains no numeric computation fields

**And** the system does not compute grades from observations automatically.

**And** the system does not suggest or auto-populate grade values.

---

### B2. Grade Confirmation Requirement
**Given** a Student Grade with `status='draft'` or `status='pending_confirmation'`  
**When** a user attempts to finalize it  
**Then**:
- `status` must change to 'confirmed' via explicit human action
- `confirmed_by` and `confirmed_at` must be set
- a `grade_justification` record must be created with `justification_type='confirmation'`
- `justification_text` must be provided (required)

**And** grades cannot be used in reports until `status='confirmed'` or `status='overridden'`.

**And** confirmation cannot be automated or triggered by system events.

---

### B3. Grade Override Requirement
**Given** a confirmed Student Grade  
**When** a user overrides it  
**Then**:
- `status` must change to 'overridden' via explicit human action
- `override_reason` must be provided (required, cannot be empty)
- `override_by` and `override_at` must be set
- a `grade_justification` record must be created with `justification_type='override'` and `justification_text` containing the reason

**And** all overrides are auditable and reversible.

**And** override cannot occur without explicit human action and justification.

---

### B4. Grade Reversibility
**Given** any Student Grade  
**When** a user edits it  
**Then**:
- all fields are editable (including `status`, `grading_scale_id`)
- editing a confirmed grade creates a new `grade_justification` record
- no downstream recalculation occurs (grades are independent)
- historical state is preserved via `grade_justifications`
- previous grade values are preserved in justification records

**And** grades remain editable after confirmation (with audit trail).

**And** withdrawn grades can be reactivated.

---

### B5. Grade Entry References (Read-Only)
**Given** a Student Grade  
**When** Grade Entries reference Phase 2 data  
**Then**:
- `observation_id` references `observations` (read-only, `ON DELETE SET NULL`)
- `competency_id` references `competencies` (read-only, `ON DELETE SET NULL`)
- `domain_id` references `domains` (read-only, `ON DELETE SET NULL`)
- no Phase 2 tables are modified
- if referenced observation/competency/domain is deleted, entry remains but reference becomes NULL

**And** Phase 2 data is never modified by Phase 4.

**And** Phase 3 data (reflections/feedback) may be referenced read-only but never modified.

---

## C. Reporting & Exports

### C1. Report Generation (Read-Only from Grades)
**Given** confirmed Student Grades exist  
**When** a user generates a Report Card or Transcript  
**Then**:
- report reads from `student_grades` where `status IN ('confirmed', 'overridden')` only
- report uses `report_templates` for format
- report never writes back into learning data
- report never modifies Phase 2 or Phase 3 tables
- report can be regenerated (idempotent)

**And** reports are snapshots that can be regenerated from grade records.

**And** draft grades are never included in reports.

---

### C2. Transcript Finalization
**Given** Transcript Records exist  
**When** a user finalizes a Transcript  
**Then**:
- `transcript_status` must change to 'finalized' via explicit human action
- `finalized_by` and `finalized_at` must be set
- transcript reads from confirmed grades only
- finalized transcripts can be exported
- finalization cannot be automated

**And** transcripts can be regenerated from grade records if needed.

**And** students only see finalized transcripts.

---

### C3. Compliance Export Placeholders
**Given** Report Templates with `template_type='compliance_export'`  
**When** generating compliance exports  
**Then**:
- exports read from transcript records only
- exports support DepEd/CHED format placeholders
- exports never modify learning data
- exports never modify Phase 2 or Phase 3 tables
- exports are reversible (can be regenerated)

**And** compliance exports are read-only outputs.

---

## D. Invariants — No Automatic Computation

### D1. No Auto-Grading
**Given** Observations exist  
**Then** the system must not:
- automatically compute grades from observations
- auto-average competency levels
- auto-assign grades based on policy
- rank learners automatically
- suggest grade values based on observations
- trigger grade creation from observation events

**And** all grades require explicit human creation and confirmation.

---

### D2. No Modification to Phase 2/3
**Given** Phase 4 is implemented  
**Then**:
- no Phase 2 tables are modified
- no Phase 3 tables are modified
- Phase 2/3 tables are referenced read-only only
- no foreign keys from Phase 2/3 tables point to Phase 4 tables
- no triggers on Phase 2/3 tables that write to Phase 4 tables

**And** Phase 4 operates as a separate translation layer.

---

### D3. Human Confirmation Required
**Given** any grade action  
**Then**:
- draft grades cannot be used in reports
- confirmation requires explicit human action (no automation)
- overrides require explicit justification (cannot be empty)
- all actions create audit trail records
- no background jobs can finalize grades

**And** no grade is final without human confirmation.

---

### D4. No Numeric Computation
**Given** any Phase 4 record  
**Then** the system must not:
- compute percentages from grades
- calculate GPA or averages
- aggregate grade values numerically
- rank students by numeric grade values
- perform any mathematical operations on grade values

**And** all grade values are qualitative (letter grades, descriptors, pass/fail).

**And** `credits` in transcript_records are informational only (no GPA computation).

---

## E. Reversibility & Auditability

### E1. Full Audit Trail
**Given** any Student Grade  
**Then**:
- all status changes create `grade_justification` records
- all overrides include `override_reason` (required)
- all confirmations record `confirmed_by` and `confirmed_at`
- historical state is preserved in `grade_justifications`
- previous grade values are preserved when grades change

**And** the complete history of a grade is auditable.

**And** all justification records are append-only (never deleted).

---

### E2. Grade Reversibility
**Given** a confirmed or overridden grade  
**When** a user needs to change it  
**Then**:
- grade can be edited (status can change back to 'draft')
- edit creates new `grade_justification` record
- previous state is preserved in audit trail
- no data is lost
- grade can be withdrawn and reactivated

**And** all grade changes are reversible with full audit trail.

---

## F. Student Access

### F1. Students See Only Finalized Grades
**Given** a Student  
**When** they view their grades  
**Then** they see:
- only grades with `status IN ('confirmed', 'overridden')`
- only finalized transcripts (`transcript_status='finalized'`)
- no draft or pending grades
- no grade entries or justifications (internal only)

**And** students never see draft or pending grades.

---

### F2. Students Cannot Modify Grades
**Given** a Student  
**When** they attempt to modify grades  
**Then**:
- they cannot create, update, or delete grades
- they cannot confirm or override grades
- they have read-only access to their own finalized grades

**And** students have no write access to grade records.

---

## G. Phase Boundary Enforcement

### G1. No Modification to Phase 2
**Given** Phase 4 is implemented  
**Then**:
- no Phase 2 tables are modified
- Phase 2 tables are referenced read-only only
- no foreign keys from Phase 2 tables point to Phase 4 tables
- no triggers on Phase 2 tables that write to Phase 4 tables

---

### G2. No Modification to Phase 3
**Given** Phase 4 is implemented  
**Then**:
- no Phase 3 tables are modified
- Phase 3 tables are referenced read-only only (optional)
- no foreign keys from Phase 3 tables point to Phase 4 tables
- no triggers on Phase 3 tables that write to Phase 4 tables

---

### G3. Translation Layer Only
**Given** any Phase 4 operation  
**Then**:
- Phase 4 reads from Phase 2/3 (read-only)
- Phase 4 creates its own records (grades, transcripts)
- Phase 4 never writes back to Phase 2/3
- Phase 4 is a separate translation layer

---

## H. Acceptance Gate

### H1. Phase 4 Pass Condition
Phase 4 Grade Translation & Reporting Layer is accepted **if and only if**:

- Grade policies can be defined (letter_grade, descriptor, pass_fail only)
- Grades can be created, confirmed, and overridden with full audit trail
- All grades require explicit human action (no automation)
- Overrides require mandatory justification text
- Reports can be generated from confirmed grades only
- Students see only finalized grades
- No numeric computation exists anywhere in Phase 4
- No Phase 2 or Phase 3 tables are modified
- All grades are reversible and auditable
- System functions across mixed programs and ages
- Learning data (Phase 2/3) remains pristine and untouched

---

## I. Explicit Prohibitions

### I1. Forbidden Operations
The following operations are **FORBIDDEN** in Phase 4:

- Automatic grade creation from observations
- Automatic grade confirmation
- Automatic grade computation or averaging
- Numeric grade computation (percent, GPA, averages)
- Ranking students by grades
- Writing back to Phase 2 or Phase 3 tables
- Modifying observations, competencies, or reflections
- Creating foreign keys from Phase 2/3 to Phase 4
- Background jobs that finalize grades
- Suggesting grade values based on observations

---

### I2. Required Operations
The following operations are **REQUIRED** in Phase 4:

- Human confirmation for all grade finalization
- Mandatory justification text for overrides
- Full audit trail for all grade actions
- Read-only references to Phase 2/3 data
- Reversibility for all grade changes
- Student access limited to finalized grades only
