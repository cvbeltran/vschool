# FEATURE: OBS + AMS (Phase 2 – Pedagogy Core)

## Product Context
Startup: Vontos  
Product: vSchool  
Module: OBS (Outcome-Based System) + AMS (Assessment Management System)

This feature introduces pedagogy-first learning structures **without grades, scores, or compliance math**.

This must work across:
- mixed ages
- mixed programs
- mixed sections
- batch-based learning
- future compliance translation (NOT implemented here)

---

## Non-Negotiable Principles

1. Observation precedes aggregation
2. Human judgment precedes math
3. No grades, no averages, no scores
4. No automatic weighting
5. Compliance logic is NOT part of this feature
6. Everything must be reversible
7. Any feature that violates these principles belongs to a later phase

---

## What This Feature Includes

### OBS (Structure of Meaning)
- Domains
- Competencies
- Indicators

### AMS (Experiences & Observation)
- Experiences (projects / activities)
- Linking competencies to experiences
- Optional emphasis (Primary / Secondary / Contextual)
- Observations per learner
- Mentor-selected competency level
- Qualitative notes

---

## What This Feature Explicitly Excludes

- Grades
- Percentages
- Averages
- Rubrics with points
- GPA
- Transcripts
- Billing
- Scheduling optimization
- Compliance exports
- Government formats (DepEd / CHED)

---

## Core Concepts

### Domain
High-level formation area (few, stable).

### Competency
A human capability under a domain.

### Indicator
An observable signal of a competency.
Indicators are evidence, not scores.

### Experience
A learning activity where observation happens.
Experiences surface competencies.
An Experience may surface zero, one, or many competencies.

### Observation
Mentor-recorded evidence:
- which indicators were observed
- notes
- selected competency level (human judgment)
- The system must not suggest, infer, or auto-populate competency levels.

---

## Emphasis (IMPORTANT)

Experiences may declare **emphasis**, not weight.

Allowed values:
- Primary
- Secondary
- Contextual

Emphasis:
- is non-numeric
- does not compute
- does not override mentor judgment
- exists only to guide attention

---

## Invariants (Must Be Enforced)

- OBS never computes totals
- AMS never assigns scores
- Indicators never have points
- Competency level is mentor-selected
- No auto-rollups
- No math fields in OBS/AMS tables

---

## Roles & Permissions

- Principal / Admin:
  - Create domains, competencies, indicators
- Registrar:
  - View only
- Mentors / Teachers:
  - Create observations
- Students / Guardians:
  - Read-only views

---

## UX Guarantees

- No numeric scores visible anywhere
- No empty states without guidance
- No developer language
- No raw IDs
- Clear separation between:
  - structure (OBS)
  - experience (AMS)
  - reporting (future)

---

## Phase Boundary

This feature ends when:
- Experiences can be created
- Observations can be recorded
- Learner profiles show observed competencies
- No compliance logic exists yet

Compliance translation is a **future phase**.