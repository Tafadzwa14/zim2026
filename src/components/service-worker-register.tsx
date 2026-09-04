"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker (`/sw.js`) once, after mount in
 * production. In development, it removes any worker left by a production run
 * so cached Turbopack chunks cannot fight HMR. Renders nothing.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // A worker registered by a production build can continue controlling the
    // same localhost origin after switching back to `next dev`. It may then
    // serve cached `/_next/static` chunks, which stops Fast Refresh from seeing
    // edits. Remove any such worker and reload once to release its control.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        if (registrations.length === 0) return;

        await Promise.all(registrations.map((registration) => registration.unregister()));
        if (navigator.serviceWorker.controller) window.location.reload();
      });
      return;
    }

    let reloading = false;

    // A newly activated worker does not replace the JavaScript already running
    // in this tab. Reload once it takes control so an open, installed app never
    // mixes a previous deployment's client bundle with the latest server build.
    const reloadForNewWorker = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", reloadForNewWorker);

    const activateWaitingWorker = (registration: ServiceWorkerRegistration) => {
      registration.waiting?.postMessage("SKIP_WAITING");
    };

    const register = () =>
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => {
          activateWaitingWorker(registration);

          const handleUpdate = () => {
            const installing = registration.installing;
            if (!installing) return;

            installing.addEventListener("statechange", () => {
              if (installing.state === "installed" && navigator.serviceWorker.controller) {
                activateWaitingWorker(registration);
              }
            });
          };

          registration.addEventListener("updatefound", handleUpdate);

          // Browsers may defer automatic worker checks for many hours. Check
          // immediately and whenever the person returns to the app instead.
          const checkForUpdate = () => {
            if (document.visibilityState === "visible") void registration.update();
          };
          checkForUpdate();
          window.addEventListener("focus", checkForUpdate);
          document.addEventListener("visibilitychange", checkForUpdate);
          const updateInterval = window.setInterval(checkForUpdate, 5 * 60 * 1000);

          return () => {
            registration.removeEventListener("updatefound", handleUpdate);
            window.removeEventListener("focus", checkForUpdate);
            document.removeEventListener("visibilitychange", checkForUpdate);
            window.clearInterval(updateInterval);
          };
        })
        .catch(() => {
          // Registration is best-effort; the app works without it.
        });

    // Wait for the page to settle so the worker install never competes with
    // the initial render.
    let cleanup: (() => void) | undefined;
    const start = () => {
      void register().then((dispose) => {
        if (typeof dispose === "function") cleanup = dispose;
      });
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    return () => {
      window.removeEventListener("load", start);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadForNewWorker);
      cleanup?.();
    };
  }, []);

  return null;
}
