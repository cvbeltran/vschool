# Phase 4 Pages Overview
## Grade Translation & Reporting Layer

**Feature**: Phase 4 Grade Translation & Reporting Layer  
**Phase**: 4 - Translation Layer  
**Created**: 2024

## Overview

This document provides an overview of all Phase 4 Next.js pages and their implementation. All pages operate as read-only consumers of Phase 2/3 learning data and never modify learning tables.

---

## Routes

All Phase 4 pages are under `/sis/phase4` route prefix:

1. `/sis/phase4/policies` - Grade Policy Management
2. `/sis/phase4/scales` - Grading Scale Management
3. `/sis/phase4/grade-entry` - Manual Grade Entry
4. `/sis/phase4/review` - Grade Review & Finalization
5. `/sis/phase4/reports` - Report Generation
6. `/sis/phase4/my-reports` - Student Grade View (Read-Only)

---

## Page Details

### 1. `/sis/phase4/policies` - Grade Policy Management

**File**: `src/app/sis/phase4/policies/page.tsx`

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

**Components Used**:
- `GradePolicyForm` (`src/components/phase4/grade-policy-form.tsx`)

---

### 2. `/sis/phase4/scales` - Grading Scale Management

**File**: `src/app/sis/phase4/scales/page.tsx`

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

**Components Used**:
- `GradingScaleForm` (`src/components/phase4/grading-scale-form.tsx`)

---

### 3. `/sis/phase4/grade-entry` - Manual Grade Entry

**File**: `src/app/sis/phase4/grade-entry/page.tsx`

**Who Uses**: Teacher, Admin

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

**Components Used**:
- `GradeEntryEditor` (`src/components/phase4/grade-entry-editor.tsx`)
- `GradeJustificationEditor` (`src/components/phase4/grade-justification-editor.tsx`)

**Read-Only Context**:
- Observations are displayed as read-only reference
- Teachers can see observations to inform their grade decision
- No ability to edit observations from this page
- No ability to create observations from this page

---

### 4. `/sis/phase4/review` - Grade Review & Finalization

**File**: `src/app/sis/phase4/review/page.tsx`

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

**Components Used**:
- `GradeFinalizePanel` (`src/components/phase4/grade-finalize-panel.tsx`)

**Read-Only Context**:
- Observations are displayed as read-only reference
- Admins can see observations to understand grade context
- No ability to edit observations from this page
- No ability to create observations from this page

---

### 5. `/sis/phase4/reports` - Report Generation

**File**: `src/app/sis/phase4/reports/page.tsx`

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

**Components Used**:
- `TranscriptGeneratorPanel` (`src/components/phase4/transcript-generator-panel.tsx`)

**Read-Only Operations**:
- Reports read from grade records only
- Reports never write back to learning data
- Reports never modify Phase 2 or Phase 3 tables
- Reports are snapshots that can be regenerated

---

### 6. `/sis/phase4/my-reports` - Student Grade View

**File**: `src/app/sis/phase4/my-reports/page.tsx`

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

**Validation**:
- Students can only see grades with `status IN ('confirmed', 'overridden')`
- Students can only see transcripts with `transcript_status = 'finalized'`
- Students cannot see draft, pending_confirmation, or internal records
- Students have no write access

---

## Data Access Modules

### `src/lib/phase4/policies.ts`

Functions for managing grade policies and grading scales:
- `listGradePolicies()`
- `createGradePolicy()`
- `updateGradePolicy()`
- `archiveGradePolicy()`
- `listGradingScales()`
- `createGradingScale()`
- `updateGradingScale()`
- `archiveGradingScale()`

### `src/lib/phase4/grades.ts`

Functions for managing student grades, entries, and justifications:
- `listStudentGrades()`
- `createStudentGradeHeader()`
- `updateStudentGradeHeader()`
- `finalizeStudentGrade()`
- `overrideGradeEntry()`
- `listGradeEntries()`
- `addGradeEntry()`
- `updateGradeEntry()`
- `archiveGradeEntry()`
- `listGradeJustifications()`
- `addJustification()`

### `src/lib/phase4/reports.ts`

Functions for managing reports and transcripts:
- `listReportTemplates()`
- `getReportTemplate()`
- `listTranscriptRecords()`
- `getTranscriptRecord()`
- `generateTranscriptRecordFromConfirmedGrades()`
- `finalizeTranscriptRecord()`

---

## Reusable Components

### `src/components/phase4/grade-policy-form.tsx`

Form component for creating/editing grade policies.

**Props**:
- `policy`: GradePolicy | null (for editing)
- `onSubmit`: Function to handle form submission
- `onCancel`: Function to handle cancellation
- `isSubmitting`: Boolean loading state
- `organizationId`: string | null

### `src/components/phase4/grading-scale-form.tsx`

Form component for creating/editing grading scales.

**Props**:
- `scale`: GradingScale | null (for editing)
- `policyType`: "letter_grade" | "descriptor" | "pass_fail"
- `onSubmit`: Function to handle form submission
- `onCancel`: Function to handle cancellation
- `isSubmitting`: Boolean loading state

### `src/components/phase4/grade-entry-editor.tsx`

Editor component for managing grade entries and viewing learning evidence.

**Props**:
- `grade`: StudentGrade
- `gradeEntries`: GradeEntry[]
- `observations`: any[] (read-only)
- `scales`: Array of grading scales
- `organizationId`: string | null
- `currentProfileId`: string | null
- `onGradeUpdate`: Function to handle grade updates
- `onEntriesUpdate`: Function to refresh entries

### `src/components/phase4/grade-justification-editor.tsx`

Form component for adding grade entries/justifications.

**Props**:
- `observations`: any[] (for reference)
- `onSubmit`: Function to handle submission
- `onCancel`: Function to handle cancellation
- `isSubmitting`: Boolean loading state

### `src/components/phase4/grade-finalize-panel.tsx`

Panel component for reviewing and finalizing grades.

**Props**:
- `grade`: StudentGrade
- `onConfirm`: Function to confirm grade
- `onOverride`: Function to override grade
- `onCancel`: Function to handle cancellation
- `organizationId`: string | null

### `src/components/phase4/transcript-generator-panel.tsx`

Panel component for generating transcripts from confirmed grades.

**Props**:
- `onGenerate`: Function to generate transcript
- `onCancel`: Function to handle cancellation
- `organizationId`: string | null

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

## Sidebar Configuration

Phase 4 routes are added to the sidebar under "Grades & Reporting" section:

- Policies: `/sis/phase4/policies` (admin/principal)
- Scales: `/sis/phase4/scales` (admin/principal)
- Grade Entry: `/sis/phase4/grade-entry` (teacher + admin/principal)
- Review & Finalize: `/sis/phase4/review` (admin/principal)
- Reports: `/sis/phase4/reports` (admin/principal/registrar)

Student-facing route (`/sis/phase4/my-reports`) is accessible via direct navigation or can be added to student sidebar if needed.

---

## Validation Checklist

Before deploying, verify:

- [x] All pages respect RLS policies
- [x] No Phase 2/3 tables are modified
- [x] All Phase 2/3 references are read-only
- [x] Human confirmation is required for finalization
- [x] Justification text is required for confirmations/overrides
- [x] Students only see finalized grades
- [x] Draft grades are never included in reports
- [x] All grade actions create audit trail records
- [x] Reports can be regenerated (idempotent)
- [x] No numeric computation exists anywhere
- [x] No automation of grade finalization

---

**End of Phase 4 Pages Overview**
