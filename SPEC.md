# Build Prompt for Antigravity — QIP Workshop Web App (CHRIST BYC)

> **How to use this file**
> 1. Create an empty project folder. Put this file in it as `SPEC.md`, and put the companion files `firestore.rules` and `roster_template.csv` in the same folder.
> Also copy the `seed/` folder (sessions.json, activities.json, activities.schema.json) into the project.
> 2. In Antigravity, open the folder, choose **Planning** mode, and paste **Section A (Master Prompt)** into the agent.
> 3. Review and approve the Implementation Plan artifact before the agent writes any code.
> 4. Then give the agent the **Phase prompts in Section B**, one at a time. Test each phase before you start the next.
> 5. Fill in every `<<PLACEHOLDER>>` before starting.

---

## SECTION A — MASTER PROMPT (paste this first)

You are building a secure, production-grade web application for CHRIST (Deemed to be University), Bangalore Yeshwanthpur Campus (BYC). It runs the hands-on activities of a 3-day HRDC Quality Improvement Programme (QIP) titled **"Shaping Future-Ready Graduates: T-Shaped Learning, Academic Rigour and Academic Transformation"**, 28–30 September 2026. Faculty members complete structured worksheet activities in each session. Heads of Department (HoDs) control which activities are open for their department. Administrators view analysis across departments.

Read `SPEC.md` (this file), `firestore.rules`, `roster_template.csv` and the `seed/` folder completely before planning. **Produce an Implementation Plan artifact and wait for my approval before writing code.** Do not invent requirements. If something is ambiguous, list it in the plan as an open question.

### 1. Tech stack (use exactly this unless I approve a change)

**Confirmed decisions:** Google Workspace SSO · Spark plan only · Dean/Associate Dean/HRDC are view-only · individual responses with a group label · no Facilitator role · all BYC departments from day one.
- **Frontend:** React 18 + TypeScript + Vite, React Router, Tailwind CSS. Use Recharts for charts, Papaparse for CSV, and SheetJS (`xlsx`) for Excel export.
- **Backend:** Firebase, using the modular Web SDK v10+ only (never the compat SDK):
  - Firebase Authentication (Google sign-in only; CHRIST runs on Google Workspace)
  - Cloud Firestore (Native mode, region `asia-south1` Mumbai)
  - Firebase Hosting
  - Firebase App Check (reCAPTCHA Enterprise or reCAPTCHA v3)
- **Plan:** the Firebase **Spark (free)** plan. This is final. Do NOT use Cloud Functions, custom claims, blocking functions, Secret Manager, or any feature that requires Blaze. All authorisation must work through Firestore Security Rules that read the `roster` collection.
- **Tests:** Vitest for unit tests. `@firebase/rules-unit-testing` with the Firestore Emulator for security-rules tests.

