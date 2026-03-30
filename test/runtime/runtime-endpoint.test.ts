import { afterEach, describe, expect, it } from "vitest";

import {
	buildShuvbanRuntimeUrl,
	buildShuvbanRuntimeWsUrl,
	DEFAULT_SHUVBAN_RUNTIME_PORT,
	getShuvbanRuntimeHost,
	getShuvbanRuntimePort,
	parseRuntimePort,
	setShuvbanRuntimeHost,
	setShuvbanRuntimePort,
} from "../../src/core/runtime-endpoint";

const originalRuntimePort = getShuvbanRuntimePort();
const originalRuntimeHost = getShuvbanRuntimeHost();
const originalEnvPort = process.env.SHUVBAN_RUNTIME_PORT;
const originalEnvHost = process.env.SHUVBAN_RUNTIME_HOST;

afterEach(() => {
	setShuvbanRuntimePort(originalRuntimePort);
	setShuvbanRuntimeHost(originalRuntimeHost);
	if (originalEnvPort === undefined) {
		delete process.env.SHUVBAN_RUNTIME_PORT;
	} else {
		process.env.SHUVBAN_RUNTIME_PORT = originalEnvPort;
	}
	if (originalEnvHost === undefined) {
		delete process.env.SHUVBAN_RUNTIME_HOST;
	} else {
		process.env.SHUVBAN_RUNTIME_HOST = originalEnvHost;
	}
});

describe("runtime-endpoint", () => {
	it("parses default port when env value is missing", () => {
		expect(parseRuntimePort(undefined)).toBe(DEFAULT_SHUVBAN_RUNTIME_PORT);
	});

	it("throws for invalid ports", () => {
		expect(() => parseRuntimePort("0")).toThrow(/Invalid SHUVBAN_RUNTIME_PORT value/);
		expect(() => parseRuntimePort("70000")).toThrow(/Invalid SHUVBAN_RUNTIME_PORT value/);
		expect(() => parseRuntimePort("abc")).toThrow(/Invalid SHUVBAN_RUNTIME_PORT value/);
	});

	it("updates runtime url builders when port changes", () => {
		setShuvbanRuntimePort(4567);
		expect(getShuvbanRuntimePort()).toBe(4567);
		expect(process.env.SHUVBAN_RUNTIME_PORT).toBe("4567");
		expect(buildShuvbanRuntimeUrl("/api/trpc")).toBe("http://127.0.0.1:4567/api/trpc");
		expect(buildShuvbanRuntimeWsUrl("api/terminal/ws")).toBe("ws://127.0.0.1:4567/api/terminal/ws");
	});

	it("updates runtime url builders when host changes", () => {
		setShuvbanRuntimeHost("100.64.0.1");
		setShuvbanRuntimePort(4567);
		expect(getShuvbanRuntimeHost()).toBe("100.64.0.1");
		expect(process.env.SHUVBAN_RUNTIME_HOST).toBe("100.64.0.1");
		expect(buildShuvbanRuntimeUrl("/api/trpc")).toBe("http://100.64.0.1:4567/api/trpc");
		expect(buildShuvbanRuntimeWsUrl("api/terminal/ws")).toBe("ws://100.64.0.1:4567/api/terminal/ws");
	});

	it("defaults host to 127.0.0.1", () => {
		expect(getShuvbanRuntimeHost()).toBe("127.0.0.1");
	});
});
