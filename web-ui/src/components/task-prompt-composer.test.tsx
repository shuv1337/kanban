import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskPromptComposer } from "@/components/task-prompt-composer";

vi.mock("@/components/task-image-strip", () => ({
	TaskImageStrip: () => null,
}));

describe("TaskPromptComposer", () => {
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
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
		} else {
			(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
				previousActEnvironment;
		}
	});

	it("allows normal text paste when image paste is disabled", async () => {
		const onValueChange = vi.fn();
		const onImagesChange = vi.fn();

		await act(async () => {
			root.render(
				<TaskPromptComposer
					value="hello"
					onValueChange={onValueChange}
					images={[]}
					onImagesChange={onImagesChange}
					allowPasteImages={false}
				/>,
			);
		});

		const textarea = container.querySelector("textarea");
		expect(textarea).toBeTruthy();

		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: {
				items: [],
				files: [],
				getData: () => "pasted text",
			},
		});

		const dispatchResult = textarea?.dispatchEvent(pasteEvent);
		expect(dispatchResult).toBe(true);
		expect(pasteEvent.defaultPrevented).toBe(false);
		expect(onImagesChange).not.toHaveBeenCalled();
	});

	it("intercepts paste only when image files are present and image paste is enabled", async () => {
		const onValueChange = vi.fn();
		const onImagesChange = vi.fn();

		await act(async () => {
			root.render(
				<TaskPromptComposer
					value="hello"
					onValueChange={onValueChange}
					images={[]}
					onImagesChange={onImagesChange}
					allowPasteImages
				/>,
			);
		});

		const textarea = container.querySelector("textarea");
		expect(textarea).toBeTruthy();

		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: {
				items: [
					{
						kind: "file",
						type: "image/png",
						getAsFile: () => new File(["image"], "paste.png", { type: "image/png" }),
					},
				],
				files: [],
				getData: () => "",
			},
		});

		textarea?.dispatchEvent(pasteEvent);
		expect(pasteEvent.defaultPrevented).toBe(true);
	});
});
