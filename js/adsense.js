import { config } from "./config.js";
import { grantsAdsConsent, subscribeToTcfConsent } from "./consent.js";
import "./clarity.js";
const SCRIPT_ID = "wattcombien-adsense-script";

function loadAdSense() {
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.adsense.publisherId)}`;
  document.head.append(script);
}

if (typeof window !== "undefined" && typeof document !== "undefined"
  && config.adsense.enabled && /^ca-pub-\d+$/.test(config.adsense.publisherId)) {
  subscribeToTcfConsent((tcData, success) => {
    if (success && grantsAdsConsent(tcData)) loadAdSense();
  });

  if (typeof window.__tcfapi !== "function") {
    console.info("AdSense reste inactif : aucune CMP compatible TCF 2.2 n’est configurée.");
  }
}
