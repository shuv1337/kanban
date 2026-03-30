import { describe, expect, it, vi } from "vitest";

import type { RuntimeTaskSessionSummary } from "../../../src/core/api-contract.js";
import type { TerminalSessionManager } from "../../../src/terminal/session-manager.js";
import { createHooksApi } from "../../../src/trpc/hooks-api.js";

function createSummary(overrides: Partial<RuntimeTaskSessionSummary> = {}): RuntimeTaskSessionSummary {
	return {
		taskId: "task-pi-1",
		state: "running",
		agentId: "pi",
		workspacePath: "/tmp/worktree",
		pid: 1234,
		startedAt: Date.now(),
		updatedAt: Date.now(),
		lastOutputAt: Date.now(),
		reviewReason: null,
		exitCode: null,
		lastHookAt: null,
		latestHookActivity: null,
		...overrides,
	};
}

describe("createHooksApi - pi hook semantics", () => {
	it("pi hook activity updates session metadata", async () => {
		const mockApplyHookActivity = vi.fn(() =>
			createSummary({
				state: "running",
				lastHookAt: Date.now(),
				latestHookActivity: {
					source: "pi",
					hookEventName: "tool_execution_start",
					toolName: "Read",
					toolInputSummary: "src/main.ts",
					activityText: "Using Read: src/main.ts",
					finalMessage: null,
					notificationType: null,
				},
			}),
		);

		const manager = {
			getSummary: vi.fn(() => createSummary({ state: "running" })),
			transitionToReview: vi.fn(),
			transitionToRunning: vi.fn(),
			applyHookActivity: mockApplyHookActivity,
			applyTurnCheckpoint: vi.fn(),
		} as unknown as TerminalSessionManager;

		const api = createHooksApi({
			getWorkspacePathById: vi.fn(() => "/tmp/repo"),
			ensureTerminalManagerForWorkspace: vi.fn(async () => manager),
			broadcastRuntimeWorkspaceStateUpdated: vi.fn(),
			broadcastTaskReadyForReview: vi.fn(),
		});

		const response = await api.ingest({
			taskId: "task-pi-1",
			workspaceId: "workspace-1",
			event: "activity",
			metadata: {
				source: "pi",
				hookEventName: "tool_execution_start",
				toolName: "Read",
				toolInputSummary: "src/main.ts",
				activityText: "Using Read: src/main.ts",
			},
		});

		expect(response).toEqual({ ok: true });
		expect(mockApplyHookActivity).toHaveBeenCalledWith(
			"task-pi-1",
			expect.objectContaining({
				source: "pi",
				hookEventName: "tool_execution_start",
				toolName: "Read",
				activityText: "Using Read: src/main.ts",
			}),
		);
	});

	it("pi completion via agent_end moves task to awaiting_review", async () => {
		const transitionedSummary = createSummary({
			state: "awaiting_review",
			reviewReason: "hook",
			lastHookAt: Date.now(),
			latestHookActivity: {
				source: "pi",
				hookEventName: "agent_end",
				activityText: "Waiting for review",
				finalMessage: null,
				toolName: null,
				toolInputSummary: null,
				notificationType: null,
			},
			latestTurnCheckpoint: {
				turn: 1,
				ref: "refs/shuvban/checkpoints/task-pi-1/turn/1",
				commit: "abc1234",
				createdAt: Date.now(),
			},
		});

		const manager = {
			getSummary: vi.fn(() => createSummary({ state: "running" })),
			transitionToReview: vi.fn(() => transitionedSummary),
			transitionToRunning: vi.fn(),
			applyHookActivity: vi.fn(),
			applyTurnCheckpoint: vi.fn(),
		} as unknown as TerminalSessionManager;

		const broadcastReview = vi.fn();
		const api = createHooksApi({
			getWorkspacePathById: vi.fn(() => "/tmp/repo"),
			ensureTerminalManagerForWorkspace: vi.fn(async () => manager),
			broadcastRuntimeWorkspaceStateUpdated: vi.fn(),
			broadcastTaskReadyForReview: broadcastReview,
		});

		const response = await api.ingest({
			taskId: "task-pi-1",
			workspaceId: "workspace-1",
			event: "to_review",
			metadata: {
				source: "pi",
				hookEventName: "agent_end",
			},
		});

		expect(response).toEqual({ ok: true });
		expect(manager.transitionToReview).toHaveBeenCalledWith("task-pi-1", "hook");
		expect(broadcastReview).toHaveBeenCalledWith("workspace-1", "task-pi-1");
	});

	it("pi resumed task returns to running on follow-up input and back to review on completion", async () => {
		// Track state changes to simulate proper state machine behavior
		let currentState = "awaiting_review";

		const manager = {
			getSummary: vi.fn(() =>
				createSummary({
					state: currentState as "running" | "awaiting_review" | "idle" | "failed" | "interrupted",
					reviewReason: currentState === "awaiting_review" ? "hook" : null,
				}),
			),
			transitionToReview: vi.fn(() => {
				currentState = "awaiting_review";
				return createSummary({
					state: "awaiting_review",
					reviewReason: "hook",
					latestTurnCheckpoint: {
						turn: 2,
						ref: "refs/shuvban/checkpoints/task-pi-1/turn/2",
						commit: "def5678",
						createdAt: Date.now(),
					},
				});
			}),
			transitionToRunning: vi.fn(() => {
				currentState = "running";
				return createSummary({
					state: "running",
					reviewReason: null,
				});
			}),
			applyHookActivity: vi.fn(),
			applyTurnCheckpoint: vi.fn(),
		} as unknown as TerminalSessionManager;

		const api = createHooksApi({
			getWorkspacePathById: vi.fn(() => "/tmp/repo"),
			ensureTerminalManagerForWorkspace: vi.fn(async () => manager),
			broadcastRuntimeWorkspaceStateUpdated: vi.fn(),
			broadcastTaskReadyForReview: vi.fn(),
		});

		// First: to_in_progress should transition from awaiting_review to running
		const inProgressResponse = await api.ingest({
			taskId: "task-pi-1",
			workspaceId: "workspace-1",
			event: "to_in_progress",
			metadata: {
				source: "pi",
				hookEventName: "agent_start",
			},
		});

		expect(inProgressResponse).toEqual({ ok: true });
		expect(manager.transitionToRunning).toHaveBeenCalledWith("task-pi-1");

		// Then: to_review should transition back to awaiting_review
		const reviewResponse = await api.ingest({
			taskId: "task-pi-1",
			workspaceId: "workspace-1",
			event: "to_review",
			metadata: {
				source: "pi",
				hookEventName: "agent_end",
				finalMessage: "Task completed successfully",
			},
		});

		expect(reviewResponse).toEqual({ ok: true });
		expect(manager.transitionToReview).toHaveBeenCalledWith("task-pi-1", "hook");
	});

	it("preserves pi final-message metadata when transitioning to review", async () => {
		const transitionedSummary = createSummary({
			state: "awaiting_review",
			reviewReason: "hook",
			lastHookAt: Date.now(),
			latestHookActivity: {
				source: "pi",
				hookEventName: "agent_end",
				activityText: "Final: Task completed successfully",
				finalMessage: "Task completed successfully",
				toolName: null,
				toolInputSummary: null,
				notificationType: null,
			},
		});

		const mockApplyHookActivity = vi.fn(() => transitionedSummary);
		const manager = {
			getSummary: vi.fn(() => createSummary({ state: "running" })),
			transitionToReview: vi.fn(() => transitionedSummary),
			transitionToRunning: vi.fn(),
			applyHookActivity: mockApplyHookActivity,
			applyTurnCheckpoint: vi.fn(),
		} as unknown as TerminalSessionManager;

		const api = createHooksApi({
			getWorkspacePathById: vi.fn(() => "/tmp/repo"),
			ensureTerminalManagerForWorkspace: vi.fn(async () => manager),
			broadcastRuntimeWorkspaceStateUpdated: vi.fn(),
			broadcastTaskReadyForReview: vi.fn(),
		});

		const response = await api.ingest({
			taskId: "task-pi-1",
			workspaceId: "workspace-1",
			event: "to_review",
			metadata: {
				source: "pi",
				hookEventName: "agent_end",
				finalMessage: "Task completed successfully",
				activityText: "Final: Task completed successfully",
			},
		});

		expect(response).toEqual({ ok: true });
		expect(mockApplyHookActivity).toHaveBeenCalledWith(
			"task-pi-1",
			expect.objectContaining({
				finalMessage: "Task completed successfully",
				source: "pi",
				hookEventName: "agent_end",
			}),
		);
	});

	it("ignores to_review for non-running states", async () => {
		const manager = {
			getSummary: vi.fn(() =>
				createSummary({
					state: "awaiting_review",
					reviewReason: "hook",
				}),
			),
			transitionToReview: vi.fn(),
			transitionToRunning: vi.fn(),
			applyHookActivity: vi.fn(),
		} as unknown as TerminalSessionManager;

		const api = createHooksApi({
			getWorkspacePathById: vi.fn(() => "/tmp/repo"),
			ensureTerminalManagerForWorkspace: vi.fn(async () => manager),
			broadcastRuntimeWorkspaceStateUpdated: vi.fn(),
			broadcastTaskReadyForReview: vi.fn(),
		});

		// Attempting to transition to_review when already awaiting_review should be a no-op
		const response = await api.ingest({
			taskId: "task-pi-1",
			workspaceId: "workspace-1",
			event: "to_review",
			metadata: { source: "pi" },
		});

		expect(response).toEqual({ ok: true });
		expect(manager.transitionToReview).not.toHaveBeenCalled();
	});
});
