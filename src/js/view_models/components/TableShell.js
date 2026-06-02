/**
 * Static table wrapper using the Figma table chrome (border, row heights).
 * Use when a page renders a simple table without sort/search/pagination.
 *
 * @param {{ id?: string, tableHtml: string, embedded?: boolean }} props
 * @returns {string}
 */
export function tableShell(props) {
  const embedded = props.embedded ? " sg-datatable--embedded" : "";
  const idAttr = props.id ? ` id="${escapeAttr(props.id)}"` : "";
  return `
    <div class="sg-datatable${embedded}"${idAttr} data-component="TableShell">
      <div class="sg-datatable__scroll table-responsive">
        <table class="table sg-datatable__table mb-0">${props.tableHtml}</table>
      </div>
    </div>
  `;
}

function escapeAttr(s) {
  return String(s ?? "").replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
