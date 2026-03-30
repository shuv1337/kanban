// Telemetry removed for Shuvban fork.

export function captureNodeException(_error: unknown, _options?: { area?: string }): void {
	// No-op: telemetry disabled.
}

export async function flushNodeTelemetry(_timeoutMs = 2_000): Promise<void> {
	// No-op: telemetry disabled.
}

export function isNodeSentryEnabled(): boolean {
	return false;
}
