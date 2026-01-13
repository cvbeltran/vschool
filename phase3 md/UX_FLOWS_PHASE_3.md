# UX Flow Summary - Phase 3 Reflection & Feedback System

## Overview

This document describes the user experience flows for Phase 3 Reflection & Feedback System. All flows maintain the formative, qualitative nature of the system with no computation, scoring, or aggregation.

---

## Teacher Reflection Flow

### Entry Point
Teacher navigates to "My Reflections" from dashboard or navigation menu.

### Reflection Creation

1. **Select Time Period** (Optional):
   - Dropdown: School Year (optional)
   - Dropdown: Quarter (optional: "Q1", "Q2", "Q3", "Q4")
   - Both fields are informational only, no computation

2. **Select Experience** (Optional):
   - Searchable dropdown of experiences (from Phase 2)
   - Shows experience name, type, and date range
   - Read-only reference (no modification to experiences table)
   - Can be left empty for general reflection

3. **Select Reflection Prompt** (Optional):
   - Dropdown of active reflection prompts for organization
   - Shows prompt text and description
   - Can be left empty for free-form reflection

4. **Reference Competency** (Optional):
   - Searchable dropdown of competencies (from Phase 2)
   - Shows competency name and domain
   - Read-only reference (no modification to competencies table)
   - Can be left empty

5. **Write Reflection**:
   - Large text area for narrative reflection text
   - Required field (cannot be empty)
   - No character limit enforced
   - No formatting restrictions (plain text or rich text)

6. **Set Status**:
   - Radio buttons or dropdown: "Draft" or "Completed"
   - Default: "Draft"
   - Can be changed at any time

7. **Save**:
   - "Save as Draft" button
   - "Mark as Completed" button (sets status to completed)
   - Both actions save the reflection

### Reflection Editing

1. **View List**:
   - Table or card view of all reflections (draft and completed)
   - Columns/cards show:
     - Reflection text preview (truncated)
     - Time period (if specified)
     - Experience name (if linked)
     - Reflection prompt (if linked)
     - Status (draft/completed)
     - Date reflected
   - Filter options:
     - By status (draft/completed/all)
     - By school year
     - By quarter
     - By experience
   - Sort options:
     - By date reflected (newest/oldest)
     - By status

2. **Edit Reflection**:
   - Click on any reflection to open edit view
   - All fields are editable (including completed reflections)
   - Can change status between draft and completed
   - Can modify reflection text, time period, experience link, etc.
   - No restrictions on editing completed reflections

3. **Delete/Archive**:
   - "Archive" button (soft delete via `archived_at`)
   - Archived reflections are hidden from default view
   - Can be restored if needed

### Perception Alignment View

1. **View Own Reflections**:
   - List of teacher's own reflections
   - Full visibility of all reflection content

2. **View Aligned Student Feedback**:
   - Student feedback that aligns with teacher's reflections via:
     - Same reflection prompt → feedback dimension alignment
     - Same experience (if reflection links to experience)
     - Same time period (school year/quarter)
   - Feedback display:
     - If `is_anonymous = TRUE`: Shows feedback text only, no student name
     - If `is_anonymous = FALSE`: Shows feedback text with student name
   - No scores, percentages, or aggregated metrics shown
   - Thematic alignment only (presence/absence of feedback)

3. **No Comparison**:
   - No comparison with other teachers
   - No ranking or performance indicators
   - No aggregated statistics

**Visibility Rules**:
- Teachers see only their own reflections
- Teachers see student feedback aligned to their reflections (anonymized if `is_anonymous = TRUE`)
- Teachers cannot see other teachers' reflections

---

## Student Feedback Flow

### Entry Point
Student navigates to "My Feedback" from dashboard or navigation menu.

### Feedback Creation (Quarterly)

1. **Select Quarter** (Required):
   - Dropdown: "Q1", "Q2", "Q3", "Q4"
   - Required field (quarterly feedback requirement)
   - System may prompt for current quarter based on date
   - Informational only, no computation

