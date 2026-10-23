"use client";

export const META_PREFERENCE_KEY = "ta_meta_measurement_v1";
const SENT_KEY = "ta_meta_leads_v1";
type Pixel = ((...args: unknown[]) => void) & {
  queue: unknown[][];
  callMethod?: (...args: unknown[]) => void;
  loaded: boolean;
  version: string;
  push?: Pixel;
  disablePushState: boolean;
};
declare global {
  interface Window {
    fbq?: Pixel;
    _fbq?: Pixel;
  }
}

export function pixelId() {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
  return process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "true" &&
    /^\d{5,30}$/.test(id)
    ? id
    : null;
}
export function publicPixelPath(path: string) {
  return !/^\/(dashboard|sign-in|api)(\/|$)/.test(path);
}
export function privacySignal() {
  return (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}
export function metaPreference(): "accepted" | "declined" | null {
  if (privacySignal()) return "declined";
  try {
    const saved = JSON.parse(
      localStorage.getItem(META_PREFERENCE_KEY) || "null",
    );
    return saved &&
      saved.until > Date.now() &&
      ["accepted", "declined"].includes(saved.choice)
      ? saved.choice
      : null;
  } catch {
    return null;
  }
}
export function saveMetaPreference(choice: "accepted" | "declined") {
  try {
    localStorage.setItem(
      META_PREFERENCE_KEY,
      JSON.stringify({ choice, until: Date.now() + 180 * 86400_000 }),
    );
  } catch {
    /* The current page can still update. */
  }
  if (choice === "declined") {
    window.fbq?.("consent", "revoke");
    // Remove cookies created by this site's optional Pixel integration.
    for (const name of ["_fbp", "_fbc"]) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
      const labels = location.hostname.split(".");
      for (let index = 0; index < labels.length - 1; index++)
        document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${labels.slice(index).join(".")}; SameSite=Lax`;
    }
  }
}
export function initializePixel(id: string) {
  if (!window.fbq) {
    const queue: unknown[][] = [];
    const pixel = ((...args: unknown[]) => {
      if (pixel.callMethod) pixel.callMethod(...args);
      else queue.push(args);
    }) as Pixel;
    Object.assign(pixel, {
      queue,
      loaded: true,
      version: "2.0",
      disablePushState: true,
    });
    pixel.push = pixel;
    window.fbq = pixel;
    window._fbq = pixel;
    pixel("set", "autoConfig", false, id);
    pixel("init", id);
  }
  window.fbq("consent", "grant");
}

export function trackMetaLead(eventId: unknown) {
  try {
    const id = pixelId();
    if (
      !id ||
      typeof eventId !== "string" ||
      !/^[a-f0-9]{64}$/.test(eventId) ||
      !publicPixelPath(location.pathname) ||
      metaPreference() !== "accepted" ||
      !window.fbq
    )
      return;
    let sent: string[] = [];
    try {
      sent = JSON.parse(sessionStorage.getItem(SENT_KEY) || "[]");
    } catch {
      /* Tracking remains best effort. */
    }
    if (sent.includes(eventId)) return;
    window.fbq("trackSingle", id, "Lead", {}, { eventID: eventId });
    try {
      sessionStorage.setItem(
        SENT_KEY,
        JSON.stringify([...sent.slice(-99), eventId]),
      );
    } catch {
      /* Never affect inquiry success. */
    }
  } catch {
    /* Advertising measurement must never interrupt lead intake. */
  }
}
