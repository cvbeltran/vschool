# Phase 2 OBS + AMS Entity Schema Specification

**Feature**: OBS (Structure of Meaning) + AMS (Experience & Observation)  
**Phase**: 2 - Pedagogy Core  
**Created**: 2024

## Overview

This document specifies the complete entity schemas for Phase 2 OBS and AMS systems. These schemas strictly enforce Phase 2 boundaries: **no grades, scores, math, mastery computation, or compliance logic**.

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

## OBS Tables (Structure of Meaning)

### 1. `domains`

High-level formation/learning areas. Few and stable.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `name TEXT NOT NULL`
- `description TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, name)` where `archived_at IS NULL`
- No numeric fields (no weights, scores, levels, ordering numbers)

**Indexes:**
- `idx_domains_organization_id ON domains(organization_id)`
- `idx_domains_school_id ON domains(school_id) WHERE school_id IS NOT NULL`
- Unique index: `idx_domains_org_name_unique ON domains(organization_id, name) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER compute totals or aggregates
- MUST NEVER have numeric ordering or ranking fields
- System does not derive anything from domains
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE domains IS 'High-level formation/learning areas. Few and stable. No numeric computation fields.';
COMMENT ON COLUMN domains.organization_id IS 'Scopes domain to organization';
COMMENT ON COLUMN domains.school_id IS 'Optional: scopes domain to specific school within organization';
COMMENT ON COLUMN domains.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 2. `competencies`

Human capabilities under a domain. Belongs to exactly one domain.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE RESTRICT`
- `name TEXT NOT NULL`
- `description TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, domain_id, name)` where `archived_at IS NULL`
- No numeric properties (no points, weights, levels, time-bounds, grade-bounds)
- Foreign key to `domains` uses `ON DELETE RESTRICT` to prevent accidental deletion

**Indexes:**
- `idx_competencies_organization_id ON competencies(organization_id)`
- `idx_competencies_school_id ON competencies(school_id) WHERE school_id IS NOT NULL`
- `idx_competencies_domain_id ON competencies(domain_id)`
- Unique index: `idx_competencies_org_domain_name_unique ON competencies(organization_id, domain_id, name) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER have numeric ordering
- MUST NEVER be time-bound or grade-bound
- Represents human capability only
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE competencies IS 'Human capabilities under a domain. Belongs to exactly one domain. No numeric properties.';
COMMENT ON COLUMN competencies.domain_id IS 'FK to domains.id - competency belongs to exactly one domain';
COMMENT ON COLUMN competencies.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 3. `indicators`

Observable signals of a competency. Evidence descriptors only.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT`
- `description TEXT NOT NULL` (observable signal description)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- No points, levels, bands, weights, or ranking fields
- Cannot be ranked or ordered numerically
- Foreign key to `competencies` uses `ON DELETE RESTRICT`

**Indexes:**
- `idx_indicators_organization_id ON indicators(organization_id)`
- `idx_indicators_school_id ON indicators(school_id) WHERE school_id IS NOT NULL`
- `idx_indicators_competency_id ON indicators(competency_id)`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER have numeric scoring fields
- System does not calculate mastery from indicators
- Exists only as qualitative evidence reference
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE indicators IS 'Observable signals of a competency. Evidence descriptors only. No points, levels, bands, or weights.';
COMMENT ON COLUMN indicators.competency_id IS 'FK to competencies.id - indicator belongs to exactly one competency';
COMMENT ON COLUMN indicators.description IS 'Observable signal description - qualitative evidence only';
COMMENT ON COLUMN indicators.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 4. `competency_levels`

Qualitative taxonomy for mentor-selected judgment. No numeric ordering. Shared taxonomy scoped by organization (not per-competency).

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `label TEXT NOT NULL` (e.g., "Emerging", "Developing", "Proficient", "Advanced")
- `description TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(organization_id, label)` where `archived_at IS NULL`
- No numeric ordering field (no `sort_order`, `level_number`, `rank`)
- No computation fields

**Indexes:**
- `idx_competency_levels_organization_id ON competency_levels(organization_id)`
- `idx_competency_levels_school_id ON competency_levels(school_id) WHERE school_id IS NOT NULL`
- Unique index: `idx_competency_levels_org_label_unique ON competency_levels(organization_id, label) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER be auto-selected or suggested by system
- MUST NEVER have numeric ordering (no implicit hierarchy via numbers)
- System must not infer or auto-populate levels
- Used only for mentor-selected judgment
- No computation fields allowed
- Shared taxonomy across all competencies within organization (not per-competency)

**Comments:**
```sql
COMMENT ON TABLE competency_levels IS 'Qualitative taxonomy for mentor-selected judgment. Shared taxonomy scoped by organization (not per-competency). No numeric ordering. System must not auto-select or suggest levels.';
COMMENT ON COLUMN competency_levels.organization_id IS 'Scopes competency level to organization - levels are shared across all competencies';
COMMENT ON COLUMN competency_levels.label IS 'Qualitative label (e.g., Emerging, Developing, Proficient, Advanced). No numeric ordering.';
COMMENT ON COLUMN competency_levels.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

