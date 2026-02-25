import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Result } from "../../src/kernel/index.js";
import { ok } from "../../src/kernel/index.js";
import { AgentRunner } from "../../src/runner/AgentRunner.js";
import type { TmuxPort } from "../../src/runner/tmux.js";

class MockTmux implements TmuxPort {
	calls: { method: string; args: unknown[] }[] = [];
	captureOutput = "$ ";

	run(args: string[]): Promise<Result<string, string>> {
		this.calls.push({ method: "run", args });
		return Promise.resolve(ok(""));
	}

	hasSession(_name: string): Promise<boolean> {
		this.calls.push({ method: "hasSession", args: [_name] });
		return Promise.resolve(false);
	}

	newSession(name: string): Promise<Result<void, string>> {
		this.calls.push({ method: "newSession", args: [name] });
		return Promise.resolve(ok(undefined));
	}

	killSession(name: string): Promise<Result<void, string>> {
		this.calls.push({ method: "killSession", args: [name] });
		return Promise.resolve(ok(undefined));
	}

	splitWindow(
		session: string,
		direction: "h" | "v",
	): Promise<Result<void, string>> {
		this.calls.push({ method: "splitWindow", args: [session, direction] });
		return Promise.resolve(ok(undefined));
	}

	sendKeys(target: string, keys: string): Promise<Result<void, string>> {
		this.calls.push({ method: "sendKeys", args: [target, keys] });
		return Promise.resolve(ok(undefined));
	}

	sendText(target: string, text: string): Promise<Result<void, string>> {
		this.calls.push({ method: "sendText", args: [target, text] });
		return Promise.resolve(ok(undefined));
	}

	sendPromptFile(
		target: string,
		filePath: string,
	): Promise<Result<void, string>> {
		this.calls.push({ method: "sendPromptFile", args: [target, filePath] });
		return Promise.resolve(ok(undefined));
	}

	capturePane(target: string): Promise<Result<string, string>> {
		this.calls.push({ method: "capturePane", args: [target] });
		return Promise.resolve(ok(this.captureOutput));
	}

	selectLayout(session: string, layout: string): Promise<Result<void, string>> {
		this.calls.push({ method: "selectLayout", args: [session, layout] });
		return Promise.resolve(ok(undefined));
	}
}

let tmpDir: string;
let mockTmux: MockTmux;
let runner: AgentRunner;

beforeEach(async () => {
	tmpDir = await fs.promises.mkdtemp(
		path.join(os.tmpdir(), "crew-runner-test-"),
	);
	mockTmux = new MockTmux();
	runner = new AgentRunner(mockTmux, tmpDir, "/tmp/project");
});

