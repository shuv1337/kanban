/**
 * Hook telemetry module for durable, file-based logging of hook delivery events.
 * Writes structured JSONL records to ~/.cline/kanban/hooks/<agent>/logs/<workspace>/<task>.jsonl
 * This provides the primary observable sink for Phase 1 pi hook instrumentation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getRuntimeHomePath } from "../state/workspace-state.js";
import { writeStructuredRuntimeLog } from "./runtime-log.js";

export interface PiHookDeliveryLogEntry {
	ts: string;
	event:
		| "pi_hook_notify_attempted"
		| "pi_hook_notify_succeeded"
		| "pi_hook_notify_failed"
		| "pi_hook_ingest_attempted"
		| "pi_hook_ingest_succeeded"
		| "pi_hook_ingest_failed";
	taskId: string;
	workspaceId: string;
	hookEvent?: string;
	hookEventName?: string | null;
	toolName?: string | null;
	toolInputSummary?: string | null;
	sessionDir?: string;
	cwd?: string;
	commandParts?: string[];
	durationMs?: number;
	exitCode?: number | null;
	errorClass?: string | null;
	errorMessage?: string | null;
	metadata?: Record<string, unknown>;
}

function getPiHookLogFilePath(workspaceId: string, taskId: string): string {
	return join(getRuntimeHomePath(), "hooks", "pi", "logs", workspaceId, `${taskId}.jsonl`);
}

async function ensureLogDirectory(logPath: string): Promise<void> {
	await mkdir(dirname(logPath), { recursive: true });
}

/**
 * Write a hook delivery log entry to the per-task JSONL file.
 * Also emits to stderr via writeStructuredRuntimeLog for live debugging.
 */
export async function writePiHookLogEntry(entry: PiHookDeliveryLogEntry): Promise<void> {
	const logPath = getPiHookLogFilePath(entry.workspaceId, entry.taskId);
	const line = `${JSON.stringify(entry)}\n`;

	try {
		await ensureLogDirectory(logPath);
		await writeFile(logPath, line, { flag: "a" });
	} catch (err) {
		// If file logging fails, at least try to emit to stderr
		writeStructuredRuntimeLog({
			event: "hook_telemetry_write_failed",
			logPath,
			error: err instanceof Error ? err.message : String(err),
		});
	}

	// Also emit to stderr for real-time visibility
	writeStructuredRuntimeLog({
		event: entry.event,
		taskId: entry.taskId,
		workspaceId: entry.workspaceId,
		hookEvent: entry.hookEvent,
		durationMs: entry.durationMs,
		exitCode: entry.exitCode,
		errorClass: entry.errorClass,
		hasError: entry.errorMessage != null,
	});
}

/**
 * Convenience function to log a pi hook notify attempt.
 */
export async function logPiHookNotifyAttempted(
	context: {
		taskId: string;
		workspaceId: string;
		hookEvent?: string;
		hookEventName?: string | null;
		toolName?: string | null;
		toolInputSummary?: string | null;
		sessionDir?: string;
		cwd?: string;
		commandParts?: string[];
	},
	metadata?: Record<string, unknown>,
): Promise<void> {
	await writePiHookLogEntry({
		ts: new Date().toISOString(),
		event: "pi_hook_notify_attempted",
		...context,
		metadata,
	});
}

/**
 * Convenience function to log a successful pi hook notify.
 */
export async function logPiHookNotifySucceeded(
	context: {
		taskId: string;
		workspaceId: string;
		hookEvent?: string;
		hookEventName?: string | null;
	},
	durationMs: number,
): Promise<void> {
	await writePiHookLogEntry({
		ts: new Date().toISOString(),
		event: "pi_hook_notify_succeeded",
		...context,
		durationMs,
	});
}

/**
 * Convenience function to log a failed pi hook notify.
 */
export async function logPiHookNotifyFailed(
	context: {
		taskId: string;
		workspaceId: string;
		hookEvent?: string;
		hookEventName?: string | null;
		toolName?: string | null;
		toolInputSummary?: string | null;
		sessionDir?: string;
		cwd?: string;
		commandParts?: string[];
	},
	error: unknown,
	durationMs?: number,
): Promise<void> {
	await writePiHookLogEntry({
		ts: new Date().toISOString(),
		event: "pi_hook_notify_failed",
		...context,
		durationMs,
		errorClass: error instanceof Error ? error.name : "Error",
		errorMessage: error instanceof Error ? error.message : String(error),
	});
}

/**
 * Log a transition to review from pi hooks.
 */
export async function logPiReviewTransitioned(
	context: {
		taskId: string;
		workspaceId: string;
		hookEventName?: string | null;
	},
	metadata?: Record<string, unknown>,
): Promise<void> {
	await writePiHookLogEntry({
		ts: new Date().toISOString(),
		event: "pi_hook_ingest_succeeded",
		eventSubtype: "pi_review_transitioned",
		...context,
		metadata,
	} as PiHookDeliveryLogEntry & { eventSubtype: string });
}
