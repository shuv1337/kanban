import { describe, expect, it } from "vitest";

import { inferHookSourceFromPayload } from "../../src/commands/hooks.js";

function parseBase64Metadata(encoded: string): Record<string, unknown> {
	return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<string, unknown>;
}

describe("pi hook metadata contract", () => {
	it("round-trips tool_input_summary through base64 metadata", () => {
		const encoded = Buffer.from(
			JSON.stringify({
				source: "pi",
				hook_event_name: "tool_execution_start",
				tool_name: "read",
				tool_input_summary: "src/index.ts",
			}),
			"utf8",
		).toString("base64");

		const payload = parseBase64Metadata(encoded);
		expect(payload.tool_input_summary).toBe("src/index.ts");
		expect(inferHookSourceFromPayload(payload)).toBe("pi");
	});
});
