import * as fs from 'fs';
import * as path from 'path';
import {
  ExtractionInput,
  EventRecord,
  Decision,
  Concept,
  Entity,
  Task,
  Question,
  Belief,
  Assumption,
} from '../types.js';

export interface MemoryEngineConfig {
  projectRoot: string;
  piDir: string;
  maxEvents?: number;
  maxDecisions?: number;
}

export class MemoryEngine {
  private projectRoot: string;
  private piDir: string;
  private maxEvents: number;
  private maxDecisions: number;

  constructor(config: MemoryEngineConfig) {
    this.projectRoot = config.projectRoot;
    this.piDir = config.piDir;
    this.maxEvents = config.maxEvents ?? 1000;
    this.maxDecisions = config.maxDecisions ?? 100;
  }

  /**
   * Extract and distill knowledge from a session
   * Updates memory files with distilled information only
   */
  async extractAndDistill(input: ExtractionInput): Promise<{
    decisionsAdded: number;
    entitiesAdded: number;
    tasksUpdated: number;
    eventsAdded: number;
  }> {
    const results = {
      decisionsAdded: 0,
      entitiesAdded: 0,
      tasksUpdated: 0,
      eventsAdded: 0,
    };

    // Extract decisions
    if (input.decisions.length > 0) {
      const added = await this.addDecisions(input);
      results.decisionsAdded = added;
    }

    // Extract entities
    if (input.entities.length > 0) {
      const added = await this.addEntities(input);
      results.entitiesAdded = added;
    }

    // Extract tasks
    if (input.tasks.length > 0) {
      const updated = await this.updateTasks(input);
      results.tasksUpdated = updated;
    }

    // Extract assumptions
    if (input.assumptions.length > 0) {
      await this.addAssumptions(input);
    }

    // Add event records
    if (input.events.length > 0) {
      const added = await this.addEvents(input);
      results.eventsAdded = added;
    }

    // Enforce retention limits
    await this.enforceRetentionLimits();

    return results;
  }

  /**
   * Add decisions to architecture/decisions.md
   */
  private async addDecisions(input: ExtractionInput): Promise<number> {
    const decisionsPath = path.join(this.piDir, 'architecture', 'decisions.md');
    const existingContent = fs.existsSync(decisionsPath) 
      ? fs.readFileSync(decisionsPath, 'utf-8') 
      : '';

    const decisions = input.decisions
      .map((d, i) => {
        const timestamp = new Date().toISOString();
        return `### ${i + 1}: ${this.sanitizeTitle(d)}
**Date:** ${timestamp.split('T')[0]}
**Context:** Session ${input.sessionId}
**Decision:** ${d}
**Consequences:** To be documented
**Alternatives considered:** None recorded
**Status:** Active

---`;
      })
      .join('\n');

    const newContent = existingContent + '\n' + decisions;
    fs.writeFileSync(decisionsPath, newContent);

    return input.decisions.length;
  }

  /**
   * Add entities to semantic memory
   */
  private async addEntities(input: ExtractionInput): Promise<number> {
    const entitiesPath = path.join(this.piDir, 'memory', 'semantic', 'entities.json');
    const existing = this.readJsonFile<Entity[]>(entitiesPath) ?? [];

    const newEntities = input.entities
      .filter(e => !existing.some(ex => ex.name === e.name && ex.location === e.location))
      .map(e => ({
        id: this.generateId(e.name),
        name: e.name,
        type: e.type as Entity['type'],
        location: e.location,
        description: `Discovered during session ${input.sessionId}`,
        properties: [],
        confidence: 0.7,
      }));

    const updated = [...existing, ...newEntities];
    fs.writeFileSync(entitiesPath, JSON.stringify(updated, null, 2));

    return newEntities.length;
  }

  /**
   * Update tasks in state
   */
  private async updateTasks(input: ExtractionInput): Promise<number> {
    const tasksPath = path.join(this.piDir, 'state', 'active_tasks.json');
    const existing = this.readJsonFile<{ tasks: Task[]; last_updated: string }>(tasksPath) ?? {
      tasks: [],
      last_updated: new Date().toISOString(),
    };

    let updatedCount = 0;

    for (const task of input.tasks) {
      const existingTask = existing.tasks.find(t => t.title === task.title);
      
      if (existingTask) {
        existingTask.status = task.status as Task['status'];
        existingTask.updated_at = input.timestamp;
        if (task.status === 'completed') {
          existingTask.completed_at = input.timestamp;
        }
        updatedCount++;
      } else {
        existing.tasks.push({
          id: this.generateId(task.title),
          title: task.title,
          description: '',
          status: task.status as Task['status'],
          priority: 'medium',
          created_at: input.timestamp,
          updated_at: input.timestamp,
          completed_at: task.status === 'completed' ? input.timestamp : undefined,
        });
        updatedCount++;
      }
    }

    existing.last_updated = input.timestamp;
    fs.writeFileSync(tasksPath, JSON.stringify(existing, null, 2));

    return updatedCount;
  }

  /**
   * Add assumptions to world model
   */
  private async addAssumptions(input: ExtractionInput): Promise<void> {
    const assumptionsPath = path.join(this.piDir, 'world_model', 'assumptions.json');
    const existing = this.readJsonFile<{ assumptions: Assumption[]; last_updated: string }>(assumptionsPath) ?? {
      assumptions: [],
      last_updated: new Date().toISOString(),
    };

    const newAssumptions = input.assumptions
      .filter(a => !existing.assumptions.some(ex => ex.statement === a))
      .map(a => ({
        id: this.generateId(a),
        statement: a,
        verified: false,
        created_at: input.timestamp,
      }));

    existing.assumptions.push(...newAssumptions);
    existing.last_updated = input.timestamp;
    fs.writeFileSync(assumptionsPath, JSON.stringify(existing, null, 2));
  }

