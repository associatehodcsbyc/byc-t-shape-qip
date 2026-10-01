# SPEC Addendum — Closing Feedback, Coordinator Analytics Access & Automated QIP Report (BYC)

This is an **addendum to the existing `SPEC.md`** for the live `byc-t-shaped-qip` app — it does not replace
anything already built. Paste this as **Section D** of the same SPEC file (or keep it as a separate file the
agent reads alongside SPEC.md, firestore.rules and the seed folder). Nothing here touches the activity
engine, the HoD enable/disable/lock console, or the existing `responses`/`activityState` rules.

**Why:** the QIP concluded 30 Sept 2026. The HRDC requires a closing feedback round from everyone who
took part — Participants, the QIP Coordinator, and Resource Persons — plus a Programme Report in the
official HRDC format (see the reference document `QIP_Report_Format.docx`, supplied separately). Both
should live inside the same app rather than as a separate spreadsheet/Word exercise.

---

## D1. Scope of this addendum
1. A single closing **Feedback** form, identical for all three roles, reusing the existing `composite`
   activity renderer — see `seed/feedback_form.json`. Autosaves as a draft **every 8 seconds** (the
   existing activities autosave every 2 seconds — leave that as is; 8 seconds is specific to this form only).
2. The **QIP Coordinator** gets access to the existing "Analytics & Reports" page (today open to HoD and
   Admin only). This is a **route-guard change only** — `firestore.rules` already lets `isCoordinator()`
   read `progress`, `summaries`, and (via the `isHoDOf()` shortcut) non-confidential `responses` across
   every department, so no new read permissions are required for the existing tabs.
3. Two new tabs inside "Analytics & Reports": **Feedback Analysis** and **Report Generation**.
4. **Report Generation** renders the HRDC QIP Programme Report as a live HTML page, following the
   official section order but replacing the day-wise proceedings tables with narrative + charts, with
   editable text boxes for anything the app has no data for. The QIP Coordinator, any HoD, and Admin can
   export it to PDF via the browser's print dialog.

## D2. Roles — no new role, one new access grant
No new role is introduced. The access change is:

| Page / tab | Today | After this addendum |
|---|---|---|
| Analytics & Reports (existing tabs) | HoD, Admin | HoD, **Coordinator**, Admin |
| Feedback Analysis (new) | — | HoD, Coordinator, Resource Person, Admin (aggregate only — see D4) |
| Report Generation — **view** (new) | — | HoD, Coordinator, Resource Person, Admin |
| Report Generation — **edit the text boxes** (new) | — | HoD, Coordinator, Admin only (see `canEditReport()`) |
| Report Generation — **export to PDF** (new) | — | HoD, Coordinator, Admin |

Resource Persons can view the report and the feedback aggregate (useful for their own session's
delivery-quality feedback) but cannot edit the report text or export it — flag this for confirmation if
Dr Gobi/the Coordinator wants Resource Persons to also export.

## D3. Feedback data model
```
feedback/{lowercaseEmail}
  email, uid, name, department, role: 'participant'|'hod'|'coordinator'|'qip_coordinator'|'resource_person',
  answers (map — shape follows the composite part structure in seed/feedback_form.json),
  status: 'draft'|'submitted', createdAt, updatedAt, submittedAt?
```
- `role` and `department` are copied from the signed-in user's `roster` document at creation time, never
  entered by hand.
- The form itself is **one `composite` widget** (see `seed/feedback_form.json`) with parts using the
  widget types the activity engine already supports: `rating_scale`, `choice_matrix`, `poll`, `checklist`,
  `free_text`. **No new widget renderer is needed.**
- Autosave debounce for this form only: **8 seconds** (not the activities' 2 seconds).
- Self-locks the same way every other collection in this app does: once `status` flips to `'submitted'`,
  `firestore.rules` denies further `update`s.
- Not gated by `activityState`/enable-disable-lock — the form is simply open once this feature ships.
- One free-text item (`pD2`) is `anonymous: true` — show it in Feedback Analysis as a shuffled,
  unattributed quote list, exactly like the existing anonymous-comment handling in SPEC §8A.

## D4. Feedback aggregation — "Feedback Analysis" tab
Reuse the **Summary Publisher** pattern from SPEC §8A, pointed at the new collection instead of a
per-department confidential activity:
- A single published aggregate, `feedbackSummaries/overall` (not per-department — the QIP served all
  BYC departments as one programme).
- Computed and written **only by the App Admin console**: item means/distributions for `pA`/`pC2`,
  stacked counts for `pB` (per rating × session) and `pD1` (checklist), poll results for `pC1`, and the
  shuffled anonymous list for `pD2`. A manual "Publish now" button plus a debounced live recompute while
  the Admin keeps the page open, same as the existing Summary Publisher.
- **No minimum-response suppression threshold** (unlike the 5-response threshold used for the
  department-perception activities in §8A) — publish as soon as at least one response exists. Flag this
  for confirmation: if Dr Balakrishnan/the Coordinator would rather apply the same threshold-of-5 here
  (to protect individual Resource Persons from being identifiable in a small sample), say so before Phase
  2 of this addendum and the publisher config changes to match.
- HoD, Coordinator, Resource Person and every Admin subtype can **read** `feedbackSummaries/overall`;
  nobody except the App Admin can read another person's individual `feedback` document (see D5/rules).

## D5. Firestore rules
See the companion file `firestore.rules.additions.md` for the exact blocks to paste in: one new helper
function (`canEditReport()`), and three new `match` blocks (`feedback`, `feedbackSummaries`,
`reportMeta`). Nothing existing is changed or loosened. Ten new emulator test cases are listed there —
add them to `tests/rules.test.ts` alongside the existing 17.

## D6. "Report Generation" tab
A live HTML page, assembled on open (and whenever the **Regenerate** button is pressed — no `onSnapshot`,
this is a one-time analysis/export view, same principle as the live tracker vs. this report), structured
to match the official HRDC QIP Programme Report sections. Where the app has real data, show it; where it
doesn't, show an **editable text box** backed by `reportMeta/main.fields` (see D7 for the exact field
list) that `canEditReport()` roles can type into directly on the page — it saves and reappears on every
regenerate.

