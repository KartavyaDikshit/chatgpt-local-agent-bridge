import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const bridgePort = 18787;
const mockPort = 11234;
const token = "smoke-test-local-token";
const workspace = path.join(os.tmpdir(), `chatgpt-local-agent-bridge-smoke-${process.pid}`);

let bridge: ChildProcess | undefined;
let mock: http.Server | undefined;
let bridgeOutput = "";

try {
  await fs.mkdir(workspace, { recursive: true });
  await fs.writeFile(path.join(workspace, "hello.txt"), "hello from sandbox", "utf8");
  mock = await startMockLmStudio();
  bridge = startBridge();
  await waitForStatus();

  await assertStatus();
  await assertUnauthorized();
  await assertLmStudio();
  await assertWorkspaceTools();
  await assertAllowedCommand();
  await assertTasks();

  console.log("SMOKE_OK");
} finally {
  bridge?.kill();
  mock?.close();
}

function startBridge(): ChildProcess {
  const child = spawn(process.execPath, ["dist/src/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(bridgePort),
      BRIDGE_AUTH_TOKEN: token,
      LOCAL_BRIDGE_WORKSPACE: workspace,
      LMSTUDIO_BASE_URL: `http://127.0.0.1:${mockPort}/v1`,
      ALLOWED_COMMANDS_CONFIG: "./config/allowed_commands.example.json",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    bridgeOutput += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    bridgeOutput += chunk.toString();
  });
  return child;
}

async function startMockLmStudio(): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/v1/models") {
      send(res, 200, { data: [{ id: "mock-local-model" }] });
      return;
    }
    if (req.url === "/v1/chat/completions") {
      send(res, 200, {
        choices: [{ message: { role: "assistant", content: "mock response" } }],
      });
      return;
    }
    send(res, 404, { error: "not found" });
  });
  server.listen(mockPort, "127.0.0.1");
  await once(server, "listening");
  return server;
}

async function waitForStatus(): Promise<void> {
  for (let index = 0; index < 40; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${bridgePort}/status`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Bridge did not start. Output: ${bridgeOutput.slice(-2_000)}`);
}

async function assertStatus(): Promise<void> {
  const body = await get("/status", false);
  assert(body.ok === true, "status ok");
  assert(body.auth_required === true, "auth required");
}

async function assertUnauthorized(): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${bridgePort}/list_workspace`);
  assert(response.status === 401, "unauthorized request rejected");
}

async function assertLmStudio(): Promise<void> {
  const health = await get("/lmstudio_health");
  assert(health.reachable === true, "lmstudio health reachable");
  const models = await get("/lmstudio_models");
  assert(Array.isArray(models.data), "lmstudio models array");
  const answer = await post("/lmstudio_ask", { prompt: "hello" });
  assert(answer.choices?.[0]?.message?.content === "mock response", "lmstudio ask mock");
}

async function assertWorkspaceTools(): Promise<void> {
  const list = await get("/list_workspace");
  assert(list.entries.some((entry: { name: string }) => entry.name === "hello.txt"), "workspace list");
  const read = await get("/read_file?path=hello.txt");
  assert(read.content.includes("hello from sandbox"), "workspace read");
  const write = await post("/write_note", { path: "notes/demo.md", content: "demo note" });
  assert(write.path === "notes/demo.md", "write note");
}

async function assertAllowedCommand(): Promise<void> {
  const result = await post("/run_allowed_script", { command_id: "node_version" });
  assert(result.exit_code === 0, "allowed command exit");
  assert(String(result.stdout).startsWith("v"), "allowed command stdout");
}

async function assertTasks(): Promise<void> {
  const task = await post("/submit_task", { action: "list_workspace" });
  assert(task.id, "task id");
  for (let index = 0; index < 20; index += 1) {
    const status = await get(`/task_status?id=${encodeURIComponent(task.id)}`);
    if (status.status === "completed") return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Task did not complete.");
}

async function get(pathname: string, auth = true) {
  const response = await fetch(`http://127.0.0.1:${bridgePort}${pathname}`, {
    headers: auth ? { authorization: `Bearer ${token}` } : {},
  });
  return response.json() as Promise<any>;
}

async function post(pathname: string, body: unknown) {
  const response = await fetch(`http://127.0.0.1:${bridgePort}${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<any>;
}

function send(res: http.ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}
