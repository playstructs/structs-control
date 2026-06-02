/**
 * Form validation helper.
 *
 * Schemas are simple maps of `field -> rule list`. Rules are functions that
 * receive (value, allValues) and return either undefined (ok) or a string
 * error. Bundled rules cover the common cases; bespoke rules are just inline
 * arrow functions.
 *
 * Example:
 *   const schema = {
 *     username: [required(), maxLength(64)],
 *     mnemonic: [required(), (v) => v.split(' ').length === 24 ? undefined : "Must be 24 words"],
 *   };
 *   const { valid, errors } = validateForm(schema, formData);
 *   if (!valid) notify.formError("login-form", errors);
 */

/** @typedef {(value: any, all: Record<string, any>) => string | undefined} Rule */
/** @typedef {Record<string, Rule[]>} Schema */

/**
 * @param {string} [message]
 * @returns {Rule}
 */
export function required(message = "Required") {
  return (v) => {
    if (v === undefined || v === null) return message;
    if (typeof v === "string" && v.trim() === "") return message;
    return undefined;
  };
}

/**
 * @param {number} n
 * @param {string} [message]
 * @returns {Rule}
 */
export function minLength(n, message) {
  return (v) => (typeof v === "string" && v.length < n ? message ?? `Must be at least ${n} characters` : undefined);
}

/**
 * @param {number} n
 * @param {string} [message]
 * @returns {Rule}
 */
export function maxLength(n, message) {
  return (v) => (typeof v === "string" && v.length > n ? message ?? `Must be at most ${n} characters` : undefined);
}

/**
 * @param {RegExp} re
 * @param {string} message
 * @returns {Rule}
 */
export function pattern(re, message) {
  return (v) => (typeof v === "string" && !re.test(v) ? message : undefined);
}

/** @type {Rule} */
export const isGuildId = (v) =>
  typeof v === "string" && /^0-\d+$/.test(v.trim()) ? undefined : "Guild ID must look like 0-2";

/** @type {Rule} */
export const isCosmosAddress = (v) =>
  typeof v === "string" && /^structs1[a-z0-9]{38}$/.test(v) ? undefined : "Not a structs address";

/**
 * 12 or 24 word BIP39 mnemonic. Doesn't validate against the wordlist (Wallet
 * does that) but catches obvious typos.
 * @type {Rule}
 */
export const isMnemonic = (v) => {
  if (typeof v !== "string") return "Required";
  const words = v.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) return "Must be 12 or 24 words";
  if (!words.every((w) => /^[a-z]+$/.test(w))) return "All words must be lowercase letters";
  return undefined;
};

/** @type {Rule} */
export const isUrl = (v) => {
  if (typeof v !== "string" || v === "") return undefined; // empty allowed -- use required() to make non-optional
  try {
    new URL(v);
    return undefined;
  } catch {
    return "Not a valid URL";
  }
};

/**
 * @param {Schema} schema
 * @param {Record<string, any>} values
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateForm(schema, values) {
  const errors = /** @type {Record<string, string>} */ ({});
  for (const [field, rules] of Object.entries(schema)) {
    for (const rule of rules) {
      const err = rule(values[field], values);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Convenience: collect <form> field values into a plain object.
 * @param {HTMLFormElement} form
 * @returns {Record<string, string>}
 */
export function readFormValues(form) {
  const out = /** @type {Record<string, string>} */ ({});
  for (const [k, v] of new FormData(form)) {
    out[k] = typeof v === "string" ? v : "";
  }
  return out;
}
