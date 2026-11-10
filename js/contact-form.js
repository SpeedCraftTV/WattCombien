import { config } from "./config.js";

const form = document.querySelector("#contact-form");
const availability = document.querySelector("#contact-availability");

if (form && availability) {
  const fieldset = form.querySelector("#contact-fields");
  const submitButton = form.querySelector("#contact-submit");
  const result = form.querySelector("#contact-result");
  const widget = form.querySelector("#contact-turnstile");
  const intro = document.querySelector("#contact-intro");
  const ready = config.contact.enabled
    && (/^\/api\/contact$/.test(config.contact.apiUrl)
      || /^https:\/\/[a-z0-9.-]+(?::\d+)?\/api\/contact$/i.test(config.contact.apiUrl))
    && config.contact.turnstileSiteKey === "0x4AAAAAAF7Td1S4Wd6MOzt-"
    && Number.isInteger(config.legal.contactRetentionDays)
    && config.legal.contactRetentionDays > 0
    && typeof config.legal.contactLegalBasis === "string"
    && config.legal.contactLegalBasis.trim().length > 0;
  let widgetId;
  let turnstileLoading = false;
  let submitting = false;

  function setResult(message, state = "") {
    result.textContent = message;
    if (state) result.dataset.state = state;
    else delete result.dataset.state;
  }

  if (!ready) {
    fieldset.disabled = true;
  } else {
    intro.textContent = "Utilisez ce formulaire pour nous envoyer votre demande.";
    availability.textContent = "Le formulaire est prêt. Les informations envoyées seront utilisées uniquement pour traiter votre demande.";
    fieldset.disabled = false;
    submitButton.disabled = true;

    function renderTurnstile() {
      try {
        widgetId = window.turnstile.render(widget, {
          sitekey: config.contact.turnstileSiteKey,
          action: "contact",
          callback: () => { submitButton.disabled = false; },
          "expired-callback": () => {
            submitButton.disabled = true;
            setResult("La vérification a expiré. Veuillez la renouveler.");
          },
          "error-callback": () => {
            submitButton.disabled = true;
            setResult("La vérification anti-robot est momentanément indisponible. Réessayez plus tard.", "error");
          }
        });
      } catch {
        availability.textContent = "La vérification anti-robot ne peut pas être initialisée. Le formulaire reste indisponible.";
        fieldset.disabled = true;
        setResult("Impossible d’initialiser la vérification anti-robot. Réessayez plus tard.", "error");
      }
    }

    fieldset.addEventListener("focusin", () => {
      if (turnstileLoading || window.turnstile) return;
      turnstileLoading = true;
      const turnstileScript = document.createElement("script");
      turnstileScript.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      turnstileScript.async = true;
      turnstileScript.defer = true;
      turnstileScript.addEventListener("load", renderTurnstile, { once: true });
      turnstileScript.onerror = () => {
        availability.textContent = "La vérification anti-robot ne peut pas être chargée. Le formulaire reste indisponible.";
        fieldset.disabled = true;
        setResult("Impossible de charger la vérification anti-robot. Réessayez plus tard.", "error");
      };
      document.head.append(turnstileScript);
    }, { once: true });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submitting) return;
      if (!form.reportValidity() || widgetId === undefined) return;

      const token = window.turnstile.getResponse(widgetId);
      if (!token) {
        setResult("Veuillez terminer la vérification anti-robot.", "error");
        return;
      }

      submitting = true;
      submitButton.disabled = true;
      setResult("Envoi en cours…");
      const formData = new FormData(form);
      const payload = {
        reason: formData.get("reason"),
        email: formData.get("email"),
        message: formData.get("message"),
        turnstileToken: token
      };

      try {
        const response = await fetch(config.contact.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const responseBody = await response.json().catch(() => ({}));

        if (!response.ok) {
          const messages = {
            invalid_request: "Vérifiez le motif, l’adresse e-mail et le contenu du message.",
            captcha_failed: "La vérification a échoué. Veuillez la refaire.",
            rate_limited: "Trop de demandes ont été envoyées récemment. Réessayez plus tard.",
            service_unavailable: "Le service de contact est momentanément indisponible. Réessayez plus tard."
          };
          throw new Error(messages[responseBody.error] ?? "La demande n’a pas pu être envoyée. Réessayez plus tard.");
        }

        form.reset();
        setResult("Votre demande a bien été envoyée. Merci de nous avoir contactés.", "success");
      } catch (error) {
        setResult(error instanceof TypeError
          ? "Une erreur de connexion empêche l’envoi. Vérifiez votre connexion et réessayez."
          : error.message, "error");
      } finally {
        window.turnstile.reset(widgetId);
        submitting = false;
        submitButton.disabled = true;
      }
    });
  }
}
