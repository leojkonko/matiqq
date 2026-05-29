import nodemailer from "nodemailer";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumSubmitDelayMs = 2500;

const limits = {
  fullName: { min: 2, max: 120 },
  email: { max: 160 },
  phone: { max: 30 },
  company: { min: 2, max: 160 },
  details: { max: 2000 },
};

const copy = {
  en: {
    validationSummary: "Review the highlighted fields and try again.",
    missingConfig: "The contact form is not configured on the server.",
    sendFailed: "We couldn't send your request right now. Please try again later.",
    requiredFullName: "Enter your full name.",
    requiredEmail: "Enter your email address.",
    invalidEmail: "Enter a valid email address.",
    invalidPhone: "Enter a valid phone number or leave the field blank.",
    requiredCompany: "Enter your company or institution.",
    requiredConsent: "Please agree to the contact consent.",
    tooShort: (minimum) => `Please enter at least ${minimum} characters.`,
    tooLong: (maximum) => `Please keep this to ${maximum} characters or fewer.`,
    notProvided: "Not provided",
    newRequest: "New MatIQ contact request",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    company: "Company / Institution",
    details: "Project details",
    language: "Language",
    submittedFrom: "Submitted from",
    userAgent: "User agent",
  },
  de: {
    validationSummary: "Bitte prüfen Sie die markierten Felder und versuchen Sie es erneut.",
    missingConfig: "Das Kontaktformular ist serverseitig noch nicht konfiguriert.",
    sendFailed: "Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut.",
    requiredFullName: "Bitte geben Sie Ihren vollständigen Namen ein.",
    requiredEmail: "Bitte geben Sie Ihre E-Mail-Adresse ein.",
    invalidEmail: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    invalidPhone: "Bitte geben Sie eine gültige Telefonnummer ein oder lassen Sie das Feld leer.",
    requiredCompany: "Bitte geben Sie Ihr Unternehmen oder Ihre Institution ein.",
    requiredConsent: "Bitte stimmen Sie der Kontaktaufnahme zu.",
    tooShort: (minimum) => `Bitte geben Sie mindestens ${minimum} Zeichen ein.`,
    tooLong: (maximum) => `Bitte verwenden Sie höchstens ${maximum} Zeichen.`,
    notProvided: "Nicht angegeben",
    newRequest: "Neue MatIQ-Kontaktanfrage",
    fullName: "Vollständiger Name",
    email: "E-Mail",
    phone: "Telefon",
    company: "Unternehmen / Institution",
    details: "Projektdetails",
    language: "Sprache",
    submittedFrom: "Abgesendet von",
    userAgent: "User Agent",
  },
};

function normalizeSingleLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMultiline(value) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim();
}

function parseLocale(value) {
  return value === "de" ? "de" : "en";
}

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseConsent(value) {
  return value === true || value === "true" || value === "yes" || value === "on";
}

function validatePayload(payload) {
  const locale = parseLocale(payload?.locale);
  const messages = copy[locale];
  const fieldErrors = {};
  const clean = {
    locale,
    fullName: normalizeSingleLine(payload?.fullName),
    email: normalizeSingleLine(payload?.email).toLowerCase(),
    phone: normalizeSingleLine(payload?.phone),
    company: normalizeSingleLine(payload?.company),
    details: normalizeMultiline(payload?.details),
    consent: parseConsent(payload?.consent),
    website: normalizeSingleLine(payload?.website),
    formStartedAt: Number(payload?.formStartedAt || 0),
  };

  if (!clean.fullName) {
    fieldErrors.fullName = messages.requiredFullName;
  } else if (clean.fullName.length < limits.fullName.min) {
    fieldErrors.fullName = messages.tooShort(limits.fullName.min);
  } else if (clean.fullName.length > limits.fullName.max) {
    fieldErrors.fullName = messages.tooLong(limits.fullName.max);
  }

  if (!clean.email) {
    fieldErrors.email = messages.requiredEmail;
  } else if (clean.email.length > limits.email.max) {
    fieldErrors.email = messages.tooLong(limits.email.max);
  } else if (!emailPattern.test(clean.email)) {
    fieldErrors.email = messages.invalidEmail;
  }

  if (clean.phone.length > limits.phone.max) {
    fieldErrors.phone = messages.tooLong(limits.phone.max);
  } else if (!isPhoneValid(clean.phone)) {
    fieldErrors.phone = messages.invalidPhone;
  }

  if (!clean.company) {
    fieldErrors.company = messages.requiredCompany;
  } else if (clean.company.length < limits.company.min) {
    fieldErrors.company = messages.tooShort(limits.company.min);
  } else if (clean.company.length > limits.company.max) {
    fieldErrors.company = messages.tooLong(limits.company.max);
  }

  if (clean.details.length > limits.details.max) {
    fieldErrors.details = messages.tooLong(limits.details.max);
  }

  if (!clean.consent) {
    fieldErrors.consent = messages.requiredConsent;
  }

  return {
    locale,
    messages,
    clean,
    fieldErrors,
  };
}

