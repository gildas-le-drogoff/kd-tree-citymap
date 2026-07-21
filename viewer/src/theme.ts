type Theme = "light" | "dark";

const STORAGE_KEY = "cc-theme";

const LABELS: Record<Theme, string> = {
  light: "☀ Clair",
  dark: "☾ Sombre",
};

export function setupTheme(): void {
  const btn = document.getElementById(
    "theme-toggle",
  ) as HTMLButtonElement | null;
  if (!btn) return;

  const initial = currentTheme();
  applyTheme(initial);
  btn.addEventListener("click", () => toggle());
}

function toggle(): void {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

function currentTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
  root.dispatchEvent(new CustomEvent("themechange", { detail: theme }));

  const btn = document.getElementById(
    "theme-toggle",
  ) as HTMLButtonElement | null;
  if (btn) btn.textContent = LABELS[theme];
}
