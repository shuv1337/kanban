export type TaskStatus = "todo" | "doing" | "done";

export interface KanbananaTask {
	id: string;
	title: string;
	status: TaskStatus;
}

export interface KanbananaBoard {
	name: string;
	tasks: KanbananaTask[];
}

export function createSampleBoard(name = "My Agent Board"): KanbananaBoard {
	return {
		name,
		tasks: [
			{ id: "1", title: "Define the first feature slice", status: "todo" },
			{ id: "2", title: "Ship a tiny CLI loop", status: "doing" },
			{ id: "3", title: "Add tests and CI guardrails", status: "done" },
		],
	};
}
