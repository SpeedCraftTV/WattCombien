import test from "node:test";
import assert from "node:assert/strict";

test("les simulateurs d’appareils associent les erreurs aux champs et les effacent après correction", async () => {
  const previousDocument = globalThis.document;
  const fields = Object.fromEntries([
    ["power", "Puissance moyenne (W)", "450"],
    ["hours", "Heures de jeu par jour actif", "3"],
    ["days", "Jours par semaine", "5"],
    ["price", "Prix de l’électricité (€/kWh)", "0.20"],
    ["quantity", "Configurations identiques", "1"]
  ].map(([name, label, value]) => {
    const attributes = new Map(name === "power" ? [["aria-describedby", "power-help"]] : []);
    return [name, {
      name, value, labels: [{ textContent: label }], valid: true,
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: (key) => attributes.delete(key),
      checkValidity() { return this.valid; }
    }];
  }));
  let update;
  const form = {
    elements: { namedItem: (name) => fields[name] },
    addEventListener: (_event, listener) => { update = listener; }
  };
  const error = { id: "simulator-error", textContent: "" };
  const output = { innerHTML: "" };
  globalThis.document = {
    body: { dataset: {} },
    querySelector: (selector) => selector.startsWith('meta[property=')
      ? {}
      : ({
        "#simulator-form": form, "#simulator-error": error, "#simulator-output": output
      })[selector] ?? null
  };
  try {
    await import("../js/simulator.js");
    assert.equal(fields.power.getAttribute("aria-describedby"), "power-help simulator-error");
    assert.match(output.innerHTML, /\/ an/);
    fields.power.value = "";
    fields.hours.valid = false;
    update();
    assert.match(error.textContent, /Puissance moyenne \(W\)/);
    assert.equal(fields.power.getAttribute("aria-invalid"), "true");
    assert.equal(fields.hours.getAttribute("aria-invalid"), "true");
    assert.match(output.innerHTML, /Corrigez les valeurs/);
    fields.power.value = "450";
    fields.hours.valid = true;
    update();
    assert.equal(error.textContent, "");
    assert.equal(fields.power.getAttribute("aria-invalid"), null);
    assert.equal(fields.hours.getAttribute("aria-invalid"), null);
    assert.match(output.innerHTML, /\/ an/);
  } finally {
    globalThis.document = previousDocument;
  }
});
