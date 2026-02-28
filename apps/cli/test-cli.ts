import { DrizzleMeetingRepository } from '../../packages/db/dist/index.mjs';

async function test() {
  console.log('Testing CLI with Drizzle...');
  const repo = new DrizzleMeetingRepository();
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
