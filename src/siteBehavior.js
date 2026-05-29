const landingLogo = "/assets/logo-lg.svg";
const contactLogo = "/assets/logo-cf-lg.svg";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumSubmitDelayMs = 2500;

const copy = {
  en: {
    requiredFullName: "Enter your full name.",
    requiredEmail: "Enter your email address.",
    invalidEmail: "Enter a valid email address.",
    invalidPhone: "Enter a valid phone number or leave the field blank.",
    requiredCompany: "Enter your company or institution.",
    requiredConsent: "Please agree to the contact consent.",
    tooShort: (minimum) => `Please enter at least ${minimum} characters.`,
    tooLong: (maximum) => `Please keep this to ${maximum} characters or fewer.`,
    reviewErrors: "Review the highlighted fields and try again.",
    sendFailed: "We couldn't send your request right now. Please try again in a few minutes.",
    loadingFallback: "Sending request...",
  },
  de: {
    requiredFullName: "Bitte geben Sie Ihren vollständigen Namen ein.",
    requiredEmail: "Bitte geben Sie Ihre E-Mail-Adresse ein.",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    invalidPhone: "Bitte geben Sie eine gültige Telefonnummer ein oder lassen Sie das Feld leer.",
    requiredCompany: "Bitte geben Sie Ihr Unternehmen oder Ihre Institution ein.",
    requiredConsent: "Bitte stimmen Sie der Kontaktaufnahme zu.",
    tooShort: (minimum) => `Bitte geben Sie mindestens ${minimum} Zeichen ein.`,
    tooLong: (maximum) => `Bitte verwenden Sie höchstens ${maximum} Zeichen.`,
    reviewErrors: "Bitte prüfen Sie die markierten Felder und versuchen Sie es erneut.",
    sendFailed: "Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es in ein paar Minuten erneut.",
    loadingFallback: "Anfrage wird gesendet...",
  },
};

const limits = {
  fullName: { min: 2, max: 120 },
  email: { max: 160 },
  phone: { max: 30 },
  company: { min: 2, max: 160 },
  details: { max: 2000 },
};

const normalizeSingleLine = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeMultiline = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();

