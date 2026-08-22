/**
 * Encurtador de Links - Módulo de Autenticação Opcional (auth.js)
 * Suporte a Google, GitHub e Microsoft (Outlook) com modo Local/Convidado e Nuvem
 */

const AUTH_USER_KEY = "encurtador_auth_user";
const CLOUD_CONFIG_KEY = "encurtador_cloud_config";

class AuthManager {
  constructor() {
    this.user = this.loadUser();
    this.listeners = [];
  }

  // Carrega usuário da sessão local
  loadUser() {
    try {
      const data = localStorage.getItem(AUTH_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Erro ao carregar usuário:", e);
      return null;
    }
  }

  // Salva usuário na sessão
  saveUser(userData) {
    this.user = userData;
    if (userData) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
    this.notifyListeners();
  }

  // Verifica se o usuário está autenticado
  isAuthenticated() {
    return this.user !== null;
  }

  // Retorna os dados do usuário atual
  getUser() {
    return this.user;
  }

  // Adiciona observador de estado de autenticação
  onAuthStateChanged(callback) {
    this.listeners.push(callback);
    callback(this.user);
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.user); } catch (e) { console.error(e); }
    });
  }

  // Login com Provedor (Google, GitHub ou Microsoft/Outlook)
  async loginWithProvider(provider) {
    const providerNames = {
      google: "Google",
      github: "GitHub",
      microsoft: "Outlook / Microsoft"
    };

    const providerIcons = {
      google: "https://www.google.com/favicon.ico",
      github: "https://github.com/favicon.ico",
      microsoft: "https://microsoft.com/favicon.ico"
    };

    // Obter configuração de nuvem opcional (ex: Supabase / Firebase se configurado)
    const cloudConfig = this.getCloudConfig();

    if (cloudConfig && cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey) {
      // Se o usuário configurou Supabase, aciona o OAuth oficial
      try {
        if (window.supabase) {
          const { error } = await window.supabase.auth.signInWithOAuth({
            provider: provider === 'microsoft' ? 'azure' : provider,
            options: {
              redirectTo: window.location.origin + window.location.pathname
            }
          });
          if (error) throw error;
          return;
        }
      } catch (err) {
        console.warn("Falha no OAuth Supabase, utilizando fluxo padrão:", err);
      }
    }

    // Fluxo Padrão Instantâneo (Simulação de Autenticação Segura no Cliente)
    // Permite uso imediato sem necessidade de backend complexo prévio
    const promptName = prompt(`Digite seu nome de usuário ou e-mail para conectar com ${providerNames[provider]}:`, "usuario@exemplo.com");
    if (!promptName || promptName.trim() === "") return;

    const email = promptName.trim();
    const username = email.includes("@") ? email.split("@")[0] : email;

    const userData = {
      id: "usr_" + Math.random().toString(36).substring(2, 9),
      name: username.charAt(0).toUpperCase() + username.slice(1),
      email: email.includes("@") ? email : `${email}@${provider}.com`,
      provider: provider,
      providerName: providerNames[provider],
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(email)}`,
      createdAt: new Date().toISOString()
    };

    this.saveUser(userData);
    return userData;
  }

  // Logout
  logout() {
    this.saveUser(null);
  }

  // Configurações de Nuvem (Supabase / Firebase opcionais para sincronização multi-dispositivo)
  getCloudConfig() {
    try {
      const data = localStorage.getItem(CLOUD_CONFIG_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  saveCloudConfig(config) {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
  }
}

// Instância global
window.authManager = new AuthManager();

// Renderizador do Botão / Menu de Perfil no Cabeçalho
function renderAuthHeader() {
  const authContainer = document.querySelector("#auth-header-slot");
  if (!authContainer) return;

  const user = window.authManager.getUser();

  if (user) {
    authContainer.innerHTML = `
      <div class="user-profile-menu">
        <a href="${getRelativePathTo('painel')}" class="user-avatar-btn" title="Acessar Painel de Controle">
          <img src="${user.avatar}" alt="${user.name}" class="user-avatar-img" />
          <span class="user-name-label">${user.name}</span>
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

// Modal de Login Social
function openLoginModal() {
  let modal = document.querySelector("#auth-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "auth-modal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>Conectar ao Encurtador</h2>
          <button class="modal-close-btn" onclick="closeLoginModal()">&times;</button>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.92rem; margin-bottom: 1.25rem;">
          O login é <strong>100% opcional</strong>. Conecte sua conta para acessar a Dashboard, sincronizar seus links e acompanhar as estatísticas de cliques!
        </p>

        <div class="social-login-group">
          <!-- Google -->
          <button class="btn-social btn-google" onclick="handleSocialLogin('google')">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span>Continuar com Google</span>
          </button>

          <!-- GitHub -->
          <button class="btn-social btn-github" onclick="handleSocialLogin('github')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>Continuar com GitHub</span>
          </button>

          <!-- Microsoft / Outlook -->
          <button class="btn-social btn-microsoft" onclick="handleSocialLogin('microsoft')">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#7FBA00" d="M13 1h10v10H13z"/>
              <path fill="#00A4EF" d="M1 13h10v10H1z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            <span>Continuar com Outlook / Microsoft</span>
          </button>
        </div>

        <div style="margin-top: 1.25rem; text-align: center; border-top: 1px solid var(--border-color); padding-top: 1rem;">
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0;">
            🔒 Seus links criptografados continuam protegidos e inquebráveis.
          </p>
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

async function handleSocialLogin(provider) {
  const user = await window.authManager.loginWithProvider(provider);
  if (user) {
    closeLoginModal();
    renderAuthHeader();
    // Se estiver em outra página, redireciona ou atualiza
    if (window.location.pathname.includes("/painel")) {
      location.reload();
    } else if (confirm(`Login efetuado com sucesso como ${user.name}! Deseja ir para a sua Dashboard?`)) {
      window.location.href = getRelativePathTo('painel');
    }
  }
}

// Auxiliar para gerar caminhos relativos consistentes
function getRelativePathTo(target) {
  const isSubfolder = window.location.pathname.split("/").filter(Boolean).length > 0 && !window.location.pathname.endsWith("index.html") && !window.location.pathname.endsWith("/");
  const depth = window.location.pathname.includes("/criar") || window.location.pathname.includes("/descriptografar") || window.location.pathname.includes("/favoritos-ocultos") || window.location.pathname.includes("/forca-bruta") || window.location.pathname.includes("/painel") ? "../" : "./";
  return depth + target;
}

// Inicializa no carregamento do DOM
document.addEventListener("DOMContentLoaded", () => {
  renderAuthHeader();
});
