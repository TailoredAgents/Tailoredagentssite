"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { dashboardTheme, dashboardThemeCookie, type DashboardTheme } from "@/lib/dashboard/theme";

const ThemeContext = createContext<{ theme: DashboardTheme; setTheme: (value: DashboardTheme) => void } | null>(null);

export function DashboardThemeProvider({ initialTheme, children }: { initialTheme: DashboardTheme; children: ReactNode }) {
  const [theme, updateTheme] = useState(initialTheme);
  function setTheme(value: DashboardTheme) {
    const next = dashboardTheme(value);
    updateTheme(next);
    document.cookie = `${dashboardThemeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}><div className="dashboard-theme" data-theme={theme}>{children}</div></ThemeContext.Provider>;
}

function useDashboardTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("Appearance controls require the dashboard theme provider.");
  return context;
}

export function DashboardThemeSelect() {
  const { theme, setTheme } = useDashboardTheme();
  const id = useId();
  return <div className="workspace-theme-select"><label htmlFor={id}><Sun size={15} aria-hidden="true" />Appearance</label><select id={id} value={theme} onChange={event => setTheme(dashboardTheme(event.target.value))}><option value="light">Light · Slate & blue</option><option value="dark">Dark · Midnight blue</option><option value="system">System</option></select></div>;
}

const options = [
  { value: "light", title: "Light", description: "Slate-gray canvas and soft blue-gray panels.", Icon: Sun },
  { value: "dark", title: "Dark", description: "Midnight navy with lighter surfaces and blue accents.", Icon: Moon },
  { value: "system", title: "System", description: "Follow this device’s light or dark appearance.", Icon: Monitor },
] as const;

export function DashboardAppearance() {
  const { theme, setTheme } = useDashboardTheme();
  return <section className="workspace-appearance" id="appearance" aria-labelledby="appearance-title"><header><div><h2 id="appearance-title">Appearance</h2><p>Choose the colors you prefer. Your choice is saved in this browser.</p></div></header><div className="workspace-theme-options" role="group" aria-label="Dashboard appearance">{options.map(({ value, title, description, Icon }) => <button type="button" key={value} aria-pressed={theme === value} onClick={() => setTheme(value)}><Icon size={20} aria-hidden="true" /><span><strong>{title}</strong><small>{description}</small></span></button>)}</div></section>;
}