function isPhoneValid(value) {
  const trimmedValue = String(value ?? "").trim();

  if (!trimmedValue) {
    return true;
  }

  if (/[^\d+().\-\/\s]/.test(trimmedValue)) {
    return false;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function initializeMatiqSite() {
  const nav = document.getElementById("nav");
  const langWrap = document.getElementById("langWrap");
  const success = document.getElementById("cfSuccess");
  const contactForm = document.getElementById("contactForm");
  const formStartedAtInput = document.getElementById("cfFormStartedAt");
  const detailsInput = document.getElementById("cfDetails");
  const detailsCounter = document.getElementById("cfDetailsCounter");
  const statusElement = document.getElementById("cfFormStatus");
  const submitButton = document.getElementById("cfSubmit");
  const submitText = submitButton?.querySelector(".cf-submit-text");
  const langLabel = document.getElementById("langLabel");
  const optEn = document.getElementById("opt-en");
  const optDe = document.getElementById("opt-de");
  let lang = document.documentElement.lang === "de" ? "de" : "en";
  let hasAttemptedSubmit = false;
  let isSubmitting = false;
  let hasSubmittedSuccessfully = false;
  const touchedFields = new Set();

  const fieldMap = {
    fullName: {
      input: document.getElementById("cfFullName"),
      error: document.getElementById("cfFullNameError"),
      container: document.querySelector('[data-field="fullName"]'),
    },
    email: {
      input: document.getElementById("cfEmail"),
      error: document.getElementById("cfEmailError"),
      container: document.querySelector('[data-field="email"]'),
    },
    phone: {
      input: document.getElementById("cfPhone"),
      error: document.getElementById("cfPhoneError"),
      container: document.querySelector('[data-field="phone"]'),
    },
    company: {
      input: document.getElementById("cfCompany"),
      error: document.getElementById("cfCompanyError"),
      container: document.querySelector('[data-field="company"]'),
    },
    details: {
      input: detailsInput,
      error: document.getElementById("cfDetailsError"),
      container: document.querySelector('[data-field="details"]'),
    },
    consent: {
      input: document.getElementById("cfConsent"),
      error: document.getElementById("cfConsentError"),
      container: document.querySelector('[data-field="consent"]'),
    },
  };

  const onScroll = () => {
    nav?.classList.toggle("scrolled", window.scrollY > 20);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
        }
      });
    },
    { threshold: 0.07 },
  );

  const observeReveals = (selector = ".reveal") => {
    document
      .querySelectorAll(selector)
      .forEach((element) => observer.observe(element));
  };

  const getCopy = () => copy[lang];

  const getSubmitLabel = (state = "idle") => {
    if (!submitText) {
      return "";
    }

    const attributeName = state === "loading" ? `data-${lang}-loading` : `data-${lang}`;
    return submitText.getAttribute(attributeName) || getCopy().loadingFallback;
  };

  const setStatus = (message = "", state = "") => {
    if (!statusElement) {
      return;
    }

    statusElement.textContent = message;
    if (state) {
      statusElement.dataset.state = state;
      return;
    }

    delete statusElement.dataset.state;
  };

  const setFieldError = (fieldName, message = "") => {
    const field = fieldMap[fieldName];
    if (!field) {
      return;
    }

    field.error.textContent = message;
    field.container?.classList.toggle("is-invalid", Boolean(message));

    if (field.input) {
      field.input.setAttribute("aria-invalid", String(Boolean(message)));
    }
  };

  const clearValidationState = () => {
    Object.keys(fieldMap).forEach((fieldName) => setFieldError(fieldName));
    setStatus();
  };

  const updateDetailsCounter = () => {
    if (!detailsCounter || !detailsInput) {
      return;
    }

    const currentLength = detailsInput.value.length;
    detailsCounter.textContent = `${currentLength} / ${limits.details.max}`;
    detailsCounter.classList.toggle("is-near-limit", currentLength >= 0.9 * limits.details.max);
  };

  const setSubmitState = (nextState) => {
    isSubmitting = nextState;
    contactForm?.classList.toggle("is-submitting", nextState);
    submitButton?.toggleAttribute("disabled", nextState);
    submitButton?.setAttribute("aria-busy", String(nextState));
    submitText && (submitText.textContent = getSubmitLabel(nextState ? "loading" : "idle"));

    contactForm
      ?.querySelectorAll("input, textarea, button")
      .forEach((element) => {
        element.disabled = nextState;
      });
  };

  const closeLang = () => {
    langWrap?.classList.remove("open");
  };

  const applyLang = () => {
    document.querySelectorAll("[data-en]").forEach((element) => {
      const value = element.getAttribute(`data-${lang}`);
      if (value !== null) {
        element.textContent = value;
      }
    });

    document.querySelectorAll("[data-en-html]").forEach((element) => {
      const value = element.getAttribute(`data-${lang}-html`);
      if (value !== null) {
        element.innerHTML = value;
      }
    });

    if (submitText) {
      submitText.textContent = getSubmitLabel(isSubmitting ? "loading" : "idle");
    }
  };

  const toggleLang = () => {
    langWrap?.classList.toggle("open");
  };

  const setLang = (nextLang) => {
    lang = nextLang;
    closeLang();
    langLabel.textContent = nextLang.toUpperCase();
    optEn.classList.toggle("active", nextLang === "en");
    optDe.classList.toggle("active", nextLang === "de");
    document.documentElement.lang = nextLang;
    applyLang();
    updateDetailsCounter();
  };

  const clearFormForRetry = () => {
    if (!contactForm || hasSubmittedSuccessfully) {
      return;
    }

    contactForm.hidden = false;
    success?.classList.remove("show");
    clearValidationState();
  };

  const showPage = (name) => {
    document
      .querySelectorAll(".page")
      .forEach((page) => page.classList.remove("active"));
    document.getElementById(`page-${name}`)?.classList.add("active");
    window.scrollTo(0, 0);

    if (name === "landing") {
      document.querySelectorAll("#page-landing .reveal").forEach((element) => {
        element.classList.remove("in");
        observer.unobserve(element);
        observer.observe(element);
      });
    }

    if (name === "contact" && !hasSubmittedSuccessfully) {
      clearFormForRetry();
    }

    const navLogo = document.getElementById("navLogoImg");
    if (navLogo) {
      navLogo.src = name === "contact" ? contactLogo : landingLogo;
    }
  };

  const getFieldError = (fieldName) => {
    const messages = getCopy();
    const field = fieldMap[fieldName];
    const rawValue = fieldName === "consent" ? field.input.checked : field.input.value;

    switch (fieldName) {
      case "fullName": {
        const value = normalizeSingleLine(rawValue);
        if (!value) {
          return messages.requiredFullName;
        }
        if (value.length < limits.fullName.min) {
          return messages.tooShort(limits.fullName.min);
        }
        if (value.length > limits.fullName.max) {
          return messages.tooLong(limits.fullName.max);
        }
        return "";
      }

      case "email": {
        const value = normalizeSingleLine(rawValue).toLowerCase();
        if (!value) {
          return messages.requiredEmail;
        }
        if (value.length > limits.email.max) {
          return messages.tooLong(limits.email.max);
        }
        if (!emailPattern.test(value)) {
          return messages.invalidEmail;
        }
        return "";
      }

      case "phone": {
        const value = normalizeSingleLine(rawValue);
        if (value.length > limits.phone.max) {
          return messages.tooLong(limits.phone.max);
        }
        if (!isPhoneValid(value)) {
          return messages.invalidPhone;
        }
        return "";
      }

      case "company": {
        const value = normalizeSingleLine(rawValue);
        if (!value) {
          return messages.requiredCompany;
        }
        if (value.length < limits.company.min) {
          return messages.tooShort(limits.company.min);
        }
        if (value.length > limits.company.max) {
          return messages.tooLong(limits.company.max);
        }
        return "";
      }

      case "details": {
        const value = normalizeMultiline(rawValue);
        if (value.length > limits.details.max) {
          return messages.tooLong(limits.details.max);
        }
        return "";
      }

      case "consent":
        return rawValue ? "" : messages.requiredConsent;

      default:
        return "";
    }
  };

  const validateField = (fieldName, forceDisplay = false) => {
    const shouldDisplay = forceDisplay || hasAttemptedSubmit || touchedFields.has(fieldName);
    const message = getFieldError(fieldName);

    if (shouldDisplay || !message) {
      setFieldError(fieldName, message);
    }

    return !message;
  };

  const validateForm = () => {
    hasAttemptedSubmit = true;
    let firstInvalidField = null;

    Object.keys(fieldMap).forEach((fieldName) => {
      const isValid = validateField(fieldName, true);
      if (!isValid && !firstInvalidField) {
        firstInvalidField = fieldMap[fieldName].input;
      }
    });

    if (firstInvalidField) {
      setStatus(getCopy().reviewErrors, "error");
      firstInvalidField.focus();
      return false;
    }

    setStatus();
    return true;
  };

  const buildPayload = () => ({
    locale: lang,
    fullName: normalizeSingleLine(fieldMap.fullName.input.value),
    email: normalizeSingleLine(fieldMap.email.input.value).toLowerCase(),
    phone: normalizeSingleLine(fieldMap.phone.input.value),
    company: normalizeSingleLine(fieldMap.company.input.value),
    details: normalizeMultiline(fieldMap.details.input.value),
    consent: fieldMap.consent.input.checked,
    website: normalizeSingleLine(document.getElementById("cfWebsite")?.value),
    formStartedAt: Number(formStartedAtInput?.value || Date.now()),
  });

  const showFormSuccess = () => {
    hasSubmittedSuccessfully = true;
    contactForm?.reset();
    updateDetailsCounter();
    setStatus();
    contactForm && (contactForm.hidden = true);
    success?.classList.add("show");
  };

  const onFormInteraction = (fieldName) => {
    touchedFields.add(fieldName);
    validateField(fieldName);
  };

  const applyServerErrors = (fieldErrors = {}) => {
    const entries = Object.entries(fieldErrors);
    if (!entries.length) {
      return;
    }

    entries.forEach(([fieldName, message]) => {
      if (fieldMap[fieldName]) {
        touchedFields.add(fieldName);
        setFieldError(fieldName, message);
      }
    });

    const firstInvalidFieldName = entries.find(([fieldName]) => fieldMap[fieldName]);
    if (firstInvalidFieldName) {
      fieldMap[firstInvalidFieldName[0]].input.focus();
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    if (!contactForm || isSubmitting) {
      return;
    }

    if (!formStartedAtInput?.value) {
      formStartedAtInput.value = String(Date.now() - minimumSubmitDelayMs);
    }

    clearValidationState();
    if (!validateForm()) {
      return;
    }

    setSubmitState(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(buildPayload()),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        applyServerErrors(payload.fieldErrors);
        setStatus(payload.error || getCopy().sendFailed, "error");
        return;
      }

      showFormSuccess();
    } catch (error) {
      console.error("Failed to submit contact form", error);
      setStatus(getCopy().sendFailed, "error");
    } finally {
      setSubmitState(false);
      if (!hasSubmittedSuccessfully) {
        formStartedAtInput && (formStartedAtInput.value = String(Date.now()));
      }
    }
  };

  const onDocumentClick = (event) => {
    if (!event.target.closest(".lang-wrap")) {
      closeLang();
    }
  };

  const resetFormState = () => {
    if (!contactForm || hasSubmittedSuccessfully) {
      return;
    }

    contactForm.hidden = false;
    success?.classList.remove("show");
    clearValidationState();
    updateDetailsCounter();

    if (formStartedAtInput) {
      formStartedAtInput.value = String(Date.now());
    }
  };

  Object.entries(fieldMap).forEach(([fieldName, field]) => {
    if (!field.input) {
      return;
    }

    const eventName = field.input.type === "checkbox" ? "change" : "blur";
    field.input.addEventListener(eventName, () => onFormInteraction(fieldName));

    if (field.input.type !== "checkbox") {
      field.input.addEventListener("input", () => {
        if (fieldName === "details") {
          updateDetailsCounter();
        }

        if (touchedFields.has(fieldName) || field.error.textContent) {
          validateField(fieldName);
        }
      });
    }
  });

  contactForm?.addEventListener("submit", handleFormSubmit);

  window.showPage = showPage;
  window.toggleLang = toggleLang;
  window.setLang = setLang;

  resetFormState();
  observeReveals();
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("scroll", onScroll);
  onScroll();
  setLang(lang);

  return () => {
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onDocumentClick);
    observer.disconnect();
    contactForm?.removeEventListener("submit", handleFormSubmit);
    delete window.showPage;
    delete window.toggleLang;
    delete window.setLang;
  };
}
