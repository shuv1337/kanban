import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeConfigResponse } from "@/runtime/types";
import { type UseRuntimeConfigResult, useRuntimeConfig } from "@/runtime/use-runtime-config";

const fetchRuntimeConfigMock = vi.hoisted(() => vi.fn());

vi.mock("@/runtime/runtime-config-query", () => ({
	fetchRuntimeConfig: fetchRuntimeConfigMock,
	saveRuntimeConfig: vi.fn(),
}));

type HookSnapshot = UseRuntimeConfigResult;

function requireSnapshot(snapshot: HookSnapshot | null): HookSnapshot {
	if (snapshot === null) {
		throw new Error("Expected a runtime config snapshot.");
	}
	return snapshot;
}

function createRuntimeConfigResponse(selectedAgentId: RuntimeConfigResponse["selectedAgentId"]): RuntimeConfigResponse {
	return {
		selectedAgentId,
		selectedShortcutLabel: null,
		agentAutonomousModeEnabled: true,
		effectiveCommand: selectedAgentId,
		globalConfigPath: "/tmp/global-config.json",
		projectConfigPath: "/tmp/project/.shuvban/config.json",
		readyForReviewNotificationsEnabled: true,
		detectedCommands: [selectedAgentId],
		agents: [
			{
				id: "claude",
				label: "Claude Code",
				binary: "claude",
				command: "claude",
				defaultArgs: [],
				installed: selectedAgentId === "claude",
				configured: selectedAgentId === "claude",
			},
			{
				id: "codex",
				label: "OpenAI Codex",
				binary: "codex",
				command: "codex",
				defaultArgs: [],
				installed: selectedAgentId === "codex",
				configured: selectedAgentId === "codex",
			},
		],
		shortcuts: [],
		commitPromptTemplate: "",
		openPrPromptTemplate: "",
		commitPromptTemplateDefault: "",
		openPrPromptTemplateDefault: "",
	};
}

function HookHarness({
	open,
	workspaceId,
	initialConfig,
	onSnapshot,
}: {
	open: boolean;
	workspaceId: string | null;
	initialConfig?: RuntimeConfigResponse | null;
	onSnapshot: (snapshot: HookSnapshot) => void;
}): null {
	const snapshot = useRuntimeConfig(open, workspaceId, initialConfig);

	useEffect(() => {
		onSnapshot(snapshot);
	}, [onSnapshot, snapshot]);

	return null;
}

describe("useRuntimeConfig", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		fetchRuntimeConfigMock.mockReset();
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

	it("seeds the dialog with initial config and refreshes when opened", async () => {
		const initialConfig = createRuntimeConfigResponse("claude");
		const refreshedConfig = createRuntimeConfigResponse("codex");
		fetchRuntimeConfigMock.mockResolvedValue(refreshedConfig);
		let latestSnapshot: HookSnapshot | null = null;

		await act(async () => {
			root.render(
				<HookHarness
					open
					workspaceId="workspace-1"
					initialConfig={initialConfig}
					onSnapshot={(snapshot) => {
						latestSnapshot = snapshot;
					}}
				/>,
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(requireSnapshot(latestSnapshot).config?.selectedAgentId).toBe("codex");
		expect(fetchRuntimeConfigMock).toHaveBeenCalledWith("workspace-1");
	});
});
