// Core types for the PI project context system

export interface RuntimeContext {
  identity: IdentityContext;
  architecture: ArchitectureContext;
  state: StateContext;
  memory: MemoryContext;
  graph: GraphContext;
  recentEvents: EventRecord[];
}

export interface IdentityContext {
  vision: string;
  goals: string[];
  constraints: string[];
}

export interface ArchitectureContext {
  overview: string;
  decisions: Decision[];
  patterns: Pattern[];
  interfaces: Interface[];
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  alternatives: string[];
  status: 'active' | 'superseded' | 'deprecated';
  created_at: string;
  updated_at: string;
}

export interface Pattern {
  id: string;
  name: string;
  intent: string;
  implementation: string;
  usage: string[];
}

export interface Interface {
  id: string;
  module: string;
  purpose: string;
  methods: string[];
  signature: string;
}

export interface StateContext {
  currentFocus: CurrentFocus;
  activeTasks: Task[];
  openQuestions: Question[];
  roadmap: Roadmap;
}

export interface CurrentFocus {
  focus: string;
  focusSince: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Question {
  id: string;
  question: string;
  context: string;
  answer?: string;
  status: 'open' | 'answered' | 'deferred';
  created_at: string;
  answered_at?: string;
}

export interface Roadmap {
  milestones: Milestone[];
  currentPhase: string;
  lastUpdated: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  target_date?: string;
  status: 'pending' | 'in_progress' | 'completed';
  tasks: string[];
}

export interface MemoryContext {
  semantic: SemanticMemory;
  episodic: EpisodicMemory;
  procedural: ProceduralMemory;
}

export interface SemanticMemory {
  concepts: Concept[];
  entities: Entity[];
  relations: Relation[];
}

export interface Concept {
  id: string;
  name: string;
  definition: string;
  aliases: string[];
  related_concepts: string[];
  confidence: number;
}

export interface Entity {
  id: string;
  name: string;
  type: 'class' | 'function' | 'module' | 'interface' | 'variable' | 'file';
  location: string;
  description: string;
  properties: string[];
  confidence: number;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: 'depends_on' | 'implements' | 'extends' | 'uses' | 'imports';
  strength: number;
}

export interface EpisodicMemory {
  events: EventRecord[];
  sessionCount: number;
  lastSession: string | null;
}

export interface EventRecord {
  id: string;
  type: 'decision' | 'task' | 'error' | 'discovery' | 'change' | 'question';
  timestamp: string;
  summary: string;
  details: Record<string, unknown>;
  session_id: string;
}

export interface ProceduralMemory {
  workflows: Workflow[];
  codingRules: CodingRule[];
}

export interface Workflow {
  id: string;
  name: string;
  trigger: string;
  steps: string[];
  exitCriteria: string[];
}

export interface CodingRule {
  id: string;
  category: 'files' | 'naming' | 'style' | 'testing' | 'docs';
  rule: string;
  description: string;
  examples?: string[];
}

export interface GraphContext {
  symbolGraph: SymbolGraph;
  dependencyGraph: DependencyGraph;
  fileGraph: FileGraph;
}

export interface SymbolGraph {
  nodes: Map<string, SymbolNode>;
  lastUpdated: string;
}

export interface SymbolNode {
  name: string;
  type: 'class' | 'function' | 'interface' | 'variable' | 'type';
  file: string;
  line: number;
  depends_on: string[];
  defined_in: string;
}

export interface DependencyGraph {
  packages: Map<string, PackageNode>;
  lastUpdated: string;
}

export interface PackageNode {
  name: string;
  version: string;
  dependencies: string[];
  dependents: string[];
}

export interface FileGraph {
  edges: Map<string, string[]>;
  lastUpdated: string;
}

export interface WorldModel {
  beliefs: Belief[];
  assumptions: Assumption[];
  confidence: ConfidenceMap;
  lastUpdated: string;
}

export interface Belief {
  id: string;
  statement: string;
  source: 'direct' | 'inference' | 'hearsay';
  confidence: number;
  created_at: string;
}

export interface Assumption {
  id: string;
  statement: string;
  verified: boolean;
  verified_at?: string;
  created_at: string;
}

export interface ConfidenceMap {
  [key: string]: number;
}

// CLI command types
export interface CLIContext {
  projectRoot: string;
  piDir: string;
  verbose: boolean;
  format: 'json' | 'markdown' | 'text';
}

// Event types for extraction
export interface ExtractionInput {
  sessionId: string;
  timestamp: string;
  decisions: string[];
  entities: { name: string; type: string; location: string }[];
  tasks: { title: string; status: string }[];
  assumptions: string[];
  errors: string[];
  events: { type: string; summary: string }[];
}

// Graph engine types
export interface GraphUpdate {
  type: 'incremental' | 'full';
  scope: 'file' | 'symbol' | 'dependency' | 'all';
  changedFiles?: string[];
  timestamp: string;
}