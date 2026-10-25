import { ContextEngine } from '../core/context-engine/index.js';
import * as path from 'path';

export interface ContextOptions {
  projectRoot: string;
  format?: 'json' | 'markdown' | 'text';
  relevant?: string;
}

export class ContextCommand {
  private engine: ContextEngine;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    const piDir = path.join(projectRoot, '.pi');
    this.engine = new ContextEngine({ projectRoot, piDir });
  }

  async run(options: ContextOptions): Promise<string> {
    if (options.relevant) {
      // Retrieve relevant memories for a query
      const memories = await this.engine.retrieveRelevantMemories(options.relevant);
      
      if (options.format === 'json') {
        return JSON.stringify(memories, null, 2);
      }

      return this.formatMemories(memories);
    }

    // Build full runtime context
    const context = await this.engine.buildRuntimeContext();

    if (options.format === 'json') {
      return JSON.stringify(context, null, 2);
    }

    return this.formatContext(context);
  }

  private formatContext(context: Awaited<ReturnType<ContextEngine['buildRuntimeContext']>>): string {
    const parts: string[] = [];

    parts.push('# Project Context\n');
    
    // Identity
    if (context.identity.vision || context.identity.goals.length > 0) {
      parts.push('\n## Identity\n');
      if (context.identity.vision) {
        parts.push(`**Vision:** ${context.identity.vision}\n`);
      }
      if (context.identity.goals.length > 0) {
        parts.push('**Goals:**\n');
        context.identity.goals.forEach((g: string) => parts.push(`- ${g}\n`));
      }
      if (context.identity.constraints.length > 0) {
        parts.push('**Constraints:**\n');
        context.identity.constraints.forEach((c: string) => parts.push(`- ${c}\n`));
      }
    }

    // Architecture
    if (context.architecture.overview || context.architecture.decisions.length > 0) {
      parts.push('\n## Architecture\n');
      if (context.architecture.overview) {
        parts.push(`${context.architecture.overview}\n`);
      }
      if (context.architecture.decisions.length > 0) {
        parts.push('\n**Recent Decisions:**\n');
        context.architecture.decisions.slice(-3).forEach((d: { title: string; status: string }) => {
          parts.push(`- ${d.title} (${d.status})\n`);
        });
      }
    }

    // State
    if (context.state.currentFocus.focus || context.state.activeTasks.length > 0) {
      parts.push('\n## Current State\n');
      if (context.state.currentFocus.focus) {
        parts.push(`**Focus:** ${context.state.currentFocus.focus}\n`);
      }
      if (context.state.activeTasks.length > 0) {
        const inProgress = context.state.activeTasks.filter((t: { status: string }) => t.status === 'in_progress');
        if (inProgress.length > 0) {
          parts.push('**In Progress:**\n');
          inProgress.forEach((t: { title: string }) => parts.push(`- ${t.title}\n`));
        }
      }
    }

    // Open Questions
    if (context.state.openQuestions.length > 0) {
      parts.push('\n## Open Questions\n');
      context.state.openQuestions
        .filter((q: { status: string }) => q.status === 'open')
        .forEach((q: { question: string }) => parts.push(`- ${q.question}\n`));
    }

    // Memory stats
    parts.push('\n## Memory\n');
    parts.push(`- Entities: ${context.memory.semantic.entities.length}\n`);
    parts.push(`- Concepts: ${context.memory.semantic.concepts.length}\n`);
    parts.push(`- Events: ${context.memory.episodic.events.length}\n`);
    parts.push(`- Sessions: ${context.memory.episodic.sessionCount}\n`);

    // Recent events
    if (context.recentEvents.length > 0) {
      parts.push('\n## Recent Events\n');
      context.recentEvents.slice(-5).forEach((e: { type: string; summary: string }) => {
        parts.push(`- [${e.type}] ${e.summary}\n`);
      });
    }

    return parts.join('');
  }

  private formatMemories(memories: Awaited<ReturnType<ContextEngine['retrieveRelevantMemories']>>): string {
    const parts: string[] = [];

    parts.push('# Relevant Memories\n');

    if (memories.entities.length > 0) {
      parts.push('\n## Relevant Entities\n');
      memories.entities.forEach(e => {
        parts.push(`- **${e.name}** (${e.type}): ${e.description}\n`);
      });
    }

    if (memories.relations.length > 0) {
      parts.push('\n## Relevant Relations\n');
      memories.relations.forEach(r => {
        parts.push(`- ${r.source} --[${r.type}]--> ${r.target}\n`);
      });
    }

    if (memories.events.length > 0) {
      parts.push('\n## Related Events\n');
      memories.events.forEach(e => {
        parts.push(`- [${e.type}] ${e.summary}\n`);
      });
    }

    return parts.join('');
  }
}