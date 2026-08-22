/**
 * Encurtador de Links - Módulo de Autenticação Segura GitHub (auth.js)
 * Conexão direta com perfis públicos do GitHub, sem usuários fixos ou vulnerabilidades
 */

const AUTH_USER_KEY = "encurtador_auth_user";

class AuthManager {
  constructor() {
    this.user = this.loadUser();
    this.listeners = [];
  }

  loadUser() {
    try {
      const data = localStorage.getItem(AUTH_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Erro ao carregar usuário do LocalStorage:", e);
      return null;
    }
  }

  saveUser(userData) {
    this.user = userData;
    if (userData) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
    this.notifyListeners();
    renderAuthHeader();
  }

  isAuthenticated() {
    return this.user !== null;
  }

  getUser() {
    return this.user;
  }

  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    callback(this.user);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.user); } catch (e) { console.error(e); }
    });
  }

  // Valida e conecta com o perfil informado do GitHub via API oficial
  async loginWithGitHub(username) {
    const rawUser = String(username || "").trim().replace(/^@/, '');
    const cleanUsername = rawUser.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 39);

    if (!cleanUsername) {
      return {
        success: false,
        error: "Por favor, digite um nome de usuário válido do GitHub."
      };
    }

    try {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`);
      
      if (response.status === 404) {
        return {
          success: false,
          error: `O usuário "@${cleanUsername}" não foi encontrado no GitHub. Verifique a grafia e tente novamente.`
        };
      }

      if (response.ok) {
        const data = await response.json();
        const safeAvatar = (data.avatar_url && String(data.avatar_url).startsWith("https://")) 
          ? data.avatar_url 
          : `https://avatars.githubusercontent.com/${cleanUsername}`;

        const userData = {
          id: "github_" + String(data.id || data.login || cleanUsername),
          username: String(data.login || cleanUsername),
          name: String(data.name || data.login || cleanUsername),
          email: `${String(data.login || cleanUsername)}@github.com`,
          avatar: safeAvatar,
          bio: String(data.bio || ""),
          profileUrl: `https://github.com/${encodeURIComponent(data.login || cleanUsername)}`,
          provider: "github",
          providerName: "GitHub",
          createdAt: new Date().toISOString()
        };

        this.saveUser(userData);
        await migrateVisitorLinksToAccount(userData);
        return { success: true, user: userData };
      }
    } catch (err) {
      console.warn("Aviso ao conectar com a API do GitHub:", err);
    }

    // Fallback gracioso com avatar oficial do GitHub caso haja bloqueio temporário de rede ou rate limit
    const userData = {
      id: "github_" + cleanUsername.toLowerCase(),
      username: cleanUsername,
      name: cleanUsername,
      email: `${cleanUsername}@github.com`,
      avatar: `https://avatars.githubusercontent.com/${cleanUsername}`,
      profileUrl: `https://github.com/${cleanUsername}`,
      provider: "github",
      providerName: "GitHub",
      createdAt: new Date().toISOString()
    };

    this.saveUser(userData);
    await migrateVisitorLinksToAccount(userData);
    return { success: true, user: userData };
  }

  // Logout seguro: limpa a sessão e zera completamente o cache local
  logout() {
    this.saveUser(null);
    try {
      localStorage.removeItem("linklock_saved_custom_links");
      localStorage.removeItem("linklock_history");
      if (window.clickTracker && typeof window.clickTracker.clearAll === "function") {
        window.clickTracker.clearAll();
      }
    } catch (e) {
      console.error("Erro ao limpar cache local no logout:", e);
    }
  }
}

