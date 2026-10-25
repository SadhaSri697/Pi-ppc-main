---
name: pi-project-context
description: |
  Project context management for PI coding agent. Provides persistent memory about
  the project including identity, architecture, state, memory, and graphs.
  
  Auto-enabled on every project. Syncs on file changes and git operations.
  No configuration needed - just use the project-context tool.
---

# PI Project Context Skill

This skill is auto-loaded for every project. It provides the `project-context` tool
which manages persistent project memory.

## When to Use

- **At session start**: Query project context to understand current focus
- **During work**: Update focus, add tasks, record decisions
- **At session end**: Sync results and summarize

## Tool: project-context

The main tool for interacting with project memory.

### Read Operations

```
project-context({ action: "get" })
  → Returns full project context as JSON
  → Includes: identity, architecture, memory, state, graph

project-context({ action: "status" })
  → Shows current focus, active tasks, open questions
  → Visual dashboard format

project-context({ action: "memory" })
  → Displays beliefs, decisions, entities, events
  → Useful for understanding project knowledge

project-context({ action: "sync" })
  → Forces immediate sync of symbol/dependency/file graphs
  → Returns sync statistics
```

### Write Operations

```
project-context({ action: "set-focus", focus: "Implement auth", priority: "high" })
  → Updates .pi/state/current_focus.json
  → Sets current task priority

project-context({ action: "add-task", title: "Add login form", priority: "medium" })
  → Adds task to .pi/state/active_tasks.json

project-context({ action: "add-decision", summary: "Use JWT", context: "Auth requirement" })
  → Appends to .pi/architecture/decisions.md

project-context({ action: "add-event", type: "decision", summary: "Chose JWT over sessions" })
  → Logs event to .pi/memory/episodic/events.jsonl
```

## Automatic Behavior

The extension auto-syncs when:
- Files change (2s debounce)
- Git operations occur (commit, merge, checkout)

This keeps graphs up-to-date without manual intervention.

## Example Usage in Agent Prompt

```
At session start, run: project-context({ action: "status" })
Review current focus and active tasks before starting work.

When making architectural decisions, record with:
  project-context({ action: "add-decision", summary: "...", context: "..." })

When completing significant work, sync with:
  project-context({ action: "sync" })

When discovering important information, log with:
  project-context({ action: "add-event", type: "discovery", summary: "..." })
```

## File Structure

Project memory lives in `.pi/`:
```
.pi/
├── identity/           # vision.md, goals.md, constraints.md
├── architecture/       # decisions.md, patterns.md, interfaces.md
├── memory/
│   ├── semantic/       # entities.json, concepts.json, relations.json
│   ├── episodic/       # events.jsonl (event stream)
│   └── procedural/     # coding_rules.md, workflows.md
├── state/             # current_focus.json, active_tasks.json
├── graph/             # symbol_graph.json, dependency_graph.json
└── summaries/        # auto-generated summaries
```

## Workflow Integration

1. **New session**: `project-context({ action: "status" })` → understand current state
2. **During work**: Use write operations to track decisions and tasks
3. **End of session**: `project-context({ action: "sync" })` to update graphs

The extension handles file watching and git hooks automatically.