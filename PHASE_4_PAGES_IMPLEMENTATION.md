# Phase 4 Pages Implementation Plan
## Grade Translation & Reporting Layer

**Feature**: Phase 4 Grade Translation & Reporting Layer  
**Phase**: 4 - Translation Layer  
**Created**: 2024

## Overview

This document describes the Next.js page routes and implementation plan for Phase 4 Grade Translation & Reporting Layer. All pages operate as a read-only consumer of Phase 2/3 learning data and never modify learning tables.

---

## Route Structure

All Phase 4 pages are under `/sis/phase4` route prefix:

- `/sis/phase4/policies` - Grade Policy Management (Admin)
- `/sis/phase4/scales` - Grading Scale Management (Admin)
- `/sis/phase4/grade-entry` - Manual Grade Entry (Teacher)
- `/sis/phase4/review` - Grade Review & Finalization (Admin)
- `/sis/phase4/reports` - Report Generation (Admin/Registrar)

---

## Page Specifications

### 1. `/sis/phase4/policies` - Grade Policy Management

**Who Uses**: Principal, Admin

**Purpose**: Create and manage grade policies that define how learning evidence translates to grades.

**Data Reads**:
- `grade_policies` (filtered by `organization_id`, optionally `school_id`)
- `programs` (for program-scoped policies)
- `schools` (for school-scoped policies)

**Data Writes**:
- `grade_policies` (CREATE, UPDATE via `archived_at` soft delete)
- Never writes to Phase 2 or Phase 3 tables

**Key Features**:
- List all active policies for organization/school
- Create new policy (policy_type: 'letter_grade', 'descriptor', 'pass_fail' only)
- Edit existing policy
- Archive policy (soft delete via `archived_at`)
- View policy details and associated grading scales

**UI Requirements**:
- Policy type selector (letter_grade, descriptor, pass_fail only - no numeric option)
- Effective date range picker
- Program/school scoping selector (optional)
- Policy description editor

**Validation**:
- Policy name must be unique within organization (where `archived_at IS NULL`)
- Policy type must be one of allowed values (no numeric)
- Effective dates must be valid (end_date > start_date if both provided)

---

### 2. `/sis/phase4/scales` - Grading Scale Management

**Who Uses**: Principal, Admin

**Purpose**: Define grade values within a policy (e.g., A, B, C, D, F or "Exceeds Expectations", etc.).

**Data Reads**:
- `grading_scales` (filtered by `grade_policy_id`, `organization_id`)
- `grade_policies` (to show which policy scales belong to)

**Data Writes**:
- `grading_scales` (CREATE, UPDATE via `archived_at` soft delete)
- Never writes to Phase 2 or Phase 3 tables

**Key Features**:
- List all scales for a selected policy
- Create new scale (grade_value, description, is_passing for pass/fail)
- Edit existing scale
- Archive scale (soft delete)
- Reorder scales (display_order for UI only, no computation)

**UI Requirements**:
- Policy selector (filter scales by policy)
- Grade value input (text only, no numeric)
- Description editor
- Is passing checkbox (for pass/fail policies)
- Display order input (UI ordering only)

**Validation**:
- Grade value must be unique within policy (where `archived_at IS NULL`)
- Grade value cannot be empty
- Display order is informational only (no computation)

---

### 3. `/sis/phase4/grade-entry` - Manual Grade Entry

**Who Uses**: Teacher, Mentor, Admin

**Purpose**: Create and edit grade records manually. Teachers enter grades based on their judgment of learning evidence.

**Data Reads**:
- `student_grades` (filtered by `created_by` for teachers, all for admins)
- `students` (to select learner)
- `school_years` (to select time period)
- `grade_policies` (to select which policy to use)
- `grading_scales` (to select grade value)
- `observations` (read-only, for reference when creating grade_entries)
- `competencies` (read-only, for reference)
- `domains` (read-only, for reference)
- `experiences` (read-only, for context)

**Data Writes**:
- `student_grades` (CREATE, UPDATE)
- `grade_entries` (CREATE, UPDATE - optional detailed breakdown)
- `grade_justifications` (CREATE - when confirming/overriding)
- Never writes to Phase 2 or Phase 3 tables

**Key Features**:
- Create new grade draft
- Select student, school year, term period
- Select grade policy and grade value (from grading scales)
- Add grade entries (optional) that reference observations/competencies/domains
- Add notes explaining the translation
- Submit for confirmation (status: 'pending_confirmation')
- Edit draft grades
- View learning evidence (observations) as read-only context

