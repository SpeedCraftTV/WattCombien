import test from "node:test";
import assert from "node:assert/strict";

class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { setProperty() {} };
    this.className = "";
    this.classList = {
      add: (name) => { this.className = `${this.className} ${name}`; },
      remove: (name) => { this.className = this.className.split(" ").filter((part) => part !== name).join(" "); }
    };
    this.value = "";
    this._text = "";
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this._text = ""; this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, [...(this.listeners.get(type) || []), listener]); }
  fire(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener(event); }
  focus() { globalThis.document.activeElement = this; }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  checkValidity() {
    if (this.value === "") return !this.required;
    if (this.type !== "number") return true;
    const value = Number(this.value);
    return Number.isFinite(value) && value >= Number(this.min) && value <= Number(this.max)
      && (this.step !== "1" || Number.isInteger(value));
  }
  querySelectorAll(selector) {
    const descendants = this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]);
    if (selector === "*") return descendants;
    if (selector === ".compare-card") return descendants.filter((child) => child.className.split(" ").includes("compare-card"));
    if (selector === "[data-key]") return descendants.filter((child) => child.dataset.key);
    return [];
  }
  querySelector(selector) {
    const [parentClass, tag] = selector.split(" ");
    const parent = this.querySelectorAll("*").find((child) => child.className.split(" ").includes(parentClass.slice(1)));
    return parent?.querySelectorAll("*").find((child) => child.tag === tag) ?? null;
  }
}

