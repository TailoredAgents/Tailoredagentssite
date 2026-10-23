"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  initializePixel,
  metaPreference,
  pixelId,
  privacySignal,
  publicPixelPath,
  saveMetaPreference,
} from "@/lib/meta/pixel";
import styles from "./meta-pixel.module.css";

export function MetaPixel() {
  const path = usePathname();
  const id = pixelId();
  const [choice, setChoice] = useState<"accepted" | "declined" | null>(null);
  const [ready, setReady] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [signal, setSignal] = useState(false);
  const lastPage = useRef("");
  const publicPage = publicPixelPath(path);
  useEffect(() => {
    setChoice(metaPreference());
    setSignal(privacySignal());
    setReady(true);
    const refresh = () => {
      setChoice(metaPreference());
      setSignal(privacySignal());
    };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  useEffect(() => {
    if (!id || !ready) return;
    if (choice !== "accepted" || !publicPage || privacySignal()) {
      window.fbq?.("consent", "revoke");
      lastPage.current = "";
      return;
    }
    initializePixel(id);
    if (lastPage.current !== path) {
      window.fbq?.("trackSingle", id, "PageView");
      lastPage.current = path;
    }
    return () => {
      window.fbq?.("consent", "revoke");
    };
  }, [id, ready, choice, publicPage, path]);
  if (!id || !ready || !publicPage) return null;
  function choose(value: "accepted" | "declined") {
    saveMetaPreference(value);
    setChoice(value);
    setPreferencesOpen(false);
  }
  const show = choice === null || preferencesOpen;
  return (
    <>
      {choice === "accepted" && !signal && (
        <Script
          id="meta-pixel-library"
          src="https://connect.facebook.net/en_US/fbevents.js"
          strategy="afterInteractive"
        />
      )}
      {show ? (
        <section
          className={styles.panel}
          aria-label="Advertising cookie preferences"
        >
          <div>
            <strong>Your privacy preferences</strong>
            <p>
              Allow Meta cookies to help us measure our Facebook and Instagram
              ads? Your choice won’t affect contacting us.{" "}
              <Link href="/privacy">Privacy details</Link>
            </p>
            {signal && (
              <p>
                Your browser’s privacy signal keeps advertising measurement off.
              </p>
            )}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => choose("declined")}>
              No thanks
            </button>
            <button
              type="button"
              disabled={signal}
              onClick={() => choose("accepted")}
            >
              Allow Meta cookies
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          className={styles.preferences}
          onClick={() => setPreferencesOpen(true)}
        >
          Cookie preferences
        </button>
      )}
    </>
  );
}
