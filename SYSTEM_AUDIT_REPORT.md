# Comprehensive System Analysis Report (Read-Only)

---

## 1. Widget Answer Shapes (`responses/{id}.answers`)

Each widget receives `answers` and triggers `onChange({ ...answers, ... })`, directly persisted into Firestore document `responses/{activityId}__{emailLower}` under the field `answers`.

---

### 1.1 `rating_scale`
* **Source Component:** `src/components/widgets/RatingScaleWidget.tsx`
* **Real Seed Activity ID:** `d1s4_a1_quality_dimensions` (with `evidence: true`) / `d1s1_a2_tl_questionnaire` (with reflections)
* **Exact JSON Shape:**
```json
{
  "q1": 4,
  "q1_ev": "Course syllabus updated in June 2026 with NEP multidisciplinary modules",
  "q2": 5,
  "q2_ev": "Active peer instruction applied weekly in Seminar Hall",
  "q3": 3,
  "q3_ev": "Transitioning mid-term tests to authentic mini-projects",
  "q4": 4,
  "q5": 4
}
```

---

### 1.2 `choice_matrix`
* **Source Component:** `src/components/widgets/ChoiceMatrixWidget.tsx`
* **Real Seed Activity ID:** `d1s3_a4_teaching_for_mastery`
* **Exact JSON Shape:**
```json
{
  "c1": "Consistently",
  "c2": "Frequently",
  "c3": "Frequently",
  "c4": "Occasionally",
  "c5": "Consistently"
}
```
*(When `evidence: true`, e.g., inside `d2s2_a2_doing_to_deep_learning`, it additionally writes `"[itemId]_ev": "string"`).*

---

### 1.3 `rank_order`
* **Source Component:** `src/components/widgets/RankOrderWidget.tsx`
* **Real Seed Activity ID:** `d1s2_a1_depth_ranking`
* **Exact JSON Shape:**
```json
{
  "order": [
    "o1",
    "o3",
    "o2",
    "o5",
    "o4",
    "o7",
    "o6",
    "o8",
    "o9",
    "o10"
  ]
}
```

---

### 1.4 `checklist`
* **Source Component:** `src/components/widgets/ChecklistWidget.tsx`
* **Real Seed Activity ID:** `d1s3_a5_reading_for_depth` (or `d2s4_a1_issue_based_redesign` part `p3` with `allowOther: true`)
* **Exact JSON Shape:**
```json
{
  "selected": [
    "o1",
    "o2",
    "o4"
  ],
  "other": "Industry case studies authored by faculty"
}
```

---

### 1.5 `table_entry`
* **Source Component:** `src/components/widgets/TableEntryWidget.tsx`
* **Real Seed Activity ID:** `d2s1_a2_threshold_concepts`
* **Exact JSON Shape:**
```json
{
  "rows": [
    {
      "concept": "Object-Oriented Polymorphism",
      "difficulty": "Abstract mental model of runtime dispatch vs compile-time types",
      "misconceptions": "Confusing interface inheritance with code reuse",
      "mastery": "Designing decoupled plugin architectures"
    },
    {
      "concept": "Recursion & Induction",
      "difficulty": "Visualizing stack frames and terminal conditions",
      "misconceptions": "Thinking recursively requires loop translation",
      "mastery": "Proving correctness using mathematical induction"
    },
    {
      "concept": "Concurrency & Mutex Locks",
      "difficulty": "Non-deterministic interleaving of threads",
      "misconceptions": "Assuming sequential consistency without barriers",
      "mastery": "Formulating lock-free state machines"
    }
  ]
}
```

---

### 1.6 `fixed_grid`
* **Source Component:** `src/components/widgets/FixedGridWidget.tsx`
* **Real Seed Activity ID:** `d3s4_a1_strategic_plan_15`
* **Exact JSON Shape:**
```json
{
  "cells": {
    "0_0": "Review core algorithms syllabus against benchmark institutions",
    "0_1": "Month 1 (Oct 2026)",
    "0_2": "Curriculum comparison matrix and Board of Studies minutes",
    "1_0": "Align Year 1 programming with Year 3 design patterns",
    "1_1": "Month 2 (Nov 2026)",
    "1_2": "Vertical progression diagnostic rubric"
  }
}
```

---

