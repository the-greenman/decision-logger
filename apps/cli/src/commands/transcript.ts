import { Command } from 'commander';
import chalk from 'chalk';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { api, requireActiveMeeting } from '../client.js';
import { withSpinner } from '../runtime.js';

export const transcriptCommand = new Command('transcript')
  .description('Transcript management');

transcriptCommand
  .command('upload')
  .description('Upload a transcript file to a meeting')
  .requiredOption('-f, --file <path>', 'Path to transcript file (.txt or .json)')
  .option('-m, --meeting-id <id>', 'Meeting ID (defaults to active meeting)')
  .option('-s, --strategy <strategy>', 'Chunking strategy: fixed|semantic', 'fixed')
  .option('--chunk-size <n>', 'Chunk size in tokens', '500')
  .option('--overlap <n>', 'Chunk overlap in tokens', '50')
  .action(async (opts: { file: string; meetingId?: string; strategy: string; chunkSize: string; overlap: string }) => {
    const meetingId = opts.meetingId ?? await requireActiveMeeting();
    const filePath = resolve(opts.file);
    const raw = await readFile(filePath, 'utf-8');

    let content = raw;
    if (opts.file.endsWith('.json')) {
      const parsed = JSON.parse(raw) as Array<{ speaker?: string; text?: string }>;
      if (Array.isArray(parsed)) {
        content = parsed.map((e) => `[${e.speaker ?? 'Unknown'}]: ${e.text ?? ''}`).join('\n');
      }
    }

    const result = await withSpinner('Uploading transcript…', () => api.post<{ transcript: { id: string; format: string }; chunks: unknown[] }>(
      `/api/meetings/${meetingId}/transcripts/upload`,
      {
        content,
        format: opts.file.endsWith('.json') ? 'json' : 'txt',
        chunkStrategy: opts.strategy,
        chunkSize: parseInt(opts.chunkSize, 10),
        overlap: parseInt(opts.overlap, 10),
      },
    ));

    console.log(chalk.green('✓ Transcript uploaded'));
    console.log(chalk.gray(`Transcript ID: ${result.transcript.id}`));
    console.log(chalk.white(`Chunks created: ${result.chunks.length}`));
    console.log(chalk.white(`Strategy: ${opts.strategy}`));
  });
