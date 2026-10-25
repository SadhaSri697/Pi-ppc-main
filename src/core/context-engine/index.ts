import * as fs from 'fs';
import * as path from 'path';
import {
  RuntimeContext,
  IdentityContext,
  ArchitectureContext,
  StateContext,
  MemoryContext,
  GraphContext,
  EventRecord,
  SemanticMemory,
  ProceduralMemory,
  Concept,
  Entity,
  Relation,
  Decision,
  Pattern,
  Interface,
  Task,
  Question,
  CurrentFocus,
  Roadmap,
  SymbolNode,
} from '../types.js';

export interface ContextEngineConfig {
  projectRoot: string;
  piDir: string;
}

export class ContextEngine {
  private projectRoot: string;
  private piDir: string;

  constructor(config: ContextEngineConfig) {
    this.projectRoot = config.projectRoot;
    this.piDir = config.piDir;
  }

  /**
   * Build runtime context for new sessions
   * Loads in priority order: identity → architecture → state → recent episodic → semantic → graph → recent changes
   */
  async buildRuntimeContext(): Promise<RuntimeContext> {
    const [identity, architecture, state, memory, graph, recentEvents] = await Promise.all([
      this.loadIdentity(),
      this.loadArchitecture(),
      this.loadState(),
      this.loadMemory(),
      this.loadGraph(),
      this.loadRecentEvents(),
    ]);

    return {
      identity,
      architecture,
      state,
      memory,
      graph,
      recentEvents,
    };
  }

  /**
   * Load identity context
   */
  private async loadIdentity(): Promise<IdentityContext> {
    const visionPath = path.join(this.piDir, 'identity', 'vision.md');
    const goalsPath = path.join(this.piDir, 'identity', 'goals.md');
    const constraintsPath = path.join(this.piDir, 'identity', 'constraints.md');

    const [vision, goals, constraints] = await Promise.all([
      this.readMarkdown(visionPath),
      this.readMarkdown(goalsPath),
      this.readMarkdown(constraintsPath),
    ]);

    return {
      vision: this.extractContent(vision),
      goals: this.extractListItems(goals),
      constraints: this.extractListItems(constraints),
    };
  }

  /**
   * Load architecture context
   */
  private async loadArchitecture(): Promise<ArchitectureContext> {
    const [overview, decisions, patterns, interfaces] = await Promise.all([
      this.readMarkdown(path.join(this.piDir, 'architecture', 'system_overview.md')),
      this.readMarkdown(path.join(this.piDir, 'architecture', 'decisions.md')),
      this.readMarkdown(path.join(this.piDir, 'architecture', 'patterns.md')),
      this.readMarkdown(path.join(this.piDir, 'architecture', 'interfaces.md')),
    ]);

    return {
      overview: this.extractContent(overview),
      decisions: this.parseDecisions(decisions),
      patterns: this.parsePatterns(patterns),
      interfaces: this.parseInterfaces(interfaces),
    };
  }

  /**
   * Load state context
   */
  private async loadState(): Promise<StateContext> {
    const [focus, tasks, questions, roadmap] = await Promise.all([
      this.readJson<{ focus: string; focus_since: string | null; priority: string }>(
        path.join(this.piDir, 'state', 'current_focus.json')
      ),
      this.readJson<{ tasks: Task[]; last_updated: string }>(
        path.join(this.piDir, 'state', 'active_tasks.json')
      ),
      this.readJson<{ questions: Question[]; last_updated: string }>(
        path.join(this.piDir, 'state', 'open_questions.json')
      ),
      this.readJson<{ milestones: Roadmap['milestones']; current_phase: string; last_updated: string }>(
        path.join(this.piDir, 'state', 'roadmap.json')
      ),
    ]);

    return {
      currentFocus: {
        focus: focus?.focus ?? '',
        focusSince: focus?.focus_since ?? null,
        priority: (focus?.priority as CurrentFocus['priority']) ?? 'medium',
      },
      activeTasks: tasks?.tasks ?? [],
      openQuestions: questions?.questions ?? [],
      roadmap: {
        milestones: roadmap?.milestones ?? [],
        currentPhase: roadmap?.current_phase ?? '',
        lastUpdated: roadmap?.last_updated ?? new Date().toISOString(),
      },
    };
  }

