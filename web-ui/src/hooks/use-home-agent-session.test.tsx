import { act, useCallback, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHomeAgentSession } from "@/hooks/use-home-agent-session";
import type { RuntimeConfigResponse, RuntimeGitRepositoryInfo, RuntimeTaskSessionSummary } from "@/runtime/types";

const startTaskSessionMutateMock = vi.hoisted(() => vi.fn());
const stopTaskSessionMutateMock = vi.hoisted(() => vi.fn());
const notifyErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/runtime/trpc-client", () => ({
	getRuntimeTrpcClient: (workspaceId: string | null) => ({
		runtime: {
			startTaskSession: {
				mutate: (input: object) => startTaskSessionMutateMock({ workspaceId, ...input }),
			},
			stopTaskSession: {
				mutate: (input: object) => stopTaskSessionMutateMock({ workspaceId, ...input }),
			},
		},
	}),
}));

vi.mock("@/runtime/task-session-geometry", () => ({
	estimateTaskSessionGeometry: () => ({ cols: 120, rows: 24 }),
}));

vi.mock("@/components/app-toaster", () => ({
	notifyError: notifyErrorMock,
}));

interface HookSnapshot {
	panelMode: ReturnType<typeof useHomeAgentSession>["panelMode"];
	sessionKeys: string[];
	taskId: string | null;
}

function requireSnapshot(snapshot: HookSnapshot | null): HookSnapshot {
	if (snapshot === null) {
		throw new Error("Expected a hook snapshot.");
	}
	return snapshot;
}

function createSummary(taskId: string, agentId: RuntimeTaskSessionSummary["agentId"]): RuntimeTaskSessionSummary {
	return {
		taskId,
		state: "running",
		agentId,
		workspacePath: "/tmp/repo",
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
	};
}

function createRuntimeConfig(overrides: Partial<RuntimeConfigResponse> = {}): RuntimeConfigResponse {
	const selectedAgentId = overrides.selectedAgentId ?? "codex";
	return {
		selectedAgentId,
		selectedShortcutLabel: null,
		agentAutonomousModeEnabled: true,
		effectiveCommand: overrides.effectiveCommand ?? String(selectedAgentId),
		globalConfigPath: "/tmp/global-config.json",
		projectConfigPath: "/tmp/project-config.json",
		readyForReviewNotificationsEnabled: true,
		detectedCommands: ["codex", "claude"],
		agents: [
			{
				id: "codex",
				label: "OpenAI Codex",
				binary: "codex",
				command: "codex",
				defaultArgs: [],
				installed: true,
				configured: selectedAgentId === "codex",
			},
			{
				id: "claude",
				label: "Claude Code",
				binary: "claude",
				command: "claude",
				defaultArgs: [],
				installed: true,
				configured: selectedAgentId === "claude",
			},
		],
		shortcuts: [],
		commitPromptTemplate: "commit",
		openPrPromptTemplate: "pr",
		commitPromptTemplateDefault: "commit",
		openPrPromptTemplateDefault: "pr",
		...overrides,
	};
}

const DEFAULT_WORKSPACE_GIT: RuntimeGitRepositoryInfo = {
	currentBranch: "main",
	defaultBranch: "main",
	branches: ["main"],
};

function createFlushPromises(): Promise<void> {
	return Promise.resolve().then(() => Promise.resolve());
}

