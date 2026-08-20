"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (`/sw.js`) once, after mount. Only runs
 * in production builds — in dev, a service worker would cache Turbopack chunks
 * and fight HMR. Renders nothing. Test with `npm run build && npm start`.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Registration is best-effort; the app works without it.
        });
    };

    // Wait for the page to settle so the worker install never competes with
    // the initial render.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
