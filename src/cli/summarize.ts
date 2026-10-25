import { MemoryEngine } from '../core/memory-engine/index.js';
import { ContextEngine } from '../core/context-engine/index.js';
import * as path from 'path';
import * as fs from 'fs';

export interface SummarizeOptions {
  projectRoot: string;
  sessionId?: string;
  format?: 'json' | 'markdown';
}

export class SummarizeCommand {
  private memoryEngine: MemoryEngine;
  private contextEngine: ContextEngine;

  constructor(projectRoot: string) {
    const piDir = path.join(projectRoot, '.pi');
    this.memoryEngine = new MemoryEngine({ projectRoot, piDir });
    this.contextEngine = new ContextEngine({ projectRoot, piDir });
  }

  async run(options: SummarizeOptions): Promise<string> {
    const sessionId = options.sessionId || `session-${Date.now().toString(36)}`;

    // Get recent events from this session
    const events = await this.getRecentEvents();

    // Extract key information
    const decisions = this.extractDecisions(events);
    const tasks = this.extractTasks(events);
    const entities = this.extractEntities(events);

    // Update memory
    await this.memoryEngine.extractAndDistill({
      sessionId,
      timestamp: new Date().toISOString(),
      decisions,
      entities,
      tasks,
      assumptions: [],
      errors: [],
      events: events.map(e => ({ type: e.type, summary: e.summary })),
    });

    // Generate and update summary
    const summary = await this.memoryEngine.generateSummary();
    await this.updateSummaries(summary);

    if (options.format === 'json') {
      return JSON.stringify({
        sessionId,
        decisionsExtracted: decisions.length,
        tasksUpdated: tasks.length,
        entitiesExtracted: entities.length,
        summary,
      }, null, 2);
    }

    return this.formatSummary(summary);
  }

  private async getRecentEvents() {
    const eventsPath = path.join(this.projectRoot, '.pi', 'memory', 'episodic', 'events.jsonl');
    if (!fs.existsSync(eventsPath)) return [];
    
    const content = fs.readFileSync(eventsPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  private extractDecisions(events: { type: string; summary: string }[]): string[] {
    return events
      .filter(e => e.type === 'decision')
      .map(e => e.summary);
  }

  private extractTasks(events: { type: string; summary: string }[]): { title: string; status: string }[] {
    return events
      .filter(e => e.type === 'task')
      .map(e => ({ title: e.summary, status: 'completed' }));
  }

  private extractEntities(events: { type: string; summary: string }[]): { name: string; type: string; location: string }[] {
    return events
      .filter(e => e.type === 'discovery')
      .map(e => ({ name: e.summary, type: 'discovered', location: 'unknown' }));
  }

  private async updateSummaries(summary: string): Promise<void> {
    const summaryPath = path.join(this.projectRoot, '.pi', 'summaries', 'project_summary.md');
    const updated = `# Project Summary

${summary}

## Last Updated
${new Date().toISOString()}
`;
    fs.writeFileSync(summaryPath, updated);
  }

  private formatSummary(summary: string): string {
    return `# Summarization Complete

Extracted and distilled recent activity into memory.

${summary}
`;
  }

  private get projectRoot(): string {
    return this.contextEngine['projectRoot'];
  }
}