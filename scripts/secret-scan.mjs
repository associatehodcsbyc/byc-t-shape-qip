#!/usr/bin/env node

// Pre-commit secret scanner — runs under Git's shell on Windows.
// Checks staged files for patterns that suggest leaked secrets.
// Called from .husky/pre-commit.

import { execSync } from 'child_process';
import process from 'process';

const BLOCKED_FILE_RULES = [
  { name: '.env', test: base => base === '.env' },
  { name: '.env.local', test: base => base === '.env.local' },
  { name: '.env.*.local', test: base => /^\.env\..+\.local$/.test(base) },
  { name: '*serviceAccount*.json', test: base => /.*serviceAccount.*\.json$/i.test(base) },
  { name: '*-firebase-adminsdk-*.json', test: base => /(?:.*-)?firebase-adminsdk-.*\.json$/i.test(base) },
  { name: 'firebase-debug.log', test: base => base === 'firebase-debug.log' },
  { name: 'firestore-debug.log', test: base => base === 'firestore-debug.log' },
  { name: 'ui-debug.log', test: base => base === 'ui-debug.log' },
];

const CONTENT_PATTERNS = [
  {
    name: 'Private Key PEM header',
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'Private Key JSON field',
    pattern: /"private_key"\s*:\s*"/,
  },
  {
    name: 'Service Account JSON type',
    pattern: /"type"\s*:\s*"service_account"/,
  },
  {
    name: 'OpenAI Secret Key',
    pattern: /sk-[A-Za-z0-9]{20,}/,
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /ghp_[A-Za-z0-9]{36}/,
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_\-]{35}/,
    // Block it in every file except .env*
    skipFile: base => base.startsWith('.env'),
  },
];

try {
  const staged = execSync('git diff --cached --name-only --diff-filter=ACM', {
    encoding: 'utf-8',
  })
    .split('\n')
    .map(f => f.trim().replace(/^"|"$/g, ''))
    .filter(f => f.length > 0);

  if (staged.length === 0) {
    process.exit(0);
  }

  let found = false;

  for (const file of staged) {
    const normalized = file.replace(/\\/g, '/');

    // Skip only scripts/secret-scan.mjs itself, by exact path.
    if (normalized === 'scripts/secret-scan.mjs') {
      continue;
    }

    const basename = normalized.split('/').pop() || '';

    // 1. Check blocked file names
    for (const rule of BLOCKED_FILE_RULES) {
      if (rule.test(basename)) {
        console.error(
          `\n🚨 BLOCKED FILE DETECTED in staged changes: ${file} (matches ${rule.name})`
        );
        console.error(
          `   Files matching sensitive filename patterns must not be committed.`
        );
        found = true;
      }
    }

    // 2. Read staged content and scan lines for secret patterns
    let content;
    try {
      // Read the staged version of the file, not the working-tree copy.
      content = execSync(`git show ":${file}"`, { encoding: 'utf-8' });
    } catch {
      // Binary file or deleted — skip.
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { name, pattern, skipFile } of CONTENT_PATTERNS) {
        if (skipFile && skipFile(basename)) {
          continue;
        }
        if (pattern.test(line)) {
          console.error(
            `\n🚨 SECRET DETECTED in staged file: ${file}:${i + 1} (${name})`
          );
          console.error(`   Pattern: ${pattern}`);
          console.error(`   Line:    ${line.trim().substring(0, 120)}`);
          found = true;
        }
      }
    }
  }

  if (found) {
    console.error('\n❌ Commit blocked. Remove secrets before committing.\n');
    process.exit(1);
  }
} catch (error) {
  console.error('Error running secret scan:', error.message);
  process.exit(1);
}