### 1.7 `crm_matrix`
* **Source Component:** `src/components/widgets/CrmMatrixWidget.tsx`
* **Real Seed Activity ID:** `d2s3_a1_crm_syllabus_map`
* **Exact JSON Shape:**
```json
{
  "items": [
    {
      "type": "Course Outcome",
      "text": "CO1: Formulate asymptotic runtime bounds for divide-and-conquer recurrences",
      "bloom": "Analyze",
      "dok": "DOK 3 - Strategic Thinking / Reasoning"
    },
    {
      "type": "Assessment item",
      "text": "Final Project: Architect an end-to-end distributed key-value store with raft consensus",
      "bloom": "Create",
      "dok": "DOK 4 - Extended Thinking"
    },
    {
      "type": "Unit",
      "text": "Unit 2: Graph traversals and minimum spanning trees",
      "bloom": "Apply",
      "dok": "DOK 2 - Skills and Concepts"
    }
  ]
}
```

---

### 1.8 `free_text`
* **Source Component:** `src/components/widgets/FreeTextWidget.tsx`
* **Real Seed Activity ID:** `d1s4_a6_group_discussion`
* **Exact JSON Shape:**
```json
{
  "q1": "Case 1: Breadth often replaces depth in our introductory semester courses.",
  "q2": "Authentic performance assessments replacing high-stakes rote exams.",
  "q3": "Overpacked syllabi leaving minimal time for student-directed inquiry.",
  "q4": "Introduce inquiry problem sets requiring primary literature citations.",
  "q5": "Establish department-wide threshold concept milestone rubrics."
}
```

---

### 1.9 `working_doc`
* **Source Component:** `src/components/widgets/WorkingDocWidget.tsx`
* **Real Seed Activity ID:** `d2s1_a1_register_working_doc`
* **Exact JSON Shape:**
```json
{
  "programme": "BCA / BSc Computer Science",
  "course": "CS332 - Design and Analysis of Algorithms",
  "semester": "Semester V",
  "discipline": "Computer Science",
  "courseOutcomes": "CO2: Synthesize greedy and dynamic programming strategies for NP-hard approximations.",
  "originalItem": "Write a 5-mark answer distinguishing between Prim's and Kruskal's algorithm."
}
```

---

### 1.10 `poll`
* **Source Component:** `src/components/widgets/PollWidget.tsx`
* **Real Seed Usage (standalone or composite part):** `d1s1_a1_four_pillars` (part `p1`) / `d3s3_a2_sort_scholarship` (part `p1`)
* **Exact JSON Shape:**
  * **Single-choice (`multi: false`):**
  ```json
  {
    "q1": "o2"
  }
  ```
  * **Multi-choice (`multi: true`):**
  ```json
  {
    "q1": [
      "o1",
      "o3"
    ]
  }
  ```

---

### 1.11 `composite`
* **Source Component:** `src/components/widgets/CompositeWidget.tsx`
* **Real Seed Activity ID:** `d1s1_a1_four_pillars` (Part `p1`: poll, Part `p2`: free_text)
* **Exact JSON Shape:**
```json
{
  "p1": {
    "q1": "o2"
  },
  "p2": {
    "q2": "Academic rigour is our primary growth area because course syllabi currently prioritize high breadth coverage over conceptual depth."
  }
}
```

---

### 1.12 `config.reflections`
* **Source Component:** `src/components/widgets/ReflectionsWidget.tsx`
* **Real Seed Activity ID:** `d1s1_a2_tl_questionnaire` (has `reflections: [r1, r2, r3, r4, r5, r6]`)
* **Exact JSON Shape:**
```json
{
  "a1": 4,
  "a2": 4,
  "a3": 3,
  "a4": 3,
  "reflections": {
    "r1": "Faculty dedication, peer mentorship, and interdisciplinary elective options.",
    "r2": "Continuous formative feedback, lab equipment modernization, and reducing rote testing.",
    "r3": "Flipped classroom modules with threshold concept mastery checks.",
    "r4": "A national beacon for evidence-based pedagogy and undergraduate research.",
    "r5": "Collaborative, collegial, and transition-oriented.",
    "r6": "Revamping assessment rubrics to measure authentic code architecture."
  }
}
```

---

### 1.13 Structural Details & Queries Answered

1. **How composite parts nest:**
   * In `CompositeWidget.tsx`, each part has an ID (e.g., `p1`, `p2`).
   * The sub-widget for `partId` is passed `answers[part.id] || {}`.
   * When updated, `CompositeWidget` performs `onChange({ ...answers, [partId]: partAnswers })`.
   * Therefore, composite parts nest under their part ID key at the root of `answers`.
