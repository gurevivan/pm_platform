import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import type { MeUser } from "../api/types";
import { apiFetch, tokenStorage } from "../api/client";

type AuthCtx = {
  access: string | null;
  me: MeUser | null;
  /** Профиль подтянут с сервера (или входа нет). */
  profileReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  isAuthed: boolean;
  isStaff: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [access, setAccess] = useState<string | null>(
    tokenStorage.getAccess(),
  );
  const [me, setMe] = useState<MeUser | null>(null);
  const [profileReady, setProfileReady] = useState<boolean>(
    () => !tokenStorage.getAccess(),
  );

  const refreshMe = useCallback(async () => {
    const token = tokenStorage.getAccess();
    if (!token) {
      setMe(null);
      return;
    }
    try {
      const u = await apiFetch<MeUser>("/users/me/");
      setMe(u);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    if (!access) {
      setMe(null);
      setProfileReady(true);
      return;
    }
    let cancelled = false;
    setProfileReady(false);
    void (async () => {
      try {
        const u = await apiFetch<MeUser>("/users/me/");
        if (!cancelled) {
          setMe(u);
          setProfileReady(true);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
          setProfileReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [access]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await apiFetch<{ access: string; refresh: string }>(
      `/auth/token/`,
      {
        method: "POST",
        json: { username, password },
      },
    );
    tokenStorage.set(data.access, data.refresh);
    setAccess(data.access);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setAccess(null);
    setMe(null);
    setProfileReady(true);
  }, []);

  const value = useMemo(
    (): AuthCtx => ({
      access,
      me,
      profileReady,
      login,
      logout,
      refreshMe,
      isAuthed: !!access,
      isStaff: !!me?.is_staff,
    }),
    [access, me, profileReady, login, logout, refreshMe],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("Контекст авторизации не найден.");
  return v;
}