### 2. Roles
| Role | Who | Can do |
|---|---|---|
| **Participant** | Faculty members of BYC | Sign in. See only the activities their HoD has enabled for their department. Fill in, save drafts and submit their own responses. Maintain their own "working document". View their own past responses. |
| **HoD** | One (or more) per department | Everything a Participant can do, **plus**: enable or disable, and lock or unlock, each activity for **their own department only**. Live submission tracker (who has and hasn't submitted). Analysis dashboards and exports for their own department only. |
| **Admin – App Admin** | Technical administrator | Everything, **plus**: bulk-upload the roster, manage departments, sessions and activity content (seed/import JSON), override any department's activity state, view the audit log. |
| **Admin – Dean / Associate Dean / HRDC** | Leadership and HRDC (confirmed view-only) | **Read-only** analysis across all departments, cross-department comparison, and exports. They cannot change the roster, content or activity states. |

There is **no Facilitator role**. Resource persons use the HoD's projected screen.

The app serves **all BYC departments from day one**. Every query, toggle and analysis is scoped by `department`.

The role is decided **only** by the `roster` document whose ID is the user's lowercase email. It is never taken from anything the client sends.

### 3. User onboarding — bulk upload
- The App Admin uploads a CSV or XLSX with the columns `Name, Department, Email ID, Role, Admin Type` (see `roster_template.csv`).
- Validation, shown in a preview table before committing:
  - Email must match `^[a-z0-9._%+-]+@christuniversity\.in$`. Lowercase and trim every email.
  - Role must be one of `Participant | HoD | Admin`. Admin Type is required when Role = Admin: `App Admin | Dean | Associate Dean | HRDC`.
  - Flag duplicate emails within the file and emails already in the roster. Offer "skip" or "update".
  - Department names are normalised to a `departmentId` slug. Unknown departments are listed for confirmation and then created in `departments`.
- Commit using batched writes (maximum 500 per batch), and show a progress bar.
- Write one audit log entry per upload.
- Deactivate users by setting `active: false`. Never hard-delete.
- Provide a "Download current roster" export.

### 4. Authentication (CHRIST email only)
- Sign-in is **Google only** (CHRIST email runs on Google Workspace). Do not enable email/password, anonymous, phone, Microsoft or any other provider.
- Use `GoogleAuthProvider` with `setCustomParameters({ hd: 'christuniversity.in', prompt: 'select_account' })`. `hd` is only a UI hint. The real check is in the Security Rules: `sign_in_provider == 'google.com'`, `email_verified == true`, and the email domain.
- Use `signInWithPopup`, and fall back to `signInWithRedirect` on mobile browsers that block popups.
- After sign-in, the app reads `roster/{lowercaseEmail}`:
  - If the document does not exist, or `active == false`: sign the user out and show "Your email is not registered for this programme. Please contact the QIP Coordinator." Do not reveal anything else.
  - Otherwise, route by role to `/participant`, `/hod` or `/admin`.
- In the Firebase Console:
  - Keep only the production Hosting domain(s) and `localhost` in **Authorized domains**.
  - Turn on **email enumeration protection**.
- Route guards in React are for user experience only. **Every permission must also be enforced in `firestore.rules`.**

### 5. Firestore data model
Use exactly these collections. Document IDs are deterministic so that the Security Rules can check them.

```
roster/{emailLower}
  email, name, department (departmentId), role: 'participant'|'hod'|'admin',
  adminType: 'app_admin'|'dean'|'associate_dean'|'hrdc'|null, active: bool,
  uploadedBy, uploadedAt

departments/{departmentId}
  name, campus: 'BYC'

sessions/{sessionId}                       // e.g. d2s1
  day: 1|2|3, date, slot: 'I'|'II'|'III'|'IV', time, title, facilitator, order

activities/{activityId}                    // e.g. d2s1_a2_threshold_concepts
  sessionId, order, title, instructions (markdown), sourceRef (file + page),
  widgetType (see §6), config (widget-specific JSON), timeLimitMin?,
  groupMode: 'individual'|'group',   // group => each person still submits their OWN response, plus a groupLabel
  carryForward?: { readKeys[], writeKeys[] },
  scoring?: { method, bands[] }

activityState/{departmentId}__{activityId}
  department, activityId, sessionId, enabled: bool, locked: bool, updatedBy, updatedAt

responses/{activityId}__{emailLower}
  activityId, sessionId, department, email, uid, name, answers (map),
  status: 'draft'|'submitted', groupLabel?, confidential: bool (copied from the activity; rules verify it),
  createdAt, updatedAt, submittedAt?

progress/{activityId}__{emailLower}        // status only, NEVER answers; written in the same batch as the response
  activityId, sessionId, department, email, name, status, groupLabel?, updatedAt

summaries/{departmentId}__{activityId}      // anonymous summary of a CONFIDENTIAL activity; written only by App Admin console
  department, activityId, n, itemStats {itemId: {mean, sd, dist[1..5]}}, sectionStats, totalStats,
  bandCounts, comments [shuffled, no names], suppressed: bool, updatedAt

workingDocs/{emailLower}
  email, department, fields (map), updatedAt      // carried from Day 2 S-I to Day 3 S-IV

auditLog/{autoId}
  actor, action, target, details, at
```
- **Do not store any computed score as trusted data.** Compute scores for display on the client, and **recompute them from `answers`** in the analytics views.
- Required composite indexes (write them into `firestore.indexes.json`):
  - `responses`: `department ASC, activityId ASC`
  - `responses`: `activityId ASC, department ASC`
  - `responses`: `department ASC, activityId ASC, confidential ASC`
  - `progress`: `department ASC, activityId ASC`
  - `activityState`: `department ASC, sessionId ASC`
  - `roster`: `department ASC, role ASC`

### 6. Activity engine — reusable widget types
The activity content lives in Firestore (`activities`) and is imported from a seed file (`seed/activities.json`, which I will supply). Build a generic renderer that picks the component from `widgetType`. **Group work:** every participant submits their own response. When `groupMode == 'group'`:
- Show the top-level `groupProtocol` text from `activities.json` as a highlighted banner at the top of the activity.
- Show the activity's `groupSetup` (e.g. "Programme teams: 3-6 faculty…") as a chip beside the title.
- Show a required **Group** dropdown built from the top-level `groupLabels` list ("Group 1" to "Group 20"). Store the choice as `groupLabel`.
  - Do **not** use a free-text field; typos would split one group into several.
  - Pre-select the group the participant chose in their most recent group activity in the same session. They can change it.
- Analytics and the HoD live tracker can filter and group responses by `groupLabel`, and show "Group 3: 4 members submitted" style counts. Every widget supports: instructions panel, autosave draft (debounced 2 s), Submit, a read-only view after the activity is locked, and a countdown when `timeLimitMin` is set.

| widgetType | What it renders | Used for (examples) |
|---|---|---|
| `rating_scale` | Items grouped into sections, each rated on a configurable scale (e.g. 1–5 with labels). Section subtotals, grand total, interpretation band. | Academic Rigour Checklist (52 items, /260); 32-item Teaching-Learning questionnaire (/160); Dean's 15-point scorecard (/75) |
| `choice_matrix` | Items × categorical options (e.g. Yes/Partly/No; Never→Consistently; Present/Partial/Absent), with an optional evidence text per row | Disciplinary Depth Audit Parts C, F, G; "Doing → Deep Learning" mapping; Felten five-principle audit |
| `rank_order` | Drag-and-drop ranking with a keyboard-accessible alternative | Depth Audit Part A (rank 10 characteristics) |
| `checklist` | Tick all that apply, with an optional "other" | Depth Audit Part E; case-study root-cause ticks |
| `table_entry` | Dynamic rows with defined columns (text, number 1–5, select). Optional computed column. Min/max rows. | Threshold concepts table; Department Action Plan; Priority matrix (Impact × Urgency × Feasibility) |
| `fixed_grid` | Fixed row labels × fixed column labels, text in each cell | Vertical curriculum map (9 dimensions × Year 1–4) |
| `crm_matrix` | Cognitive Rigour Matrix: 6 Bloom rows × 4 DOK columns. The participant adds items (CO / unit / assessment) and places each in a cell. Shows a heat map of their own placements. | Measuring Cognitive Depth (DOK + CRM) |
| `free_text` | One or more reflection questions, each with a character limit | Reflection questions, case-study discussion answers |
| `working_doc` | Form bound to `workingDocs/{email}.fields`. Later activities can read these fields (read-only) through `carryForward.readKeys`. | Register the working document; rewritten assessment item; issue-based unit |
| `poll` | Single choice or multiple choice, with a live results bar (HoD view) | "Sort the Scholarship", quick SoTL activities |

| `composite` | An ordered list of `parts`, each with its own `widgetType` + `config` (and optional `label`). Answers are stored as `answers[partId]`. | Case studies, Activity 1 mapping, Activity 2 rewrite, SoTL plan |
| `ladder_game` | Climbing the Ladder: shared stimulus, 6 Bloom levels (10–35 points), 60 s per level, bank or risk | Optional HOT game. **Build last, as a stretch goal.** |

**Config conventions used in `seed/activities.json`** (read the file and the schema; do not change the content):
- `config.reflections: [{id, prompt, maxChars}]` can appear on any widget. Render these as text questions below the main widget.
- `config.context`: background text (case studies). Show it in a collapsible panel above the activity.
- `config.evidence: true` (`rating_scale`, `choice_matrix`): add an optional evidence text box per item.
- `config.computed` on `table_entry`:
  - `ratio_by_category`: sum of `valueColumn` grouped by `categoryColumn`, shown as % against `target`.
  - `sum`: column total, with a warning if it is not `expect`.
  - `row_sum`: an extra read-only column adding the listed columns.
- `derived: true`: show a small "Adapted activity" badge. These activities are the facilitator's design, built from the principles in the source documents rather than copied from a worksheet.
- `sourceRef`: show it as a small "Source" line under the activity title.
- `instructions`: every activity has them. Show them in a panel that is expanded by default and can be collapsed. Keep "Suggested time: N min" visible.
- `carryForward.readKeys`: show those `workingDocs.fields` read-only at the top of the activity ("From your working document").
- `carryForward.writeKeys`: when the participant submits, copy the answers into `workingDocs.fields` using a merge write.
  - For `working_doc` fields, the field `key` is the write key.
  - Otherwise `carryForward.writeFrom[key]` names the source: a part ID (`"p3"`) or a part and question (`"p3.q1"`).
- **Answer shape** (store exactly this; analytics depends on it):
  - `rating_scale` → `{itemId: number, itemId_ev?: string}`
  - `choice_matrix` → `{itemId: optionText, itemId_ev?: string}`
  - `rank_order` → `{order: [optionId, ...]}`
  - `checklist` → `{selected: [optionId], other?: string}`
  - `table_entry` → `{rows: [{colId: value}]}`
  - `fixed_grid` → `{cells: {"rowIndex_colIndex": string}}`
  - `crm_matrix` → `{items: [{type, text, bloom, dok}]}`
  - `free_text` → `{qId: string}`
  - `working_doc` → `{fieldKey: string}`
  - `poll` → `{qId: optionId | [optionId]}`
  - Reflections → `{reflections: {rId: string}}`
  - `composite` → `{partId: <that part's shape>}`

**Scoring config examples** (in `config`/`scoring`): the section item lists, the scale min/max/labels, and bands such as `[{min:220,max:260,label:'Exemplary'}, {min:180,max:219,label:'Strong'}, {min:140,max:179,label:'Developing'}, {min:0,max:139,label:'Significant enhancement required'}]`.

### 7. Screens

**Participant**
- Home: Day tabs (Day 1 / Day 2 / Day 3) → session cards → activities. Only activities that are enabled for their department appear, updated live with `onSnapshot`. Locked activities appear as read-only.
- Activity page (the widget).
- "My Working Document" page.
- "My Responses" page.

**HoD Console**
- Session board showing all 12 sessions and their activities, with toggles:
  - **Enable** (make visible and open)
  - **Lock** (stop edits, keep visible)
  - **Disable** (hide)
  - Bulk actions: "Enable all in this session" and "Lock all in this session".
- Every toggle writes to `activityState` and to `auditLog`.
- Live tracker for each activity: submitted, draft and not-started counts against the department roster, with names. The HoD can project this. **The tracker reads `progress`, never `responses`**, so it works the same for confidential activities.
- Department analysis (see §8) and exports.

**Admin Console**
- **App Admin:** roster upload; departments; content import (JSON validator with a dry-run diff); override of activity states; audit log; **Summary Publisher** (see §8A).
- **Dean / Associate Dean / HRDC:** read-only cross-department analytics and exports.

### 8. Analysis (per activity, per department)
For each activity, the HoD sees their own department and Admins see any or all departments, with a department filter and comparison mode:
- **Participation:** number submitted / roster size (%), drafts, not started.
- **`rating_scale`:** mean and SD per item and per section; section radar chart; distribution of grand totals; count in each interpretation band; the 5 weakest and 5 strongest items.
- **`choice_matrix` / `checklist` / `poll`:** stacked bars per item (count and %).
- **`rank_order`:** mean rank per option, sorted.
- **`crm_matrix`:** a department heat map (count of items per Bloom × DOK cell), and the percentage at DOK 3–4 compared with DOK 1–2.
- **`table_entry` / `fixed_grid` / `free_text` / `working_doc`:** a consolidated, searchable list grouped by participant or group, which can be exported.
- **Session summary page:** all activities of a session on one page, ready for the QIP report.
- **Exports:** CSV and XLSX (one sheet per activity), plus a print-friendly page. Exports include names only for HoD/Admin, and only within the viewer's permission.
- Compute all aggregates on the client from the raw `responses` the user is allowed to read. (Roughly 40–400 participants, so this is fine without a backend.)
- Every HoD/admin query on `responses` must include `where('confidential', '==', false)`, otherwise the rules reject the whole query.

### 8A. Confidential activities (department-perception ratings)
Five `rating_scale` activities have `confidential: true`:
- Teaching-Learning questionnaire
- Academic Rigour Checklist
- Curriculum for Depth
- Five Quality Dimensions
- 15-point Scorecard

In these, faculty rate their own department. To keep the ratings honest:
- **Who can see individual responses:** only the author and the **App Admin**. HoDs and Dean/Associate Dean/HRDC can **not** read them. This is enforced in `firestore.rules`, not just hidden in the UI.
- **What HoDs and admins see:** the anonymous summary in `summaries/{dept}__{activityId}`:
  - item means, SDs and score distributions; section and total means; band counts;
  - reflections and evidence text **with names removed and order shuffled**.
- **Minimum group size:** if fewer than **5** people in the department have submitted, publish `suppressed: true` and no statistics or comments. The HoD sees "Summary appears when at least 5 colleagues have responded."
- **Summary Publisher (App Admin console):**
  - While the page is open, listen (`onSnapshot`) to submitted responses of confidential activities.
  - Recompute each department's summary, debounced every 60 s, and write it to `summaries`.
  - Show "last published" per department and activity, plus a manual "Publish now" button.
  - Tell the App Admin to keep this page open during sessions that use these activities.
- **Tracker:** the HoD still sees who has and hasn't submitted (from `progress`), but never their ratings.
- **Exports:** HoD/Dean exports of confidential activities contain the summary only. Only the App Admin export contains individual rows.
- **Wording:** the participant screen shows the `instructions` text (it already contains the confidentiality note) and a small lock icon: "Confidential: your HoD sees only department averages."

### 9. SECURITY REQUIREMENTS — NON-NEGOTIABLE
**Background:** in a previous project, the Firebase `projectId`, `appId`, `apiKey` and token details were readable in the JS bundle through "View Page Source". Handle it as follows.

**9.1 Understand what can and cannot be hidden**
- The Firebase **web config** (`apiKey`, `authDomain`, `projectId`, `appId`, `messagingSenderId`, `storageBucket`) is a **public identifier, not a secret**. Every Firebase web app ships it to the browser, and it cannot be hidden: obfuscation, environment variables and loading it after login all still end up in the browser.
- Therefore the app must be **safe even if an attacker has the config**. Security comes from 9.3–9.6, not from hiding the config.
- **Real secrets must never appear anywhere in the frontend code or bundle:** service-account JSON, the Admin SDK, private keys, the reCAPTCHA *secret* key, SMTP passwords, Gemini/OpenAI or any other third-party API keys, and hard-coded ID or access tokens.
  - If a feature ever needs a secret, stop and ask me. It is out of scope on the Spark plan; do not work around this.

**9.2 Config and repository hygiene**
- Put the config in `.env.local` as `VITE_FIREBASE_*` variables. Commit `.env.example` with empty values. Add `.env*` (except `.env.example`) to `.gitignore`.
  - This keeps the values out of Git history. It does *not* keep them out of the bundle, which is acceptable per 9.1.
- Never commit `firebase-debug.log`, service-account files, App Check debug tokens or `.firebaserc` secrets.
- Add a pre-commit check (e.g. `gitleaks` or a simple grep script) that blocks commits containing `private_key`, `BEGIN PRIVATE KEY`, `AIza` outside `.env*`, `sk-` or `service_account`.
- Production build:
  - `build.sourcemap = false`.
  - Strip `console.*` and `debugger` (esbuild `drop`).
  - Never log ID tokens, user objects or config.
  - Never write tokens to `localStorage` yourself. Use the SDK's persistence only.

**9.3 Firestore Security Rules (the real protection)**
- Start from the provided `firestore.rules` (deny by default; checks for domain, roster, role, department and activity state; field whitelists; deterministic IDs).
- You may improve it, but **you may not loosen it**. Explain every change in the plan.
- **Mandatory:** write `tests/rules.test.ts` using `@firebase/rules-unit-testing` on the emulator. Cover at least:
  1. A non-CHRIST email (e.g. gmail.com) cannot read anything.
  2. A CHRIST email that is not in the roster cannot read anything.
  3. An inactive roster user is denied.
  4. A participant cannot read another participant's response.
  5. A participant cannot write a response when the activity is disabled or locked for their department.
  6. A participant cannot write a response tagged with another department, another email, or an ID that does not match.
  7. A participant cannot change their own role or roster document.
  8. A HoD cannot toggle another department's activity.
  9. A HoD cannot read another department's responses.
  10. Dean, Associate Dean and HRDC admins can read all data but cannot write roster, content or activity state.
  11. Only the App Admin can write roster and activity content.
  12. No one can delete responses or audit logs.
  13. A HoD cannot read a confidential response from their own department (a `get` is denied, and a list query without the `confidential == false` filter is denied).
  14. A Dean/Associate Dean/HRDC admin cannot read a confidential response. The App Admin can.
  15. A participant cannot create a response with `confidential: false` for a confidential activity, and cannot change `confidential` on update.
  16. A HoD can read `summaries` and `progress` for their own department only. Participants cannot write `summaries`. Only the App Admin can write them.
  17. A participant cannot write a `progress` doc for another person, another department, or a disabled/locked activity.
- **All tests must pass before any deploy.**
- Storage is not used. Deploy `storage.rules` as deny-all (`allow read, write: if false;`) in case Storage is ever enabled.

**9.4 Firebase App Check**
- Register the web app with reCAPTCHA Enterprise (or v3). Only the *site key* goes in the frontend. The *secret key* stays in the Firebase Console.
- Initialise App Check before any Firestore call.
- Run in monitor mode during testing, then **enforce** App Check for Firestore (and Authentication, if available) before the QIP starts.
- Debug tokens are for localhost only, are set through an environment variable, and are never committed.

**9.5 API key restriction (Google Cloud Console → APIs & Services → Credentials)**
- Restrict the browser API key by **HTTP referrer** to: `https://<<PROJECT>>.web.app/*`, `https://<<PROJECT>>.firebaseapp.com/*`, any custom domain, and `http://localhost:5173/*` (remove localhost after go-live).
- Restrict it by **API** to only what the app needs: Identity Toolkit API, Token Service API, Cloud Firestore API, Firebase Installations API and Firebase App Check API.
- If the old project's key was exposed, **create a new restricted key** and delete the old one.

**9.6 Hosting hardening (`firebase.json` headers)**
- `Content-Security-Policy`: allow only self and the required Google/Firebase/reCAPTCHA origins. No `unsafe-eval`.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone and geolocation disabled)

