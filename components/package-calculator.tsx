"use client";

import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";
import { type CSSProperties, useMemo, useState } from "react";
import { calculatePackageBreakdown, FLEX_MONTHS, FLEX_PREMIUM_RATE, growthPackages } from "@/lib/packages";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const flexPremiumPercentage = (FLEX_PREMIUM_RATE * 100).toFixed(1);

export function PackageCalculator() {
  const [selectedId, setSelectedId] = useState("growth-foundation");
  const selected = growthPackages.find((plan) => plan.id === selectedId) ?? growthPackages[1];
  const [upfront, setUpfront] = useState<number>(selected.defaultUpfront);
  const breakdown = useMemo(() => calculatePackageBreakdown(selected, upfront), [selected, upfront]);
  const range = selected.websitePrice - selected.minimumUpfront;
  const progress = range === 0 ? 100 : ((breakdown.upfront - selected.minimumUpfront) / range) * 100;
  const hasDeferredBalance = breakdown.deferredWebsite > 0;

  function selectPackage(id: string) {
    const nextPackage = growthPackages.find((plan) => plan.id === id);
    if (!nextPackage) return;
    setSelectedId(id);
    setUpfront(nextPackage.defaultUpfront);
  }

  return (
    <div className="package-builder">
      <div className="package-selector" aria-label="Available growth packages">
        <span className="micro-label blue">Choose a package</span>
        <div className="package-selector-grid">
          {growthPackages.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className={plan.id === selected.id ? "active" : ""}
              aria-pressed={plan.id === selected.id}
              onClick={() => selectPackage(plan.id)}
            >
              <span>{plan.kicker}</span>
              <strong>{plan.name}</strong>
              <small>Website from {currency.format(plan.websitePrice)} + {currency.format(plan.seoMonthly)}/mo SEO</small>
            </button>
          ))}
        </div>
      </div>

      <div className="package-configurator">
        <section className="package-control-panel" aria-labelledby="selected-package-name">
          <div className="package-control-heading">
            <div>
              <span className="micro-label blue">{selected.kicker}</span>
              <h2 id="selected-package-name">{selected.name}</h2>
            </div>
            {selected.featured && <em>Recommended</em>}
          </div>
          <p className="package-control-description">{selected.description}</p>
          <div className="package-inclusions">
            {selected.features.map((feature) => <span key={feature}><Check size={13} aria-hidden="true" />{feature}</span>)}
          </div>

          <div className="package-slider-block">
            <div className="package-slider-label">
              <label htmlFor="upfront-investment">Choose your upfront website investment</label>
              <output htmlFor="upfront-investment">{currency.format(breakdown.upfront)}</output>
            </div>
            <input
              id="upfront-investment"
              className="package-range"
              type="range"
              min={selected.minimumUpfront}
              max={selected.websitePrice}
              step={250}
              value={breakdown.upfront}
              onChange={(event) => setUpfront(Number(event.target.value))}
              aria-describedby="package-slider-help"
              style={{ "--range-progress": `${progress}%` } as CSSProperties}
            />
            <div className="package-range-bounds"><span>{currency.format(selected.minimumUpfront)} minimum</span><span>{currency.format(selected.websitePrice)} paid in full</span></div>
            <p id="package-slider-help">
              {hasDeferredBalance
                ? `The remaining website investment is spread across ${FLEX_MONTHS} months with a ${flexPremiumPercentage}% flexibility premium applied only to the deferred amount.`
                : "The website is paid in full, so there is no flexibility premium and only the monthly SEO service remains."}
            </p>
          </div>
        </section>

        <aside className="package-breakdown">
          <span className="micro-label">Your estimated structure</span>
          <div className="package-monthly-focus" aria-live="polite" aria-atomic="true">
            <small>{hasDeferredBalance ? `Months 1–${FLEX_MONTHS}` : "Monthly SEO"}</small>
            <strong>{currency.format(breakdown.combinedMonthly)}<span>/mo</span></strong>
            <p>{hasDeferredBalance ? `Then ${currency.format(breakdown.ongoingMonthly)}/month while SEO remains active.` : "No deferred website payments."}</p>
          </div>

          <dl className="package-cost-list">
            <div><dt>{selected.websiteName} starting price</dt><dd>{currency.format(selected.websitePrice)}</dd></div>
            <div><dt>Upfront website payment</dt><dd>{currency.format(breakdown.upfront)}</dd></div>
            <div><dt>Deferred website amount</dt><dd>{currency.format(breakdown.deferredWebsite)}</dd></div>
            <div><dt>Flexibility premium</dt><dd>{currency.format(breakdown.flexPremium)}</dd></div>
            <div className="emphasis"><dt>Website flex payment</dt><dd>{currency.format(breakdown.websiteMonthly)}/mo × {FLEX_MONTHS}</dd></div>
            <div><dt>{selected.seoName}</dt><dd>{currency.format(selected.seoMonthly)}/mo</dd></div>
            <div className="included"><dt>SEO Foundation Setup</dt><dd>Included <small>({currency.format(selected.seoSetupValue)} value)</small></dd></div>
          </dl>

          <div className="package-total-line"><span>Estimated website total</span><strong>{currency.format(breakdown.websiteFlexTotal)}</strong></div>
          <Link className="button button-dark" href="/contact">Discuss this package<ArrowRight size={15} aria-hidden="true" /></Link>
          <p className="package-estimate-note"><Info size={13} aria-hidden="true" />Estimate only. Final scope, payment schedule, and ownership terms are confirmed in a written proposal.</p>
        </aside>
      </div>
    </div>
  );
}
