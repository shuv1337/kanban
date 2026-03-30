import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CardDetailView } from "@/components/card-detail-view";
import { TERMINAL_THEME_COLORS } from "@/terminal/theme-colors";
import type { BoardCard, BoardColumn, CardSelection } from "@/types";

const mockUseRuntimeWorkspaceChanges = vi.fn();
const { mockAgentTerminalPanel, mockDiffViewerPanel } = vi.hoisted(() => ({
	mockAgentTerminalPanel: vi.fn((_props: { panelBackgroundColor?: string; terminalBackgroundColor?: string }) => null),
	mockDiffViewerPanel: vi.fn((..._args: unknown[]) => null),
}));

vi.mock("react-hotkeys-hook", () => ({
	useHotkeys: () => {},
}));

vi.mock("@/components/detail-panels/agent-terminal-panel", () => ({
	AgentTerminalPanel: mockAgentTerminalPanel,
}));

vi.mock("@/components/detail-panels/column-context-panel", () => ({
	ColumnContextPanel: () => <div data-testid="column-context-panel" />,
}));

vi.mock("@/components/detail-panels/diff-viewer-panel", () => ({
	DiffViewerPanel: (props: unknown) => {
		mockDiffViewerPanel(props);
		return <div data-testid="diff-viewer-panel" />;
	},
}));

vi.mock("@/components/detail-panels/file-tree-panel", () => ({
	FileTreePanel: () => <div data-testid="file-tree-panel" />,
}));

vi.mock("@/components/resizable-bottom-pane", () => ({
	ResizableBottomPane: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/runtime/use-runtime-workspace-changes", () => ({
	useRuntimeWorkspaceChanges: (...args: unknown[]) => mockUseRuntimeWorkspaceChanges(...args),
}));

vi.mock("@/stores/workspace-metadata-store", () => ({
	useTaskWorkspaceStateVersionValue: () => 0,
}));

function createCard(id: string): BoardCard {
	return {
		id,
		prompt: `Task ${id}`,
		startInPlanMode: false,
		autoReviewEnabled: false,
		autoReviewMode: "commit",
		baseRef: "main",
		createdAt: 1,
		updatedAt: 1,
	};
}

function createSelection(): CardSelection {
	const card = createCard("task-1");
	const columns: BoardColumn[] = [
		{ id: "backlog", title: "Backlog", cards: [card] },
		{ id: "in_progress", title: "In Progress", cards: [] },
		{ id: "review", title: "Review", cards: [] },
		{ id: "trash", title: "Trash", cards: [] },
	];
	return {
		card,
		column: columns[0]!,
		allColumns: columns,
	};
}

type MockedDiffViewerProps = {
	onAddToTerminal?: (formatted: string) => void;
	onSendToTerminal?: (formatted: string) => void;
};

function getLastMockFirstArg<T>(mockFn: { mock: { calls: unknown[][] } }): T {
	const lastCall = mockFn.mock.calls.at(-1);
	expect(lastCall).toBeDefined();
	return lastCall?.[0] as T;
}

describe("CardDetailView", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		mockAgentTerminalPanel.mockClear();
		mockDiffViewerPanel.mockClear();
		mockUseRuntimeWorkspaceChanges.mockReturnValue({
			changes: {
				files: [
					{
						path: "src/example.ts",
						status: "modified",
						additions: 1,
						deletions: 0,
						oldText: "before\n",
						newText: "after\n",
					},
				],
			},
			isRuntimeAvailable: true,
		});
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		mockUseRuntimeWorkspaceChanges.mockReset();
		mockAgentTerminalPanel.mockClear();
		mockDiffViewerPanel.mockClear();
		vi.restoreAllMocks();
		container.remove();
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
		} else {
			(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
				previousActEnvironment;
		}
	});

	it("renders the terminal panel for the selected task", async () => {
		await act(async () => {
			root.render(
				<CardDetailView
					selection={createSelection()}
					currentProjectId="workspace-1"
					selectedAgentId="claude"
					sessionSummary={null}
					taskSessions={{}}
					onSessionSummary={() => {}}
					onCardSelect={() => {}}
					onTaskDragEnd={() => {}}
					onMoveToTrash={() => {}}
					bottomTerminalOpen={false}
					bottomTerminalTaskId={null}
					bottomTerminalSummary={null}
					onBottomTerminalClose={() => {}}
				/>,
			);
		});

		expect(mockAgentTerminalPanel).toHaveBeenCalled();
		const props = getLastMockFirstArg<{ panelBackgroundColor?: string; terminalBackgroundColor?: string }>(
			mockAgentTerminalPanel,
		);
		expect(props.panelBackgroundColor).toBe(TERMINAL_THEME_COLORS.surfacePrimary);
		expect(props.terminalBackgroundColor).toBe(TERMINAL_THEME_COLORS.surfacePrimary);
	});

	it("collapses the expanded diff on Escape without closing the detail view", async () => {
		await act(async () => {
			root.render(
				<CardDetailView
					selection={createSelection()}
					currentProjectId="workspace-1"
					sessionSummary={null}
					taskSessions={{}}
					onSessionSummary={() => {}}
					onCardSelect={() => {}}
					onTaskDragEnd={() => {}}
					onMoveToTrash={() => {}}
					bottomTerminalOpen={false}
					bottomTerminalTaskId={null}
					bottomTerminalSummary={null}
					onBottomTerminalClose={() => {}}
				/>,
			);
		});

		const expandButton = container.querySelector('button[aria-label="Expand split diff view"]');
		expect(expandButton).toBeInstanceOf(HTMLButtonElement);
		if (!(expandButton instanceof HTMLButtonElement)) {
			throw new Error("Expected an expand diff button.");
		}

		await act(async () => {
			expandButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
			expandButton.click();
		});

		expect(container.querySelector('button[aria-label="Collapse expanded diff view"]')).not.toBeNull();

		await act(async () => {
			window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
		});

		expect(container.querySelector('button[aria-label="Collapse expanded diff view"]')).toBeNull();
	});

	it("routes diff review comment actions through terminal callbacks", async () => {
		const onAddReviewComments = vi.fn();
		const onSendReviewComments = vi.fn();

		await act(async () => {
			root.render(
				<CardDetailView
					selection={createSelection()}
					currentProjectId="workspace-1"
					sessionSummary={null}
					taskSessions={{}}
					onSessionSummary={() => {}}
					onCardSelect={() => {}}
					onTaskDragEnd={() => {}}
					onMoveToTrash={() => {}}
					onAddReviewComments={onAddReviewComments}
					onSendReviewComments={onSendReviewComments}
					bottomTerminalOpen={false}
					bottomTerminalTaskId={null}
					bottomTerminalSummary={null}
					onBottomTerminalClose={() => {}}
				/>,
			);
		});

		const diffProps = getLastMockFirstArg<MockedDiffViewerProps>(mockDiffViewerPanel);
		diffProps.onAddToTerminal?.("src/example.ts:4 | value\n> Add tests");
		diffProps.onSendToTerminal?.("src/example.ts:8 | done\n> Ship this");

		expect(onAddReviewComments).toHaveBeenCalledWith("task-1", "src/example.ts:4 | value\n> Add tests");
		expect(onSendReviewComments).toHaveBeenCalledWith("task-1", "src/example.ts:8 | done\n> Ship this");
	});
});
