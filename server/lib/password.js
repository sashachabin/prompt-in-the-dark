const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "pass";

export function checkAdminPassword(pwd) {
  return Boolean(pwd) && pwd === ADMIN_PASSWORD;
}
