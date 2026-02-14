#!/usr/bin/env node

import { createSampleBoard } from "./index.js";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
	console.log("kanbanana");
	console.log("A kanban foundation for coding agents.");
	console.log("");
	console.log("Usage:");
	console.log("  kanbanana [--json] [--help] [--version]");
	process.exit(0);
}

if (args.has("--version") || args.has("-v")) {
	console.log("0.1.0");
	process.exit(0);
}

const board = createSampleBoard();

if (args.has("--json")) {
	console.log(JSON.stringify(board, null, 2));
	process.exit(0);
}

console.log(`kanbanana: ${board.name}`);
for (const task of board.tasks) {
	console.log(`- [${task.status}] ${task.title}`);
}
