# PI Project Context Extension

Auto-enabled project memory for PI coding agent.

## Installation

```bash
npx pi-project-context
```

## What It Does

1. **Auto-initializes** `.pi/` directory in any project
2. **Auto-syncs** graphs on file changes or git operations  
3. **Provides** `project-context` tool for querying/managing memory

## Tool: project-context

```typescript
// Read operations
project-context({ action: "get" })      // Full context as JSON
project-context({ action: "status" })   // Dashboard view
project-context({ action: "memory" })   // Beliefs, decisions, entities
project-context({ action: "sync" })     // Force sync

// Write operations
project-context({ action: "set-focus", focus: "Implement auth" })
project-context({ action: "add-task", title: "Add login form" })
project-context({ action: "add-decision", summary: "Use JWT", context: "..." })
project-context({ action: "add-event", type: "decision", summary: "..." })
```

## Automatic Behavior

- File watcher with 2s debounce
- Git hooks (post-commit, post-merge, post-checkout)
- No ports, no network - fully file-based

## Skill: pi-project-context

Auto-loaded on every project. Documents the `project-context` tool
and integration patterns.

## File Structure

```
.pi/
├── identity/          # vision, goals, constraints
├── architecture/      # decisions, patterns, interfaces
├── memory/           # semantic, episodic, procedural
├── state/            # focus, tasks, questions
├── graph/            # symbol, dependency, file graphs
└── summaries/        # auto-generated
```

## For PyCodingAgent

The extension auto-enables. Just use `project-context` in your agent loop:

```python
def get_project_context():
    # Use the tool directly - no subprocess needed
    pass  # Agent uses project-context tool

def sync_on_file_change():
    # Extension handles this automatically
    pass
```

## 👤 Author

- **sadhasri697** ([GitHub](https://github.com/SadhaSri697))

## License

MIT