# Phase 4 Grade Translation & Reporting Layer Entity Schema Specification

**Feature**: Grade Translation & Reporting Layer  
**Phase**: 4 - Translation Layer  
**Created**: 2024

## Overview

This document specifies the complete entity schemas for Phase 4 Grade Translation & Reporting Layer. These schemas strictly enforce Phase 4 boundaries: **grades are translations (not truth), require human confirmation, are reversible and auditable, and never modify Phase 2 or Phase 3 tables**.

---

## Schema Conventions (Applied to All Tables)

All tables follow these conventions:

- **Primary Keys**: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Scoping**: `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- **Multi-school Support**: Optional `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- **Audit Fields**: 
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - `created_by UUID REFERENCES profiles(id)`
  - `updated_by UUID REFERENCES profiles(id)`
- **Soft Deletes**: `archived_at TIMESTAMPTZ NULL` (no hard deletes)
- **Indexes**: Foreign keys, organization_id, and unique constraint columns
- **Triggers**: Auto-update `updated_at` on row changes

---

## Phase 4 Tables (Grade Translation & Reporting)

### 1. `grade_policies`

Defines how an organization/school translates learning evidence into grades. Policies are scoped to organization/school and optionally to programs.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `program_id UUID REFERENCES programs(id) ON DELETE SET NULL` (optional: program-specific policy)
- `policy_name TEXT NOT NULL` (e.g., "Standard A-F Grading", "Pass/Fail Scheme")
- `policy_type TEXT NOT NULL CHECK (policy_type IN ('letter_grade', 'descriptor', 'pass_fail'))`
- `description TEXT`
- `is_active BOOLEAN DEFAULT TRUE`
- `effective_start_date DATE`
- `effective_end_date DATE`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, policy_name)` where `archived_at IS NULL`
- Policy type enum ensures only allowed translation methods (no numeric)

**Indexes:**
- `idx_grade_policies_organization_id ON grade_policies(organization_id)`
- `idx_grade_policies_school_id ON grade_policies(school_id) WHERE school_id IS NOT NULL`
- `idx_grade_policies_program_id ON grade_policies(program_id) WHERE program_id IS NOT NULL`
- `idx_grade_policies_is_active ON grade_policies(is_active) WHERE is_active = TRUE`
- Unique index: `idx_grade_policies_org_name_unique ON grade_policies(organization_id, policy_name) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Policies define translation rules only (no computation fields)
- Policies do not auto-apply (require human selection)
- No numeric policy types allowed

**Comments:**
```sql
COMMENT ON TABLE grade_policies IS 'Defines how an organization/school translates learning evidence into grades. Policies are scoped to organization/school and optionally to programs. No numeric computation.';
COMMENT ON COLUMN grade_policies.organization_id IS 'Scopes policy to organization';
COMMENT ON COLUMN grade_policies.school_id IS 'Optional: scopes policy to specific school within organization';
COMMENT ON COLUMN grade_policies.program_id IS 'Optional: scopes policy to specific program';
COMMENT ON COLUMN grade_policies.policy_type IS 'Policy type: letter_grade, descriptor, or pass_fail. No numeric types allowed.';
COMMENT ON COLUMN grade_policies.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 2. `grading_scales`

Defines the actual grade values within a policy (e.g., A, B, C, D, F or "Exceeds Expectations", "Meets Expectations", etc.).

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `grade_policy_id UUID NOT NULL REFERENCES grade_policies(id) ON DELETE RESTRICT`
- `grade_value TEXT NOT NULL` (e.g., "A", "B", "Pass", "Exceeds Expectations")
- `grade_label TEXT` (optional: display label)
- `description TEXT` (what this grade means)
- `is_passing BOOLEAN` (for pass/fail policies)
- `display_order INTEGER` (UI ordering only, no computation)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(grade_policy_id, grade_value)` where `archived_at IS NULL`
- No numeric computation fields

**Indexes:**
- `idx_grading_scales_organization_id ON grading_scales(organization_id)`
- `idx_grading_scales_grade_policy_id ON grading_scales(grade_policy_id)`
- `idx_grading_scales_display_order ON grading_scales(display_order) WHERE display_order IS NOT NULL`
- Unique index: `idx_grading_scales_policy_value_unique ON grading_scales(grade_policy_id, grade_value) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Scales define grade values only (no computation logic)
- No numeric computation fields
- Display order is for UI only (no computation)

**Comments:**
```sql
COMMENT ON TABLE grading_scales IS 'Defines the actual grade values within a policy. No numeric computation fields.';
COMMENT ON COLUMN grading_scales.grade_policy_id IS 'FK to grade_policies.id - scale belongs to exactly one policy';
COMMENT ON COLUMN grading_scales.grade_value IS 'Grade value (e.g., A, B, Pass, Exceeds Expectations). Text only, no numeric computation.';
COMMENT ON COLUMN grading_scales.display_order IS 'UI ordering only, no computation';
COMMENT ON COLUMN grading_scales.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 3. `promotion_rules`