## AMS Tables (Experience & Observation)

### 5. `experiences`

Learning activities where observation happens. May surface zero, one, or many competencies. Supports mixed programs, sections, batches, and batch-based learning.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `name TEXT NOT NULL`
- `description TEXT`
- `experience_type TEXT` (e.g., "mentoring", "apprenticeship", "lab", "studio", "project")
- `program_id UUID` (optional: scopes to specific program)
- `section_id UUID` (optional: scopes to specific section)
- `batch_id UUID` (optional: scopes to specific batch)
- `term_id UUID` (optional: scopes to specific term)
- `start_at TIMESTAMPTZ` (optional: experience start time)
- `end_at TIMESTAMPTZ` (optional: experience end time)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- No assessment math fields
- No required competency linkage (may exist without competencies)
- Context fields (program_id, section_id, batch_id, term_id) are scoping only (no computation)

**Indexes:**
- `idx_experiences_organization_id ON experiences(organization_id)`
- `idx_experiences_school_id ON experiences(school_id) WHERE school_id IS NOT NULL`
- `idx_experiences_experience_type ON experiences(experience_type) WHERE experience_type IS NOT NULL`
- `idx_experiences_program_id ON experiences(program_id) WHERE program_id IS NOT NULL`
- `idx_experiences_section_id ON experiences(section_id) WHERE section_id IS NOT NULL`
- `idx_experiences_batch_id ON experiences(batch_id) WHERE batch_id IS NOT NULL`
- `idx_experiences_term_id ON experiences(term_id) WHERE term_id IS NOT NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER force observation upon creation
- MUST NEVER have assessment computation fields
- Supports mentoring, apprenticeship, labs, studios, projects
- Context fields are scoping only (no analytics/rollups)
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE experiences IS 'Learning activities where observation happens. May surface zero, one, or many competencies. Supports mixed programs, sections, batches. No assessment math.';
COMMENT ON COLUMN experiences.experience_type IS 'Type of experience (e.g., mentoring, apprenticeship, lab, studio, project)';
COMMENT ON COLUMN experiences.program_id IS 'Optional: scopes experience to specific program';
COMMENT ON COLUMN experiences.section_id IS 'Optional: scopes experience to specific section';
COMMENT ON COLUMN experiences.batch_id IS 'Optional: scopes experience to specific batch';
COMMENT ON COLUMN experiences.term_id IS 'Optional: scopes experience to specific term';
COMMENT ON COLUMN experiences.start_at IS 'Optional: experience start time';
COMMENT ON COLUMN experiences.end_at IS 'Optional: experience end time';
COMMENT ON COLUMN experiences.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 6. `experience_competency_links`

Declares emphasis only (Primary/Secondary/Contextual). Non-numeric and informational.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE CASCADE`
- `competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT`
- `emphasis TEXT NOT NULL CHECK (emphasis IN ('Primary', 'Secondary', 'Contextual'))`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(experience_id, competency_id)` where `archived_at IS NULL`
- Emphasis is enum only, no numeric values
- Foreign key to `experiences` uses `ON DELETE CASCADE` (if experience deleted, links deleted)
- Foreign key to `competencies` uses `ON DELETE RESTRICT`

**Indexes:**
- `idx_experience_competency_links_organization_id ON experience_competency_links(organization_id)`
- `idx_experience_competency_links_experience_id ON experience_competency_links(experience_id)`
- `idx_experience_competency_links_competency_id ON experience_competency_links(competency_id)`
- Unique index: `idx_exp_comp_links_unique ON experience_competency_links(experience_id, competency_id) WHERE archived_at IS NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER compute or influence competency levels
- Emphasis does not override mentor judgment
- Exists only to guide attention
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE experience_competency_links IS 'Declares emphasis only (Primary/Secondary/Contextual). Non-numeric and informational. Does not influence competency levels.';
COMMENT ON COLUMN experience_competency_links.emphasis IS 'Emphasis type: Primary, Secondary, or Contextual. Non-numeric, informational only.';
COMMENT ON COLUMN experience_competency_links.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 7. `observations` (CORE RECORD)

