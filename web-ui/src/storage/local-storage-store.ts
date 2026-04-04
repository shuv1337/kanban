export enum LocalStorageKey {
	TaskStartInPlanMode = "shuvban.task-start-in-plan-mode",
	TaskAutoReviewEnabled = "shuvban.task-auto-review-enabled",
	TaskAutoReviewMode = "shuvban.task-auto-review-mode",
	TaskCreatePrimaryStartAction = "shuvban.task-create-primary-start-action",
	TaskImagePasteEnabled = "shuvban.task-image-paste-enabled",
	BottomTerminalPaneHeight = "shuvban.bottom-terminal-pane-height",
	ProjectNavigationPanelWidth = "kb-sidebar-width",
	ProjectNavigationPanelCollapsed = "shuvban.project-navigation-panel-collapsed",
	OnboardingDialogShown = "shuvban.onboarding.dialog.shown",
	NotificationPermissionPrompted = "shuvban.notifications.permission-prompted",
	PreferredOpenTarget = "shuvban.preferred-open-target",
	NotificationBadgeClearEvent = "shuvban.notification-badge-clear.v1",
	TabVisibilityPresence = "shuvban.tab-visibility-presence.v1",
}

function getLocalStorage(): Storage | null {
	if (typeof window === "undefined") {
		return null;
	}
	return window.localStorage;
}

export function readLocalStorageItem(key: LocalStorageKey): string | null {
	const storage = getLocalStorage();
	if (!storage) {
		return null;
	}
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

export function writeLocalStorageItem(key: LocalStorageKey, value: string): void {
	const storage = getLocalStorage();
	if (!storage) {
		return;
	}
	try {
		storage.setItem(key, value);
	} catch {
		// Ignore storage write failures.
	}
}
