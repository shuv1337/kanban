export const DEFAULT_SHUVBAN_RUNTIME_HOST = "127.0.0.1";
export const DEFAULT_SHUVBAN_RUNTIME_PORT = 3484;

let runtimeHost: string = process.env.SHUVBAN_RUNTIME_HOST?.trim() || DEFAULT_SHUVBAN_RUNTIME_HOST;

export function getShuvbanRuntimeHost(): string {
	return runtimeHost;
}

export function setShuvbanRuntimeHost(host: string): void {
	runtimeHost = host;
	process.env.SHUVBAN_RUNTIME_HOST = host;
}

export function parseRuntimePort(rawPort: string | undefined): number {
	if (!rawPort) {
		return DEFAULT_SHUVBAN_RUNTIME_PORT;
	}
	const parsed = Number.parseInt(rawPort, 10);
	if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
		throw new Error(`Invalid SHUVBAN_RUNTIME_PORT value "${rawPort}". Expected an integer from 1-65535.`);
	}
	return parsed;
}

let runtimePort = parseRuntimePort(process.env.SHUVBAN_RUNTIME_PORT?.trim());

export function getShuvbanRuntimePort(): number {
	return runtimePort;
}

export function setShuvbanRuntimePort(port: number): void {
	const normalized = parseRuntimePort(String(port));
	runtimePort = normalized;
	process.env.SHUVBAN_RUNTIME_PORT = String(normalized);
}

export function getShuvbanRuntimeOrigin(): string {
	return `http://${getShuvbanRuntimeHost()}:${getShuvbanRuntimePort()}`;
}

export function getShuvbanRuntimeWsOrigin(): string {
	return `ws://${getShuvbanRuntimeHost()}:${getShuvbanRuntimePort()}`;
}

export function buildShuvbanRuntimeUrl(pathname: string): string {
	const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return `${getShuvbanRuntimeOrigin()}${normalizedPath}`;
}

export function buildShuvbanRuntimeWsUrl(pathname: string): string {
	const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return `${getShuvbanRuntimeWsOrigin()}${normalizedPath}`;
}
