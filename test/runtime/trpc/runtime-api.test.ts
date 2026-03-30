import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeConfigState } from "../../../src/config/runtime-config";
import type { RuntimeTaskSessionSummary } from "../../../src/core/api-contract";

const agentRegistryMocks = vi.hoisted(() => ({
	resolveAgentCommand: vi.fn(),
	buildRuntimeConfigResponse: vi.fn(),
}));

const taskWorktreeMocks = vi.hoisted(() => ({
	resolveTaskCwd: vi.fn(),
}));

const turnCheckpointMocks = vi.hoisted(() => ({
	captureTaskTurnCheckpoint: vi.fn(),
}));

const browserMocks = vi.hoisted(() => ({
	openInBrowser: vi.fn(),
}));

vi.mock("../../../src/terminal/agent-registry.js", () => ({
	resolveAgentCommand: agentRegistryMocks.resolveAgentCommand,
	buildRuntimeConfigResponse: agentRegistryMocks.buildRuntimeConfigResponse,
}));

vi.mock("../../../src/workspace/task-worktree.js", () => ({
	resolveTaskCwd: taskWorktreeMocks.resolveTaskCwd,
}));

vi.mock("../../../src/workspace/turn-checkpoints.js", () => ({
	captureTaskTurnCheckpoint: turnCheckpointMocks.captureTaskTurnCheckpoint,
}));

vi.mock("../../../src/server/browser.js", () => ({
	openInBrowser: browserMocks.openInBrowser,
}));

import { createRuntimeApi } from "../../../src/trpc/runtime-api";

function createSummary(overrides: Partial<RuntimeTaskSessionSummary> = {}): RuntimeTaskSessionSummary {
	return {
		taskId: "task-1",
		state: "running",
		agentId: "claude",
		workspacePath: "/tmp/worktree",
		pid: 1234,
		startedAt: Date.now(),
		updatedAt: Date.now(),
		lastOutputAt: Date.now(),
		reviewReason: null,
		exitCode: null,
		lastHookAt: null,
		latestHookActivity: null,
		latestTurnCheckpoint: null,
		previousTurnCheckpoint: null,
		...overrides,
	};
}

function createRuntimeConfigState(): RuntimeConfigState {
	return {
		selectedAgentId: "claude",
		selectedShortcutLabel: null,
		agentAutonomousModeEnabled: true,
		readyForReviewNotificationsEnabled: true,
		shortcuts: [],
		commitPromptTemplate: "commit",
		openPrPromptTemplate: "pr",
		commitPromptTemplateDefault: "commit",
		openPrPromptTemplateDefault: "pr",
		globalConfigPath: "/tmp/global-config.json",
		projectConfigPath: "/tmp/project-config.json",
	};
}

function createTerminalManager() {
	return {
		startTaskSession: vi.fn(async () => createSummary()),
		stopTaskSession: vi.fn(() => createSummary({ state: "idle", pid: null })),
		writeInput: vi.fn(() => createSummary()),
		getSummary: vi.fn(() => null),
		applyTurnCheckpoint: vi.fn((taskId: string, checkpoint: RuntimeTaskSessionSummary["latestTurnCheckpoint"]) =>
			createSummary({ taskId, latestTurnCheckpoint: checkpoint ?? null }),
		),
		startShellSession: vi.fn(),
	};
}

