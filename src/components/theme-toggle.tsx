"use client";

import { useSyncExternalStore } from "react";

export const THEME_STORAGE_KEY = "theme";

/**
 * Runs inline in <head> before first paint, so the page never flashes the
 * wrong theme. Uses the saved choice, otherwise the OS setting, and keeps
 * following the OS until the visitor picks a view.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},d=document.documentElement,m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var s=null;try{s=localStorage.getItem(k)}catch(e){}d.dataset.theme=s==='dark'||s==='light'?s:(m.matches?'dark':'light')};apply();m.addEventListener('change',apply)}catch(e){}})();`;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Server render assumes day view; the client corrects it after hydration.
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as const);
  const next = theme === "dark" ? "light" : "dark";

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private mode): the choice lasts for this page only.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Switch to night view" : "Switch to day view"}
      title={next === "dark" ? "Night view" : "Day view"}
      className={`btn-ghost px-2.5 ${className}`}
    >
      {theme === "dark" ? (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
      <span className="sr-only sm:not-sr-only sm:text-xs">{next === "dark" ? "Night" : "Day"}</span>
    </button>
  );
}