| Report section (per `QIP_Report_Format.docx`) | Source in the app |
|---|---|
| Header block (Theme, Title, Dates, Department, Faculty counts, Coordinator name/contact, Venue, Submission date) | `reportMeta.fields.header.*` — editable text boxes. Title and Dates can be pre-filled from `sessions.json`/the SPEC header; everything else is a text box. |
| 1. Objectives | Pre-filled, verbatim, from SPEC §A's objective list — editable in case wording needs a tweak. |
| 2. Day-wise Summary of Proceedings | **Do not reproduce the Session/Title/Resource Person/Summary table.** For each Day → Session: show the session title (from `sessions.json`), an editable "Resource Person" text box and an editable "Summary of Proceedings" text box (`reportMeta.fields.sessions.{sessionId}.*`), followed by the **combined analytics for every activity in that session** — participation rate, and the appropriate chart per widget type (bar/radar for `rating_scale` section means, stacked bars for `choice_matrix`/`checklist`/`poll`, mean-rank chart for `rank_order`, heat map for `crm_matrix`, ratio/sum callouts for computed `table_entry` columns), recomputed from the raw `responses`/published `summaries` the viewer is allowed to read — reuse the aggregate-computation logic already built for SPEC §8, do not duplicate it. |
| 3. Departmental Curriculum Action Plan | Locate the Day 3 Session IV "Department Action Plan" `table_entry` activity in `activities`/`seed/activities.json` (confirm the exact `activityId` in your plan) and list its submitted rows, grouped by department. Provide an editable "add an additional action" mini-table in `reportMeta.fields.actionPlanExtra` for anything the Coordinator wants to add by hand. |
| 4. Participant Feedback Summary | Pulled live from `feedbackSummaries/overall` (D4) — charts plus the anonymous quote list from `pD2`. |
| 5. Photographs of the Programme | No image upload in this phase (out of scope — flag if wanted later). Render an editable caption/notes box (`reportMeta.fields.photosNote`) reminding the Coordinator to insert photographs manually into the exported PDF, or a printed copy, before final submission. |
| 6. Annexures (signed attendance sheet) | Out of the app's scope — a short note, not an editable field, saying it must be attached separately. |
| 7. HOD's Observations and Recommendations | Editable text box, `reportMeta.fields.hodObservations`. |
| Signature block (QIP Coordinator / HoD, name & signature) | Editable name text boxes (`reportMeta.fields.signatures.*`); physical signing happens on the printed/exported PDF, the app does not capture a drawn signature. |

**Regenerate:** a single button re-runs every aggregate computation against the current `responses`,
`summaries` and `feedbackSummaries` and re-renders the page — use this instead of a live listener so
opening the report never triggers a large read burst, consistent with the tracker's manual-refresh
principle elsewhere in this app.

**Export to PDF:** a dedicated print stylesheet (`@media print`) that hides navigation/buttons, forces
clean page breaks between the numbered report sections, and sizes for A4 — the viewer then uses the
browser's own "Save as PDF" from `window.print()`. No PDF-generation library is needed.

## D7. `reportMeta.fields` — the exact editable keys
```
header: { theme, titleOverride?, datesOverride?, department, facultyInDept, facultyAttended,
          coordinatorName, coordinatorContact, venue, submissionDate }
sessions: { "<sessionId>": { resourcePerson, summaryOfProceedings } }   // one entry per the 12 sessions
actionPlanExtra: [ { action, rationale, personResponsible, timeline } ]
photosNote: string
hodObservations: string
signatures: { coordinatorName, hodName }
```

## D8. Assumptions made in this addendum — please confirm before Phase 2 of the build
1. **One identical feedback form** for Participants, QIP Coordinator and Resource Persons (your decision).
2. **No suppression threshold** on the feedback aggregate, unlike the 5-response threshold used for
   department-perception activities — flag if you'd rather apply the same threshold here.
3. **Report edit rights**: App Admin, QIP Coordinator, and any department HoD can edit the report text
   boxes; Dean/Associate Dean/HRDC stay view-only, matching their existing role in the rest of the app.
4. **Resource Persons can view but not edit or export** the report. Say so if they should also get export.
5. **No photo upload** in this phase — Section 5 is a manual-fill reminder, not a file uploader.
6. The exact `activityId` for the "Department Action Plan" `table_entry` activity (Section 3) needs to be
   confirmed from the real `seed/activities.json` — the agent should locate it and state it in the plan.