describe("createRuntimeApi", () => {
	beforeEach(() => {
		agentRegistryMocks.resolveAgentCommand.mockReset();
		agentRegistryMocks.buildRuntimeConfigResponse.mockReset();
		taskWorktreeMocks.resolveTaskCwd.mockReset();
		turnCheckpointMocks.captureTaskTurnCheckpoint.mockReset();
		browserMocks.openInBrowser.mockReset();

		agentRegistryMocks.resolveAgentCommand.mockReturnValue({
			agentId: "claude",
			label: "Claude Code",
			command: "claude",
			binary: "claude",
			args: [],
		});
		agentRegistryMocks.buildRuntimeConfigResponse.mockImplementation((config: RuntimeConfigState) => ({
			selectedAgentId: config.selectedAgentId,
			selectedShortcutLabel: config.selectedShortcutLabel,
			agentAutonomousModeEnabled: config.agentAutonomousModeEnabled,
			effectiveCommand: "claude",
			globalConfigPath: config.globalConfigPath,
			projectConfigPath: config.projectConfigPath,
			readyForReviewNotificationsEnabled: config.readyForReviewNotificationsEnabled,
			detectedCommands: ["claude"],
			agents: [],
			shortcuts: config.shortcuts,
			commitPromptTemplate: config.commitPromptTemplate,
			openPrPromptTemplate: config.openPrPromptTemplate,
			commitPromptTemplateDefault: config.commitPromptTemplateDefault,
			openPrPromptTemplateDefault: config.openPrPromptTemplateDefault,
		}));
		taskWorktreeMocks.resolveTaskCwd.mockResolvedValue("/tmp/worktree");
		turnCheckpointMocks.captureTaskTurnCheckpoint.mockResolvedValue({
			turn: 1,
			ref: "refs/shuvban/checkpoints/task-1/turn/1",
			commit: "1111111",
			createdAt: 1,
		});
	});

	it("loads runtime config through the registry response builder", async () => {
		const runtimeConfig = createRuntimeConfigState();
		const api = createRuntimeApi({
			getActiveWorkspaceId: () => "workspace-1",
			getActiveRuntimeConfig: () => runtimeConfig,
			loadScopedRuntimeConfig: vi.fn(),
			setActiveRuntimeConfig: vi.fn(),
			getScopedTerminalManager: vi.fn(),
			resolveInteractiveShellCommand: () => ({ binary: "bash", args: [] }),
			runCommand: vi.fn(),
		});

		const response = await api.loadConfig(null);
		expect(response.selectedAgentId).toBe("claude");
		expect(agentRegistryMocks.buildRuntimeConfigResponse).toHaveBeenCalledWith(runtimeConfig);
	});

	it("starts task sessions through the terminal manager and captures turn checkpoints", async () => {
		const terminalManager = createTerminalManager();
		const api = createRuntimeApi({
			getActiveWorkspaceId: () => "workspace-1",
			loadScopedRuntimeConfig: vi.fn(async () => createRuntimeConfigState()),
			setActiveRuntimeConfig: vi.fn(),
			getScopedTerminalManager: vi.fn(async () => terminalManager as never),
			resolveInteractiveShellCommand: () => ({ binary: "bash", args: [] }),
			runCommand: vi.fn(),
		});

		const response = await api.startTaskSession(
			{ workspaceId: "workspace-1", workspacePath: "/tmp/repo" },
			{ taskId: "task-1", prompt: "Investigate", baseRef: "main", cols: 120, rows: 40 },
		);

		expect(response.ok).toBe(true);
		expect(terminalManager.startTaskSession).toHaveBeenCalledWith(
			expect.objectContaining({
				taskId: "task-1",
				agentId: "claude",
				binary: "claude",
				cwd: "/tmp/worktree",
				prompt: "Investigate",
				cols: 120,
				rows: 40,
				workspaceId: "workspace-1",
			}),
		);
		expect(turnCheckpointMocks.captureTaskTurnCheckpoint).toHaveBeenCalledWith({
			cwd: "/tmp/worktree",
			taskId: "task-1",
			turn: 1,
		});
		expect(terminalManager.applyTurnCheckpoint).toHaveBeenCalled();
	});

	it("returns a friendly error when no runnable agent command is configured", async () => {
		agentRegistryMocks.resolveAgentCommand.mockReturnValue(null);
		const terminalManager = createTerminalManager();
		const api = createRuntimeApi({
			getActiveWorkspaceId: () => "workspace-1",
			loadScopedRuntimeConfig: vi.fn(async () => createRuntimeConfigState()),
			setActiveRuntimeConfig: vi.fn(),
			getScopedTerminalManager: vi.fn(async () => terminalManager as never),
			resolveInteractiveShellCommand: () => ({ binary: "bash", args: [] }),
			runCommand: vi.fn(),
		});

		const response = await api.startTaskSession(
			{ workspaceId: "workspace-1", workspacePath: "/tmp/repo" },
			{ taskId: "task-1", prompt: "Investigate", baseRef: "main", cols: 120, rows: 40 },
		);

		expect(response).toEqual({
			ok: false,
			summary: null,
			error: "No runnable agent command is configured. Open Settings, install a supported CLI, and select it.",
		});
		expect(terminalManager.startTaskSession).not.toHaveBeenCalled();
	});

	it("writes task session input to the terminal manager", async () => {
		const terminalManager = createTerminalManager();
		const api = createRuntimeApi({
			getActiveWorkspaceId: () => "workspace-1",
			loadScopedRuntimeConfig: vi.fn(async () => createRuntimeConfigState()),
			setActiveRuntimeConfig: vi.fn(),
			getScopedTerminalManager: vi.fn(async () => terminalManager as never),
			resolveInteractiveShellCommand: () => ({ binary: "bash", args: [] }),
			runCommand: vi.fn(),
		});

		const response = await api.sendTaskSessionInput(
			{ workspaceId: "workspace-1", workspacePath: "/tmp/repo" },
			{ taskId: "task-1", text: "status", appendNewline: true },
		);

		expect(response.ok).toBe(true);
		expect(terminalManager.writeInput).toHaveBeenCalled();
		const firstCall = terminalManager.writeInput.mock.calls[0] as unknown[] | undefined;
		expect(firstCall).toBeDefined();
		const buffer = firstCall?.[1];
		expect(Buffer.isBuffer(buffer)).toBe(true);
		if (!Buffer.isBuffer(buffer)) {
			throw new Error("Expected terminal input buffer.");
		}
		expect(buffer.toString("utf8")).toBe("status\n");
	});

	it("opens files in the browser helper", async () => {
		const api = createRuntimeApi({
			getActiveWorkspaceId: () => "workspace-1",
			loadScopedRuntimeConfig: vi.fn(async () => createRuntimeConfigState()),
			setActiveRuntimeConfig: vi.fn(),
			getScopedTerminalManager: vi.fn(),
			resolveInteractiveShellCommand: () => ({ binary: "bash", args: [] }),
			runCommand: vi.fn(),
		});

		await expect(api.openFile({ filePath: " /tmp/file.txt " })).resolves.toEqual({ ok: true });
		expect(browserMocks.openInBrowser).toHaveBeenCalledWith("/tmp/file.txt");
	});
});
