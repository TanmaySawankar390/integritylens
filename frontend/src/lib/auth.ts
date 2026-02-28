export type AuthState = {
  token: string;
  teacher?: { id: string; displayName: string };
};

const key = "shikshamitra_auth_v1";

export function getAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function setAuth(state: AuthState): void {
  window.localStorage.setItem(key, JSON.stringify(state));
}

export function clearAuth(): void {
  window.localStorage.removeItem(key);
}