  /**
   * Add events to episodic memory (JSONL format)
   */
  private async addEvents(input: ExtractionInput): Promise<number> {
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');

    const eventRecords = input.events.map((e, i) => ({
      id: `${input.sessionId}-${i}-${Date.now().toString(36)}`,
      type: e.type as EventRecord['type'],
      timestamp: input.timestamp,
      summary: e.summary,
      details: {},
      session_id: input.sessionId,
    }));

    const lines = eventRecords.map(e => JSON.stringify(e)).join('\n') + '\n';
    fs.appendFileSync(eventsPath, lines);

    return eventRecords.length;
  }

  /**
   * Enforce retention limits to prevent unbounded growth
   */
  private async enforceRetentionLimits(): Promise<void> {
    // Trim events to max
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');
    if (fs.existsSync(eventsPath)) {
      const events = this.readJsonlFile<EventRecord>(eventsPath);
      if (events.length > this.maxEvents) {
        const trimmed = events.slice(-this.maxEvents);
        fs.writeFileSync(eventsPath, trimmed.map(e => JSON.stringify(e)).join('\n') + '\n');
      }
    }

    // Trim old decisions
    const decisionsPath = path.join(this.piDir, 'architecture', 'decisions.md');
    if (fs.existsSync(decisionsPath)) {
      const content = fs.readFileSync(decisionsPath, 'utf-8');
      const blocks = content.split(/^---$/m);
      if (blocks.length > this.maxDecisions) {
        const keep = blocks.slice(-this.maxDecisions);
        fs.writeFileSync(decisionsPath, keep.join('\n---\n'));
      }
    }
  }

  /**
   * Read a JSON file safely
   */
  private readJsonFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  }

  /**
   * Read a JSONL file
   */
  private readJsonlFile<T>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line) as T;
        } catch {
          return null;
        }
      })
      .filter((item): item is T => item !== null);
  }

  /**
   * Generate unique ID
   */
  private generateId(seed: string): string {
    const hash = seed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${hash}-${Date.now().toString(36)}`;
  }

  /**
   * Sanitize title for markdown
   */
  private sanitizeTitle(title: string): string {
    return title
      .replace(/\n/g, ' ')
      .replace(/\*\*/g, '')
      .substring(0, 100);
  }

  /**
   * Update beliefs based on discoveries
   */
  async updateBeliefs(beliefs: { statement: string; confidence: number }[]): Promise<void> {
    const beliefsPath = path.join(this.piDir, 'world_model', 'beliefs.json');
    const existing = this.readJsonFile<{ beliefs: Belief[]; last_updated: string }>(beliefsPath) ?? {
      beliefs: [],
      last_updated: new Date().toISOString(),
    };

    for (const belief of beliefs) {
      const existingBelief = existing.beliefs.find(b => b.statement === belief.statement);
      if (existingBelief) {
        // Update confidence using exponential moving average
        existingBelief.confidence = 
          existingBelief.confidence * 0.7 + belief.confidence * 0.3;
      } else {
        existing.beliefs.push({
          id: this.generateId(belief.statement),
          statement: belief.statement,
          source: 'inference',
          confidence: belief.confidence,
          created_at: new Date().toISOString(),
        });
      }
    }

    existing.last_updated = new Date().toISOString();
    fs.writeFileSync(beliefsPath, JSON.stringify(existing, null, 2));
  }

  /**
   * Get session history
   */
  async getSessionHistory(count = 10): Promise<EventRecord[]> {
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');
    const events = this.readJsonlFile<EventRecord>(eventsPath);
    return events.slice(-count);
  }

  /**
   * Generate project summary from memory
   */
  async generateSummary(): Promise<string> {
    const summaryParts: string[] = [];

    // Collect key info
    const decisionsPath = path.join(this.piDir, 'architecture', 'decisions.md');
    const tasksPath = path.join(this.piDir, 'state', 'active_tasks.json');
    const questionsPath = path.join(this.piDir, 'state', 'open_questions.json');
    const beliefsPath = path.join(this.piDir, 'world_model', 'beliefs.json');

    summaryParts.push(`# Project Summary\n\nLast updated: ${new Date().toISOString()}\n`);

    // Active tasks
    const tasks = this.readJsonFile<{ tasks: Task[] }>(tasksPath);
    if (tasks?.tasks) {
      const active = tasks.tasks.filter(t => t.status === 'in_progress');
      const pending = tasks.tasks.filter(t => t.status === 'pending');
      summaryParts.push(`## Tasks\n- In Progress: ${active.length}\n- Pending: ${pending.length}`);
    }

    // Open questions
    const questions = this.readJsonFile<{ questions: Question[] }>(questionsPath);
    if (questions?.questions) {
      const open = questions.questions.filter(q => q.status === 'open');
      summaryParts.push(`\n## Questions\n- Open: ${open.length}`);
    }

    // Key beliefs
    const beliefs = this.readJsonFile<{ beliefs: Belief[] }>(beliefsPath);
    if (beliefs?.beliefs) {
      const highConfidence = beliefs.beliefs.filter(b => b.confidence > 0.8);
      if (highConfidence.length > 0) {
        summaryParts.push(`\n## Key Beliefs\n${highConfidence.map(b => `- ${b.statement}`).join('\n')}`);
      }
    }

    return summaryParts.join('\n');
  }
}