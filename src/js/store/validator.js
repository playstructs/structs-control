/**
 * Minimal runtime validator for Guild API envelopes. Catches contract drift at
 * the JsonAjaxer boundary before bad data reaches the cache.
 *
 * Schemas are plain JS describing required shapes:
 *   { foo: "string", bar: "number?", items: ["string"] }
 *
 * Notation:
 *   "string" / "number" / "boolean" / "object" / "array"  required of that type
 *   "string?" / etc.                                       optional of that type
 *   ["string"]                                             array of strings
 *   ["object", subSchema]                                  array of objects with sub-schema
 *   { ...nested object schema }                            nested object
 *
 * This is intentionally small. For anything richer, validate manually in the
 * caller. Returns a list of human-readable errors (empty list = valid).
 */

/**
 * @param {*} schema
 * @param {*} value
 * @param {string} [path]
 * @returns {string[]}
 */
export function validate(schema, value, path = "$") {
  const errors = [];
  if (schema == null) return errors;

  if (typeof schema === "string") {
    const optional = schema.endsWith("?");
    const type = optional ? schema.slice(0, -1) : schema;
    if (value === undefined || value === null) {
      if (!optional) errors.push(`${path}: expected ${type}, got ${value}`);
      return errors;
    }
    if (type === "array") {
      if (!Array.isArray(value)) errors.push(`${path}: expected array`);
    } else if (type === "object") {
      if (typeof value !== "object" || Array.isArray(value))
        errors.push(`${path}: expected object`);
    } else if (typeof value !== type) {
      errors.push(`${path}: expected ${type}, got ${typeof value}`);
    }
    return errors;
  }

  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) {
      errors.push(`${path}: expected array`);
      return errors;
    }
    const [itemType, subSchema] = schema;
    value.forEach((item, i) => {
      errors.push(...validate(itemType, item, `${path}[${i}]`));
      if (subSchema && itemType === "object") {
        errors.push(...validate(subSchema, item, `${path}[${i}]`));
      }
    });
    return errors;
  }

  if (typeof schema === "object") {
    if (typeof value !== "object" || value === null) {
      errors.push(`${path}: expected object`);
      return errors;
    }
    for (const [k, sub] of Object.entries(schema)) {
      errors.push(...validate(sub, value[k], `${path}.${k}`));
    }
  }

  return errors;
}

/**
 * Envelope shape from the Guild API. Every response is wrapped like this.
 * @typedef {{ success: boolean, errors?: string[], data?: unknown }} Envelope
 */

/** @type {Record<string, unknown>} */
export const envelopeSchema = {
  success: "boolean",
};
