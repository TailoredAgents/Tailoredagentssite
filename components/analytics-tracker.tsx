"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/validation";

function elementLabel(element: HTMLElement) {
  return (
    element.dataset.analyticsLabel ||
    element.getAttribute("aria-label") ||
    element.textContent ||
    ""
  ).replace(/\s+/g, " ").trim().slice(0, 120);
}

function explicitEvent(element: HTMLElement) {
  const eventName = element.dataset.analyticsEvent;
  return ["cta_click", "phone_click", "booking_click"].includes(eventName ?? "")
    ? eventName as Exclude<AnalyticsEventName, "form_success">
    : null;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPageView = useRef("");

  useEffect(() => {
    if (lastPageView.current === pathname) return;
    lastPageView.current = pathname;
    trackAnalyticsEvent("page_view");
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest<HTMLElement>("a, button, [data-analytics-event]");
      if (!element) return;

      const anchor = element instanceof HTMLAnchorElement ? element : element.closest<HTMLAnchorElement>("a");
      const href = anchor?.getAttribute("href") ?? "";
      let eventName = explicitEvent(element);

      if (!eventName && href.startsWith("tel:")) eventName = "phone_click";
      if (!eventName && (/^\/(contact|free-review)(?:[/?#]|$)/.test(href))) eventName = "cta_click";
      if (!eventName && /calendly\.com|calendar\.google\.com/.test(href)) eventName = "booking_click";
      if (!eventName) return;

      trackAnalyticsEvent(eventName, {
        target: elementLabel(element),
        targetPath: href.startsWith("/") ? href : undefined,
      });
    }

    function handleFormStart(event: FocusEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const form = target.closest<HTMLFormElement>("form[data-analytics-form]");
      if (!form || form.dataset.analyticsStarted === "true") return;
      if (target.matches('[type="hidden"], .hp-field *')) return;

      form.dataset.analyticsStarted = "true";
      trackAnalyticsEvent("form_start", {
        formType: form.dataset.analyticsForm as "project" | "website-review",
      });
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("focusin", handleFormStart);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("focusin", handleFormStart);
    };
  }, []);

  return null;
}
