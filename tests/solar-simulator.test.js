import test from "node:test";
import assert from "node:assert/strict";

test("le simulateur solaire actualise les résultats et valide la vente facultative", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const fields = Object.fromEntries([
    ["capacityKwp", 1000000, true], ["annualYield", 100000, true],
    ["selfConsumptionPercent", 100, true], ["purchasePrice", 10000, true],
    ["salePrice", 10000, true], ["installationCost", 1000000000, false]
  ].map(([name, max, required]) => {
    const attributes = new Map();
    return [name, {
      name, value: "", required, disabled: name === "salePrice", labels: [{ textContent: name }],
      setAttribute: (key, value) => attributes.set(key, value),
      removeAttribute: (key) => attributes.delete(key),
      getAttribute: (key) => attributes.get(key) ?? null,
      checkValidity() {
        return this.value === "" || (Number.isFinite(Number(this.value)) && Number(this.value) >= 0 && Number(this.value) <= max);
      }
    }];
  }));
  fields.saleEnabled = { checked: false };
  const listeners = new Map();
  const form = {
    elements: { namedItem: (name) => fields[name] },
    addEventListener: (type, listener) => listeners.set(type, listener)
  };
  const nodes = Object.fromEntries([
    "solar-error", "solar-sale-fields", "solar-production", "solar-consumed", "solar-surplus",
    "solar-savings", "solar-revenue", "solar-gain", "solar-payback"
  ].map((id) => [`#${id}`, { textContent: "", hidden: id === "solar-sale-fields" }]));
  globalThis.document = {
    body: { dataset: {} }, head: { append() {} },
    querySelector: (selector) => selector === "#solar-form" ? form : nodes[selector] ?? null,
    createElement: () => ({ setAttribute() {} })
  };
  const update = () => listeners.get("input")();
  try {
    await import("../js/solar-simulator.js");
    Object.assign(fields.capacityKwp, { value: "3" });
    Object.assign(fields.annualYield, { value: "1100" });
    Object.assign(fields.selfConsumptionPercent, { value: "40" });
    Object.assign(fields.purchasePrice, { value: "0.25" });
    Object.assign(fields.installationCost, { value: "6000" });
    update();
    assert.match(nodes["#solar-production"].textContent, /3[   ]300 kWh/);
    assert.match(nodes["#solar-consumed"].textContent, /1[   ]320 kWh/);
    assert.match(nodes["#solar-surplus"].textContent, /1[   ]980 kWh/);
    assert.match(nodes["#solar-gain"].textContent, /330/);
    assert.match(nodes["#solar-revenue"].textContent, /vente désactivée/);
    fields.saleEnabled.checked = true;
    update();
    assert.equal(nodes["#solar-sale-fields"].hidden, false);
    assert.equal(fields.salePrice.disabled, false);
    assert.equal(fields.salePrice.getAttribute("aria-invalid"), "true");
    assert.equal(nodes["#solar-gain"].textContent, "En attente");
    fields.salePrice.value = "0.1";
    update();
    assert.equal(fields.salePrice.getAttribute("aria-invalid"), null);
    assert.match(nodes["#solar-revenue"].textContent, /198/);
    assert.match(nodes["#solar-gain"].textContent, /528/);
    assert.match(nodes["#solar-payback"].textContent, /11,36 ans/);
    fields.selfConsumptionPercent.value = "101";
    update();
    assert.equal(fields.selfConsumptionPercent.getAttribute("aria-invalid"), "true");
    assert.equal(nodes["#solar-production"].textContent, "En attente");
    fields.selfConsumptionPercent.value = "40";
    fields.salePrice.value = "-1";
    fields.saleEnabled.checked = false;
    fields.installationCost.value = "";
    update();
    assert.equal(fields.salePrice.disabled, true);
    assert.equal(fields.salePrice.getAttribute("aria-invalid"), null);
    assert.match(nodes["#solar-gain"].textContent, /330/);
    assert.equal(nodes["#solar-payback"].textContent, "Coût initial non renseigné");
    fields.capacityKwp.value = "0";
    fields.installationCost.value = "0";
    update();
    assert.equal(nodes["#solar-payback"].textContent, "Non calculable : gain annuel nul");
    fields.capacityKwp.value = "0.001";
    fields.annualYield.value = "1";
    fields.selfConsumptionPercent.value = "100";
    fields.installationCost.value = "0.000001";
    update();
    assert.match(nodes["#solar-production"].textContent, /< 0,01 kWh/);
    assert.match(nodes["#solar-gain"].textContent, /< 0,01 €/);
    assert.equal(nodes["#solar-payback"].textContent, "Moins de 0,01 an");
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else delete globalThis.document;
  }
});
