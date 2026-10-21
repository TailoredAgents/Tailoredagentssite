"use client";

import { Plus } from "lucide-react";

export function NewOpportunityLink() {
  return <a className="sales-button sales-button-primary" href="#new-opportunity" onClick={() => {
    const section = document.getElementById("new-opportunity");
    if (section instanceof HTMLDetailsElement) {
      section.open = true;
      requestAnimationFrame(() => section.querySelector<HTMLInputElement>('input[name="businessName"]')?.focus({ preventScroll: true }));
    }
  }}><Plus size={16} />New opportunity</a>;
}