function getTransportConfig() {
  const port = Number(process.env.SMTP_PORT || 465);
  const hasAuthUser = Boolean(process.env.SMTP_USER);
  const hasAuthPass = Boolean(process.env.SMTP_PASS);

  if (Number.isNaN(port)) {
    return null;
  }

  if (hasAuthUser !== hasAuthPass) {
    return null;
  }

  if (!process.env.SMTP_HOST) {
    return null;
  }

  const from = process.env.CONTACT_FROM || process.env.SMTP_USER;
  if (!from) {
    return null;
  }

  return {
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465,
    auth: hasAuthUser
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
    from,
    recipient: process.env.CONTACT_RECIPIENT,
  };
}

function buildMessageBody(clean, messages, req) {
  const submittedFrom = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.socket.remoteAddress || messages.notProvided;
  const userAgent = req.headers["user-agent"] || messages.notProvided;
  const details = clean.details || messages.notProvided;
  const localeLabel = clean.locale.toUpperCase();

  return {
    subject: `${messages.newRequest} - ${clean.fullName}`,
    text: [
      `${messages.fullName}: ${clean.fullName}`,
      `${messages.email}: ${clean.email}`,
      `${messages.phone}: ${clean.phone || messages.notProvided}`,
      `${messages.company}: ${clean.company}`,
      `${messages.language}: ${localeLabel}`,
      `${messages.submittedFrom}: ${submittedFrom}`,
      `${messages.userAgent}: ${userAgent}`,
      "",
      `${messages.details}:`,
      details,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.6">
        <h2 style="margin:0 0 20px;color:#1b5c58">${escapeHtml(messages.newRequest)}</h2>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.fullName)}</td><td style="padding:6px 0">${escapeHtml(clean.fullName)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.email)}</td><td style="padding:6px 0">${escapeHtml(clean.email)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.phone)}</td><td style="padding:6px 0">${escapeHtml(clean.phone || messages.notProvided)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.company)}</td><td style="padding:6px 0">${escapeHtml(clean.company)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.language)}</td><td style="padding:6px 0">${escapeHtml(localeLabel)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.submittedFrom)}</td><td style="padding:6px 0">${escapeHtml(submittedFrom)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:700">${escapeHtml(messages.userAgent)}</td><td style="padding:6px 0">${escapeHtml(userAgent)}</td></tr>
        </table>
        <div style="margin-top:20px;padding:16px;border-radius:12px;background:#f7fafa;border:1px solid rgba(27,92,88,0.12)">
          <p style="margin:0 0 8px;font-weight:700">${escapeHtml(messages.details)}</p>
          <p style="margin:0;white-space:pre-wrap">${escapeHtml(details)}</p>
        </div>
      </div>
    `,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const rawBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const { locale, messages, clean, fieldErrors } = validatePayload(rawBody);

    if (clean.website) {
      return res.status(200).json({ ok: true });
    }

    if (!clean.formStartedAt || Date.now() - clean.formStartedAt < minimumSubmitDelayMs) {
      return res.status(200).json({ ok: true });
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(422).json({
        error: messages.validationSummary,
        fieldErrors,
        locale,
      });
    }

    const transportConfig = getTransportConfig();
    if (!transportConfig) {
      return res.status(500).json({ error: messages.missingConfig });
    }

    const transporter = nodemailer.createTransport({
      host: transportConfig.host,
      port: transportConfig.port,
      secure: transportConfig.secure,
      auth: transportConfig.auth,
    });

    const message = buildMessageBody(clean, messages, req);

    await transporter.sendMail({
      from: transportConfig.from,
      to: transportConfig.recipient,
      replyTo: clean.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Failed to send contact request", error);
    return res.status(500).json({
      error: copy.en.sendFailed,
    });
  }
}