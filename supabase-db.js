/**
 * Shortener - Integração Supabase em Nuvem (supabase-db.js)
 * Sincronização em tempo real de links encurtados para todos os visitantes do mundo
 */

const SUPABASE_CONFIG = {
  url: "https://nmqzjcriwggemfawpjqc.supabase.co",
  key: "sb_publishable_d8Ex_hrPcVGw61BhTuhoJQ_DAcG1s2W",
  table: "short_links"
};

const supabaseDb = {
  config: SUPABASE_CONFIG,

  getHeaders() {
    return {
      "apikey": SUPABASE_CONFIG.key,
      "Authorization": `Bearer ${SUPABASE_CONFIG.key}`,
      "Content-Type": "application/json"
    };
  },

  // Retorna a URL para redirecionamento oficial de OAuth do provedor
  getOAuthUrl(provider = "github", redirectTo = "") {
    const cleanRedirect = redirectTo || (typeof window !== "undefined" ? window.location.href.split('#')[0] : "");
    return `${SUPABASE_CONFIG.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(cleanRedirect)}`;
  },

  // Obtém dados do usuário a partir do token de acesso OAuth retornado pelo Supabase
  async getUserFromToken(accessToken) {
    if (!accessToken) return null;
    try {
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/user`, {
        headers: {
          "apikey": SUPABASE_CONFIG.key,
          "Authorization": `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error("[Supabase] Erro ao buscar usuário pelo token:", e);
    }
    return null;
  },

  // Busca um link pelo slug no Supabase
  async getLink(slug) {
    if (!slug) return null;
    const cleanSlug = String(slug).trim().toLowerCase().replace(/^[/#]+/, '');
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

  // Retorna todos os links da nuvem
  async getAllLinks() {
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?select=*&order=created_at.desc`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders()
      });

      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("[Supabase] Falha ao buscar todos os links:", e);
      return [];
    }
  },

  // Retorna todos os links criados por um determinado usuário do GitHub ou ID
  async getUserLinks(usernameOrId) {
    if (!usernameOrId) return [];
    const cleanUser = String(usernameOrId).trim().toLowerCase().replace(/^@/, '');
    
    try {
      // Consulta direta pelo campo JSONB author_username no PostgreSQL do Supabase
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?encrypted_data->>author_username=eq.${encodeURIComponent(cleanUser)}&select=*&order=created_at.desc`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn("[Supabase] Consulta direta por usuário falhou, tentando fallback:", e);
    }

    // Fallback inteligente: obtém os links e filtra pela conta do criador
    try {
      const all = await this.getAllLinks();
      return all.filter(item => {
        const enc = (item.encrypted_data && typeof item.encrypted_data === "object") ? item.encrypted_data : {};
        const encUser = (enc.author_username || "").toLowerCase();
        const encId = enc.author_id || "";
        
        return encUser === cleanUser || encId === cleanUser || (cleanUser === "dougretrogames" && (!encUser || encUser === "dougretrogames"));
      });
    } catch (e) {
      console.warn("[Supabase] Falha no fallback de links do usuário:", e);
      return [];
    }
  },

  // Salva um novo link no Supabase com identificação e vinculação definitiva da conta
  async saveLink({ slug, encryptedData, hint, targetUrl, authorType, authorUsername, authorId, authorName, authorAvatar }) {
    if (!slug || !encryptedData) return false;
    const cleanSlug = String(slug).trim().toLowerCase().replace(/^[/#]+/, '');
    
    // Injeta os dados definitivos da conta criadora dentro de encrypted_data (JSONB)
    if (typeof encryptedData === "object" && encryptedData !== null) {
      encryptedData.author_type = authorType || "visitante";
      encryptedData.author_username = (authorUsername || (authorType === "github" ? "github" : "visitante")).toLowerCase().replace(/^@/, '');
      encryptedData.author_id = authorId || ("user_" + Math.random().toString(36).substring(2));
      encryptedData.author_name = authorName || (authorType === "github" ? "GitHub" : "Visitante");
      if (authorAvatar) encryptedData.author_avatar = authorAvatar;
    }

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

  // Atualiza os dados de autoria/vinculação de um link (usado para migrar links de visitante para usuário conectado)
  async updateLinkAuthor(slug, { authorType, authorUsername, authorId, authorName, authorAvatar }) {
    if (!slug) return false;
    const cleanSlug = String(slug).trim().toLowerCase().replace(/^[/#]+/, '');

    try {
      const linkRecord = await this.getLink(cleanSlug);
      if (!linkRecord) return false;

      const enc = (linkRecord.encrypted_data && typeof linkRecord.encrypted_data === "object")
        ? linkRecord.encrypted_data
        : {};

      enc.author_type = authorType || "github";
      enc.author_username = (authorUsername || "github").toLowerCase().replace(/^@/, '');
      enc.author_id = authorId || `github_${enc.author_username}`;
      enc.author_name = authorName || `@${enc.author_username}`;
      if (authorAvatar) enc.author_avatar = authorAvatar;

      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanSlug)}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          ...this.getHeaders(),
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          encrypted_data: enc
        })
      });

      return res.ok;
    } catch (e) {
      console.error(`[Supabase] Erro ao atualizar autor do slug /${cleanSlug}:`, e);
      return false;
    }
  },

  // Verifica se um slug já existe no Supabase
  async exists(slug) {
    if (!slug) return false;
    const cleanSlug = String(slug).trim().toLowerCase().replace(/^[/#]+/, '');
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
    const cleanSlug = String(slug).trim().toLowerCase().replace(/^[/#]+/, '');
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

  // Incrementa contador de cliques no Supabase em tempo real
  async incrementClicks(slug) {
    if (!slug) return 0;
    const cleanSlug = String(slug).trim().toLowerCase().replace(/^[/#]+/, '');
    try {
      const link = await this.getLink(cleanSlug);
      if (!link) return 0;

      const newClicks = (Number(link.clicks) || 0) + 1;
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanSlug)}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          ...this.getHeaders(),
          "Prefer": "return=representation"
        },
        body: JSON.stringify({ clicks: newClicks })
      });

      if (res.ok) {
        console.log(`[Supabase] Clique atualizado com sucesso para /${cleanSlug}: ${newClicks} cliques`);
      }
      return newClicks;
    } catch (e) {
      console.warn("[Supabase] Falha ao incrementar cliques:", e);
      return 0;
    }
  }
};

window.supabaseDb = supabaseDb;
