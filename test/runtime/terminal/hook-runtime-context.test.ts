import { describe, expect, it } from "vitest";

import {
	createHookRuntimeEnv,
	parseHookRuntimeContextFromEnv,
	SHUVBAN_HOOK_TASK_ID_ENV,
	SHUVBAN_HOOK_WORKSPACE_ID_ENV,
	SHUVBAN_RUNTIME_HOST_ENV,
	SHUVBAN_RUNTIME_PORT_ENV,
} from "../../../src/terminal/hook-runtime-context";

describe("hook-runtime-context", () => {
	it("creates expected environment variables including runtime port and host", () => {
		const env = createHookRuntimeEnv({
			taskId: "task-1",
			workspaceId: "workspace-1",
		});
		expect(env[SHUVBAN_HOOK_TASK_ID_ENV]).toBe("task-1");
		expect(env[SHUVBAN_HOOK_WORKSPACE_ID_ENV]).toBe("workspace-1");
		expect(env[SHUVBAN_RUNTIME_PORT_ENV]).toBeDefined();
		expect(env[SHUVBAN_RUNTIME_HOST_ENV]).toBeDefined();
		// Verify port is a valid number
		const portValue = env[SHUVBAN_RUNTIME_PORT_ENV];
		expect(portValue).toBeDefined();
		expect(Number.parseInt(portValue ?? "0", 10)).toBeGreaterThan(0);
	});

	it("parses hook runtime context from env", () => {
		const parsed = parseHookRuntimeContextFromEnv({
			[SHUVBAN_HOOK_TASK_ID_ENV]: "task-2",
			[SHUVBAN_HOOK_WORKSPACE_ID_ENV]: "workspace-2",
		});
		expect(parsed).toEqual({
			taskId: "task-2",
			workspaceId: "workspace-2",
		});
	});

	it("throws when required env vars are missing", () => {
		expect(() => parseHookRuntimeContextFromEnv({})).toThrow(
			`Missing required environment variable: ${SHUVBAN_HOOK_TASK_ID_ENV}`,
		);
	});
});
