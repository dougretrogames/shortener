/**
 * Shortener - Integração Supabase em Nuvem (supabase-db.js)
 * Sincronização em tempo real de links encurtados para todos os visitantes do mundo
 */

const SUPABASE_CONFIG = {
  get url() {
    return (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) 
      ? window.APP_CONFIG.SUPABASE_URL 
      : "https://nmqzjcriwggemfawpjqc.supabase.co";
  },
  get key() {
    return (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) 
      ? window.APP_CONFIG.SUPABASE_ANON_KEY 
      : "sb_publishable_d8Ex_hrPcVGw61BhTuhoJQ_DAcG1s2W";
  },
  table: "short_links"
};

const supabaseDb = {
  config: SUPABASE_CONFIG,

  getHeaders() {
    const key = SUPABASE_CONFIG.key;
    return {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json"
    };
  },

  // Gera o code_verifier seguro para fluxo PKCE
  generateCodeVerifier() {
    const array = new Uint8Array(32);
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < 32; i++) array[i] = Math.floor(Math.random() * 256);
    }
    let str = "";
    for (let i = 0; i < array.length; i++) {
      str += String.fromCharCode(array[i]);
    }
    return (typeof btoa === "function" ? btoa(str) : Buffer.from(str).toString('base64'))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  },

  // Gera o code_challenge SHA-256 base64url para fluxo PKCE
  async generateCodeChallenge(verifier) {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(verifier);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      const digestArray = new Uint8Array(digest);
      let str = "";
      for (let i = 0; i < digestArray.length; i++) {
        str += String.fromCharCode(digestArray[i]);
      }
      return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }
    return verifier;
  },

  // Retorna a URL para redirecionamento oficial de OAuth do provedor (com PKCE e suporte a implicit)
  async getOAuthUrl(provider = "github", redirectTo = "") {
    const cleanRedirect = redirectTo || (typeof window !== "undefined" ? window.location.href.split('#')[0].split('?')[0] : "");
    
    try {
      if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
        const verifier = this.generateCodeVerifier();
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("sb_auth_code_verifier", verifier);
        }
        const challenge = await this.generateCodeChallenge(verifier);
        return `${SUPABASE_CONFIG.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(cleanRedirect)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=s256`;
      }
    } catch (e) {
      console.warn("[OAuth] Fallback para fluxo padrão:", e);
    }
    
    return `${SUPABASE_CONFIG.url}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(cleanRedirect)}`;
  },

  // Troca o código PKCE retornado pelo Supabase por tokens de sessão
  async exchangeCodeForSession(code) {
    if (!code) return null;
    const verifier = (typeof localStorage !== "undefined" ? localStorage.getItem("sb_auth_code_verifier") : "") || "";
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=pkce`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_CONFIG.key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          auth_code: code,
          code_verifier: verifier
        })
      });

      if (res.ok) {
        if (typeof localStorage !== "undefined") localStorage.removeItem("sb_auth_code_verifier");
        return await res.json();
      } else {
        // Fallback caso seja código padrão
        const res2 = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=authorization_code`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_CONFIG.key,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ code: code })
        });
        if (res2.ok) return await res2.json();
      }
    } catch (e) {
      console.error("[Supabase] Erro ao trocar código por token:", e);
    }
    return null;
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

  // Retorna todos os links criados por um determinado usuário (Google ou GitHub) com isolamento total
  async getUserLinks(userOrUsername, provider = "", userId = "") {
    if (!userOrUsername) return [];
    
    let cleanUser = "";
    let cleanProvider = "";
    let cleanId = "";

    if (typeof userOrUsername === "object" && userOrUsername !== null) {
      cleanUser = String(userOrUsername.username || userOrUsername.name || "").trim().toLowerCase().replace(/^@/, '');
      cleanProvider = String(userOrUsername.provider || "").trim().toLowerCase();
      cleanId = String(userOrUsername.id || "").trim();
    } else {
      cleanUser = String(userOrUsername).trim().toLowerCase().replace(/^@/, '');
      cleanProvider = String(provider || "").trim().toLowerCase();
      cleanId = String(userId || "").trim();
    }

    try {
      // 1. Se possuir o ID único de autenticação (UUID do Supabase), busca por author_id com precisão máxima
      if (cleanId) {
        const idEndpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?encrypted_data->>author_id=eq.${encodeURIComponent(cleanId)}&select=*&order=created_at.desc`;
        const resId = await fetch(idEndpoint, { method: "GET", headers: this.getHeaders() });
        if (resId.ok) {
          const idData = await resId.json();
          if (Array.isArray(idData) && idData.length > 0) {
            return idData;
          }
        }
      }

      // 2. Consulta por author_username e author_type combinados
      let endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?encrypted_data->>author_username=eq.${encodeURIComponent(cleanUser)}`;
      if (cleanProvider) {
        endpoint += `&encrypted_data->>author_type=eq.${encodeURIComponent(cleanProvider)}`;
      }
      endpoint += `&select=*&order=created_at.desc`;

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

    // Fallback inteligente: obtém os links e filtra pela conta e provedor do criador
    try {
      const all = await this.getAllLinks();
      return all.filter(item => {
        const enc = (item.encrypted_data && typeof item.encrypted_data === "object") ? item.encrypted_data : {};
        const encUser = (enc.author_username || "").toLowerCase();
        const encType = (enc.author_type || item.author_type || "github").toLowerCase();
        const encId = enc.author_id || "";
        
        // Correspondência por ID
        if (cleanId && encId === cleanId) return true;

        // Correspondência por username + provedor
        if (cleanUser && encUser === cleanUser) {
          if (!cleanProvider) return true;
          return encType === cleanProvider || (cleanProvider === "github" && (!enc.author_type || encType === "github"));
        }
        
        // Suporte legado para o dono da aplicação
        const adminUser = typeof getAppAdminUsername === "function" ? getAppAdminUsername() : "dougretrogames";
        if (cleanUser === adminUser && (!encUser || encUser === adminUser)) return true;
        return false;
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
    const cleanAuthorType = authorType || "visitante";
    const cleanAuthorUsername = (authorUsername || (cleanAuthorType === "google" ? "google" : cleanAuthorType === "github" ? "github" : "visitante")).toLowerCase().replace(/^@/, '');
    const cleanAuthorId = authorId || (cleanAuthorType !== "visitante" ? `${cleanAuthorType}_${cleanAuthorUsername}` : null);
    const cleanAuthorName = (cleanAuthorType !== "visitante") ? `@${cleanAuthorUsername}` : "Visitante";
    
    // Injeta os dados definitivos da conta criadora dentro de encrypted_data (JSONB)
    if (typeof encryptedData === "object" && encryptedData !== null) {
      encryptedData.author_type = cleanAuthorType;
      encryptedData.author_username = cleanAuthorUsername;
      encryptedData.author_id = cleanAuthorId;
      encryptedData.author_name = cleanAuthorName;
      if (authorAvatar) encryptedData.author_avatar = authorAvatar;
    }

    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}`;
      const payload = {
        slug: cleanSlug,
        encrypted_data: encryptedData,
        hint: hint || null,
        clicks: 0,
        created_at: new Date().toISOString(),
        author_type: cleanAuthorType,
        author_name: cleanAuthorName,
        author_id: cleanAuthorId
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

      const finalType = authorType || "google";
      const cleanUser = (authorUsername || finalType).toLowerCase().replace(/^@/, '');
      const finalId = authorId || `${finalType}_${cleanUser}`;
      const finalName = `@${cleanUser}`;

      enc.author_type = finalType;
      enc.author_username = cleanUser;
      enc.author_id = finalId;
      enc.author_name = finalName;
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
          encrypted_data: enc,
          author_type: finalType,
          author_name: finalName,
          author_id: finalId
        })
      });

      return res.ok;
    } catch (e) {
      console.error(`[Supabase] Erro ao atualizar autor do slug /${cleanSlug}:`, e);
      return false;
    }
  },

  // Sincroniza e preenche automaticamente a coluna author_id e author_name em links existentes
  async syncUserLinksAuthorId(user) {
    if (!user || !user.username) return;
    const cleanUser = String(user.username).toLowerCase().replace(/^@/, '');
    const provider = user.provider || "github";
    const authorId = user.id || `${provider}_${cleanUser}`;
    const authorName = `@${cleanUser}`;
    const authorAvatar = user.avatar || "";

    try {
      const userLinks = await this.getUserLinks(user);
      if (!Array.isArray(userLinks) || userLinks.length === 0) return;

      for (const link of userLinks) {
        const enc = (link.encrypted_data && typeof link.encrypted_data === "object") ? link.encrypted_data : {};
        const needsSync = !link.author_id || !enc.author_id || (link.author_name && !link.author_name.startsWith("@")) || (enc.author_name && !enc.author_name.startsWith("@"));

        if (needsSync) {
          await this.updateLinkAuthor(link.slug, {
            authorType: link.author_type || enc.author_type || provider,
            authorUsername: enc.author_username || cleanUser,
            authorId: authorId,
            authorName: authorName,
            authorAvatar: authorAvatar
          });
        }
      }
    } catch (e) {
      console.warn("[Supabase] Sincronização automática de author_id:", e);
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

  // Atualiza um link existente no Supabase (incluindo eventual alteração de slug ou dados criptografados)
  async updateLink(originalSlug, { newSlug, encryptedData, hint, targetUrl }) {
    if (!originalSlug || !encryptedData) return false;
    const cleanOrig = String(originalSlug).trim().toLowerCase().replace(/^[/#]+/, '');
    const cleanNew = String(newSlug || originalSlug).trim().toLowerCase().replace(/^[/#]+/, '');

    try {
      const existing = await this.getLink(cleanOrig);
      if (!existing) return false;

      // Preserva informações do autor existente caso não venham em encryptedData
      if (typeof encryptedData === "object" && encryptedData !== null) {
        if (!encryptedData.author_type && existing.author_type) encryptedData.author_type = existing.author_type;
        if (!encryptedData.author_username && existing.encrypted_data && existing.encrypted_data.author_username) {
          encryptedData.author_username = existing.encrypted_data.author_username;
        }
        if (!encryptedData.author_name && existing.author_name) encryptedData.author_name = existing.author_name;
      }

      // Se mudou o slug, remove o antigo e insere o novo mantendo contagem de cliques, autoria e data de criação
      if (cleanNew !== cleanOrig) {
        await this.deleteLink(cleanOrig);
        const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}`;
        const payload = {
          slug: cleanNew,
          encrypted_data: encryptedData,
          hint: hint || null,
          clicks: existing.clicks || 0,
          created_at: existing.created_at || new Date().toISOString(),
          author_type: existing.author_type || "github",
          author_name: existing.author_name || "GitHub"
        };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            ...this.getHeaders(),
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify(payload)
        });
        return res.ok || res.status === 201;
      } else {
        // Se o slug é o mesmo, atualiza diretamente via PATCH
        const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(cleanOrig)}`;
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: {
            ...this.getHeaders(),
            "Prefer": "return=representation"
          },
          body: JSON.stringify({
            encrypted_data: encryptedData,
            hint: hint || null
          })
        });
        return res.ok;
      }
    } catch (e) {
      console.error(`[Supabase] Falha ao atualizar link /${cleanOrig}:`, e);
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

  // Exclui múltiplos links em lote no Supabase
  async deleteLinksBatch(slugs) {
    if (!Array.isArray(slugs) || slugs.length === 0) return false;
    const cleanSlugs = slugs.map(s => String(s).trim().toLowerCase().replace(/^[/#]+/, '')).filter(Boolean);
    if (cleanSlugs.length === 0) return false;

    try {
      // Usa o operador in do PostgREST para exclusão em lote
      const inList = cleanSlugs.map(s => `"${encodeURIComponent(s)}"`).join(',');
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=in.(${inList})`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          ...this.getHeaders(),
          "Prefer": "return=minimal"
        }
      });

      return res.ok || res.status === 204 || res.status === 200;
    } catch (e) {
      console.error("[Supabase] Falha ao excluir links em lote:", e);
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
