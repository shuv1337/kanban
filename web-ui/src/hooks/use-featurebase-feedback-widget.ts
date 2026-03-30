import { useEffect, useRef } from "react";

const FEATUREBASE_SDK_ID = "featurebase-sdk";
const FEATUREBASE_SDK_SRC = "https://do.featurebase.app/js/sdk.js";
const FEATUREBASE_ORGANIZATION = "shuvban";
const FEATUREBASE_OPEN_RETRY_DELAY_MS = 50;
const FEATUREBASE_OPEN_WIDGET_MESSAGE = {
	target: "FeaturebaseWidget",
	data: {
		action: "openFeedbackWidget",
	},
} as const;

interface FeaturebaseCallbackPayload {
	action?: string;
	[key: string]: unknown;
}

type FeaturebaseCallback = (error: unknown, callback?: FeaturebaseCallbackPayload | null) => void;

interface FeaturebaseCommand {
	(command: string, payload?: unknown, callback?: FeaturebaseCallback): void;
	q?: unknown[][];
}

interface FeaturebaseWindow extends Window {
	Featurebase?: FeaturebaseCommand;
}

let featurebaseSdkLoadPromise: Promise<void> | null = null;
let isFeaturebaseFeedbackWidgetReady = false;
let isFeaturebaseFeedbackWidgetOpenRequested = false;

function ensureFeaturebaseCommand(win: FeaturebaseWindow): FeaturebaseCommand {
	if (typeof win.Featurebase === "function") {
		return win.Featurebase;
	}
	const queuedCommand: FeaturebaseCommand = (...args: unknown[]) => {
		queuedCommand.q = queuedCommand.q ?? [];
		queuedCommand.q.push(args);
	};
	win.Featurebase = queuedCommand;
	return queuedCommand;
}

function ensureFeaturebaseSdkLoaded(): Promise<void> {
	if (featurebaseSdkLoadPromise) {
		return featurebaseSdkLoadPromise;
	}

	featurebaseSdkLoadPromise = new Promise<void>((resolve, reject) => {
		const existingScript = document.getElementById(FEATUREBASE_SDK_ID) as HTMLScriptElement | null;
		if (existingScript?.dataset.loaded === "true") {
			resolve();
			return;
		}

		const script = existingScript ?? document.createElement("script");
		const handleLoad = () => {
			if (script.dataset) {
				script.dataset.loaded = "true";
			}
			resolve();
		};
		const handleError = () => {
			featurebaseSdkLoadPromise = null;
			reject(new Error("Failed to load Featurebase SDK."));
		};
		script.addEventListener("load", handleLoad, { once: true });
		script.addEventListener("error", handleError, { once: true });
		if (!existingScript) {
			script.id = FEATUREBASE_SDK_ID;
			script.src = FEATUREBASE_SDK_SRC;
			script.async = true;
			document.head.appendChild(script);
			return;
		}
		const existingScriptReadyState = (script as HTMLScriptElement & { readyState?: string }).readyState;
		if (existingScriptReadyState === "complete") {
			handleLoad();
		}
	});

	return featurebaseSdkLoadPromise;
}

function postOpenFeedbackWidgetMessage(): void {
	window.postMessage(FEATUREBASE_OPEN_WIDGET_MESSAGE, "*");
}

function flushFeaturebaseFeedbackWidgetOpenRequest(): void {
	if (!isFeaturebaseFeedbackWidgetOpenRequested || !isFeaturebaseFeedbackWidgetReady) {
		return;
	}
	isFeaturebaseFeedbackWidgetOpenRequested = false;
	postOpenFeedbackWidgetMessage();
	window.setTimeout(() => {
		postOpenFeedbackWidgetMessage();
	}, FEATUREBASE_OPEN_RETRY_DELAY_MS);
}

export function openFeaturebaseFeedbackWidget(): void {
	const win = window as FeaturebaseWindow;
	ensureFeaturebaseCommand(win);
	isFeaturebaseFeedbackWidgetOpenRequested = true;
	void ensureFeaturebaseSdkLoaded()
		.then(() => {
			flushFeaturebaseFeedbackWidgetOpenRequest();
		})
		.catch(() => {
			// Best effort only.
		});
}

export function useFeaturebaseFeedbackWidget(): void {
	const lastInitializedSignatureRef = useRef<string | null>(null);
	const signature = JSON.stringify({ organization: FEATUREBASE_ORGANIZATION, app: "shuvban" });

	useEffect(() => {
		const win = window as FeaturebaseWindow;
		ensureFeaturebaseCommand(win);
		let cancelled = false;
		void ensureFeaturebaseSdkLoaded()
			.then(() => {
				if (cancelled || lastInitializedSignatureRef.current === signature) {
					return;
				}
				const featurebase = ensureFeaturebaseCommand(win);
				lastInitializedSignatureRef.current = signature;
				isFeaturebaseFeedbackWidgetReady = false;
				featurebase(
					"initialize_feedback_widget",
					{
						organization: FEATUREBASE_ORGANIZATION,
						theme: "dark",
						locale: "en",
						metadata: {
							app: "shuvban",
						},
					},
					(_error, callback) => {
						if (callback?.action !== "widgetReady") {
							return;
						}
						isFeaturebaseFeedbackWidgetReady = true;
						flushFeaturebaseFeedbackWidgetOpenRequest();
					},
				);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [signature]);
}
