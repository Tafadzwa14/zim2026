"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------- theme ----------------
type Theme = "light" | "dark" | "system";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  useEffect(() => {
    const stored = (localStorage.getItem("zim-theme") as Theme | null) ?? "system";
    setThemeState(stored);
    applyTheme(stored);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("zim-theme", t);
    applyTheme(t);
  }, []);
  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}
export const useTheme = () => useContext(ThemeCtx);

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const order: Theme[] = ["system", "light", "dark"];
  const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🌗";
  const label = theme === "system" ? "System theme" : theme === "light" ? "Light theme" : "Dark theme";
  return (
    <button
      className={className}
      aria-label={`Theme: ${label}. Tap to change.`}
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

// ---------------- toasts ----------------
const ToastCtx = createContext<(message: string, emoji?: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; emoji?: string; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, emoji?: string) => {
    setToast({ message, emoji, id: Date.now() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2400);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-8"
      >
        {toast && (
          <div
            key={toast.id}
            className="disp max-w-[80%] rounded-2xl bg-ink px-4 py-3 text-sm font-extrabold text-paper shadow-2xl"
            style={{ animation: "zc-toast .25s ease" }}
          >
            {toast.emoji && <span className="mr-1.5">{toast.emoji}</span>}
            {toast.message}
          </div>
        )}
      </div>
      <style>{`@keyframes zc-toast{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
    </ToastCtx.Provider>
  );
}
