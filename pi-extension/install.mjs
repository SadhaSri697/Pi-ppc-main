#!/usr/bin/env node

/**
 * PI Project Context Installer
 * 
 * Usage:
 *   npx pi-project-context          Install the extension
 *   npx pi-project-context --remove Remove the extension
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const EXTENSION_NAME = "pi-project-context";
const EXTENSION_DIR = path.join(os.homedir(), ".pi", "agent", "extensions", "pi-project-context");
const SOURCE_DIR = path.join(os.homedir(), "work", "projects", "pi-ppc", "pi-extension");

const args = process.argv.slice(2);
const isRemove = args.includes("--remove") || args.includes("-r");
const isHelp = args.includes("--help") || args.includes("-h");

if (isHelp) {
	console.log(`
pi-project-context - PI extension for persistent project context

Usage:
  npx pi-project-context          Install the extension
  npx pi-project-context --remove Remove the extension
  npx pi-project-context --help   Show this help

Installation directory: ${EXTENSION_DIR}

This extension provides:
  • project-context tool for querying/managing project memory
  • Auto-sync on file changes and git operations
  • Persistent project brain in .pi/ directory
`);
	process.exit(0);
}

if (isRemove) {
	if (fs.existsSync(EXTENSION_DIR)) {
		console.log(`Removing ${EXTENSION_DIR}...`);
		fs.rmSync(EXTENSION_DIR, { recursive: true });
		console.log("pi-project-context removed");
	} else {
		console.log("pi-project-context is not installed");
	}
	process.exit(0);
}

// Install
console.log("Installing pi-project-context...\n");

// Ensure parent directory exists
const parentDir = path.dirname(EXTENSION_DIR);
if (!fs.existsSync(parentDir)) {
	fs.mkdirSync(parentDir, { recursive: true });
}

// Check if source exists
if (!fs.existsSync(SOURCE_DIR)) {
	console.error(`Source not found: ${SOURCE_DIR}`);
	console.error("Please ensure pi-ppc is checked out at the expected location.");
	process.exit(1);
}

// Copy extension to extensions directory
console.log(`Copying from ${SOURCE_DIR}...`);
copyDirRecursive(SOURCE_DIR, EXTENSION_DIR);

console.log(`
✓ pi-project-context installed!

Tool added: project-context
Skills: pi-project-context

The extension will:
  • Auto-initialize .pi/ directory in projects
  • Sync on file changes and git operations
  • Provide project-context tool for memory management

No configuration needed - it auto-enables on every project.
`);

function copyDirRecursive(src, dest) {
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}
	
	const entries = fs.readdirSync(src, { withFileTypes: true });
	
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		
		if (entry.isDirectory()) {
			copyDirRecursive(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}