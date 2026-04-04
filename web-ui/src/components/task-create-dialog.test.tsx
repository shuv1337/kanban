import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BranchSelectOption } from "@/components/branch-select-dropdown";
import { TaskCreateDialog } from "@/components/task-create-dialog";
import { LocalStorageKey } from "@/storage/local-storage-store";

vi.mock("@/components/integrations/linear-issue-picker-dialog", () => ({
	LinearIssuePickerDialog: () => null,
}));

const BRANCH_OPTIONS: BranchSelectOption[] = [{ value: "main", label: "main" }];

describe("TaskCreateDialog", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		localStorage.clear();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		localStorage.clear();
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
		} else {
			(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
				previousActEnvironment;
		}
	});

	function renderDialog(): void {
		act(() => {
			root.render(
				<TaskCreateDialog
					open
					onOpenChange={() => {}}
					prompt="Test task"
					onPromptChange={() => {}}
					images={[]}
					onImagesChange={() => {}}
					onCreate={() => null}
					onCreateAndStart={() => null}
					onCreateMultiple={() => []}
					onCreateAndStartMultiple={() => []}
					startInPlanMode={false}
					onStartInPlanModeChange={() => {}}
					autoReviewEnabled={false}
					onAutoReviewEnabledChange={() => {}}
					autoReviewMode="commit"
					onAutoReviewModeChange={() => {}}
					workspaceId="workspace-1"
					branchRef="main"
					branchOptions={BRANCH_OPTIONS}
					onBranchRefChange={() => {}}
				/>,
			);
		});
	}

	it("defaults image paste to disabled and persists the toggle", async () => {
		renderDialog();

		expect(document.body.textContent).toContain("Text paste stays normal while image paste is off.");
		expect(localStorage.getItem(LocalStorageKey.TaskImagePasteEnabled)).toBeNull();

		const label = Array.from(document.body.querySelectorAll("label")).find((element) =>
			element.textContent?.includes("Enable image paste with"),
		);
		expect(label).toBeDefined();

		const toggleButton = label?.querySelector("button");
		expect(toggleButton).toBeDefined();

		await act(async () => {
			toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});

		expect(localStorage.getItem(LocalStorageKey.TaskImagePasteEnabled)).toBe("true");
		expect(document.body.textContent).toContain("Clipboard image paste is enabled via");
	});
});