Defines rules for promotion/retention (optional, policy-driven). These are reference rules, not automatic enforcement.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `program_id UUID REFERENCES programs(id) ON DELETE SET NULL`
- `rule_name TEXT NOT NULL`
- `rule_description TEXT` (human-readable rule)
- `requires_manual_review BOOLEAN DEFAULT TRUE` (always requires human confirmation)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, rule_name)` where `archived_at IS NULL`

**Indexes:**
- `idx_promotion_rules_organization_id ON promotion_rules(organization_id)`
- `idx_promotion_rules_school_id ON promotion_rules(school_id) WHERE school_id IS NOT NULL`
- `idx_promotion_rules_program_id ON promotion_rules(program_id) WHERE program_id IS NOT NULL`
- Unique index: `idx_promotion_rules_org_name_unique ON promotion_rules(organization_id, rule_name) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Rules are informational/reference only
- No automatic enforcement (requires manual review)
- Rules do not compute promotion status

**Comments:**
```sql
COMMENT ON TABLE promotion_rules IS 'Defines rules for promotion/retention. Reference rules only, not automatic enforcement.';
COMMENT ON COLUMN promotion_rules.organization_id IS 'Scopes rule to organization';
COMMENT ON COLUMN promotion_rules.rule_description IS 'Human-readable rule description. Informational only, no computation.';
COMMENT ON COLUMN promotion_rules.requires_manual_review IS 'Always requires human confirmation. No automatic enforcement.';
COMMENT ON COLUMN promotion_rules.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 4. `student_grades`

Core grade record for a learner in a time period. Represents the translation of learning evidence into a formal grade. Requires human confirmation.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT`
- `program_id UUID REFERENCES programs(id) ON DELETE SET NULL`
- `section_id UUID REFERENCES sections(id) ON DELETE SET NULL`
- `school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT`
- `term_period TEXT` (e.g., "Q1", "Q2", "Semester 1", "Full Year")
- `grade_policy_id UUID NOT NULL REFERENCES grade_policies(id) ON DELETE RESTRICT`
- `grading_scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE RESTRICT` (the actual grade value)
- `status TEXT NOT NULL CHECK (status IN ('draft', 'pending_confirmation', 'confirmed', 'overridden')) DEFAULT 'draft'`
- `confirmed_at TIMESTAMPTZ` (when grade was confirmed)
- `confirmed_by UUID REFERENCES profiles(id)` (who confirmed the grade)
- `override_reason TEXT` (required if status='overridden')
- `override_by UUID REFERENCES profiles(id)` (who overrode the grade)
- `override_at TIMESTAMPTZ` (when override occurred)
- `notes TEXT` (human notes about this grade)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)` (who created/translated the grade)
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(student_id, school_year_id, term_period, grade_policy_id)` where `status IN ('confirmed', 'overridden')` and `archived_at IS NULL`
- `override_reason` required if `status='overridden'` (enforced via application logic or CHECK constraint)
- `confirmed_by` and `confirmed_at` required if `status IN ('confirmed', 'overridden')` (enforced via application logic)
- No numeric computation fields

