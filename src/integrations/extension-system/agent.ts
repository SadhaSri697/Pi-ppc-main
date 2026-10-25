#!/usr/bin/env node

/**
 * PI Extension System - Self-managing background process
 * 
 * No ports, no network - just files and signals
 * 
 * Architecture:
 * - PID file in .pi/ contains state
 * - Status file in .pi/ updated every 30s
 * - File watcher triggers syncs on changes
 * - Git hooks trigger syncs on commits
 * - Use 'pi agent status' to check if running
 * - Use 'pi context' directly for context queries
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PI_DIR = '.pi';
const DEBOUNCE_MS = 2000;

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
};

const log = {
  info: (msg: string) => console.log(`${colors.cyan}[PI]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[PI]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[PI]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[PI]${colors.reset} ${msg}`),
};

interface ExtensionConfig {
  autoSync: boolean;
  autoSyncDelay: number;
  gitHooks: boolean;
  statusUpdates: boolean;
}

const defaultConfig: ExtensionConfig = {
  autoSync: true,
  autoSyncDelay: DEBOUNCE_MS,
  gitHooks: true,
  statusUpdates: true,
};

/**
 * Get project identifier for PID files
 */
function getProjectId(projectRoot: string): string {
  return path.basename(projectRoot);
}

interface AgentState {
  pid: number;
  startedAt: string;
  lastSync: string;
  projectRoot: string;
  status: 'running' | 'stopped';
}

class PIExtension {
  private projectRoot: string;
  private projectId: string;
  private config: ExtensionConfig;
  private watcher: fs.FSWatcher | null = null;
  private isRunning: boolean = false;
  private lastSync: number = 0;
  private pendingSync: NodeJS.Timeout | null = null;
  private stateFile: string;
  private cliPath: string;

  constructor(projectRoot: string, config: Partial<ExtensionConfig> = {}) {
    this.projectRoot = projectRoot;
    this.projectId = getProjectId(projectRoot);
    this.config = { ...defaultConfig, ...config };
    this.stateFile = path.join(PI_DIR, `agent.${this.projectId}.state.json`);
    this.cliPath = this.findCliPath();
  }

  private findCliPath(): string {
    const paths = [
      path.join(this.projectRoot, 'dist', 'cli', 'index.js'),
      path.join(this.projectRoot, 'node_modules', 'pi-ppc', 'dist', 'cli', 'index.js'),
      path.join(__dirname, '..', '..', 'dist', 'cli', 'index.js'),
    ];
    
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return paths[0];
  }

