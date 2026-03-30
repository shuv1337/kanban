import type { RuntimeConfigResponse, RuntimeTaskChatMessage } from "@/runtime/types";

export function isTaskAgentSetupSatisfied(runtimeProjectConfig: RuntimeConfigResponse | null): boolean | null {
	if (!runtimeProjectConfig) {
		return null;
	}
	return Boolean(runtimeProjectConfig.effectiveCommand);
}

export function getTaskAgentNavbarHint(
	runtimeProjectConfig: RuntimeConfigResponse | null,
	input: { shouldUseNavigationPath: boolean },
): string | undefined {
	if (!input.shouldUseNavigationPath || !runtimeProjectConfig) {
		return undefined;
	}
	if (runtimeProjectConfig.effectiveCommand) {
		return runtimeProjectConfig.effectiveCommand;
	}
	const selectedAgent = runtimeProjectConfig.agents.find((agent) => agent.id === runtimeProjectConfig.selectedAgentId);
	if (!selectedAgent) {
		return "No runnable agent configured.";
	}
	if (selectedAgent.installed) {
		return selectedAgent.command;
	}
	return `Install ${selectedAgent.label} and select it in Settings.`;
}

export function selectTaskChatMessagesForTask(
	taskId: string | undefined,
	taskChatMessagesByTaskId: Record<string, RuntimeTaskChatMessage[]>,
): RuntimeTaskChatMessage[] {
	if (!taskId) {
		return [];
	}
	return taskChatMessagesByTaskId[taskId] ?? [];
}

export function selectLatestTaskChatMessageForTask(
	taskId: string | undefined,
	latestTaskChatMessage: { taskId: string; message: RuntimeTaskChatMessage } | null,
): RuntimeTaskChatMessage | null {
	if (!taskId || !latestTaskChatMessage || latestTaskChatMessage.taskId !== taskId) {
		return null;
	}
	return latestTaskChatMessage.message;
}