2. **Where reflections are stored:**
   * Handled by `ReflectionsWidget.tsx` and wired in every widget as:
     ```ts
     const currentReflections = answers.reflections || {};
     onChange({ ...answers, reflections: { ...currentReflections, [rId]: text } });
     ```
   * It is always stored under a dedicated nested object `reflections` within that widget's `answers` map: `answers.reflections = { [rId]: string }`.
   * If a composite contains top-level reflections, they are stored at `answers.reflections`. If a sub-part inside a composite has reflections, they nest inside that part: `answers[partId].reflections`.
3. **Whether polls and checklists store option IDs or option text:**
   * **Checklists:** Store **option IDs** (`string[]` of `opt.id`) in `answers.selected`, plus free-form text in `answers.other` if `allowOther: true`.
   * **Polls:** Store **option IDs** (`string` of `opt.id` for single-choice, or `string[]` of `opt.id` for multi-choice) keyed by question ID `[qId]`.
   * *(Note: In contrast, `choice_matrix` stores **option text** `[itemId]: opt`).*
4. **Differences from the answer shapes in SPEC §6:**
   * **None.** Every widget implementation strictly matches SPEC §6:
     * `rating_scale` → `{ [itemId]: number, [itemId_ev]?: string }`
     * `choice_matrix` → `{ [itemId]: optionText, [itemId_ev]?: string }`
     * `rank_order` → `{ order: [optionId, ...] }`
     * `checklist` → `{ selected: [optionId, ...], other?: string }`
     * `table_entry` → `{ rows: [{ [colId]: value }] }`
     * `fixed_grid` → `{ cells: { ["${rIdx}_${cIdx}"]: string } }`
     * `crm_matrix` → `{ items: [{ type, text, bloom, dok }] }`
     * `free_text` → `{ [qId]: string }`
     * `working_doc` → `{ [fieldKey]: string }`
     * `poll` → `{ [qId]: optionId | [optionId] }`
     * `composite` → `{ [partId]: <that part's shape> }`
     * `reflections` → `{ reflections: { [rId]: string } }`

---

## 2. Document Shapes: `progress` & `workingDocs`

### 2.1 `progress/{activityId}__{emailLower}` Document Shape
* **Schema Definition:** `SubmissionProgress` in `src/types/index.ts` & `src/components/ActivityEngine.tsx`
* **Rule:** Status and participant tracking **only**; strictly **NEVER** stores answers (allowing HoDs/trackers to view progress even on confidential activities without violating privacy).
```json
{
  "activityId": "d1s1_a2_tl_questionnaire",
  "sessionId": "d1s1",
  "department": "computer-science",
  "email": "faculty.member@christuniversity.in",
  "name": "Dr. Alan Turing",
  "status": "submitted",
  "groupLabel": "Group 3",
  "updatedAt": "2026-09-28T04:15:30.000Z"
}
```
*(Note: `groupLabel` is omitted or undefined for individual activities).*

---

### 2.2 `workingDocs/{emailLower}` Document Shape
* **Schema Definition:** `WorkingDoc` in `src/types/index.ts` & `src/utils/carryForward.ts`
* **Rule:** Carried forward from Day 2 Session-I across Day 3 redesign activities via `carryForward.writeKeys` and merged on submit.
```json
{
  "email": "faculty.member@christuniversity.in",
  "department": "computer-science",
  "fields": {
    "programme": "BCA / BSc Computer Science",
    "course": "CS332 - Design and Analysis of Algorithms",
    "semester": "Semester V",
    "discipline": "Computer Science",
    "courseOutcomes": "CO2: Synthesize greedy and dynamic programming strategies for NP-hard approximations.",
    "originalItem": "Write a 5-mark answer distinguishing between Prim's and Kruskal's algorithm.",
    "redesignedItem": "A municipal transport authority needs to deploy EV charging hubs with bounded cabling costs. Formulate this as a minimum spanning forest problem with capacity constraints and specify the approximation algorithm.",
    "rubricDimension": "Authentic real-world constraints & algorithm selection justification"
  },
  "updatedAt": "2026-09-29T05:30:00.000Z"
}
```

---

## 3. Codebase File Catalog