  private getState(): AgentState | null {
    if (!fs.existsSync(this.stateFile)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.stateFile, 'utf-8'));
    } catch {
      return null;
    }
  }

  private setState(state: Partial<AgentState>): void {
    const current = this.getState() || {
      pid: 0,
      startedAt: '',
      lastSync: '',
      projectRoot: this.projectRoot,
      status: 'stopped' as const,
    };
    const updated = { ...current, ...state };
    fs.writeFileSync(this.stateFile, JSON.stringify(updated, null, 2));
  }

  /**
   * Check if agent is already running
   */
  isActive(): boolean {
    const state = this.getState();
    if (!state || state.status !== 'running') return false;
    
    try {
      process.kill(state.pid, 0);
      return true;
    } catch {
      // Process not running, clean up
      this.setState({ status: 'stopped' });
      return false;
    }
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this.isActive()) {
      const state = this.getState();
      log.warn(`[${this.projectId}] PI Agent already running (PID ${state?.pid})`);
      return;
    }

    // Ensure .pi exists
    if (!fs.existsSync(path.join(this.projectRoot, PI_DIR))) {
      log.info(`[${this.projectId}] Initializing .pi/...`);
      this.runCli('init');
    }

    // Save state
    this.setState({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      projectRoot: this.projectRoot,
      status: 'running',
    });

    this.isRunning = true;
    log.success(`[${this.projectId}] PI Agent started`);

    // Initial sync
    await this.sync();

    // Start components
    if (this.config.autoSync) {
      this.startFileWatcher();
    }

    if (this.config.gitHooks) {
      this.installGitHooks();
    }

    if (this.config.statusUpdates) {
      this.startStatusUpdates();
    }

    // Setup signal handlers
    this.setupSignals();

    log.info(`[${this.projectId}] Watching for changes...`);
    log.info(`[${this.projectId}] Run 'pi agent status' to check`);
    log.info(`[${this.projectId}] Press Ctrl+C to stop`);
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.setState({ status: 'stopped' });

    if (this.pendingSync) clearTimeout(this.pendingSync);
    if (this.watcher) this.watcher.close();
    this.isRunning = false;
    
    log.success(`[${this.projectId}] PI Agent stopped`);
  }

  /**
   * Sync graphs
   */
  async sync(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSync < 3000) return;

    this.lastSync = now;
    this.setState({ lastSync: new Date().toISOString() });
    
    try {
      this.runCli('sync');
      this.setState({ lastSync: new Date().toISOString() });
    } catch (error) {
      log.error(`[${this.projectId}] Sync failed: ${String(error)}`);
    }
  }

  /**
   * Start file watcher
   */
  private startFileWatcher(): void {
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.json', '.md'];
    const ignoredDirs = ['node_modules', '.git', '.pi', 'dist', 'build', 'coverage', '.next', '.nuxt'];

    let debounceTimer: NodeJS.Timeout | null = null;

    const onChange = (filePath: string) => {
      const ext = path.extname(filePath);
      const shouldIgnore = ignoredDirs.some(d => filePath.includes(d));

      if (extensions.includes(ext) && !shouldIgnore) {
        if (debounceTimer) clearTimeout(debounceTimer);
        
        debounceTimer = setTimeout(async () => {
          const relativePath = path.relative(this.projectRoot, filePath);
          log.info(`[${this.projectId}] ${relativePath} changed`);
          await this.sync();
        }, this.config.autoSyncDelay);
      }
    };

    const watchDir = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (ignoredDirs.includes(entry.name)) continue;
          
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            watchDir(fullPath);
          }
        }
        
        fs.watch(dir, (eventType, filename) => {
          if (filename) {
            onChange(path.join(dir, filename));
          }
        });
      } catch {
        // Ignore
      }
    };

    watchDir(this.projectRoot);
  }

  /**
   * Install git hooks
   */
  private installGitHooks(): void {
    const hooksDir = path.join(this.projectRoot, '.git', 'hooks');
    if (!fs.existsSync(hooksDir)) return;

    const cli = this.cliPath;

    const hookScript = [
      '#!/bin/sh',
      `# PI Agent [${this.projectId}]`,
      `if [ -f "${cli}" ]; then`,
      `  node "${cli}" sync 2>/dev/null || true`,
      'fi',
    ].join('\n');

    fs.writeFileSync(path.join(hooksDir, 'post-commit'), hookScript);
    fs.writeFileSync(path.join(hooksDir, 'post-merge'), hookScript);
    fs.writeFileSync(path.join(hooksDir, 'post-checkout'), hookScript);

    ['post-commit', 'post-merge', 'post-checkout'].forEach(hook => {
      fs.chmodSync(path.join(hooksDir, hook), 0o755);
    });

    log.success(`[${this.projectId}] Git hooks installed`);
  }

  /**
   * Start periodic status updates
   */
  private startStatusUpdates(): void {
    const update = () => {
      if (!this.isRunning) return;
      
      const state = this.getState();
      if (state?.status === 'running') {
        // Touch the state file to indicate liveness
        this.setState({});
      }
    };

    setInterval(update, 30000);
  }

  private runCli(command: string, args: string[] = []): void {
    if (!fs.existsSync(this.cliPath)) {
      throw new Error('CLI not found. Run: npm run build');
    }

    try {
      execSync('node "' + this.cliPath + '" ' + command + ' ' + args.join(' '), {
        cwd: this.projectRoot,
        stdio: 'ignore',
        timeout: 30000,
      });
    } catch {
      // Ignore sync errors
    }
  }

  private setupSignals(): void {
    const cleanup = () => this.stop();
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  getProjectId(): string {
    return this.projectId;
  }
}

/**
 * List all running agents
 */
function listRunningAgents(projectRoot: string): void {
  const piDir = path.join(projectRoot, PI_DIR);
  
  console.log('\n  PI Agents\n  ' + '─'.repeat(40));
  
  let found = false;
  try {
    const files = fs.readdirSync(piDir);
    for (const file of files) {
      if (file.startsWith('agent.') && file.endsWith('.state.json')) {
        try {
          const state = JSON.parse(fs.readFileSync(path.join(piDir, file), 'utf-8'));
          if (state.status === 'running') {
            try {
              process.kill(state.pid, 0);
              console.log(`  ${state.projectRoot.split('/').pop()?.padEnd(15)} PID ${state.pid}  Last sync: ${state.lastSync ? new Date(state.lastSync).toLocaleTimeString() : 'never'}`);
              found = true;
            } catch {
              // Process dead
            }
          }
        } catch {
          // Invalid state file
        }
      }
    }
  } catch {
    // .pi doesn't exist
  }
  
  if (!found) {
    console.log('  No agents running');
  }
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'help';
  const projectRoot = process.cwd();

  const extension = new PIExtension(projectRoot);

  switch (action) {
    case 'start':
      await extension.start();
      await new Promise(() => {});
      break;

    case 'stop':
      extension.stop();
      break;

    case 'status': {
      const state = extension.isActive();
      if (state) {
        console.log(`  PI Agent running  (${extension.getProjectId()})`);
      } else {
        console.log('  PI Agent not running');
      }
      break;
    }

    case 'list':
      listRunningAgents(projectRoot);
      break;

    case 'sync':
      await extension.sync();
      break;

    case 'restart':
      extension.stop();
      await new Promise(r => setTimeout(r, 500));
      await extension.start();
      break;

    case 'help':
    default:
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
    - Updates .pi/state.json every 30 seconds
    - Manages itself via PID files
      `);
  }
}

const isMain = process.argv[1]?.endsWith('agent.js') || process.argv[1]?.endsWith('agent.ts');
if (isMain) {
  main().catch(error => {
    log.error(String(error));
    process.exit(1);
  });
}

export { PIExtension, listRunningAgents };