# Antigravity Prompts — BYC App Addendum (Feedback, Coordinator Access, Report Generation)

**Before you start:** this builds on the already-deployed `byc-t-shaped-qip` app. Open the **same**
project folder in Antigravity (do not start a new project). Add `SPEC_ADDENDUM.md`,
`firestore.rules.additions.md` and `seed/feedback_form.json` from this package into that folder.
Planning mode, no goal mode, terminal commands ask-for-review — same as every previous phase.

---

## Prompt 0 — Kick-off (plan only, addendum)
```
Read SPEC_ADDENDUM.md completely, plus firestore.rules.additions.md, seed/feedback_form.json, and the
existing SPEC.md and firestore.rules already in this project (treat the existing SPEC.md as still in
force; SPEC_ADDENDUM.md only adds to it, it changes nothing already built). Also open the real
seed/activities.json in this project and find the exact activityId of the Day 3 Session IV "Department
Action Plan" table_entry activity (SPEC_ADDENDUM.md D6/D8.6) — state it in your plan.

Produce an Implementation Plan for this addendum only: which existing files change vs. which are new,
the exact firestore.rules diff (should match firestore.rules.additions.md with no loosening of anything
existing), the new feedback/feedbackSummaries/reportMeta data-access modules, the Report Generation page
structure (D6/D7), the new rules-emulator tests (10 cases listed in firestore.rules.additions.md, run
alongside the existing 17), and open questions. Do NOT write any code yet. Stop and wait for my approval.
```

**Check the plan for:** no change to the existing `responses`/`activityState`/enable-disable-lock
system; the feedback form reuses the existing `composite` renderer (no new widget code); feedback
autosaves every 8 seconds specifically (activities keep their existing 2-second debounce); Coordinator
gaining Analytics & Reports access is a route-guard change only, not a new rules grant; the real
Department Action Plan `activityId` has been located and named; all 27 rules tests (17 existing + 10
new) pass against the emulator.

When it's right, reply: **`Plan approved. Proceed with Phase 1 of the addendum only.`**

---

## Prompt 1 — Phase 1: Rules, data model and the feedback form
```
Phase 1 of the addendum — rules, data model and the feedback form (SPEC_ADDENDUM.md D2-D5).
Add the firestore.rules changes exactly as given in firestore.rules.additions.md (one new helper
function, three new match blocks) without touching or loosening anything already in firestore.rules.
Add the 10 new test cases to tests/rules.test.ts and run the full suite (27 cases) against the emulator.
Bundle seed/feedback_form.json as static content and build the closing feedback screen using the
existing composite activity renderer, saving to feedback/{email} instead of responses, autosaving as
status: draft every 8 seconds (debounce this independently from the existing 2-second activity autosave
— do not change that value), requiring every item answered before Submit, and self-locking on submit
(read-only "already submitted" view on return). Route it so Participants, HoD, Coordinator and Resource
Person accounts can all reach it from their respective home screens. Do not build Feedback Analysis or
Report Generation yet. Do not change any existing responses/activityState rule or UI.

Finish: stop any running emulator; run npm run build, npm test, npm run test:rules:emu once each; report
results and files changed; then stop and wait for me. Do not loop on verification, do not wait for
browser quota, do not deploy.
```
**You do next:** sign in as a Participant, a Coordinator, and a Resource Person test account (or
temporarily edit your own roster role to test each) and submit the feedback form once as each; confirm
autosave fires roughly every 8 seconds (watch the network tab or a "Saved" indicator), confirm it locks
after submit. Commit **"Addendum Phase 1: feedback collection and form"**.

