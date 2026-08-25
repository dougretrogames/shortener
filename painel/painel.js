/**
 * Shortener - Lógica do Painel de Controle e Administração (painel.js)
 * Gerenciamento de links, métricas, edição, exclusão em lote e visão de usuários
 */

let myLinks = [];
let thirdPartyLinks = [];
let allSystemLinks = [];
let allLinks = [];
let filteredLinks = [];
let uniqueUsersList = [];
let currentTab = "my-links"; // "my-links" | "admin-all" | "admin-users"
let selectedSlugs = new Set();

window.myLinks = myLinks;
window.thirdPartyLinks = thirdPartyLinks;
window.allSystemLinks = allSystemLinks;
window.allLinks = allLinks;
window.filteredLinks = filteredLinks;
window.selectedSlugs = selectedSlugs;

// Verifica se o usuário conectado é o Administrador da plataforma via GitHub
function isAdminUser(user) {
  if (!user) return false;
  const username = String(user.username || user.name || "").toLowerCase().replace(/^@/, '');
  const provider = String(user.provider || "").toLowerCase();
  const targetAdmin = typeof getAppAdminUsername === "function" ? getAppAdminUsername() : "dougretrogames";
  return provider === "github" && username === targetAdmin;
}

function initDashboard() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const isHandlingOAuth = hash.includes("access_token=") || search.includes("code=") || hash.includes("code=");

  const isAuth = window.authManager && window.authManager.isAuthenticated();
  const restrictedCard = document.querySelector("#access-restricted-card");
  const dashboardContent = document.querySelector("#dashboard-content");

  // Se estiver no meio do processamento do retorno OAuth (login em andamento), não pisca o cartão de acesso restrito
  if (isHandlingOAuth && !isAuth) {
    if (restrictedCard) restrictedCard.style.display = "none";
    if (dashboardContent) dashboardContent.style.display = "none";
    return;
  }

  if (!isAuth) {
    if (restrictedCard) restrictedCard.style.display = "block";
    if (dashboardContent) dashboardContent.style.display = "none";
    return;
  }

  if (restrictedCard) restrictedCard.style.display = "none";
  if (dashboardContent) dashboardContent.style.display = "block";

  const user = window.authManager.getUser();
  const isAdmin = isAdminUser(user);

  // Exibe abas de administrador e filtros avançados exclusivamente para @dougretrogames
  const adminTabs = document.querySelector("#admin-tabs-container");
  const userFilter = document.querySelector("#filter-user-select");
  const providerFilter = document.querySelector("#filter-provider-select");
  const thCheckbox = document.querySelector("#th-checkbox");

  if (isAdmin) {
    if (adminTabs) adminTabs.style.display = "flex";
    if (userFilter) userFilter.style.display = "inline-block";
    if (providerFilter) providerFilter.style.display = "inline-block";
    if (thCheckbox) thCheckbox.style.display = "table-cell";
  } else {
    if (adminTabs) adminTabs.style.display = "none";
    if (userFilter) userFilter.style.display = "none";
    if (providerFilter) providerFilter.style.display = "none";
    if (thCheckbox) thCheckbox.style.display = "none";
  }

  // Sincroniza configurações de 2FA salvas na nuvem antes de verificar
  if (user && user.accessToken && window.supabaseDb && typeof window.supabaseDb.syncUser2FA === "function") {
    try {
      await window.supabaseDb.syncUser2FA(user.accessToken);
    } catch (e) {}
  }

  updateSessionInfo();

  // Se o usuário for administrador e o 2FA estiver ativado mas ainda não validado nesta sessão,
  // exige o código do Microsoft Authenticator IMEDIATAMENTE ao entrar no Painel!
  if (isAdmin && window.TOTP && window.TOTP.is2FAEnabled() && !window.TOTP.isSessionVerified()) {
    open2FAChallengeModal();
    return;
  }

  loadDashboardData();
}

function updateSessionInfo() {
  const user = window.authManager.getUser();
  const sessionBadge = document.querySelector("#session-badge");
  const admin2faBadge = document.querySelector("#admin-2fa-badge");
  const dashboardTitle = document.querySelector("#dashboard-title");
  const dashboardSubtitle = document.querySelector("#dashboard-subtitle");
  const isAdmin = isAdminUser(user);

  if (user) {
    if (sessionBadge) {
      if (isAdmin) {
        sessionBadge.className = "badge badge-admin";
        sessionBadge.innerHTML = `👑 Administrador Geral (@${user.username})`;
      } else {
        sessionBadge.className = `badge provider-badge ${user.provider || 'github'}`;
        sessionBadge.innerText = `Conectado via ${user.providerName || 'GitHub'} (@${user.username || user.name})`;
      }
    }

    if (admin2faBadge) {
      if (isAdmin) {
        admin2faBadge.style.display = "inline-flex";
        const is2FA = window.TOTP && window.TOTP.is2FAEnabled();
        if (is2FA) {
          admin2faBadge.className = "twofa-badge active";
          admin2faBadge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg><span>2FA Ativo 🔒</span>`;
          admin2faBadge.title = "Verificação em Duas Etapas configurada com Microsoft Authenticator. Clique para gerenciar.";
        } else {
          admin2faBadge.className = "twofa-badge warning";
          admin2faBadge.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>Ativar 2FA (Recomendado)</span>`;
          admin2faBadge.title = "Clique para configurar a verificação em duas etapas no Microsoft Authenticator.";
        }
      } else {
        admin2faBadge.style.display = "none";
      }
    }

    const nameDisplay = user.name && user.name !== user.username ? `${user.name} (@${user.username})` : `@${user.username || user.name}`;
    if (dashboardTitle) {
      dashboardTitle.innerText = isAdmin ? `Painel do Administrador` : `Olá, ${nameDisplay}!`;
    }
    if (dashboardSubtitle) {
      dashboardSubtitle.innerText = isAdmin
        ? `Gerenciamento central de todos os links, usuários e estatísticas da plataforma.`
        : `Exibindo os links vinculados exclusivamente à sua conta @${user.username || user.name} e sincronizados na nuvem.`;
    }
  }
}

// Mapeador auxiliar de registros do Supabase
function mapRemoteRecord(remote, user) {
  const baseUrl = new URL('../', window.location.href).href;
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const enc = (remote.encrypted_data && typeof remote.encrypted_data === "object") ? remote.encrypted_data : {};
  const remoteClicks = Number(remote.clicks) || 0;
  const outputUrl = `${cleanBaseUrl}${encodeURIComponent(remote.slug)}`;
  
  const encType = enc.author_type || remote.author_type;
  const authorType = (encType === "google" || encType === "github" || encType === "visitante") 
    ? encType 
    : "visitante";
  
  let authorUsername = (enc.author_username || remote.author_username || "").toLowerCase().replace(/^@/, '');
  if (!authorUsername && authorType !== "visitante") {
    authorUsername = authorType;
  }
  
  let authorName = enc.author_name || remote.author_name || (authorUsername ? `@${authorUsername}` : "Visitante");
  if (authorUsername && !authorName.startsWith("@")) {
    authorName = `@${authorUsername}`;
  }

  const isPasswordProtected = !!(enc.e && enc.s && enc.i);

  // 1. Obtém a URL de destino real do registro em nuvem
  let targetUrl = enc.target_url || enc.t || enc.u || remote.target_url || "";

  // 2. Se não estiver no registro remoto, busca no histórico local deste navegador
  if (!targetUrl || targetUrl.startsWith("Link Protegido")) {
    try {
      const localHistory = JSON.parse(localStorage.getItem("linklock_history") || "[]");
      const localCustom = JSON.parse(localStorage.getItem("linklock_saved_custom_links") || "[]");
      const found = [...localHistory, ...localCustom].find(item => item && item.slug && item.slug.toLowerCase() === String(remote.slug).toLowerCase());
      if (found && found.targetUrl && !found.targetUrl.startsWith("Link Protegido")) {
        targetUrl = found.targetUrl;
      }
    } catch (e) {}
  }

  if (!targetUrl) {
    targetUrl = isPasswordProtected ? `Link Protegido (/${remote.slug})` : outputUrl;
  }

  return {
    slug: remote.slug,
    outputUrl: outputUrl,
    shortUrl: outputUrl,
    autonomousUrl: `${cleanBaseUrl}#/${encodeURIComponent(remote.slug)}`,
    targetUrl: targetUrl,
    hint: remote.hint || enc.h || "",
    encryptedData: enc,
    clicks: remoteClicks,
    authorType: authorType,
    authorUsername: authorUsername,
    authorName: authorName,
    authorId: remote.author_id || enc.author_id || null,
    isPasswordProtected: isPasswordProtected,
    dailyClicks: (enc.daily_clicks && typeof enc.daily_clicks === "object") ? enc.daily_clicks : {},
    expiresAt: remote.expires_at || enc.expires_at || null,
    createdAt: remote.created_at || new Date().toISOString()
  };
}

// Verifica se o usuário autenticado é o criador legítimo do link
function isLinkOwner(link, user) {
  if (!link || !user) return false;

  const currentProvider = String(user.provider || "github").toLowerCase();
  const currentUsername = String(user.username || user.name || "").toLowerCase().replace(/^@/, '');
  const currentId = user.id || `${currentProvider}_${currentUsername}`;

  const enc = (link.encryptedData && typeof link.encryptedData === "object") ? link.encryptedData : {};
  const linkAuthorType = String(link.authorType || enc.author_type || "").toLowerCase();
  const linkAuthorUsername = String(link.authorUsername || enc.author_username || "").toLowerCase().replace(/^@/, '');
  const linkAuthorId = String(link.authorId || enc.author_id || "");

  // 1. Verificação direta pelo ID único da conta
  if (currentId && linkAuthorId && currentId === linkAuthorId) {
    return true;
  }

  // 2. Verificação pelo username e provedor
  if (currentUsername && linkAuthorUsername && currentUsername === linkAuthorUsername) {
    if (!linkAuthorType || linkAuthorType === currentProvider) {
      return true;
    }
  }

  return false;
}

