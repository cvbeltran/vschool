# Phase 3 Reflection & Feedback Pages Overview

## Routes

### Admin/Staff Taxonomy Pages

#### `/sis/reflection/prompts`
- **Description**: Manage reflection prompts that teachers answer during reflection
- **Access**: Read: `principal`, `admin`, `registrar`, `teacher` | Write: `principal`, `admin`
- **Tables**: `reflection_prompts`
- **Features**:
  - List, search, and filter reflection prompts
  - Create/edit prompts (admin only)
  - Archive prompts (soft delete)
  - Filter by active/inactive status

#### `/sis/feedback/dimensions`
- **Description**: Manage feedback dimensions that students use when providing feedback
- **Access**: Read: `principal`, `admin`, `registrar`, `teacher`, `student` | Write: `principal`, `admin`
- **Tables**: `feedback_dimensions` (with joined `reflection_prompts`)
- **Features**:
  - List, search, and filter feedback dimensions
  - Create/edit dimensions (admin only)
  - Link dimensions to reflection prompts
  - Archive dimensions (soft delete)
  - Filter by active/inactive status
- **Note**: Students can read dimensions (needed for feedback submission)

### Teacher Workflows

#### `/sis/reflection/my`
- **Description**: Teachers create and manage their own reflections on teaching practice
- **Access**: Read: `principal`, `admin`, `registrar` (all), `teacher` (own only) | Write: `principal`, `admin`, `teacher` (own only)
- **Tables**: `teacher_reflections` (with joined `reflection_prompts`, `experiences`, `school_years`, `competencies`)
- **Features**:
  - List reflections with filters (status, school year, quarter, experience)
  - Create/edit own reflections (teachers) or all (admins)
  - Archive reflections (soft delete)
  - Link to prompts, experiences, school years, competencies
  - Draft/completed status management

#### `/sis/feedback/teacher`
- **Description**: Teachers view completed student feedback (anonymized when requested)
- **Access**: Read: `principal`, `admin`, `registrar`, `teacher` (completed feedback where `teacher_id = current_profile_id()`)
- **Tables**: `v_student_feedback_teacher_view` (view on `student_feedback`)
- **Features**:
  - List completed student feedback
  - Filters: quarter, experience type, experience, dimension
  - Display anonymization badges
  - Read-only (no create/edit)

### Student Workflows

#### `/sis/feedback/my`
- **Description**: Students create and manage their own quarterly feedback
- **Access**: Read: `principal`, `admin`, `registrar`, `student`, `teacher` | Write: `student` (own only)
- **Tables**: `student_feedback` (with joined `feedback_dimensions`, `profiles` (teacher), `experiences`, `school_years`)
- **Features**:
  - List own feedback with filters (status, quarter, dimension)
  - Create/edit own feedback (students only)
  - Archive own feedback (soft delete)
  - Quarterly feedback requirement
  - Anonymous feedback option
  - Link to dimensions, teachers, experiences, school years

## Role Access Summary

| Role | Prompts | Dimensions | My Reflections | Student Feedback | View Feedback |
|------|---------|------------|-----------------|------------------|---------------|
| **principal** | CRUD | CRUD | CRUD (all) | Read | Read |
| **admin** | CRUD | CRUD | CRUD (all) | Read | Read |
| **registrar** | Read | Read | Read (all) | Read | Read |
| **teacher** | Read | Read | CRUD (own) | Read | Read (own) |
| **student** | — | Read | — | CRUD (own) | — |

**Legend**: CRUD = Create, Read, Update, Delete | Read = Read-only

## Table Mappings

### `reflection_prompts`
- **Used by**: `/sis/reflection/prompts`, `/sis/reflection/my` (form dropdown)
- **Operations**: CRUD (admin), Read (all staff)

### `feedback_dimensions`
- **Used by**: `/sis/feedback/dimensions`, `/sis/feedback/my` (form dropdown), `/sis/feedback/teacher` (filter)
- **Operations**: CRUD (admin), Read (all staff + students)

### `teacher_reflections`
- **Used by**: `/sis/reflection/my`
- **Operations**: CRUD (teachers own, admins all), Read (registrars all)

### `student_feedback`
- **Used by**: `/sis/feedback/my`
- **Operations**: CRUD (students own), Read (admins/registrars/teachers)

### `v_student_feedback_teacher_view`
- **Used by**: `/sis/feedback/teacher`
- **Operations**: Read-only (teachers see completed feedback where `teacher_id = current_profile_id()`)
- **Note**: View anonymizes `student_id` when `is_anonymous = true`

## Key Invariants

### No Grades/Scores/Computation
- ✅ All fields are narrative/qualitative text only
- ✅ No numeric inputs except `display_order` (UI ordering only)
- ✅ No scores, ratings, percentages, or averages
- ✅ Status fields use Select dropdowns (draft/completed), not numeric values

### Reversibility
- ✅ All delete operations use `archived_at` (soft delete)
- ✅ No hard deletes in UI
- ✅ Archive actions are reversible

### RLS Enforcement
- ✅ RLS policies are the source of truth for access control
- ✅ UI gracefully handles "no access" states
- ✅ Pages show friendly error messages instead of raw errors

### Data Relationships
- ✅ Reflections can link to prompts, experiences, school years, competencies (read-only references)
- ✅ Feedback can link to dimensions, teachers, experiences, school years
- ✅ Dimensions can link to reflection prompts (for alignment)
- ✅ No modification to Phase 2 tables (competencies, experiences, etc.)

## Component Files

### Data Access Layers
- `src/lib/reflection.ts` - Reflection prompts and teacher reflections
- `src/lib/feedback.ts` - Feedback dimensions and student feedback

### Form Components
- `src/components/reflection/reflection-prompt-form.tsx`
- `src/components/feedback/feedback-dimension-form.tsx`
- `src/components/reflection/teacher-reflection-form.tsx`
- `src/components/feedback/student-feedback-form.tsx`

### Pages
- `src/app/sis/reflection/prompts/page.tsx`
- `src/app/sis/feedback/dimensions/page.tsx`
- `src/app/sis/reflection/my/page.tsx`
- `src/app/sis/feedback/teacher/page.tsx`
- `src/app/sis/feedback/my/page.tsx`

## Navigation

The "Reflection & Feedback" section is added to the sidebar (`src/lib/sidebar-config.ts`) with the following items:
1. Prompts → `/sis/reflection/prompts`
2. Dimensions → `/sis/feedback/dimensions`
3. My Reflections → `/sis/reflection/my`
4. Student Feedback → `/sis/feedback/my`
5. View Feedback → `/sis/feedback/teacher`

All items are visible to `principal`, `admin`, and `teacher` roles.