2. **Select Feedback Dimension** (Required):
   - Dropdown of active feedback dimensions for organization
   - Shows dimension name and description
   - Required field (must select a dimension)
   - Dimensions align with teacher reflection prompts

3. **Select Experience** (Optional):
   - Searchable dropdown of experiences (from Phase 2)
   - Shows experience name, type, and date range
   - Read-only reference (no modification to experiences table)
   - Can be left empty for general feedback

4. **Select Experience Type** (Optional):
   - Dropdown: "mentoring", "apprenticeship", "lab", "studio"
   - Can be selected even if specific experience is not selected
   - Informational only, no computation

5. **Select Teacher** (Optional):
   - Searchable dropdown of teachers/profiles
   - Shows teacher name
   - Can be left empty for general feedback

6. **Select School Year** (Optional):
   - Dropdown of school years
   - Can be left empty

7. **Write Feedback**:
   - Large text area for narrative feedback text
   - Required field (cannot be empty)
   - No character limit enforced
   - No formatting restrictions (plain text or rich text)

8. **Anonymization Preference**:
   - Checkbox: "Make this feedback anonymous"
   - Default: unchecked (not anonymous)
   - If checked, sets `is_anonymous = TRUE`
   - Privacy support only, does not compute anything

9. **Set Status**:
   - Radio buttons or dropdown: "Draft" or "Completed"
   - Default: "Draft"
   - Can be changed at any time

10. **Save**:
    - "Save as Draft" button
    - "Mark as Completed" button (sets status to completed)
    - Both actions save the feedback

### Feedback Editing

1. **View List**:
   - Table or card view of all feedback (draft and completed)
   - Columns/cards show:
     - Feedback text preview (truncated)
     - Quarter
     - Feedback dimension
     - Experience name (if linked)
     - Teacher name (if specified)
     - Status (draft/completed)
     - Date provided
     - Anonymization status
   - Filter options:
     - By status (draft/completed/all)
     - By quarter
     - By school year
     - By experience
     - By teacher
   - Sort options:
     - By date provided (newest/oldest)
     - By status
     - By quarter

2. **Edit Feedback**:
   - Click on any feedback to open edit view
   - All fields are editable (including completed feedback)
   - Can change status between draft and completed
   - Can modify feedback text, quarter, dimension, etc.
   - Can change anonymization preference
   - No restrictions on editing completed feedback

3. **Delete/Archive**:
   - "Archive" button (soft delete via `archived_at`)
   - Archived feedback is hidden from default view
   - Can be restored if needed

### Feedback History

1. **Quarterly Completion View**:
   - Visual indicator showing which quarters have completed feedback
   - Shows:
     - Q1: Completed / Draft / Missing
     - Q2: Completed / Draft / Missing
     - Q3: Completed / Draft / Missing
     - Q4: Completed / Draft / Missing
   - No percentages or scores shown
   - Presence/absence indicators only

2. **Past Feedback**:
   - View all past quarterly feedback
   - Filter by school year
   - No aggregation or computation

**Visibility Rules**:
- Students see only their own feedback
- Students cannot see other students' feedback
- Students cannot see teacher reflections (unless explicitly shared)

---

## Admin Monitoring View

### Entry Point
Admin navigates to "Reflections & Feedback" monitoring dashboard from admin menu.

### Completion Status View

1. **Teacher Reflection Status**:
   - Table showing:
     - Teacher name
     - School (if multi-school)
     - Reflection count (presence only, no computation)
     - Status breakdown: Completed / Draft / Missing
     - Last reflection date
   - Filter options:
     - By school
     - By school year
     - By quarter
   - Sort options:
     - By teacher name
     - By completion status (presence/absence only)
     - By last reflection date
   - No scores, percentages, or rankings shown

2. **Student Feedback Status**:
   - Table showing:
     - Student name
     - School (if multi-school)
     - Quarter completion status (Q1, Q2, Q3, Q4)
     - Each quarter shows: Completed / Draft / Missing
     - Last feedback date
   - Filter options:
     - By school
     - By school year
     - By quarter
   - Sort options:
     - By student name
     - By completion status (presence/absence only)
     - By last feedback date
   - No scores, percentages, or rankings shown

