// Telemetry removed for Shuvban fork.

export const posthogApiKey: string | null = null;
export const posthogHost: string | null = null;
export const posthogOptions = {};

export function isTelemetryEnabled(): boolean {
	return false;
}
