"use client";

import { ChevronDown, Settings2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function SettingsSection({ id, target, title, description, children }: { id: string; target: string; title: string; description: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function reveal() { if ([`#${id}`, `#${target}`].includes(location.hash) && details.current) details.current.open = true; }
    reveal(); window.addEventListener("hashchange", reveal); window.addEventListener("popstate", reveal);
    function click(event: MouseEvent) { if (!(event.target instanceof Element)) return; const anchor = event.target.closest<HTMLAnchorElement>("a[href]"); if (anchor && new URL(anchor.href).pathname === location.pathname && [`#${id}`, `#${target}`].includes(new URL(anchor.href).hash) && details.current) details.current.open = true; }
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("hashchange", reveal); window.removeEventListener("popstate", reveal); document.removeEventListener("click", click, true); };
  }, [id, target]);
  return <details id={id} ref={details} className="workspace-settings-section"><summary><span className="workspace-section-icon"><Settings2 size={20} aria-hidden="true" /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronDown size={19} aria-hidden="true" /></summary><div>{children}</div></details>;
}
