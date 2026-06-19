import http from "node:http";
import { URL } from "node:url";
import path from "node:path";
import {
  ensureWorkspace,
  listWorkspace,
  loadAllowedCommands,
  readFileFromWorkspace,
  runAllowedScript,
  sanitizeText,
  writeNote,
} from "./executor.js";
import { completeTask, createTask, failTask, getTask, markTaskRunning } from "./executor-jobs.js";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInteger(process.env.PORT, 8787);
const AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN || "";
const ALLOW_NO_AUTH_LOOPBACK = process.env.ALLOW_NO_AUTH_LOOPBACK === "true";
const WORKSPACE_ROOT = path.resolve(process.env.LOCAL_BRIDGE_WORKSPACE || "./sandbox-workspace");
const LMSTUDIO_BASE_URL = trimTrailingSlash(process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1");
const LMSTUDIO_REQUEST_TIMEOUT_MS = parseInteger(process.env.LMSTUDIO_REQUEST_TIMEOUT_MS, 30_000);
const ALLOWED_COMMANDS_CONFIG = process.env.ALLOWED_COMMANDS_CONFIG || "./config/allowed_commands.example.json";

type JsonObject = Record<string, unknown>;

await ensureWorkspace(WORKSPACE_ROOT);

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    const status = error instanceof Error && "status" in error
      ? Number((error as Error & { status?: number }).status)
      : 500;
    sendJson(res, Number.isInteger(status) ? status : 500, {
      error: sanitizeText(error instanceof Error ? error.message : String(error)),
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`chatgpt-local-agent-bridge listening on ${HOST}:${PORT}`);
});

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  setSecurityHeaders(res);

  if (req.method === "GET" && url.pathname === "/status") {
    sendJson(res, 200, {
      ok: true,
      name: "chatgpt-local-agent-bridge",
      version: "0.1.0",
      auth_required: authRequired(req),
      workspace: "sandbox",
      tools: [
        "/status",
        "/lmstudio_health",
        "/lmstudio_models",
        "/lmstudio_ask",
        "/list_workspace",
        "/read_file",
        "/write_note",
        "/run_allowed_script",
        "/submit_task",
        "/task_status",
      ],
    });
    return;
  }

  requireAuth(req);

  if (req.method === "GET" && url.pathname === "/lmstudio_health") {
    sendJson(res, 200, await lmstudioHealth());
    return;
  }

  if (req.method === "GET" && url.pathname === "/lmstudio_models") {
    sendJson(res, 200, await lmstudioModels());
    return;
  }

  if (req.method === "POST" && url.pathname === "/lmstudio_ask") {
    const body = await readJson(req);
    sendJson(res, 200, await lmstudioAsk(String(body.prompt || ""), body.model ? String(body.model) : undefined));
    return;
  }

  if (req.method === "GET" && url.pathname === "/list_workspace") {
    sendJson(res, 200, await listWorkspace(WORKSPACE_ROOT, url.searchParams.get("path") || "."));
    return;
  }

  if (req.method === "GET" && url.pathname === "/read_file") {
    const requestedPath = url.searchParams.get("path");
    if (!requestedPath) throw new Error("Missing path.");
    sendJson(res, 200, await readFileFromWorkspace(WORKSPACE_ROOT, requestedPath));
    return;
  }

  if (req.method === "POST" && url.pathname === "/write_note") {
    const body = await readJson(req);
    sendJson(res, 200, await writeNote(WORKSPACE_ROOT, String(body.path || ""), String(body.content || "")));
    return;
  }

  if (req.method === "POST" && url.pathname === "/run_allowed_script") {
    const body = await readJson(req);
    const config = await loadAllowedCommands(ALLOWED_COMMANDS_CONFIG);
    sendJson(res, 200, await runAllowedScript(String(body.command_id || ""), config, WORKSPACE_ROOT));
    return;
  }

  if (req.method === "POST" && url.pathname === "/submit_task") {
    const body = await readJson(req);
    sendJson(res, 202, await submitTask(body));
    return;
  }

  if (req.method === "GET" && url.pathname === "/task_status") {
    const id = url.searchParams.get("id");
    if (!id) throw new Error("Missing task id.");
    sendJson(res, 200, getTask(id));
    return;
  }

  sendJson(res, 404, { error: "Not found." });
}

async function submitTask(body: JsonObject) {
  const action = String(body.action || "");
  if (!["list_workspace", "read_file", "write_note", "run_allowed_script"].includes(action)) {
    throw new Error("Unsupported task action.");
  }

  const task = createTask(action);
  queueMicrotask(async () => {
    try {
      markTaskRunning(task.id);
      if (action === "list_workspace") {
        completeTask(task.id, await listWorkspace(WORKSPACE_ROOT, String(body.path || ".")));
      } else if (action === "read_file") {
        completeTask(task.id, await readFileFromWorkspace(WORKSPACE_ROOT, String(body.path || "")));
      } else if (action === "write_note") {
        completeTask(task.id, await writeNote(WORKSPACE_ROOT, String(body.path || ""), String(body.content || "")));
      } else if (action === "run_allowed_script") {
        const config = await loadAllowedCommands(ALLOWED_COMMANDS_CONFIG);
        completeTask(task.id, await runAllowedScript(String(body.command_id || ""), config, WORKSPACE_ROOT));
      }
    } catch (error) {
      failTask(task.id, sanitizeText(error instanceof Error ? error.message : String(error)));
    }
  });

  return task;
}

async function lmstudioHealth() {
  try {
    const response = await fetchWithTimeout(`${LMSTUDIO_BASE_URL}/models`, { method: "GET" });
    return {
      reachable: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      reachable: false,
      error: sanitizeText(error instanceof Error ? error.message : String(error)),
    };
  }
}

async function lmstudioModels() {
  const response = await fetchWithTimeout(`${LMSTUDIO_BASE_URL}/models`, { method: "GET" });
  const text = await response.text();
  return JSON.parse(sanitizeText(text));
}

async function lmstudioAsk(prompt: string, model?: string) {
  if (!prompt.trim()) throw new Error("Prompt is required.");
  const response = await fetchWithTimeout(`${LMSTUDIO_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: model || "local-model",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 800,
    }),
  });
  const text = sanitizeText(await response.text());
  if (!response.ok) {
    throw new Error(`LM Studio request failed with status ${response.status}.`);
  }
  return JSON.parse(text);
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LMSTUDIO_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function requireAuth(req: http.IncomingMessage): void {
  if (!authRequired(req)) return;
  if (!AUTH_TOKEN) throw new Error("BRIDGE_AUTH_TOKEN is required.");
  const header = req.headers.authorization || "";
  if (header !== `Bearer ${AUTH_TOKEN}`) {
    const error = new Error("Unauthorized.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
}

function authRequired(req: http.IncomingMessage): boolean {
  if (!ALLOW_NO_AUTH_LOOPBACK) return true;
  return !isLoopback(req.socket.remoteAddress || "");
}

function isLoopback(address: string): boolean {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

async function readJson(req: http.IncomingMessage): Promise<JsonObject> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error("Request body too large.");
  }
  return raw ? (JSON.parse(raw) as JsonObject) : {};
}

function sendJson(res: http.ServerResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value, null, 2));
}

function setSecurityHeaders(res: http.ServerResponse): void {
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
