import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
let projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;

const projArgIdx = process.argv.indexOf('--project');
if (projArgIdx !== -1 && process.argv[projArgIdx + 1]) {
  projectId = process.argv[projArgIdx + 1];
}
if (!projectId) {
  projectId = 'demo-byc-qip';
}

// Safety guard 1: Refuse to run unless FIRESTORE_EMULATOR_HOST is set
if (!emulatorHost) {
  console.error('❌ Refusing to run: FIRESTORE_EMULATOR_HOST environment variable is not set.');
  console.error('   This script must only run against the local Firestore emulator (e.g. inside `firebase emulators:exec`).');
  process.exit(1);
}

// Safety guard 2: Refuse to run unless the project ID starts with demo-
if (!projectId.startsWith('demo-')) {
  console.error(`❌ Refusing to run: Project ID "${projectId}" does not start with "demo-".`);
  console.error('   This script must never run against a production or non-demo project.');
  process.exit(1);
}

const SEED_USERS = [
  {
    email: 'appadmin@christuniversity.in',
    name: 'Dr Balakrishnan C (App Admin)',
    department: 'computer-science',
    role: 'admin',
    adminType: 'app_admin',
    active: true,
  },
  {
    email: 'dean@christuniversity.in',
    name: 'Dr Joby Thomas (Dean)',
    department: 'computer-science',
    role: 'admin',
    adminType: 'dean',
    active: true,
  },
  {
    email: 'associatedean.yeshwanthpur@christuniversity.in',
    name: 'Dr Raghunanthan G (Associate Dean)',
    department: 'computer-science',
    role: 'admin',
    adminType: 'associate_dean',
    active: true,
  },
  {
    email: 'hod.cs@christuniversity.in',
    name: 'Dr Vinay M (CS HoD)',
    department: 'computer-science',
    role: 'hod',
    adminType: null,
    active: true,
  },
  {
    email: 'part1.cs@christuniversity.in',
    name: 'CS Faculty Participant 1',
    department: 'computer-science',
    role: 'participant',
    adminType: null,
    active: true,
  },
  {
    email: 'inactive@christuniversity.in',
    name: 'Inactive Faculty Member',
    department: 'computer-science',
    role: 'participant',
    adminType: null,
    active: false,
  },
];

const SEED_DEPARTMENTS = [
  { id: 'computer-science', name: 'Computer Science', campus: 'BYC' },
  { id: 'commerce', name: 'Commerce', campus: 'BYC' },
  { id: 'management', name: 'Management', campus: 'BYC' },
  { id: 'sciences', name: 'Sciences', campus: 'BYC' },
];

async function seed() {
  console.log(`🌱 Seeding Firestore emulator (${projectId} at ${emulatorHost})...`);

  const [host, portStr] = emulatorHost.split(':');
  const port = portStr ? parseInt(portStr, 10) : 8080;

  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: host || '127.0.0.1',
      port,
    },
  });

  const sessionsRaw = JSON.parse(
    readFileSync(resolve(__dirname, '../seed/sessions.json'), 'utf8')
  );
  const activitiesRaw = JSON.parse(
    readFileSync(resolve(__dirname, '../seed/activities.json'), 'utf8')
  );

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // 1. Seed departments
    for (const dept of SEED_DEPARTMENTS) {
      await setDoc(doc(db, 'departments', dept.id), {
        name: dept.name,
        campus: dept.campus,
      });
      console.log(`   ✓ Department: ${dept.name} (${dept.id})`);
    }

    // 2. Seed roster users
    for (const u of SEED_USERS) {
      await setDoc(doc(db, 'roster', u.email), {
        ...u,
        uploadedBy: 'seed-emulator',
        uploadedAt: new Date(),
      });
      console.log(`   ✓ Roster: ${u.email} (${u.role}${u.adminType ? ` / ${u.adminType}` : ''}) [active: ${u.active}]`);
    }

    // 3. Seed sessions
    for (const s of sessionsRaw.sessions) {
      await setDoc(doc(db, 'sessions', s.sessionId), s);
    }
    console.log(`   ✓ Seeded ${sessionsRaw.sessions.length} sessions`);

    // 4. Seed activities
    for (const a of activitiesRaw.activities) {
      await setDoc(doc(db, 'activities', a.activityId), a);
    }
    console.log(`   ✓ Seeded ${activitiesRaw.activities.length} activities`);

    // 5. Seed app config
    await setDoc(doc(db, 'config', 'app'), {
      groupProtocol: activitiesRaw.groupProtocol,
      groupLabels: activitiesRaw.groupLabels,
      updatedAt: new Date(),
    });
    console.log(`   ✓ Seeded config/app`);

    // 6. Enable activities for computer-science
    const now = new Date();
    for (const a of activitiesRaw.activities) {
      // Lock case 2 to test locked view
      const isLocked = a.activityId === 'd1s4_a3_case2_results_vs_understanding';

      await setDoc(doc(db, 'activityState', `computer-science__${a.activityId}`), {
        department: 'computer-science',
        activityId: a.activityId,
        sessionId: a.sessionId,
        enabled: true,
        locked: isLocked,
        updatedBy: 'seed-emulator@christuniversity.in',
        updatedAt: now,
      });
    }
    console.log(`   ✓ Initialized activityState for computer-science (All enabled, Case 2 locked)`);
  });

  await testEnv.cleanup();
  console.log('✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
