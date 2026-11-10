const ADVERTISING_PURPOSES = ["1", "3", "4"];
const CLARITY_ANALYTICS_PURPOSES = ["1", "8"];
const GOOGLE_ADSENSE_VENDOR_ID = 755;

const listeners = new Set();
let listening = false;
let latestConsent;

function isCompletedChoice(tcData) {
  return tcData && ["tcloaded", "useractioncomplete"].includes(tcData.eventStatus);
}

export function grantsAdsConsent(tcData) {
  if (!isCompletedChoice(tcData)) return false;
  if (tcData.gdprApplies === false) return true;
  if (tcData.gdprApplies !== true) return false;

  return ADVERTISING_PURPOSES.every((purpose) => tcData.purpose?.consents?.[purpose] === true)
    && tcData.vendor?.consents?.[GOOGLE_ADSENSE_VENDOR_ID] === true;
}

export function grantsClarityAnalyticsConsent(tcData) {
  return grantsWebAnalyticsConsent(tcData);
}

export function grantsWebAnalyticsConsent(tcData) {
  if (!isCompletedChoice(tcData)) return false;

  return CLARITY_ANALYTICS_PURPOSES.every((purpose) => tcData.purpose?.consents?.[purpose] === true);
}

export function subscribeToTcfConsent(listener) {
  let receivedDuringSubscribe = false;
  const subscriber = (tcData, success) => {
    receivedDuringSubscribe = true;
    listener(tcData, success);
  };
  listeners.add(subscriber);

  if (!listening && typeof window !== "undefined" && typeof window.__tcfapi === "function") {
    listening = true;
    window.__tcfapi("addEventListener", 2, (tcData, success) => {
      latestConsent = { tcData, success };
      for (const notify of [...listeners]) notify(tcData, success);
    });
  }

  if (latestConsent && !receivedDuringSubscribe) {
    subscriber(latestConsent.tcData, latestConsent.success);
  }
  return () => listeners.delete(subscriber);
}