**9.7 Operations**
- Set a budget alert on the project, even on Spark.
- Give Firebase Console access to named CHRIST accounts only, with least privilege.
- Before the QIP, run a **security self-check**:
  - `grep` the built `dist/` for `private_key`, `service_account`, `secret`, `sk-`, `Bearer `, `token` and paste the results in a walkthrough artifact.
  - Confirm that no `.map` files are in `dist/`.
  - Paste the passing rules-test output.

### 10. Non-functional requirements
- Mobile-first: faculty will use phones and laptops in the Seminar Hall and B220. Must work over campus Wi-Fi with 40+ concurrent users.
- Accessibility: keyboard navigation, labels, contrast AA.
- Branding: CHRIST colours (navy `#1f3864` and gold `#b8963e`), "HRDC QIP — BYC" header, no external fonts beyond Google Fonts.
- Offline tolerance: enable Firestore persistent cache, so drafts are not lost if Wi-Fi drops.
- No PII in URLs or analytics. Do not add Google Analytics.
- Time zone: IST.

### 11. Seed data
- `seed/sessions.json` (provided) holds the 12 sessions:
  - **Day 1 (28 Sept):** S-I Setting the Vision; S-II The T-Shaped Graduate; S-III Diagnosing Our Department; S-IV From Diagnosis to Direction
  - **Day 2 (29 Sept):** S-I Locating the Threshold; S-II Higher-Order Thinking in Action; S-III Measuring Cognitive Depth (Webb's DOK and CRM); S-IV Building Breadth Through Depth
  - **Day 3 (30 Sept):** S-I Designing the Vertical; S-II Assessing for Depth; S-III From Practice to Scholarship (SoTL); S-IV Consolidating the Department Action Plan
  - Times: S-I 9.15–10.45; S-II 11.15–12.45; S-III 1.45–3.00; S-IV 3.15–4.30
- `seed/sessions.json`, `seed/activities.json` (46 activities across the 12 sessions) and `seed/activities.schema.json` are **provided**. Build an Admin import screen that:
  - validates against the schema,
  - shows a dry-run diff,
  - then writes using the `activityId` / `sessionId` as the document ID.
- Test every widget against its real activity from the seed, not invented samples.
- **Do not edit the activity wording.** Content changes come only through a re-import.

### 12. Deliverables for the Implementation Plan
1. Folder structure
2. Component list
3. Data-access layer (one typed module per collection)
4. Rules changes, if any, with the reason
5. Test plan
6. Deploy steps
7. Risks and open questions

**Wait for my approval before coding.**

---

## SECTION B — PHASE PROMPTS (paste one at a time after the plan is approved)

**Phase 1 — Project setup and security baseline**
> Scaffold the Vite + React + TS + Tailwind project exactly as in the approved plan. Initialise Firebase (Auth, Firestore, Hosting, Emulators) using `.env.local`. Add `.env.example`, `.gitignore`, the pre-commit secret scan, production build settings (no sourcemaps, drop console), `firebase.json` with the security headers, `firestore.rules` (from SPEC), `firestore.indexes.json`, and deny-all `storage.rules`. Write `tests/rules.test.ts` covering all 17 cases in §9.3 and run it against the emulator. Show me the test output. Do not build any UI yet.

**Phase 2 — Authentication and roster**
> Implement Google sign-in (per §4), the roster lookup, the not-registered handling, and role-based routing with guards. Build the App Admin roster upload (CSV/XLSX → validate → preview → batched commit → audit log) and the roster export. Test with `roster_template.csv` in the emulator. Show me screenshots of each state.

**Phase 3 — Content and activity engine**
> Build the sessions and activities import (JSON Schema validation, dry-run diff, commit). Build the generic activity renderer and these widgets: `rating_scale`, `choice_matrix`, `rank_order`, `checklist`, `table_entry`, `fixed_grid`, `free_text`, `working_doc`, `poll`, `crm_matrix`. Include autosave drafts, submit, locked read-only view, timer and carry-forward. Every save writes the `responses` doc and its `progress` doc in one batch; the response copies `confidential` from the activity. Test each widget with a sample activity.

**Phase 4 — HoD console**
> Build the session board with Enable / Lock / Disable (per activity and per session), audit logging, and the live submission tracker with names. Verify in the emulator that a participant's view updates live when the HoD toggles an activity, and that writes are rejected once an activity is locked.

**Phase 5 — Analytics and exports**
> Build the Summary Publisher and the confidential-activity views from §8A first, then the per-activity analytics from §8 for HoD (own department) and Admin (all departments, with a comparison mode), the session summary page, and the CSV/XLSX/print exports. Recompute all scores from raw answers.

**Phase 6 — Hardening and go-live**
> Enable App Check (monitor mode first). Restrict the API key (I will do this in the Console; give me exact click-steps). Remove unused authorized domains. Run the full rules test suite, a production build, and the §9.7 security self-check on `dist/`. Deploy to Firebase Hosting. Produce a walkthrough artifact with the test output, the grep results, the headers check (`curl -I`), and a 40-user load smoke test plan.

---

## SECTION C — My pre-flight checklist (not for the agent)
- [ ] Create a **new** Firebase project (do not reuse the one whose details were exposed). Region `asia-south1`.
- [ ] Final roster CSV (lowercase CHRIST emails, correct departments, HoD rows).
- [ ] Review `seed/activities.json` wording (46 activities; 8 marked as adapted) and re-run `build_seed.py` after any edit.
- [ ] Dry run with 3–4 colleagues on the day before the QIP (Sunday 27 Sept).
- [ ] After go-live: App Check switched to **Enforce**; `localhost` removed from the API-key referrers and from Authorized domains.