**Indexes:**
- `idx_student_grades_organization_id ON student_grades(organization_id)`
- `idx_student_grades_school_id ON student_grades(school_id) WHERE school_id IS NOT NULL`
- `idx_student_grades_student_id ON student_grades(student_id)`
- `idx_student_grades_school_year_id ON student_grades(school_year_id)`
- `idx_student_grades_grade_policy_id ON student_grades(grade_policy_id)`
- `idx_student_grades_grading_scale_id ON student_grades(grading_scale_id)`
- `idx_student_grades_status ON student_grades(status)`
- `idx_student_grades_confirmed_at ON student_grades(confirmed_at) WHERE confirmed_at IS NOT NULL`
- Unique index: `idx_student_grades_unique ON student_grades(student_id, school_year_id, term_period, grade_policy_id) WHERE status IN ('confirmed', 'overridden') AND archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Grades are translations, not computed
- All confirmed grades require human confirmation
- Overrides require explicit justification
- Grades reference time periods, not compute from them
- No numeric computation fields

**Comments:**
```sql
COMMENT ON TABLE student_grades IS 'Core grade record for a learner in a time period. Represents translation of learning evidence into formal grade. Requires human confirmation.';
COMMENT ON COLUMN student_grades.student_id IS 'FK to students.id - the learner receiving the grade';
COMMENT ON COLUMN student_grades.grade_policy_id IS 'FK to grade_policies.id - which policy governs this grade';
COMMENT ON COLUMN student_grades.grading_scale_id IS 'FK to grading_scales.id - the actual grade value';
COMMENT ON COLUMN student_grades.status IS 'Grade status: draft, pending_confirmation, confirmed, or overridden. Confirmation requires human action.';
COMMENT ON COLUMN student_grades.confirmed_at IS 'When grade was confirmed (required if status is confirmed or overridden)';
COMMENT ON COLUMN student_grades.confirmed_by IS 'Who confirmed the grade (required if status is confirmed or overridden)';
COMMENT ON COLUMN student_grades.override_reason IS 'Required if status is overridden. Must provide justification for override.';
COMMENT ON COLUMN student_grades.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 5. `grade_entries`

Optional detailed breakdown of how a grade was determined. Links to specific learning evidence (observations) that informed the grade. Read-only references to Phase 2 data.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE CASCADE`
- `observation_id UUID REFERENCES observations(id) ON DELETE SET NULL` (read-only reference to Phase 2)
- `competency_id UUID REFERENCES competencies(id) ON DELETE SET NULL` (read-only reference to Phase 2)
- `domain_id UUID REFERENCES domains(id) ON DELETE SET NULL` (read-only reference to Phase 2)
- `entry_type TEXT NOT NULL CHECK (entry_type IN ('observation_reference', 'competency_summary', 'domain_summary', 'manual_note'))`
- `entry_text TEXT` (human notes about this entry)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- All Phase 2 references use `ON DELETE SET NULL` (preserves grade entry if observation/competency deleted)
- Entry type enum ensures only allowed reference types
- No numeric computation fields

**Indexes:**
- `idx_grade_entries_organization_id ON grade_entries(organization_id)`
- `idx_grade_entries_student_grade_id ON grade_entries(student_grade_id)`
- `idx_grade_entries_observation_id ON grade_entries(observation_id) WHERE observation_id IS NOT NULL`
- `idx_grade_entries_competency_id ON grade_entries(competency_id) WHERE competency_id IS NOT NULL`
- `idx_grade_entries_domain_id ON grade_entries(domain_id) WHERE domain_id IS NOT NULL`
- `idx_grade_entries_entry_type ON grade_entries(entry_type)`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Entries are informational only (no computation)
- Phase 2 references are read-only (never modify Phase 2 tables)
- Entries document the translation process, not compute it
- No numeric computation fields

**Comments:**
```sql
COMMENT ON TABLE grade_entries IS 'Optional detailed breakdown of how a grade was determined. Links to learning evidence (read-only references to Phase 2).';
COMMENT ON COLUMN grade_entries.student_grade_id IS 'FK to student_grades.id - the grade this entry documents';
COMMENT ON COLUMN grade_entries.observation_id IS 'Optional: FK to observations.id - read-only reference to Phase 2 (ON DELETE SET NULL)';
COMMENT ON COLUMN grade_entries.competency_id IS 'Optional: FK to competencies.id - read-only reference to Phase 2 (ON DELETE SET NULL)';
COMMENT ON COLUMN grade_entries.domain_id IS 'Optional: FK to domains.id - read-only reference to Phase 2 (ON DELETE SET NULL)';
COMMENT ON COLUMN grade_entries.entry_type IS 'Type of entry: observation_reference, competency_summary, domain_summary, or manual_note';
COMMENT ON COLUMN grade_entries.entry_text IS 'Human notes about this entry. Informational only, no computation.';
COMMENT ON COLUMN grade_entries.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 6. `grade_justifications`

Audit trail for grade decisions. Records why a grade was assigned, changed, or overridden. Append-only records.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE CASCADE`
- `justification_type TEXT NOT NULL CHECK (justification_type IN ('initial_assignment', 'confirmation', 'override', 'correction', 'appeal'))`
- `justification_text TEXT NOT NULL` (why this action was taken)
- `previous_grade_id UUID REFERENCES grading_scales(id) ON DELETE SET NULL` (if changed)
- `new_grade_id UUID REFERENCES grading_scales(id) ON DELETE SET NULL` (if changed)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)` (who made this justification)

