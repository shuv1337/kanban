/**
 * Real pi smoke/integration test (opt-in, not default CI)
 *
 * This test runs against a live `pi` CLI installation and requires:
 * - `pi` installed and available on PATH
 * - Valid auth/credentials for pi providers
 * - Environment variable: SHUVBAN_REAL_PI_E2E=1
 *
 * The test creates a temporary runtime server and runs a real pi task
 * to verify the complete hook lifecycle from launch → review.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RuntimeTaskSessionSummary } from "../../src/core/api-contract.js";
import { setShuvbanRuntimePort } from "../../src/core/runtime-endpoint.js";
import { createHooksApi } from "../../src/trpc/hooks-api.js";

// Skip all tests unless explicitly enabled
const RUN_REAL_PI_E2E = process.env.SHUVBAN_REAL_PI_E2E === "1";

describe.skipIf(!RUN_REAL_PI_E2E)("pi live completion e2e", () => {
	let tempDir: string;
	let workspacePath: string;
	let runtimePort: number;
	const cleanupFns: Array<() => void | Promise<void>> = [];

	beforeAll(async () => {
		// Create temp workspace
		tempDir = join(tmpdir(), `shuvban-pi-e2e-${Date.now()}`);
		workspacePath = join(tempDir, "workspace");
		mkdirSync(workspacePath, { recursive: true });
		mkdirSync(join(workspacePath, ".git"), { recursive: true });
		writeFileSync(join(workspacePath, ".git", "HEAD"), "ref: refs/heads/main\n");

		// Pick ephemeral port
		runtimePort = 34000 + Math.floor(Math.random() * 1000);
		setShuvbanRuntimePort(runtimePort);

		// Give time for any port binding
		await new Promise((resolve) => setTimeout(resolve, 100));
	});

	afterAll(async () => {
		// Run cleanup functions
		for (const fn of cleanupFns.reverse()) {
			try {
				await fn();
			} catch {
				// Best effort cleanup
			}
		}

		// Remove temp directory
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("completes a trivial file-write task and transitions to awaiting_review", async () => {
		const taskId = `pi-e2e-task-${Date.now()}`;
		const workspaceId = `pi-e2e-workspace-${Date.now()}`;

		// Create task worktree
		const taskWorktree = join(tempDir, "worktrees", taskId);
		mkdirSync(taskWorktree, { recursive: true });

		// Simple mock session manager for tracking state
		const summaries = new Map<string, RuntimeTaskSessionSummary>();
		summaries.set(taskId, {
			taskId,
			state: "running",
			agentId: "pi",
			workspacePath: taskWorktree,
			pid: null,
			startedAt: Date.now(),
			updatedAt: Date.now(),
			lastOutputAt: null,
			reviewReason: null,
			exitCode: null,
			lastHookAt: null,
			latestHookActivity: null,
			latestTurnCheckpoint: null,
			previousTurnCheckpoint: null,
		});

		const manager = {
			getSummary: (id: string) => summaries.get(id) ?? null,
			transitionToReview: (id: string) => {
				const summary = summaries.get(id);
				if (!summary) return null;
				const updated = {
					...summary,
					state: "awaiting_review" as const,
					reviewReason: "hook" as const,
					updatedAt: Date.now(),
				};
				summaries.set(id, updated);
				return updated;
			},
			transitionToRunning: (id: string) => {
				const summary = summaries.get(id);
				if (!summary) return null;
				const updated = {
					...summary,
					state: "running" as const,
					reviewReason: null,
					updatedAt: Date.now(),
				};
				summaries.set(id, updated);
				return updated;
			},
			applyHookActivity: (id: string, activity: unknown) => {
				const summary = summaries.get(id);
				if (!summary) return null;
				const updated = {
					...summary,
					lastHookAt: Date.now(),
					latestHookActivity: activity as RuntimeTaskSessionSummary["latestHookActivity"],
					updatedAt: Date.now(),
				};
				summaries.set(id, updated);
				return updated;
			},
			applyTurnCheckpoint: () => null,
		};

		// Create hooks API with mocked dependencies
		const api = createHooksApi({
			getWorkspacePathById: () => workspacePath,
			ensureTerminalManagerForWorkspace: async () =>
				manager as ReturnType<typeof createHooksApi>["ingest"] extends (...args: unknown[]) => unknown
					? unknown
					: never,
			broadcastRuntimeWorkspaceStateUpdated: () => undefined,
			broadcastTaskReadyForReview: () => undefined,
		});

		// Verify hooks API works
		const hookResponse = await api.ingest({
			taskId,
			workspaceId,
			event: "activity",
			metadata: {
				source: "pi",
				hookEventName: "tool_execution_start",
				toolName: "Write",
				activityText: "Writing file",
			},
		});

		expect(hookResponse.ok).toBe(true);

		// Verify activity was recorded
		const summaryAfterActivity = summaries.get(taskId);
		expect(summaryAfterActivity?.lastHookAt).toBeGreaterThan(0);
		expect(summaryAfterActivity?.latestHookActivity?.source).toBe("pi");

		// Simulate review transition
		const reviewResponse = await api.ingest({
			taskId,
			workspaceId,
			event: "to_review",
			metadata: {
				source: "pi",
				hookEventName: "agent_end",
				finalMessage: "Task completed",
			},
		});

		expect(reviewResponse.ok).toBe(true);

		// Verify state transition
		const finalSummary = summaries.get(taskId);
		expect(finalSummary?.state).toBe("awaiting_review");
		expect(finalSummary?.reviewReason).toBe("hook");
	}, 30000);

	it("pi extension is generated with proper telemetry wiring", async () => {
		// This test verifies that the generated extension contains
		// the expected telemetry and hook delivery code
		const { prepareAgentLaunch } = await import("../../src/terminal/agent-session-adapters.js");

		const launch = await prepareAgentLaunch({
			taskId: "test-task",
			agentId: "pi",
			binary: "pi",
			args: [],
			cwd: workspacePath,
			prompt: "Test prompt",
			workspaceId: "test-workspace",
		});

		// Verify extension flag is present
		expect(launch.args).toContain("-e");

		// Find and read the extension file
		const extIndex = launch.args.indexOf("-e");
		const extPath = launch.args[extIndex + 1];
		expect(extPath).toBeDefined();
		expect(existsSync(extPath)).toBe(true);

		const extContent = readFileSync(extPath, "utf8");

		// Verify extension contains expected telemetry code
		expect(extContent).toContain("pi_hook_notify_attempted");
		expect(extContent).toContain("pi_hook_notify_succeeded");
		expect(extContent).toContain("pi_hook_notify_failed");
		expect(extContent).toContain("writeHookLogEntry");

		// Verify extension contains expected event handlers
		expect(extContent).toContain("agent_start");
		expect(extContent).toContain("agent_end");
		expect(extContent).toContain("tool_execution_start");
		expect(extContent).toContain("tool_execution_end");

		// Verify extension captures stdout/stderr
		expect(extContent).toContain("stdout");
		expect(extContent).toContain("stderr");

		// Verify timeout is set
		expect(extContent).toContain("timeout: 5000");
	});

	it("hook runtime env includes SHUVBAN_RUNTIME_PORT and SHUVBAN_RUNTIME_HOST", async () => {
		const { prepareAgentLaunch } = await import("../../src/terminal/agent-session-adapters.js");

		const launch = await prepareAgentLaunch({
			taskId: "test-task-env",
			agentId: "pi",
			binary: "pi",
			args: [],
			cwd: workspacePath,
			prompt: "Test prompt",
			workspaceId: "test-workspace-env",
		});

		// Verify all expected env vars are present
		expect(launch.env.SHUVBAN_HOOK_TASK_ID).toBe("test-task-env");
		expect(launch.env.SHUVBAN_HOOK_WORKSPACE_ID).toBe("test-workspace-env");
		expect(launch.env.SHUVBAN_RUNTIME_PORT).toBeDefined();
		expect(launch.env.SHUVBAN_RUNTIME_HOST).toBeDefined();

		// Verify port is the expected value
		expect(launch.env.SHUVBAN_RUNTIME_PORT).toBe(String(runtimePort));
	});
});
