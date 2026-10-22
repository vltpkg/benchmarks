"use client";

import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

/*
 * Data mode: only the report's charts and tables, without the prose around
 * them. A reader's preference, like the theme, so it is kept in the browser
 * and not in the URL. It is `data-view="data"` on <html>, set before paint by
 * the root layout's script; `[data-narrative]` is what it hides (globals.css).
 */
export const VIEW_KEY = "view";
const CHANGE = "viewchange";

const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGE, onChange);
  return () => window.removeEventListener(CHANGE, onChange);
};
const current = () => document.documentElement.dataset["view"] === "data";

const choose = (data: boolean) => {
  if (data) document.documentElement.dataset["view"] = "data";
  else delete document.documentElement.dataset["view"];
  try {
    localStorage.setItem(VIEW_KEY, data ? "data" : "report");
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
  window.dispatchEvent(new Event(CHANGE));
};

export const ViewToggle = () => {
  const data = useSyncExternalStore(subscribe, current, () => false);
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2">
      <Switch checked={data} onCheckedChange={choose} />
      Data mode
    </label>
  );
};
