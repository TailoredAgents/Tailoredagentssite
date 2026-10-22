"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/** Keeps existing create hash links while giving the directory its full width. */
export function RecordDrawer({ id, title, description, children, enabled = true }: { id: string; title: string; description: string; children: ReactNode; enabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element || !enabled) return;
    const hash = `#${id}`;
    function sync() {
      if (window.location.hash === hash && element && !element.open) { previousFocus.current = document.activeElement as HTMLElement; element.showModal(); }
      else if (window.location.hash !== hash && element?.open) element.close();
    }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      const target = new URL(anchor.href);
      if (target.origin !== location.origin || target.pathname !== location.pathname || target.hash !== hash) return;
      event.preventDefault(); previousFocus.current = anchor;
      window.history.replaceState(window.history.state, "", target.pathname + target.search + hash); sync();
    }
    sync(); window.addEventListener("hashchange", sync); window.addEventListener("popstate", sync); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("popstate", sync); document.removeEventListener("click", click, true); };
  }, [id, enabled]);
  function close() { dialog.current?.close(); }
  if (!enabled) return null;
  return <dialog id={id} ref={dialog} className="workspace-record-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => {
    if (location.hash === `#${id}`) window.history.replaceState(window.history.state, "", location.pathname + location.search);
    previousFocus.current?.focus();
  }}>
    <header><div><span>New record</span><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={close}><X size={20} aria-hidden="true" /></button></header>
    <div className="workspace-record-dialog-body">{children}</div>
  </dialog>;
}