**UI Requirements**:
- Student selector (filtered by organization/school)
- School year and term period selector
- Policy selector (shows available policies)
- Grade value selector (shows scales for selected policy)
- Notes editor
- Grade entries section (optional):
  - Add entry button
  - Entry type selector (observation_reference, competency_summary, domain_summary, manual_note)
  - Observation/competency/domain selector (read-only references)
  - Entry text editor
- Learning evidence viewer (read-only):
  - List observations for selected student/time period
  - Show competency levels, experiences, notes
  - No modification allowed
- Status indicator (draft, pending_confirmation, confirmed, overridden)
- Submit for confirmation button (requires justification text)

**Validation**:
- All required fields must be filled (student_id, school_year_id, term_period, grade_policy_id, grading_scale_id)
- Status cannot be 'confirmed' or 'overridden' without human confirmation action
- Grade entries can reference Phase 2 data but never modify it
- Justification text required when submitting for confirmation

**Read-Only Context**:
- Observations are displayed as read-only reference
- Teachers can see observations to inform their grade decision
- No ability to edit observations from this page
- No ability to create observations from this page

---

### 4. `/sis/phase4/review` - Grade Review & Finalization

**Who Uses**: Principal, Admin

**Purpose**: Review pending grades, confirm grades, override grades, and manage grade finalization.

**Data Reads**:
- `student_grades` (filtered by `status='pending_confirmation'` or all for review)
- `grade_entries` (to see detailed breakdown)
- `grade_justifications` (to see audit trail)
- `observations` (read-only, for context)
- `students` (to see learner info)
- `grade_policies` and `grading_scales` (to see policy context)

**Data Writes**:
- `student_grades` (UPDATE - confirm, override, return to draft)
- `grade_justifications` (CREATE - when confirming/overriding)
- Never writes to Phase 2 or Phase 3 tables

**Key Features**:
- List all pending grades (status: 'pending_confirmation')
- Review grade details, entries, and learning evidence
- Confirm grade (status: 'confirmed', requires justification)
- Override grade (status: 'overridden', requires override_reason)
- Return grade to draft (status: 'draft')
- View full audit trail (grade_justifications)
- View learning evidence (observations) as read-only context

**UI Requirements**:
- Pending grades list (filtered by status='pending_confirmation')
- Grade detail view:
  - Student info
  - Time period (school year, term)
  - Policy and grade value
  - Status
  - Notes
  - Grade entries (if any)
  - Learning evidence (read-only observations)
  - Audit trail (justifications)
- Action buttons:
  - Confirm (requires justification text)
  - Override (requires override_reason text and new grade selection)
  - Return to Draft
- Confirmation modal (requires justification text input)
- Override modal (requires override_reason text input and new grade selection)

**Validation**:
- Confirmation requires `confirmed_by` and `confirmed_at` to be set
- Confirmation requires justification text
- Override requires `override_reason` (cannot be empty)
- Override requires `override_by` and `override_at` to be set
- All actions create `grade_justification` records

**Read-Only Context**:
- Observations are displayed as read-only reference
- Admins can see observations to understand grade context
- No ability to edit observations from this page
- No ability to create observations from this page

---

### 5. `/sis/phase4/reports` - Report Generation

**Who Uses**: Principal, Admin, Registrar

**Purpose**: Generate report cards, transcripts, and compliance exports from confirmed grades.

**Data Reads**:
- `student_grades` (filtered by `status IN ('confirmed', 'overridden')` only)
- `transcript_records` (for finalized transcripts)
- `report_templates` (to select format)
- `students` (for student info)
- `school_years` (for time period info)
- `programs` (for program info)

**Data Writes**:
- `transcript_records` (CREATE from confirmed grades, UPDATE for finalization)
- Never writes to Phase 2 or Phase 3 tables

**Key Features**:
- Select report type (report_card, transcript, compliance_export)
- Select template (if multiple available)
- Select scope (student(s), school year, term period, program)
- Generate report (reads from confirmed grades only)
- Preview generated report
- Finalize transcript (transcript_status: 'finalized', requires human confirmation)
- Export report (PDF, CSV, etc.)
- Regenerate report (idempotent - can regenerate from current grades)

**UI Requirements**:
- Report type selector (report_card, transcript, compliance_export)
- Template selector (shows available templates for selected type)
- Scope selector:
  - Student selector (single or multiple)
  - School year selector
  - Term period selector
  - Program selector (optional)
- Generate button
- Preview panel (shows generated report)
- Finalize button (for transcripts only, requires confirmation)
- Export button (PDF, CSV, etc.)
- Regenerate button (regenerates from current confirmed grades)

**Validation**:
- Reports only read from `student_grades` where `status IN ('confirmed', 'overridden')`
- Draft grades are never included in reports
- Transcript finalization requires `finalized_by` and `finalized_at` to be set
- Transcript finalization requires human confirmation (cannot be automated)
- Reports can be regenerated (idempotent operation)

