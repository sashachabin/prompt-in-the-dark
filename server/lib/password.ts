const ADMIN_PASSWORD = process.env["ADMIN_PASSWORD"] || "pass";

export function checkAdminPassword(pwd: unknown): boolean {
  return typeof pwd === "string" && pwd.length > 0 && pwd === ADMIN_PASSWORD;
}