### Thematic Alignment View

1. **Reflection Presence**:
   - List of teachers who have reflections
   - Shows reflection count (presence only, no computation)
   - Shows time periods covered
   - No aggregation or computation

2. **Feedback Presence**:
   - List of students who have provided feedback
   - Shows feedback count per quarter (presence only, no computation)
   - Shows time periods covered
   - No aggregation or computation

3. **Alignment Indicators**:
   - Shows where reflections and feedback exist for same:
     - Time period (school year/quarter)
     - Experience (if both reference same experience)
     - Dimension/prompt alignment
   - Thematic alignment only (presence/absence)
   - No alignment scores or percentages

### Support Identification

1. **Teachers Needing Support**:
   - List of teachers with:
     - No reflections
     - Only draft reflections (no completed)
   - Formative indicators only (not punitive)
   - Suggests support, not evaluation

2. **Students Needing Support**:
   - List of students with:
     - Missing quarterly feedback
     - Only draft feedback (no completed)
   - Formative indicators only (not punitive)
   - Suggests support, not evaluation

3. **Support Actions**:
   - "Send Reminder" button (if implemented)
   - "View Details" link to see specific gaps
   - No punitive actions or indicators

**Visibility Rules**:
- Admins see all reflections and feedback within their organization
- Admins see completion status only (not content unless explicitly permitted by policy)
- Admins see thematic alignment (presence/absence) only
- No scores, percentages, or rankings shown

---

## Registrar View

### Entry Point
Registrar navigates to "Reflections & Feedback" (read-only) from registrar menu.

### View
- Same as Admin Monitoring View but read-only
- Cannot create or edit reflections or feedback
- Cannot create or edit reflection prompts or feedback dimensions
- Can view completion status and thematic alignment
- Can export data (if implemented)

**Visibility Rules**:
- Same as Admin (read-only)

---

## Role-Based Access Summary

| Role | Can Create Reflections | Can Create Feedback | Can View Own | Can View Others | Can View Alignment | Can Create Prompts/Dimensions |
|------|----------------------|---------------------|--------------|-----------------|-------------------|------------------------------|
| Teacher | Yes | No | Yes | No (except aligned student feedback) | Yes (own + aligned) | No |
| Student | No | Yes | Yes | No | No | No |
| Admin | No | No | N/A | Yes (all in org) | Yes (all in org) | Yes |
| Registrar | No | No | N/A | Yes (read-only, all in org) | Yes (read-only, all in org) | No |

---

## UX Principles

1. **No Numeric Values**: No scores, percentages, averages, or counts shown (except simple presence indicators)
2. **Qualitative Focus**: All inputs and displays emphasize narrative text
3. **Reversibility**: All actions are reversible (edit, archive, restore)
4. **Formative Tone**: Language emphasizes growth and insight, not evaluation
5. **Clear Guidance**: Empty states and help text guide users without technical jargon
6. **Privacy Respect**: Anonymization options clearly explained and respected
7. **No Comparison**: No ranking, comparison, or performance indicators anywhere

---

## Empty States

### Teacher Reflections Empty State
- Message: "Start reflecting on your teaching practice"
- Guidance: "Reflections help you think about what worked, what didn't, and what you'd change"
- Action: "Create Your First Reflection" button

### Student Feedback Empty State
- Message: "Share your learning experience"
- Guidance: "Your feedback helps improve the learning experience for everyone"
- Action: "Provide Feedback" button

### Admin Monitoring Empty State
- Message: "No reflection or feedback data yet"
- Guidance: "Once teachers and students start using the system, you'll see completion status here"
- No action (informational only)

---

## Error States

### Validation Errors
- Clear, human-readable error messages
- No technical jargon
- Guidance on how to fix errors

### Permission Errors
- Clear message explaining why action is not allowed
- Suggestion to contact admin if needed

### Data Errors
- Graceful handling of missing referenced data
- Clear indication when linked experience/competency is archived
- No broken references or crashes

---

**End of UX Flow Summary**
