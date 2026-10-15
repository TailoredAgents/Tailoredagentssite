import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { PricingPlan } from "@/lib/services";

export function PricingCards({ plans, columns = 3 }: { plans: readonly PricingPlan[]; columns?: 2 | 3 }) {
  return (
    <div className={`pricing-package-grid pricing-package-grid-${columns}`}>
      {plans.map((plan) => (
        <article className={`pricing-package-card ${plan.featured ? "featured-package" : ""}`} key={plan.name}>
          <div className="pricing-package-top">
            <span>{plan.kicker}</span>
            {plan.featured && <em>Best place to start</em>}
          </div>
          <h3>{plan.name}</h3>
          <div className={`package-price ${plan.price.startsWith("$") ? "" : "proposal-price"}`}>
            {plan.pricePrefix && <small>{plan.pricePrefix}</small>}
            <strong>{plan.price}</strong>
            {plan.billing && <span>{plan.billing}</span>}
          </div>
          {plan.setup && <p className="package-setup">{plan.setup}</p>}
          <p className="package-description">{plan.description}</p>
          <ul>
            {plan.features.map((feature) => <li key={feature}><Check size={14} aria-hidden="true" />{feature}</li>)}
          </ul>
          <p className="package-note">{plan.note}</p>
          <Link href={plan.href}>{plan.cta}<ArrowRight size={14} aria-hidden="true" /></Link>
        </article>
      ))}
    </div>
  );
}
