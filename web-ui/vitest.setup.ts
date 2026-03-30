class MockIntersectionObserver implements IntersectionObserver {
	readonly root: Element | Document | null = null;
	readonly rootMargin = "";
	readonly thresholds = [0];

	disconnect(): void {}

	observe(_target: Element): void {}

	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}

	unobserve(_target: Element): void {}
}

class InMemoryStorage implements Storage {
	private readonly map = new Map<string, string>();

	get length(): number {
		return this.map.size;
	}

	clear(): void {
		this.map.clear();
	}

	getItem(key: string): string | null {
		return this.map.has(key) ? (this.map.get(key) ?? null) : null;
	}

	key(index: number): string | null {
		return Array.from(this.map.keys())[index] ?? null;
	}

	removeItem(key: string): void {
		this.map.delete(key);
	}

	setItem(key: string, value: string): void {
		this.map.set(String(key), String(value));
	}
}

const testLocalStorage = new InMemoryStorage();

Object.defineProperty(globalThis, "IntersectionObserver", {
	writable: true,
	configurable: true,
	value: MockIntersectionObserver,
});

Object.defineProperty(globalThis, "localStorage", {
	writable: true,
	configurable: true,
	value: testLocalStorage,
});

if (typeof window !== "undefined") {
	Object.defineProperty(window, "localStorage", {
		writable: true,
		configurable: true,
		value: testLocalStorage,
	});
}