async function loadDashboardData() {
  const user = window.authManager ? window.authManager.getUser() : null;
  const userIdentifier = user ? (user.username || user.name || user.id) : null;
  const tbody = document.querySelector("#dashboard-tbody");
  const noLinksMsg = document.querySelector("#no-links-msg");
  const isAdmin = isAdminUser(user);

  if (!window.supabaseDb || !userIdentifier) {
    myLinks = [];
    allSystemLinks = [];
    allLinks = [];
    renderStats();
    filterLinks();
    return;
  }

  // Estado de carregamento
  if (tbody && allLinks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${isAdmin ? '8' : '7'}" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="display: inline-block; width: 26px; height: 26px; border: 2px solid rgba(56, 189, 248, 0.2); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 0.65rem;"></div>
          <p style="font-size: 0.88rem; margin: 0; color: var(--text-secondary);">Consultando dados do banco de dados na nuvem...</p>
        </td>
      </tr>
    `;
    if (noLinksMsg) noLinksMsg.style.display = "none";
  }

  try {
    // 1. Se for o administrador, carrega TODOS os links do banco e separa
    if (isAdmin) {
      const allRemote = await window.supabaseDb.getAllLinks();
      if (Array.isArray(allRemote)) {
        allSystemLinks = allRemote.map(r => mapRemoteRecord(r, user));
      } else {
        allSystemLinks = [];
      }

      // Separação estrita: Meus links vs Links de terceiros
      myLinks = allSystemLinks.filter(r => isLinkOwner(r, user));
      thirdPartyLinks = allSystemLinks.filter(r => !isLinkOwner(r, user));

      // Agrupa usuários de terceiros para filtros e cards
      buildUniqueUsersList();
      populateUserFilterDropdown();
    } else {
      // Usuário comum: carrega apenas os próprios links
      const personalRemote = await window.supabaseDb.getUserLinks(user || userIdentifier);
      if (Array.isArray(personalRemote)) {
        myLinks = personalRemote.map(r => mapRemoteRecord(r, user));
      } else {
        myLinks = [];
      }
      thirdPartyLinks = [];
      allSystemLinks = [...myLinks];
    }

    // Atualiza contadores das abas
    const myCountEl = document.querySelector("#tab-my-links-count");
    const allCountEl = document.querySelector("#tab-admin-all-count");
    const usersCountEl = document.querySelector("#tab-admin-users-count");

    if (myCountEl) myCountEl.innerText = myLinks.length;
    if (allCountEl) allCountEl.innerText = thirdPartyLinks.length;
    if (usersCountEl) usersCountEl.innerText = uniqueUsersList.length;

    // Define os links atuais da aba selecionada
    if (currentTab === "my-links") {
      allLinks = myLinks;
    } else if (currentTab === "admin-all") {
      allLinks = thirdPartyLinks;
    } else {
      allLinks = thirdPartyLinks;
    }

    window.myLinks = myLinks;
    window.thirdPartyLinks = thirdPartyLinks;
    window.allSystemLinks = allSystemLinks;
    window.allLinks = allLinks;

    renderStats();
    if (currentTab === "admin-users") {
      renderUsersGrid();
    } else {
      filterLinks();
    }

    // Sincronização em segundo plano de author_id caso necessário
    if (window.supabaseDb && typeof window.supabaseDb.syncUserLinksAuthorId === "function" && user) {
      window.supabaseDb.syncUserLinksAuthorId(user).catch(() => {});
    }
  } catch (e) {
    console.error("[Supabase] Erro ao carregar dados do banco:", e);
    myLinks = [];
    thirdPartyLinks = [];
    allSystemLinks = [];
    allLinks = [];
    renderStats();
    filterLinks();
  }
}

// Constrói a lista analítica de usuários de terceiros
function buildUniqueUsersList() {
  const usersMap = new Map();

  thirdPartyLinks.forEach(link => {
    const rawUser = link.authorUsername || "visitante";
    const cleanUser = rawUser.toLowerCase().replace(/^@/, '');
    const provider = link.authorType || "visitante";
    const key = `${provider}_${cleanUser}`;

    if (!usersMap.has(key)) {
      usersMap.set(key, {
        key: key,
        username: cleanUser,
        authorName: link.authorName || (cleanUser ? `@${cleanUser}` : "Visitante"),
        provider: provider,
        linkCount: 0,
        clickCount: 0,
        latestCreatedAt: link.createdAt
      });
    }

    const userData = usersMap.get(key);
    userData.linkCount += 1;
    userData.clickCount += (Number(link.clicks) || 0);
    if (new Date(link.createdAt) > new Date(userData.latestCreatedAt)) {
      userData.latestCreatedAt = link.createdAt;
    }
  });

  uniqueUsersList = Array.from(usersMap.values()).sort((a, b) => b.linkCount - a.linkCount);
}

// Popula o select de filtro por usuário
function populateUserFilterDropdown() {
  const select = document.querySelector("#filter-user-select");
  if (!select) return;

  const currentVal = select.value;
  let html = `<option value="all">Todos os Usuários (${uniqueUsersList.length})</option>`;

  uniqueUsersList.forEach(u => {
    const iconLabel = u.provider === "google" ? "🔴 Google" : u.provider === "github" ? "🐙 GitHub" : "👤 Visitante";
    const display = u.username ? `@${u.username}` : "Visitante";
    html += `<option value="${escapeHtml(u.username)}">${iconLabel} ${escapeHtml(display)} (${u.linkCount})</option>`;
  });

  select.innerHTML = html;
  if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

let currentSetupSecret = "";
let targetTabAfter2FA = "admin-all";

// Alternador de Abas do Dashboard
function switchDashboardTab(tab) {
  // Se for acessar abas de administrador geral e o 2FA estiver ativado mas a sessão ainda não validada, exige código
  if ((tab === "admin-all" || tab === "admin-users") && window.TOTP && window.TOTP.is2FAEnabled() && !window.TOTP.isSessionVerified()) {
    targetTabAfter2FA = tab;
    open2FAChallengeModal();
    return;
  }

  currentTab = tab;
  deselectAllLinks();

  const tabMyLinks = document.querySelector("#tab-my-links");
  const tabAdminAll = document.querySelector("#tab-admin-all");
  const tabAdminUsers = document.querySelector("#tab-admin-users");

  const tableViewSection = document.querySelector("#table-view-section");
  const usersViewSection = document.querySelector("#users-view-section");
  const thCheckbox = document.querySelector("#th-checkbox");
  const statLabelLinks = document.querySelector("#stat-label-links");

  if (tabMyLinks) tabMyLinks.className = tab === "my-links" ? "admin-tab-btn active" : "admin-tab-btn";
  if (tabAdminAll) tabAdminAll.className = tab === "admin-all" ? "admin-tab-btn active" : "admin-tab-btn";
  if (tabAdminUsers) tabAdminUsers.className = tab === "admin-users" ? "admin-tab-btn active" : "admin-tab-btn";

  if (tab === "my-links") {
    allLinks = myLinks;
    if (statLabelLinks) statLabelLinks.innerText = "Meus Links";
    if (tableViewSection) tableViewSection.style.display = "block";
    if (usersViewSection) usersViewSection.style.display = "none";
    if (thCheckbox) thCheckbox.style.display = "table-cell";
    renderStats();
    filterLinks();
  } else if (tab === "admin-all") {
    allLinks = thirdPartyLinks;
    if (statLabelLinks) statLabelLinks.innerText = "Links de Terceiros";
    if (tableViewSection) tableViewSection.style.display = "block";
    if (usersViewSection) usersViewSection.style.display = "none";
    if (thCheckbox) thCheckbox.style.display = "table-cell";
    renderStats();
    filterLinks();
  } else if (tab === "admin-users") {
    allLinks = thirdPartyLinks;
    if (tableViewSection) tableViewSection.style.display = "none";
    if (usersViewSection) usersViewSection.style.display = "block";
    renderStats();
    renderUsersGrid();
  }
}

function renderStats() {
  const totalLinks = allLinks.length;
  let totalClicks = 0;
  let topLink = null;
  let maxClicks = -1;

  allLinks.forEach(link => {
    const clicks = link.clicks || 0;
    totalClicks += clicks;
    if (clicks > maxClicks && clicks > 0) {
      maxClicks = clicks;
      topLink = link;
    }
  });

  const avgClicks = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : "0.0";

  const statLinksEl = document.querySelector("#stat-total-links");
  const statClicksEl = document.querySelector("#stat-total-clicks");
  const statTopSlugEl = document.querySelector("#stat-top-slug");
  const statAvgClicksEl = document.querySelector("#stat-avg-clicks");

  if (statLinksEl) statLinksEl.innerText = totalLinks;
  if (statClicksEl) statClicksEl.innerText = totalClicks;
  if (statTopSlugEl) statTopSlugEl.innerText = topLink ? (topLink.slug || "Sem apelido") : "-";
  if (statAvgClicksEl) statAvgClicksEl.innerText = avgClicks;
}

function filterLinks() {
  const query = (document.querySelector("#search-input") ? document.querySelector("#search-input").value : "").trim().toLowerCase();
  const userFilter = document.querySelector("#filter-user-select") ? document.querySelector("#filter-user-select").value : "all";
  const providerFilter = document.querySelector("#filter-provider-select") ? document.querySelector("#filter-provider-select").value : "all";
  const sortMode = document.querySelector("#sort-select") ? document.querySelector("#sort-select").value : "date-desc";

  filteredLinks = allLinks.filter(link => {
    const slug = (link.slug || "").toLowerCase();
    const target = (link.targetUrl || "").toLowerCase();
    const hint = (link.hint || "").toLowerCase();
    const authorUser = (link.authorUsername || "").toLowerCase();
    const authorName = (link.authorName || "").toLowerCase();
    const authorType = (link.authorType || "").toLowerCase();

    // Filtro textual
    const matchesQuery = !query || slug.includes(query) || target.includes(query) || hint.includes(query) || authorUser.includes(query) || authorName.includes(query);
    if (!matchesQuery) return false;

    // Filtro por usuário específico
    if (userFilter !== "all" && authorUser !== userFilter.toLowerCase()) {
      return false;
    }

    // Filtro por provedor
    if (providerFilter !== "all" && authorType !== providerFilter.toLowerCase()) {
      return false;
    }

    return true;
  });

  // Ordenação
  filteredLinks.sort((a, b) => {
    if (sortMode === "date-desc") {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    } else if (sortMode === "date-asc") {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    } else if (sortMode === "clicks-desc") {
      return (b.clicks || 0) - (a.clicks || 0);
    } else if (sortMode === "clicks-asc") {
      return (a.clicks || 0) - (b.clicks || 0);
    } else if (sortMode === "name-asc") {
      return (a.slug || "").localeCompare(b.slug || "");
    } else if (sortMode === "user-asc") {
      return (a.authorUsername || "").localeCompare(b.authorUsername || "");
    }
    return 0;
  });

  renderLinksTable();
}

function getGoogleIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" style="vertical-align: -2px; margin-right: 4px; display: inline-block;">
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24Z"/>
    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"/>
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"/>
  </svg>`;
}

function getGithubIconSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: -2px; margin-right: 4px; display: inline-block;">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>`;
}

