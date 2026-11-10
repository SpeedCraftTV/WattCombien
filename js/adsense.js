import { config } from "./config.js";

const GOOGLE_ADSENSE_VENDOR_ID = 755;
const ADVERTISING_PURPOSES = ["1", "3", "4"];
const SCRIPT_ID = "wattcombien-adsense-script";

export function grantsAdsConsent(tcData) {
  if (!tcData || !["tcloaded", "useractioncomplete"].includes(tcData.eventStatus)) return false;
  if (tcData.gdprApplies === false) return true;
  if (tcData.gdprApplies !== true) return false;

  return ADVERTISING_PURPOSES.every((purpose) => tcData.purpose?.consents?.[purpose] === true)
    && tcData.vendor?.consents?.[GOOGLE_ADSENSE_VENDOR_ID] === true;
}

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
  if (typeof window.__tcfapi === "function") {
    window.__tcfapi("addEventListener", 2, (tcData, success) => {
      if (success && grantsAdsConsent(tcData)) loadAdSense();
    });
  } else {
    console.info("AdSense reste inactif : aucune CMP compatible TCF 2.2 n’est configurée.");
  }
}
