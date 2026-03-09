/**
 * Database Client
 *
 * Provides a singleton drizzle client for database connections.
 * Uses environment variable DATABASE_URL for connection string.
 */
import postgres from 'postgres';
import * as schema from './schema.js';
declare const client: postgres.Sql<{}>;
export declare const db: import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;
export { client };
export type Database = typeof db;
