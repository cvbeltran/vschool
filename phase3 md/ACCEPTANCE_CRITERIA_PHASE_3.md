# Acceptance Criteria  
## Feature: Reflection & Feedback System (Phase 3 – Formative Loop)

---

## A. Reflection Prompts

### A1. Reflection Prompt Creation
**Given** an Admin or Principal  
**When** they create a Reflection Prompt  
**Then** the Prompt:

- has `prompt_text` and optional `description` only  
- contains no numeric scoring fields  
- is scoped to organization  
- has `display_order` for UI ordering only (no computation)  

**And** the system does not compute anything from Reflection Prompts.

---

### A2. Reflection Prompt Alignment
**Given** Reflection Prompts exist  
**When** Feedback Dimensions are created  
**Then** Feedback Dimensions can optionally link to Reflection Prompts via `reflection_prompt_id`

**And** this link is informational only (no computation or aggregation).

---

## B. Teacher Reflections

### B1. Reflection Creation
**Given** a Teacher  
**When** they create a Reflection  
**Then** the Reflection:

- requires `reflection_text` (narrative only)  
- may optionally link to an Experience (read-only reference)  
- may optionally link to a School Year and Quarter  
- may optionally reference a Competency (read-only reference)  
- may optionally link to a Reflection Prompt  
- has `status` of 'draft' or 'completed'  
- contains no numeric fields  

**And** the system does not compute or aggregate reflections.

---

### B2. Reflection Reversibility
**Given** an existing Reflection  
**When** a Teacher edits it  
**Then**:

- all fields are editable (including `reflection_text` and `status`)  
- no downstream recalculation occurs  
- no historical state is locked  

**And** reflections remain editable after completion.

---

### B3. Reflection Context Links
**Given** a Reflection  
**When** it links to an Experience, School Year, or Competency  
**Then**:

- Experience link is read-only reference (no modification to experiences table)  
- Competency link is read-only reference (no modification to competencies table)  
- School Year link is informational only (no computation)  

**And** deleting the referenced Experience or Competency does not delete the Reflection (uses `ON DELETE SET NULL`).

---

## C. Feedback Dimensions

### C1. Feedback Dimension Creation
**Given** an Admin or Principal  
**When** they create a Feedback Dimension  
**Then** the Dimension:

- has `dimension_name` and optional `description` only  
- may optionally link to a Reflection Prompt for alignment  
- contains no numeric scoring fields  
- is scoped to organization  

**And** Feedback Dimensions align with Teacher Reflection Prompts.

---

## D. Student Feedback

### D1. Feedback Creation (Quarterly Requirement)
**Given** a Student  
**When** they create Feedback  
**Then** the Feedback:

- requires `feedback_text` (narrative only)  
- requires `quarter` field ("Q1", "Q2", "Q3", "Q4")  
- requires `feedback_dimension_id` (which dimension this addresses)  
- may optionally link to an Experience  
- may optionally specify `experience_type` ("mentoring", "apprenticeship", "lab", "studio")  
- may optionally link to a School Year  
- may optionally specify a Teacher  
- has `status` of 'draft' or 'completed'  
- contains no numeric fields (no scores, ratings, percentages)  

**And** the system enforces quarterly feedback requirement via `quarter` field.

---

### D2. Feedback Reversibility
**Given** an existing Feedback  
**When** a Student edits it  
**Then**:

- all fields are editable (including `feedback_text` and `status`)  
- no downstream recalculation occurs  
- no historical state is locked  

**And** feedback remains editable after completion.

---

### D3. Feedback Alignment with Reflection Dimensions
**Given** Student Feedback exists  
**And** Teacher Reflections exist  
**When** viewing alignment  
**Then**:

- Feedback Dimensions align with Reflection Prompts via `reflection_prompt_id`  
- Alignment is thematic (presence/absence) only  
- No alignment scores or percentages are computed  

**And** the system does not calculate similarity or match rates.

---

## E. Perception Alignment

### E1. Teacher View of Alignment
**Given** a Teacher  
**When** they view their Reflections alongside Student Feedback  
**Then** they see:

- their own Reflections (full visibility)  
- Student Feedback that:
  - aligns with their Reflections via dimensions/prompts  
  - is anonymized if `is_anonymous = TRUE`  
  - references the same Experiences (if applicable)  
  - references the same time period (School Year/Quarter)  

**And** they see no:

- scores or ratings  
- aggregated counts or percentages  
- rankings or comparisons  
- performance indicators  

---

### E2. Admin View of Alignment
**Given** an Admin  
**When** they view Reflection and Feedback data  
**Then** they see:

- completion status (which teachers have completed reflections)  
- completion status (which students have provided feedback)  
- thematic alignment (presence/absence of reflections and feedback)  
- support needs (where reflections or feedback are missing)  

**And** they see no:

- scores, averages, or percentages  
- performance rankings  
- punitive indicators  
- aggregated metrics  

---

## F. Invariants — No Computation

### F1. No Scoring or Computation
**Given** any Phase 3 record  
**Then** the system must not:

- assign scores to reflections or feedback  
- calculate averages or percentages  
- compute totals or aggregates  
- derive alignment scores  
- run background aggregation jobs  

---

### F2. No Ranking or Comparison
**Given** multiple Reflections or Feedback records  
**Then**:

- the system does not rank teachers or students  
- no comparisons are shown between individuals  
- no "performance" indicators exist  

---

## G. Phase Boundary Enforcement

### G1. No Modification to Phase 2
**Given** Phase 3 is implemented  
**Then**:

- no Phase 2 tables are modified  
- Phase 2 tables are referenced read-only only  
- no foreign keys from Phase 2 tables point to Phase 3 tables  

---

### G2. Qualitative Only
**Given** any Reflection or Feedback  
**Then**:

- all content is narrative text  
- no numeric values exist (except `display_order` which is UI-only)  
- no scoring scales are used (unless non-numeric labels)  

---

## H. Acceptance Gate

### H1. Phase 3 Pass Condition
Phase 3 Reflection & Feedback System is accepted **if and only if**:

- Teachers can create and edit reflections  
- Students can provide quarterly feedback  
- Admins can monitor completion status  
- Perception alignment views exist (thematic only, no computation)  
- No math exists anywhere in Phase 3  
- All reflections and feedback are reversible and editable  
- System functions across mixed programs and ages  
- No Phase 2 tables are modified  
