/**
 * Encurtador de Links - Módulo de Autenticação OAuth Direta (auth.js)
 * Redirecionamento direto para Google, GitHub e Microsoft (Outlook)
 * Processamento de tokens de retorno, perfil e sincronização
 */

const AUTH_USER_KEY = "encurtador_auth_user";
const OAUTH_CONFIG_KEY = "encurtador_oauth_client_config";

// Configurações padrão de Client IDs
const DEFAULT_OAUTH_CONFIG = {
  googleClientId: "",
  githubClientId: "",
  microsoftClientId: ""
};

class AuthManager {
  constructor() {
    this.user = this.loadUser();
    this.listeners = [];
    this.config = this.loadOAuthConfig();

    // Processa retorno do OAuth se houver tokens na URL
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

  loadOAuthConfig() {
    try {
      const saved = localStorage.getItem(OAUTH_CONFIG_KEY);
      return saved ? { ...DEFAULT_OAUTH_CONFIG, ...JSON.parse(saved) } : DEFAULT_OAUTH_CONFIG;
    } catch {
      return DEFAULT_OAUTH_CONFIG;
    }
  }

  saveOAuthConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(OAUTH_CONFIG_KEY, JSON.stringify(this.config));
  }

  isProviderConfigured(provider) {
    if (provider === "google") {
      return Boolean(this.config.googleClientId && this.config.googleClientId.trim() !== "");
    }
    if (provider === "github") {
      return Boolean(this.config.githubClientId && this.config.githubClientId.trim() !== "");
    }
    if (provider === "microsoft") {
      return Boolean(this.config.microsoftClientId && this.config.microsoftClientId.trim() !== "");
    }
    return false;
  }

  // Obtém a URL de redirecionamento limpa para o OAuth
  getRedirectUri() {
    return window.location.origin + window.location.pathname;
  }

  // =========================================================================
  // Redirecionamento Direto para os Provedores de Autorização OAuth
  // =========================================================================

  redirectToGoogle() {
    if (!this.isProviderConfigured("google")) {
      openOAuthSetupModal("google");
      return;
    }

    const redirectUri = this.getRedirectUri();
    const clientId = this.config.googleClientId.trim();
    const scope = encodeURIComponent("openid profile email");
    const state = encodeURIComponent(JSON.stringify({ provider: "google", from: window.location.pathname }));
    
    // URL oficial de autorização do Google OAuth 2.0
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&state=${state}&prompt=select_account`;
    
    sessionStorage.setItem("pending_oauth_provider", "google");
    window.location.href = googleAuthUrl;
  }

  redirectToGitHub() {
    if (!this.isProviderConfigured("github")) {
      openOAuthSetupModal("github");
      return;
    }

    const redirectUri = this.getRedirectUri();
    const clientId = this.config.githubClientId.trim();
    const scope = encodeURIComponent("read:user user:email");
    const state = encodeURIComponent(JSON.stringify({ provider: "github", from: window.location.pathname }));

    // URL oficial de autorização do GitHub OAuth
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;

    sessionStorage.setItem("pending_oauth_provider", "github");
    window.location.href = githubAuthUrl;
  }

  redirectToMicrosoft() {
    if (!this.isProviderConfigured("microsoft")) {
      openOAuthSetupModal("microsoft");
      return;
    }

    const redirectUri = this.getRedirectUri();
    const clientId = this.config.microsoftClientId.trim();
    const scope = encodeURIComponent("openid profile email User.Read");
    const state = encodeURIComponent(JSON.stringify({ provider: "microsoft", from: window.location.pathname }));

    // URL oficial de autorização do Microsoft Identity Platform (Azure AD / Outlook)
    const microsoftAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}&state=${state}&prompt=select_account`;

    sessionStorage.setItem("pending_oauth_provider", "microsoft");
    window.location.href = microsoftAuthUrl;
  }

  // =========================================================================
  // Processamento do Retorno OAuth (Tokens & Dados do Usuário)
  // =========================================================================

  async handleOAuthCallback() {
    const hash = window.location.hash.slice(1);
    const search = window.location.search.slice(1);

    if (!hash && !search) return;

    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);

