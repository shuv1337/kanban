import { join } from "node:path";

import { getRuntimeHomePath } from "../state/workspace-state.js";

const PI_TASK_SESSIONS_DIR = "sessions";

export function encodePathSegment(value: string): string {
	return Buffer.from(value.trim(), "utf8").toString("base64url");
}

export function getPiTaskSessionsRootPath(): string {
	return join(getRuntimeHomePath(), "hooks", "pi", PI_TASK_SESSIONS_DIR);
}

export function buildPiTaskSessionDir(workspaceId: string, taskId: string): string {
	return join(getPiTaskSessionsRootPath(), encodePathSegment(workspaceId), encodePathSegment(taskId));
}
