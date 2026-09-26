import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

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

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    // Seed departments
    for (const dept of SEED_DEPARTMENTS) {
      await setDoc(doc(db, 'departments', dept.id), {
        name: dept.name,
        campus: dept.campus,
      });
      console.log(`   ✓ Department: ${dept.name} (${dept.id})`);
    }

    // Seed roster users
    for (const u of SEED_USERS) {
      await setDoc(doc(db, 'roster', u.email), {
        ...u,
        uploadedBy: 'seed-emulator',
        uploadedAt: new Date(),
      });
      console.log(`   ✓ Roster: ${u.email} (${u.role}${u.adminType ? ` / ${u.adminType}` : ''}) [active: ${u.active}]`);
    }
  });

  console.log('✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
