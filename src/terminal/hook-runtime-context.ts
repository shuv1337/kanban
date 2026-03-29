import { getKanbanRuntimeHost, getKanbanRuntimePort } from "../core/runtime-endpoint.js";

export const KANBAN_HOOK_TASK_ID_ENV = "KANBAN_HOOK_TASK_ID";
export const KANBAN_HOOK_WORKSPACE_ID_ENV = "KANBAN_HOOK_WORKSPACE_ID";
export const KANBAN_RUNTIME_PORT_ENV = "KANBAN_RUNTIME_PORT";
export const KANBAN_RUNTIME_HOST_ENV = "KANBAN_RUNTIME_HOST";

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
		[KANBAN_HOOK_TASK_ID_ENV]: context.taskId,
		[KANBAN_HOOK_WORKSPACE_ID_ENV]: context.workspaceId,
		[KANBAN_RUNTIME_PORT_ENV]: String(getKanbanRuntimePort()),
		[KANBAN_RUNTIME_HOST_ENV]: getKanbanRuntimeHost(),
	};
}

export function parseHookRuntimeContextFromEnv(env: NodeJS.ProcessEnv = process.env): HookRuntimeContext {
	const taskId = requireTrimmedEnv(env, KANBAN_HOOK_TASK_ID_ENV);
	const workspaceId = requireTrimmedEnv(env, KANBAN_HOOK_WORKSPACE_ID_ENV);
	return {
		taskId,
		workspaceId,
	};
}
