import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { prepareAgentLaunch } from "../../../src/terminal/agent-session-adapters";
import { buildPiTaskSessionDir } from "../../../src/terminal/pi-session-paths";

const originalHome = process.env.HOME;
const originalAppData = process.env.APPDATA;
const originalLocalAppData = process.env.LOCALAPPDATA;
let tempHome: string | null = null;
const originalArgv = [...process.argv];
const originalExecArgv = [...process.execArgv];
const originalExecPath = process.execPath;

function setupTempHome(): string {
	tempHome = mkdtempSync(join(tmpdir(), "shuvban-agent-adapters-"));
	process.env.HOME = tempHome;
	return tempHome;
}

function setKanbanProcessContext(): void {
	process.argv = ["node", "/Users/example/repo/dist/cli.js"];
	process.execArgv = [];
	Object.defineProperty(process, "execPath", {
		configurable: true,
		value: "/usr/local/bin/node",
	});
}

afterEach(() => {
	if (originalHome === undefined) {
		delete process.env.HOME;
	} else {
		process.env.HOME = originalHome;
	}
	if (tempHome) {
		rmSync(tempHome, { recursive: true, force: true });
		tempHome = null;
	}
	if (originalAppData === undefined) {
		delete process.env.APPDATA;
	} else {
		process.env.APPDATA = originalAppData;
	}
	if (originalLocalAppData === undefined) {
		delete process.env.LOCALAPPDATA;
	} else {
		process.env.LOCALAPPDATA = originalLocalAppData;
	}
	process.argv = [...originalArgv];
	process.execArgv = [...originalExecArgv];
	Object.defineProperty(process, "execPath", {
		configurable: true,
		value: originalExecPath,
	});
});

describe("prepareAgentLaunch", () => {
	it("routes codex through the shuvban hook wrapper", async () => {
		setupTempHome();
		const launch = await prepareAgentLaunch({
			taskId: "task-1",
			agentId: "codex",
			binary: "codex",
			args: [],
			cwd: "/tmp",
			prompt: "",
			workspaceId: "workspace-1",
		});

		expect(launch.env.SHUVBAN_HOOK_TASK_ID).toBe("task-1");
		expect(launch.env.SHUVBAN_HOOK_WORKSPACE_ID).toBe("workspace-1");
		const launchCommand = [launch.binary ?? "", ...launch.args].join(" ");
		expect(launchCommand).toContain("hooks");
		expect(launchCommand).toContain("codex-wrapper");
		expect(launchCommand).toContain("--real-binary");
		expect(launchCommand).toContain("codex");
	});

	it("appends Shuvban sidebar instructions for home Claude sessions", async () => {
		setupTempHome();
		setKanbanProcessContext();
		const launch = await prepareAgentLaunch({
			taskId: "__home_agent__:workspace-1:claude",
			agentId: "claude",
			binary: "claude",
			args: [],
			cwd: "/tmp",
			prompt: "",
		});

		const appendPromptIndex = launch.args.indexOf("--append-system-prompt");
		expect(appendPromptIndex).toBeGreaterThanOrEqual(0);
		expect(launch.args[appendPromptIndex + 1]).toContain("Shuvban sidebar agent");
	});

	it("materializes task images for CLI prompts", async () => {
		setupTempHome();
		const launch = await prepareAgentLaunch({
			taskId: "task-images",
			agentId: "codex",
			binary: "codex",
			args: [],
			cwd: "/tmp",
			prompt: "Inspect the attached design",
			images: [
				{
					id: "img-1",
					data: Buffer.from("hello").toString("base64"),
					mimeType: "image/png",
					name: "diagram.png",
				},
			],
		});

		const initialPrompt = launch.args.at(-1) ?? "";
		expect(initialPrompt).toContain("Attached reference images:");
		expect(initialPrompt).toContain("Task:\nInspect the attached design");
		const imagePathMatch = initialPrompt.match(/1\. (.+?) \(diagram\.png\)/);
		const imagePath = imagePathMatch?.[1] ?? "";
		expect(existsSync(imagePath)).toBe(true);
		expect(readFileSync(imagePath).toString("utf8")).toBe("hello");
	});

	it("adds resume flags for supported agents", async () => {
		setupTempHome();

		const codexLaunch = await prepareAgentLaunch({
			taskId: "task-codex",
			agentId: "codex",
			binary: "codex",
			args: [],
			cwd: "/tmp",
			prompt: "",
			resumeFromTrash: true,
		});
		expect(codexLaunch.args).toEqual(expect.arrayContaining(["resume", "--last"]));

		const claudeLaunch = await prepareAgentLaunch({
			taskId: "task-claude",
			agentId: "claude",
			binary: "claude",
			args: [],
			cwd: "/tmp",
			prompt: "",
			resumeFromTrash: true,
		});
		expect(claudeLaunch.args).toContain("--continue");

		const piLaunch = await prepareAgentLaunch({
			taskId: "task-pi-resume",
			agentId: "pi",
			binary: "pi",
			args: [],
			cwd: "/tmp/repo",
			prompt: "Continue",
			workspaceId: "workspace-1",
			resumeFromTrash: true,
		});
		expect(piLaunch.args).toContain("--continue");
	});

	it("prepares pi task sessions with extension and deterministic session dirs", async () => {
		setupTempHome();
		setKanbanProcessContext();
		const launch = await prepareAgentLaunch({
			taskId: "task-pi",
			agentId: "pi",
			binary: "pi",
			args: [],
			cwd: "/tmp/repo",
			prompt: "Implement the feature",
			workspaceId: "workspace-1",
			startInPlanMode: true,
		});

		expect(launch.env.SHUVBAN_HOOK_TASK_ID).toBe("task-pi");
		expect(launch.env.SHUVBAN_HOOK_WORKSPACE_ID).toBe("workspace-1");
		expect(launch.args).toContain("-e");
		const extensionIndex = launch.args.indexOf("-e");
		const extensionPath = launch.args[extensionIndex + 1] ?? "";
		expect(extensionPath).toContain(join(homedir(), ".shuvban", "hooks", "pi", "shuvban-extension.ts"));
		expect(existsSync(extensionPath)).toBe(true);
		expect(launch.args).toContain("--session-dir");
		const sessionDir = launch.args[launch.args.indexOf("--session-dir") + 1];
		expect(sessionDir).toBe(buildPiTaskSessionDir("workspace-1", "task-pi"));
		expect(launch.args.at(-1)).toContain("Please create a plan for this task before implementing.");
	});
});
