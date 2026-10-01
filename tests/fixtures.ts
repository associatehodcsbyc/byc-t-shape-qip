// =============================================================================
// Test fixtures for security-rules tests.
// 2 departments (computer-science, commerce), each with 2 participants + 1 HoD.
// 4 admin types: app_admin, dean, associate_dean, hrdc.
// 1 inactive roster user. 1 CHRIST email not in roster. 1 gmail.com user.
// 1 confidential activity + 1 non-confidential activity with activityState
// variants: enabled, disabled, locked.
// =============================================================================

// ---------- Auth helper types ----------

export interface AuthUser {
  email: string;
  uid: string;
  email_verified: boolean;
  sign_in_provider: string;
}

// ---------- Auth contexts ----------

export const authUsers: Record<string, AuthUser> = {
  cs_part1:    { email: 'part1.cs@christuniversity.in',     uid: 'uid-cs-part1',    email_verified: true, sign_in_provider: 'google.com' },
  cs_part2:    { email: 'part2.cs@christuniversity.in',     uid: 'uid-cs-part2',    email_verified: true, sign_in_provider: 'google.com' },
  cs_hod:      { email: 'hod.cs@christuniversity.in',       uid: 'uid-cs-hod',      email_verified: true, sign_in_provider: 'google.com' },
  com_part1:   { email: 'part1.com@christuniversity.in',    uid: 'uid-com-part1',   email_verified: true, sign_in_provider: 'google.com' },
  com_part2:   { email: 'part2.com@christuniversity.in',    uid: 'uid-com-part2',   email_verified: true, sign_in_provider: 'google.com' },
  com_hod:     { email: 'hod.com@christuniversity.in',      uid: 'uid-com-hod',     email_verified: true, sign_in_provider: 'google.com' },
  app_admin:   { email: 'appadmin@christuniversity.in',     uid: 'uid-app-admin',   email_verified: true, sign_in_provider: 'google.com' },
  dean:        { email: 'dean@christuniversity.in',         uid: 'uid-dean',        email_verified: true, sign_in_provider: 'google.com' },
  assoc_dean:  { email: 'assoc.dean@christuniversity.in',   uid: 'uid-assoc-dean',  email_verified: true, sign_in_provider: 'google.com' },
  hrdc:        { email: 'hrdc@christuniversity.in',         uid: 'uid-hrdc',        email_verified: true, sign_in_provider: 'google.com' },
  coordinator: { email: 'coordinator@christuniversity.in',   uid: 'uid-coordinator', email_verified: true, sign_in_provider: 'google.com' },
  res_person:  { email: 'resperson@christuniversity.in',     uid: 'uid-resperson',   email_verified: true, sign_in_provider: 'google.com' },
  inactive:    { email: 'inactive@christuniversity.in',     uid: 'uid-inactive',    email_verified: true, sign_in_provider: 'google.com' },
  not_in_roster: { email: 'nobody@christuniversity.in',     uid: 'uid-nobody',      email_verified: true, sign_in_provider: 'google.com' },
  gmail_user:  { email: 'hacker@gmail.com',                 uid: 'uid-gmail',       email_verified: true, sign_in_provider: 'google.com' },
};

// ---------- Roster data (doc ID = email) ----------

