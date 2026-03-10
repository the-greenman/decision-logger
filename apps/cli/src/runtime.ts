import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

let verboseEnabled = false;

export function setCliVerbose(enabled: boolean): void {
  verboseEnabled = enabled;
}

export function isCliVerbose(): boolean {
  return verboseEnabled;
}

export function logHttpRequest(method: string, url: string, body?: unknown): void {
  if (!verboseEnabled) return;
  process.stderr.write(`${chalk.gray(`[http] ${method} ${url}`)}\n`);
  if (body !== undefined) {
    process.stderr.write(`${chalk.gray(`[http] request body: ${JSON.stringify(body)}`)}\n`);
  }
}

export async function logHttpResponse(status: number, url: string, payload?: unknown): Promise<void> {
  if (!verboseEnabled) return;
  process.stderr.write(`${chalk.gray(`[http] response ${status} ${url}`)}\n`);
  if (payload !== undefined) {
    process.stderr.write(`${chalk.gray(`[http] response body: ${JSON.stringify(payload)}`)}\n`);
  }
}

export async function confirmAction(message: string): Promise<boolean> {
  if (process.env.CI === 'true' || process.env.VITEST === 'true') {
    return true;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${message} ${chalk.gray('(y/N)')} `);
    return ['y', 'yes'].includes(answer.trim().toLowerCase());
  } finally {
    rl.close();
  }
}

export async function withSpinner<T>(message: string, task: () => Promise<T>): Promise<T> {
  if (!process.stdout.isTTY) {
    return task();
  }

  const frames = ['|', '/', '-', '\\'];
  let index = 0;
  output.write(`${chalk.blue(frames[index])} ${message}`);
  const timer = setInterval(() => {
    index = (index + 1) % frames.length;
    output.write(`\r${chalk.blue(frames[index])} ${message}`);
  }, 80);

  try {
    const result = await task();
    clearInterval(timer);
    output.write(`\r${chalk.green('✓')} ${message}\n`);
    return result;
  } catch (error) {
    clearInterval(timer);
    output.write(`\r${chalk.red('✗')} ${message}\n`);
    throw error;
  }
}
