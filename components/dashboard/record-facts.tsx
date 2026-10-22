import type { ReactNode } from "react";

export function RecordFacts({ facts }: { facts: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="workspace-facts">{facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>;
}