function renderLinksTable() {
  const tbody = document.querySelector("#dashboard-tbody");
  const noLinksMsg = document.querySelector("#no-links-msg");
  const noLinksText = document.querySelector("#no-links-text");
  const user = window.authManager ? window.authManager.getUser() : null;
  const isAdmin = isAdminUser(user);

  if (!filteredLinks || filteredLinks.length === 0) {
    tbody.innerHTML = "";
    if (noLinksMsg) noLinksMsg.style.display = "block";
    if (noLinksText) {
      noLinksText.innerText = currentTab === "admin-all" 
        ? "Nenhum link encontrado com os filtros selecionados."
        : "Nenhum link encontrado no seu painel.";
    }
    return;
  }

  if (noLinksMsg) noLinksMsg.style.display = "none";
  let html = "";

  filteredLinks.forEach(link => {
    const slug = link.slug || "sem-apelido";
    const targetUrl = link.targetUrl || link.outputUrl || "";
    const clicks = link.clicks || 0;
    const authorType = link.authorType || "visitante";
    const isGoogle = authorType === "google";
    const isGithub = authorType === "github";
    const cleanUser = link.authorUsername || (isGoogle ? "google" : isGithub ? "github" : "visitante");
    const authorDisplay = `@${cleanUser}`;
    const dateFormatted = link.createdAt ? new Date(link.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recente";
    const isChecked = selectedSlugs.has(slug);
    const canEdit = isLinkOwner(link, user);
    const sparklineSvg = generateSparklineSvg(link.dailyClicks, clicks, 7, link);

    html += `
      <tr style="${isChecked ? 'background: rgba(56, 189, 248, 0.08);' : ''}">
        <td class="table-checkbox-cell" style="${isAdmin ? '' : 'display: none;'}">
          <input type="checkbox" class="table-checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSelectLink('${escapeHtml(slug)}', this.checked)" />
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-primary);"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <strong style="color: var(--accent-primary); font-family: 'JetBrains Mono', monospace; cursor: pointer;" onclick="openLinkAnalyticsModal(decodeURIComponent('${encodeURIComponent(slug)}'))" title="Clique para ver gráficos de cliques detalhados">${escapeHtml(slug)}</strong>
            </div>
            ${link.hint ? `<small style="color: #a5b4fc; font-size: 0.78rem;">Dica: ${escapeHtml(link.hint)}</small>` : ''}
          </div>
        </td>
        <td>
          <span style="max-width: 220px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; color: var(--text-secondary);" title="${escapeHtml(targetUrl)}">
            ${escapeHtml(targetUrl)}
          </span>
        </td>
        <td>
          <div class="clicks-cell-wrapper" onclick="openLinkAnalyticsModal(decodeURIComponent('${encodeURIComponent(slug)}'))" title="Clique para ver gráficos detalhados (diário e mensal de cada mês)">
            <span class="clicks-badge" title="${clicks} cliques contabilizados">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              ${clicks}
            </span>
            <div class="sparkline-container" title="Tendência dos últimos 7 dias">
              ${sparklineSvg}
            </div>
          </div>
        </td>
        <td>
          ${link.isPasswordProtected ? `
            <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.75rem; padding: 0.2rem 0.45rem;">
              🔒 Protegido
            </span>
          ` : `
            <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.25); font-size: 0.75rem; padding: 0.2rem 0.45rem;">
              🌐 Aberto
            </span>
          `}
        </td>
        <td>
          ${isGoogle ? `
            <button type="button" onclick="filterByUser('${escapeHtml(cleanUser)}')" class="badge" style="background: rgba(66, 133, 244, 0.12); color: #93c5fd; border: 1px solid rgba(66, 133, 244, 0.3); font-size: 0.75rem; padding: 0.25rem 0.55rem; display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 600; cursor: pointer;" title="Filtrar links deste usuário Google">
              ${getGoogleIconSvg()}
              <span>${escapeHtml(authorDisplay)}</span>
            </button>
          ` : isGithub ? `
            <button type="button" onclick="filterByUser('${escapeHtml(cleanUser)}')" class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); font-size: 0.75rem; padding: 0.25rem 0.55rem; display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 600; cursor: pointer;" title="Filtrar links deste usuário GitHub">
              ${getGithubIconSvg()}
              <span>${escapeHtml(authorDisplay)}</span>
            </button>
          ` : `
            <span class="badge" style="background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); font-size: 0.75rem; padding: 0.25rem 0.55rem; display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Visitante
            </span>
          `}
        </td>
        <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
          <div>${dateFormatted}</div>
          ${link.expiresAt ? `
            <div style="margin-top: 0.2rem;">
              ${new Date(link.expiresAt).getTime() < Date.now() ? `
                <span class="badge badge-danger" style="font-size: 0.68rem; padding: 0.1rem 0.35rem; background: rgba(239, 68, 68, 0.15); color: #f87171;">⚠️ Expirado</span>
              ` : `
                <span class="badge" style="font-size: 0.68rem; padding: 0.1rem 0.35rem; background: rgba(245, 158, 11, 0.15); color: #fbbf24;" title="Expira em ${new Date(link.expiresAt).toLocaleDateString('pt-BR')}">⏱️ Expira em ${new Date(link.expiresAt).toLocaleDateString('pt-BR')}</span>
              `}
            </div>
          ` : `
            <div style="margin-top: 0.2rem;">
              <span class="badge" style="font-size: 0.68rem; padding: 0.1rem 0.35rem; background: rgba(16, 185, 129, 0.12); color: #6ee7b7;">🛡️ Permanente</span>
            </div>
          `}
        </td>
        <td class="td-actions">
          <div class="table-actions" style="justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="copyLink(decodeURIComponent('${encodeURIComponent(link.outputUrl || '')}'))" title="Copiar Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <a href="${escapeHtml(link.outputUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Testar / Abrir Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
            ${canEdit ? `
              <button class="btn btn-secondary btn-sm" onclick="openEditModal(decodeURIComponent('${encodeURIComponent(slug)}'))" title="Editar Meu Link">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
            ` : ''}
            <button class="btn btn-danger btn-sm" onclick="deleteLink(decodeURIComponent('${encodeURIComponent(slug)}'))" title="Excluir Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  updateBatchBar();
}

// Renderiza a seção de usuários registrados
function renderUsersGrid() {
  const container = document.querySelector("#users-grid-container");
  if (!container) return;

  if (uniqueUsersList.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 2rem; grid-column: 1 / -1;">Nenhum usuário registrado encontrado.</div>`;
    return;
  }

  let html = "";
  uniqueUsersList.forEach(u => {
    const isGoogle = u.provider === "google";
    const isGithub = u.provider === "github";
    const displayUser = u.username ? `@${u.username}` : "Visitante Anônimo";

    html += `
      <div class="user-card">
        <div class="user-card-header">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #111a2e; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
            ${isGoogle ? '🔴' : isGithub ? '🐙' : '👤'}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              ${isGoogle ? getGoogleIconSvg() : isGithub ? getGithubIconSvg() : ''}
              <strong style="color: #fff; font-size: 0.95rem;">${escapeHtml(displayUser)}</strong>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">
              ${escapeHtml(u.provider)}
            </span>
          </div>
        </div>

        <div class="user-card-stats">
          <div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--accent-primary); font-family: 'JetBrains Mono', monospace;">
              ${u.linkCount}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Links Criados</div>
          </div>
          <div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #6ee7b7; font-family: 'JetBrains Mono', monospace;">
              ${u.clickCount}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Cliques Totais</div>
          </div>
        </div>

        <button type="button" class="btn btn-secondary btn-sm" onclick="filterByUser('${escapeHtml(u.username)}')" style="width: 100%; justify-content: center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
          <span>Ver Links Deste Usuário</span>
        </button>
      </div>
    `;
  });

  container.innerHTML = html;
}