function HookHarness({
	config,
	currentProjectId,
	onSnapshot,
	workspaceGit = DEFAULT_WORKSPACE_GIT,
}: {
	config: RuntimeConfigResponse | null;
	currentProjectId: string | null;
	onSnapshot: (snapshot: HookSnapshot) => void;
	workspaceGit?: RuntimeGitRepositoryInfo | null;
}): null {
	const [sessionSummaries, setSessionSummaries] = useState<Record<string, RuntimeTaskSessionSummary>>({});
	const upsertSessionSummary = useCallback((summary: RuntimeTaskSessionSummary) => {
		setSessionSummaries((currentSessions) => ({
			...currentSessions,
			[summary.taskId]: summary,
		}));
	}, []);
	const result = useHomeAgentSession({
		currentProjectId,
		runtimeProjectConfig: config,
		workspaceGit,
		sessionContextVersion: 0,
		sessionSummaries,
		setSessionSummaries,
		upsertSessionSummary,
	});

	useEffect(() => {
		onSnapshot({
			panelMode: result.panelMode,
			sessionKeys: Object.keys(sessionSummaries),
			taskId: result.taskId,
		});
	}, [onSnapshot, result.panelMode, result.taskId, sessionSummaries]);

	return null;
}

describe("useHomeAgentSession", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		startTaskSessionMutateMock.mockReset();
		stopTaskSessionMutateMock.mockReset();
		notifyErrorMock.mockReset();
		startTaskSessionMutateMock.mockImplementation(
			async ({ taskId, workspaceId }: { taskId: string; workspaceId: string }) => ({
				ok: true,
				summary: createSummary(taskId, "codex"),
				workspaceId,
			}),
		);
		stopTaskSessionMutateMock.mockResolvedValue({ ok: true, summary: null });
		previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
		} else {
			(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
				previousActEnvironment;
		}
	});

	it("starts a terminal-backed home session for the selected agent", async () => {
		let latestSnapshot: HookSnapshot | null = null;

		await act(async () => {
			root.render(
				<HookHarness
					config={createRuntimeConfig({ selectedAgentId: "codex", effectiveCommand: "codex" })}
					currentProjectId="workspace-1"
					onSnapshot={(snapshot) => {
						latestSnapshot = snapshot;
					}}
				/>,
			);
			await createFlushPromises();
		});

		const snapshot = requireSnapshot(latestSnapshot);
		expect(snapshot.panelMode).toBe("terminal");
		expect(snapshot.taskId).toContain("workspace-1");
		expect(startTaskSessionMutateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				workspaceId: "workspace-1",
				prompt: "",
				baseRef: "main",
				cols: 120,
				rows: 24,
			}),
		);
	});

	it("stops the previous home session when the selected agent changes", async () => {
		let latestSnapshot: HookSnapshot | null = null;

		await act(async () => {
			root.render(
				<HookHarness
					config={createRuntimeConfig({ selectedAgentId: "codex", effectiveCommand: "codex" })}
					currentProjectId="workspace-1"
					onSnapshot={(snapshot) => {
						latestSnapshot = snapshot;
					}}
				/>,
			);
			await createFlushPromises();
		});

		const firstTaskId = requireSnapshot(latestSnapshot).taskId;
		await act(async () => {
			root.render(
				<HookHarness
					config={createRuntimeConfig({ selectedAgentId: "claude", effectiveCommand: "claude" })}
					currentProjectId="workspace-1"
					onSnapshot={(snapshot) => {
						latestSnapshot = snapshot;
					}}
				/>,
			);
			await createFlushPromises();
		});

		const snapshot = requireSnapshot(latestSnapshot);
		expect(stopTaskSessionMutateMock).toHaveBeenCalledWith({ workspaceId: "workspace-1", taskId: firstTaskId });
		expect(snapshot.taskId).not.toBe(firstTaskId);
	});

	it("does not create a home session when no runnable command is configured", async () => {
		let latestSnapshot: HookSnapshot | null = null;

		await act(async () => {
			root.render(
				<HookHarness
					config={createRuntimeConfig({ effectiveCommand: null })}
					currentProjectId="workspace-1"
					onSnapshot={(snapshot) => {
						latestSnapshot = snapshot;
					}}
				/>,
			);
			await createFlushPromises();
		});

		expect(latestSnapshot).toEqual({
			panelMode: null,
			sessionKeys: [],
			taskId: null,
		});
		expect(startTaskSessionMutateMock).not.toHaveBeenCalled();
	});
});
