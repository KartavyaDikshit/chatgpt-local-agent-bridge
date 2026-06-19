import { randomUUID } from "node:crypto";

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export type LocalTask = {
  id: string;
  status: TaskStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  action: string;
  result?: unknown;
  error?: string;
};

const tasks = new Map<string, LocalTask>();

export function createTask(action: string): LocalTask {
  const task: LocalTask = {
    id: randomUUID(),
    status: "queued",
    created_at: new Date().toISOString(),
    action,
  };
  tasks.set(task.id, task);
  return task;
}

export function markTaskRunning(id: string): void {
  const task = requireTask(id);
  task.status = "running";
  task.started_at = new Date().toISOString();
}

export function completeTask(id: string, result: unknown): void {
  const task = requireTask(id);
  task.status = "completed";
  task.finished_at = new Date().toISOString();
  task.result = result;
}

export function failTask(id: string, error: string): void {
  const task = requireTask(id);
  task.status = "failed";
  task.finished_at = new Date().toISOString();
  task.error = error;
}

export function getTask(id: string): LocalTask {
  return requireTask(id);
}

function requireTask(id: string): LocalTask {
  const task = tasks.get(id);
  if (!task) throw new Error("Task not found.");
  return task;
}