afterEach(async () => {
	await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

describe("AgentRunner", () => {
	describe("createSession", () => {
		test("creates a tmux session", async () => {
			const result = await runner.createSession("myproject");
			expect(result.ok).toBe(true);
			expect(mockTmux.calls.some((c) => c.method === "newSession")).toBe(true);
		});

		test("returns error if session already exists", async () => {
			mockTmux.hasSession = () => {
				mockTmux.calls.push({ method: "hasSession", args: [] });
				return Promise.resolve(true);
			};
			const result = await runner.createSession("myproject");
			expect(result.ok).toBe(false);
		});
	});

	describe("spawn", () => {
		test("spawns a claude-code agent", async () => {
			await runner.createSession("myproject");
			const result = await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			expect(result.ok).toBe(true);

			const sendCalls = mockTmux.calls.filter((c) => c.method === "sendText");
			expect(sendCalls.length).toBeGreaterThan(0);
		});

		test("spawns a codex agent", async () => {
			await runner.createSession("myproject");
			const result = await runner.spawn(
				"implementer",
				"implementer",
				"codex",
				"gpt-5.3-codex",
			);
			expect(result.ok).toBe(true);
		});

		test("spawns claude-code agent with auto-approve flag", async () => {
			await runner.createSession("myproject");
			const result = await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
				{ autoApprove: true },
			);
			expect(result.ok).toBe(true);

			const sendCalls = mockTmux.calls.filter((c) => c.method === "sendText");
			const command = sendCalls[0]?.args[1] as string;
			expect(command).toContain("--dangerously-skip-permissions");
		});

		test("spawns codex agent with auto-approve flag", async () => {
			await runner.createSession("myproject");
			const result = await runner.spawn(
				"implementer",
				"implementer",
				"codex",
				"gpt-5.3-codex",
				{ autoApprove: true },
			);
			expect(result.ok).toBe(true);

			const sendCalls = mockTmux.calls.filter((c) => c.method === "sendText");
			const command = sendCalls[0]?.args[1] as string;
			expect(command).toContain("--full-auto");
		});

		test("spawns without auto-approve by default", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);

			const sendCalls = mockTmux.calls.filter((c) => c.method === "sendText");
			const command = sendCalls[0]?.args[1] as string;
			expect(command).not.toContain("--dangerously-skip-permissions");
			expect(command).not.toContain("--full-auto");
		});

		test("returns error for duplicate agent name", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			const result = await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			expect(result.ok).toBe(false);
		});
	});

	describe("stop", () => {
		test("stops a running agent", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			const result = await runner.stop("planner");
			expect(result.ok).toBe(true);
		});

		test("returns error for nonexistent agent", async () => {
			const result = await runner.stop("nonexistent");
			expect(result.ok).toBe(false);
		});
	});

	describe("sendNudge", () => {
		test("sends nudge to agent pane", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);

			mockTmux.calls = [];
			const result = await runner.sendNudge(
				"planner",
				"Please check task status",
			);
			expect(result.ok).toBe(true);
			expect(mockTmux.calls.some((c) => c.method === "sendText")).toBe(true);
		});
	});

	describe("getStatus", () => {
		test("detects idle status from shell prompt", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			mockTmux.captureOutput = "user@host ~ $ ";

			const result = await runner.getStatus("planner");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("idle");
		});

		test("detects idle status from Claude Code prompt (❯)", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			mockTmux.captureOutput =
				"  ⎿  Interrupted · What should Claude do instead?\n\n❯\n";

			const result = await runner.getStatus("planner");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("idle");
		});

		test("detects active status", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			mockTmux.captureOutput = "Thinking about the task...";

			const result = await runner.getStatus("planner");
			expect(result.ok).toBe(true);
			if (result.ok) expect(result.value).toBe("active");
		});
	});

	describe("setupLayout", () => {
		test("creates tiled layout for 3 agents", async () => {
			await runner.createSession("myproject");
			const result = await runner.setupLayout(3);
			expect(result.ok).toBe(true);

			const splitCalls = mockTmux.calls.filter(
				(c) => c.method === "splitWindow",
			);
			expect(splitCalls.length).toBe(2);
			expect(mockTmux.calls.some((c) => c.method === "selectLayout")).toBe(
				true,
			);
		});
	});

	describe("writeInbox", () => {
		test("writes to inbox file", async () => {
			const result = await runner.writeInbox("planner", "New task available");
			expect(result.ok).toBe(true);

			const inboxPath = path.join(tmpDir, "inbox", "planner.md");
			const content = await fs.promises.readFile(inboxPath, "utf-8");
			expect(content).toContain("New task available");
		});
	});

	describe("sendInitialPrompt", () => {
		test("writes prompt file and calls sendPromptFile", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);

			mockTmux.calls = [];
			const result = await runner.sendInitialPrompt("planner", "Do the thing");
			expect(result.ok).toBe(true);

			// Verify sendPromptFile was called with a file in tmpdir
			const promptCalls = mockTmux.calls.filter(
				(c) => c.method === "sendPromptFile",
			);
			expect(promptCalls.length).toBe(1);
			const filePath = promptCalls[0]?.args[1] as string;
			expect(filePath).toContain("agent-crew-prompts");
			expect(filePath).toEndWith("planner.md");

			// Verify prompt file content
			const content = await fs.promises.readFile(filePath, "utf-8");
			expect(content).toBe("Do the thing");
		});

		test("returns error for nonexistent agent", async () => {
			const result = await runner.sendInitialPrompt("ghost", "Hello");
			expect(result.ok).toBe(false);
		});
	});

	describe("waitForReady", () => {
		test("resolves when agent transitions active→idle", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);

			// Start active, then switch to idle after first poll
			let callCount = 0;
			mockTmux.captureOutput = "Loading claude...";
			const origCapture = mockTmux.capturePane.bind(mockTmux);
			mockTmux.capturePane = (target: string) => {
				callCount++;
				if (callCount >= 2) {
					mockTmux.captureOutput = "user@host ~ $ ";
				}
				return origCapture(target);
			};

			const result = await runner.waitForReady("planner", 5000);
			expect(result.ok).toBe(true);
		});

		test("returns error for nonexistent agent", async () => {
			const result = await runner.waitForReady("ghost", 1000);
			expect(result.ok).toBe(false);
		});
	});

	describe("destroySession", () => {
		test("destroys session and clears state", async () => {
			await runner.createSession("myproject");
			await runner.spawn(
				"planner",
				"planner",
				"claude-code",
				"claude-opus-4-6",
			);
			const result = await runner.destroySession();
			expect(result.ok).toBe(true);
		});
	});
});
