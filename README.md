# PI Project Context

> A persistent project brain for coding agents — local, file-based, zero network dependency.

![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## What is PI?

PI gives coding agents **persistent memory** about your project. Each project gets a `.pi/` directory that acts as its "brain" — no databases, no network, just local files.

**Core principle:** Chat history ≠ memory. Memory should be explicit, structured, file-based, inspectable, and version-controllable.

## Quick Start

### 1. Install

```bash
npm install pi-ppc
```

### 2. Initialize

```bash
pi init
```

### 3. Start Agent (Optional, for auto-sync)

```bash
pi agent start
```

Now your agent will:
- Auto-sync graphs when files change
- Sync after git commits/pulls/checkouts
- Keep state files updated

### 4. Use in Your Coding Agent

```bash
# Get full project context
pi context --json

# Check project status
pi status

# See what memory exists
pi memory
```

That's it. No ports, no network, no configuration.

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `pi init` | Initialize `.pi/` directory |
| `pi context` | Build runtime context for agent sessions |
| `pi status` | Show project dashboard |
| `pi sync` | Update symbol/dependency/file graphs |
| `pi memory` | Display beliefs, decisions, entities |
| `pi summarize` | Compress recent activity into memory |

### Agent Commands

| Command | Description |
|---------|-------------|
| `pi agent start` | Start background agent (auto-sync, file watch) |
| `pi agent stop` | Stop background agent |
| `pi agent status` | Check if agent is running |
| `pi agent list` | List all running agents |
| `pi agent sync` | Trigger immediate sync |

## Project Structure

```
.pi/                          # Your project's persistent brain
├── identity/                 # Project identity
│   ├── vision.md            # What are we building?
│   ├── goals.md             # What are we trying to achieve?
│   └── constraints.md       # What constraints exist?
│
├── architecture/             # How is it built?
│   ├── system_overview.md   # High-level architecture
│   ├── decisions.md         # Architecture Decision Records
│   ├── patterns.md          # Established design patterns
│   └── interfaces.md        # Public APIs
│
├── memory/                   # What do we know?
│   ├── semantic/            # Entities, concepts, relations
│   ├── episodic/            # Events (JSONL stream)
│   └── procedural/          # Workflows, coding rules
│
├── state/                    # What are we working on?
│   ├── current_focus.json   # Current task focus
│   ├── active_tasks.json    # Task list
│   ├── open_questions.json  # Unanswered questions
│   └── roadmap.json        # Milestones
│
├── graph/                    # What depends on what?
│   ├── symbol_graph.json     # Classes, functions, types
│   ├── dependency_graph.json # npm packages
│   └── file_graph.json       # Import relationships
│
├── summaries/               # Auto-generated summaries
├── world_model/            # Beliefs and assumptions
├── agent.*.state.json      # Agent runtime state
└── cache/                   # Cached data
```

## For AI Coding Agents

### PyCodingAgent Integration

Add PI commands to your agent's execution loop:

```python
# In your agent's context gathering phase
def get_project_context(project_root: str) -> dict:
    result = subprocess.run(
        ['node', 'path/to/node_modules/pi-ppc/dist/cli/index.js', 'context', '--json'],
        cwd=project_root,
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

# In your agent's session end phase
def sync_and_summarize(project_root: str):
    subprocess.run(
        ['node', 'path/to/node_modules/pi-ppc/dist/cli/index.js', 'sync'],
        cwd=project_root
    )
    subprocess.run(
        ['node', 'path/to/node_modules/pi-ppc/dist/cli/index.js', 'summarize'],
        cwd=project_root
    )
```

### Using with Claude Code

In your agent's system prompt:

```
When starting a session, run 'pi context' to get project state.
When completing tasks, run 'pi sync' to update graphs.
When ending sessions, run 'pi summarize' to distill knowledge.
```

### Using with Continue.dev

Add to your `~/.continue/config.py`:

```python
from continue.config import ContinueConfig

def modify_model_messages(messages):
    # Add PI context to system prompt
    import subprocess
    result = subprocess.run(
        ['pi', 'context'],
        capture_output=True,
        text=True
    )
    context = result.stdout
    
    for msg in messages:
        if msg.get('role') == 'system':
            msg['content'] += f"\n\n# Project Context\n{context}"
    return messages

config = ContinueConfig(
    modify_model_messages=modify_model_messages
)
```

## Agent Architecture

The `pi agent` runs in the background with **zero network dependency**:

```
┌─────────────────────────────────────────────────────────────┐
│                    PI Agent (Background)                     │
├─────────────────────────────────────────────────────────────┤
│  File Watcher ───────► Sync Engine ───────► .pi/graph/       │
│  (fs.watch)           (ripgrep/tree)      (JSON files)      │
├─────────────────────────────────────────────────────────────┤
│  Git Hooks ─────────► Sync Engine ───────► .pi/graph/       │
│  (post-commit)                                          │
├─────────────────────────────────────────────────────────────┤
│  State Timer ───────► .pi/agent.{name}.state.json          │
│  (every 30s)                                               │
└─────────────────────────────────────────────────────────────┘
```

### State Files

Each project maintains `.pi/agent.{project}.state.json`:

```json
{
  "pid": 1234,
  "startedAt": "2024-05-24T09:00:00Z",
  "lastSync": "2024-05-24T09:22:00Z",
  "projectRoot": "/path/to/project",
  "status": "running"
}
```

## File Formats

### JSON State Files

```json
{
  "focus": "Implement auth",
  "focus_since": "2024-05-20T10:00:00Z",
  "priority": "high"
}
```

### JSONL Event Stream

```jsonl
{"id":"e1","type":"decision","summary":"Use JWT for auth","ts":"..."}
{"id":"e2","type":"task","summary":"Created auth.ts","ts":"..."}
```

### Markdown Documents

Plain Markdown for decisions, patterns, workflows.

## Design Principles

1. **Local-first** — Everything in `.pi/`, no external services
2. **File-based** — Human-readable, git-friendly
3. **No databases** — Plain JSON/JSONL/Markdown
4. **No network** — No ports, no HTTP, no servers
5. **Model-agnostic** — Works with any LLM
6. **Deterministic** — Same input = same output
7. **Inspectable** — All state visible and editable

## API Reference

### `pi init`

```bash
pi init                    # Initialize .pi/
pi init --verbose          # Show what was created
```

### `pi context`

```bash
pi context                # Human-readable context
pi context --json         # Full context as JSON
pi context --relevant auth # Find relevant memories
```

### `pi status`

```bash
pi status                 # Visual dashboard
pi status --json          # JSON output
```

### `pi sync`

```bash
pi sync                   # Sync all graphs
pi sync --scope symbol    # Only symbol graph
pi sync --verbose         # Detailed output
```

### `pi memory`

```bash
pi memory                # All memory sections
pi memory --section beliefs
pi memory --section decisions
pi memory --section entities
pi memory --section events
pi memory --section assumptions
```

### `pi agent`

```bash
pi agent start           # Start background agent
pi agent stop            # Stop background agent
pi agent status          # Check if running
pi agent list            # List all running agents
pi agent sync            # Trigger immediate sync
pi agent restart         # Restart the agent
```

## Examples

### Set Project Focus

```bash
echo '{"focus": "Implement login", "focus_since": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "priority": "high"}' > .pi/state/current_focus.json
```

### Add a Task

```bash
cat >> .pi/state/active_tasks.json << 'EOF'
{
  "tasks": [{
    "id": "task-1",
    "title": "Add login form",
    "status": "in_progress",
    "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }]
}
EOF
```

### Record a Decision

```bash
cat >> .pi/architecture/decisions.md << 'EOF'
### 2024-05-24: Use bcrypt for password hashing
**Context:** Security requirement for password storage
**Decision:** Use bcrypt with cost factor 12
**Consequences:** Slower hashing, but secure
EOF
```

## Contributing

```bash
git clone https://github.com/SadhaSri697/pi-ppc-main.git
cd pi-ppc
npm install
npm run build
npm test
```

## 👤 Author

This project is created, maintained, and authored solely by:

- **sadhasri697**
  - GitHub: [@SadhaSri697](https://github.com/SadhaSri697)
  - Repository: [SadhaSri697/pi-ppc-main](https://github.com/SadhaSri697/pi-ppc-main)

## License

MIT