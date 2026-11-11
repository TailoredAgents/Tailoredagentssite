import { ArrowUpRight, CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./record-workspace.module.css";

export function RecordNextStep({ title, children, href, linkLabel = "Manage next step" }: {
  title: string; children?: ReactNode; href?: string; linkLabel?: string;
}) {
  return <section className={styles.nextStep} aria-label="Next step">
    <span className={styles.nextIcon}><CalendarClock size={20} aria-hidden="true" /></span>
    <div><span className={styles.eyebrow}>Next step</span><h2>{title}</h2>{children ? <p>{children}</p> : null}</div>
    {href ? <Link href={href}>{linkLabel}<ArrowUpRight size={15} aria-hidden="true" /></Link> : null}
  </section>;
}

export function RecordDetails({ children }: { children: ReactNode }) {
  return <div className={styles.details}>{children}</div>;
}