### 3.1 Widgets (`src/components/widgets/`)
* `src/components/widgets/ChecklistWidget.tsx` — Renders multi-select checkbox list with optional "other" custom text entry.
* `src/components/widgets/ChoiceMatrixWidget.tsx` — Renders categorical option buttons across item rows with optional per-row evidence fields.
* `src/components/widgets/CompositeWidget.tsx` — Orchestrates multi-part activities, mounting sub-widgets and nesting answers under part IDs.
* `src/components/widgets/CrmMatrixWidget.tsx` — Renders Cognitive Rigour Matrix (6 Bloom × 4 DOK levels) item classifier and personal heatmap.
* `src/components/widgets/FixedGridWidget.tsx` — Renders static 2D grid matrix of row labels by column headers with multiline cell textareas.
* `src/components/widgets/FreeTextWidget.tsx` — Renders reflection prompt textareas with individual character limits and counters.
* `src/components/widgets/PollWidget.tsx` — Renders single- or multi-choice poll questions with radio or checkbox selections.
* `src/components/widgets/RankOrderWidget.tsx` — Renders accessible drag/reorder priority ranking list with move up/down controls.
* `src/components/widgets/RatingScaleWidget.tsx` — Renders sectioned Likert rating scale items with live score calculation, bands, and evidence inputs.
* `src/components/widgets/ReflectionsWidget.tsx` — Renders reusable reflection prompt textareas appended to widget footers.
* `src/components/widgets/TableEntryWidget.tsx` — Renders dynamic-row table with typed columns (text, number, select) and live computed ratio/sum bars.
* `src/components/widgets/WorkingDocWidget.tsx` — Renders form fields bound directly to the user's persistent working document.

### 3.2 Services (`src/services/`)
* `src/services/activityState.ts` — Manages HoD and admin toggles (enable, lock, disable) for activity availability and logs audit entries.
* `src/services/auth.ts` — Handles Firebase Google sign-in authentication flow, `@christuniversity.in` domain verification, and roster validation.
* `src/services/contentImport.ts` — Validates and commits session and activity definitions from seed JSON files to Firestore with dry-run diffs.
* `src/services/summaryPublisher.ts` — Listens to confidential rating scale responses, aggregates anonymous item/section stats, and publishes department summaries.

### 3.3 Pages (`src/pages/`)
* `src/pages/ActivityRunnerPage.tsx` — Resolves route activity parameters, checks department activity state, and mounts the `ActivityEngine`.
* `src/pages/AdminLanding.tsx` — Central admin portal providing tabs for roster uploads, content imports, state overrides, audit logs, and summary publishing.
* `src/pages/AnalyticsPage.tsx` — Departmental analytics dashboard rendering item distribution charts, radar diagrams, heatmaps, and tabular exports.
* `src/pages/HoDLanding.tsx` — Head of Department console hosting the 12-session management board and real-time roster submission tracker.
* `src/pages/LoginPage.tsx` — Secure authentication entry point featuring Google sign-in and unlisted roster warning feedback.
* `src/pages/ParticipantLanding.tsx` — Main participant portal presenting day/session tabs, live activity access badges, and working document links.

---

## 4. Phase 6 Status

| Item | Current Status | Details |
|---|---|---|
| **App Check** | **Not Initialized** | In `src/config/firebase.ts`, App Check is not called (contains `// Note: App Check will be initialized in Phase 6`). Neither `initializeAppCheck`, `ReCaptchaV3Provider`, nor `ReCaptchaEnterpriseProvider` is registered yet. |
| **`firebase.json` Hosting & Headers** | **Configured** | Configured with `public: "dist"`, single-page app rewrite (`** -> /index.html`), and full security headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. |
| **`security:check` script** | **Not Present in `package.json`** | No script named `security:check` exists in `package.json`. However, the underlying pre-commit scanning script is implemented at `scripts/secret-scan.mjs` and wired into `.husky/pre-commit` to prevent committing secrets, private keys, or credentials. |
| **Hosting Deployed?** | **No** | Probing both `https://byc-t-shape-qip.web.app` and `https://byc-t-shape-qip.firebaseapp.com` returns `HTTP/1.1 404 Not Found` (Firebase default site-not-found page). No `.firebaserc` file exists in the repository. |
| **`VITE_FIREBASE_AUTH_DOMAIN`** | **`.firebaseapp.com`** | The value in `.env.local` ends in **`.firebaseapp.com`** (not `.web.app`). |

---

## 5. Git Commit History (`git log --oneline -10`)

```
46461bc implemented phase 5
e33b862 Configure Vercel SPA rewrites and security headers
7caa865 Phase 4: HoD console, live tracker, emulator project fix
e45ea5f Phase 3: activity engine, all widgets, config rule
1c1e150 Phase 2: auth, roster upload, emulator seed guard
14ee3c4 Phase 1: setup, security rules (35 tests), Tailwind v4
```
