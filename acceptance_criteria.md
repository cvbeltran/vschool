# Acceptance Criteria  
## Feature: OBS + AMS (Phase 2 – Pedagogy Core)

---

## A. OBS — Structure of Meaning

### A1. Domain Creation
**Given** an Admin or Principal  
**When** they create a Domain  
**Then** the Domain:

- has a name and description only  
- contains no numeric fields  
- cannot be assigned weights, scores, or levels  
- is reusable across programs  

**And** the system does not compute anything from Domains.

---

### A2. Competency Creation
**Given** an existing Domain  
**When** an Admin or Principal creates a Competency  
**Then** the Competency:

- belongs to exactly one Domain  
- represents a human capability  
- has no numeric properties  
- is not time-bound or grade-bound  

---

### A3. Indicator Creation
**Given** an existing Competency  
**When** an Admin or Principal creates an Indicator  
**Then** the Indicator:

- describes an observable signal  
- has no points, levels, bands, or weights  
- cannot be ranked or ordered numerically  
- exists only as qualitative evidence reference  

**And** the system does not calculate mastery from Indicators.

---

## B. AMS — Experiences

### B1. Experience Creation
**Given** a Mentor or Teacher  
**When** they create an Experience  
**Then** the Experience:

- represents a learning activity  
- may exist without linking to any competency  
- may link to one or many competencies  
- does not require assessment  

**And** the system does not force observation upon Experience creation.

---

### B2. Competency Linkage to Experience
**Given** an Experience  
**When** competencies are linked  
**Then** each link must declare **Emphasis** as:

- Primary  
- Secondary  
- Contextual  

**And Emphasis:**

- is non-numeric  
- does not compute  
- does not influence competency levels  
- exists only as guidance  

---

## C. Observations (Core Action)

### C1. Observation Creation
**Given** a Mentor or Teacher  
**And** an existing Experience  
**When** they record an Observation for a learner  
**Then** the Observation:

- is tied to exactly one learner  
- references one Experience  
- lists which Indicators were observed  
- allows qualitative notes  
- requires mentor selection of a competency level  

---

### C2. Human Judgment Enforcement
**Given** an Observation  
**When** a competency level is selected  
**Then:**

- the selection is manual  
- no default value is pre-selected  
- no suggestion or recommendation is shown  
- no inferred level appears  

**And** the system never auto-populates competency levels.

---

### C3. Observation Reversibility
**Given** an existing Observation  
**When** a Mentor edits or withdraws it  
**Then:**

- all fields are editable  
- no downstream recalculation occurs  
- no historical mastery state is locked  

---

## D. Invariants — Math & Aggregation

### D1. No Scoring or Computation
**Given** any OBS or AMS record  
**Then** the system must not:

- assign scores  
- calculate averages  
- compute totals  
- derive mastery states  
- run background aggregation jobs  

---

### D2. No Rollups
**Given** multiple Observations for a learner  
**Then:**

- the system does not roll them up  
- no automatic competency or domain status appears  
- no progress indicators are shown  

---

## E. Roles & Permissions

### E1. Authoring Rights
**Given** a user role  
**Then:**

- Admin / Principal can create OBS structures  
- Mentors / Teachers can create Experiences and Observations  
- Registrar can view only  
- Students / Guardians have read-only access  

---

### E2. Visibility Boundaries
**Given** a Student or Guardian  
**When** they view OBS + AMS data  
**Then** they see:

- experiences participated in  
- observed competencies  
- mentor notes (if permitted by policy)  

**And** they see no scores, rankings, or comparisons.

---

## F. UX Guarantees

### F1. Numeric Suppression
**Given** any OBS or AMS screen  
**Then:**

- no numeric values are visible  
- no percentages or charts appear  
- no progress bars are rendered  

---

### F2. Guidance-First UX
**Given** an empty state  
**Then** the UI:

- explains what to do next  
- uses human language  
- avoids technical or schema terminology  

---

## G. Phase Boundary Enforcement

### G1. Scope Containment
**Given** Phase 2 is complete  
**Then** the system:

- shows observed competencies only  
- does not generate reports  
- does not translate to compliance formats  
- does not compute readiness or proficiency  

**And** any such features are deferred to later phases.

---

## H. Acceptance Gate

### H1. Phase 2 Pass Condition
Phase 2 OBS + AMS is accepted **if and only if**:

- Observations can be created and edited  
- No math exists anywhere in OBS or AMS  
- Mentor judgment is the only source of competency levels  
- Data remains reversible  
- System functions across mixed programs and ages  