    const accessToken = hashParams.get("access_token");
    const idToken = hashParams.get("id_token");
    const code = searchParams.get("code");
    const stateRaw = hashParams.get("state") || searchParams.get("state");

    let state = {};
    try {
      if (stateRaw) state = JSON.parse(decodeURIComponent(stateRaw));
    } catch {}

    const pendingProvider = state.provider || sessionStorage.getItem("pending_oauth_provider");

    // Caso 1: Token recebido diretamente (Google ou Microsoft Implicit Flow)
    if (accessToken) {
      if (pendingProvider === "google") {
        await this.fetchGoogleUserProfile(accessToken);
      } else if (pendingProvider === "microsoft") {
        await this.fetchMicrosoftUserProfile(accessToken);
      }
      this.clearUrlAuthParams();
    } 
    // Caso 2: Código de autorização (GitHub OAuth)
    else if (code && pendingProvider === "github") {
      await this.fetchGitHubUserProfile(code);
      this.clearUrlAuthParams();
    }
  }

  async fetchGoogleUserProfile(token) {
    try {
      const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const userData = {
          id: "google_" + (data.sub || Math.random().toString(36).substring(2, 9)),
          name: data.name || data.given_name || "Usuário Google",
          email: data.email,
          avatar: data.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.email || 'google')}`,
          provider: "google",
          providerName: "Google",
          createdAt: new Date().toISOString()
        };
        this.saveUser(userData);
        sessionStorage.removeItem("pending_oauth_provider");
      }
    } catch (e) {
      console.warn("Não foi possível buscar perfil do Google via API direta:", e);
    }
  }

  async fetchMicrosoftUserProfile(token) {
    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const email = data.mail || data.userPrincipalName || "usuario@outlook.com";
        const userData = {
          id: "ms_" + (data.id || Math.random().toString(36).substring(2, 9)),
          name: data.displayName || "Usuário Microsoft",
          email: email,
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
          provider: "microsoft",
          providerName: "Outlook / Microsoft",
          createdAt: new Date().toISOString()
        };
        this.saveUser(userData);
        sessionStorage.removeItem("pending_oauth_provider");
      }
    } catch (e) {
      console.warn("Não foi possível buscar perfil da Microsoft via Graph API:", e);
    }
  }

  async fetchGitHubUserProfile(codeOrToken) {
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${codeOrToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        const userData = {
          id: "github_" + (data.id || data.login),
          name: data.name || data.login,
          email: data.email || `${data.login}@github.com`,
          avatar: data.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.login)}`,
          provider: "github",
          providerName: "GitHub",
          createdAt: new Date().toISOString()
        };
        this.saveUser(userData);
        sessionStorage.removeItem("pending_oauth_provider");
      }
    } catch (e) {
      console.warn("Não foi possível buscar perfil do GitHub via API direta:", e);
    }
  }

  // Limpa tokens e parâmetros de autorização da barra de endereços
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
// Interface do Usuário: Cabeçalho & Modais
// =========================================================================

function renderAuthHeader() {
  const authContainer = document.querySelector("#auth-header-slot");
  if (!authContainer) return;

  const user = window.authManager.getUser();

  if (user) {
    authContainer.innerHTML = `
      <div class="user-profile-menu">
        <a href="${getRelativePathTo('painel')}" class="user-avatar-btn" title="Acessar Painel de Controle">
          <img src="${user.avatar}" alt="${escapeHtml(user.name)}" class="user-avatar-img" />
          <span class="user-name-label">${escapeHtml(user.name)}</span>
          <span class="provider-badge ${user.provider}">${user.provider === 'microsoft' ? 'Outlook' : user.provider}</span>
        </a>
        <button class="btn btn-secondary btn-sm" onclick="window.authManager.logout(); location.reload();" title="Sair da conta" style="padding: 0.35rem 0.6rem;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          Sair
        </button>
      </div>
    `;
  } else {
    authContainer.innerHTML = `
      <button class="btn btn-secondary btn-sm auth-login-btn" onclick="openLoginModal()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>Entrar</span>
      </button>
    `;
  }
}