One learner, one experience, one competency. Mentor-selected competency level. Editable and withdrawable.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(id) ON DELETE SET NULL`
- `learner_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT`
- `experience_id UUID NOT NULL REFERENCES experiences(id) ON DELETE RESTRICT`
- `competency_id UUID NOT NULL REFERENCES competencies(id) ON DELETE RESTRICT`
- `competency_level_id UUID NOT NULL REFERENCES competency_levels(id) ON DELETE RESTRICT`
- `notes TEXT` (qualitative notes)
- `observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` (when observation occurred)
- `status TEXT NOT NULL CHECK (status IN ('active','withdrawn')) DEFAULT 'active'`
- `withdrawn_at TIMESTAMPTZ` (when observation was withdrawn)
- `withdrawn_reason TEXT` (optional reason for withdrawal)
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)` (mentor who created)
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ` (lifecycle/admin archival, not withdrawal mechanism)

**Constraints:**
- Unique constraint: `(learner_id, experience_id, competency_id)` where `status='active'` (one active observation per learner-experience-competency)
- No numeric fields (no scores, points, weights)
- All foreign keys use `ON DELETE RESTRICT` to preserve data integrity
- `competency_level_id` is NOT NULL (mentor must select a level)
- `status` must be 'active' or 'withdrawn'

**Indexes:**
- `idx_observations_organization_id ON observations(organization_id)`
- `idx_observations_school_id ON observations(school_id) WHERE school_id IS NOT NULL`
- `idx_observations_learner_id ON observations(learner_id)`
- `idx_observations_experience_id ON observations(experience_id)`
- `idx_observations_competency_id ON observations(competency_id)`
- `idx_observations_competency_level_id ON observations(competency_level_id)`
- `idx_observations_observed_at ON observations(observed_at)`
- `idx_observations_created_by ON observations(created_by)`
- `idx_observations_status ON observations(status)`
- Unique index: `idx_observations_unique ON observations(learner_id, experience_id, competency_id) WHERE status='active'`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- MUST NEVER have system-suggested or auto-populated competency levels
- All fields editable (including `competency_level_id`)
- No downstream recalculation on edit/withdrawal
- System must not suggest, infer, or auto-populate competency levels
- Withdrawal via `status='withdrawn'` preserves reversibility (observations remain editable)
- `archived_at` is for lifecycle/admin archival only, not withdrawal mechanism
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE observations IS 'CORE RECORD: One learner, one experience, one competency. Mentor-selected competency level. Editable and withdrawable. No numeric fields.';
COMMENT ON COLUMN observations.learner_id IS 'FK to students.id - the learner being observed';
COMMENT ON COLUMN observations.competency_level_id IS 'FK to competency_levels.id - mentor-selected level. System must not auto-populate or suggest.';
COMMENT ON COLUMN observations.observed_at IS 'When the observation occurred (may differ from created_at)';
COMMENT ON COLUMN observations.status IS 'Observation status: active or withdrawn. Withdrawal preserves reversibility.';
COMMENT ON COLUMN observations.withdrawn_at IS 'When the observation was withdrawn (set when status changes to withdrawn)';
COMMENT ON COLUMN observations.withdrawn_reason IS 'Optional reason for withdrawal';
COMMENT ON COLUMN observations.archived_at IS 'Lifecycle/admin archival timestamp. NOT the withdrawal mechanism. NULL = active, timestamp = archived';
```

---

### 8. `observation_indicator_links`

Records which indicators were observed. Evidence only, no scoring.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE`
- `indicator_id UUID NOT NULL REFERENCES indicators(id) ON DELETE RESTRICT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- Unique constraint: `(observation_id, indicator_id)` where `archived_at IS NULL`
- No scoring or weighting fields
- Foreign key to `observations` uses `ON DELETE CASCADE` (if observation deleted, links deleted)
- Foreign key to `indicators` uses `ON DELETE RESTRICT`
- Note: Links are archived when parent observation is withdrawn, but use `archived_at` for lifecycle management

**Indexes:**
- `idx_observation_indicator_links_organization_id ON observation_indicator_links(organization_id)`
- `idx_observation_indicator_links_observation_id ON observation_indicator_links(observation_id)`
- `idx_observation_indicator_links_indicator_id ON observation_indicator_links(indicator_id)`
- Unique index: `idx_obs_ind_links_unique ON observation_indicator_links(observation_id, indicator_id) WHERE archived_at IS NULL`

**Triggers:**
- None (no `updated_at` field - links are append-only)

