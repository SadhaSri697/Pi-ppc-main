import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { InitCommand } from '../src/cli/init.js';
import { StatusCommand } from '../src/cli/status.js';
import { ContextCommand } from '../src/cli/context.js';
import { SyncCommand } from '../src/cli/sync.js';
import { MemoryCommand } from '../src/cli/memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CLI Commands', () => {
  const projectRoot = path.resolve(__dirname, '..');

  test('StatusCommand runs and returns formatted text', async () => {
    const statusCmd = new StatusCommand(projectRoot);
    const result = await statusCmd.run({ projectRoot, format: 'text' });
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('Project Status'));
  });

  test('StatusCommand outputs valid JSON', async () => {
    const statusCmd = new StatusCommand(projectRoot);
    const result = await statusCmd.run({ projectRoot, format: 'json' });
    const parsed = JSON.parse(result);
    assert.ok(parsed.stats);
    assert.ok(typeof parsed.stats.totalEvents === 'number');
  });

  test('ContextCommand builds markdown context', async () => {
    const contextCmd = new ContextCommand(projectRoot);
    const result = await contextCmd.run({ projectRoot, format: 'markdown' });
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('# Project Context'));
  });

  test('ContextCommand builds JSON context', async () => {
    const contextCmd = new ContextCommand(projectRoot);
    const result = await contextCmd.run({ projectRoot, format: 'json' });
    const parsed = JSON.parse(result);
    assert.ok(parsed.identity);
    assert.ok(parsed.architecture);
    assert.ok(parsed.state);
  });

  test('SyncCommand synchronizes project graphs', async () => {
    const syncCmd = new SyncCommand(projectRoot);
    const result = await syncCmd.run({ projectRoot, scope: 'all' });
    assert.ok(typeof result === 'string');
    assert.ok(result.includes('Synced'));
  });

  test('MemoryCommand displays memory sections', async () => {
    const memoryCmd = new MemoryCommand(projectRoot);
    const beliefs = await memoryCmd.run({ projectRoot, section: 'beliefs' });
    assert.ok(typeof beliefs === 'string');

    const allMemory = await memoryCmd.run({ projectRoot, format: 'markdown' });
    assert.ok(typeof allMemory === 'string');
  });

  test('InitCommand initializes directory in a clean folder', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-init-test-'));
    try {
      const initCmd = new InitCommand(tempDir);
      const res = await initCmd.run({ projectRoot: tempDir });
      assert.ok(res.created.length > 0);
      assert.ok(fs.existsSync(path.join(tempDir, '.pi')));
      assert.ok(fs.existsSync(path.join(tempDir, '.pi', 'identity', 'vision.md')));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
