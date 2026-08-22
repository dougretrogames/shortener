/**
 * Encurtador de Links - Integração Supabase em Nuvem (supabase-db.js)
 * Sincronização em tempo real de links encurtados para todos os visitantes do mundo
 */

const SUPABASE_CONFIG = {
  url: "https://nmqzjcriwggemfawpjqc.supabase.co",
  key: "sb_publishable_d8Ex_hrPcVGw61BhTuhoJQ_DAcG1s2W",
  table: "short_links"
};

const supabaseDb = {
  getHeaders() {
    return {
      "apikey": SUPABASE_CONFIG.key,
      "Authorization": `Bearer ${SUPABASE_CONFIG.key}`,
      "Content-Type": "application/json"
    };
  },

  // Busca um link pelo slug no Supabase
  async getLink(slug) {
    if (!slug) return null;
    const cleanSlug = String(slug).trim().toLowerCase();
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanSlug)}&select=*`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders()
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0];
      }
    } catch (e) {
      console.warn("[Supabase] Falha ao consultar link:", e);
    }
    return null;
  },

  // Salva um novo link no Supabase
  async saveLink({ slug, encryptedData, hint, targetUrl }) {
    if (!slug || !encryptedData) return false;
    const cleanSlug = String(slug).trim().toLowerCase();
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}`;
      const payload = {
        slug: cleanSlug,
        encrypted_data: encryptedData,
        hint: hint || null,
        clicks: 0,
        created_at: new Date().toISOString()
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...this.getHeaders(),
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify(payload)
      });

      return res.ok || res.status === 201 || res.status === 204;
    } catch (e) {
      console.error("[Supabase] Falha ao salvar link:", e);
      return false;
    }
  },

  // Verifica se um slug já existe no Supabase
  async exists(slug) {
    if (!slug) return false;
    const cleanSlug = String(slug).trim().toLowerCase();
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanSlug)}&select=slug`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders()
      });

      if (!res.ok) return false;
      const data = await res.json();
      return Array.isArray(data) && data.length > 0;
    } catch (e) {
      console.warn("[Supabase] Falha ao checar existência:", e);
      return false;
    }
  },

  // Exclui um link no Supabase
  async deleteLink(slug) {
    if (!slug) return false;
    const cleanSlug = String(slug).trim().toLowerCase();
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanSlug)}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          ...this.getHeaders(),
          "Prefer": "return=minimal"
        }
      });

      return res.ok || res.status === 204 || res.status === 200;
    } catch (e) {
      console.error("[Supabase] Falha ao excluir link:", e);
      return false;
    }
  },

  // Incrementa contador de cliques no Supabase
  async incrementClicks(slug) {
    if (!slug) return;
    const cleanSlug = String(slug).trim().toLowerCase();
    try {
      const link = await this.getLink(cleanSlug);
      if (!link) return;

      const newClicks = (Number(link.clicks) || 0) + 1;
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanSlug)}`;
      await fetch(endpoint, {
        method: "PATCH",
        headers: this.getHeaders(),
        body: JSON.stringify({ clicks: newClicks })
      });
    } catch (e) {
      console.warn("[Supabase] Falha ao incrementar cliques:", e);
    }
  }
};

window.supabaseDb = supabaseDb;