// Filtra rapidamente por um usuário específico vindo de badges ou cards
function filterByUser(username) {
  switchDashboardTab("admin-all");
  const select = document.querySelector("#filter-user-select");
  if (select) {
    select.value = username || "all";
  }
  filterLinks();
}

// Gerenciamento de Seleção e Ações em Lote
function toggleSelectLink(slug, isChecked) {
  if (isChecked) {
    selectedSlugs.add(slug);
  } else {
    selectedSlugs.delete(slug);
  }
  updateBatchBar();
}

function toggleSelectAllLinks(isChecked) {
  if (isChecked) {
    filteredLinks.forEach(l => {
      if (l.slug) selectedSlugs.add(l.slug);
    });
  } else {
    selectedSlugs.clear();
  }
  renderLinksTable();
  updateBatchBar();
}

function deselectAllLinks() {
  selectedSlugs.clear();
  const selectAllCb = document.querySelector("#select-all-checkbox");
  if (selectAllCb) selectAllCb.checked = false;
  updateBatchBar();
  renderLinksTable();
}

function updateBatchBar() {
  const batchBar = document.querySelector("#batch-actions-bar");
  const countSpan = document.querySelector("#batch-selected-count");
  const selectAllCb = document.querySelector("#select-all-checkbox");

  if (!batchBar || !countSpan) return;

  const count = selectedSlugs.size;
  if (count > 0) {
    batchBar.style.display = "flex";
    countSpan.innerText = `${count} ${count === 1 ? 'link selecionado' : 'links selecionados'}`;
    if (selectAllCb) {
      selectAllCb.checked = filteredLinks.length > 0 && filteredLinks.every(l => selectedSlugs.has(l.slug));
    }
  } else {
    batchBar.style.display = "none";
    if (selectAllCb) selectAllCb.checked = false;
  }
}

