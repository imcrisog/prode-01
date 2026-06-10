export const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "https://admin.vedo.com.ar";

export function backendUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) return `${BACKEND_BASE_URL}/${path}`;
  return `${BACKEND_BASE_URL}${path}`;
}
