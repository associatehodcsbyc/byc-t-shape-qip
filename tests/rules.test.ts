// =============================================================================
// QIP Workshop — Firestore Security Rules Tests
// Covers all 17 mandatory cases from SPEC §9.3.
// Uses @firebase/rules-unit-testing v2 against the Firestore Emulator.
// =============================================================================

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest';
import {
  setDoc,
  getDoc,
  doc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';
import {
  authUsers,
  rosterData,
  departmentData,
  sessionData,
  activityData,
  activityStateData,
  responseData,
  progressData,
  summaryData,
  auditLogData,
} from './fixtures';

// ---------- Helpers ----------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let testEnv: RulesTestEnvironment;

/**
 * Create an authenticated context with the correct token shape
 * that matches what our firestore.rules expect:
 *   - email, email_verified
 *   - firebase.sign_in_provider == 'google.com'
 */
function authedContext(key: string): RulesTestContext {
  const u = authUsers[key];
  if (!u) throw new Error(`Unknown auth user key: ${key}`);
  return testEnv.authenticatedContext(u.uid, {
    email: u.email,
    email_verified: u.email_verified,
    firebase: { sign_in_provider: u.sign_in_provider as any },
  });
}

function authedDb(key: string): Firestore {
  return authedContext(key).firestore() as unknown as Firestore;
}

// ---------- Lifecycle ----------

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-byc-qip',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
    storage: {
      rules: readFileSync(resolve(__dirname, '../storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed data with rules bypassed
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Roster
    for (const [id, data] of Object.entries(rosterData)) {
      await setDoc(doc(db, 'roster', id), data);
    }
    // Departments
    for (const [id, data] of Object.entries(departmentData)) {
      await setDoc(doc(db, 'departments', id), data);
    }
    // Sessions
    for (const [id, data] of Object.entries(sessionData)) {
      await setDoc(doc(db, 'sessions', id), data);
    }
    // Activities
    for (const [id, data] of Object.entries(activityData)) {
      await setDoc(doc(db, 'activities', id), data);
    }
    // Activity states
    for (const [id, data] of Object.entries(activityStateData)) {
      await setDoc(doc(db, 'activityState', id), data);
    }
    // Responses
    for (const [id, data] of Object.entries(responseData)) {
      await setDoc(doc(db, 'responses', id), data);
    }
    // Progress
    for (const [id, data] of Object.entries(progressData)) {
      await setDoc(doc(db, 'progress', id), data);
    }
    // Summaries
    for (const [id, data] of Object.entries(summaryData)) {
      await setDoc(doc(db, 'summaries', id), data);
    }
    // Audit log
    for (const [id, data] of Object.entries(auditLogData)) {
      await setDoc(doc(db, 'auditLog', id), data);
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

// =============================================================================
// Tests
// =============================================================================

describe('QIP Workshop — Firestore Security Rules', () => {
  // -------------------------------------------------------------------------
  // 1. Non-CHRIST email (gmail.com) cannot read anything
  // -------------------------------------------------------------------------
  it('1. Non-CHRIST email (gmail.com) cannot read anything', async () => {
    const db = authedDb('gmail_user');
    await assertFails(getDoc(doc(db, 'roster', 'part1.cs@christuniversity.in')));
    await assertFails(getDoc(doc(db, 'activities', 'd1s1_a1_four_pillars')));
    await assertFails(getDoc(doc(db, 'sessions', 'd1s1')));
    await assertFails(getDoc(doc(db, 'departments', 'computer-science')));
  });

  // -------------------------------------------------------------------------
  // 2. CHRIST email not in roster cannot read anything
  // -------------------------------------------------------------------------
  it('2. CHRIST email not in roster cannot read anything', async () => {
    const db = authedDb('not_in_roster');
    await assertFails(getDoc(doc(db, 'activities', 'd1s1_a1_four_pillars')));
    await assertFails(getDoc(doc(db, 'sessions', 'd1s1')));
    await assertFails(getDoc(doc(db, 'departments', 'computer-science')));
  });

  // -------------------------------------------------------------------------
  // 3. Inactive roster user is denied
  // -------------------------------------------------------------------------
  it('3. Inactive roster user is denied all access', async () => {
    const db = authedDb('inactive');
    await assertFails(getDoc(doc(db, 'activities', 'd1s1_a1_four_pillars')));
    await assertFails(getDoc(doc(db, 'sessions', 'd1s1')));
  });

  // -------------------------------------------------------------------------
  // 4. Participant cannot read another participant's response
  // -------------------------------------------------------------------------
  it('4. Participant cannot read another participant\'s response', async () => {
    const db = authedDb('cs_part2');
    // cs_part2 tries to read cs_part1's response
    await assertFails(
      getDoc(doc(db, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'))
    );
  });

  // -------------------------------------------------------------------------
  // 5. Participant cannot write response when activity is disabled
  // -------------------------------------------------------------------------
  it('5. Participant cannot write response when activity is disabled', async () => {
    const db = authedDb('cs_part1');
    // d1s1_a2 is disabled for computer-science in fixtures
    await assertFails(
      setDoc(doc(db, 'responses', 'd1s1_a2_tl_questionnaire__part1.cs@christuniversity.in'), {
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part1.cs@christuniversity.in',
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        answers: {},
        status: 'draft',
        confidential: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 5b. Participant cannot write response when activity is locked
  // -------------------------------------------------------------------------
  it('5b. Participant cannot write response when activity is locked', async () => {
    const db = authedDb('com_part1');
    // d1s1_a2 is locked for commerce in fixtures
    await assertFails(
      setDoc(doc(db, 'responses', 'd1s1_a2_tl_questionnaire__part1.com@christuniversity.in'), {
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        department: 'commerce',
        email: 'part1.com@christuniversity.in',
        uid: 'uid-com-part1',
        name: 'Com Participant 1',
        answers: {},
        status: 'draft',
        confidential: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 6a. Participant cannot write response tagged with another department
  // -------------------------------------------------------------------------
  it('6a. Participant cannot write response tagged with another department', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(db, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'), {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'commerce', // WRONG department
        email: 'part1.cs@christuniversity.in',
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        answers: {},
        status: 'draft',
        confidential: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 6b. Participant cannot write response with another email
  // -------------------------------------------------------------------------
  it('6b. Participant cannot write response with another email', async () => {
    const db = authedDb('cs_part1');
    // Doc ID has part2's email but part1 is writing
    await assertFails(
      setDoc(doc(db, 'responses', 'd1s1_a1_four_pillars__part2.cs@christuniversity.in'), {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part2.cs@christuniversity.in', // WRONG email
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        answers: {},
        status: 'draft',
        confidential: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 6c. Participant cannot write response with mismatched ID
  // -------------------------------------------------------------------------
  it('6c. Participant cannot write response with mismatched doc ID', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(db, 'responses', 'WRONG_ID__part1.cs@christuniversity.in'), {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part1.cs@christuniversity.in',
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        answers: {},
        status: 'draft',
        confidential: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 7. Participant cannot change their own role or roster document
  // -------------------------------------------------------------------------
  it('7. Participant cannot change their own roster document', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      updateDoc(doc(db, 'roster', 'part1.cs@christuniversity.in'), { role: 'admin' })
    );
    await assertFails(
      setDoc(doc(db, 'roster', 'part1.cs@christuniversity.in'), {
        email: 'part1.cs@christuniversity.in',
        name: 'Hacked',
        department: 'computer-science',
        role: 'admin',
        adminType: 'app_admin',
        active: true,
        uploadedBy: 'part1.cs@christuniversity.in',
        uploadedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 8. HoD cannot toggle another department's activityState
  // -------------------------------------------------------------------------
  it('8. HoD cannot toggle another department\'s activityState', async () => {
    const db = authedDb('cs_hod');
    // CS HoD tries to change Commerce's activity state
    await assertFails(
      updateDoc(doc(db, 'activityState', 'commerce__d1s1_a1_four_pillars'), {
        enabled: false,
        locked: false,
        department: 'commerce',
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        updatedBy: 'hod.cs@christuniversity.in',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 9. HoD cannot read another department's responses
  // -------------------------------------------------------------------------
  it('9. HoD cannot read another department\'s responses', async () => {
    const db = authedDb('com_hod');
    // Commerce HoD tries to read CS responses (even non-confidential)
    await assertFails(
      getDoc(doc(db, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'))
    );
  });

  // -------------------------------------------------------------------------
  // 10. Dean/AD/HRDC can read all data but cannot write roster, content, or activityState
  // -------------------------------------------------------------------------
  it('10. Dean can read but cannot write roster, content, or activityState', async () => {
    const db = authedDb('dean');

    // CAN read activities, sessions, departments
    await assertSucceeds(getDoc(doc(db, 'activities', 'd1s1_a1_four_pillars')));
    await assertSucceeds(getDoc(doc(db, 'sessions', 'd1s1')));
    await assertSucceeds(getDoc(doc(db, 'departments', 'computer-science')));

    // CAN read non-confidential responses
    await assertSucceeds(
      getDoc(doc(db, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'))
    );

    // CANNOT write roster
    await assertFails(
      setDoc(doc(db, 'roster', 'newuser@christuniversity.in'), {
        email: 'newuser@christuniversity.in',
        name: 'New',
        department: 'computer-science',
        role: 'participant',
        adminType: null,
        active: true,
        uploadedBy: 'dean@christuniversity.in',
        uploadedAt: serverTimestamp(),
      })
    );

    // CANNOT write activity content
    await assertFails(
      updateDoc(doc(db, 'activities', 'd1s1_a1_four_pillars'), { title: 'Hacked' })
    );

    // CANNOT write activityState
    await assertFails(
      setDoc(doc(db, 'activityState', 'computer-science__d1s1_a1_four_pillars'), {
        department: 'computer-science',
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        enabled: false,
        locked: true,
        updatedBy: 'dean@christuniversity.in',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('10b. Associate Dean and HRDC can read but cannot write', async () => {
    // Associate Dean
    const dbAD = authedDb('assoc_dean');
    await assertSucceeds(getDoc(doc(dbAD, 'activities', 'd1s1_a1_four_pillars')));
    await assertFails(
      updateDoc(doc(dbAD, 'roster', 'part1.cs@christuniversity.in'), { active: false })
    );

    // HRDC
    const dbHRDC = authedDb('hrdc');
    await assertSucceeds(getDoc(doc(dbHRDC, 'sessions', 'd1s1')));
    await assertFails(
      updateDoc(doc(dbHRDC, 'activities', 'd1s1_a1_four_pillars'), { title: 'Hacked' })
    );
  });

  // -------------------------------------------------------------------------
  // 11. Only App Admin can write roster and activity content
  // -------------------------------------------------------------------------
  it('11. Only App Admin can write roster and activity content', async () => {
    const dbAdmin = authedDb('app_admin');

    // App Admin CAN write roster
    await assertSucceeds(
      setDoc(doc(dbAdmin, 'roster', 'newuser@christuniversity.in'), {
        email: 'newuser@christuniversity.in',
        name: 'New User',
        department: 'computer-science',
        role: 'participant',
        adminType: null,
        active: true,
        uploadedBy: 'appadmin@christuniversity.in',
        uploadedAt: serverTimestamp(),
      })
    );

    // App Admin CAN write activities
    await assertSucceeds(
      setDoc(doc(dbAdmin, 'activities', 'd1s1_a1_four_pillars'), {
        ...activityData['d1s1_a1_four_pillars'],
      })
    );

    // Participant CANNOT
    const dbPart = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(dbPart, 'roster', 'hack@christuniversity.in'), {
        email: 'hack@christuniversity.in',
        name: 'Hack',
        department: 'computer-science',
        role: 'admin',
        adminType: 'app_admin',
        active: true,
        uploadedBy: 'part1.cs@christuniversity.in',
        uploadedAt: serverTimestamp(),
      })
    );

    // HoD CANNOT
    const dbHoD = authedDb('cs_hod');
    await assertFails(
      updateDoc(doc(dbHoD, 'activities', 'd1s1_a1_four_pillars'), { title: 'Changed' })
    );
  });

  // -------------------------------------------------------------------------
  // 12. No one can delete responses or audit logs
  // -------------------------------------------------------------------------
  it('12. No one can delete responses or audit logs', async () => {
    // App Admin
    const dbAdmin = authedDb('app_admin');
    await assertFails(
      deleteDoc(doc(dbAdmin, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'))
    );
    await assertFails(deleteDoc(doc(dbAdmin, 'auditLog', 'audit-entry-1')));

    // HoD
    const dbHoD = authedDb('cs_hod');
    await assertFails(
      deleteDoc(doc(dbHoD, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'))
    );

    // Participant
    const dbPart = authedDb('cs_part1');
    await assertFails(
      deleteDoc(doc(dbPart, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'))
    );
  });

  // -------------------------------------------------------------------------
  // 13a. HoD cannot get a confidential response from own department
  // -------------------------------------------------------------------------
  it('13a. HoD cannot get a confidential response from own department', async () => {
    const db = authedDb('cs_hod');
    await assertFails(
      getDoc(doc(db, 'responses', 'd1s1_a2_tl_questionnaire__part1.cs@christuniversity.in'))
    );
  });

  // -------------------------------------------------------------------------
  // 13b. HoD cannot list responses without confidential==false filter
  // -------------------------------------------------------------------------
  it('13b. HoD cannot list responses without confidential==false filter', async () => {
    const db = authedDb('cs_hod');
    // Query without the confidential filter — rules reject the whole query
    const q = query(
      collection(db, 'responses'),
      where('department', '==', 'computer-science')
    );
    await assertFails(getDocs(q));
  });

  // -------------------------------------------------------------------------
  // 14. Dean/AD/HRDC cannot read confidential response; App Admin can
  // -------------------------------------------------------------------------
  it('14. Dean cannot read confidential response; App Admin can', async () => {
    const respId = 'd1s1_a2_tl_questionnaire__part1.cs@christuniversity.in';

    // Dean CANNOT
    const dbDean = authedDb('dean');
    await assertFails(getDoc(doc(dbDean, 'responses', respId)));

    // Associate Dean CANNOT
    const dbAD = authedDb('assoc_dean');
    await assertFails(getDoc(doc(dbAD, 'responses', respId)));

    // HRDC CANNOT
    const dbHRDC = authedDb('hrdc');
    await assertFails(getDoc(doc(dbHRDC, 'responses', respId)));

    // App Admin CAN
    const dbAdmin = authedDb('app_admin');
    await assertSucceeds(getDoc(doc(dbAdmin, 'responses', respId)));
  });

  // -------------------------------------------------------------------------
  // 15a. Participant cannot create response with confidential:false for a
  //      confidential activity
  // -------------------------------------------------------------------------
  it('15a. Participant cannot create response with wrong confidential flag', async () => {
    // First enable the confidential activity for CS so the write isn't blocked by activityOpen
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'activityState', 'computer-science__d1s1_a2_tl_questionnaire'), {
        department: 'computer-science',
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        enabled: true,
        locked: false,
        updatedBy: 'hod.cs@christuniversity.in',
        updatedAt: new Date(),
      });
    });

    const db = authedDb('cs_part2');
    await assertFails(
      setDoc(doc(db, 'responses', 'd1s1_a2_tl_questionnaire__part2.cs@christuniversity.in'), {
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part2.cs@christuniversity.in',
        uid: 'uid-cs-part2',
        name: 'CS Participant 2',
        answers: {},
        status: 'draft',
        confidential: false, // WRONG — activity is confidential: true
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 15b. Participant cannot change confidential on update
  // -------------------------------------------------------------------------
  it('15b. Participant cannot change confidential on update', async () => {
    const db = authedDb('cs_part1');
    // The pre-seeded response has confidential: false. Trying to change it.
    await assertFails(
      updateDoc(
        doc(db, 'responses', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'),
        { confidential: true, updatedAt: serverTimestamp() }
      )
    );
  });

  // -------------------------------------------------------------------------
  // 16a. HoD can read summaries for own department only
  // -------------------------------------------------------------------------
  it('16a. HoD can read summaries for own department only', async () => {
    // CS HoD CAN read CS summary
    const dbCS = authedDb('cs_hod');
    await assertSucceeds(
      getDoc(doc(dbCS, 'summaries', 'computer-science__d1s1_a2_tl_questionnaire'))
    );

    // Commerce HoD CANNOT read CS summary
    const dbCom = authedDb('com_hod');
    await assertFails(
      getDoc(doc(dbCom, 'summaries', 'computer-science__d1s1_a2_tl_questionnaire'))
    );
  });

  // -------------------------------------------------------------------------
  // 16b. Participant cannot write summaries
  // -------------------------------------------------------------------------
  it('16b. Participant cannot write summaries', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(db, 'summaries', 'computer-science__d1s1_a2_tl_questionnaire'), {
        department: 'computer-science',
        activityId: 'd1s1_a2_tl_questionnaire',
        n: 10,
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 16c. Only App Admin can write summaries
  // -------------------------------------------------------------------------
  it('16c. Only App Admin can write summaries', async () => {
    const dbAdmin = authedDb('app_admin');
    await assertSucceeds(
      setDoc(doc(dbAdmin, 'summaries', 'computer-science__d1s1_a2_tl_questionnaire'), {
        department: 'computer-science',
        activityId: 'd1s1_a2_tl_questionnaire',
        n: 10,
        updatedAt: serverTimestamp(),
      })
    );

    // HoD CANNOT write summaries
    const dbHoD = authedDb('cs_hod');
    await assertFails(
      setDoc(doc(dbHoD, 'summaries', 'computer-science__d1s1_a2_tl_questionnaire'), {
        department: 'computer-science',
        activityId: 'd1s1_a2_tl_questionnaire',
        n: 99,
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 17a. Participant cannot write progress for another person
  // -------------------------------------------------------------------------
  it('17a. Participant cannot write progress for another person', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(db, 'progress', 'd1s1_a1_four_pillars__part2.cs@christuniversity.in'), {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part2.cs@christuniversity.in', // WRONG — not the authed user
        name: 'CS Participant 2',
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 17b. Participant cannot write progress for another department
  // -------------------------------------------------------------------------
  it('17b. Participant cannot write progress for another department', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(db, 'progress', 'd1s1_a1_four_pillars__part1.cs@christuniversity.in'), {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'commerce', // WRONG — user is in computer-science
        email: 'part1.cs@christuniversity.in',
        name: 'CS Participant 1',
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 17c. Participant cannot write progress for disabled/locked activity
  // -------------------------------------------------------------------------
  it('17c. Participant cannot write progress for disabled activity', async () => {
    const db = authedDb('cs_part1');
    // d1s1_a2 is disabled for computer-science
    await assertFails(
      setDoc(doc(db, 'progress', 'd1s1_a2_tl_questionnaire__part1.cs@christuniversity.in'), {
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part1.cs@christuniversity.in',
        name: 'CS Participant 1',
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
    );
  });

  it('17c-locked. Participant cannot write progress for locked activity', async () => {
    const db = authedDb('com_part1');
    // d1s1_a2 is locked for commerce
    await assertFails(
      setDoc(doc(db, 'progress', 'd1s1_a2_tl_questionnaire__part1.com@christuniversity.in'), {
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        department: 'commerce',
        email: 'part1.com@christuniversity.in',
        name: 'Com Participant 1',
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // =========================================================================
  // Positive Tests (P1 - P7)
  // =========================================================================

  // -------------------------------------------------------------------------
  // P1. A participant CAN create and update their own response when the
  //     activity is enabled and unlocked for their department (confidential
  //     and non-confidential).
  // -------------------------------------------------------------------------
  it('P1. A participant CAN create and update their own response when the activity is enabled and unlocked for their department (confidential and non-confidential)', async () => {
    const db = authedDb('cs_part2');

    // --- Non-confidential response (d1s1_a1_four_pillars is already enabled and unlocked) ---
    const nonConfRef = doc(
      db,
      'responses',
      'd1s1_a1_four_pillars__part2.cs@christuniversity.in'
    );
    // Create
    await assertSucceeds(
      setDoc(nonConfRef, {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part2.cs@christuniversity.in',
        uid: 'uid-cs-part2',
        name: 'CS Participant 2',
        answers: { p1: { q1: 'o1' } },
        status: 'draft',
        confidential: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Update
    await assertSucceeds(
      updateDoc(nonConfRef, {
        answers: { p1: { q1: 'o2' } },
        status: 'submitted',
        updatedAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      })
    );

    // --- Confidential response (d1s1_a2_tl_questionnaire) ---
    // First enable and unlock the confidential activity for computer-science
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, 'activityState', 'computer-science__d1s1_a2_tl_questionnaire'), {
        department: 'computer-science',
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        enabled: true,
        locked: false,
        updatedBy: 'hod.cs@christuniversity.in',
        updatedAt: new Date(),
      });
    });

    const confRef = doc(
      db,
      'responses',
      'd1s1_a2_tl_questionnaire__part2.cs@christuniversity.in'
    );
    // Create
    await assertSucceeds(
      setDoc(confRef, {
        activityId: 'd1s1_a2_tl_questionnaire',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part2.cs@christuniversity.in',
        uid: 'uid-cs-part2',
        name: 'CS Participant 2',
        answers: { a1: 5 },
        status: 'draft',
        confidential: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Update
    await assertSucceeds(
      updateDoc(confRef, {
        answers: { a1: 5, a2: 4 },
        status: 'submitted',
        updatedAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // P2. A participant CAN write their own progress doc and their own workingDocs doc.
  // -------------------------------------------------------------------------
  it('P2. A participant CAN write their own progress doc and their own workingDocs doc', async () => {
    const db = authedDb('cs_part2');

    // 1. Progress doc (for open activity d1s1_a1_four_pillars)
    const progRef = doc(
      db,
      'progress',
      'd1s1_a1_four_pillars__part2.cs@christuniversity.in'
    );
    // Create
    await assertSucceeds(
      setDoc(progRef, {
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        department: 'computer-science',
        email: 'part2.cs@christuniversity.in',
        name: 'CS Participant 2',
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
    );
    // Update
    await assertSucceeds(
      updateDoc(progRef, {
        status: 'submitted',
        updatedAt: serverTimestamp(),
      })
    );

    // 2. workingDocs doc
    const workRef = doc(db, 'workingDocs', 'part2.cs@christuniversity.in');
    // Create
    await assertSucceeds(
      setDoc(workRef, {
        email: 'part2.cs@christuniversity.in',
        department: 'computer-science',
        fields: { vision: 'T-shaped engineers' },
        updatedAt: serverTimestamp(),
      })
    );
    // Update
    await assertSucceeds(
      updateDoc(workRef, {
        fields: { vision: 'Updated T-shaped engineers', goals: 'Interdisciplinary' },
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // P3. A HoD CAN enable, lock and disable an activity for their own department.
  // -------------------------------------------------------------------------
  it('P3. A HoD CAN enable, lock and disable an activity for their own department', async () => {
    const db = authedDb('cs_hod');
    const stateRef = doc(
      db,
      'activityState',
      'computer-science__d1s1_a1_four_pillars'
    );

    // 1. Lock
    await assertSucceeds(
      setDoc(stateRef, {
        department: 'computer-science',
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        enabled: true,
        locked: true,
        updatedBy: 'hod.cs@christuniversity.in',
        updatedAt: serverTimestamp(),
      })
    );

    // 2. Disable
    await assertSucceeds(
      setDoc(stateRef, {
        department: 'computer-science',
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        enabled: false,
        locked: false,
        updatedBy: 'hod.cs@christuniversity.in',
        updatedAt: serverTimestamp(),
      })
    );

    // 3. Enable
    await assertSucceeds(
      setDoc(stateRef, {
        department: 'computer-science',
        activityId: 'd1s1_a1_four_pillars',
        sessionId: 'd1s1',
        enabled: true,
        locked: false,
        updatedBy: 'hod.cs@christuniversity.in',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // P4. A HoD CAN list non-confidential responses of their own department
  //     using where('department','==',…) and where('confidential','==',false).
  // -------------------------------------------------------------------------
  it("P4. A HoD CAN list non-confidential responses of their own department using where('department','==',…) and where('confidential','==',false)", async () => {
    const db = authedDb('cs_hod');
    const q = query(
      collection(db, 'responses'),
      where('department', '==', 'computer-science'),
      where('confidential', '==', false)
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.empty).toBe(false);
  });

  // -------------------------------------------------------------------------
  // P5. A HoD CAN list progress for their own department.
  // -------------------------------------------------------------------------
  it('P5. A HoD CAN list progress for their own department', async () => {
    const db = authedDb('cs_hod');
    const q = query(
      collection(db, 'progress'),
      where('department', '==', 'computer-science')
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.empty).toBe(false);
  });

  // -------------------------------------------------------------------------
  // P6. Every active user CAN read sessions, activities and their own roster doc.
  // -------------------------------------------------------------------------
  it('P6. Every active user CAN read sessions, activities and their own roster doc', async () => {
    const activeUserKeys = [
      'cs_part1',
      'cs_hod',
      'dean',
      'assoc_dean',
      'hrdc',
      'app_admin',
    ] as const;

    for (const key of activeUserKeys) {
      const db = authedDb(key);
      const userEmail = authUsers[key].email;

      await assertSucceeds(getDoc(doc(db, 'sessions', 'd1s1')));
      await assertSucceeds(getDoc(doc(db, 'activities', 'd1s1_a1_four_pillars')));
      await assertSucceeds(getDoc(doc(db, 'roster', userEmail)));
    }
  });

  // -------------------------------------------------------------------------
  // P7. The App Admin CAN write roster, activities and summaries.
  // -------------------------------------------------------------------------
  it('P7. The App Admin CAN write roster, activities and summaries', async () => {
    const db = authedDb('app_admin');

    // 1. Write roster (create & update)
    const newFacultyEmail = 'newfac.cs@christuniversity.in';
    const rosterRef = doc(db, 'roster', newFacultyEmail);
    await assertSucceeds(
      setDoc(rosterRef, {
        email: newFacultyEmail,
        name: 'New Faculty CS',
        department: 'computer-science',
        role: 'participant',
        adminType: null,
        active: true,
        uploadedBy: 'appadmin@christuniversity.in',
        uploadedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(rosterRef, {
        name: 'New Faculty CS (Updated)',
      })
    );

    // 2. Write activities (create & update)
    const actRef = doc(db, 'activities', 'd1s1_a3_curriculum_review');
    await assertSucceeds(
      setDoc(actRef, {
        sessionId: 'd1s1',
        order: 3,
        title: 'Curriculum Review',
        widgetType: 'composite',
        config: {},
        sourceRef: 'test',
        groupMode: 'individual',
        derived: false,
        confidential: false,
      })
    );
    await assertSucceeds(
      updateDoc(actRef, {
        title: 'Curriculum Review (Updated)',
      })
    );

    // 3. Write summaries (create & update)
    const sumRef = doc(db, 'summaries', 'commerce__d1s1_a2_tl_questionnaire');
    await assertSucceeds(
      setDoc(sumRef, {
        department: 'commerce',
        activityId: 'd1s1_a2_tl_questionnaire',
        n: 10,
        itemStats: {},
        sectionStats: {},
        totalStats: {},
        bandCounts: {},
        comments: [],
        suppressed: false,
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(sumRef, {
        n: 12,
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // 18. config/app — active participant CAN read, cannot write; non-roster CANNOT read
  // -------------------------------------------------------------------------
  it('18a. Active participant CAN read config/app', async () => {
    // Seed config/app with security rules disabled
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'config', 'app'), {
        groupProtocol: 'Test protocol',
        groupLabels: ['Group 1', 'Group 2'],
      });
    });

    const db = authedDb('cs_part1');
    await assertSucceeds(getDoc(doc(db, 'config', 'app')));
  });

  it('18b. Active participant CANNOT write config/app', async () => {
    const db = authedDb('cs_part1');
    await assertFails(
      setDoc(doc(db, 'config', 'app'), {
        groupProtocol: 'Hacked protocol',
        groupLabels: [],
      })
    );
  });

  it('18c. Non-roster CHRIST user CANNOT read config/app', async () => {
    const db = authedDb('not_in_roster');
    await assertFails(getDoc(doc(db, 'config', 'app')));
  });

  // =========================================================================
  // Addendum Tests: Feedback, FeedbackSummaries, ReportMeta (F1-F10)
  // =========================================================================

  // -------------------------------------------------------------------------
  // F1. A participant can create their own feedback/{email} draft and flip it to submitted.
  // -------------------------------------------------------------------------
  it('F1. Participant can create feedback draft and submit it', async () => {
    const db = authedDb('cs_part1');
    const fbRef = doc(db, 'feedback', 'part1.cs@christuniversity.in');

    // Create draft
    await assertSucceeds(
      setDoc(fbRef, {
        email: 'part1.cs@christuniversity.in',
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        department: 'computer-science',
        role: 'participant',
        answers: { pA: { a1: 4 } },
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Submit
    await assertSucceeds(
      updateDoc(fbRef, {
        answers: { pA: { a1: 5 } },
        status: 'submitted',
        updatedAt: serverTimestamp(),
        submittedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // F2. Coordinator and Resource Person can each create their own feedback.
  // -------------------------------------------------------------------------
  it('F2. Coordinator and Resource Person can create their own feedback', async () => {
    // Coordinator
    const dbC = authedDb('coordinator');
    await assertSucceeds(
      setDoc(doc(dbC, 'feedback', 'coordinator@christuniversity.in'), {
        email: 'coordinator@christuniversity.in',
        uid: 'uid-coordinator',
        name: 'QIP Coordinator',
        department: 'computer-science',
        role: 'coordinator',
        answers: { pA: { a1: 5 } },
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Resource Person
    const dbR = authedDb('res_person');
    await assertSucceeds(
      setDoc(doc(dbR, 'feedback', 'resperson@christuniversity.in'), {
        email: 'resperson@christuniversity.in',
        uid: 'uid-resperson',
        name: 'Resource Person',
        department: 'computer-science',
        role: 'resource_person',
        answers: { pA: { a1: 4 } },
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // F3. Participant cannot read another's feedback; App Admin can read any.
  // -------------------------------------------------------------------------
  it('F3. Participant cannot read another feedback; App Admin can', async () => {
    // Seed feedback for part1
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'feedback', 'part1.cs@christuniversity.in'), {
        email: 'part1.cs@christuniversity.in', uid: 'uid-cs-part1', name: 'CS P1',
        department: 'computer-science', role: 'participant',
        answers: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date(),
      });
    });

    // Part2 cannot read Part1's feedback
    const dbP2 = authedDb('cs_part2');
    await assertFails(getDoc(doc(dbP2, 'feedback', 'part1.cs@christuniversity.in')));

    // App Admin CAN
    const dbAdmin = authedDb('app_admin');
    await assertSucceeds(getDoc(doc(dbAdmin, 'feedback', 'part1.cs@christuniversity.in')));
  });

  // -------------------------------------------------------------------------
  // F4. HoD, Dean/AD/HRDC, Resource Person cannot get/list individual feedback — only feedbackSummaries/overall.
  // -------------------------------------------------------------------------
  it('F4. HoD/Dean/RP cannot read individual feedback but can read feedbackSummaries', async () => {
    // Seed feedback + feedbackSummaries
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'feedback', 'part1.cs@christuniversity.in'), {
        email: 'part1.cs@christuniversity.in', uid: 'uid-cs-part1', name: 'CS P1',
        department: 'computer-science', role: 'participant',
        answers: {}, status: 'draft', createdAt: new Date(), updatedAt: new Date(),
      });
      await setDoc(doc(db, 'feedbackSummaries', 'overall'), {
        n: 10, updatedAt: new Date(),
      });
    });

    // HoD cannot read individual feedback
    const dbHoD = authedDb('cs_hod');
    await assertFails(getDoc(doc(dbHoD, 'feedback', 'part1.cs@christuniversity.in')));
    // HoD CAN read feedbackSummaries
    await assertSucceeds(getDoc(doc(dbHoD, 'feedbackSummaries', 'overall')));

    // Dean cannot read feedback
    const dbDean = authedDb('dean');
    await assertFails(getDoc(doc(dbDean, 'feedback', 'part1.cs@christuniversity.in')));
    // Dean CAN read feedbackSummaries (isAdmin)
    await assertSucceeds(getDoc(doc(dbDean, 'feedbackSummaries', 'overall')));

    // Resource Person cannot read feedback
    const dbRP = authedDb('res_person');
    await assertFails(getDoc(doc(dbRP, 'feedback', 'part1.cs@christuniversity.in')));
    // RP CAN read feedbackSummaries
    await assertSucceeds(getDoc(doc(dbRP, 'feedbackSummaries', 'overall')));
  });

  // -------------------------------------------------------------------------
  // F5. Only App Admin can write feedbackSummaries/overall; others can read but not write.
  // -------------------------------------------------------------------------
  it('F5. Only App Admin can write feedbackSummaries/overall', async () => {
    const dbAdmin = authedDb('app_admin');
    await assertSucceeds(
      setDoc(doc(dbAdmin, 'feedbackSummaries', 'overall'), {
        n: 15, updatedAt: serverTimestamp(),
      })
    );

    // Coordinator cannot write
    const dbC = authedDb('coordinator');
    await assertFails(
      setDoc(doc(dbC, 'feedbackSummaries', 'overall'), {
        n: 99, updatedAt: serverTimestamp(),
      })
    );

    // HoD cannot write
    const dbHoD = authedDb('cs_hod');
    await assertFails(
      setDoc(doc(dbHoD, 'feedbackSummaries', 'overall'), {
        n: 99, updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // F6. Participant cannot update feedback once status == 'submitted'.
  // -------------------------------------------------------------------------
  it('F6. Participant cannot update feedback once submitted', async () => {
    // Seed submitted feedback
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'feedback', 'part1.cs@christuniversity.in'), {
        email: 'part1.cs@christuniversity.in', uid: 'uid-cs-part1', name: 'CS P1',
        department: 'computer-science', role: 'participant',
        answers: { pA: { a1: 5 } }, status: 'submitted',
        createdAt: new Date(), updatedAt: new Date(), submittedAt: new Date(),
      });
    });

    const db = authedDb('cs_part1');
    await assertFails(
      updateDoc(doc(db, 'feedback', 'part1.cs@christuniversity.in'), {
        answers: { pA: { a1: 1 } },
        status: 'draft',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // F7. Participant cannot spoof role or department during feedback creation.
  // -------------------------------------------------------------------------
  it('F7. Participant cannot spoof role or department in feedback', async () => {
    const db = authedDb('cs_part1');

    // Wrong role
    await assertFails(
      setDoc(doc(db, 'feedback', 'part1.cs@christuniversity.in'), {
        email: 'part1.cs@christuniversity.in',
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        department: 'computer-science',
        role: 'admin', // WRONG
        answers: {},
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );

    // Wrong department
    await assertFails(
      setDoc(doc(db, 'feedback', 'part1.cs@christuniversity.in'), {
        email: 'part1.cs@christuniversity.in',
        uid: 'uid-cs-part1',
        name: 'CS Participant 1',
        department: 'commerce', // WRONG
        role: 'participant',
        answers: {},
        status: 'draft',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // F8. canEditReport() roles can write reportMeta/main; Dean/RP are read-only.
  // -------------------------------------------------------------------------
  it('F8. canEditReport roles can write reportMeta; Dean/RP cannot', async () => {
    const reportData = {
      fields: { hodObservations: 'test' },
      updatedAt: serverTimestamp(),
    };

    // App Admin CAN
    const dbAdmin = authedDb('app_admin');
    await assertSucceeds(
      setDoc(doc(dbAdmin, 'reportMeta', 'main'), {
        ...reportData,
        updatedBy: 'appadmin@christuniversity.in',
      })
    );

    // Coordinator CAN
    const dbC = authedDb('coordinator');
    await assertSucceeds(
      setDoc(doc(dbC, 'reportMeta', 'main'), {
        ...reportData,
        updatedBy: 'coordinator@christuniversity.in',
      })
    );

    // HoD CAN
    const dbHoD = authedDb('cs_hod');
    await assertSucceeds(
      setDoc(doc(dbHoD, 'reportMeta', 'main'), {
        ...reportData,
        updatedBy: 'hod.cs@christuniversity.in',
      })
    );

    // Dean CANNOT write
    const dbDean = authedDb('dean');
    await assertFails(
      setDoc(doc(dbDean, 'reportMeta', 'main'), {
        ...reportData,
        updatedBy: 'dean@christuniversity.in',
      })
    );

    // Dean CAN read
    await assertSucceeds(getDoc(doc(dbDean, 'reportMeta', 'main')));

    // Resource Person CANNOT write
    const dbRP = authedDb('res_person');
    await assertFails(
      setDoc(doc(dbRP, 'reportMeta', 'main'), {
        ...reportData,
        updatedBy: 'resperson@christuniversity.in',
      })
    );

    // Resource Person CAN read
    await assertSucceeds(getDoc(doc(dbRP, 'reportMeta', 'main')));
  });

  // -------------------------------------------------------------------------
  // F9. Participant cannot read or write reportMeta at all.
  // -------------------------------------------------------------------------
  it('F9. Participant cannot read or write reportMeta', async () => {
    // Seed reportMeta
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'reportMeta', 'main'), {
        fields: {}, updatedBy: 'appadmin@christuniversity.in', updatedAt: new Date(),
      });
    });

    const db = authedDb('cs_part1');
    await assertFails(getDoc(doc(db, 'reportMeta', 'main')));
    await assertFails(
      setDoc(doc(db, 'reportMeta', 'main'), {
        fields: { hacked: true },
        updatedBy: 'part1.cs@christuniversity.in',
        updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // F10. Unauthenticated request is rejected on all three new collections.
  // -------------------------------------------------------------------------
  it('F10. Unauthenticated access denied on feedback, feedbackSummaries, reportMeta', async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

    await assertFails(getDoc(doc(unauthedDb, 'feedback', 'part1.cs@christuniversity.in')));
    await assertFails(getDoc(doc(unauthedDb, 'feedbackSummaries', 'overall')));
    await assertFails(getDoc(doc(unauthedDb, 'reportMeta', 'main')));

    await assertFails(
      setDoc(doc(unauthedDb, 'feedback', 'anon@christuniversity.in'), {
        email: 'anon@christuniversity.in', uid: 'x', name: 'X',
        department: 'cs', role: 'participant', answers: {},
        status: 'draft', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      })
    );
  });

  // -------------------------------------------------------------------------
  // Storage Photo Gallery Tests (Addendum Phase 3B)
  // -------------------------------------------------------------------------
  describe('Storage Photo Gallery', () => {
    it('S1. non-canEditReport() account upload attempt is denied, and canEditReport() account upload succeeds', async () => {
      // Participant (non-canEditReport)
      const partStorage = authedContext('cs_part1').storage();
      const partRef = ref(partStorage as any, 'qipReportPhotos/123-test.png');
      const dummyFile = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // Fake PNG header
      const blob = new Blob([dummyFile], { type: 'image/png' });

      await assertFails(uploadBytes(partRef as any, blob as any));

      // App Admin (canEditReport)
      const adminStorage = authedContext('app_admin').storage();
      const adminRef = ref(adminStorage as any, 'qipReportPhotos/123-test.png');
      await assertSucceeds(uploadBytes(adminRef as any, blob as any));

      // Cleanup
      await assertSucceeds(deleteObject(adminRef as any));
    });
  });

});
