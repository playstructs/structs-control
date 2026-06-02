/**
 * Bootstrap floating-label form field. Just a render helper.
 *
 * @param {{
 *   id: string,
 *   name: string,
 *   label: string,
 *   value?: string,
 *   type?: string,
 *   readonly?: boolean,
 *   placeholder?: string,
 * }} props
 * @returns {string}
 */
export function floatingLabelField(props) {
  const type = props.type ?? "text";
  return `
    <div class="form-floating sg-floating-label">
      <input
        type="${escapeAttr(type)}"
        id="${escapeAttr(props.id)}"
        name="${escapeAttr(props.name)}"
        class="form-control"
        placeholder="${escapeAttr(props.placeholder ?? props.label)}"
        value="${escapeAttr(props.value ?? "")}"
        ${props.readonly ? "readonly" : ""}
      />
      <label for="${escapeAttr(props.id)}">${escapeHtml(props.label)}</label>
      <div class="invalid-feedback"></div>
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
