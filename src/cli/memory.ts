import * as fs from 'fs';
import * as path from 'path';

export interface MemoryOptions {
  projectRoot: string;
  section?: 'beliefs' | 'decisions' | 'entities' | 'events' | 'assumptions';
  format?: 'json' | 'markdown';
}

interface BeliefsData { beliefs?: Array<{ statement: string; confidence: number; source: string }> }
interface EntitiesData extends Array<{ name: string; type: string; location: string; description: string }> {}
interface AssumptionsData { assumptions?: Array<{ statement: string; verified: boolean; created_at: string }> }
interface EventData { type: string; timestamp: string; summary: string }

export class MemoryCommand {
  private projectRoot: string;
  private piDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.piDir = path.join(projectRoot, '.pi');
  }

  async run(options: MemoryOptions): Promise<string> {
    const section = options.section;

    if (section) {
      return this.displaySection(section, options.format);
    }

    // Display all memory
    return this.displayAllMemory(options.format);
  }

  private displaySection(section: MemoryOptions['section'], format?: string): string {
    if (!section) return '';

    switch (section) {
      case 'beliefs':
        return this.displayBeliefs(format);
      case 'decisions':
        return this.displayDecisions(format);
      case 'entities':
        return this.displayEntities(format);
      case 'events':
        return this.displayEvents(format);
      case 'assumptions':
        return this.displayAssumptions(format);
      default:
        return '';
    }
  }

  private displayBeliefs(format?: string): string {
    const beliefsPath = path.join(this.piDir, 'world_model', 'beliefs.json');
    const data = this.readJson<BeliefsData>(beliefsPath);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    const beliefs = data?.beliefs || [];
    let output = '# Beliefs\n\n';
    
    if (beliefs.length === 0) {
      return output + 'No beliefs recorded.\n';
    }

    beliefs.forEach((b: { statement: string; confidence: number; source: string }) => {
      const bar = '█'.repeat(Math.round(b.confidence * 10)) + '░'.repeat(10 - Math.round(b.confidence * 10));
      output += `- ${b.statement}\n  Confidence: [${bar}] ${(b.confidence * 100).toFixed(0)}%\n  Source: ${b.source}\n\n`;
    });

    return output;
  }

  private displayDecisions(format?: string): string {
    const decisionsPath = path.join(this.piDir, 'architecture', 'decisions.md');
    
    if (!fs.existsSync(decisionsPath)) {
      return '# Architecture Decisions\n\nNo decisions recorded.\n';
    }

    if (format === 'json') {
      const content = fs.readFileSync(decisionsPath, 'utf-8');
      const decisions = this.parseDecisions(content);
      return JSON.stringify(decisions, null, 2);
    }

    return fs.readFileSync(decisionsPath, 'utf-8');
  }

  private displayEntities(format?: string): string {
    const entitiesPath = path.join(this.piDir, 'memory', 'semantic', 'entities.json');
    const data = this.readJson<EntitiesData>(entitiesPath);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    const entities = data || [];
    let output = '# Entities\n\n';
    
    if (entities.length === 0) {
      return output + 'No entities recorded.\n';
    }

    // Group by type
    const byType: Record<string, EntitiesData> = {};
    entities.forEach((e: { name: string; type: string; location: string; description: string }) => {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type].push(e);
    });

    for (const [, items] of Object.entries(byType)) {
      output += `## ${(items[0] as { type: string }).type.charAt(0).toUpperCase() + (items[0] as { type: string }).type.slice(1)}s\n`;
      items.forEach((e: { name: string; location: string; description: string }) => {
        output += `- **${e.name}** (${e.location})\n  ${e.description}\n`;
      });
      output += '\n';
    }

    return output;
  }

  private displayEvents(format?: string): string {
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');
    
    if (!fs.existsSync(eventsPath)) {
      return '# Events\n\nNo events recorded.\n';
    }

    const events = this.readJsonl<EventData>(eventsPath);

    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    }

    let output = '# Recent Events\n\n';
    
    // Group by type
    const byType: Record<string, EventData[]> = {};
    events.forEach((e: EventData) => {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type].push(e);
    });

    for (const [type, items] of Object.entries(byType)) {
      output += `## ${type}s\n`;
      items.slice(-5).forEach((e: EventData) => {
        const date = new Date(e.timestamp).toLocaleDateString();
        output += `- [${date}] ${e.summary}\n`;
      });
      output += '\n';
    }

    return output;
  }

  private displayAssumptions(format?: string): string {
    const assumptionsPath = path.join(this.piDir, 'world_model', 'assumptions.json');
    const data = this.readJson<AssumptionsData>(assumptionsPath);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    const assumptions = data?.assumptions || [];
    let output = '# Assumptions\n\n';
    
    if (assumptions.length === 0) {
      return output + 'No assumptions recorded.\n';
    }

    assumptions.forEach((a: { statement: string; verified: boolean }) => {
      const status = a.verified ? '✓ Verified' : '○ Unverified';
      output += `- ${a.statement} ${status}\n`;
    });

    return output;
  }

  private displayAllMemory(format?: string): string {
    if (format === 'json') {
      return JSON.stringify({
        beliefs: this.readJson<BeliefsData>(path.join(this.piDir, 'world_model', 'beliefs.json')),
        entities: this.readJson<EntitiesData>(path.join(this.piDir, 'memory', 'semantic', 'entities.json')),
        decisions: fs.existsSync(path.join(this.piDir, 'architecture', 'decisions.md'))
          ? fs.readFileSync(path.join(this.piDir, 'architecture', 'decisions.md'), 'utf-8')
          : null,
        assumptions: this.readJson<AssumptionsData>(path.join(this.piDir, 'world_model', 'assumptions.json')),
      }, null, 2);
    }

    let output = '# Project Memory\n\n';

    output += this.displayBeliefs();
    output += '\n---\n';
    output += this.displayEntities();
    output += '\n---\n';
    output += this.displayAssumptions();

    return output;
  }

  private readJson<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    } catch {
      return null;
    }
  }

  private readJsonl<T>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter((l: string) => l.trim())
      .map((l: string) => {
        try {
          return JSON.parse(l) as T;
        } catch {
          return null;
        }
      })
      .filter((item): item is T => item !== null);
  }

  private parseDecisions(content: string): unknown[] {
    const decisions: unknown[] = [];
    const blocks = content.split(/^---$/m).filter(b => b.trim());

    for (const block of blocks) {
      const titleMatch = block.match(/\d+\.\s+(.+)/) || block.match(/\*\*Title:\*\*.+/);
      if (titleMatch) {
        const dateMatch = block.match(/\*\*Date:\*\*\s*(.+)/);
        decisions.push({
          title: titleMatch[1].trim(),
          date: dateMatch?.[1]?.trim() || '',
          content: block.trim(),
        });
      }
    }

    return decisions;
  }
}