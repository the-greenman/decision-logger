import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { meetings } from '../../packages/db/src/schema';
import { Meeting, CreateMeeting } from '../../packages/schema/src/index';

const DATABASE_URL = 'postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_dev';

class SimpleMeetingRepository {
  private db;
  
  constructor() {
    const client = postgres(DATABASE_URL, { prepare: false, max: 10 });
    this.db = drizzle(client, { schema: { meetings } });
  }
  
  async findAll(): Promise<Meeting[]> {
    const results = await this.db.select().from(meetings);
    return results.map(row => ({
      id: row.id,
      title: row.title,
      date: row.date, // Drizzle stores as string
      participants: row.participants,
      status: row.status as 'active' | 'completed',
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

async function test() {
  console.log('Testing CLI with Drizzle...');
  const repo = new SimpleMeetingRepository();
  const meetings = await repo.findAll();
  console.log(`Found ${meetings.length} meetings`);
  meetings.forEach(m => {
    console.log(`- ${m.id}: ${m.title}`);
  });
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
