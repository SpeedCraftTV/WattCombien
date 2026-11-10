import test from "node:test";
import assert from "node:assert/strict";
import {
  grantsAdsConsent,
  grantsClarityAnalyticsConsent,
  grantsWebAnalyticsConsent,
  subscribeToTcfConsent
} from "../js/consent.js";

const grantedConsent = {
  eventStatus: "useractioncomplete",
  gdprApplies: true,
  purpose: { consents: { 1: true, 3: true, 4: true } },
  vendor: { consents: { 755: true } }
};

test("AdSense requires a completed CMP decision and consent for required purposes and Google", () => {
  assert.equal(grantsAdsConsent(grantedConsent), true);
  assert.equal(grantsAdsConsent({ ...grantedConsent, eventStatus: "cmpuishown" }), false);
  assert.equal(grantsAdsConsent({ ...grantedConsent, purpose: { consents: { 1: true, 3: false, 4: true } } }), false);
  assert.equal(grantsAdsConsent({ ...grantedConsent, vendor: { consents: { 755: false } } }), false);
  assert.equal(grantsAdsConsent({ ...grantedConsent, gdprApplies: undefined }), false);
  assert.equal(grantsAdsConsent(undefined), false);
});

test("AdSense can load outside GDPR scope only after a completed TCF decision", () => {
  assert.equal(grantsAdsConsent({ eventStatus: "tcloaded", gdprApplies: false }), true);
  assert.equal(grantsAdsConsent({ eventStatus: "cmpuishown", gdprApplies: false }), false);
});

test("Clarity requires completed consent to device storage and analytics measurement", () => {
  assert.equal(grantsClarityAnalyticsConsent({
    eventStatus: "useractioncomplete",
    gdprApplies: true,
    purpose: { consents: { 1: true, 8: true } }
  }), true);
  assert.equal(grantsClarityAnalyticsConsent({
    eventStatus: "tcloaded",
    gdprApplies: true,
    purpose: { consents: { 1: true, 8: false } }
  }), false);
  assert.equal(grantsClarityAnalyticsConsent({
    eventStatus: "useractioncomplete",
    gdprApplies: false,
    purpose: { consents: { 1: true, 8: false } }
  }), false);
});

test("Cloudflare Web Analytics requires a completed choice and analytics consent", () => {
  const consent = {
    eventStatus: "useractioncomplete",
    purpose: { consents: { 1: true, 8: true } }
  };
  assert.equal(grantsWebAnalyticsConsent(consent), true);
  assert.equal(grantsWebAnalyticsConsent({ ...consent, eventStatus: "cmpuishown" }), false);
  assert.equal(grantsWebAnalyticsConsent({
    ...consent,
    purpose: { consents: { 1: true, 8: false } }
  }), false);
  assert.equal(grantsWebAnalyticsConsent(undefined), false);
});

test("the analytics and advertising integrations share one TCF listener and replay its current choice", () => {
  const callbacks = [];
  const originalWindow = globalThis.window;
  const initialConsent = { eventStatus: "tcloaded" };
  const updatedConsent = { eventStatus: "useractioncomplete" };
  globalThis.window = {
    __tcfapi: (command, version, callback) => {
      callbacks.push(callback);
      callback(initialConsent, true);
    }
  };
  const analyticsChoices = [];
  const advertisingChoices = [];

  try {
    const unsubscribeAnalytics = subscribeToTcfConsent((data, success) => analyticsChoices.push([data, success]));
    const unsubscribeAdvertising = subscribeToTcfConsent((data, success) => advertisingChoices.push([data, success]));

    assert.equal(callbacks.length, 1);
    assert.deepEqual(analyticsChoices, [[initialConsent, true]]);
    assert.deepEqual(advertisingChoices, [[initialConsent, true]]);
    callbacks[0](updatedConsent, true);
    assert.deepEqual(analyticsChoices, [[initialConsent, true], [updatedConsent, true]]);
    assert.deepEqual(advertisingChoices, [[initialConsent, true], [updatedConsent, true]]);
    unsubscribeAnalytics();
    unsubscribeAdvertising();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