**Constraints:**
- `justification_text` is required (all grade actions must be justified)
- Previous/new grade IDs recommended if justification_type is 'override' or 'correction' (enforced via application logic)
- No numeric computation fields

**Indexes:**
- `idx_grade_justifications_organization_id ON grade_justifications(organization_id)`
- `idx_grade_justifications_student_grade_id ON grade_justifications(student_grade_id)`
- `idx_grade_justifications_justification_type ON grade_justifications(justification_type)`
- `idx_grade_justifications_created_at ON grade_justifications(created_at)`
- `idx_grade_justifications_created_by ON grade_justifications(created_by)`

**Triggers:**
- None (append-only, no `updated_at` field)

**Invariants:**
- All grade actions create justification records
- Justifications are append-only (never deleted or updated)
- Full audit trail for reversibility
- No numeric computation fields

**Comments:**
```sql
COMMENT ON TABLE grade_justifications IS 'Audit trail for grade decisions. Append-only records documenting why grades were assigned, changed, or overridden.';
COMMENT ON COLUMN grade_justifications.student_grade_id IS 'FK to student_grades.id - the grade this justification documents';
COMMENT ON COLUMN grade_justifications.justification_type IS 'Type of justification: initial_assignment, confirmation, override, correction, or appeal';
COMMENT ON COLUMN grade_justifications.justification_text IS 'Required: narrative explanation of why this action was taken';
COMMENT ON COLUMN grade_justifications.previous_grade_id IS 'Optional: FK to grading_scales.id - previous grade value (if changed)';
COMMENT ON COLUMN grade_justifications.new_grade_id IS 'Optional: FK to grading_scales.id - new grade value (if changed)';
COMMENT ON COLUMN grade_justifications.created_by IS 'Who made this justification. Records are append-only (never updated or deleted).';
```

---

### 7. `transcript_records`

Formal transcript entries derived from confirmed grades. Read-only from grade records.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT`
- `student_grade_id UUID NOT NULL REFERENCES student_grades(id) ON DELETE RESTRICT` (source grade)
- `program_id UUID REFERENCES programs(id) ON DELETE SET NULL`
- `school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE RESTRICT`
- `term_period TEXT NOT NULL`
- `course_name TEXT` (optional: if program has courses)
- `grade_value TEXT NOT NULL` (from grading_scale.grade_value)
- `credits DECIMAL(4,2)` (optional: if applicable)
- `transcript_status TEXT NOT NULL CHECK (transcript_status IN ('draft', 'finalized')) DEFAULT 'draft'`
- `finalized_at TIMESTAMPTZ`
- `finalized_by UUID REFERENCES profiles(id)`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(student_id, school_year_id, term_period, course_name)` where `transcript_status='finalized'` and `archived_at IS NULL`
- `finalized_by` and `finalized_at` required if `transcript_status='finalized'` (enforced via application logic)
- No GPA computation fields

**Indexes:**
- `idx_transcript_records_organization_id ON transcript_records(organization_id)`
- `idx_transcript_records_school_id ON transcript_records(school_id) WHERE school_id IS NOT NULL`
- `idx_transcript_records_student_id ON transcript_records(student_id)`
- `idx_transcript_records_student_grade_id ON transcript_records(student_grade_id)`
- `idx_transcript_records_school_year_id ON transcript_records(school_year_id)`
- `idx_transcript_records_transcript_status ON transcript_records(transcript_status)`
- `idx_transcript_records_finalized_at ON transcript_records(finalized_at) WHERE finalized_at IS NOT NULL`
- Unique index: `idx_transcript_records_unique ON transcript_records(student_id, school_year_id, term_period, course_name) WHERE transcript_status='finalized' AND archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Transcripts read from grade records only (never write back)
- Finalization requires human confirmation
- Transcripts are snapshots (can be regenerated from grades)
- No GPA computation in Phase 4
- Credits are informational only (no computation)

**Comments:**
```sql
COMMENT ON TABLE transcript_records IS 'Formal transcript entries derived from confirmed grades. Read-only from grade records.';
COMMENT ON COLUMN transcript_records.student_grade_id IS 'FK to student_grades.id - source grade (read-only reference)';
COMMENT ON COLUMN transcript_records.grade_value IS 'Grade value from grading_scale.grade_value. Text only, no numeric computation.';
COMMENT ON COLUMN transcript_records.credits IS 'Optional: credits if applicable. Informational only, no GPA computation in Phase 4.';
COMMENT ON COLUMN transcript_records.transcript_status IS 'Transcript status: draft or finalized. Finalization requires human confirmation.';
COMMENT ON COLUMN transcript_records.finalized_at IS 'When transcript was finalized (required if transcript_status is finalized)';
COMMENT ON COLUMN transcript_records.finalized_by IS 'Who finalized the transcript (required if transcript_status is finalized)';
COMMENT ON COLUMN transcript_records.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 8. `report_templates`

