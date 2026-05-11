import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { apiFetch, tokenStorage } from "../api/client";
import type { ThemeBrief } from "../api/types";
import { useAuth } from "../auth/AuthProvider";

const STORAGE_KEY = "pm-theme";

/** Поддерживаемые CSS-палитры; остальные slug отображаются как тёмная до появления стилей. */
export function domDataThemeSlug(slug: string | null | undefined): "dark" | "light" {
  return slug === "light" ? "light" : "dark";
}

function dataThemeHtmlAttr(
  row: ThemeBrief | undefined,
  slug: string,
): "dark" | "light" {
  const b = row?.data_theme_base;
  if (b === "light" || b === "dark") return b;
  return domDataThemeSlug(slug);
}

function readInitialFromStorage(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : "dark";
  } catch {
    return "dark";
  }
}

function defaultThemeListFallback(): ThemeBrief[] {
  return [
    {
      id: 1,
      slug: "dark",
      name: "Тёмная",
      css_variables: {},
      data_theme_base: "dark",
    },
    {
      id: 2,
      slug: "light",
      name: "Светлая",
      css_variables: {},
      data_theme_base: "light",
    },
  ];
}

type Ctx = {
  /** Slug текущей темы (может быть не dark/light до доработки CSS). */
  activeSlug: string;
  /** Все известные темы для интерфейса и стилей. */
  themes: ThemeBrief[];
  /** Темы для переключателя. */
  themesPublic: ThemeBrief[];
  /** Переключение по кругу + сохранение на сервере для авторизованных. */
  cycleTheme: () => Promise<void>;
  /** Принять slug после PATCH профиля / входа без циклического шага */
  adoptSlug: (slug: string) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const {
    me,
    profileReady,
    isAuthed,
    refreshMe,
    access,
  } = useAuth();

  const { data: apiThemes } = useQuery({
    queryKey: ["themes"],
    queryFn: () => apiFetch<ThemeBrief[]>("/themes/"),
    staleTime: 60_000,
  });

  const themesResolved = useMemo(() => {
    let list: ThemeBrief[];
    if (Array.isArray(apiThemes) && apiThemes.length >= 1) {
      list = apiThemes;
    } else {
      list = defaultThemeListFallback();
    }
    const td = me?.theme_detail;
    if (isAuthed && td && !list.some((t) => t.id === td.id)) {
      list = [...list, td];
    }
    return list;
  }, [apiThemes, isAuthed, me?.theme_detail]);

  const [activeSlug, setActiveSlug] = useState<string>(readInitialFromStorage);
  const cssVarKeysApplied = useRef<string[]>([]);

  useLayoutEffect(() => {
    if (!profileReady || !isAuthed || !access) return;
    const s = me?.theme_detail?.slug;
    if (s) {
      setActiveSlug(s);
    }
  }, [profileReady, isAuthed, access, me?.theme_detail?.slug]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const k of cssVarKeysApplied.current) {
      root.style.removeProperty(k);
    }
    cssVarKeysApplied.current = [];

    const row = themesResolved.find((t) => t.slug === activeSlug);
    const vars = row?.css_variables;
    if (vars && typeof vars === "object") {
      const next: string[] = [];
      for (const [key, val] of Object.entries(vars)) {
        if (!key.startsWith("--")) continue;
        root.style.setProperty(key, String(val));
        next.push(key);
      }
      cssVarKeysApplied.current = next;
    }

    root.setAttribute("data-theme", dataThemeHtmlAttr(row, activeSlug));
    root.setAttribute("data-theme-slug", activeSlug);
    try {
      localStorage.setItem(STORAGE_KEY, activeSlug);
    } catch {
      /* игнор */
    }
  }, [activeSlug, themesResolved]);

  const themesPublic = useMemo(() => {
    return themesResolved;
  }, [themesResolved]);

  /** После logout оставить последний slug в localStorage или сброс — оставляем как есть. */

  const adoptSlug = useCallback((slug: string) => {
    setActiveSlug(slug);
  }, []);

  const cycleTheme = useCallback(async () => {
    const list = themesPublic;
    const ix = list.findIndex((t) => t.slug === activeSlug);
    const next = list[ix >= 0 ? (ix + 1) % list.length : 0];
    const nextSlug = next.slug;

    setActiveSlug(nextSlug);

    const token = tokenStorage.getAccess();
    if (!token || !next?.id) return;

    try {
      await apiFetch("/users/me/", {
        method: "PATCH",
        json: { theme_id: next.id },
      });
      await refreshMe();
    } catch {
      /* офлайн / 401 — локальный вид уже применён */
    }
  }, [activeSlug, themesPublic, refreshMe]);

  const value = useMemo(
    () => ({
      activeSlug,
      themes: themesResolved,
      themesPublic,
      cycleTheme,
      adoptSlug,
    }),
    [activeSlug, themesResolved, themesPublic, cycleTheme, adoptSlug],
  );

  return (
    <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
  );
}

export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme без ThemeProvider");
  return v;
}
