import { ImagePlus, Paperclip } from "lucide-react";
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	ACCEPTED_TASK_IMAGE_INPUT_ACCEPT,
	collectImageFilesFromDataTransfer,
	extractImagesFromDataTransfer,
	fileToTaskImage,
} from "@/components/task-image-input-utils";
import { TaskImageStrip } from "@/components/task-image-strip";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { TaskImage } from "@/types";

const TEXTAREA_MAX_HEIGHT = 200;

interface TaskPromptComposerProps {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	images?: TaskImage[];
	onImagesChange?: (images: TaskImage[]) => void;
	onSubmit?: () => void;
	onSubmitAndStart?: () => void;
	onEscape?: () => void;
	placeholder?: string;
	disabled?: boolean;
	enabled?: boolean;
	autoFocus?: boolean;
	workspaceId?: string | null;
	showAttachImageButton?: boolean;
	allowPasteImages?: boolean;
}

export function TaskPromptComposer({
	id,
	value,
	onValueChange,
	images = [],
	onImagesChange,
	onSubmit,
	onSubmitAndStart,
	onEscape,
	placeholder,
	disabled,
	enabled = true,
	autoFocus = false,
	workspaceId: _workspaceId = null,
	showAttachImageButton = true,
	allowPasteImages = true,
}: TaskPromptComposerProps): ReactElement {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);

	const autoResizeTextarea = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
	}, []);

	useEffect(() => {
		autoResizeTextarea();
	}, [autoResizeTextarea, value]);

	useEffect(() => {
		if (!autoFocus || disabled || !enabled) {
			return;
		}
		window.requestAnimationFrame(() => {
			if (!textareaRef.current) {
				return;
			}
			const cursor = textareaRef.current.value.length;
			textareaRef.current.focus();
			textareaRef.current.setSelectionRange(cursor, cursor);
		});
	}, [autoFocus, disabled, enabled]);

	const handleTextareaKeyDown = useCallback(
		(event: KeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				if (event.shiftKey) {
					if (onSubmitAndStart) {
						onSubmitAndStart();
						return;
					}
				}
				onSubmit?.();
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				onEscape?.();
			}
		},
		[onEscape, onSubmit, onSubmitAndStart],
	);

	const appendImages = useCallback(
		(newImages: TaskImage[]) => {
			if (!onImagesChange || newImages.length === 0) {
				return;
			}
			onImagesChange([...images, ...newImages]);
		},
		[images, onImagesChange],
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLTextAreaElement>) => {
			if (!enabled || disabled || !onImagesChange || !allowPasteImages) {
				return;
			}
			const imageFiles = collectImageFilesFromDataTransfer(event.clipboardData);
			if (imageFiles.length === 0) {
				return;
			}
			event.preventDefault();
			void (async () => {
				const pastedImages = await extractImagesFromDataTransfer(event.clipboardData);
				if (pastedImages.length === 0) {
					return;
				}
				appendImages(pastedImages);
			})();
		},
		[allowPasteImages, appendImages, disabled, enabled, onImagesChange],
	);

	const handleDrop = useCallback(
		async (event: DragEvent<HTMLTextAreaElement>) => {
			event.preventDefault();
			setIsDragOver(false);
			if (!enabled || disabled || !onImagesChange) {
				return;
			}
			const droppedImages = await extractImagesFromDataTransfer(event.dataTransfer);
			if (droppedImages.length > 0) {
				appendImages(droppedImages);
				return;
			}
			const files = collectImageFilesFromDataTransfer(event.dataTransfer);
			if (files.length === 0) {
				return;
			}
			const materialized = (await Promise.all(files.map((file) => fileToTaskImage(file)))).filter(
				(image): image is TaskImage => image !== null,
			);
			appendImages(materialized);
		},
		[appendImages, disabled, enabled, onImagesChange],
	);

	const handleDragOver = useCallback(
		(event: DragEvent<HTMLTextAreaElement>) => {
			if (!enabled || disabled || !onImagesChange) {
				return;
			}
			if (collectImageFilesFromDataTransfer(event.dataTransfer).length > 0) {
				event.preventDefault();
				setIsDragOver(true);
			}
		},
		[disabled, enabled, onImagesChange],
	);

	const handleDragLeave = useCallback(() => {
		setIsDragOver(false);
	}, []);

	const handleTextareaChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange],
	);

	const handleAttachButtonClick = useCallback(() => {
		if (disabled || !enabled || !onImagesChange) {
			return;
		}
		fileInputRef.current?.click();
	}, [disabled, enabled, onImagesChange]);

	const handleFileInputChange = useCallback(
		async (event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files ?? []);
			event.target.value = "";
			if (!onImagesChange || files.length === 0) {
				return;
			}
			const nextImages = (await Promise.all(files.map((file) => fileToTaskImage(file)))).filter(
				(image): image is TaskImage => image !== null,
			);
			appendImages(nextImages);
		},
		[appendImages, onImagesChange],
	);

	return (
		<div className="flex flex-col gap-2">
			<div
				className={cn(
					"rounded-md border bg-surface-2 transition-colors",
					isDragOver ? "border-accent" : "border-border",
					disabled || !enabled ? "opacity-60" : undefined,
				)}
			>
				<textarea
					id={id}
					ref={textareaRef}
					value={value}
					onChange={handleTextareaChange}
					onKeyDown={handleTextareaKeyDown}
					onPaste={handlePaste}
					onDrop={handleDrop}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					placeholder={placeholder}
					disabled={disabled || !enabled}
					rows={1}
					className="min-h-[42px] w-full resize-none bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
				/>
			</div>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					{showAttachImageButton ? (
						<>
							<input
								ref={fileInputRef}
								type="file"
								accept={ACCEPTED_TASK_IMAGE_INPUT_ACCEPT}
								multiple
								onChange={handleFileInputChange}
								className="hidden"
							/>
							<Button
								variant="ghost"
								size="sm"
								icon={<ImagePlus size={14} />}
								onClick={handleAttachButtonClick}
								disabled={disabled || !enabled || !onImagesChange}
							>
								Attach image
							</Button>
						</>
					) : null}
					{images.length > 0 ? (
						<div className="flex items-center gap-1 text-xs text-text-secondary">
							<Paperclip size={12} />
							<span>{images.length} attached</span>
						</div>
					) : null}
				</div>
			</div>
			{images.length > 0 && onImagesChange ? (
				<TaskImageStrip
					images={images}
					onRemoveImage={(imageId) => onImagesChange(images.filter((image) => image.id !== imageId))}
				/>
			) : null}
		</div>
	);
}
