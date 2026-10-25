import { GraphEngine } from '../core/graph-engine/index.js';
import { MemoryEngine } from '../core/memory-engine/index.js';
import * as path from 'path';

export interface SyncOptions {
  projectRoot: string;
  scope?: 'symbol' | 'dependency' | 'file' | 'all';
  changedFiles?: string[];
  verbose?: boolean;
}

interface SyncResult {
  symbolGraph: { updated: boolean; symbols: number };
  dependencyGraph: { updated: boolean; packages: number };
  fileGraph: { updated: boolean; files: number };
  summary: string;
  timestamp: string;
}

export class SyncCommand {
  private graphEngine: GraphEngine;
  private memoryEngine: MemoryEngine;
  private piDir: string;

  constructor(projectRoot: string) {
    this.piDir = path.join(projectRoot, '.pi');
    this.graphEngine = new GraphEngine({ projectRoot, piDir: this.piDir });
    this.memoryEngine = new MemoryEngine({ projectRoot, piDir: this.piDir });
  }

  async run(options: SyncOptions): Promise<string> {
    const results: SyncResult = {
      symbolGraph: { updated: false, symbols: 0 },
      dependencyGraph: { updated: false, packages: 0 },
      fileGraph: { updated: false, files: 0 },
      summary: '',
      timestamp: new Date().toISOString(),
    };

    const scope = options.scope || 'all';

    // Sync symbol graph
    if (scope === 'symbol' || scope === 'all') {
      if (options.verbose) console.log('Syncing symbol graph...');
      results.symbolGraph.symbols = await this.graphEngine.syncSymbolGraph(options.changedFiles);
      results.symbolGraph.updated = true;
    }

    // Sync dependency graph
    if (scope === 'dependency' || scope === 'all') {
      if (options.verbose) console.log('Syncing dependency graph...');
      results.dependencyGraph.packages = await this.graphEngine.syncDependencyGraph();
      results.dependencyGraph.updated = true;
    }

    // Sync file graph
    if (scope === 'file' || scope === 'all') {
      if (options.verbose) console.log('Syncing file graph...');
      results.fileGraph.files = await this.graphEngine.syncFileGraph(options.changedFiles);
      results.fileGraph.updated = true;
    }

    // Update summary
    results.summary = await this.memoryEngine.generateSummary();

    return this.formatResult(results, options.verbose);
  }

  private formatResult(result: SyncResult, verbose?: boolean): string {
    if (verbose) {
      const lines: string[] = [];
      lines.push('# Sync Results\n');
      lines.push(`Timestamp: ${result.timestamp}\n`);
      lines.push('\n## Graphs Updated\n');

      if (result.symbolGraph.updated) {
        lines.push(`- **Symbol Graph:** ${result.symbolGraph.symbols} symbols`);
      }
      if (result.dependencyGraph.updated) {
        lines.push(`- **Dependency Graph:** ${result.dependencyGraph.packages} packages`);
      }
      if (result.fileGraph.updated) {
        lines.push(`- **File Graph:** ${result.fileGraph.files} files with imports`);
      }

      lines.push('\n## Summary\n');
      lines.push(result.summary);

      return lines.join('\n');
    }

    // Compact output
    const parts: string[] = [];
    if (result.symbolGraph.updated) {
      parts.push(`symbols:${result.symbolGraph.symbols}`);
    }
    if (result.dependencyGraph.updated) {
      parts.push(`deps:${result.dependencyGraph.packages}`);
    }
    if (result.fileGraph.updated) {
      parts.push(`files:${result.fileGraph.files}`);
    }

    return `Synced [${parts.join(', ')}]`;
  }
}