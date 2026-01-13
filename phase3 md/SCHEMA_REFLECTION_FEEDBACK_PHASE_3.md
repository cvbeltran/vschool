# Phase 3 Reflection & Feedback Entity Schema Specification

**Feature**: Reflection & Feedback System (Formative Loop)  
**Phase**: 3 - Formative Reflection & Feedback  
**Created**: 2024

## Overview

This document specifies the complete entity schemas for Phase 3 Reflection & Feedback System. These schemas strictly enforce Phase 3 boundaries: **no grades, scores, math, computation, aggregation, or modification to Phase 2 tables**.

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

## Phase 3 Tables

### 1. `reflection_prompts`

Org-scoped taxonomy of prompts that teachers answer during reflection. Optional but recommended for consistency.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `prompt_text TEXT NOT NULL` (e.g., "What worked?", "What didn't?", "What changed from plan?", "What evidence supports this reflection?")
- `description TEXT` (optional guidance for teachers)
- `display_order INTEGER` (UI ordering only, no computation)
- `is_active BOOLEAN DEFAULT TRUE`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, prompt_text)` where `archived_at IS NULL`
- `display_order` is for UI ordering only, not computation

**Indexes:**
- `idx_reflection_prompts_organization_id ON reflection_prompts(organization_id)`
- `idx_reflection_prompts_school_id ON reflection_prompts(school_id) WHERE school_id IS NOT NULL`
- `idx_reflection_prompts_is_active ON reflection_prompts(is_active) WHERE is_active = TRUE`
- Unique index: `idx_reflection_prompts_org_text_unique ON reflection_prompts(organization_id, prompt_text) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Prompts are qualitative questions only
- No numeric scoring or rating fields
- Display order is informational only

**Comments:**
```sql
COMMENT ON TABLE reflection_prompts IS 'Org-scoped taxonomy of prompts that teachers answer during reflection. Qualitative questions only. No numeric scoring fields.';
COMMENT ON COLUMN reflection_prompts.display_order IS 'UI ordering only, no computation';
COMMENT ON COLUMN reflection_prompts.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 2. `teacher_reflections`

Narrative reflections by teachers on their teaching practice. Links to experiences, time periods, and optionally competencies (read-only reference).

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT` (teacher who wrote reflection)
- `reflection_prompt_id UUID REFERENCES reflection_prompts(id) ON DELETE SET NULL` (optional: which prompt this answers)
- `experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL` (optional: reflection on specific experience)
- `school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL` (optional: reflection for specific school year)
- `quarter TEXT` (optional: "Q1", "Q2", "Q3", "Q4" - informational only)
- `competency_id UUID REFERENCES competencies(id) ON DELETE SET NULL` (optional: read-only reference to competency)
- `reflection_text TEXT NOT NULL` (narrative reflection content)
- `reflected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (when reflection occurred)
- `status TEXT NOT NULL CHECK (status IN ('draft', 'completed')) DEFAULT 'draft'`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- `reflection_text` cannot be empty
- `status` must be 'draft' or 'completed'
- `quarter` is informational only (no computation)
- All foreign keys use `ON DELETE SET NULL` or `ON DELETE RESTRICT` as appropriate

**Indexes:**
- `idx_teacher_reflections_organization_id ON teacher_reflections(organization_id)`
- `idx_teacher_reflections_school_id ON teacher_reflections(school_id) WHERE school_id IS NOT NULL`
- `idx_teacher_reflections_teacher_id ON teacher_reflections(teacher_id)`
- `idx_teacher_reflections_reflection_prompt_id ON teacher_reflections(reflection_prompt_id) WHERE reflection_prompt_id IS NOT NULL`
- `idx_teacher_reflections_experience_id ON teacher_reflections(experience_id) WHERE experience_id IS NOT NULL`
- `idx_teacher_reflections_school_year_id ON teacher_reflections(school_year_id) WHERE school_year_id IS NOT NULL`
- `idx_teacher_reflections_status ON teacher_reflections(status)`
- `idx_teacher_reflections_reflected_at ON teacher_reflections(reflected_at)`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Reflection is narrative text only
- No numeric fields (no scores, ratings, percentages)
- All fields editable (including `reflection_text` and `status`)
- Competency reference is read-only (no modification to competencies table)
- Experience reference is read-only (no modification to experiences table)
- No computation or aggregation

**Comments:**
```sql
COMMENT ON TABLE teacher_reflections IS 'Narrative reflections by teachers on their teaching practice. Links to experiences, time periods, and optionally competencies (read-only reference). Narrative text only, no numeric fields.';
COMMENT ON COLUMN teacher_reflections.experience_id IS 'Optional: FK to experiences.id - reflection on specific experience (read-only reference)';
COMMENT ON COLUMN teacher_reflections.competency_id IS 'Optional: FK to competencies.id - read-only reference to competency (no modification to competencies table)';
COMMENT ON COLUMN teacher_reflections.quarter IS 'Optional: "Q1", "Q2", "Q3", "Q4" - informational only, no computation';
COMMENT ON COLUMN teacher_reflections.status IS 'Reflection status: draft or completed. All fields editable including status.';
COMMENT ON COLUMN teacher_reflections.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 3. `feedback_dimensions`

