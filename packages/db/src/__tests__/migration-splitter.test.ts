import { describe, expect, it } from 'vitest';
import { splitSqlStatements } from '../../scripts/migrate.js';

describe('splitSqlStatements', () => {
  it('keeps DO $$ ... $$ blocks intact', () => {
    const sql = `DO $$ BEGIN
  CREATE TYPE "example_status" AS ENUM('active', 'paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE example (id uuid primary key);`;

    const statements = splitSqlStatements(sql);

    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('DO $$ BEGIN');
    expect(statements[0]).toContain('WHEN duplicate_object THEN null;');
    expect(statements[0]).toContain('END $$');
    expect(statements[1]).toBe('--> statement-breakpoint\nCREATE TABLE example (id uuid primary key)');
  });

  it('does not split on semicolons inside quoted strings', () => {
    const sql = `INSERT INTO notes (body) VALUES ('hello; world');
INSERT INTO notes (body) VALUES ("quoted;identifier");`;

    const statements = splitSqlStatements(sql);

    expect(statements).toEqual([
      "INSERT INTO notes (body) VALUES ('hello; world')",
      'INSERT INTO notes (body) VALUES ("quoted;identifier")',
    ]);
  });

  it('does not split on semicolons inside comments', () => {
    const sql = `-- comment with semicolon ;
CREATE TABLE comment_test (id integer);
/* block; comment; still comment */
INSERT INTO comment_test VALUES (1);`;

    const statements = splitSqlStatements(sql);

    expect(statements).toEqual([
      '-- comment with semicolon ;\nCREATE TABLE comment_test (id integer)',
      '/* block; comment; still comment */\nINSERT INTO comment_test VALUES (1)',
    ]);
  });
});