Defines report card and transcript formats per school/organization.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `template_name TEXT NOT NULL` (e.g., "Standard Report Card", "DepEd Format", "CHED Format")
- `template_type TEXT NOT NULL CHECK (template_type IN ('report_card', 'transcript', 'compliance_export'))`
- `template_config JSONB` (format configuration, fields, layout)
- `is_active BOOLEAN DEFAULT TRUE`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, template_name)` where `archived_at IS NULL`
- Template config is JSONB for flexibility
- No numeric computation fields

**Indexes:**
- `idx_report_templates_organization_id ON report_templates(organization_id)`
- `idx_report_templates_school_id ON report_templates(school_id) WHERE school_id IS NOT NULL`
- `idx_report_templates_template_type ON report_templates(template_type)`
- `idx_report_templates_is_active ON report_templates(is_active) WHERE is_active = TRUE`
- Unique index: `idx_report_templates_org_name_unique ON report_templates(organization_id, template_name) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Templates define output format only (no computation)
- Templates read from grade/transcript records only
- Templates never write back to learning data

**Comments:**
```sql
COMMENT ON TABLE report_templates IS 'Defines report card and transcript formats per school/organization. Format configuration only, no computation.';
COMMENT ON COLUMN report_templates.organization_id IS 'Scopes template to organization';
COMMENT ON COLUMN report_templates.school_id IS 'Optional: scopes template to specific school within organization';
COMMENT ON COLUMN report_templates.template_type IS 'Template type: report_card, transcript, or compliance_export';
COMMENT ON COLUMN report_templates.template_config IS 'JSONB configuration for format, fields, layout. No computation logic.';
COMMENT ON COLUMN report_templates.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

## Explicit Invariants Summary

### What Tables MUST NEVER Have

The following fields are **FORBIDDEN** in all Phase 4 tables:
- `score`, `points`, `weight`, `percent`, `average`, `band`, `gpa`
- `mastery`, `proficiency`, `readiness`, `status` (computed)
- Numeric computation fields
- Auto-populated or computed grade values
- Aggregation or rollup fields

### Phase Boundary Rules

1. **No Modification to Phase 2/3**: Phase 4 never modifies Phase 2 or Phase 3 tables
2. **Read-Only References**: Phase 2/3 references use `ON DELETE SET NULL` to preserve Phase 4 data
3. **No Foreign Keys from Phase 2/3**: No foreign keys from Phase 2/3 tables point to Phase 4 tables
4. **Human Confirmation Required**: All grade finalization requires explicit human action
5. **Full Audit Trail**: All grade actions create justification records
6. **Reversibility**: All grades are editable with complete audit trail

### Reversibility Rules

1. **All records editable**: Including `status` and `grading_scale_id` in student_grades
2. **Status changes create audit trail**: All status changes create `grade_justification` records
3. **No historical locking**: Past grades can be edited or withdrawn
4. **No downstream recalculation**: Editing or withdrawing a grade does not trigger any computation
5. **Justifications are append-only**: Justification records are never deleted or updated

---

## Validation Checklist

Before implementing, verify:

- [ ] No numeric computation fields in any table
- [ ] No modification to Phase 2 or Phase 3 tables
- [ ] All Phase 2/3 references use `ON DELETE SET NULL`
- [ ] No foreign keys from Phase 2/3 to Phase 4
- [ ] All tables support reversibility via `archived_at`
- [ ] All tables include required audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`)
- [ ] All tables are scoped by `organization_id`
- [ ] Optional `school_id` is included for multi-school support
- [ ] Status fields enforce human confirmation requirements
- [ ] Justification records are append-only
- [ ] No GPA computation fields exist
- [ ] Credits field is informational only (no computation)

---

**End of Schema Specification**
