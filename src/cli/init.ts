import * as fs from 'fs';
import * as path from 'path';

export interface InitOptions {
  projectRoot: string;
  force?: boolean;
}

interface DirectoryTemplate {
  [key: string]: string | DirectoryTemplate;
}

const TEMPLATE: DirectoryTemplate = {
  identity: {
    'vision.md': `# Project Identity

## Vision
<!-- What is this project trying to achieve? -->
`,
    'goals.md': `# Project Goals

## Primary Goals
-

## Secondary Goals
-
`,
    'constraints.md': `# Project Constraints

## Technical Constraints
-

## Non-Technical Constraints
-
`,
  },
  architecture: {
    'system_overview.md': `# System Overview

## Project Description
<!-- Brief description -->

## Key Components
-
`,
    'decisions.md': `# Architecture Decisions

## Decision Log

`,
    'patterns.md': `# Design Patterns

## Established Patterns

`,
    'interfaces.md': `# Interfaces

## Public APIs

`,
  },
  memory: {
    semantic: {
      'concepts.json': '[]',
      'entities.json': '[]',
      'relations.json': '[]',
    },
    episodic: {
      'events.jsonl': '',
    },
    procedural: {
      'workflows.md': `# Workflows

## Common Workflows

`,
      'coding_rules.md': `# Coding Rules

## Project-Specific Rules

`,
    },
  },
  state: {
    'current_focus.json': JSON.stringify({ focus: '', focus_since: null, priority: 'medium' }, null, 2),
    'active_tasks.json': JSON.stringify({ tasks: [], last_updated: null }, null, 2),
    'open_questions.json': JSON.stringify({ questions: [], last_updated: null }, null, 2),
    'roadmap.json': JSON.stringify({ milestones: [], current_phase: '', last_updated: null }, null, 2),
  },
  graph: {
    'symbol_graph.json': '{}',
    'dependency_graph.json': JSON.stringify({ packages: {} }, null, 2),
    'file_graph.json': '{}',
  },
  summaries: {
    'project_summary.md': `# Project Summary

## Overview
<!-- Auto-generated summary -->

## Last Updated
`,
    'architecture_summary.md': `# Architecture Summary

## Current State

## Recent Changes
`,
    'recent_state.md': `# Recent State

## Active Context

## Recent Activity
`,
  },
  world_model: {
    'beliefs.json': JSON.stringify({ beliefs: [], last_updated: null }, null, 2),
    'assumptions.json': JSON.stringify({ assumptions: [], last_updated: null }, null, 2),
    'confidence.json': JSON.stringify({ confidence: {}, last_updated: null }, null, 2),
  },
  cache: {},
};

export class InitCommand {
  private projectRoot: string;
  private piDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.piDir = path.join(projectRoot, '.pi');
  }

  async run(options: InitOptions): Promise<{ created: string[]; skipped: string[] }> {
    const created: string[] = [];
    const skipped: string[] = [];

    // Ensure .pi directory exists
    if (!fs.existsSync(this.piDir)) {
      fs.mkdirSync(this.piDir, { recursive: true });
    }

    // Merge template with existing structure
    await this.createFromTemplate(TEMPLATE, this.piDir, created, skipped);

    return { created, skipped };
  }

  private async createFromTemplate(
    template: DirectoryTemplate,
    targetDir: string,
    created: string[],
    skipped: string[]
  ): Promise<void> {
    for (const [name, content] of Object.entries(template)) {
      const targetPath = path.join(targetDir, name);

      if (typeof content === 'string') {
        // It's a file
        if (fs.existsSync(targetPath)) {
          skipped.push(targetPath);
        } else {
          // Ensure parent directory exists
          const parentDir = path.dirname(targetPath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, content);
          created.push(targetPath);
        }
      } else {
        // It's a directory
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
          created.push(targetPath + '/');
        }

        // Recurse into subdirectory
        await this.createFromTemplate(content, targetPath, created, skipped);
      }
    }
  }

  /**
   * Check if project is already initialized
   */
  isInitialized(): boolean {
    return fs.existsSync(path.join(this.piDir, 'identity', 'vision.md')) &&
           fs.existsSync(path.join(this.piDir, 'state', 'active_tasks.json'));
  }

  /**
   * Get the .pi directory path
   */
  getPiDir(): string {
    return this.piDir;
  }
}