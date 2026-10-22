"use client";

import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Destination = { label: string; href: string; group: string };
export function PageFinder({ destinations }: { destinations: Destination[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const titleId = useId();
  function open() { setQuery(""); dialog.current?.showModal(); }
  function close() { dialog.current?.close(); }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); if (dialog.current?.open) close(); else open();
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const results = destinations.filter(item => `${item.label} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <button ref={trigger} className="workspace-page-finder-trigger" type="button" onClick={open}><Search size={16} aria-hidden="true" /><span>Find a page</span><kbd>Ctrl K</kbd></button>
    <dialog className="workspace-page-finder" ref={dialog} aria-labelledby={titleId} onClose={() => trigger.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="workspace-finder-content"><header><h2 id={titleId}>Find a page</h2><button type="button" aria-label="Close page finder" onClick={close}><X size={20} aria-hidden="true" /></button></header>
        <label className="workspace-finder-search"><Search size={19} aria-hidden="true" /><input type="search" aria-label="Search dashboard pages" placeholder="Inbox, sales, projects…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); dialog.current?.querySelector<HTMLAnchorElement>(".workspace-finder-results a")?.focus(); } }} /></label>
        <nav className="workspace-finder-results" aria-label="Matching dashboard pages">{results.map(item => <Link href={item.href} key={item.href} onClick={close}><span><strong>{item.label}</strong><small>{item.group}</small></span><ArrowUpRight size={17} aria-hidden="true" /></Link>)}{!results.length ? <p>No pages match “{query}”. Try a page name such as Clients.</p> : null}</nav>
        <footer>Search page names. Use Tab to browse and Enter to open.</footer>
      </div>
    </dialog>
  </>;
}