**Invariants:**
- MUST NEVER compute scores from indicator links
- Evidence recording only
- No derived or computed fields
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE observation_indicator_links IS 'Records which indicators were observed. Evidence only, no scoring.';
COMMENT ON COLUMN observation_indicator_links.observation_id IS 'FK to observations.id - the observation this indicator link belongs to';
COMMENT ON COLUMN observation_indicator_links.indicator_id IS 'FK to indicators.id - the indicator that was observed';
COMMENT ON COLUMN observation_indicator_links.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

### 9. `observation_attachments` (Optional)

Artifacts linked to observations. No derived or computed fields.

**Fields:**
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`
- `observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE`
- `file_url TEXT NOT NULL` (or file reference)
- `file_name TEXT`
- `file_type TEXT`
- `description TEXT`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`
- `created_by UUID REFERENCES profiles(id)`
- `updated_by UUID REFERENCES profiles(id)`
- `archived_at TIMESTAMPTZ`

**Constraints:**
- No derived or computed fields
- Foreign key to `observations` uses `ON DELETE CASCADE`

**Indexes:**
- `idx_observation_attachments_organization_id ON observation_attachments(organization_id)`
- `idx_observation_attachments_observation_id ON observation_attachments(observation_id)`
- `idx_observation_attachments_file_type ON observation_attachments(file_type) WHERE file_type IS NOT NULL`

**Triggers:**
- Auto-update `updated_at` on row update

**Invariants:**
- Artifacts only, no computation
- No computation fields allowed

**Comments:**
```sql
COMMENT ON TABLE observation_attachments IS 'Artifacts linked to observations. No derived or computed fields.';
COMMENT ON COLUMN observation_attachments.observation_id IS 'FK to observations.id - the observation this attachment belongs to';
COMMENT ON COLUMN observation_attachments.file_url IS 'File reference or URL to the artifact';
COMMENT ON COLUMN observation_attachments.archived_at IS 'Soft delete: NULL = active, timestamp = archived';
```

---

## Read Models (Views Only, No Rollups)

If display convenience is needed, propose read-only views that:
- Filter or order observations
- Join related entities for display
- **MUST NOT** compute mastery, progress, or status
- **MUST NOT** aggregate or rollup data

### Example View Concepts (Not Implemented in Phase 2)

**Note**: These are conceptual only. Actual implementation deferred to later phases if needed.

#### `v_learner_observations` (Conceptual)
Join observations with competencies, levels, experiences for display only.

**Purpose**: Display convenience for learner profile views.

**MUST NOT**:
- Compute mastery or proficiency
- Aggregate or count observations
- Calculate progress percentages
- Derive status or readiness

**MAY**:
- Filter observations by learner
- Order observations by `observed_at`
- Join with competency names, level labels, experience names

#### `v_experience_competencies` (Conceptual)
Join experiences with linked competencies and emphasis for display only.

**Purpose**: Display convenience for experience detail views.

**MUST NOT**:
- Compute competency coverage
- Aggregate emphasis types
- Calculate statistics

**MAY**:
- Filter by experience
- Join with competency names and emphasis values
- Order by emphasis type

---

## Explicit Invariants Summary

### What Tables MUST NEVER Have

The following fields are **FORBIDDEN** in all Phase 2 tables:
- `score`, `points`, `weight`, `percent`, `average`, `band`, `gpa`
- `mastery`, `proficiency`, `readiness`, `status` (computed)
- `sort_order` (for competency_levels - no numeric ordering)
- `level_number`, `rank`, `order` (numeric ordering fields)
- Aggregation or rollup fields
- Auto-populated or computed competency levels

### Reversibility Rules

1. **All records editable**: Including `competency_level_id` in observations
2. **Withdrawal via `status='withdrawn'`**: Explicit status field preserves data for reversibility
3. **No historical locking**: Past observations can be edited or withdrawn
4. **No downstream recalculation**: Editing or withdrawing an observation does not trigger any computation
5. **Observations remain editable after withdrawal**: Withdrawn observations can be reactivated or edited

### System Behavior Rules

1. **No auto-population**: System must not suggest, infer, or auto-populate competency levels
2. **No default values**: `competency_level_id` in observations must be explicitly selected by mentor
3. **No background aggregation**: No jobs that compute mastery, progress, or status
4. **No automatic status computation**: System does not derive competency or domain status

---

## Phase Boundary Enforcement

These schemas explicitly exclude:

- Analytics or aggregation tables
- Progress indicator tables
- Mastery state tables
- Compliance mapping tables
- Any table with numeric computation fields
- Any table that computes or derives competency status
- Any table that aggregates observations