test("comparateur et sauvegardes restent synchronisés et protègent les données existantes", async (t) => {
  const previous = Object.fromEntries(["document", "window", "location", "localStorage", "requestAnimationFrame"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const selectors = {};
  for (const id of ["calculator-form", "form-error", "action-status", "results-title", "annual-cost", "annual-energy", "daily-cost", "weekly-cost", "monthly-cost", "cost-chart", "save-button", "reset-button", "copy-button", "share-button", "csv-button", "current-year", "comparison-list", "comparison-summary", "add-device", "saved-list", "saved-count", "saved-status", "clear-saved", "saved-estimates-title"]) {
    selectors[`#${id}`] = new Element();
  }
  selectors[".theme-toggle"] = new Element("button");
  selectors[".theme-label"] = new Element();
  const fields = {};
  for (const [name, id, value, min, max, step] of [
    ["name", "device-name", "", "", "", ""], ["power", "power", "300", "0", "1000000", "any"],
    ["hours", "hours", "4", "0", "24", "any"], ["days", "days", "5", "0", "7", "1"],
    ["price", "price", "0.20", "0", "10000", "any"], ["quantity", "quantity", "1", "1", "10000", "1"]
  ]) {
    const field = new Element("input");
    Object.assign(field, { name, value, defaultValue: value, min, max, step, type: name === "name" ? "text" : "number", required: name !== "name", labels: [{ textContent: name }] });
    fields[name] = selectors[`#${id}`] = field;
  }
  const form = selectors["#calculator-form"];
  form.elements = { namedItem: (name) => fields[name] };
  form.querySelectorAll = (selector) => Object.values(fields).filter((field) => selector === "input" || field.required);
  const callbacks = [];
  const browser = new Element();
  browser.location = { href: "http://localhost/?price=1" };
  browser.confirm = () => false;
  const data = new Map();
  const storage = {
    getItem(key) { if (this.failRead) throw new Error("blocked"); return data.get(key) ?? null; },
    setItem(key, value) { if (this.failWrite) throw new Error("full"); data.set(key, value); },
    removeItem(key) { if (this.failWrite) throw new Error("blocked"); data.delete(key); }
  };
  globalThis.document = {
    body: { dataset: {} }, head: new Element("head"), documentElement: { dataset: {} },
    querySelector: (selector) => selectors[selector] ?? null,
    createElement: (tag) => new Element(tag), createTextNode: (text) => { const node = new Element("#text"); node.textContent = text; return node; }
  };
  Object.assign(globalThis, { window: browser, location: { search: "?price=1" }, requestAnimationFrame: (fn) => callbacks.push(fn) });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
  const key = "wattcombien.saved-estimates";
  const savedList = selectors["#saved-list"];
  const savedStatus = selectors["#saved-status"];
  const comparison = selectors["#comparison-list"];
  const cardCost = () => comparison.children[0].querySelector(".compare-cost strong").textContent;
  const changePrice = (value) => { fields.price.value = value; fields.price.fire("input"); };
  const updateStorage = (value) => { data.set(key, value); browser.fire("storage", { key }); };
  const itemButton = (index, label) => savedList.children[index].querySelectorAll("*").find((node) => node.tag === "button" && node.textContent === label);
  try {
    await import("../js/app.js");
    await t.test("URL, prix vide ou hors limites, zéro et réinitialisation", () => {
      assert.equal(fields.price.value, "1");
      assert.match(cardCost(), /101,68/);
      changePrice("");
      assert.equal(cardCost(), "Tarif invalide");
      assert.match(selectors["#comparison-summary"].textContent, /prix du kWh valide/);
      assert.equal(comparison.children[0].getAttribute("aria-label"), null);
      assert.equal(selectors["#annual-cost"].textContent, "En attente");
      changePrice("10001");
      assert.equal(cardCost(), "Tarif invalide");
      changePrice("0");
      assert.match(cardCost(), /^0/);
      changePrice("1");
      form.fire("reset");
      for (const field of Object.values(fields)) field.value = field.defaultValue;
      callbacks.splice(0).forEach((fn) => fn());
      assert.match(cardCost(), /20,34/);
    });

    await t.test("sauvegarde, ancien format, restauration recalculée et suppression", () => {
      fields.name.value = "<img src=x onerror=alert(1)>";
      changePrice("0.5");
      selectors["#save-button"].fire("click");
      const entries = JSON.parse(data.get(key));
      assert.equal(entries.length, 1);
      assert.equal(savedList.children[0].children[0].textContent, fields.name.value);
      assert.equal(savedList.children[0].querySelectorAll("*").some((node) => node.tag === "img"), false);
      entries[0].annualCost = -500;
      updateStorage(JSON.stringify(entries));
      changePrice("1");
      itemButton(0, "Restaurer").fire("click");
      assert.equal(fields.price.value, "0.5");
      assert.match(cardCost(), /50,84/);
      assert.match(selectors["#annual-cost"].textContent, /156,43/);
      assert.match(savedStatus.textContent, /recalculés/);
      itemButton(0, "Supprimer").fire("click");
      assert.deepEqual(JSON.parse(data.get(key)), []);
      assert.equal(globalThis.document.activeElement, selectors["#saved-estimates-title"]);
    });

    await t.test("limite, entrée invalide, corruption et confirmation sans perte silencieuse", () => {
      const valid = { name: "Ancienne", power: 100, hours: 2, days: 7, price: 0.2, quantity: 1, annualCost: 999 };
      const full = Array.from({ length: 20 }, () => valid);
      const raw = JSON.stringify(full);
      updateStorage(raw);
      selectors["#save-button"].fire("click");
      assert.equal(data.get(key), raw);
      assert.match(savedStatus.textContent, /limite atteinte/i);
      updateStorage(JSON.stringify([valid, { ...valid, quantity: 0 }]));
      assert.match(savedList.children[1].textContent, /illisible/);
      assert.equal(itemButton(1, "Restaurer"), undefined);
      itemButton(1, "Supprimer").fire("click");
      assert.deepEqual(JSON.parse(data.get(key)), [valid]);
      const staleDelete = itemButton(0, "Supprimer");
      data.set(key, JSON.stringify([{ ...valid, name: "Modifiée ailleurs" }]));
      staleDelete.fire("click");
      assert.equal(JSON.parse(data.get(key))[0].name, "Modifiée ailleurs");
      assert.match(savedStatus.textContent, /historique a changé/i);
      updateStorage(JSON.stringify([valid, ...[
        { ...valid, power: 1000001 }, { ...valid, price: "0.2" },
        { ...valid, hours: 25 }, { ...valid, days: 1.5 }, { ...valid, quantity: 10001 }
      ]]));
      for (const item of savedList.children.slice(1)) assert.match(item.textContent, /illisible/);
      for (const corrupt of ["{", "null"]) {
        updateStorage(corrupt);
        assert.match(savedStatus.textContent, /illisible/);
        selectors["#save-button"].fire("click");
        assert.equal(data.get(key), corrupt);
        selectors["#clear-saved"].fire("click");
        assert.equal(data.get(key), corrupt);
      }
      browser.confirm = () => true;
      selectors["#clear-saved"].fire("click");
      assert.equal(data.has(key), false);
    });

    await t.test("erreurs de lecture et d’écriture sont visibles", () => {
      storage.failWrite = true;
      selectors["#save-button"].fire("click");
      assert.match(savedStatus.textContent, /indisponible ou plein/);
      assert.equal(data.has(key), false);
      storage.failWrite = false;
      storage.failRead = true;
      browser.fire("storage", { key });
      assert.match(savedStatus.textContent, /indisponible ou plein/);
      assert.equal(selectors["#clear-saved"].disabled, true);
    });
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
