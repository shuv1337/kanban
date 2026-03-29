export function writeStructuredRuntimeLog(payload: Record<string, unknown>): void {
	process.stderr.write(`${JSON.stringify(payload)}\n`);
}
