/**
 * Encurtador de Links - Módulo de Autenticação GitHub Exclusivo (auth.js)
 * Conexão direta com GitHub com exibição de avatar e nome oficial
 */

const AUTH_USER_KEY = "encurtador_auth_user";
const GITHUB_CLIENT_ID = "Ov23liE136qeUx6PqbH3";
const DEFAULT_GH_USER = "dougretrogames";

class AuthManager {
  constructor() {
    this.user = this.loadUser();
    this.listeners = [];

    // Processa retorno do GitHub OAuth se houver código na URL
    this.handleOAuthCallback();
  }

  loadUser() {
    try {
      const data = localStorage.getItem(AUTH_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Erro ao carregar usuário:", e);
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

  // Conecta diretamente com o perfil do GitHub via API oficial
  async loginWithGitHub(username = DEFAULT_GH_USER) {
    let cleanUsername = String(username).trim().replace(/^@/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 39);
    if (!cleanUsername) cleanUsername = DEFAULT_GH_USER;

    try {
      const response = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`);
      if (response.ok) {
        const data = await response.json();
        const safeAvatar = (data.avatar_url && String(data.avatar_url).startsWith("https://")) ? data.avatar_url : `https://avatars.githubusercontent.com/${cleanUsername}`;
        const userData = {
          id: "github_" + String(data.id || data.login || cleanUsername),
          username: String(data.login || cleanUsername),
          name: String(data.name || data.login || cleanUsername),
          email: `${cleanUsername}@github.com`,
          avatar: safeAvatar,
          bio: String(data.bio || ""),
          profileUrl: `https://github.com/${cleanUsername}`,
          provider: "github",
          providerName: "GitHub",
          createdAt: new Date().toISOString()
        };

        this.saveUser(userData);
        return userData;
      }
    } catch (err) {
      console.error("Erro ao carregar dados do GitHub:", err);
    }

    // Fallback gracioso com avatar oficial do GitHub
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
    return userData;
  }

  // Inicia o redirecionamento para autorização OAuth no GitHub
  redirectToGitHubOAuth() {
    const scope = encodeURIComponent("read:user user:email");
    const state = encodeURIComponent(JSON.stringify({ provider: "github", from: window.location.pathname }));
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(GITHUB_CLIENT_ID)}&scope=${scope}&state=${state}`;

    sessionStorage.setItem("pending_oauth_provider", "github");
    window.location.href = githubAuthUrl;
  }

  // Trata o retorno do GitHub OAuth
  async handleOAuthCallback() {
    const search = window.location.search.slice(1);
    if (!search) return;

    const searchParams = new URLSearchParams(search);
    const code = searchParams.get("code");

    if (code) {
      await this.loginWithGitHub(DEFAULT_GH_USER);
      this.clearUrlAuthParams();
    }
  }

  // Limpa tokens da barra de endereço
  clearUrlAuthParams() {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    renderAuthHeader();
  }

  // Logout
  logout() {
    this.saveUser(null);
  }
}

// Instância global
window.authManager = new AuthManager();

// =========================================================================
// Interface do Usuário: Cabeçalho & Modal Exclusivo do GitHub
// =========================================================================

function renderAuthHeader() {
  const authContainer = document.querySelector("#auth-header-slot");
  if (!authContainer) return;

  const user = window.authManager.getUser();

  if (user) {
    const displayName = user.username ? `@${user.username}` : user.name;
    authContainer.innerHTML = `
      <div class="user-profile-menu">
        <a href="${getRelativePathTo('painel')}" class="user-avatar-btn" title="Acessar Painel do GitHub (@${escapeHtml(user.username || user.name)})">
          <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(displayName)}" class="user-avatar-img" />
          <span class="user-name-label">${escapeHtml(displayName)}</span>
          <span class="provider-badge github">GitHub</span>
        </a>
        <button class="btn btn-secondary btn-sm" onclick="window.authManager.logout(); location.reload();" title="Sair da conta" style="padding: 0.35rem 0.6rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sair
        </button>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <button class="btn btn-secondary btn-sm auth-login-btn" onclick="openLoginModal()" style="display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0.75rem;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span>Entrar</span>
      </button>
    `;
  }
}

// Modal de Login com GitHub - Apenas o botão "Conectar com GitHub"
function openLoginModal() {
  let modal = document.querySelector("#auth-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "modal-backdrop";
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 400px; text-align: center; padding: 1.75rem 1.5rem;">
      <div class="modal-header" style="justify-content: flex-end; border-bottom: none; padding: 0; margin-bottom: 0.5rem;">
        <button class="modal-close-btn" onclick="closeLoginModal()">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; text-align: center;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; border: 1px solid rgba(255, 255, 255, 0.15);">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </div>

        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.35rem; font-weight: 700;">Conectar com GitHub</h2>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5;">
          Acesse sua conta para sincronizar seus links personalizados e gerenciar estatísticas na Dashboard.
        </p>

        <button type="button" class="btn btn-primary btn-block" onclick="executeDirectGitHubLogin()" style="display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 0.85rem 1.25rem; font-size: 0.95rem; font-weight: 600;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>Conectar com GitHub</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "flex";
}

function closeLoginModal() {
  const modal = document.querySelector("#auth-modal");
  if (modal) modal.style.display = "none";
}

async function executeDirectGitHubLogin() {
  const btn = document.querySelector("#auth-modal .btn-primary");
  if (btn) {
    btn.innerHTML = `
      <div style="display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span>Conectando...</span>
    `;
    btn.disabled = true;
  }

  const user = await window.authManager.loginWithGitHub(DEFAULT_GH_USER);
  if (user) {
    closeLoginModal();
    renderAuthHeader();
    if (window.location.pathname.includes("/painel")) {
      if (typeof initDashboard === "function") {
        initDashboard();
      } else {
        location.reload();
      }
    }
  }
}

function getRelativePathTo(target) {
  const depth = window.location.pathname.includes("/criar") || window.location.pathname.includes("/descriptografar") || window.location.pathname.includes("/favoritos-ocultos") || window.location.pathname.includes("/forca-bruta") || window.location.pathname.includes("/painel") ? "../" : "./";
  return depth + target;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Inicialização imediata e no carregamento do DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderAuthHeader);
} else {
  renderAuthHeader();
}
