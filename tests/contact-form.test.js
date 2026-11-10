import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../js/config.js";

class Element {
  listeners = new Map();
  dataset = {};
  textContent = "";
  disabled = false;

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type, event = {}) {
    return this.listeners.get(type)?.(event);
  }
}

class ContactForm extends Element {
  constructor(elements) {
    super();
    this.elements = elements;
    this.valid = true;
    this.resetCount = 0;
  }

  querySelector(selector) {
    return this.elements[selector];
  }

  checkValidity() {
    return this.valid;
  }

  reportValidity() {
    return this.valid;
  }

  reset() {
    this.resetCount += 1;
  }
}

test("the contact form requires valid fields and Turnstile, and reports success only after an OK API response", async () => {
  const previous = {
    contact: { ...config.contact },
    contactRetentionDays: config.legal.contactRetentionDays,
    contactLegalBasis: config.legal.contactLegalBasis,
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
    FormData: globalThis.FormData
  };
  config.contact.enabled = true;
  config.contact.legalSettingsApproved = true;
  config.contact.apiUrl = "/api/contact";
  config.contact.turnstileSiteKey = "0x4AAAAAAF7Td1S4Wd6MOzt-";
  config.legal.contactRetentionDays = 30;
  config.legal.contactLegalBasis = "test basis";

  const elements = {
    "#contact-fields": new Element(),
    "#contact-submit": new Element(),
    "#contact-result": new Element(),
    "#contact-turnstile": new Element()
  };
  const form = new ContactForm(elements);
  const availability = new Element();
  const intro = new Element();
  let turnstileOptions;
  let resetCount = 0;
  let fetchCount = 0;
  const responses = [
    { ok: true, json: async () => ({ ok: true }) },
    { ok: false, json: async () => ({ error: "service_unavailable" }) }
  ];

  globalThis.document = {
    querySelector(selector) {
      return {
        "#contact-form": form,
        "#contact-availability": availability,
        "#contact-intro": intro
      }[selector] ?? null;
    },
    head: { append() {} }
  };
  globalThis.window = {
    turnstile: {
      render(_widget, options) {
        turnstileOptions = options;
        return "widget-id";
      },
      getResponse() {
        return "test-token";
      },
      reset() {
        resetCount += 1;
      }
    }
  };
  globalThis.FormData = class {
    get(name) {
      return {
        reason: "question",
        email: "",
        message: "A contact form test message."
      }[name];
    }
  };
  globalThis.fetch = async () => responses[fetchCount++];

  try {
    await import(`../js/contact-form.js?test=${Date.now()}`);
    form.valid = false;
    form.valid = true;
    form.dispatch("input");
    assert.equal(elements["#contact-submit"].disabled, true);

    form.valid = false;
    turnstileOptions.callback("test-token");
    assert.equal(elements["#contact-submit"].disabled, true);

    form.valid = true;
    form.dispatch("input");
    assert.equal(elements["#contact-submit"].disabled, false);

    await form.dispatch("submit", { preventDefault() {} });
    assert.match(elements["#contact-result"].textContent, /Votre demande a bien été envoyée/);
    assert.equal(fetchCount, 1);
    assert.equal(resetCount, 1);
    assert.equal(form.resetCount, 1);

    turnstileOptions.callback("next-token");
    await form.dispatch("submit", { preventDefault() {} });
    assert.match(elements["#contact-result"].textContent, /momentanément indisponible/);
    assert.doesNotMatch(elements["#contact-result"].textContent, /bien été envoyée/);
    assert.equal(fetchCount, 2);
    assert.equal(resetCount, 2);
  } finally {
    Object.assign(config.contact, previous.contact);
    config.legal.contactRetentionDays = previous.contactRetentionDays;
    config.legal.contactLegalBasis = previous.contactLegalBasis;
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.fetch = previous.fetch;
    globalThis.FormData = previous.FormData;
  }
});