// Modal com Redirecionamento Direto para os Portais de Autorização
function openLoginModal() {
  let modal = document.querySelector("#auth-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>Entrar no Encurtador</h2>
          <button class="modal-close-btn" onclick="closeLoginModal()">&times;</button>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 1.25rem; line-height: 1.5;">
          Selecione o provedor para autorizar o acesso diretamente na página oficial:
        </p>

        <div class="social-login-group">
          <!-- Google -->
          <button class="btn-social btn-google" onclick="initiateDirectOAuth('google')">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>Autorizar com Google</span>
          </button>

          <!-- GitHub -->
          <button class="btn-social btn-github" onclick="initiateDirectOAuth('github')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>Autorizar com GitHub</span>
          </button>

          <!-- Microsoft / Outlook -->
          <button class="btn-social btn-microsoft" onclick="initiateDirectOAuth('microsoft')">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#7FBA00" d="M13 1h10v10H13z"/>
              <path fill="#00A4EF" d="M1 13h10v10H1z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            <span>Autorizar com Outlook / Microsoft</span>
          </button>
        </div>

        <div style="margin-top: 1.25rem; text-align: center; border-top: 1px solid var(--border-color); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; color: var(--text-muted);">
            🔒 Conexão OAuth 2.0 Oficial
          </span>
          <button onclick="openOAuthSettingsModal()" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.25rem 0.55rem;">
            ⚙️ Chaves de App
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = "flex";
}

function closeLoginModal() {
  const modal = document.querySelector("#auth-modal");
  if (modal) modal.style.display = "none";
}

function initiateDirectOAuth(provider) {
  if (provider === "google") {
    window.authManager.redirectToGoogle();
  } else if (provider === "github") {
    window.authManager.redirectToGitHub();
  } else if (provider === "microsoft") {
    window.authManager.redirectToMicrosoft();
  }
}

// Modal de Ajuda & Configuração Rápida de Client ID
function openOAuthSetupModal(provider) {
  closeLoginModal();
  let modal = document.querySelector("#oauth-setup-modal");

  const providerInfo = {
    google: {
      name: "Google",
      portal: "https://console.cloud.google.com/apis/credentials",
      portalName: "Google Cloud Console",
      docStep: "1. Crie um 'ID do cliente OAuth' (Aplicativo da Web)\n2. Origem JavaScript autorizada: <code>" + window.location.origin + "</code>\n3. URI de redirecionamento autorizada: <code>" + window.location.origin + window.location.pathname + "</code>",
      placeholder: "Ex: 123456789-abc.apps.googleusercontent.com",
      configField: "googleClientId"
    },
    github: {
      name: "GitHub",
      portal: "https://github.com/settings/applications/new",
      portalName: "GitHub - Registrar Novo OAuth App",
      docStep: "1. Preencha o nome do aplicativo (ex: Encurtador)\n2. Homepage URL: <code>" + window.location.origin + "/encurtador/</code>\n3. Authorization callback URL: <code>" + window.location.origin + "/encurtador/painel/</code>",
      placeholder: "Ex: Iv1.1234567890abcdef",
      configField: "githubClientId"
    },
    microsoft: {
      name: "Microsoft / Outlook",
      portal: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
      portalName: "Azure Portal (App Registrations)",
      docStep: "1. Registre um novo aplicativo para 'Contas Microsoft pessoais e corporativas'\n2. Plataforma: Single-page application (SPA)\n3. Redirect URI: <code>" + window.location.origin + window.location.pathname + "</code>",
      placeholder: "Ex: 00000000-0000-0000-0000-000000000000",
      configField: "microsoftClientId"
    }
  }[provider];

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "oauth-setup-modal";
    modal.className = "modal-backdrop";
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 520px;">
      <div class="modal-header">
        <h2>Configurar Client ID do ${providerInfo.name}</h2>
        <button class="modal-close-btn" onclick="closeOAuthSetupModal()">&times;</button>
      </div>
      
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.85rem; line-height: 1.5;">
        Para que o <strong>${providerInfo.name}</strong> autorize o login diretamente no seu domínio (<code>${window.location.origin}</code>), você precisa informar o <strong>Client ID</strong> do seu aplicativo:
      </p>

      <div class="info-card" style="padding: 0.85rem 1rem; margin-bottom: 1rem; font-size: 0.84rem; background: rgba(0,0,0,0.3);">
        <p style="margin-bottom: 0.4rem; color: #7dd3fc; font-weight: 600;">Como obter seu Client ID gratuito em 2 minutos:</p>
        <div style="color: var(--text-secondary); white-space: pre-line; line-height: 1.5; font-size: 0.82rem;">
          ${providerInfo.docStep}
        </div>
        <div style="margin-top: 0.6rem;">
          <a href="${providerInfo.portal}" target="_blank" class="btn btn-secondary btn-sm" style="font-size: 0.8rem; display: inline-flex;">
            Abrir ${providerInfo.portalName} ↗
          </a>
        </div>
      </div>

      <form onsubmit="saveProviderKey(event, '${provider}', '${providerInfo.configField}')">
        <div class="form-group labeled-input">
          <label for="setup-client-id">Cole aqui o Client ID gerado:</label>
          <input type="text" id="setup-client-id" placeholder="${providerInfo.placeholder}" required autofocus />
        </div>

        <div class="btn-group" style="margin-top: 1rem;">
          <button type="submit" class="btn btn-primary btn-block">Salvar e Conectar com ${providerInfo.name}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "flex";
}

function closeOAuthSetupModal() {
  const modal = document.querySelector("#oauth-setup-modal");
  if (modal) modal.style.display = "none";
}

function saveProviderKey(e, provider, configField) {
  e.preventDefault();
  const val = document.querySelector("#setup-client-id").value.trim();
  if (!val) return;

  const update = {};
  update[configField] = val;
  window.authManager.saveOAuthConfig(update);

  closeOAuthSetupModal();
  // Redireciona imediatamente com a nova chave válida
  initiateDirectOAuth(provider);
}

// Modal Geral de Configurações de Chaves
function openOAuthSettingsModal() {
  closeLoginModal();
  let modal = document.querySelector("#oauth-settings-modal");
  const config = window.authManager.config;

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "oauth-settings-modal";
    modal.className = "modal-backdrop";
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 540px;">
      <div class="modal-header">
        <h2>Chaves de Aplicativos OAuth</h2>
        <button class="modal-close-btn" onclick="closeOAuthSettingsModal()">&times;</button>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.86rem; margin-bottom: 1rem;">
        Cadastre os Client IDs dos seus aplicativos autorizados para o domínio <code>${window.location.origin}</code>:
      </p>

      <form onsubmit="saveAllOAuthKeys(event)">
        <div class="form-group labeled-input">
          <label for="cfg-google-id">Google Client ID</label>
          <input type="text" id="cfg-google-id" value="${escapeHtml(config.googleClientId || '')}" placeholder="xxxx.apps.googleusercontent.com" />
        </div>

        <div class="form-group labeled-input">
          <label for="cfg-github-id">GitHub Client ID</label>
          <input type="text" id="cfg-github-id" value="${escapeHtml(config.githubClientId || '')}" placeholder="Iv1.xxxx" />
        </div>

        <div class="form-group labeled-input">
          <label for="cfg-ms-id">Microsoft / Azure Application (client) ID</label>
          <input type="text" id="cfg-ms-id" value="${escapeHtml(config.microsoftClientId || '')}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>

        <div class="btn-group" style="margin-top: 1.25rem;">
          <button type="submit" class="btn btn-primary btn-block">Salvar Chaves</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.style.display = "flex";
}

function closeOAuthSettingsModal() {
  const modal = document.querySelector("#oauth-settings-modal");
  if (modal) modal.style.display = "none";
}

function saveAllOAuthKeys(e) {
  e.preventDefault();
  const googleId = document.querySelector("#cfg-google-id").value.trim();
  const githubId = document.querySelector("#cfg-github-id").value.trim();
  const msId = document.querySelector("#cfg-ms-id").value.trim();

  window.authManager.saveOAuthConfig({
    googleClientId: googleId,
    githubClientId: githubId,
    microsoftClientId: msId
  });

  closeOAuthSettingsModal();
  alert("Chaves OAuth salvas com sucesso!");
}

function getRelativePathTo(target) {
  const depth = window.location.pathname.includes("/criar") || window.location.pathname.includes("/descriptografar") || window.location.pathname.includes("/favoritos-ocultos") || window.location.pathname.includes("/forca-bruta") || window.location.pathname.includes("/painel") ? "../" : "./";
  return depth + target;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  renderAuthHeader();
});
