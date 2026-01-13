# FEATURE: Reflection & Feedback System (Phase 3 – Formative Loop)

## Product Context
Startup: Vontos  
Product: vSchool  
Module: Reflection & Feedback System (Phase 3)  
Extends: Phase 2 (OBS + AMS)

This feature introduces a formative reflection and feedback loop **without grades, scores, computation, or aggregation**. It enables teachers to reflect on their teaching practice and students to provide quarterly feedback on their learning experiences.

This must work across:
- mixed ages
- mixed programs
- mixed sections
- batch-based learning
- time periods (school years, quarters)

---

## Non-Negotiable Principles

1. Reflection and feedback are qualitative narrative only
2. No computation, aggregation, or scoring
3. No ranking or comparison between teachers or students
4. Everything must be reversible and editable
5. Phase 2 tables are read-only references only (no modification)
6. Any feature that violates these principles belongs to a later phase

---

## What This Feature Includes

### Teacher Self-Reflection
- Narrative reflections on:
  - syllabus intent
  - experiences conducted
  - observations recorded
- Answers prompts such as:
  - What worked?
  - What didn't?
  - What changed from plan?
  - What evidence supports this reflection?
- Links to:
  - experiences (read-only reference)
  - time periods (school year, quarter)
  - optional competencies (read-only reference)

### Student Feedback (Quarterly)
- Qualitative feedback on:
  - mentoring
  - apprenticeship
  - knowledge labs
  - studio work
- Feedback dimensions aligned with teacher reflection prompts
- Quarterly requirement (Q1, Q2, Q3, Q4)
- Optional anonymization

### Perception Alignment
- Teachers see:
  - their own self-reflection
  - anonymized or aggregated student perceptions (NO math)
- Admin sees:
  - completion status
  - thematic alignment
  - reflection presence (not "performance")

### Admin & Registrar Monitoring (Formative)
- See which teachers have:
  - completed reflections
  - received student feedback
- Identify where:
  - support is needed
  - misalignment exists
- WITHOUT punitive indicators
- WITHOUT scores, averages, or rankings

---

## What This Feature Explicitly Excludes

- Grades
- Percentages
- Averages
- Scores or ratings
- Computation or aggregation
- Ranking or comparison
- Performance indicators
- Evaluation metrics
- Numeric scoring scales (Likert allowed ONLY if non-numeric labels)
- Modification to Phase 2 tables
- Any computation from reflections or feedback

---

## Core Concepts

### Reflection Prompt
A qualitative question that teachers answer during reflection. Org-scoped taxonomy for consistency.

### Teacher Reflection
Narrative reflection by a teacher on their teaching practice. Links to experiences, time periods, and optionally competencies (read-only references).

### Feedback Dimension
A feedback category that aligns with teacher reflection prompts. Used by students when providing feedback.

### Student Feedback
Quarterly qualitative feedback from students on their learning experiences. Links to experiences, time periods, and feedback dimensions.

---

## Invariants (Must Be Enforced)

- Phase 3 never computes totals
- Phase 3 never assigns scores
- Phase 3 never aggregates reflections or feedback
- No alignment scores or percentages
- No ranking or comparison logic
- All reflections and feedback are editable
- Phase 2 tables are referenced read-only only
- No foreign keys from Phase 2 tables point to Phase 3 tables

---

## Roles & Permissions

- Principal / Admin:
  - Create reflection prompts
  - Create feedback dimensions
  - View all reflections and feedback (monitoring)
- Registrar:
  - View only (read-only monitoring)
- Teachers:
  - Create and edit their own reflections
  - View aligned student feedback
- Students:
  - Create and edit their own feedback
  - View their own feedback history

---

## UX Guarantees

- No numeric scores visible anywhere
- No empty states without guidance
- No developer language
- No raw IDs
- Clear separation between:
  - reflection (teacher narrative)
  - feedback (student narrative)
  - alignment (thematic presence/absence only)

---

## Phase Boundary

This feature ends when:
- Teachers can create and edit reflections
- Students can provide quarterly feedback
- Admins can monitor completion status
- Perception alignment views exist (thematic only, no computation)
- No evaluation, scoring, or aggregation exists

Computation, aggregation, scoring, or evaluation belong to **Phase 4 or later**.

---

## Connection to Phase 2

- **Reads from Phase 2**: Experiences, Observations, Competencies (read-only references)
- **Does NOT modify Phase 2**: All OBS and AMS tables remain unchanged
- **Extends Phase 2**: Adds reflection and feedback layers on top of existing observation data

---

## Design Principles

1. **Qualitative Only**: All reflection and feedback is narrative text
2. **Formative Purpose**: Designed for growth and insight, not evaluation
3. **Reversible**: All reflections and feedback are editable
4. **Alignment**: Student feedback dimensions align with teacher reflection prompts
5. **No Math**: No computation, aggregation, or derived metrics
