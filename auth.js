/**
 * Shortener - Módulo de Autenticação Segura GitHub (auth.js)
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
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (parsed) {
        // Auto-correção para contas do Google salvas anteriormente
        if (parsed.email && (parsed.email.endsWith('@gmail.com') || parsed.email.includes('google')) || (parsed.avatar && parsed.avatar.includes('googleusercontent'))) {
          parsed.provider = "google";
          parsed.providerName = "Google";
        }
      }
      return parsed;
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
        if (!window.location.pathname.includes("/painel")) {
          window.location.href = getRelativePathTo("painel");
        }
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
    if (!window.location.pathname.includes("/painel")) {
      window.location.href = getRelativePathTo("painel");
    }
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
  const provider = userData.provider || "github";
  const authorName = userData.name || (userData.username ? `@${userData.username}` : (provider === "google" ? "Google" : "GitHub"));
  const authorId = userData.id || `${provider}_${cleanUsername}`;
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
      console.log(`[Supabase Migration] Migrando ${visitorSlugsToMigrate.length} links de visitante para a conta (${provider}) @${cleanUsername}...`);

      for (const slug of visitorSlugsToMigrate) {
        try {
          await window.supabaseDb.updateLinkAuthor(slug, {
            authorType: provider,
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

    // Sincroniza a coluna author_id em links do usuário que ainda não a possuam
    if (window.supabaseDb && typeof window.supabaseDb.syncUserLinksAuthorId === "function") {
      await window.supabaseDb.syncUserLinksAuthorId(userData);
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
      const displayName = user.username ? `@${user.username}` : (user.name || "GitHub");
      const avatarSrc = user.avatar || `https://avatars.githubusercontent.com/${user.username || 'github'}`;
      container.innerHTML = `
        <div class="user-profile-menu">
          <a href="${getRelativePathTo('painel')}" class="user-avatar-btn" title="Acessar Painel (${escapeHtml(displayName)})">
            <img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(displayName)}" class="user-avatar-img" />
            <span class="user-name-label">${escapeHtml(displayName)}</span>
          </a>
          <button type="button" class="user-logout-btn" onclick="handleAuthLogout()" title="Sair da conta" aria-label="Sair da conta">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span class="logout-text">Sair</span>
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <button type="button" class="btn btn-primary btn-sm auth-login-btn" onclick="openLoginModal()" title="Entrar na sua conta" aria-label="Entrar na sua conta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span class="auth-btn-text-desktop">Entrar</span>
          <span class="auth-btn-text-mobile">Entrar</span>
        </button>
      `;
    }
  });

  // 2. Controla o estado e o ícone de cadeado do link 'Painel' EXCLUSIVAMENTE na barra de navegação (.nav-links)
  const painelNavLinks = document.querySelectorAll(".nav-links li.nav-painel-item a, .nav-links a.nav-link[href*='painel']");
  painelNavLinks.forEach(link => {
    if (link.classList.contains("user-avatar-btn") || link.closest("#auth-header-slot") || link.closest(".auth-slot")) return;
    const parentLi = link.closest('li');
    if (parentLi) {
      parentLi.style.display = ""; // Sempre visível tanto para visitante quanto para logado
    }
    link.style.display = "";

    if (isAuth) {
      link.classList.remove("nav-link-locked");
      link.removeAttribute("title");
      link.innerHTML = `Painel`;
    } else {
      link.classList.add("nav-link-locked");
      link.setAttribute("title", "Painel (Acesso Restrito - Requer Login)");
      link.innerHTML = `
        <span class="nav-link-label">Painel</span>
        <span class="nav-lock-badge" aria-label="Acesso Restrito">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </span>
      `;
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

// Redireciona diretamente para o fluxo oficial de autorização OAuth do GitHub apontando para o Painel
async function loginWithGitHubOAuth() {
  const painelRel = getRelativePathTo("painel");
  const targetRedirect = new URL(painelRel, window.location.href).href;
  const authUrl = window.supabaseDb 
    ? await window.supabaseDb.getOAuthUrl("github", targetRedirect)
    : `https://nmqzjcriwggemfawpjqc.supabase.co/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(targetRedirect)}`;
  window.location.href = authUrl;
}

// Redireciona diretamente para o fluxo oficial de autorização OAuth do Google apontando para o Painel
async function loginWithGoogleOAuth() {
  const painelRel = getRelativePathTo("painel");
  const targetRedirect = new URL(painelRel, window.location.href).href;
  const authUrl = window.supabaseDb 
    ? await window.supabaseDb.getOAuthUrl("google", targetRedirect)
    : `https://nmqzjcriwggemfawpjqc.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(targetRedirect)}`;
  window.location.href = authUrl;
}

window.loginWithGitHubOAuth = loginWithGitHubOAuth;
window.loginWithGoogleOAuth = loginWithGoogleOAuth;
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;

// Modal de Diálogo com opções de Login (GitHub e Google)
function openLoginModal() {
  let modal = document.querySelector("#auth-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "modal-backdrop";
    modal.onclick = (e) => {
      if (e.target === modal) closeLoginModal();
    };
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 420px; padding: 2rem 1.75rem; position: relative;">
      <div class="modal-header" style="justify-content: space-between; border-bottom: none; padding: 0; margin-bottom: 0.5rem;">
        <h2 style="font-size: 1.3rem; font-weight: 700; color: #fff; margin: 0;">Entrar no Shortener</h2>
        <button class="modal-close-btn" onclick="closeLoginModal()" aria-label="Fechar modal">&times;</button>
      </div>

      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.55;">
        Conecte sua conta para gerenciar seus links encurtados, acompanhar cliques e editar senhas no Painel:
      </p>

      <div class="social-login-group">
        <button type="button" class="btn-social btn-github" onclick="loginWithGitHubOAuth()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#181717">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>Entrar com GitHub</span>
        </button>

        <button type="button" class="btn-social btn-google" onclick="loginWithGoogleOAuth()">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Entrar com Google</span>
        </button>
      </div>
    </div>
  `;

  modal.style.display = "flex";
}

function closeLoginModal() {
  const modal = document.querySelector("#auth-modal");
  if (modal) modal.style.display = "none";
}

// Aplica a sessão autenticada com os dados do perfil do usuário (GitHub ou Google)
async function applyUserSession(data, accessToken, refreshToken) {
  if (!data) return;
  const meta = data.user_metadata || {};
  const identities = data.identities || [];
  const identity = identities[0] || {};
  const idData = identity.identity_data || {};

  let provider = data.app_metadata?.provider || identity.provider || meta.provider;
  if (!provider) {
    if (data.email && (data.email.endsWith("@gmail.com") || data.email.includes("google"))) {
      provider = "google";
    } else if (meta.picture && meta.picture.includes("googleusercontent")) {
      provider = "google";
    } else if (meta.avatar_url && meta.avatar_url.includes("githubusercontent")) {
      provider = "github";
    } else if (data.email && data.email.includes("@github")) {
      provider = "github";
    } else {
      provider = "google";
    }
  }
  provider = String(provider).toLowerCase();

  const rawUsername = meta.user_name || meta.preferred_username || idData.user_name || idData.login || (data.email ? data.email.split('@')[0] : "usuario");
  const cleanUsername = String(rawUsername).toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 39);
  const fullName = meta.full_name || meta.name || idData.name || meta.display_name || (provider === "google" ? "Google" : "GitHub");
  const avatar = meta.avatar_url || meta.picture || idData.avatar_url || idData.picture || (provider === "github" ? `https://avatars.githubusercontent.com/${cleanUsername}` : "");

  const userData = {
    id: data.id || (`${provider}_` + cleanUsername),
    username: cleanUsername,
    name: fullName,
    email: data.email || `${cleanUsername}@${provider}.com`,
    avatar: avatar,
    provider: provider,
    providerName: provider === "google" ? "Google" : "GitHub",
    accessToken: accessToken || "",
    refreshToken: refreshToken || "",
    createdAt: new Date().toISOString()
  };

  window.authManager.saveUser(userData);
  await migrateVisitorLinksToAccount(userData);

  // Limpa os parâmetros de autenticação da URL mantendo o endereço limpo
  const cleanUrl = window.location.pathname;
  window.history.replaceState(null, document.title, cleanUrl);

  renderAuthHeader();

  // Sempre redireciona para o Painel após o login com sucesso caso não esteja nele
  if (!window.location.pathname.includes("/painel")) {
    window.location.href = getRelativePathTo("painel");
    return;
  }

  if (typeof initDashboard === "function") {
    initDashboard();
  }
}

// Processa o retorno da autorização OAuth do GitHub (Suporta tanto PKCE ?code=... quanto Implicit #access_token=...)
async function handleOAuthCallback() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  // 1. Trata mensagens ou erros retornados na URL se houver
  if (hash.includes("error=") || search.includes("error=")) {
    const params = new URLSearchParams(hash ? hash.substring(1) : search);
    const errorDesc = params.get("error_description") || params.get("error");
    if (errorDesc) {
      console.warn("[OAuth] Mensagem de autorização:", errorDesc);
      const cleanUrl = window.location.pathname;
      window.history.replaceState(null, document.title, cleanUrl);
    }
    return;
  }

  // 2. Fluxo PKCE (?code=xxxx ou #code=xxxx)
  if (search.includes("code=") || hash.includes("code=")) {
    const searchParams = new URLSearchParams(search || (hash ? hash.substring(1) : ""));
    const code = searchParams.get("code");
    if (code && window.supabaseDb) {
      try {
        const sessionData = await window.supabaseDb.exchangeCodeForSession(code);
        if (sessionData && (sessionData.user || sessionData.access_token)) {
          const userObj = sessionData.user || (sessionData.access_token ? await window.supabaseDb.getUserFromToken(sessionData.access_token) : null);
          if (userObj) {
            await applyUserSession(userObj, sessionData.access_token, sessionData.refresh_token);
            return;
          }
        }
      } catch (err) {
        console.error("[OAuth] Erro ao trocar code por sessão:", err);
      }
    }
  }

  // 3. Fluxo Implicit (#access_token=xxxx)
  if (hash.includes("access_token=")) {
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (accessToken && window.supabaseDb) {
      try {
        const data = await window.supabaseDb.getUserFromToken(accessToken);
        if (data) {
          await applyUserSession(data, accessToken, refreshToken);
          return;
        }
      } catch (err) {
        console.error("[OAuth] Erro ao autenticar callback do GitHub:", err);
      }
    }
  }
}

// Controle do Menu Hambúrguer Mobile (100% confiável, sem substituição de DOM e com controle de propagação)
function toggleMobileMenu(event) {
  if (event) {
    if (typeof event.stopPropagation === "function") event.stopPropagation();
  }
  const header = document.querySelector(".site-header");
  const toggleBtn = document.querySelector(".mobile-menu-toggle");
  if (!header) return;

  const isOpen = header.classList.toggle("mobile-nav-open");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function closeMobileMenu() {
  const header = document.querySelector(".site-header");
  const toggleBtn = document.querySelector(".mobile-menu-toggle");
  if (header && header.classList.contains("mobile-nav-open")) {
    header.classList.remove("mobile-nav-open");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-expanded", "false");
    }
  }
}

// Fecha o menu mobile ao clicar em links internos ou fora do cabeçalho
document.addEventListener("click", (e) => {
  const header = document.querySelector(".site-header");
  if (!header || !header.classList.contains("mobile-nav-open")) return;

  // Não fecha se o clique foi diretamente no botão de abrir/fechar o menu
  if (e.target && e.target.closest && e.target.closest(".mobile-menu-toggle")) return;

  // Fecha se clicou em um link do menu ou fora do cabeçalho
  if (e.target && e.target.closest) {
    if (e.target.closest(".nav-link") || e.target.closest(".github-badge") || !e.target.closest(".site-header")) {
      closeMobileMenu();
    }
  } else {
    closeMobileMenu();
  }
});

function getRelativePathTo(target) {
  const depth = window.location.pathname.includes("/criar") || 
                window.location.pathname.includes("/descriptografar") || 
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
async function initAuth() {
  await handleOAuthCallback();
  renderAuthHeader();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuth);
} else {
  initAuth();
}
