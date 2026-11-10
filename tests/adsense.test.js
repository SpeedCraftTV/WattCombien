import test from "node:test";
import assert from "node:assert/strict";
import { grantsAdsConsent } from "../js/adsense.js";

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
