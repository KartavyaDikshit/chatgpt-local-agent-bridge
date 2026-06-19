import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export const MAX_OUTPUT_CHARS = 20_000;
const MAX_FILE_BYTES = 1_000_000;
const MAX_LIST_RESULTS = 500;

export type AllowedCommand = {
  command: string;
  args?: string[];
  description?: string;
  cwd?: string;
};

export type AllowedCommandConfig = {
  commands: Record<string, AllowedCommand>;
};

export type CommandResult = {
  command_id: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
};

export async function ensureWorkspace(workspaceRoot: string): Promise<string> {
  const root = path.resolve(workspaceRoot);
  await fs.mkdir(root, { recursive: true });
  return root;
}

export function resolveInsideWorkspace(workspaceRoot: string, requestedPath = "."): string {
  if (path.isAbsolute(requestedPath)) {
    throw new Error("Absolute paths are not allowed.");
  }

  const root = path.resolve(workspaceRoot);
  const resolved = path.resolve(root, requestedPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal outside the workspace is not allowed.");
  }
  return resolved;
}

export async function listWorkspace(workspaceRoot: string, requestedPath = ".") {
  const target = resolveInsideWorkspace(workspaceRoot, requestedPath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const result = entries
    .filter((entry) => !isBlockedName(entry.name))
    .slice(0, MAX_LIST_RESULTS)
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    }));

  return {
    path: path.relative(path.resolve(workspaceRoot), target) || ".",
    entries: result,
    truncated: entries.length > result.length,
  };
}

export async function readFileFromWorkspace(workspaceRoot: string, requestedPath: string) {
  const target = resolveInsideWorkspace(workspaceRoot, requestedPath);
  const stat = await fs.stat(target);
  if (!stat.isFile()) throw new Error("Requested path is not a file.");
  if (stat.size > MAX_FILE_BYTES) throw new Error("File exceeds the read limit.");

  const text = await fs.readFile(target, "utf8");
  return {
    path: requestedPath,
    content: sanitizeText(text).slice(0, MAX_OUTPUT_CHARS),
    truncated: text.length > MAX_OUTPUT_CHARS,
  };
}

export async function writeNote(workspaceRoot: string, requestedPath: string, content: string) {
  if (!requestedPath.endsWith(".md") && !requestedPath.endsWith(".txt")) {
    throw new Error("write_note only writes .md or .txt files.");
  }

  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new Error("Note exceeds the write limit.");
  }

  const target = resolveInsideWorkspace(workspaceRoot, requestedPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return {
    path: requestedPath,
    bytes_written: Buffer.byteLength(content, "utf8"),
  };
}

export async function loadAllowedCommands(configPath: string): Promise<AllowedCommandConfig> {
  const text = await fs.readFile(path.resolve(configPath), "utf8");
  const parsed = JSON.parse(text) as AllowedCommandConfig;
  if (!parsed || typeof parsed !== "object" || !parsed.commands) {
    throw new Error("Allowed command config must contain a commands object.");
  }
  return parsed;
}

export async function runAllowedScript(
  commandId: string,
  config: AllowedCommandConfig,
  workspaceRoot: string,
): Promise<CommandResult> {
  const allowed = config.commands[commandId];
  if (!allowed) throw new Error("Command id is not in the allowlist.");
  if (!allowed.command || /[;&|<>]/.test(allowed.command)) {
    throw new Error("Allowed command executable is invalid.");
  }

  const cwd = allowed.cwd
    ? resolveInsideWorkspace(workspaceRoot, allowed.cwd)
    : path.resolve(workspaceRoot, "..");

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(allowed.command, allowed.args ?? [], {
      cwd,
      shell: false,
      windowsHide: true,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = (stdout + chunk.toString()).slice(-MAX_OUTPUT_CHARS);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-MAX_OUTPUT_CHARS);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        command_id: commandId,
        exit_code: code,
        stdout: sanitizeText(stdout),
        stderr: sanitizeText(stderr),
      });
    });
  });
}

export function sanitizeText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer <redacted>")
    .replace(/(api[_-]?key|token|secret|password|credential|cookie)\s*[:=]\s*["']?[^"',\s]+/gi, "$1=<redacted>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<redacted-ip>")
    .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+/g, "<redacted-local-path>");
}

function isBlockedName(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized === ".env" ||
    normalized.startsWith(".env.") ||
    normalized.includes("credential") ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("cookie") ||
    normalized.includes("key")
  );
}
