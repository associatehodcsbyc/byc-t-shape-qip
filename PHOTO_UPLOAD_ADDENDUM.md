# Photo Upload Addendum — Report Generation, Section 5

This replaces the "no photo upload, manual-fill note only" assumption in `SPEC_ADDENDUM.md` D6/D8.5.
Everything else in `SPEC_ADDENDUM.md` and `firestore.rules.additions.md` is unchanged.

## What changes
- **Firebase Storage** is now used (Spark plan includes a small free Storage quota — this stays well
  within it: a few dozen photos per QIP run, 8 MB cap each, enforced in `storage.rules`).
- `storage.rules` (new file, companion to this one) mirrors `canEditReport()` from `firestore.rules`
  exactly, via `firestore.get()` cross-checks against the `roster` collection — so there is still only
  one source of truth for roles, not a second one to keep in sync by hand.
- `reportMeta.fields.photos` (inside the existing `reportMeta/main` document — no new Firestore
  collection) becomes an array of `{ storagePath, downloadURL, caption, uploadedBy, uploadedAt }`,
  capped at 24 entries. This still fits the existing `reportMeta` rules (`fields` is already a free-form
  map, write access already restricted to `canEditReport()`), so **no change to `firestore.rules` is
  needed beyond what `firestore.rules.additions.md` already specifies.**

## Updated D6 row (Section 5 — Photographs of the Programme)
| Report section | Source in the app |
|---|---|
| 5. Photographs of the Programme | An editable gallery: `canEditReport()` roles upload images (max 8 MB, image/* only) to Storage at `qipReportPhotos/`, add a one-line caption per photo, and reorder/remove them. Everyone who can view the report (HoD, Coordinator, Resource Person, Admin) sees the gallery; only `canEditReport()` roles see the upload/remove controls. Rendered as a simple responsive grid in the HTML report and the printed PDF (`break-inside: avoid` on each photo tile so one isn't split across a page edge). |

## New Phase — Photo Upload (insert as Phase 3B, after Report Generation's core build, or fold into Phase 3 if that phase hasn't started yet)

```
Phase 3B of the addendum — Report photo gallery (PHOTO_UPLOAD_ADDENDUM.md).
Enable Firebase Storage for this project if not already enabled, and add storage.rules exactly as given
in that file - do not loosen it, and do not add any other Storage path. In the Report Generation tab's
Photographs section, build an upload control visible only to canEditReport() roles (App Admin, QIP
Coordinator, any HoD): accept image files up to 8 MB, upload to qipReportPhotos/ with a generated unique
filename, then write {storagePath, downloadURL, caption, uploadedBy, uploadedAt} into
reportMeta.fields.photos (capped at 24 entries) via the existing reportMeta write path - do not create a
separate Firestore collection for this. Let canEditReport() roles edit each photo's caption, reorder the
array, and remove a photo (delete both the Storage object and its reportMeta.fields.photos entry
together). Render the gallery as a responsive grid for every viewer of the report (HoD, Coordinator,
Resource Person, Admin), read-only for anyone without canEditReport(). In the print stylesheet, apply
break-inside: avoid to each photo tile so the Export to PDF flow never splits one across a page break.

Finish: stop any running emulator; run npm run build, npm test, npm run test:rules:emu once each; also
add and run a storage-rules emulator test confirming a non-canEditReport() account's upload attempt is
denied and a canEditReport() account's upload succeeds; report results and files changed; then stop and
wait for me. Do not loop on verification, do not wait for browser quota, do not deploy.
```

**You do next:**
1. Firebase Console → Storage → get started (Spark-compatible, no billing change needed) if not already enabled.
2. Deploy the new rules: `npx firebase deploy --only storage,firestore:rules --project <your-project-id>`.
3. Upload 2-3 test photos as Coordinator, confirm a Resource Person account can see them but not the upload/caption controls.
4. Confirm the 8 MB / image-only limits are enforced (try a PDF or an oversized file — both should be rejected client-side and by the rule).
5. Commit **"Addendum Phase 3B: report photo gallery"**, `git push`.