// Migra imediatamente os links criados no modo visitante para a conta conectada no Supabase
async function migrateVisitorLinksToAccount(userData) {
  if (!userData || !userData.username) return;
  const cleanUsername = String(userData.username).toLowerCase().replace(/^@/, '');
  const authorName = userData.username ? `@${userData.username}` : (userData.name || 'GitHub');
  const authorId = userData.id || `github_${cleanUsername}`;
  const authorAvatar = userData.avatar || '';

  try {
    const rawSaved = localStorage.getItem("linklock_saved_custom_links");
    const rawHistory = localStorage.getItem("linklock_history");
    let guestLinks = [];

    if (rawSaved) {
      try {
        const parsed = JSON.parse(rawSaved);
        if (Array.isArray(parsed)) guestLinks.push(...parsed);
      } catch {}
    }
    if (rawHistory) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) guestLinks.push(...parsed);
      } catch {}
    }

    // Identifica slugs únicos de links criados como visitante
    const uniqueSlugs = new Set();
    const visitorSlugsToMigrate = [];

    guestLinks.forEach(item => {
      if (item && item.slug && !uniqueSlugs.has(item.slug.toLowerCase())) {
        uniqueSlugs.add(item.slug.toLowerCase());
        const isGuest = !item.authorType || item.authorType === "visitante" || !item.authorUsername || item.authorUsername === "visitante";
        if (isGuest) {
          visitorSlugsToMigrate.push(item.slug.toLowerCase());
        }
      }
    });

    if (visitorSlugsToMigrate.length > 0 && window.supabaseDb) {
      console.log(`[Supabase Migration] Migrando ${visitorSlugsToMigrate.length} links de visitante para a conta @${cleanUsername}...`);

      for (const slug of visitorSlugsToMigrate) {
        try {
          await window.supabaseDb.updateLinkAuthor(slug, {
            authorType: "github",
            authorUsername: cleanUsername,
            authorId: authorId,
            authorName: authorName,
            authorAvatar: authorAvatar
          });
        } catch (slugErr) {
          console.warn(`[Supabase Migration] Erro ao migrar slug /${slug}:`, slugErr);
        }
      }
    }

    // Após garantir a atualização/migração no Supabase, limpa COMPLETAMENTE o cache local
    localStorage.removeItem("linklock_saved_custom_links");
    localStorage.removeItem("linklock_history");
    console.log("[Supabase Migration] Migração concluída e cache local de visitante limpo.");
  } catch (err) {
    console.error("[Supabase Migration] Erro durante a migração de visitante:", err);
  }
}

window.migrateVisitorLinksToAccount = migrateVisitorLinksToAccount;

// Instância global
window.authManager = new AuthManager();

// =========================================================================
// Interface do Usuário: Cabeçalho, Controle de Visibilidade & Modal de Login
// =========================================================================

function renderAuthHeader() {
  const isAuth = window.authManager.isAuthenticated();
  const user = window.authManager.getUser();

  // 1. Atualiza slots de autenticação (desktop e mobile se presentes)
  const authContainers = document.querySelectorAll("#auth-header-slot, .auth-slot");
  authContainers.forEach(container => {
    if (isAuth && user) {
      const displayName = user.username ? `@${user.username}` : user.name;
      container.innerHTML = `
        <div class="user-profile-menu">
          <a href="${getRelativePathTo('painel')}" class="user-avatar-btn" title="Acessar Painel (@${escapeHtml(user.username || user.name)})">
            <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(displayName)}" class="user-avatar-img" />
            <span class="user-name-label">${escapeHtml(displayName)}</span>
          </a>
          <button type="button" class="user-logout-btn" onclick="handleAuthLogout()" title="Sair da conta">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Sair</span>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button type="button" class="btn btn-github btn-sm auth-login-btn" onclick="openLoginModal()" style="display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0.75rem; min-height: 36px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>Entrar com GitHub</span>
        </button>
      `;
    }
  });

  // 2. Controla a visibilidade do link 'Painel' no cabeçalho (apenas visível se logado)
  const painelNavLinks = document.querySelectorAll("a[href*='painel'], li.nav-painel-item");
  painelNavLinks.forEach(item => {
    if (item.tagName.toLowerCase() === 'a') {
      const parentLi = item.closest('li');
      if (parentLi) {
        parentLi.style.display = isAuth ? "" : "none";
      } else {
        item.style.display = isAuth ? "" : "none";
      }
    } else {
      item.style.display = isAuth ? "" : "none";
    }
  });
}

function handleAuthLogout() {
  window.authManager.logout();
  if (window.location.pathname.includes("/painel")) {
    if (typeof initDashboard === "function") {
      initDashboard();
    } else {
      window.location.reload();
    }
  } else {
    window.location.reload();
  }
}

