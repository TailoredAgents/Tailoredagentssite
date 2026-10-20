"use client";

import type { AnalyticsEventName } from "./validation";

const SESSION_KEY = "ta_analytics_session";
const ATTRIBUTION_KEY = "ta_analytics_attribution";
const APPLICATION_PATHS = ["/dashboard", "/sign-in"];
const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;

type Attribution = {
  landingPath: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
};

type EventDetails = {
  target?: string;
  targetPath?: string;
  formType?: "project" | "website-review";
};

function limited(value: string | null | undefined, maximum = 100) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maximum) : undefined;
}

function relativePath(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return undefined;
    return url.pathname.slice(0, 300) || "/";
  } catch {
    return undefined;
  }
}

function isApplicationPath(pathname: string) {
  return APPLICATION_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function trackingDisabled() {
  const navigatorWithPrivacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return navigatorWithPrivacy.globalPrivacyControl === true || navigator.doNotTrack === "1";
}

function sessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function currentAttribution(): Attribution {
  try {
    const existing = sessionStorage.getItem(ATTRIBUTION_KEY);
    if (existing) return JSON.parse(existing) as Attribution;
  } catch {
    // Continue with a new, session-only attribution record.
  }

  const parameters = new URLSearchParams(window.location.search);
  const attribution: Attribution = {
    landingPath: window.location.pathname.slice(0, 300) || "/",
  };

  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.host !== window.location.host) {
        attribution.referrerHost = limited(referrer.hostname, 253);
      }
    }
  } catch {
    // Invalid referrers are ignored rather than persisted.
  }

  for (const key of UTM_KEYS) {
    const value = limited(parameters.get(`utm_${key}`));
    if (!value) continue;
    const property = `utm${key.charAt(0).toUpperCase()}${key.slice(1)}` as keyof Attribution;
    attribution[property] = value;
  }

  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Measurement remains best-effort if session storage is unavailable.
  }
  return attribution;
}

export function getMeasurementContext() {
  if (typeof window === "undefined" || trackingDisabled() || isApplicationPath(window.location.pathname)) return undefined;
  const path = relativePath(window.location.href);
  if (!path) return undefined;
  return { sessionId: sessionId(), path, ...currentAttribution() };
}

export function trackAnalyticsEvent(eventName: Exclude<AnalyticsEventName, "form_success">, details: EventDetails = {}) {
  if (typeof window === "undefined" || trackingDisabled() || isApplicationPath(window.location.pathname)) {
    return;
  }

  const path = relativePath(window.location.href);
  if (!path) return;

  const targetPath = details.targetPath ? relativePath(details.targetPath) : undefined;
  const payload = {
    id: crypto.randomUUID(),
    sessionId: sessionId(),
    eventName,
    path,
    ...currentAttribution(),
    target: limited(details.target, 120),
    targetPath,
    formType: details.formType,
  };

  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
