// VS Code Extension Integration
// This module provides integration with VS Code extensions

import { ContextEngine } from '../core/context-engine/index.js';
import * as path from 'path';

export interface VSCodeIntegrationConfig {
  projectRoot: string;
}

export class VSCodeIntegration {
  private engine: ContextEngine;

  constructor(config: VSCodeIntegrationConfig) {
    const piDir = path.join(config.projectRoot, '.pi');
    this.engine = new ContextEngine({ projectRoot: config.projectRoot, piDir });
  }

  /**
   * Get context for VS Code status bar
   */
  async getStatusBarInfo(): Promise<{
    focus: string;
    taskCount: number;
    questionCount: number;
  }> {
    const context = await this.engine.buildRuntimeContext();
    
    return {
      focus: context.state.currentFocus.focus || 'No active focus',
      taskCount: context.state.activeTasks.filter((t: { status: string }) => t.status === 'in_progress').length,
      questionCount: context.state.openQuestions.filter((q: { status: string }) => q.status === 'open').length,
    };
  }

  /**
   * Get symbol information for hover/IntelliSense
   */
  async getSymbolInfo(symbolName: string): Promise<{
    name: string;
    type: string;
    file: string;
    line: number;
  } | null> {
    const context = await this.engine.buildRuntimeContext();
    
    for (const [key, symbol] of context.graph.symbolGraph.nodes) {
      if (key.includes(symbolName) || symbol.name === symbolName) {
        return {
          name: symbol.name,
          type: symbol.type,
          file: symbol.file,
          line: symbol.line,
        };
      }
    }
    
    return null;
  }

  /**
   * Get file dependencies for import autocomplete
   */
  async getFileDependencies(filePath: string): Promise<string[]> {
    const graph = await this.engine.buildRuntimeContext();
    return graph.graph.fileGraph.edges.get(filePath) || [];
  }

  /**
   * Generate completion items for PI-aware suggestions
   */
  async getCompletions(prefix: string): Promise<{
    label: string;
    kind: 'function' | 'class' | 'file' | 'task';
    detail: string;
  }[]> {
    const completions: {
      label: string;
      kind: 'function' | 'class' | 'file' | 'task';
      detail: string;
    }[] = [];

    const context = await this.engine.buildRuntimeContext();

    // Add matching symbols
    for (const [, symbol] of context.graph.symbolGraph.nodes) {
      if (symbol.name.toLowerCase().startsWith(prefix.toLowerCase())) {
        completions.push({
          label: symbol.name,
          kind: symbol.type as 'function' | 'class',
          detail: `${symbol.type} in ${symbol.file}:${symbol.line}`,
        });
      }
    }

    // Add matching tasks
    for (const task of context.state.activeTasks) {
      if (task.title.toLowerCase().includes(prefix.toLowerCase())) {
        completions.push({
          label: task.title,
          kind: 'task',
          detail: `Task: ${task.status}`,
        });
      }
    }

    // Add files
    for (const [file] of context.graph.fileGraph.edges) {
      const fileName = path.basename(file);
      if (fileName.toLowerCase().startsWith(prefix.toLowerCase())) {
        completions.push({
          label: fileName,
          kind: 'file',
          detail: file,
        });
      }
    }

    return completions.slice(0, 20);
  }
}