import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export const IMAGES_DIR = resolve(process.cwd(), "../tasks");

export async function getTasks(): Promise<string[]> {
  const files = await readdir(IMAGES_DIR);
  return files
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export async function checkTask(taskId: string): Promise<boolean> {
  const tasks = await getTasks();
  return tasks.includes(taskId);
}