async function deleteSelectedBatchLinks() {
  const count = selectedSlugs.size;
  if (count === 0) return;

  const slugsArray = Array.from(selectedSlugs);
  const msg = `Atenção: Você está prestes a excluir <strong>${count} links permanentemente</strong> do banco de dados. Esta ação não pode ser desfeita.`;

  openDeleteModal("", async () => {
    const btn = document.querySelector("#btn-batch-delete");
    if (btn) btn.disabled = true;

    try {
      if (window.supabaseDb) {
        await window.supabaseDb.deleteLinksBatch(slugsArray);
      }

      slugsArray.forEach(s => {
        if (window.clickTracker) window.clickTracker.resetLink(s);
      });

      selectedSlugs.clear();
      showToast(`${count} links foram excluídos permanentemente com sucesso!`);
      await loadDashboardData();
    } catch (e) {
      console.error("Erro na exclusão em lote:", e);
      alert("Erro ao excluir links em lote. Tente novamente.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }, `Excluir ${count} Links em Lote`, msg);
}

// Modal de Edição de Link
function openEditModal(slug) {
  const link = allLinks.find(l => (l.slug || "").toLowerCase() === slug.toLowerCase());
  if (!link) return;

  const user = window.authManager ? window.authManager.getUser() : null;
  if (!isLinkOwner(link, user)) {
    alert("Privilégio restrito: Administradores só possuem permissão para excluir links de terceiros, não para editar URLs ou alterar senhas de outros usuários.");
    return;
  }

  document.querySelector("#edit-original-slug").value = link.slug;
  document.querySelector("#edit-slug").value = link.slug;
  const displayTargetUrl = (link.targetUrl && !link.targetUrl.startsWith("Link Protegido")) ? link.targetUrl : "";
  document.querySelector("#edit-target-url").value = displayTargetUrl;
  document.querySelector("#edit-hint").value = link.hint || "";

  const passwordInput = document.querySelector("#edit-password");
  const confirmPasswordInput = document.querySelector("#edit-password-confirm");
  const removePasswordCheckbox = document.querySelector("#edit-remove-password");
  const removePasswordGroup = document.querySelector("#edit-remove-password-group");
  const securityBadge = document.querySelector("#edit-security-badge");

  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.disabled = false;
  }
  if (confirmPasswordInput) {
    confirmPasswordInput.value = "";
    confirmPasswordInput.disabled = false;
  }

  const isEncrypted = !!(link.encryptedData && link.encryptedData.e);
  if (isEncrypted) {
    if (securityBadge) {
      securityBadge.className = "badge badge-warning";
      securityBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> Protegido por Senha`;
    }
    if (removePasswordGroup) removePasswordGroup.style.display = "flex";
    if (removePasswordCheckbox) removePasswordCheckbox.checked = false;
    if (passwordInput) passwordInput.placeholder = "Deixe em branco para manter a senha atual";
  } else {
    if (securityBadge) {
      securityBadge.className = "badge badge-info";
      securityBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Link Aberto (Sem Senha)`;
    }
    if (removePasswordGroup) removePasswordGroup.style.display = "none";
    if (removePasswordCheckbox) removePasswordCheckbox.checked = false;
    if (passwordInput) passwordInput.placeholder = "Digite uma senha para proteger este link...";
  }

  const statusEl = document.querySelector("#edit-slug-status");
  if (statusEl) statusEl.style.display = "none";

  const saveBtn = document.querySelector("#save-edit-btn");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      <span>Salvar Alterações</span>
    `;
  }

  document.querySelector("#edit-modal").style.display = "flex";
}

function closeEditModal() {
  const modal = document.querySelector("#edit-modal");
  if (modal) modal.style.display = "none";
  const saveBtn = document.querySelector("#save-edit-btn");
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
        <polyline points="17 21 17 13 7 13 7 21"></polyline>
        <polyline points="7 3 7 8 15 8"></polyline>
      </svg>
      <span>Salvar Alterações</span>
    `;
  }
}

function toggleRemovePasswordState() {
  const removePasswordCheckbox = document.querySelector("#edit-remove-password");
  const passwordInput = document.querySelector("#edit-password");
  const confirmPasswordInput = document.querySelector("#edit-password-confirm");

  if (!removePasswordCheckbox || !passwordInput || !confirmPasswordInput) return;

  if (removePasswordCheckbox.checked) {
    passwordInput.value = "";
    confirmPasswordInput.value = "";
    passwordInput.disabled = true;
    confirmPasswordInput.disabled = true;
  } else {
    passwordInput.disabled = false;
    confirmPasswordInput.disabled = false;
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
  } else {
    input.type = 'password';
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  }
}

let editSlugDebounceTimer = null;

// Aciona verificação 1 segundo após o usuário parar de digitar a palavra completa
function handleEditSlugInputDebounced() {
  const originalSlug = document.querySelector("#edit-original-slug") ? document.querySelector("#edit-original-slug").value.trim() : "";
  const rawVal = document.querySelector("#edit-slug") ? document.querySelector("#edit-slug").value.trim() : "";
  const statusEl = document.querySelector("#edit-slug-status");
  if (!statusEl) return;

  if (editSlugDebounceTimer) {
    clearTimeout(editSlugDebounceTimer);
  }

  if (!rawVal || rawVal.toLowerCase() === originalSlug.toLowerCase()) {
    statusEl.style.display = "none";
    statusEl.innerHTML = "";
    return;
  }

  // Mantém oculto enquanto o usuário digita
  statusEl.style.display = "none";
  statusEl.innerHTML = "";

  editSlugDebounceTimer = setTimeout(() => {
    checkEditSlugAvailability();
  }, 1000);
}

async function checkEditSlugAvailability() {
  const originalSlug = document.querySelector("#edit-original-slug").value.trim();
  const rawVal = document.querySelector("#edit-slug").value.trim();
  const statusEl = document.querySelector("#edit-slug-status");
  if (!statusEl) return;

  if (!rawVal || rawVal.toLowerCase() === originalSlug.toLowerCase()) {
    statusEl.style.display = "none";
    statusEl.innerHTML = "";
    return;
  }

  const newSlug = rawVal
    .replace(/[\s_]+/g, "-")
    .replace(/[@#?&/\\:]+/g, "");

  // 1. Se o novo slug for idêntico ao original (ignorando maiúsculas/minúsculas), está disponível (é o mesmo link!)
  if (newSlug.toLowerCase() === originalSlug.toLowerCase()) {
    statusEl.style.display = "flex";
    statusEl.className = "slug-status available";
    statusEl.style.color = "";
    statusEl.style.border = "";
    statusEl.style.background = "";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Apelido atual do link mantido!</span>
    `;
    return;
  }

  // 2. Verificação de profanidade
  if (window.profanityFilter && window.profanityFilter.isProfane(newSlug)) {
    statusEl.style.display = "flex";
    statusEl.className = "slug-status exists";
    statusEl.style.color = "";
    statusEl.style.border = "";
    statusEl.style.background = "";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>O apelido <strong>"${escapeHtml(newSlug)}"</strong> contém termos impróprios ou palavras de baixo calão não permitidas.</span>
    `;
    return;
  }

  // 3. Consulta no cache local de links carregados
  const existsLocal = allLinks.some(l => l.slug && l.slug.toLowerCase() === newSlug.toLowerCase() && l.slug.toLowerCase() !== originalSlug.toLowerCase());

  // 4. Consulta global em tempo real no Supabase
  let existsRemote = false;
  if (window.supabaseDb) {
    try {
      existsRemote = await window.supabaseDb.exists(newSlug);
    } catch {}
  }

  statusEl.style.display = "flex";
  statusEl.style.color = "";
  statusEl.style.border = "";
  statusEl.style.background = "";
  if (existsLocal || existsRemote) {
    statusEl.className = "slug-status exists";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>O apelido <strong>"${escapeHtml(newSlug)}"</strong> já está em uso por outro link cadastrado.</span>
    `;
  } else {
    statusEl.className = "slug-status available";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Apelido <strong>"${escapeHtml(newSlug)}"</strong> disponível para uso!</span>
    `;
  }
}

async function saveEditedLink(e) {
  e.preventDefault();
  const originalSlug = document.querySelector("#edit-original-slug").value.trim();
  const rawSlug = document.querySelector("#edit-slug").value.trim();
  const newTargetUrl = document.querySelector("#edit-target-url").value.trim();
  const newHint = document.querySelector("#edit-hint").value.trim();
  const newPassword = document.querySelector("#edit-password") ? document.querySelector("#edit-password").value : "";
  const confirmPassword = document.querySelector("#edit-password-confirm") ? document.querySelector("#edit-password-confirm").value : "";
  const removePassword = document.querySelector("#edit-remove-password") ? document.querySelector("#edit-remove-password").checked : false;
  const saveBtn = document.querySelector("#save-edit-btn");

  const newSlug = rawSlug
    .replace(/[\s_]+/g, "-")
    .replace(/[@#?&/\\:]+/g, "");

  if (!newSlug) {
    alert("Por favor, informe um apelido válido para o link.");
    return;
  }

  if (window.profanityFilter && window.profanityFilter.isProfane(newSlug)) {
    alert("O apelido personalizado contém termos impróprios ou palavras de baixo calão não permitidas.");
    return;
  }

  // Se o slug mudou, verifica se já existe outro link com esse novo nome
  if (newSlug.toLowerCase() !== originalSlug.toLowerCase()) {
    if (window.supabaseDb) {
      const exists = await window.supabaseDb.exists(newSlug);
      if (exists) {
        alert(`O apelido "/${newSlug}" já está em uso por outro link no sistema. Escolha outro nome.`);
        return;
      }
    }
  }

  try {
    const parsed = new URL(newTargetUrl);
    if (!(parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "magnet:")) {
      alert("A URL de destino deve começar com http://, https:// ou magnet:");
      return;
    }
  } catch {
    alert("Por favor, insira uma URL válida.");
    return;
  }

  if (newPassword && newPassword !== confirmPassword) {
    alert("As senhas digitadas não coincidem. Verifique e tente novamente.");
    const confirmInput = document.querySelector("#edit-password-confirm");
    if (confirmInput) confirmInput.focus();
    return;
  }

  const link = allLinks.find(l => (l.slug || "").toLowerCase() === originalSlug.toLowerCase());
  if (!link) return;

  const user = window.authManager ? window.authManager.getUser() : null;
  if (!isLinkOwner(link, user)) {
    alert("Operação não permitida: Você só possui permissão para excluir links de outros usuários, não para editá-los ou alterar suas senhas.");
    return;
  }

  const originalBtnHtml = saveBtn ? saveBtn.innerHTML : "";
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
      <div style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span>Salvando no banco de dados...</span>
    `;
  }

  try {
    let enc = null;

    if (newPassword) {
      const api = apiVersions['0.0.1'];
      const salt = await api.randomSalt();
      const iv = await api.randomIv();
      const encryptedBuffer = await api.encrypt(newTargetUrl, newPassword, salt, iv);

      enc = {
        v: "0.0.1",
        e: b64.binaryToBase64(new Uint8Array(encryptedBuffer)),
        s: b64.binaryToBase64(salt),
        i: b64.binaryToBase64(iv),
        target_url: newTargetUrl,
        t: newTargetUrl
      };
      if (newHint) enc.h = newHint;
    } else if (removePassword) {
      enc = {
        v: "0.0.1",
        open: true,
        u: newTargetUrl,
        target_url: newTargetUrl,
        t: newTargetUrl
      };
      if (newHint) enc.h = newHint;
    } else {
      const hadPassword = !!(link.encryptedData && link.encryptedData.e);
      if (hadPassword) {
        enc = typeof link.encryptedData === "object" ? { ...link.encryptedData } : {};
        enc.target_url = newTargetUrl;
        enc.t = newTargetUrl;
        if (newHint) enc.h = newHint;
        else delete enc.h;
      } else {
        enc = {
          v: "0.0.1",
          open: true,
          u: newTargetUrl,
          target_url: newTargetUrl,
          t: newTargetUrl
        };
        if (newHint) enc.h = newHint;
      }
    }

    if (link.authorType) enc.author_type = link.authorType;
    if (link.authorUsername) enc.author_username = link.authorUsername;
    if (link.authorName) enc.author_name = link.authorName;

    if (window.supabaseDb) {
      await window.supabaseDb.updateLink(originalSlug, {
        newSlug: newSlug,
        encryptedData: enc,
        hint: newHint,
        targetUrl: newTargetUrl
      });
    }

    // Sincroniza o histórico do armazenamento local (LocalStorage)
    updateLocalHistoryLink(originalSlug, {
      slug: newSlug,
      targetUrl: newTargetUrl,
      hint: newHint,
      outputUrl: link.outputUrl
    });

    closeEditModal();
    showToast("Link atualizado no banco de dados com sucesso!");
    await loadDashboardData();
  } catch (err) {
    console.error("[Painel] Erro ao salvar edição do link:", err);
    alert("Erro ao salvar alterações no banco de dados. Tente novamente.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        <span>Salvar Alterações</span>
      `;
    }
  }
}

// Sincroniza e atualiza os links correspondentes dentro do LocalStorage
function updateLocalHistoryLink(oldSlug, newLinkData) {
  try {
    const keys = ["linklock_history", "linklock_saved_custom_links"];
    keys.forEach(key => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let list = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      let changed = false;
      list = list.map(item => {
        if (item && item.slug && item.slug.toLowerCase() === oldSlug.toLowerCase()) {
          changed = true;
          return {
            ...item,
            slug: newLinkData.slug || item.slug,
            targetUrl: newLinkData.targetUrl || item.targetUrl,
            hint: newLinkData.hint !== undefined ? newLinkData.hint : item.hint,
            outputUrl: newLinkData.outputUrl || item.outputUrl
          };
        }
        return item;
      });
      if (changed) {
        localStorage.setItem(key, JSON.stringify(list));
      }
    });
  } catch (e) {
    console.warn("Erro ao atualizar histórico local:", e);
  }
}

// Ações de Links
function copyLink(url) {
  if (!url) return;
  navigator.clipboard.writeText(url).then(() => {
    showToast("Link copiado para a área de transferência!");
  }).catch(() => {
    const input = document.createElement("input");
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    showToast("Link copiado com sucesso!");
  });
}

function openDeleteModal(slug, onConfirm, customTitle, customMsg) {
  let modal = document.querySelector("#confirm-delete-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "confirm-delete-modal";
    modal.className = "modal-backdrop";
    document.body.appendChild(modal);
  }

  const title = customTitle || "Confirmar Exclusão Permanente";
  const targetText = slug ? `/${slug}` : (selectedSlugs.size > 0 ? `${selectedSlugs.size} links selecionados` : "Link selecionado");
  const msg = customMsg || `Atenção: Este link será <strong>excluído permanentemente</strong> do banco de dados e <strong>não poderá ser recuperado</strong>.`;

  modal.innerHTML = `
    <div class="modal-card" style="max-width: 450px; text-align: center; padding: 2rem 1.75rem;">
      <div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #ef4444;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      </div>

      <div style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.25rem 0.65rem; border-radius: var(--radius-full); background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
        ⚠️ Ação Permanente e Irreversível
      </div>

      <h2 style="font-size: 1.3rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem;">${escapeHtml(title)}</h2>
      
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1rem; word-break: break-all; font-family: monospace; font-size: 0.95rem; color: #38bdf8; font-weight: 600;">
        ${escapeHtml(targetText)}
      </div>

      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.55;">
        ${msg}
      </p>

      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button type="button" class="btn btn-secondary" onclick="closeDeleteModal()" style="flex: 1; padding: 0.75rem 1rem;">
          Cancelar
        </button>
        <button type="button" id="confirm-delete-action-btn" class="btn btn-danger" style="flex: 1.2; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: center; gap: 0.45rem; background: #dc2626; border: 1px solid #ef4444;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>Excluir Permanentemente</span>
        </button>
      </div>
    </div>
  `;

  modal.style.display = "flex";

  const confirmBtn = modal.querySelector("#confirm-delete-action-btn");
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      closeDeleteModal();
      if (typeof onConfirm === "function") {
        onConfirm();
      }
    };
  }
}

function closeDeleteModal() {
  const modal = document.querySelector("#confirm-delete-modal");
  if (modal) modal.style.display = "none";
}

function deleteLink(slug) {
  openDeleteModal(slug, async () => {
    try {
      if (window.supabaseDb && slug) {
        await window.supabaseDb.deleteLink(slug);
      }

      if (window.clickTracker && slug) {
        window.clickTracker.resetLink(slug);
      }

      selectedSlugs.delete(slug);
      showToast(`Link "/${slug}" excluído com sucesso.`);
      await loadDashboardData();
    } catch (e) {
      console.error("Erro ao excluir link:", e);
    }
  });
}

function sanitizeCsvValue(val) {
  let str = String(val == null ? "" : val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function exportData(format) {
  if (!allLinks || allLinks.length === 0) {
    alert("Não há links cadastrados para exportar.");
    return;
  }

  let content = "";
  let mimeType = "";
  let filename = "";

  if (format === "json") {
    content = JSON.stringify(allLinks, null, 2);
    mimeType = "application/json";
    filename = `shortener_links_backup_${new Date().toISOString().slice(0, 10)}.json`;
  } else if (format === "csv") {
    const headers = ["Apelido", "URL Destino", "Criador", "Provedor", "Cliques", "Dica", "Data Criacao", "Link Completo"];
    const rows = allLinks.map(l => [
      sanitizeCsvValue(l.slug),
      sanitizeCsvValue(l.targetUrl),
      sanitizeCsvValue(l.authorName || l.authorUsername),
      sanitizeCsvValue(l.authorType),
      Number(l.clicks) || 0,
      sanitizeCsvValue(l.hint),
      sanitizeCsvValue(l.createdAt),
      sanitizeCsvValue(l.outputUrl)
    ]);
    content = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    mimeType = "text/csv;charset=utf-8;";
    filename = `shortener_links_${new Date().toISOString().slice(0, 10)}.csv`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exportação ${format.toUpperCase()} gerada com sucesso!`);
}

function showToast(text) {
  const toast = document.querySelector("#dashboard-toast");
  const toastText = document.querySelector("#toast-text");
  if (toast && toastText) {
    const cleanText = String(text || "").replace(/^[✓✔\s]+/, '').trim();
    toastText.innerText = cleanText;
    toast.className = "alert-toast visible";
    setTimeout(() => {
      toast.className = "alert-toast";
    }, 3000);
  }
}

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==========================================
// Funções de Verificação em Duas Etapas (2FA)
// ==========================================
function handle2FABadgeClick() {
  if (window.TOTP && window.TOTP.is2FAEnabled()) {
    open2FAManageModal();
  } else {
    open2FASetupModal();
  }
}

function open2FASetupModal() {
  close2FAManageModal();
  close2FAChallengeModal();

  if (!window.TOTP) return;

  const user = window.authManager ? window.authManager.getUser() : null;
  const defaultAdmin = typeof getAppAdminUsername === "function" ? getAppAdminUsername() : "dougretrogames";
  const username = user ? (user.username || user.name || defaultAdmin) : defaultAdmin;

  currentSetupSecret = window.TOTP.getSavedSecret() || window.TOTP.generateSecret(32);
  const otpAuthUrl = window.TOTP.getOtpAuthUrl(currentSetupSecret, username);
  const qrUrl = window.TOTP.getQrCodeUrl(otpAuthUrl);

  const qrImg = document.querySelector("#twofa-setup-qr");
  const secretSpan = document.querySelector("#twofa-setup-secret");
  const pinInput = document.querySelector("#twofa-setup-pin");
  const errorDiv = document.querySelector("#twofa-setup-error");

  if (qrImg) qrImg.src = qrUrl;
  if (secretSpan) secretSpan.innerText = currentSetupSecret;
  if (pinInput) pinInput.value = "";
  if (errorDiv) {
    errorDiv.style.display = "none";
    errorDiv.innerText = "";
  }

  const modal = document.querySelector("#modal-2fa-setup");
  if (modal) {
    modal.style.display = "flex";
    const card = modal.querySelector(".modal-card");
    if (card) card.scrollTop = 0;
  }

  setTimeout(() => {
    if (pinInput) pinInput.focus();
  }, 250);
}

function close2FASetupModal() {
  const modal = document.querySelector("#modal-2fa-setup");
  if (modal) modal.style.display = "none";
}

function copy2FASecret() {
  if (!currentSetupSecret) return;
  navigator.clipboard.writeText(currentSetupSecret).then(() => {
    showToast("Chave 2FA copiada para a área de transferência!");
  }).catch(() => {
    showToast("Chave 2FA selecionada.");
  });
}

async function confirm2FASetup() {
  const pinInput = document.querySelector("#twofa-setup-pin");
  const errorDiv = document.querySelector("#twofa-setup-error");
  const confirmBtn = document.querySelector("#btn-confirm-2fa-setup");
  const confirmBtnText = document.querySelector("#btn-confirm-2fa-text");

  if (!pinInput || !errorDiv) return;
  if (!window.TOTP) {
    alert("Módulo 2FA não carregado. Recarregue a página e tente novamente.");
    return;
  }

  const rawVal = pinInput.value || "";
  const pin = String(rawVal).replace(/\D/g, '').trim();

  if (pin.length !== 6) {
    errorDiv.style.display = "block";
    errorDiv.innerText = "Por favor, digite o código de 6 dígitos gerado no app.";
    pinInput.focus();
    return;
  }

  const secretToVerify = currentSetupSecret 
    || window.TOTP.getSavedSecret() 
    || document.querySelector("#twofa-setup-secret")?.innerText?.trim();

  if (!secretToVerify) {
    errorDiv.style.display = "block";
    errorDiv.innerText = "Chave secreta não encontrada. Feche e abra o modal novamente.";
    return;
  }

  if (confirmBtn) confirmBtn.disabled = true;
  if (confirmBtnText) confirmBtnText.innerText = "Verificando...";

  try {
    const isValid = await window.TOTP.verifyToken(secretToVerify, pin);
    if (isValid) {
      window.TOTP.enable2FA(secretToVerify);
      close2FASetupModal();
      updateSessionInfo();
      showToast("Verificação em 2 Etapas (2FA) configurada com sucesso!");
      if (currentTab === "admin-all" || currentTab === "admin-users") {
        switchDashboardTab(currentTab);
      }
    } else {
      errorDiv.style.display = "block";
      errorDiv.innerText = "Código de 6 dígitos inválido ou expirado. Verifique o relógio do seu celular e tente novamente.";
      pinInput.select();
    }
  } catch (e) {
    console.error("Erro na verificação 2FA:", e);
    errorDiv.style.display = "block";
    errorDiv.innerText = "Erro ao validar código. Tente novamente.";
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
    if (confirmBtnText) confirmBtnText.innerText = "Confirmar e Ativar";
  }
}

function open2FAChallengeModal() {
  const modal = document.querySelector("#modal-2fa-challenge");
  const pinInput = document.querySelector("#twofa-challenge-pin");
  const errorDiv = document.querySelector("#twofa-challenge-error");

  if (pinInput) pinInput.value = "";
  if (errorDiv) {
    errorDiv.style.display = "none";
    errorDiv.innerText = "";
  }

  if (modal) {
    modal.style.display = "flex";
    const card = modal.querySelector(".modal-card");
    if (card) card.scrollTop = 0;
  }

  setTimeout(() => {
    if (pinInput) pinInput.focus();
  }, 250);
}

function close2FAChallengeModal() {
  const modal = document.querySelector("#modal-2fa-challenge");
  if (modal) modal.style.display = "none";
  if (window.TOTP && window.TOTP.is2FAEnabled() && !window.TOTP.isSessionVerified()) {
    showToast("Acesso cancelado. O painel requer autenticação em 2 etapas.");
    handleAuthLogout();
  }
}

async function verify2FAChallenge() {
  const pinInput = document.querySelector("#twofa-challenge-pin");
  const errorDiv = document.querySelector("#twofa-challenge-error");
  const verifyBtn = document.querySelector("#btn-verify-2fa-challenge");
  const verifyBtnText = document.querySelector("#btn-verify-2fa-text");

  if (!pinInput || !errorDiv) return;
  if (!window.TOTP) {
    alert("Módulo 2FA não carregado. Recarregue a página.");
    return;
  }

  const rawVal = pinInput.value || "";
  const pin = String(rawVal).replace(/\D/g, '').trim();

  if (pin.length !== 6) {
    errorDiv.style.display = "block";
    errorDiv.innerText = "Por favor, digite o código de 6 dígitos gerado no aplicativo.";
    pinInput.focus();
    return;
  }

  const savedSecret = window.TOTP.getSavedSecret();
  if (!savedSecret) {
    errorDiv.style.display = "block";
    errorDiv.innerText = "Nenhuma chave 2FA salva encontrada nesta conta.";
    return;
  }

  if (verifyBtn) verifyBtn.disabled = true;
  if (verifyBtnText) verifyBtnText.innerText = "Verificando...";

  try {
    const isValid = await window.TOTP.verifyToken(savedSecret, pin);
    if (isValid) {
      const rememberCheckbox = document.querySelector("#twofa-remember-device");
      const shouldRemember = rememberCheckbox ? rememberCheckbox.checked : true;
      window.TOTP.setSessionVerified(true, shouldRemember ? 30 : 0);
      const modal = document.querySelector("#modal-2fa-challenge");
      if (modal) modal.style.display = "none";
      showToast("Identidade de administrador verificada com sucesso!");
      loadDashboardData();
    } else {
      errorDiv.style.display = "block";
      errorDiv.innerText = "Código de 6 dígitos incorreto. Verifique no Microsoft Authenticator e tente novamente.";
      pinInput.select();
    }
  } catch (e) {
    console.error("Erro no desafio 2FA:", e);
    errorDiv.style.display = "block";
    errorDiv.innerText = "Erro ao validar desafio 2FA. Tente novamente.";
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
    if (verifyBtnText) verifyBtnText.innerText = "Desbloquear Painel";
  }
}

function open2FAManageModal() {
  if (!window.TOTP) return;
  const modal = document.querySelector("#modal-2fa-manage");
  const secretSpan = document.querySelector("#twofa-manage-secret");

  if (secretSpan) {
    secretSpan.innerText = window.TOTP.getSavedSecret();
  }

  if (modal) modal.style.display = "flex";
}

function close2FAManageModal() {
  const modal = document.querySelector("#modal-2fa-manage");
  if (modal) modal.style.display = "none";
}

function copy2FAManageSecret() {
  if (!window.TOTP) return;
  const secret = window.TOTP.getSavedSecret();
  if (!secret) return;
  navigator.clipboard.writeText(secret).then(() => {
    showToast("Chave secreta de backup copiada!");
  });
}

function disableAdmin2FA() {
  if (!window.TOTP) return;
  if (confirm("Tem certeza que deseja desativar a verificação em duas etapas da sua conta de administrador?")) {
    window.TOTP.disable2FA();
    close2FAManageModal();
    updateSessionInfo();
    showToast("Verificação em 2 etapas desativada.");
  }
}

// =======================================================
// Sparklines & Analytics do Link (Gráficos Diário e Mensal)
// =======================================================
let currentAnalyticsLink = null;
let currentAnalyticsMode = "daily-7"; // "daily-7" | "daily-14" | "daily-30" | "monthly"

// Reconcilia cliques diários com os cliques totais (atribui histórico anterior ao dia de criação)
function getReconciledDailyClicks(link) {
  if (!link) return {};
  const totalClicks = Number(link.clicks) || 0;
  const rawDaily = (link.dailyClicks && typeof link.dailyClicks === "object") ? link.dailyClicks : {};
  const daily = { ...rawDaily };
  
  let sumRecorded = Object.values(daily).reduce((a, b) => a + (Number(b) || 0), 0);
  if (totalClicks > sumRecorded) {
    const diff = totalClicks - sumRecorded;
    const createdKey = link.createdAt ? link.createdAt.slice(0, 10) : "";
    if (createdKey) {
      daily[createdKey] = (Number(daily[createdKey]) || 0) + diff;
    } else {
      const todayKey = new Date().toISOString().slice(0, 10);
      daily[todayKey] = (Number(daily[todayKey]) || 0) + diff;
    }
  }
  return daily;
}

// Gera mini gráfico Sparkline SVG com os últimos 7 dias (baseado nos cliques diários reais)
function generateSparklineSvg(dailyClicks, totalClicks, daysCount = 7, link = null) {
  const days = [];
  const now = new Date();
  
  const effectiveDaily = link ? getReconciledDailyClicks(link) : { ...(dailyClicks || {}) };
  let sumRecorded = Object.values(effectiveDaily).reduce((a, b) => a + (Number(b) || 0), 0);
  if (totalClicks > sumRecorded) {
    const createdKey = (link && link.createdAt) ? link.createdAt.slice(0, 10) : now.toISOString().slice(0, 10);
    effectiveDaily[createdKey] = (Number(effectiveDaily[createdKey]) || 0) + (totalClicks - sumRecorded);
  }

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const formatted = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const count = Number(effectiveDaily[dateKey]) || 0;
    days.push({ dateKey, formatted, count });
  }

  const maxVal = Math.max(...days.map(d => d.count), 1);
  const barWidth = 6;
  const barGap = 3;
  const svgHeight = 22;
  const svgWidth = daysCount * (barWidth + barGap);

  let barsHtml = "";
  days.forEach((d, idx) => {
    const x = idx * (barWidth + barGap);
    const barHeight = d.count > 0 ? Math.max(4, Math.round((d.count / maxVal) * (svgHeight - 4))) : 2;
    const y = svgHeight - barHeight;
    const fill = d.count > 0 ? "url(#sparkline-grad)" : "rgba(148, 163, 184, 0.25)";
    const tooltip = `${d.formatted}: ${d.count} ${d.count === 1 ? 'clique' : 'cliques'}`;

    barsHtml += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="1.5" fill="${fill}" class="sparkline-bar">
        <title>${tooltip}</title>
      </rect>
    `;
  });

  return `
    <svg width="${svgWidth}" height="${svgHeight}" class="sparkline-svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
      <defs>
        <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#0284c7" />
        </linearGradient>
      </defs>
      ${barsHtml}
    </svg>
  `;
}

// Abre o Modal de Analytics do Link
function openLinkAnalyticsModal(slug) {
  const link = allSystemLinks.find(l => (l.slug || "").toLowerCase() === slug.toLowerCase())
    || allLinks.find(l => (l.slug || "").toLowerCase() === slug.toLowerCase());
  
  if (!link) return;
  currentAnalyticsLink = link;
  currentAnalyticsMode = "daily-7"; // Sempre inicia no gráfico diário de 7 dias

  const slugTitle = document.querySelector("#analytics-slug-title");
  const targetUrlEl = document.querySelector("#analytics-target-url");
  const createdDateEl = document.querySelector("#analytics-created-date");
  const securityBadge = document.querySelector("#analytics-security-badge");
  const typeBadge = document.querySelector("#analytics-type-badge");

  if (slugTitle) slugTitle.innerText = `/${link.slug}`;
  if (targetUrlEl) {
    targetUrlEl.innerText = link.targetUrl || "Link Protegido";
    targetUrlEl.title = link.targetUrl || "";
  }
  if (createdDateEl) {
    const d = link.createdAt ? new Date(link.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric' }) : "Data inicial";
    createdDateEl.innerText = `Criado em: ${d}`;
  }
  if (securityBadge) {
    securityBadge.className = link.isPasswordProtected ? "badge badge-warning" : "badge badge-success";
    securityBadge.innerHTML = link.isPasswordProtected ? "🔒 Protegido" : "🌐 Aberto";
  }
  if (typeBadge) {
    typeBadge.innerText = link.authorType === "google" ? "🔴 Google" : link.authorType === "github" ? "🐙 GitHub" : "👤 Visitante";
  }

  // Atualiza botões
  const btnDaily7 = document.querySelector("#btn-toggle-daily-7");
  const btnDaily14 = document.querySelector("#btn-toggle-daily-14");
  const btnDaily30 = document.querySelector("#btn-toggle-daily-30");
  const btnMonthly = document.querySelector("#btn-toggle-monthly");
  const heading = document.querySelector("#analytics-chart-heading");

  if (btnDaily7) btnDaily7.className = "analytics-toggle-btn active";
  if (btnDaily14) btnDaily14.className = "analytics-toggle-btn";
  if (btnDaily30) btnDaily30.className = "analytics-toggle-btn";
  if (btnMonthly) btnMonthly.className = "analytics-toggle-btn";
  if (heading) heading.innerText = "Gráfico Diário (Últimos 7 Dias)";

  renderAnalyticsModalContent();

  const modal = document.querySelector("#modal-link-analytics");
  if (modal) modal.style.display = "flex";
}

function closeLinkAnalyticsModal() {
  const modal = document.querySelector("#modal-link-analytics");
  if (modal) modal.style.display = "none";
}

function switchAnalyticsViewMode(mode) {
  currentAnalyticsMode = mode;
  const btnDaily7 = document.querySelector("#btn-toggle-daily-7");
  const btnDaily14 = document.querySelector("#btn-toggle-daily-14");
  const btnDaily30 = document.querySelector("#btn-toggle-daily-30");
  const btnMonthly = document.querySelector("#btn-toggle-monthly");
  const heading = document.querySelector("#analytics-chart-heading");

  if (btnDaily7) btnDaily7.className = mode === "daily-7" ? "analytics-toggle-btn active" : "analytics-toggle-btn";
  if (btnDaily14) btnDaily14.className = mode === "daily-14" ? "analytics-toggle-btn active" : "analytics-toggle-btn";
  if (btnDaily30) btnDaily30.className = mode === "daily-30" ? "analytics-toggle-btn active" : "analytics-toggle-btn";
  if (btnMonthly) btnMonthly.className = mode === "monthly" ? "analytics-toggle-btn active" : "analytics-toggle-btn";

  if (heading) {
    if (mode === "daily-7") heading.innerText = "Gráfico Diário (Últimos 7 Dias)";
    else if (mode === "daily-14") heading.innerText = "Gráfico Diário (Últimos 14 Dias)";
    else if (mode === "daily-30") heading.innerText = "Gráfico Diário (Últimos 30 Dias)";
    else if (mode === "monthly") heading.innerText = "Gráfico Mensal (Desde a Criação)";
  }

  renderAnalyticsModalContent();
}

function renderAnalyticsModalContent() {
  if (!currentAnalyticsLink) return;
  const link = currentAnalyticsLink;
  const totalClicks = Number(link.clicks) || 0;
  const dailyClicks = getReconciledDailyClicks(link);

  const totalClicksEl = document.querySelector("#analytics-total-clicks");
  const curMonthClicksEl = document.querySelector("#analytics-current-month-clicks");
  const periodLabelEl = document.querySelector("#analytics-period-label");
  const avgClicksEl = document.querySelector("#analytics-avg-clicks");
  const avgLabelEl = document.querySelector("#analytics-avg-label");
  const peakClicksEl = document.querySelector("#analytics-peak-clicks");
  const peakLabelEl = document.querySelector("#analytics-peak-label");
  const chartContainer = document.querySelector("#analytics-chart-container");
  const breakdownList = document.querySelector("#analytics-breakdown-list");

  if (totalClicksEl) totalClicksEl.innerText = totalClicks;

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (currentAnalyticsMode === "monthly") {
    // ==========================================
    // MODO MENSAL (Todos os meses desde a criação)
    // ==========================================
    const createdDate = link.createdAt ? new Date(link.createdAt) : new Date();
    const startYear = createdDate.getFullYear();
    const startMonth = createdDate.getMonth();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth();

    const monthsData = [];
    let curY = startYear;
    let curM = startMonth;

    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const monthKey = `${curY}-${String(curM + 1).padStart(2, '0')}`;
      const monthDate = new Date(curY, curM, 1);
      const label = monthDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "");
      
      let mClicks = 0;
      Object.keys(dailyClicks).forEach(k => {
        if (k.startsWith(monthKey)) {
          mClicks += Number(dailyClicks[k]) || 0;
        }
      });

      monthsData.push({
        key: monthKey,
        label: label,
        fullName: monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        clicks: mClicks
      });

      curM++;
      if (curM > 11) {
        curM = 0;
        curY++;
      }
    }

    const thisMonthObj = monthsData.find(m => m.key === currentMonthKey);
    if (curMonthClicksEl) curMonthClicksEl.innerText = thisMonthObj ? thisMonthObj.clicks : 0;
    if (periodLabelEl) periodLabelEl.innerText = "Neste Mês";

    const avg = monthsData.length > 0 ? (totalClicks / monthsData.length).toFixed(1) : "0.0";
    if (avgClicksEl) avgClicksEl.innerText = `${avg}/mês`;
    if (avgLabelEl) avgLabelEl.innerText = "Média Mensal";

    const peak = monthsData.reduce((max, m) => m.clicks > max ? m.clicks : max, 0);
    if (peakClicksEl) peakClicksEl.innerText = `${peak} max`;
    if (peakLabelEl) peakLabelEl.innerText = "Pico Mensal";

    renderSvgBarChart(chartContainer, monthsData, totalClicks, "monthly");
    renderBreakdownTable(breakdownList, monthsData, totalClicks);
  } else {
    // ==========================================
    // MODOS DIÁRIOS (7, 14 ou 30 Dias)
    // ==========================================
    let daysCount = 7;
    if (currentAnalyticsMode === "daily-14") daysCount = 14;
    else if (currentAnalyticsMode === "daily-30") daysCount = 30;

    const daysData = [];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const isToday = d.toDateString() === now.toDateString();
      const isYesterday = d.toDateString() === yesterday.toDateString();

      let label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      if (daysCount === 7) {
        const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        const formattedDay = `${d.getDate()}/${d.getMonth() + 1}`;
        label = isToday ? "Hoje" : isYesterday ? "Ontem" : `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${formattedDay}`;
      }

      const fullName = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
      const clicks = Number(dailyClicks[dateKey]) || 0;

      daysData.push({
        key: dateKey,
        label: label,
        fullName: fullName,
        clicks: clicks,
        isToday: isToday
      });
    }

    const todayClicks = Number(dailyClicks[todayKey]) || 0;
    if (curMonthClicksEl) curMonthClicksEl.innerText = todayClicks;
    if (periodLabelEl) periodLabelEl.innerText = "Cliques Hoje";

    const totalInPeriod = daysData.reduce((acc, curr) => acc + curr.clicks, 0);
    const avg = (totalInPeriod / daysCount).toFixed(1);
    if (avgClicksEl) avgClicksEl.innerText = `${avg}/dia`;
    if (avgLabelEl) avgLabelEl.innerText = "Média Diária";

    const peak = daysData.reduce((max, d) => d.clicks > max ? d.clicks : max, 0);
    if (peakClicksEl) peakClicksEl.innerText = `${peak} max`;
    if (peakLabelEl) peakLabelEl.innerText = "Melhor Dia";

    renderSvgBarChart(chartContainer, daysData, totalClicks, `daily-${daysCount}`);
    renderBreakdownTable(breakdownList, daysData, totalClicks);
  }
}

