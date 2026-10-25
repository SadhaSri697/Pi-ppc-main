import { test, describe } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ContextEngine } from '../src/core/context-engine/index.js';
import { GraphEngine } from '../src/core/graph-engine/index.js';
import { MemoryEngine } from '../src/core/memory-engine/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Core Engines', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const piDir = path.join(projectRoot, '.pi');

  test('ContextEngine builds complete runtime context', async () => {
    const engine = new ContextEngine({ projectRoot, piDir });
    const ctx = await engine.buildRuntimeContext();

    assert.ok(ctx.identity);
    assert.ok(ctx.architecture);
    assert.ok(ctx.state);
    assert.ok(ctx.memory);
    assert.ok(ctx.graph);
  });

  test('GraphEngine extracts dependencies and files', async () => {
    const engine = new GraphEngine({ projectRoot, piDir });

    const depCount = await engine.syncDependencyGraph();
    assert.ok(typeof depCount === 'number');

    const fileCount = await engine.syncFileGraph();
    assert.ok(typeof fileCount === 'number');
    assert.ok(fileCount > 0);

    const symbolCount = await engine.syncSymbolGraph();
    assert.ok(typeof symbolCount === 'number');
  });

  test('MemoryEngine generates summaries and distills context', async () => {
    const engine = new MemoryEngine({ projectRoot, piDir });
    const summary = await engine.generateSummary();
    assert.ok(summary);
    assert.ok(typeof summary === 'string');
    assert.ok(summary.includes('# Project Summary'));
  });
});
