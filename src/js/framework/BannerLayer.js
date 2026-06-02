/**
 * Thin wrapper over the #banner-layer element. notify.banner() uses this
 * internally; the layer also holds CORS / connectivity warnings raised by
 * managers during boot.
 */
export const BannerLayer = {
  id: "banner-layer",

  setContent(html) {
    const el = document.getElementById(this.id);
    if (el) el.innerHTML = html;
  },

  clear() {
    const el = document.getElementById(this.id);
    if (el) el.innerHTML = "";
  },
};
