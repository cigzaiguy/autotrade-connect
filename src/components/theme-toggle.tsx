import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const KEY = "ai-theme";

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = (localStorage.getItem(KEY) as Theme | null) ?? "light";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "Refinitiv Ivory" : "Bloomberg Dark"} theme`}
      title={theme === "dark" ? "Ivory · light terminal" : "Bloomberg · dark terminal"}
      className={
        "inline-flex items-center gap-2 border border-border bg-surface px-3 py-1.5 " +
        "font-mono text-[10px] uppercase tracking-widest text-foreground " +
        "transition-colors hover:bg-surface-strong " + className
      }
    >
      {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      <span>{theme === "dark" ? "Ivory" : "Bloomberg"}</span>
    </button>
  );
}
