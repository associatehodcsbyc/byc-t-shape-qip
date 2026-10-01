# firestore.rules — additions for the Feedback / Coordinator Access / Report Generation addendum

These are **additions only**. Nothing in the existing `firestore.rules` is removed or loosened — paste
the two new helper functions near the other `is...()` helpers (after `isResourcePerson()`), and paste
the three new `match` blocks anywhere alongside the existing ones (before the final `match /{document=**}`
catch-all).

No change is needed to `isCoordinator()` / `isResourcePerson()` / the `roster` rules — they already
grant Coordinator and Resource Person broad read access to `progress` and `summaries`, and (via the
`isHoDOf()` shortcut) Coordinator already reads non-confidential `responses` across every department.
That existing plumbing is what makes giving the Coordinator "Analytics & Reports" access a **client-side
routing change only** — the data access is already there.

```javascript
// ---------- New helper: who may EDIT the QIP report's text fields ----------
// Deliberately narrower than isAdmin(): Dean / Associate Dean / HRDC stay view-only,
// exactly as in the rest of this app. App Admin, the QIP Coordinator, and any
// department HoD may edit.
function canEditReport() {
  return isActive() && (isAppAdmin() || isCoordinator() || me().role == 'hod');
}
```

```javascript
// ---------- Closing programme feedback (Participants, HoDs, QIP Coordinator, Resource Persons) ----------
// Doc ID = lowercase email. One identical form for every role. Self-locks once 'submitted'.
// The 8-second autosave interval is a front-end debounce only — this rule just needs to
// accept writes while status == 'draft', the same way every other self-locking collection
// in this app works. NOT gated by activityState/activityOpen: feedback has no
// enable/disable/lock concept, it is simply open once the app ships this feature.
function validFeedbackShape() {
  let d = request.resource.data;
  return d.keys().hasOnly(
           ['email', 'uid', 'name', 'department', 'role', 'answers',
            'status', 'createdAt', 'updatedAt', 'submittedAt'])
    && d.role in ['participant', 'hod', 'coordinator', 'qip_coordinator', 'resource_person']
    && d.answers is map
    && d.answers.size() <= 60
    && d.status in ['draft', 'submitted']
    && d.updatedAt == request.time;
}

match /feedback/{fEmail} {
  // Same confidentiality posture as the department-perception activities in SPEC §8A:
  // this form includes candid remarks about session delivery, so individual answers are
  // visible only to their author and the App Admin. Everyone else reads the published
  // aggregate in /feedbackSummaries instead.
  allow get: if isActive() && (fEmail == email() || isAppAdmin());
  allow list: if isAppAdmin();

  allow create: if isActive()
    && fEmail == email()
    && request.resource.data.email == email()
    && request.resource.data.uid == request.auth.uid
    && request.resource.data.department == myDept()
    && request.resource.data.role == me().role
    && request.resource.data.createdAt == request.time
    && validFeedbackShape();

  allow update: if isActive()
    && resource.data.email == email()
    && resource.data.status == 'draft'
    && request.resource.data.diff(resource.data).affectedKeys()
         .hasOnly(['answers', 'status', 'updatedAt', 'submittedAt', 'name'])
    && validFeedbackShape();

  allow delete: if false;
}

// ---------- Published aggregate of the closing feedback (programme-wide, not per-department) ----------
// Doc ID is fixed: 'overall'. Computed and published ONLY by the App Admin console
// (the "Feedback Analysis" tab's Publish/Refresh action) — same pattern as /summaries
// in SPEC §8A. No minimum-response suppression threshold.
match /feedbackSummaries/{sumId} {
  allow read: if isActive() && (isAdmin() || isHoD() || isResourcePerson());
  allow create, update: if isAppAdmin()
    && sumId == 'overall'
    && request.resource.data.n is int
    && request.resource.data.updatedAt == request.time;
  allow delete: if isAppAdmin();
}

// ---------- Editable QIP report fields ----------
// A single shared document for the whole programme report (Theme, Resource Person
// names, Summary of Proceedings per session, HOD's Observations, extra Action Plan
// rows, photograph captions, etc.) — not scoped by department, because the QIP served
// all BYC departments as one programme.
match /reportMeta/{docId} {
  allow read: if isActive() && (canEditReport() || isAdmin() || isResourcePerson());

  allow create, update: if canEditReport()
    && docId == 'main'
    && request.resource.data.updatedBy == email()
    && request.resource.data.updatedAt == request.time
    && request.resource.data.keys().hasOnly(['fields', 'updatedBy', 'updatedAt'])
    && request.resource.data.fields is map
    && request.resource.data.fields.size() <= 200;

  allow delete: if false;
}
```

## New rules-emulator tests to add to `tests/rules.test.ts`

1. A participant can create their own `feedback/{email}` draft and flip it to `submitted`.
2. A QIP Coordinator and a Resource Person can each do the same (three roles, same collection, same shape).
3. A participant cannot read another person's `feedback` document; the App Admin can read any of them.
4. A HoD, Dean/AD/HRDC admin, and Resource Person **cannot** `get` or `list` an individual `feedback` document — only `feedbackSummaries/overall`.
5. Only the App Admin can write `feedbackSummaries/overall`; a Coordinator/HoD/Resource Person can read it but not write it.
6. A participant cannot update their own `feedback` document once `status == 'submitted'`.
7. A participant cannot set `role` to anything other than their own roster role, and cannot change `department` away from `myDept()`.
8. `canEditReport()` roles (App Admin, Coordinator, HoD) can write `reportMeta/main`; a Dean/AD/HRDC admin and a Resource Person can read it but their write is denied.
9. A participant cannot read or write `reportMeta` at all.
10. An unauthenticated request is rejected on every operation across `feedback`, `feedbackSummaries` and `reportMeta`.
