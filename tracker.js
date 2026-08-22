/**
 * Shortener - Módulo de Rastreamento de Cliques e Analytics (tracker.js)
 * Contabiliza acessos, timestamps e estatísticas de uso para a Dashboard
 */

var TRACKER_CLICKS_KEY = "encurtador_clicks_data";
var TRACKER_SAVED_LINKS_KEY = "linklock_saved_custom_links";

class ClickTracker {
  constructor() {
    this.clicks = this.loadClicks();
  }

  loadClicks() {
    try {
      const data = localStorage.getItem(TRACKER_CLICKS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  saveClicks() {
    try {
      localStorage.setItem(TRACKER_CLICKS_KEY, JSON.stringify(this.clicks));
    } catch (e) {
      console.error("Erro ao salvar cliques:", e);
    }
  }

  // Registra um clique/acesso a um link
  recordClick(slugOrHash) {
    if (!slugOrHash) return;

    const key = String(slugOrHash).toLowerCase();
    // Proteção contra Prototype Pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype" || key.length > 250) {
      return;
    }

    const now = new Date().toISOString();

    if (!Object.prototype.hasOwnProperty.call(this.clicks, key)) {
      this.clicks[key] = {
        total: 0,
        history: [],
        lastAccessed: null
      };
    }

    this.clicks[key].total += 1;
    this.clicks[key].lastAccessed = now;

    // Sanitiza e limita o referrer para prevenir estouro de cota
    let referrerClean = (document.referrer || "Direto / Favorito").slice(0, 150);

    this.clicks[key].history.push({
      timestamp: now,
      referrer: referrerClean,
      device: this.detectDevice()
    });

    // Limita histórico a últimos 50 eventos para economia de memória
    if (this.clicks[key].history.length > 50) {
      this.clicks[key].history.shift();
    }

    this.saveClicks();

    // Também atualiza o contador dentro dos links salvos se existir
    this.updateSavedLinkClickCount(key);
  }

  // Atualiza a contagem dentro da lista de links salvos
  updateSavedLinkClickCount(slugKey) {
    try {
      const raw = localStorage.getItem(TRACKER_SAVED_LINKS_KEY);
      if (!raw) return;

      const links = JSON.parse(raw);
      let updated = false;

      links.forEach(link => {
        const linkSlug = (link.slug || "").toLowerCase();
        if (linkSlug === slugKey || (link.outputUrl && link.outputUrl.toLowerCase().includes(slugKey))) {
          link.clicks = (link.clicks || 0) + 1;
          link.lastAccessed = new Date().toISOString();
          updated = true;
        }
      });

      if (updated) {
        localStorage.setItem(TRACKER_SAVED_LINKS_KEY, JSON.stringify(links));
      }
    } catch (e) {
      console.error("Erro ao atualizar link salvo:", e);
    }
  }

  // Retorna estatísticas de um link
  getLinkStats(slugOrHash) {
    if (!slugOrHash) return { total: 0, history: [], lastAccessed: null };
    const key = String(slugOrHash).toLowerCase();
    return this.clicks[key] || { total: 0, history: [], lastAccessed: null };
  }

  // Retorna métricas globais para a Dashboard
  getGlobalStats() {
    let totalClicks = 0;
    let mostClickedSlug = null;
    let maxClicks = 0;

    Object.keys(this.clicks).forEach(slug => {
      const count = this.clicks[slug].total || 0;
      totalClicks += count;
      if (count > maxClicks) {
        maxClicks = count;
        mostClickedSlug = slug;
      }
    });

    return {
      totalClicks,
      mostClickedSlug: mostClickedSlug || "Nenhum",
      maxClicks
    };
  }

  // Zera estatísticas de um link específico quando excluído ou recriado
  resetLink(slugOrHash) {
    if (!slugOrHash) return;
    const key = String(slugOrHash).toLowerCase();
    if (this.clicks && Object.prototype.hasOwnProperty.call(this.clicks, key)) {
      delete this.clicks[key];
      this.saveClicks();
    }
  }

  // Limpa todo o histórico de cliques local
  clearAll() {
    this.clicks = {};
    this.saveClicks();
  }

  detectDevice() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) return "Android";
    if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
    if (/windows/i.test(ua)) return "Windows";
    if (/mac/i.test(ua)) return "MacOS";
    if (/linux/i.test(ua)) return "Linux";
    return "Outro";
  }
}

// Instância global
window.clickTracker = new ClickTracker();
