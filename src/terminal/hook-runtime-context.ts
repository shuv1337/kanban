import { getShuvbanRuntimeHost, getShuvbanRuntimePort } from "../core/runtime-endpoint.js";

export const SHUVBAN_HOOK_TASK_ID_ENV = "SHUVBAN_HOOK_TASK_ID";
export const SHUVBAN_HOOK_WORKSPACE_ID_ENV = "SHUVBAN_HOOK_WORKSPACE_ID";
export const SHUVBAN_RUNTIME_PORT_ENV = "SHUVBAN_RUNTIME_PORT";
export const SHUVBAN_RUNTIME_HOST_ENV = "SHUVBAN_RUNTIME_HOST";

export interface HookRuntimeContext {
	taskId: string;
	workspaceId: string;
}

function requireTrimmedEnv(env: NodeJS.ProcessEnv, key: string): string {
	const value = env[key]?.trim();
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export function createHookRuntimeEnv(context: HookRuntimeContext): Record<string, string> {
	return {
		[SHUVBAN_HOOK_TASK_ID_ENV]: context.taskId,
		[SHUVBAN_HOOK_WORKSPACE_ID_ENV]: context.workspaceId,
		[SHUVBAN_RUNTIME_PORT_ENV]: String(getShuvbanRuntimePort()),
		[SHUVBAN_RUNTIME_HOST_ENV]: getShuvbanRuntimeHost(),
	};
}

export function parseHookRuntimeContextFromEnv(env: NodeJS.ProcessEnv = process.env): HookRuntimeContext {
	const taskId = requireTrimmedEnv(env, SHUVBAN_HOOK_TASK_ID_ENV);
	const workspaceId = requireTrimmedEnv(env, SHUVBAN_HOOK_WORKSPACE_ID_ENV);
	return {
		taskId,
		workspaceId,
	};
}
