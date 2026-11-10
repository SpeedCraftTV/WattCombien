import { config } from "./config.js";
import { grantsWebAnalyticsConsent, subscribeToTcfConsent } from "./consent.js";

const SCRIPT_ID = "wattcombien-cloudflare-analytics";

function loadCloudflareAnalytics() {
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.type = "module";
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token: config.cloudflareAnalytics.token });
  document.head.append(script);
}

if (typeof window !== "undefined" && typeof document !== "undefined"
  && config.cloudflareAnalytics.enabled && /^[a-f0-9]{32}$/i.test(config.cloudflareAnalytics.token)) {
  subscribeToTcfConsent((tcData, success) => {
    if (success && grantsWebAnalyticsConsent(tcData)) loadCloudflareAnalytics();
  });
}