## Prompt 2 — Phase 2: Coordinator access, Feedback Analysis tab
```
Phase 2 of the addendum — Coordinator access and Feedback Analysis (SPEC_ADDENDUM.md D2, D4).
Update the route guard so a Coordinator account can open the existing "Analytics & Reports" page
alongside HoD and Admin (no rules change needed here — isCoordinator() already has the read access it
needs). Add a "Feedback Analysis" tab inside that page: build a Summary Publisher for feedback, modelled
exactly on the existing confidential-activity Summary Publisher in SPEC §8A, but publishing a single
programme-wide feedbackSummaries/overall document (no per-department split, no minimum-response
suppression threshold) with a manual "Publish now" button in the App Admin console and a debounced live
recompute while that page is open. The Feedback Analysis tab itself (visible to HoD, Coordinator,
Resource Person and every Admin type) renders feedbackSummaries/overall: charts for the rating_scale and
choice_matrix/checklist/poll parts, and a shuffled, unattributed list for the anonymous free-text item
(pD2). Individual feedback documents remain unreadable by anyone but their author and the App Admin — do
not change that. Do not build Report Generation yet.

Finish: stop any running emulator; run npm run build, npm test, npm run test:rules:emu once each; report
results and files changed; then stop and wait for me. Do not loop on verification, do not wait for
browser quota, do not deploy.
```
**You do next:** confirm a Coordinator and a Resource Person account can see Feedback Analysis but
cannot open any individual's feedback document (try hitting the document directly); confirm a HoD/Dean
account cannot write feedbackSummaries. Commit **"Addendum Phase 2: Coordinator access and Feedback Analysis"**.

## Prompt 3 — Phase 3: Report Generation
```
Phase 3 of the addendum — Report Generation (SPEC_ADDENDUM.md D6, D7).
Add a "Report Generation" tab inside Analytics & Reports, visible to HoD, Coordinator, Resource Person
and Admin. Render the HRDC QIP Programme Report structure from D6's table: header block, Objectives,
Day-wise summary (session title + editable Resource Person/Summary-of-Proceedings text boxes, followed
by combined analytics and charts for every activity in that session, reusing the existing SPEC §8
aggregate-computation logic rather than duplicating it), the Department Action Plan section (sourced
from the real activityId you identified in the plan, grouped by department, plus an editable
"additional action" mini-table), the Participant Feedback Summary section (pulled from
feedbackSummaries/overall), the Photographs section (an editable manual-fill reminder, no upload), the
Annexures note (plain text, not editable), HOD's Observations (editable text box), and the signature
block (editable name fields). All editable fields read/write reportMeta/main.fields exactly as specified
in D7, restricted to canEditReport() roles for writes (App Admin, Coordinator, any HoD) while
Dean/Associate Dean/HRDC and Resource Person can view only. Add a manual "Regenerate" button that
re-runs every computation fresh (no onSnapshot on this page). Add an "Export to PDF" button using
window.print() with a dedicated print stylesheet (@media print: hide navigation and buttons, clean page
breaks between numbered sections, A4 sizing), available to HoD, Coordinator and Admin only. Do not change
firestore.rules beyond what Phase 1 already added.

Finish: stop any running emulator; run npm run build, npm test, npm run test:rules:emu once each; report
results and files changed; then stop and wait for me. Do not loop on verification, do not wait for
browser quota, do not deploy.
```
**You do next:**
1. Fill in a few `reportMeta` text boxes as Coordinator, hit Regenerate, confirm they persist and the
   charts reflect real response data.
2. Confirm a Resource Person account can view the report but the edit fields and Export button are
   disabled/hidden for them.
3. Export to PDF once and check the page breaks land between sections, not mid-chart.
4. Commit **"Addendum Phase 3: Report Generation"**, `git push`, let Vercel/Hosting redeploy — no new
   environment variables or Firebase project settings are needed for this addendum.

---

## Fix-up prompts

**Tests not shown:**
```
Show the full terminal output of npm run test:rules:emu. Do not summarise. Then stop.
```

**A rules test fails:**
```
Do not modify firestore.rules beyond what firestore.rules.additions.md specifies. Explain which test
failed, why, and whether the bug is in the app code or the test fixture. Propose the fix and wait for my
approval.
```

**Wording change needed in the feedback form:** never ask the agent to edit code text. Edit
`seed/feedback_form.json` directly (it's plain content, no generator script needed for this one file),
commit, `git push`, let the host redeploy.

**Want Resource Persons to also export the report:** tell the agent before Phase 3:
```
Also allow Resource Person accounts to use the Export to PDF button on the Report Generation tab (view
and export, still no edit rights on the text boxes). Update the plan for Phase 3 accordingly.
```
