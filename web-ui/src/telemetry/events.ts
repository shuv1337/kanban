// Telemetry removed for Shuvban fork. Functions kept as no-ops to avoid churn at call sites.

import type { RuntimeAgentId } from "@/runtime/types";
import type { TaskAutoReviewMode } from "@/types";

export type TelemetrySelectedAgentId = RuntimeAgentId | "unknown";

export function toTelemetrySelectedAgentId(agentId: RuntimeAgentId | null | undefined): TelemetrySelectedAgentId {
	return agentId ?? "unknown";
}

export function trackTaskCreated(_properties: {
	selected_agent_id: TelemetrySelectedAgentId;
	start_in_plan_mode: boolean;
	auto_review_mode?: TaskAutoReviewMode;
	prompt_character_count: number;
}): void {}

export function trackTaskDependencyCreated(): void {}

export function trackTasksAutoStartedFromDependency(_startedTaskCount: number): void {}

export function trackTaskResumedFromTrash(): void {}
