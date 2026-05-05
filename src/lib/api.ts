const BASE = import.meta.env.VITE_API_URL || "";

function authHeaders() {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("authToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
    ...init,
  });
  if (res.status === 401) {
    try { localStorage.removeItem('authToken'); localStorage.removeItem('userData'); } catch {}
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return undefined as unknown as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return (text as unknown) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