// Renderizador Universal de Gráficos de Barra SVG
function renderSvgBarChart(container, dataPoints, totalClicks, mode = "daily-7") {
  if (!container) return;

  if (!dataPoints || dataPoints.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.9rem;">Nenhum dado de cliques registrado até o momento.</div>`;
    return;
  }

  const maxVal = Math.max(...dataPoints.map(d => d.clicks), 1);
  const chartHeight = 185;
  const paddingBottom = 30;
  const paddingTop = 26;
  const usableHeight = chartHeight - paddingBottom - paddingTop;
  
  const totalBars = dataPoints.length;
  const svgWidth = 680;
  const slotWidth = svgWidth / totalBars;

  let barWidth = 42;
  if (totalBars === 7) barWidth = 48;
  else if (totalBars === 14) barWidth = 26;
  else if (totalBars >= 28) barWidth = 13;
  else barWidth = Math.min(50, slotWidth * 0.65);

  let barsSvg = "";

  dataPoints.forEach((item, idx) => {
    const xCenter = (idx * slotWidth) + (slotWidth / 2);
    const x = xCenter - (barWidth / 2);
    const barH = item.clicks > 0 ? Math.max(8, Math.round((item.clicks / maxVal) * usableHeight)) : 3;
    const y = chartHeight - paddingBottom - barH;
    const fill = item.clicks > 0 ? "url(#chart-bar-grad)" : "rgba(148, 163, 184, 0.15)";
    const percent = totalClicks > 0 ? ((item.clicks / totalClicks) * 100).toFixed(1) : 0;
    const tooltipText = `${item.fullName || item.label}: ${item.clicks} ${item.clicks === 1 ? 'clique' : 'cliques'} (${percent}% do total)`;

    barsSvg += `
      <g class="chart-bar-group">
        <!-- Barra -->
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${fill}" class="chart-bar-rect ${item.isToday ? 'chart-bar-today' : ''}">
          <title>${tooltipText}</title>
        </rect>
        
        <!-- Valor acima da barra se houver cliques -->
        ${item.clicks > 0 ? `
          <text x="${xCenter}" y="${y - 6}" fill="#38bdf8" font-size="${totalBars <= 7 ? '12' : '10'}" font-weight="700" font-family="'JetBrains Mono', monospace" text-anchor="middle">
            ${item.clicks}
          </text>
        ` : ''}

        <!-- Legenda do Eixo X -->
        <text x="${xCenter}" y="${chartHeight - 8}" fill="${item.isToday ? '#38bdf8' : 'var(--text-muted)'}" font-size="${totalBars <= 7 ? '11' : totalBars <= 14 ? '10' : '9'}" font-weight="${item.isToday ? '700' : '500'}" font-family="inherit" text-anchor="middle">
          ${item.label}
        </text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg width="100%" height="${chartHeight}" class="chart-svg-main" viewBox="0 0 ${svgWidth} ${chartHeight}" style="max-width: 100%;">
      <defs>
        <linearGradient id="chart-bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#0284c7" />
        </linearGradient>
      </defs>
      
      <!-- Linhas de Grid Guia -->
      <line x1="0" y1="${chartHeight - paddingBottom}" x2="${svgWidth}" y2="${chartHeight - paddingBottom}" stroke="rgba(255,255,255,0.12)" stroke-width="1" />
      <line x1="0" y1="${chartHeight - paddingBottom - (usableHeight / 2)}" x2="${svgWidth}" y2="${chartHeight - paddingBottom - (usableHeight / 2)}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 3" />
      <line x1="0" y1="${paddingTop}" x2="${svgWidth}" y2="${paddingTop}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="3 3" />

      ${barsSvg}
    </svg>
  `;
}

// Renderiza Lista de Detalhamento
function renderBreakdownTable(container, dataPoints, totalClicks) {
  if (!container) return;

  const nonZeroItems = [...dataPoints].reverse().filter(d => d.clicks > 0);
  if (nonZeroItems.length === 0) {
    container.innerHTML = `<div style="padding: 1rem; color: var(--text-muted); text-align: center; font-size: 0.85rem;">Nenhum clique registrado neste período.</div>`;
    return;
  }

  let html = "";
  nonZeroItems.forEach(item => {
    const pct = totalClicks > 0 ? ((item.clicks / totalClicks) * 100).toFixed(1) : 0;
    html += `
      <div class="analytics-breakdown-row">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;"></span>
          <strong style="color: #fff;">${escapeHtml(item.fullName || item.label)}</strong>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span style="color: var(--text-muted); font-size: 0.78rem;">${pct}% do total</span>
          <span class="clicks-badge" style="font-size: 0.82rem;">
            ${item.clicks} ${item.clicks === 1 ? 'clique' : 'cliques'}
          </span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

window.loadDashboardData = loadDashboardData;
window.initDashboard = initDashboard;
window.deleteLink = deleteLink;
window.saveEditedLink = saveEditedLink;
window.switchDashboardTab = switchDashboardTab;
window.filterByUser = filterByUser;
window.toggleSelectLink = toggleSelectLink;
window.toggleSelectAllLinks = toggleSelectAllLinks;
window.deselectAllLinks = deselectAllLinks;
function forget2FATrustedDevice() {
  if (!window.TOTP) return;
  window.TOTP.forgetTrustedDevice();
  close2FAManageModal();
  showToast("Navegador esquecido. O 2FA será solicitado no próximo login.");
}

window.deleteSelectedBatchLinks = deleteSelectedBatchLinks;
window.handle2FABadgeClick = handle2FABadgeClick;
window.open2FASetupModal = open2FASetupModal;
window.close2FASetupModal = close2FASetupModal;
window.copy2FASecret = copy2FASecret;
window.confirm2FASetup = confirm2FASetup;
window.open2FAChallengeModal = open2FAChallengeModal;
window.close2FAChallengeModal = close2FAChallengeModal;
window.verify2FAChallenge = verify2FAChallenge;
window.open2FAManageModal = open2FAManageModal;
window.close2FAManageModal = close2FAManageModal;
window.copy2FAManageSecret = copy2FAManageSecret;
window.forget2FATrustedDevice = forget2FATrustedDevice;
window.disableAdmin2FA = disableAdmin2FA;
window.openLinkAnalyticsModal = openLinkAnalyticsModal;
window.closeLinkAnalyticsModal = closeLinkAnalyticsModal;
window.switchAnalyticsViewMode = switchAnalyticsViewMode;
window.handleEditSlugInputDebounced = handleEditSlugInputDebounced;
window.checkEditSlugAvailability = checkEditSlugAvailability;