  /**
   * Load memory context
   */
  private async loadMemory(): Promise<MemoryContext> {
    const [semantic, episodic, procedural] = await Promise.all([
      this.loadSemanticMemory(),
      this.loadEpisodicMemory(),
      this.loadProceduralMemory(),
    ]);

    return { semantic, episodic, procedural };
  }

  private async loadSemanticMemory(): Promise<SemanticMemory> {
    const [concepts, entities, relations] = await Promise.all([
      this.readJson<Concept[]>(path.join(this.piDir, 'memory', 'semantic', 'concepts.json')),
      this.readJson<Entity[]>(path.join(this.piDir, 'memory', 'semantic', 'entities.json')),
      this.readJson<Relation[]>(path.join(this.piDir, 'memory', 'semantic', 'relations.json')),
    ]);

    return {
      concepts: concepts ?? [],
      entities: entities ?? [],
      relations: relations ?? [],
    };
  }

  private async loadEpisodicMemory(): Promise<{ events: EventRecord[]; sessionCount: number; lastSession: string | null }> {
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');
    const events = await this.readJsonl<EventRecord>(eventsPath);
    const sessionsDir = path.join(this.piDir, 'memory', 'episodic', 'sessions');
    
    let sessionCount = 0;
    let lastSession: string | null = null;
    
    if (fs.existsSync(sessionsDir)) {
      const sessions = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
      sessionCount = sessions.length;
      if (sessions.length > 0) {
        lastSession = sessions.sort().at(-1) ?? null;
      }
    }

    return {
      events: events ?? [],
      sessionCount,
      lastSession,
    };
  }

  private async loadProceduralMemory(): Promise<ProceduralMemory> {
    const [workflowsMd, codingRulesMd] = await Promise.all([
      this.readMarkdown(path.join(this.piDir, 'memory', 'procedural', 'workflows.md')),
      this.readMarkdown(path.join(this.piDir, 'memory', 'procedural', 'coding_rules.md')),
    ]);

    return {
      workflows: this.parseWorkflows(workflowsMd),
      codingRules: this.parseCodingRules(codingRulesMd),
    };
  }

