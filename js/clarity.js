import { config } from "./config.js";
import { grantsClarityAnalyticsConsent, subscribeToTcfConsent } from "./consent.js";

const SCRIPT_ID = "wattcombien-clarity-script";

function queueConsent(analyticsGranted) {
  window.clarity = window.clarity || function clarity(...args) {
    (window.clarity.q = window.clarity.q || []).push(args);
  };
  window.clarity("consentv2", {
    analytics_Storage: analyticsGranted ? "granted" : "denied",
    ad_Storage: "denied"
  });
}

function loadClarity(analyticsGranted) {
  queueConsent(analyticsGranted);
  if (!analyticsGranted || document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(config.clarity.projectId)}`;
  document.head.append(script);
}

if (typeof window !== "undefined" && typeof document !== "undefined"
  && config.clarity.enabled && /^[a-z0-9]+$/i.test(config.clarity.projectId)) {
  subscribeToTcfConsent((tcData, success) => {
    if (!success) return;
    loadClarity(grantsClarityAnalyticsConsent(tcData));
  });
}
