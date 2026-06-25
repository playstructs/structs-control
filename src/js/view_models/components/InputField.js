/**
 * Figma input field (571:9225) — label inside the box, 54px single-line / 140px multiline.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   label: string,
 *   value?: string,
 *   type?: string,
 *   readonly?: boolean,
 * }} props
 * @returns {string}
 */
export function designSystemField(props) {
  const type = props.type ?? "text";
  return `
    <div class="sg-input-field">
      <label class="sg-input-field__label" for="${escapeAttr(props.id)}">${escapeHtml(props.label)}</label>
      <input
        type="${escapeAttr(type)}"
        id="${escapeAttr(props.id)}"
        name="${escapeAttr(props.name)}"
        class="sg-input-field__control"
        value="${escapeAttr(props.value ?? "")}"
        ${props.readonly ? "readonly" : ""}
      />
    </div>
  `;
}

/**
 * @param {{
 *   id: string,
 *   name: string,
 *   label: string,
 *   value?: string,
 *   readonly?: boolean,
 * }} props
 * @returns {string}
 */
export function designSystemTextarea(props) {
  return `
    <div class="sg-input-field sg-input-field--large">
      <label class="sg-input-field__label" for="${escapeAttr(props.id)}">${escapeHtml(props.label)}</label>
      <textarea
        id="${escapeAttr(props.id)}"
        name="${escapeAttr(props.name)}"
        class="sg-input-field__control sg-input-field__textarea"
        ${props.readonly ? "readonly" : ""}
      >${escapeHtml(props.value ?? "")}</textarea>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
