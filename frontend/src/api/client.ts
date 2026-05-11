/** HTTP-клиент к DRF API с Bearer JWT */

const STORAGE_ACCESS = "pm_access_token";
const STORAGE_REFRESH = "pm_refresh_token";

export const tokenStorage = {
  getAccess: () => localStorage.getItem(STORAGE_ACCESS),
  getRefresh: () => localStorage.getItem(STORAGE_REFRESH),
  set: (access: string, refresh: string) => {
    localStorage.setItem(STORAGE_ACCESS, access);
    localStorage.setItem(STORAGE_REFRESH, refresh);
  },
  clear: () => {
    localStorage.removeItem(STORAGE_ACCESS);
    localStorage.removeItem(STORAGE_REFRESH);
  },
};

const BASE = `${import.meta.env.VITE_API_BASE || "/api/v1"}`;

async function refreshTokens(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh();
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access: string };
    localStorage.setItem(STORAGE_ACCESS, data.access);
    return data.access;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  const access = tokenStorage.getAccess();
  if (access) headers.set("Authorization", `Bearer ${access}`);

  const doFetch = async (token?: string | null) => {
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${BASE}${path}`, {
      ...init,
      headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
  };

  let res = await doFetch(access);
  if (res.status === 401 && tokenStorage.getRefresh()) {
    const next = await refreshTokens();
    if (next) {
      headers.set("Authorization", `Bearer ${next}`);
      res = await fetch(`${BASE}${path}`, {
        ...init,
        headers,
        body:
          init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
      });
    }
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    const errBody = parsed as { detail?: string };
    if (typeof errBody?.detail === "string") msg = errBody.detail;
    else if (typeof parsed === "object" && parsed !== null)
      msg = JSON.stringify(parsed);
    else if (typeof parsed === "string") msg = parsed;
    throw new Error(msg);
  }
  return parsed as T;
}