Org-scoped taxonomy of feedback dimensions that align with teacher reflection prompts. Used by students when providing feedback.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `dimension_name TEXT NOT NULL` (e.g., "What worked?", "What didn't?", "What changed from plan?", "What evidence supports this?")
- `description TEXT` (optional guidance for students)
- `reflection_prompt_id UUID REFERENCES reflection_prompts(id) ON DELETE SET NULL` (optional: links to teacher reflection prompt for alignment)
- `display_order INTEGER` (UI ordering only, no computation)
- `is_active BOOLEAN DEFAULT TRUE`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, dimension_name)` where `archived_at IS NULL`
- `display_order` is for UI ordering only, not computation

**Indexes:**
- `idx_feedback_dimensions_organization_id ON feedback_dimensions(organization_id)`
- `idx_feedback_dimensions_school_id ON feedback_dimensions(school_id) WHERE school_id IS NOT NULL`
- `idx_feedback_dimensions_reflection_prompt_id ON feedback_dimensions(reflection_prompt_id) WHERE reflection_prompt_id IS NOT NULL`
- `idx_feedback_dimensions_is_active ON feedback_dimensions(is_active) WHERE is_active = TRUE`
- Unique index: `idx_feedback_dimensions_org_name_unique ON feedback_dimensions(organization_id, dimension_name) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Dimensions align with teacher reflection prompts
- No numeric scoring fields
- Display order is informational only

**Comments:**
```sql
COMMENT ON TABLE feedback_dimensions IS 'Org-scoped taxonomy of feedback dimensions that align with teacher reflection prompts. Used by students when providing feedback. No numeric scoring fields.';
COMMENT ON COLUMN feedback_dimensions.reflection_prompt_id IS 'Optional: FK to reflection_prompts.id - links to teacher reflection prompt for alignment (informational only, no computation)';
COMMENT ON COLUMN feedback_dimensions.display_order IS 'UI ordering only, no computation';
COMMENT ON COLUMN feedback_dimensions.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 4. `student_feedback`

Quarterly qualitative feedback from students on their learning experiences. Links to experiences, time periods, and feedback dimensions.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT` (student who provided feedback)
- `teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL` (optional: teacher being given feedback about)
- `experience_id UUID REFERENCES experiences(id) ON DELETE SET NULL` (optional: feedback on specific experience)
- `experience_type TEXT` (optional: "mentoring", "apprenticeship", "lab", "studio" - informational only)
- `school_year_id UUID REFERENCES school_years(id) ON DELETE SET NULL` (optional: feedback for specific school year)
- `quarter TEXT NOT NULL` (required: "Q1", "Q2", "Q3", "Q4" - informational only)
- `feedback_dimension_id UUID NOT NULL REFERENCES feedback_dimensions(id) ON DELETE RESTRICT` (which dimension this feedback addresses)
- `feedback_text TEXT NOT NULL` (narrative feedback content)
- `provided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (when feedback was provided)
- `status TEXT NOT NULL CHECK (status IN ('draft', 'completed')) DEFAULT 'draft'`
- `is_anonymous BOOLEAN DEFAULT FALSE` (whether student wants feedback anonymized)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)` (student who created)
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- `feedback_text` cannot be empty
- `quarter` is required (quarterly feedback)
- `status` must be 'draft' or 'completed'
- `quarter` and `experience_type` are informational only (no computation)
- All foreign keys use `ON DELETE SET NULL` or `ON DELETE RESTRICT` as appropriate

**Indexes:**
- `idx_student_feedback_organization_id ON student_feedback(organization_id)`
- `idx_student_feedback_school_id ON student_feedback(school_id) WHERE school_id IS NOT NULL`
- `idx_student_feedback_student_id ON student_feedback(student_id)`
- `idx_student_feedback_teacher_id ON student_feedback(teacher_id) WHERE teacher_id IS NOT NULL`
- `idx_student_feedback_experience_id ON student_feedback(experience_id) WHERE experience_id IS NOT NULL`
- `idx_student_feedback_school_year_id ON student_feedback(school_year_id) WHERE school_year_id IS NOT NULL`
- `idx_student_feedback_quarter ON student_feedback(quarter)`
- `idx_student_feedback_status ON student_feedback(status)`
- `idx_student_feedback_provided_at ON student_feedback(provided_at)`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Feedback is narrative text only
- No numeric fields (no scores, ratings, percentages, Likert numeric values)
- All fields editable (including `feedback_text` and `status`)
- Quarterly requirement enforced via `quarter` field (required)
- No computation or aggregation
- Anonymization flag supports privacy but does not compute anything
- Experience reference is read-only (no modification to experiences table)

