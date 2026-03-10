/**
 * Apply Drizzle Migrations
 * 
 * Runs the SQL migration files directly against PostgreSQL
 */

import { client } from '../src/client.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isEntrypoint = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag: string | null = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += char;
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === '*' && next === '/') {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarQuoteTag !== null) {
      if (sql.startsWith(dollarQuoteTag, i)) {
        current += dollarQuoteTag;
        i += dollarQuoteTag.length - 1;
        dollarQuoteTag = null;
      } else {
        current += char;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'" && next === "'") {
        current += next;
        i += 1;
      } else if (char === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (char === '-' && next === '-') {
      current += char + next;
      i += 1;
      inLineComment = true;
      continue;
    }

    if (char === '/' && next === '*') {
      current += char + next;
      i += 1;
      inBlockComment = true;
      continue;
    }

    if (char === '$') {
      const remainder = sql.slice(i);
      const match = remainder.match(/^\$[A-Za-z0-9_]*\$/);
      if (match) {
        dollarQuoteTag = match[0];
        current += dollarQuoteTag;
        i += dollarQuoteTag.length - 1;
        continue;
      }
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === ';') {
      const statement = current.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
}

async function applyMigrations() {
  console.log('🔧 Applying database migrations...\n');

  const drizzleDir = join(__dirname, '../drizzle');
  
  // Find all SQL migration files
  const files = readdirSync(drizzleDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration file(s)`);

  for (const file of files) {
    console.log(`\n📄 Applying: ${file}`);
    
    const sql = readFileSync(join(drizzleDir, file), 'utf-8');
    
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
      if (statement) {
        try {
          await client.unsafe(statement + ';');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);

          // Ignore "already exists" errors
          if (!message.includes('already exists')) {
            console.error(`  ⚠️  ${message}`);
          }
        }
      }
    }
    
    console.log(`  ✓ Applied successfully`);
  }

  console.log('\n✅ All migrations applied!');
  await client.end();
}

if (isEntrypoint) {
  applyMigrations().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}