All such features belong to later phases and must **NOT** appear in Phase 2 schemas.

---

## Implementation Notes

1. **Naming Convention**: Use `organization_id` (not `org_id`) to match existing codebase patterns
2. **User References**: `created_by` and `updated_by` reference `profiles(id)` (UUID)
3. **Competency Levels**: Separate table (not taxonomy_items) to enforce mentor-selection requirement. Org-scoped shared taxonomy (not per-competency).
4. **Emphasis**: Enum constraint ensures only allowed values ('Primary', 'Secondary', 'Contextual')
5. **Archival**: Use `archived_at` for lifecycle/admin soft deletes. Use `status` field for observation withdrawal.
6. **Indexes**: Create indexes on foreign keys, organization_id, unique constraint columns, and context fields (program_id, section_id, batch_id, term_id)
7. **Triggers**: Use generic `update_updated_at()` function pattern for all tables with `updated_at`
8. **Foreign Key Behavior**: 
   - `ON DELETE CASCADE` for organization_id and dependent links
   - `ON DELETE RESTRICT` for core entities (domains, competencies, students, experiences) to prevent accidental deletion
   - `ON DELETE SET NULL` for optional school_id and context fields (program_id, section_id, batch_id, term_id)

---

## Validation Checklist

Before implementing, verify:

- [ ] No numeric computation fields in any table
- [ ] No mastery, progress, or status computation
- [ ] Competency levels have no numeric ordering
- [ ] Competency levels are org-scoped (not per-competency)
- [ ] Observations require mentor-selected competency level (no defaults)
- [ ] Observations use explicit `status` field for withdrawal (not `archived_at`)
- [ ] All tables support reversibility via `archived_at` (lifecycle) or `status` (withdrawal)
- [ ] All foreign keys use appropriate `ON DELETE` behavior
- [ ] All unique constraints account for `archived_at IS NULL` or `status='active'` as appropriate
- [ ] All tables include required audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`)
- [ ] All tables are scoped by `organization_id`
- [ ] Optional `school_id` is included for multi-school support
- [ ] Experiences include optional context fields (program_id, section_id, batch_id, term_id, start_at, end_at)

---

## Changelog

### 1. Competency Levels Org-Scoped (Not Per-Competency)

**Change**: Removed `competency_id` from `competency_levels` table. Competency levels are now a shared taxonomy scoped by `organization_id` (and optionally `school_id`), not per-competency.

**Impact**: 
- Unique constraint changed from `(organization_id, competency_id, label)` to `(organization_id, label)`
- Removed index on `competency_id`
- Updated comments to reflect shared taxonomy nature

**Rationale**: Competency levels are qualitative taxonomies that should be shared across all competencies within an organization, allowing consistent mentor judgment across different competencies.

---

### 2. Observation Withdrawal Via Explicit Status Fields

**Change**: Added explicit withdrawal mechanism to `observations` table:
- Added `status TEXT NOT NULL CHECK (status IN ('active','withdrawn')) DEFAULT 'active'`
- Added `withdrawn_at TIMESTAMPTZ NULL`
- Added `withdrawn_reason TEXT NULL`
- Updated unique constraint to use `status='active'` instead of `archived_at IS NULL`
- Clarified that `archived_at` is for lifecycle/admin archival only, not withdrawal

**Impact**:
- Unique constraint now uses `WHERE status='active'`
- Added index on `status` field
- Withdrawal is now explicit and reversible
- Observations remain editable after withdrawal

**Rationale**: Explicit status field provides clearer semantics for withdrawal, preserves reversibility, and separates withdrawal from lifecycle archival.

---

### 3. Experience Context Links Added

**Change**: Added optional context fields to `experiences` table for mixed programs, sections, batches, and batch-based learning:
- `program_id UUID NULL` (optional: scopes to specific program)
- `section_id UUID NULL` (optional: scopes to specific section)
- `batch_id UUID NULL` (optional: scopes to specific batch)
- `term_id UUID NULL` (optional: scopes to specific term)
- `start_at TIMESTAMPTZ NULL` (optional: experience start time)
- `end_at TIMESTAMPTZ NULL` (optional: experience end time)

**Impact**:
- Added indexes for context fields (program_id, section_id, batch_id, term_id)
- Updated comments to document context fields
- All context fields are nullable (scoping only, no computation)

**Rationale**: Supports Phase 2 requirement for experiences to work across mixed programs, mixed sections, and batch-based learning. Context fields are scoping only and do not introduce computation or analytics.

---

**End of Schema Specification**
