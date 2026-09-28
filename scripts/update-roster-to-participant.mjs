import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getAccessToken() {
  const m = await import('file:///C:/Users/balas/AppData/Roaming/npm/node_modules/firebase-tools/lib/configstore.js');
  const cs = m.configstore || m.default;
  const tokens = cs.get('tokens');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  return data.access_token || tokens.access_token;
}

async function safeFetch(url, options, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(url, options);
      if (res.status === 429) {
        console.log(`   ⏳ Rate limit warming up (status 429, attempt ${attempt}/${maxRetries}), waiting 4s...`);
        await new Promise(r => setTimeout(r, 4000));
        continue;
      }
      return res;
    } catch (err) {
      console.log(`   ⚠️ Network connection issue (attempt ${attempt}/${maxRetries}): ${err.message}, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts.`);
}

async function updateAllRosterToParticipant() {
  console.log('🔑 Authenticating with Firebase credentials...');
  const accessToken = await getAccessToken();

  const projectId = 'byc-t-shape-qip';
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  console.log('📥 Fetching all roster documents from Firestore in chunks...');
  let nextPageToken = '';
  const allDocs = [];

  do {
    const url = `${baseUrl}/roster?pageSize=20${nextPageToken ? '&pageToken=' + nextPageToken : ''}`;
    const res = await safeFetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ HTTP ${res.status}: ${errText}`);
      return;
    }

    const data = await res.json();
    if (data.documents && data.documents.length > 0) {
      allDocs.push(...data.documents);
      console.log(`   Fetched ${allDocs.length} roster documents so far...`);
    }
    nextPageToken = data.nextPageToken || '';
    if (nextPageToken) {
      await new Promise(r => setTimeout(r, 200));
    }
  } while (nextPageToken);

  console.log(`\n📋 Found ${allDocs.length} total users in Firestore roster collection.`);

  if (allDocs.length === 0) {
    console.log('No documents found in roster collection.');
    return;
  }

  // Count existing roles
  const roleCounts = {};
  for (const doc of allDocs) {
    const currentRole = doc.fields?.role?.stringValue || 'none';
    roleCounts[currentRole] = (roleCounts[currentRole] || 0) + 1;
  }
  console.log('Current role breakdown in Firestore roster:');
  for (const [role, count] of Object.entries(roleCounts)) {
    console.log(` - ${role}: ${count}`);
  }

  // Prepare batch commits
  console.log('\n🔄 Updating role of all users to "participant"...');
  const batchSize = 25;
  let updatedCount = 0;

  for (let i = 0; i < allDocs.length; i += batchSize) {
    const chunk = allDocs.slice(i, i + batchSize);
    const writes = chunk.map(doc => {
      const docName = doc.name;
      return {
        update: {
          name: docName,
          fields: {
            role: { stringValue: 'participant' }
          }
        },
        updateMask: {
          fieldPaths: ['role']
        }
      };
    });

    const commitRes = await safeFetch(`${baseUrl}:commit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ writes })
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      console.error(`❌ Batch commit failed at offset ${i}: ${errText}`);
      return;
    }

    updatedCount += chunk.length;
    console.log(`   ✓ Updated ${updatedCount}/${allDocs.length} roster documents to "participant"...`);
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n🎉 SUCCESS: All ${updatedCount} users in the Firestore roster collection have been updated to role "participant"!`);
}

updateAllRosterToParticipant().catch(err => {
  console.error('Fatal error:', err);
});
