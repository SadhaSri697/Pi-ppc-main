#!/usr/bin/env node

import * as path from 'path';
import { InitCommand } from './init.js';
import { ContextCommand } from './context.js';
import { SummarizeCommand } from './summarize.js';
import { MemoryCommand } from './memory.js';
import { StatusCommand } from './status.js';
import { SyncCommand } from './sync.js';

interface CLIOptions {
  command: string;
  projectRoot: string;
  verbose?: boolean;
  format?: 'json' | 'markdown' | 'text';
  section?: string;
  scope?: 'symbol' | 'dependency' | 'file' | 'all';
  relevant?: string;
  sessionId?: string;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const projectRoot = process.cwd();

  const options: CLIOptions = {
    command,
    projectRoot,
    verbose: args.includes('--verbose') || args.includes('-v'),
    format: args.includes('--json') ? 'json' : args.includes('--markdown') ? 'markdown' : 'text',
    section: getOption(args, '--section', '-s'),
    scope: getScopeOption(args),
    relevant: getOption(args, '--relevant', '-r'),
    sessionId: getOption(args, '--session'),
  };

  try {
    switch (command) {
      case 'init':
        await runInit(options);
        break;

      case 'context':
        await runContext(options);
        break;

      case 'summarize':
        await runSummarize(options);
        break;

      case 'memory':
        await runMemory(options);
        break;

      case 'status':
        await runStatus(options);
        break;

      case 'sync':
        await runSync(options);
        break;

      case 'agent':
        await runAgent(args.slice(1));
        return;

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function runInit(options: CLIOptions) {
  const init = new InitCommand(options.projectRoot);
  const result = await init.run({ projectRoot: options.projectRoot });
  
  console.log('Initialized PI project context\n');
  console.log(`Created: ${result.created.length} files/directories`);
  console.log(`Skipped: ${result.skipped.length} existing files`);
  
  if (options.verbose && result.skipped.length > 0) {
    console.log('\nSkipped files:');
    result.skipped.forEach(f => console.log(`  - ${path.relative(options.projectRoot, f)}`));
  }
}

async function runContext(options: CLIOptions) {
  const context = new ContextCommand(options.projectRoot);
  const result = await context.run({
    projectRoot: options.projectRoot,
    format: options.format,
    relevant: options.relevant,
  });
  
  console.log(result);
}

async function runSummarize(options: CLIOptions) {
  const summarize = new SummarizeCommand(options.projectRoot);
  const result = await summarize.run({
    projectRoot: options.projectRoot,
    format: options.format as 'json' | 'markdown' | undefined,
    sessionId: options.sessionId,
  });
  
  console.log(result);
}

async function runMemory(options: CLIOptions) {
  const memory = new MemoryCommand(options.projectRoot);
  const result = await memory.run({
    projectRoot: options.projectRoot,
    format: options.format as 'json' | 'markdown' | undefined,
    section: options.section as 'beliefs' | 'decisions' | 'entities' | 'events' | 'assumptions' | undefined,
  });
  
  console.log(result);
}

async function runStatus(options: CLIOptions) {
  const status = new StatusCommand(options.projectRoot);
  const result = await status.run({
    projectRoot: options.projectRoot,
    format: options.format,
  });
  
  console.log(result);
}

async function runSync(options: CLIOptions) {
  const sync = new SyncCommand(options.projectRoot);
  const result = await sync.run({
    projectRoot: options.projectRoot,
    scope: options.scope,
    verbose: options.verbose,
  });
  
  console.log(result);
}

async function runAgent(args: string[]) {
  const { PIExtension, listRunningAgents } = await import('../integrations/extension-system/agent.js');
  
  const action = args[0] || 'help';
  const extension = new PIExtension(process.cwd());

  switch (action) {
    case 'start':
      await extension.start();
      await new Promise(() => {});
      break;
    case 'stop':
      extension.stop();
      break;
    case 'restart':
      extension.stop();
      await new Promise(r => setTimeout(r, 500));
      await extension.start();
      break;
    case 'status': {
      const statusExt = new PIExtension(process.cwd());
      if (statusExt.isActive()) {
        console.log('  PI Agent running (' + statusExt.getProjectId() + ')');
      } else {
        console.log('  PI Agent not running');
      }
      break;
    }
    case 'list':
      listRunningAgents(process.cwd());
      break;
    case 'sync':
      await extension.sync();
      break;
    case 'help':
    default:
      if (action !== 'help') {
        console.log('Unknown command: ' + action);
      }
      console.log(`
PI Agent - Background Context Manager

Usage: pi agent <command>

Commands:
  start     Start the agent (runs in background)
  stop      Stop the agent
  restart   Restart the agent
  status    Check if agent is running
  list      List all running agents
  sync      Trigger immediate sync

No ports, no network - fully file-based.
State stored in .pi/agent.{project}.state.json

The agent:
  - Watches files and auto-syncs on changes
  - Installs git hooks for auto-sync on commits
  - Updates state file every 30 seconds
  - Manages itself via PID files
      `);
  }
}

function getOption(args: string[], longForm: string, shortForm?: string): string | undefined {
  const index = args.findIndex(a => a === longForm || (shortForm && a === shortForm));
  if (index === -1 || index + 1 >= args.length) return undefined;
  const next = args[index + 1];
  if (next.startsWith('-')) return undefined;
  return next;
}

function getScopeOption(args: string[]): 'symbol' | 'dependency' | 'file' | 'all' | undefined {
  const scopeValue = getOption(args, '--scope');
  if (scopeValue && ['symbol', 'dependency', 'file', 'all'].includes(scopeValue)) {
    return scopeValue as 'symbol' | 'dependency' | 'file' | 'all';
  }
  return undefined;
}

function showHelp() {
  console.log(`
PI Project Context - Persistent project memory for coding agents

USAGE
  pi <command> [options]

COMMANDS
  init         Initialize .pi directory with project structure
  context      Build runtime context for new sessions
  summarize    Compress and distill project state into memory
  memory       Display current beliefs, decisions, entities, events
  status       Show current focus, tasks, questions, progress
  sync         Update symbol, dependency, and file graphs
  agent        Start automatic background context management

GLOBAL OPTIONS
  --json       Output in JSON format
  --markdown   Output in Markdown format
  --verbose    Verbose output
  -h, --help   Show this help message

EXAMPLES
  pi init                           Initialize project
  pi context --json                 Get full context as JSON
  pi context --relevant auth       Find relevant memories about auth
  pi status                         Show project status
  pi sync --verbose                 Sync and update all graphs
  pi memory --section beliefs       Show beliefs
  pi agent start                    Start auto-watcher agent
  `);
}

main();