export const rosterData: Record<string, Record<string, unknown>> = {
  'part1.cs@christuniversity.in':   { email: 'part1.cs@christuniversity.in',   name: 'CS Participant 1',  department: 'computer-science', role: 'participant', adminType: null, active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'part2.cs@christuniversity.in':   { email: 'part2.cs@christuniversity.in',   name: 'CS Participant 2',  department: 'computer-science', role: 'participant', adminType: null, active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'hod.cs@christuniversity.in':     { email: 'hod.cs@christuniversity.in',     name: 'CS HoD',            department: 'computer-science', role: 'hod',         adminType: null, active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'part1.com@christuniversity.in':  { email: 'part1.com@christuniversity.in',  name: 'Com Participant 1', department: 'commerce',          role: 'participant', adminType: null, active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'part2.com@christuniversity.in':  { email: 'part2.com@christuniversity.in',  name: 'Com Participant 2', department: 'commerce',          role: 'participant', adminType: null, active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'hod.com@christuniversity.in':    { email: 'hod.com@christuniversity.in',    name: 'Com HoD',           department: 'commerce',          role: 'hod',         adminType: null, active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'appadmin@christuniversity.in':   { email: 'appadmin@christuniversity.in',   name: 'App Admin',         department: 'computer-science', role: 'admin',       adminType: 'app_admin',      active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'dean@christuniversity.in':       { email: 'dean@christuniversity.in',       name: 'Dean',              department: 'computer-science', role: 'admin',       adminType: 'dean',           active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'assoc.dean@christuniversity.in': { email: 'assoc.dean@christuniversity.in', name: 'Associate Dean',    department: 'computer-science', role: 'admin',       adminType: 'associate_dean', active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'hrdc@christuniversity.in':       { email: 'hrdc@christuniversity.in',       name: 'HRDC Admin',        department: 'computer-science', role: 'admin',       adminType: 'hrdc',           active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'coordinator@christuniversity.in': { email: 'coordinator@christuniversity.in', name: 'QIP Coordinator',   department: 'computer-science', role: 'coordinator', adminType: null,             active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'resperson@christuniversity.in':   { email: 'resperson@christuniversity.in',   name: 'Resource Person',   department: 'computer-science', role: 'resource_person', adminType: null,         active: true,  uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
  'inactive@christuniversity.in':   { email: 'inactive@christuniversity.in',   name: 'Inactive User',     department: 'computer-science', role: 'participant', adminType: null, active: false, uploadedBy: 'appadmin@christuniversity.in', uploadedAt: new Date() },
};

// ---------- Departments ----------

export const departmentData: Record<string, Record<string, unknown>> = {
  'computer-science': { name: 'Computer Science', campus: 'BYC' },
  'commerce':         { name: 'Commerce',          campus: 'BYC' },
};

// ---------- Activities ----------

export const activityData: Record<string, Record<string, unknown>> = {
  'd1s1_a1_four_pillars': {
    sessionId: 'd1s1',
    order: 1,
    title: 'The Four Pillars: Where Do We Stand?',
    widgetType: 'composite',
    config: {},
    sourceRef: 'test',
    groupMode: 'individual',
    derived: false,
    confidential: false,
  },
  'd1s1_a2_tl_questionnaire': {
    sessionId: 'd1s1',
    order: 2,
    title: 'Contemporary Teaching and Learning Assessment Questionnaire',
    widgetType: 'rating_scale',
    config: {},
    sourceRef: 'test',
    groupMode: 'individual',
    derived: false,
    confidential: true,
  },
};

// ---------- Sessions ----------

export const sessionData: Record<string, Record<string, unknown>> = {
  'd1s1': {
    day: 1,
    date: '2026-09-28',
    slot: 'I',
    time: '09:15-10:45',
    title: 'Setting the Vision',
    facilitator: 'Dean(s)',
    order: 1,
  },
};

// ---------- Activity states ----------
// Keys: {departmentId}__{activityId}

export const activityStateData: Record<string, Record<string, unknown>> = {
  // CS: four_pillars = ENABLED (can write)
  'computer-science__d1s1_a1_four_pillars': {
    department: 'computer-science',
    activityId: 'd1s1_a1_four_pillars',
    sessionId: 'd1s1',
    enabled: true,
    locked: false,
    updatedBy: 'hod.cs@christuniversity.in',
    updatedAt: new Date(),
  },
  // CS: tl_questionnaire = DISABLED (cannot write)
  'computer-science__d1s1_a2_tl_questionnaire': {
    department: 'computer-science',
    activityId: 'd1s1_a2_tl_questionnaire',
    sessionId: 'd1s1',
    enabled: false,
    locked: false,
    updatedBy: 'hod.cs@christuniversity.in',
    updatedAt: new Date(),
  },
  // Commerce: four_pillars = ENABLED
  'commerce__d1s1_a1_four_pillars': {
    department: 'commerce',
    activityId: 'd1s1_a1_four_pillars',
    sessionId: 'd1s1',
    enabled: true,
    locked: false,
    updatedBy: 'hod.com@christuniversity.in',
    updatedAt: new Date(),
  },
  // Commerce: tl_questionnaire = LOCKED (visible but read-only)
  'commerce__d1s1_a2_tl_questionnaire': {
    department: 'commerce',
    activityId: 'd1s1_a2_tl_questionnaire',
    sessionId: 'd1s1',
    enabled: true,
    locked: true,
    updatedBy: 'hod.com@christuniversity.in',
    updatedAt: new Date(),
  },
};

// ---------- Pre-seeded responses for read tests ----------

export const responseData: Record<string, Record<string, unknown>> = {
  // CS participant 1's non-confidential response
  'd1s1_a1_four_pillars__part1.cs@christuniversity.in': {
    activityId: 'd1s1_a1_four_pillars',
    sessionId: 'd1s1',
    department: 'computer-science',
    email: 'part1.cs@christuniversity.in',
    uid: 'uid-cs-part1',
    name: 'CS Participant 1',
    answers: { p1: { q1: 'o1' } },
    status: 'submitted',
    confidential: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: new Date(),
  },
  // CS participant 1's confidential response
  'd1s1_a2_tl_questionnaire__part1.cs@christuniversity.in': {
    activityId: 'd1s1_a2_tl_questionnaire',
    sessionId: 'd1s1',
    department: 'computer-science',
    email: 'part1.cs@christuniversity.in',
    uid: 'uid-cs-part1',
    name: 'CS Participant 1',
    answers: { a1: 4, a2: 3 },
    status: 'submitted',
    confidential: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    submittedAt: new Date(),
  },
};

// ---------- Pre-seeded progress ----------

export const progressData: Record<string, Record<string, unknown>> = {
  'd1s1_a1_four_pillars__part1.cs@christuniversity.in': {
    activityId: 'd1s1_a1_four_pillars',
    sessionId: 'd1s1',
    department: 'computer-science',
    email: 'part1.cs@christuniversity.in',
    name: 'CS Participant 1',
    status: 'submitted',
    updatedAt: new Date(),
  },
};

// ---------- Pre-seeded summaries ----------

export const summaryData: Record<string, Record<string, unknown>> = {
  'computer-science__d1s1_a2_tl_questionnaire': {
    department: 'computer-science',
    activityId: 'd1s1_a2_tl_questionnaire',
    n: 5,
    itemStats: {},
    sectionStats: {},
    totalStats: {},
    bandCounts: {},
    comments: [],
    suppressed: false,
    updatedAt: new Date(),
  },
};

// ---------- Audit log entry (for delete test) ----------

export const auditLogData: Record<string, Record<string, unknown>> = {
  'audit-entry-1': {
    actor: 'hod.cs@christuniversity.in',
    action: 'enable_activity',
    target: 'computer-science__d1s1_a1_four_pillars',
    details: 'Enabled for session',
    at: new Date(),
  },
};
