import { describe, expect, it } from "vitest";

import { buildShuvbanCommandParts, resolveShuvbanCommandParts } from "../../src/core/shuvban-command";

describe("resolveShuvbanCommandParts", () => {
	it("resolves node plus script entrypoint", () => {
		const parts = resolveShuvbanCommandParts({
			execPath: "/usr/local/bin/node",
			argv: ["/usr/local/bin/node", "/tmp/.npx/123/node_modules/shuvban/dist/cli.js", "--port", "9123"],
		});
		expect(parts).toEqual(["/usr/local/bin/node", "/tmp/.npx/123/node_modules/shuvban/dist/cli.js"]);
	});

	it("resolves tsx launched cli entrypoint", () => {
		const parts = resolveShuvbanCommandParts({
			execPath: "/usr/local/bin/node",
			argv: ["/usr/local/bin/node", "/repo/node_modules/tsx/dist/cli.mjs", "/repo/src/cli.ts", "--no-open"],
		});
		expect(parts).toEqual(["/usr/local/bin/node", "/repo/node_modules/tsx/dist/cli.mjs", "/repo/src/cli.ts"]);
	});

	it("preserves node execArgv for source entrypoints", () => {
		const parts = resolveShuvbanCommandParts({
			execPath: "/usr/local/bin/node",
			execArgv: ["--import", "tsx"],
			argv: ["/usr/local/bin/node", "/repo/src/cli.ts", "--no-open"],
		});
		expect(parts).toEqual(["/usr/local/bin/node", "--import", "tsx", "/repo/src/cli.ts"]);
	});

	it("falls back to execPath when no entrypoint path is available", () => {
		const parts = resolveShuvbanCommandParts({
			execPath: "/usr/local/bin/shuvban",
			argv: ["/usr/local/bin/shuvban", "hooks", "ingest"],
		});
		expect(parts).toEqual(["/usr/local/bin/shuvban"]);
	});
});

describe("buildShuvbanCommandParts", () => {
	it("appends command arguments to resolved runtime invocation", () => {
		expect(
			buildShuvbanCommandParts(["hooks", "ingest"], {
				execPath: "/usr/local/bin/node",
				argv: ["/usr/local/bin/node", "/tmp/.npx/321/node_modules/shuvban/dist/cli.js"],
			}),
		).toEqual(["/usr/local/bin/node", "/tmp/.npx/321/node_modules/shuvban/dist/cli.js", "hooks", "ingest"]);
	});
});
