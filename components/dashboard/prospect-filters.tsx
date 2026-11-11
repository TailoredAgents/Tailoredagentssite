"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { leadStatuses } from "@/lib/operations/validation";
import { statusLabel } from "@/lib/operations/format";
import styles from "./prospect-filters.module.css";

export function ProspectFilters({ q, status, source }: { q: string; status: string; source: string }) {
  const filterCount = Number(status !== "active") + Number(source !== "all");
  const [expanded, setExpanded] = useState(filterCount > 0);
  return <form className={styles.filters} method="get" aria-label="Filter prospects">
    <div className={styles.searchRow}>
      <label className={styles.search}><Search size={18} aria-hidden="true" /><input type="search" name="q" aria-label="Search prospects" defaultValue={q} placeholder="Search prospects…" /></label>
      <button className={styles.submit} type="submit"><span className={styles.desktopLabel}>Apply filters</span><span className={styles.mobileLabel}>Search</span></button>
      <button className={styles.toggle} type="button" aria-expanded={expanded} aria-controls="prospect-filter-options" onClick={() => setExpanded(!expanded)}><SlidersHorizontal size={17} aria-hidden="true" /><span>Filters{filterCount ? ` (${filterCount})` : ""}</span><ChevronDown size={15} aria-hidden="true" /></button>
    </div>
    <div id="prospect-filter-options" className={styles.options} data-expanded={expanded}>
      <label><span>Status</span><select name="status" aria-label="Filter prospects by status" defaultValue={status}><option value="active">Active prospects</option><option value="all">All statuses</option>{leadStatuses.map(value => <option value={value} key={value}>{statusLabel(value)}</option>)}</select></label>
      <label><span>Source</span><select name="source" aria-label="Filter prospects by source" defaultValue={source}><option value="all">All sources</option><option value="facebook">Facebook / Instagram</option><option value="website">Website</option><option value="manual">Added manually</option><option value="smart_card">Smart Cards</option></select></label>
      <button type="submit" className={styles.apply}>Apply filters</button>
    </div>
    {q || filterCount ? <Link className={styles.clear} href="/dashboard/leads">Clear filters</Link> : null}
  </form>;
}