**Read-Only Operations**:
- Reports read from grade records only
- Reports never write back to learning data
- Reports never modify Phase 2 or Phase 3 tables
- Reports are snapshots that can be regenerated

---

## Student-Facing Pages

### 6. `/sis/phase4/my-grades` - Student Grade View

**Who Uses**: Student

**Purpose**: Students view their own finalized grades and transcripts.

**Data Reads**:
- `student_grades` (filtered by `student_id = current_student_id()` AND `status IN ('confirmed', 'overridden')`)
- `transcript_records` (filtered by `student_id = current_student_id()` AND `transcript_status = 'finalized'`)
- `grade_policies` and `grading_scales` (for context)
- `school_years` (for time period info)

**Data Writes**:
- None (read-only access)

**Key Features**:
- View own finalized grades only
- View own finalized transcripts only
- Filter by school year and term period
- View grade details (policy, grade value, term period)
- No ability to see draft or pending grades
- No ability to see grade entries or justifications (internal only)

**UI Requirements**:
- Grades list (filtered by student, finalized status only)
- Grade detail view (read-only)
- Transcript view (finalized only)
- School year and term period filters
- Export transcript button (if finalized)

**Validation**:
- Students can only see grades with `status IN ('confirmed', 'overridden')`
- Students can only see transcripts with `transcript_status = 'finalized'`
- Students cannot see draft, pending_confirmation, or internal records
- Students have no write access

---

## Data Flow Principles

### Read-Only Consumption of Phase 2/3

All Phase 4 pages that display learning evidence (observations, competencies, etc.) do so as **read-only references**:

1. **Display Only**: Observations are displayed for context but cannot be edited
2. **Reference Links**: Grade entries can reference observations but use `ON DELETE SET NULL`
3. **No Modification**: No ability to create, update, or delete Phase 2/3 records from Phase 4 pages
4. **No Foreign Keys**: No foreign keys from Phase 2/3 tables point to Phase 4 tables

### Human Confirmation Required

All grade finalization requires explicit human action:

1. **No Automation**: No background jobs or triggers can finalize grades
2. **Explicit Action**: Users must click "Confirm" or "Finalize" buttons
3. **Justification Required**: Confirmation and override require justification text
4. **Audit Trail**: All actions create `grade_justification` records

### Reversibility

All grades are reversible:

1. **Editable**: Confirmed grades can be edited (status can change back to 'draft')
2. **Audit Trail**: All changes create justification records
3. **No Data Loss**: Previous states are preserved in audit trail
4. **Withdrawal**: Grades can be withdrawn and reactivated

---

## Implementation Notes

### Route Protection

All routes must enforce:
- Organization-level access control (via RLS)
- School-level scoping (via `can_access_school()`)
- Role-based permissions (principal, admin, registrar, teacher, student)

### Data Fetching

- Use Supabase client with RLS enabled
- Filter by `organization_id` and optionally `school_id`
- Respect role-based access (teachers see own created, students see finalized only)
- Never bypass RLS (no service-role keys in client code)

### State Management

- Grade status changes require explicit user action
- Confirmation/override modals require justification text input
- Draft grades are saved immediately (no "save" button needed)
- Pending grades are visible to admins for review

### Error Handling

- Validation errors shown inline
- RLS violations return appropriate error messages
- Missing required fields prevent submission
- Confirmation/override without justification is blocked

---

## Phase Boundary Enforcement

### What Phase 4 Pages MUST NOT Do

- Modify Phase 2 tables (observations, competencies, domains, etc.)
- Modify Phase 3 tables (reflections, feedback)
- Auto-create grades from observations
- Auto-confirm grades
- Compute grades from observations
- Calculate averages, percentages, or GPA
- Rank students by grades
- Write back to learning data

### What Phase 4 Pages MUST Do

- Read Phase 2/3 data as read-only references
- Require human confirmation for all grade finalization
- Require justification text for confirmations and overrides
- Create audit trail for all grade actions
- Enforce student access to finalized grades only
- Preserve reversibility for all grades

---

## Validation Checklist

Before implementing pages, verify:

- [ ] All pages respect RLS policies
- [ ] No Phase 2/3 tables are modified
- [ ] All Phase 2/3 references are read-only
- [ ] Human confirmation is required for finalization
- [ ] Justification text is required for confirmations/overrides
- [ ] Students only see finalized grades
- [ ] Draft grades are never included in reports
- [ ] All grade actions create audit trail records
- [ ] Reports can be regenerated (idempotent)
- [ ] No numeric computation exists anywhere
- [ ] No automation of grade finalization

---

**End of Pages Implementation Plan**
