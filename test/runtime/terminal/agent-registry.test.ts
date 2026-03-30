import { beforeEach, describe, expect, it, vi } from "vitest";

const commandDiscoveryMocks = vi.hoisted(() => ({
	isBinaryAvailableOnPath: vi.fn(),
}));

vi.mock("../../../src/terminal/command-discovery.js", () => ({
	isBinaryAvailableOnPath: commandDiscoveryMocks.isBinaryAvailableOnPath,
}));

import type { RuntimeConfigState } from "../../../src/config/runtime-config";
import {
	buildRuntimeConfigResponse,
	detectInstalledCommands,
	resolveAgentCommand,
} from "../../../src/terminal/agent-registry";

function createRuntimeConfigState(overrides: Partial<RuntimeConfigState> = {}): RuntimeConfigState {
	return {
		globalConfigPath: "/tmp/global-config.json",
		projectConfigPath: "/tmp/project-config.json",
		selectedAgentId: "claude",
		selectedShortcutLabel: null,
		agentAutonomousModeEnabled: true,
		readyForReviewNotificationsEnabled: true,
		shortcuts: [],
		commitPromptTemplate: "commit",
		openPrPromptTemplate: "pr",
		commitPromptTemplateDefault: "commit",
		openPrPromptTemplateDefault: "pr",
		...overrides,
	};
}

beforeEach(() => {
	commandDiscoveryMocks.isBinaryAvailableOnPath.mockReset();
	commandDiscoveryMocks.isBinaryAvailableOnPath.mockReturnValue(false);
	delete process.env.SHUVBAN_DEBUG_MODE;
	delete process.env.DEBUG_MODE;
	delete process.env.debug_mode;
});

describe("agent-registry", () => {
	it("detects installed commands from the inherited PATH", () => {
		commandDiscoveryMocks.isBinaryAvailableOnPath.mockImplementation((binary: string) => binary === "claude");

		const detected = detectInstalledCommands();

		expect(detected).toContain("claude");
		expect(detected).not.toContain("codex");
	});

	it("treats shell-only agents as unavailable", () => {
		commandDiscoveryMocks.isBinaryAvailableOnPath.mockImplementation((binary: string) => binary === "npx");

		const resolved = resolveAgentCommand(createRuntimeConfigState({ selectedAgentId: "claude" }));

		expect(resolved).toBeNull();
	});

	it("detects pi when it is available on PATH", () => {
		commandDiscoveryMocks.isBinaryAvailableOnPath.mockImplementation((binary: string) => binary === "pi");

		const detected = detectInstalledCommands();
		const resolved = resolveAgentCommand(createRuntimeConfigState({ selectedAgentId: "pi" }));

		expect(detected).toContain("pi");
		expect(resolved?.agentId).toBe("pi");
		expect(resolved?.binary).toBe("pi");
	});
});

describe("buildRuntimeConfigResponse", () => {
	it("returns only launch-supported agents", () => {
		const response = buildRuntimeConfigResponse(createRuntimeConfigState({ agentAutonomousModeEnabled: true }));

		expect(response.agentAutonomousModeEnabled).toBe(true);
		expect(response.agents.map((agent) => agent.id)).toEqual(["claude", "codex", "pi"]);
		expect(response.agents.find((agent) => agent.id === "claude")?.defaultArgs).toEqual([]);
		expect(response.agents.find((agent) => agent.id === "codex")?.defaultArgs).toEqual([]);
		expect(response.agents.find((agent) => agent.id === "pi")?.defaultArgs).toEqual([]);
	});

	it("sets debug mode from runtime environment variables", () => {
		process.env.SHUVBAN_DEBUG_MODE = "true";
		const response = buildRuntimeConfigResponse(createRuntimeConfigState());
		expect(response.debugModeEnabled).toBe(true);
	});

	it("supports debug_mode fallback env name", () => {
		process.env.debug_mode = "1";
		const response = buildRuntimeConfigResponse(createRuntimeConfigState());
		expect(response.debugModeEnabled).toBe(true);
	});
});