**Comments:**
```sql
COMMENT ON TABLE student_feedback IS 'Quarterly qualitative feedback from students on their learning experiences. Links to experiences, time periods, and feedback dimensions. Narrative text only, no numeric fields.';
COMMENT ON COLUMN student_feedback.experience_id IS 'Optional: FK to experiences.id - feedback on specific experience (read-only reference)';
COMMENT ON COLUMN student_feedback.experience_type IS 'Optional: "mentoring", "apprenticeship", "lab", "studio" - informational only, no computation';
COMMENT ON COLUMN student_feedback.quarter IS 'Required: "Q1", "Q2", "Q3", "Q4" - quarterly feedback requirement, informational only, no computation';
COMMENT ON COLUMN student_feedback.feedback_text IS 'Narrative feedback content - qualitative text only, no scores, ratings, percentages';
COMMENT ON COLUMN student_feedback.status IS 'Feedback status: draft or completed. All fields editable including status.';
COMMENT ON COLUMN student_feedback.is_anonymous IS 'Whether student wants feedback anonymized (privacy support, does not compute anything)';
COMMENT ON COLUMN student_feedback.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

## Explicit Invariants Summary

### What Tables MUST NEVER Have

The following fields are **FORBIDDEN** in all Phase 3 tables:
- `score`, `points`, `weight`, `percent`, `average`, `band`, `gpa`
- `mastery`, `proficiency`, `readiness`, `status` (computed)
- Aggregation or rollup fields
- Auto-populated or computed alignment scores
- Ranking or comparison fields

### Reversibility Rules

1. **All records editable**: Including `reflection_text`, `feedback_text`, and `status` fields
2. **Status via `status` field**: Explicit status field preserves data for reversibility
3. **No historical locking**: Past reflections and feedback can be edited
4. **No downstream recalculation**: Editing or archiving a reflection or feedback does not trigger any computation
5. **Reflections and feedback remain editable after completion**: Completed records can be edited or changed back to draft

### System Behavior Rules

1. **No computation**: System must not compute, aggregate, or score reflections or feedback
2. **No aggregation**: No jobs that compute alignment scores, percentages, or metrics
3. **No automatic status computation**: System does not derive completion status from other data
4. **Read-only Phase 2 references**: Phase 2 tables (experiences, competencies) are referenced read-only only

---

## Phase Boundary Enforcement

These schemas explicitly exclude:

- Analytics or aggregation tables
- Alignment score computation tables
- Progress indicator tables
- Performance evaluation tables
- Any table with numeric computation fields
- Any table that computes or derives reflection or feedback status
- Any table that aggregates reflections or feedback
- Any modification to Phase 2 tables

All such features belong to later phases and must **NOT** appear in Phase 3 schemas.

---

## Implementation Notes

1. **Naming Convention**: Use `organization_id` (not `org_id`) to match existing codebase patterns
2. **User References**: `created_by` and `updated_by` reference `profiles(id)` (UUID)
3. **Reflection Prompts**: Org-scoped taxonomy for consistency across teachers
4. **Feedback Dimensions**: Align with reflection prompts via `reflection_prompt_id` (informational only)
5. **Quarterly Requirement**: Enforced via `quarter` field (required for student feedback)
6. **Archival**: Use `archived_at` for lifecycle/admin soft deletes. Use `status` field for draft/completed.
7. **Indexes**: Create indexes on foreign keys, organization_id, unique constraint columns, and context fields
8. **Triggers**: Use generic `update_updated_at()` function pattern for all tables with `updated_at`
9. **Foreign Key Behavior**: 
   - `ON DELETE CASCADE` for organization_id
   - `ON DELETE RESTRICT` for core entities (profiles, students, feedback_dimensions) to prevent accidental deletion
   - `ON DELETE SET NULL` for optional references (experiences, competencies, school_years) to preserve reflections/feedback if referenced entity is deleted

---

## Validation Checklist

Before implementing, verify:

- [ ] No numeric computation fields in any Phase 3 table
- [ ] All Phase 3 tables reference Phase 2 tables read-only only
- [ ] No foreign keys from Phase 2 tables point to Phase 3 tables
- [ ] Reflections and feedback are fully editable
- [ ] Quarterly requirement enforced via `quarter` field (required for student feedback)
- [ ] Feedback dimensions align with reflection prompts
- [ ] No scoring, ranking, or comparison logic exists
- [ ] All tables support reversibility via `archived_at` and `status`
- [ ] All tables include required audit fields
- [ ] All tables are scoped by `organization_id`
- [ ] Optional `school_id` included for multi-school support
- [ ] Display order fields are UI-only (no computation)

---

**End of Schema Specification**