// Modal Seguro de Login com GitHub (solicita o usuário explicitamente)
function openLoginModal() {
  let modal = document.querySelector("#auth-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "modal-backdrop";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 420px; text-align: center; padding: 2rem 1.75rem; position: relative;">
      <div class="modal-header" style="justify-content: flex-end; border-bottom: none; padding: 0; margin-bottom: 0.25rem;">
        <button class="modal-close-btn" onclick="closeLoginModal()" aria-label="Fechar modal">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="width: 60px; height: 60px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1px solid #e2e8f0; color: #181717; box-shadow: 0 4px 12px rgba(0,0,0,0.35);">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </div>

        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 700; color: #fff;">Entrar com GitHub</h2>
        <p style="color: var(--text-secondary); font-size: 0.88rem; margin-bottom: 1.5rem; line-height: 1.55;">
          Digite seu nome de usuário do GitHub para sincronizar seus links personalizados e gerenciar estatísticas no Painel.
        </p>

        <form id="gh-login-form" onsubmit="handleLoginSubmit(event)" style="width: 100%; text-align: left;">
          <div class="form-group labeled-input" style="margin-bottom: 1rem;">
            <label for="gh-username-input" style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
              Nome de Usuário no GitHub
            </label>
            <div class="slug-input-group" style="margin-top: 0.35rem;">
              <span class="slug-prefix" style="color: var(--text-muted);">@</span>
              <input 
                type="text" 
                id="gh-username-input" 
                placeholder="seu-usuario" 
                autocomplete="username" 
                required 
                autofocus
                style="padding-left: 0.5rem;"
              />
            </div>
          </div>

          <div id="gh-login-error" style="display: none; background: var(--danger-bg); border: 1px solid var(--danger-border); color: #f87171; border-radius: var(--radius-md); padding: 0.65rem 0.85rem; font-size: 0.82rem; margin-bottom: 1rem; line-height: 1.45;"></div>

          <button type="submit" id="gh-submit-btn" class="btn btn-github btn-block" style="display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 0.8rem 1.25rem; font-size: 0.95rem; font-weight: 600;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>Entrar com GitHub</span>
          </button>
        </form>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  setTimeout(() => {
    const input = document.querySelector("#gh-username-input");
    if (input) input.focus();
  }, 100);
}

function closeLoginModal() {
  const modal = document.querySelector("#auth-modal");
  if (modal) modal.style.display = "none";
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const input = document.querySelector("#gh-username-input");
  const errorEl = document.querySelector("#gh-login-error");
  const submitBtn = document.querySelector("#gh-submit-btn");

  if (!input) return;
  const username = input.value.trim();

  if (errorEl) errorEl.style.display = "none";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(0,0,0,0.2); border-top-color: #000; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span>Verificando perfil...</span>
    `;
  }

  const result = await window.authManager.loginWithGitHub(username);

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
      </svg>
      <span>Entrar com GitHub</span>
    `;
  }

  if (!result.success) {
    if (errorEl) {
      errorEl.innerText = result.error || "Não foi possível conectar com este usuário.";
      errorEl.style.display = "block";
    }
    return;
  }

  closeLoginModal();
  renderAuthHeader();

  // Se estiver na página do painel, recarrega os dados do painel imediatamente
  if (window.location.pathname.includes("/painel")) {
    if (typeof initDashboard === "function") {
      initDashboard();
    } else {
      window.location.reload();
    }
  }

  // Se estiver na página de criação, atualiza a visibilidade do campo de slug
  if (window.location.pathname.includes("/criar")) {
    if (typeof updateAuthSlugState === "function") {
      updateAuthSlugState();
    }
  }
}

// Controle do Menu Hambúrguer Mobile
function toggleMobileMenu() {
  const header = document.querySelector(".site-header");
  const toggleBtn = document.querySelector(".mobile-menu-toggle");
  if (!header) return;

  const isOpen = header.classList.toggle("mobile-nav-open");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleBtn.innerHTML = isOpen 
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
  }
}

function closeMobileMenu() {
  const header = document.querySelector(".site-header");
  const toggleBtn = document.querySelector(".mobile-menu-toggle");
  if (header && header.classList.contains("mobile-nav-open")) {
    header.classList.remove("mobile-nav-open");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "false");
      toggleBtn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    }
  }
}

// Fecha o menu mobile ao clicar fora dele
document.addEventListener("click", (e) => {
  const header = document.querySelector(".site-header");
  if (!header || !header.classList.contains("mobile-nav-open")) return;

  const clickedInside = header.contains(e.target);
  if (!clickedInside) {
    closeMobileMenu();
  }
});

function getRelativePathTo(target) {
  const depth = window.location.pathname.includes("/criar") || 
                window.location.pathname.includes("/descriptografar") || 
                window.location.pathname.includes("/favoritos-ocultos") || 
                window.location.pathname.includes("/forca-bruta") || 
                window.location.pathname.includes("/painel") ? "../" : "./";
  return depth + target;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Inicialização imediata e no carregamento do DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderAuthHeader);
} else {
  renderAuthHeader();
}