  /**
   * Load graph context
   */
  private async loadGraph(): Promise<GraphContext> {
    const [symbolGraph, dependencyGraph, fileGraph] = await Promise.all([
      this.readJson<Record<string, SymbolNode>>(path.join(this.piDir, 'graph', 'symbol_graph.json')),
      this.readJson<{ packages: Record<string, import('../types.js').PackageNode> }>(
        path.join(this.piDir, 'graph', 'dependency_graph.json')
      ),
      this.readJson<Record<string, string[]>>(path.join(this.piDir, 'graph', 'file_graph.json')),
    ]);

    return {
      symbolGraph: {
        nodes: new Map(Object.entries(symbolGraph ?? {})),
        lastUpdated: new Date().toISOString(),
      },
      dependencyGraph: {
        packages: new Map(Object.entries(dependencyGraph?.packages ?? {})),
        lastUpdated: new Date().toISOString(),
      },
      fileGraph: {
        edges: new Map(Object.entries(fileGraph ?? {})),
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  /**
   * Load recent events from episodic memory
   */
  private async loadRecentEvents(count = 20): Promise<EventRecord[]> {
    const eventsPath = path.join(this.piDir, 'memory', 'episodic', 'events.jsonl');
    const allEvents = await this.readJsonl<EventRecord>(eventsPath);
    return (allEvents ?? []).slice(-count);
  }

  /**
   * Helper: Read markdown file
   */
  private async readMarkdown(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Helper: Read JSON file
   */
  private async readJson<T>(filePath: string): Promise<T | null> {
    if (!fs.existsSync(filePath)) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Read JSONL file (one JSON object per line)
   */
  private async readJsonl<T>(filePath: string): Promise<T[]> {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    return lines.map(line => {
      try {
        return JSON.parse(line) as T;
      } catch {
        return null;
      }
    }).filter((item): item is T => item !== null);
  }

  /**
   * Helper: Extract content between markers
   */
  private extractContent(markdown: string): string {
    // Remove HTML comments and templates
    const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '');
    // Extract text after markers
    const content = withoutComments
      .split('\n')
      .filter(line => !line.startsWith('<!--') && line.trim())
      .join('\n')
      .trim();
    return content || '';
  }

  /**
   * Helper: Extract list items from markdown
   */
  private extractListItems(markdown: string): string[] {
    return markdown
      .split('\n')
      .filter(line => line.trim().startsWith('- ') || line.trim().startsWith('* '))
      .map(line => line.replace(/^[\s*-]+/, '').trim())
      .filter(item => item && !item.startsWith('<!--'));
  }

  /**
   * Parse decisions from markdown
   */
  private parseDecisions(markdown: string): Decision[] {
    const decisions: Decision[] = [];
    const blocks = markdown.split(/^---$/m).filter(b => b.trim());

    for (const block of blocks) {
      const lines = block.split('\n');
      const titleMatch = block.match(/\*\*Title:\*\*\s*(.+)/) || block.match(/\d+\.\s*(.+)/);
      const contextMatch = block.match(/\*\*Context:\*\*\s*([\s\S]+?)(?=\*\*|$)/);
      
      if (titleMatch) {
        decisions.push({
          id: this.generateId(titleMatch[1]),
          title: titleMatch[1].trim(),
          context: contextMatch?.[1]?.trim() ?? '',
          decision: '',
          consequences: '',
          alternatives: [],
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    return decisions;
  }

  /**
   * Parse patterns from markdown
   */
  private parsePatterns(markdown: string): Pattern[] {
    const patterns: Pattern[] = [];
    const blocks = markdown.split(/^---$/m).filter(b => b.trim());

    for (const block of blocks) {
      const nameMatch = block.match(/###\s+(.+)/);
      if (nameMatch) {
        patterns.push({
          id: this.generateId(nameMatch[1]),
          name: nameMatch[1].trim(),
          intent: '',
          implementation: '',
          usage: [],
        });
      }
    }

    return patterns;
  }

  /**
   * Parse interfaces from markdown
   */
  private parseInterfaces(markdown: string): Interface[] {
    const interfaces: Interface[] = [];
    const blocks = markdown.split(/^---$/m).filter(b => b.trim());

    for (const block of blocks) {
      const moduleMatch = block.match(/\*\*Module:\*\*\s*(.+)/);
      if (moduleMatch) {
        interfaces.push({
          id: this.generateId(moduleMatch[1]),
          module: moduleMatch[1].trim(),
          purpose: '',
          methods: [],
          signature: '',
        });
      }
    }

    return interfaces;
  }

  /**
   * Parse workflows from markdown
   */
  private parseWorkflows(markdown: string): ProceduralMemory['workflows'] {
    // Simplified parsing
    return [];
  }

  /**
   * Parse coding rules from markdown
   */
  private parseCodingRules(markdown: string): ProceduralMemory['codingRules'] {
    // Simplified parsing
    return [];
  }

  /**
   * Generate unique ID
   */
  private generateId(seed: string): string {
    const hash = seed.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return `${hash}-${Date.now().toString(36)}`;
  }

  /**
   * Retrieve relevant memories based on query
   */
  public retrieveRelevantMemories(query: string): Promise<{
    entities: Entity[];
    relations: Relation[];
    events: EventRecord[];
  }> {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(w => w.length > 2);

    return Promise.resolve([]).then(() => {
      const semantic = {
        entities: [] as Entity[],
        relations: [] as Relation[],
      };
      const events: EventRecord[] = [];

      // Simple keyword matching
      const relevantEntities = semantic.entities.filter((entity: Entity) => {
        const searchText = `${entity.name} ${entity.description} ${entity.type}`.toLowerCase();
        return keywords.some(kw => searchText.includes(kw));
      });

      const relevantRelations = semantic.relations.filter((relation: Relation) => {
        const searchText = `${relation.source} ${relation.target} ${relation.type}`.toLowerCase();
        return keywords.some(kw => searchText.includes(kw));
      });

      const relevantEvents = events.filter((event: EventRecord) => {
        const searchText = `${event.type} ${event.summary}`.toLowerCase();
        return keywords.some(kw => searchText.includes(kw));
      });

      return {
        entities: relevantEntities,
        relations: relevantRelations,
        events: relevantEvents,
      };
    });
  }
}