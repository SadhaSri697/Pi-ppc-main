/**
 * PI Project Context Extension
 * 
 * Auto-syncs project context when files change or git operations occur.
 * Provides a 'project-context' tool for querying and managing project memory.
 * 
 * No peer dependency on pi-coding-agent - uses only Node.js builtins.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn } from "node:child_process";

interface ProjectContextState {
	projectRoot: string;
	piBinary: string;
	watcher: fs.FSWatcher | null;
	lastSync: number;
	hooksInstalled: boolean;
}

const state: ProjectContextState = {
	projectRoot: "",
	piBinary: "",
	watcher: null,
	lastSync: 0,
	hooksInstalled: false,
};

function getPiBinary(): string {
	// Check common locations
	const locations = [
		// Global npm install
		path.join(os.homedir(), ".nvm", "versions", "node", "v20.0.0", "bin", "pi"),
		"/usr/local/bin/pi",
		"/usr/bin/pi",
		// Check if pi is in PATH
	];
	
	// Try to find pi binary
	const pathEnv = process.env.PATH || "";
	const pathDirs = pathEnv.split(":");
	
	for (const dir of pathDirs) {
		const piPath = path.join(dir, "pi");
		if (fs.existsSync(piPath) && fs.statSync(piPath).isFile()) {
			return piPath;
		}
	}
	
	// Fallback to node wrapper script approach - use node to run pi-ppc
	const devPath = path.join(os.homedir(), "work", "projects", "pi-ppc", "dist", "cli", "index.js");
	if (fs.existsSync(devPath)) {
		return `node "${devPath}"`;
	}
	
	return "pi"; // Last resort - hope it's in PATH
}

function runPiCommand(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve) => {
		const binary = state.piBinary;
		let proc;
		
		if (binary.includes("node ")) {
			// Node wrapper
			const [nodeCmd, scriptPath] = binary.split(" ");
			proc = spawn(nodeCmd, [scriptPath, ...args], { cwd, shell: false });
		} else {
			proc = spawn(binary, args, { cwd, shell: false });
		}
		
		let stdout = "";
		let stderr = "";
		proc.stdout?.on("data", (data) => { stdout += data; });
		proc.stderr?.on("data", (data) => { stderr += data; });
		proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
		proc.on("error", (err) => resolve({ stdout: "", stderr: err.message, code: 1 }));
	});
}

async function ensurePiInit(cwd: string): Promise<boolean> {
	const piDir = path.join(cwd, ".pi");
	if (!fs.existsSync(piDir)) {
		console.log("PI: Initializing project context...");
		const result = await runPiCommand(["init"], cwd);
		return result.code === 0;
	}
	return true;
}

async function syncProject(cwd: string): Promise<{ symbols: number; deps: number; files: number }> {
	const result = await runPiCommand(["sync", "--json"], cwd);
	try {
		const parsed = JSON.parse(result.stdout);
		return {
			symbols: parsed.symbols ?? 0,
			deps: parsed.deps ?? 0,
			files: parsed.files ?? 0,
		};
	} catch {
		return { symbols: 0, deps: 0, files: 0 };
	}
}

function installGitHooks(cwd: string): void {
	const hooksDir = path.join(cwd, ".git", "hooks");
	if (!fs.existsSync(hooksDir)) return;
	
	const piCmd = state.piBinary.includes("node ")
		? `node ${state.piBinary.split(" ")[1]}`
		: state.piBinary;
	
	const hookScript = `#!/bin/sh
# PI Project Context - auto-sync on git operations
if [ -f "${piCmd.replace(/"/g, '\\"')}" ]; then
  "${piCmd}" sync 2>/dev/null || true
fi
`;
	
	const hooks = ["post-commit", "post-merge", "post-checkout"];
	for (const hook of hooks) {
		const hookPath = path.join(hooksDir, hook);
		const existing = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, "utf8") : "";
		if (!existing.includes("PI Project Context")) {
			fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
		}
	}
}

function setupFileWatcher(cwd: string, events: { on: Function; emit: Function }): void {
	if (state.watcher) {
		state.watcher.close();
	}
	
	let debounceTimer: NodeJS.Timeout | null = null;
	
	const ignored = [/\.git\//, /node_modules\//, /\.pi\//];
	
	state.watcher = fs.watch(cwd, { recursive: true }, (eventType, filename) => {
		if (!filename) return;
		
		// Check if ignored
		for (const pattern of ignored) {
			if (pattern.test(filename)) return;
		}
		
		// TypeScript/JavaScript files most important
		const ext = path.extname(filename);
		if (![".ts", ".js", ".tsx", ".jsx", ".json", ".md", ".py", ".go", ".rs"].includes(ext)) return;
		
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(async () => {
			const result = await syncProject(cwd);
			state.lastSync = Date.now();
			events.emit("project-context:sync", { result, filename });
		}, 2000);
	});
}

// Tool definition matching PI extension API
interface ToolDefinition {
	name: string;
	label: string;
	description: string;
	parameters: any;
	execute(id: string, args: any, signal: AbortSignal, onUpdate: any, ctx: any): Promise<any>;
}

interface ExtensionAPI {
	registerTool(tool: ToolDefinition): void;
	on(event: string, handler: Function): void;
	events?: { on: Function; emit: Function };
}

interface ExtensionContext {
	cwd: string;
	hasUI?: boolean;
	ui?: any;
	events?: { on: Function; emit: Function };
}

export default function registerProjectContextExtension(pi: ExtensionAPI): void {
	const cwd = process.cwd();
	state.projectRoot = cwd;
	state.piBinary = getPiBinary();
	
	console.log(`PI Project Context: initializing at ${cwd}`);
	
	// Ensure .pi directory exists
	ensurePiInit(cwd).then((initialized) => {
		if (!initialized) {
			console.warn("PI: Failed to initialize project context");
			return;
		}
		
		console.log("PI: Project context initialized");
		
		// Install git hooks
		installGitHooks(cwd);
		state.hooksInstalled = true;
		console.log("PI: Git hooks installed");
		
		// Initial sync
		syncProject(cwd).then((result) => {
			state.lastSync = Date.now();
			console.log(`PI: Synced [symbols:${result.symbols}, deps:${result.deps}, files:${result.files}]`);
		});
	});

	const tool: ToolDefinition = {
		name: "project-context",
		label: "Project Context",
		description: `Query and manage project context for PI coding agent.

Read operations:
• { action: "get" } - Get full project context as JSON
• { action: "status" } - Show current focus, tasks, questions
• { action: "memory" } - Display beliefs, decisions, entities, events
• { action: "sync" } - Force sync symbol/dependency/file graphs

Write operations:
• { action: "set-focus", focus: "task description", priority?: "high|medium|low" }
• { action: "add-task", title: "task", priority?: "high|medium|low" }
• { action: "add-decision", summary: "...", context?: "..." }
• { action: "add-event", type: "decision|task|discovery", summary: "..." }

State file: .pi/agent.{project}.state.json`,
		parameters: {
			type: "object",
			properties: {
				action: {
					type: "string",
					enum: ["get", "status", "memory", "sync", "set-focus", "add-task", "add-decision", "add-event"],
				},
				focus: { type: "string" },
				title: { type: "string" },
				priority: { type: "string", enum: ["high", "medium", "low"] },
				summary: { type: "string" },
				context: { type: "string" },
				type: { type: "string", enum: ["decision", "task", "discovery"] },
			},
			required: ["action"],
		},
		async execute(id: string, args: any, signal: AbortSignal, onUpdate: any, ctx: ExtensionContext) {
			const projectRoot = ctx.cwd || cwd;
			
			// Lazy setup of file watcher
			if (!state.watcher && ctx.events) {
				setupFileWatcher(projectRoot, ctx.events);
			}
			
			switch (args.action) {
				case "get": {
					const result = await runPiCommand(["context", "--json"], projectRoot);
					try {
						const context = JSON.parse(result.stdout);
						return { success: true, output: JSON.stringify(context, null, 2) };
					} catch {
						return { success: false, output: result.stdout || result.stderr };
					}
				}
				case "status": {
					const result = await runPiCommand(["status"], projectRoot);
					return { success: true, output: result.stdout };
				}
				case "memory": {
					const result = await runPiCommand(["memory"], projectRoot);
					return { success: true, output: result.stdout };
				}
				case "sync": {
					const syncResult = await syncProject(projectRoot);
					state.lastSync = Date.now();
					return {
						success: true,
						output: `Synced [symbols:${syncResult.symbols}, deps:${syncResult.deps}, files:${syncResult.files}]`,
					};
				}
				case "set-focus": {
					const focusFile = path.join(projectRoot, ".pi", "state", "current_focus.json");
					const focusData = {
						focus: args.focus,
						focus_since: new Date().toISOString(),
						priority: args.priority || "medium",
					};
					fs.writeFileSync(focusFile, JSON.stringify(focusData, null, 2));
					return { success: true, output: `Focus set: ${args.focus}` };
				}
				case "add-task": {
					const tasksFile = path.join(projectRoot, ".pi", "state", "active_tasks.json");
					const tasks = fs.existsSync(tasksFile)
						? JSON.parse(fs.readFileSync(tasksFile, "utf8"))
						: { tasks: [] };
					tasks.tasks.push({
						id: `task-${Date.now()}`,
						title: args.title,
						priority: args.priority || "medium",
						status: "in_progress",
						created_at: new Date().toISOString(),
					});
					fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
					return { success: true, output: `Task added: ${args.title}` };
				}
				case "add-decision": {
					const decisionsFile = path.join(projectRoot, ".pi", "architecture", "decisions.md");
					const entry = `\n### ${new Date().toISOString().split("T")[0]}: ${args.summary}\n**Context:** ${args.context || "N/A"}\n`;
					fs.appendFileSync(decisionsFile, entry);
					return { success: true, output: `Decision recorded: ${args.summary}` };
				}
				case "add-event": {
					const eventsFile = path.join(projectRoot, ".pi", "memory", "episodic", "events.jsonl");
					const event = {
						id: `evt-${Date.now()}`,
						type: args.type || "discovery",
						summary: args.summary,
						ts: new Date().toISOString(),
					};
					fs.appendFileSync(eventsFile, JSON.stringify(event) + "\n");
					return { success: true, output: `Event logged: ${args.summary}` };
				}
				default:
					return { success: false, output: `Unknown action: ${args.action}` };
			}
		},
	};

	pi.registerTool(tool);
	
	// Listen for session shutdown to cleanup
	pi.on("session_shutdown", () => {
		if (state.watcher) {
			state.watcher.close();
			state.watcher = null;
		}
	});
	
	console.log("PI: project-context tool registered");
}