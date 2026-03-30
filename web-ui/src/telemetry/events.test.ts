import { describe, expect, it } from "vitest";

import {
	toTelemetrySelectedAgentId,
	trackTaskCreated,
	trackTaskDependencyCreated,
	trackTaskResumedFromTrash,
	trackTasksAutoStartedFromDependency,
} from "@/telemetry/events";

describe("telemetry events (disabled)", () => {
	it("no-op functions do not throw", () => {
		expect(() =>
			trackTaskCreated({
				selected_agent_id: "unknown",
				start_in_plan_mode: true,
				auto_review_mode: "pr",
				prompt_character_count: 42,
			}),
		).not.toThrow();

		expect(() => trackTaskDependencyCreated()).not.toThrow();
		expect(() => trackTasksAutoStartedFromDependency(3)).not.toThrow();
		expect(() => trackTaskResumedFromTrash()).not.toThrow();
	});

	it("normalizes nullable agent ids for telemetry", () => {
		expect(toTelemetrySelectedAgentId("codex")).toBe("codex");
		expect(toTelemetrySelectedAgentId("pi")).toBe("pi");
		expect(toTelemetrySelectedAgentId(null)).toBe("unknown");
		expect(toTelemetrySelectedAgentId(undefined)).toBe("unknown");
	});
});
