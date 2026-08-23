/**
 * Shortener - Lógica do Painel de Controle (painel.js)
 * Gerenciamento de links, métricas de cliques, edição e exportação de dados
 */

let allLinks = [];
let filteredLinks = [];
window.allLinks = allLinks;
window.filteredLinks = filteredLinks;

function initDashboard() {
  const isAuth = window.authManager && window.authManager.isAuthenticated();
  const restrictedCard = document.querySelector("#access-restricted-card");
  const dashboardContent = document.querySelector("#dashboard-content");

  if (!isAuth) {
    if (restrictedCard) restrictedCard.style.display = "block";
    if (dashboardContent) dashboardContent.style.display = "none";
    return;
  }

  if (restrictedCard) restrictedCard.style.display = "none";
  if (dashboardContent) dashboardContent.style.display = "block";

  updateSessionInfo();
  loadDashboardData();
}

function updateSessionInfo() {
  const user = window.authManager.getUser();
  const sessionBadge = document.querySelector("#session-badge");
  const dashboardTitle = document.querySelector("#dashboard-title");
  const dashboardSubtitle = document.querySelector("#dashboard-subtitle");

  if (user) {
    if (sessionBadge) {
      sessionBadge.className = `badge provider-badge ${user.provider || 'github'}`;
      sessionBadge.innerText = `Conectado via ${user.providerName || 'GitHub'} (@${user.username || user.name})`;
    }
    const nameDisplay = user.name && user.name !== user.username ? `${user.name} (@${user.username})` : `@${user.username || user.name}`;
    if (dashboardTitle) dashboardTitle.innerText = `Olá, ${nameDisplay}!`;
    if (dashboardSubtitle) dashboardSubtitle.innerText = `Exibindo os links vinculados exclusivamente à sua conta @${user.username || user.name} e sincronizados na nuvem.`;
  }
}

async function loadDashboardData() {
  const user = window.authManager ? window.authManager.getUser() : null;
  const userIdentifier = user ? (user.username || user.name || user.id) : null;
  const tbody = document.querySelector("#dashboard-tbody");
  const noLinksMsg = document.querySelector("#no-links-msg");

  if (!window.supabaseDb || !userIdentifier) {
    allLinks = [];
    renderStats();
    filterLinks();
    return;
  }

  // Exibe estado de carregamento inicial enquanto consulta o banco de dados
  if (tbody && allLinks.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="display: inline-block; width: 26px; height: 26px; border: 2px solid rgba(56, 189, 248, 0.2); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 0.65rem;"></div>
          <p style="font-size: 0.88rem; margin: 0; color: var(--text-secondary);">Consultando dados do banco de dados na nuvem...</p>
        </td>
      </tr>
    `;
    if (noLinksMsg) noLinksMsg.style.display = "none";
  }

  try {
    // Carrega dados EXCLUSIVAMENTE do banco de dados Supabase para a conta conectada
    const remoteList = await window.supabaseDb.getUserLinks(user || userIdentifier);

    if (Array.isArray(remoteList)) {
      const baseUrl = new URL('../', window.location.href).href;
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      
      allLinks = remoteList.map(remote => {
        const enc = (remote.encrypted_data && typeof remote.encrypted_data === "object") ? remote.encrypted_data : {};
        const remoteClicks = Number(remote.clicks) || 0;
        const outputUrl = `${cleanBaseUrl}${encodeURIComponent(remote.slug)}`;
        
        // Identifica o criador vinculado à conta no banco (Google, GitHub ou Visitante)
        const encType = enc.author_type || remote.author_type;
        const authorType = (encType === "google" || encType === "github") 
          ? encType 
          : (user && user.provider ? user.provider : (encType ? encType : "visitante"));
        let authorUsername = enc.author_username || remote.author_username || (user ? user.username : "");
        let authorName = enc.author_name || remote.author_name || (user && user.name ? user.name : (authorUsername ? `@${authorUsername}` : (authorType === "google" ? "Google" : authorType === "github" ? "GitHub" : "Visitante")));

        return {
          slug: remote.slug,
          outputUrl: outputUrl,
          shortUrl: outputUrl,
          autonomousUrl: `${cleanBaseUrl}#/${encodeURIComponent(remote.slug)}`,
          targetUrl: enc.t || enc.u || `Link Protegido (/${remote.slug})`,
          hint: remote.hint || enc.h || "",
          encryptedData: enc,
          clicks: remoteClicks, // 100% exclusivo do banco de dados
          authorType: authorType,
          authorUsername: authorUsername,
          authorName: authorName,
          createdAt: remote.created_at || new Date().toISOString()
        };
      });
    } else {
      allLinks = [];
    }

    window.allLinks = allLinks;
    renderStats();
    filterLinks();

    // Sincroniza em segundo plano a coluna author_id caso algum link antigo esteja sem ela
    if (window.supabaseDb && typeof window.supabaseDb.syncUserLinksAuthorId === "function" && user) {
      window.supabaseDb.syncUserLinksAuthorId(user).catch(() => {});
    }
  } catch (e) {
    console.error("[Supabase] Erro ao carregar dados exclusivos do banco:", e);
    allLinks = [];
    window.allLinks = allLinks;
    renderStats();
    filterLinks();
  }
}

window.loadDashboardData = loadDashboardData;
window.initDashboard = initDashboard;
window.deleteLink = deleteLink;
window.saveEditedLink = saveEditedLink;

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

  document.querySelector("#stat-total-links").innerText = totalLinks;
  document.querySelector("#stat-total-clicks").innerText = totalClicks;
  document.querySelector("#stat-top-slug").innerText = topLink ? (topLink.slug || "Sem apelido") : "-";
  document.querySelector("#stat-avg-clicks").innerText = avgClicks;
}

function filterLinks() {
  const query = (document.querySelector("#search-input").value || "").trim().toLowerCase();
  const sortMode = document.querySelector("#sort-select").value;

  filteredLinks = allLinks.filter(link => {
    const slug = (link.slug || "").toLowerCase();
    const target = (link.targetUrl || "").toLowerCase();
    const hint = (link.hint || "").toLowerCase();
    const author = (link.authorName || "").toLowerCase();
    return slug.includes(query) || target.includes(query) || hint.includes(query) || author.includes(query);
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
    }
    return 0;
  });

  renderLinksTable();
}

function renderLinksTable() {
  const tbody = document.querySelector("#dashboard-tbody");
  const noLinksMsg = document.querySelector("#no-links-msg");

  if (!filteredLinks || filteredLinks.length === 0) {
    tbody.innerHTML = "";
    noLinksMsg.style.display = "block";
    return;
  }

  noLinksMsg.style.display = "none";
  let html = "";

  filteredLinks.forEach(link => {
    const slug = link.slug || "sem-apelido";
    const targetUrl = link.targetUrl || link.outputUrl || "";
    const clicks = link.clicks || 0;
    const authorType = link.authorType || (link.encryptedData && link.encryptedData.author_type) || "visitante";
    const isGoogle = authorType === "google";
    const isGithub = authorType === "github";
    const isRegistered = isGoogle || isGithub || (link.authorUsername && link.authorUsername !== "visitante");
    const authorDisplay = link.authorName || (link.authorUsername ? `@${link.authorUsername}` : (isGoogle ? "Google" : isGithub ? "GitHub" : "Visitante"));
    const dateFormatted = link.createdAt ? new Date(link.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recente";

    html += `
      <tr>
        <td>
          <div style="display: flex; flex-direction: column; gap: 0.2rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-primary);"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <strong style="color: var(--accent-primary); font-family: 'JetBrains Mono', monospace;">${escapeHtml(slug)}</strong>
            </div>
            ${link.hint ? `<small style="color: #a5b4fc; font-size: 0.78rem;">Dica: ${escapeHtml(link.hint)}</small>` : ''}
          </div>
        </td>
        <td>
          <span style="max-width: 240px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; color: var(--text-secondary);" title="${escapeHtml(targetUrl)}">
            ${escapeHtml(targetUrl)}
          </span>
        </td>
        <td>
          ${isGoogle ? `
            <span class="badge" style="background: rgba(66, 133, 244, 0.12); color: #93c5fd; border: 1px solid rgba(66, 133, 244, 0.3); font-size: 0.75rem; padding: 0.2rem 0.5rem; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 500;">
              <svg width="13" height="13" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              ${escapeHtml(authorDisplay)}
            </span>
          ` : isGithub ? `
            <span class="badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); font-size: 0.75rem; padding: 0.2rem 0.5rem; display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              ${escapeHtml(authorDisplay)}
            </span>
          ` : `
            <span class="badge" style="background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); font-size: 0.75rem; padding: 0.2rem 0.5rem; display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 500;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
              Visitante
            </span>
          `}
        </td>
        <td>
          <span class="clicks-badge" title="Cliques contabilizados diretamente no banco de dados Supabase">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            ${clicks}
          </span>
        </td>
        <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">
          ${dateFormatted}
        </td>
        <td class="td-actions">
          <div class="table-actions" style="justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="copyLink(decodeURIComponent('${encodeURIComponent(link.outputUrl || '')}'))" title="Copiar Link Criptografado">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <a href="${escapeHtml(link.outputUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" title="Testar / Abrir Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal(decodeURIComponent('${encodeURIComponent(slug)}'))" title="Editar Apelido ou Dados">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteLink(decodeURIComponent('${encodeURIComponent(slug)}'))" title="Excluir Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Modal de Edição de Link
function openEditModal(slug) {
  const link = allLinks.find(l => (l.slug || "").toLowerCase() === slug.toLowerCase());
  if (!link) return;

  document.querySelector("#edit-original-slug").value = link.slug;
  document.querySelector("#edit-slug").value = link.slug;
  document.querySelector("#edit-target-url").value = link.targetUrl || "";
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
      securityBadge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Link Aberto (Sem Senha)`;
    }
    if (removePasswordGroup) removePasswordGroup.style.display = "none";
    if (removePasswordCheckbox) removePasswordCheckbox.checked = false;
    if (passwordInput) passwordInput.placeholder = "Digite uma senha para proteger este link...";
  }

  const statusEl = document.querySelector("#edit-slug-status");
  if (statusEl) statusEl.style.display = "none";

  document.querySelector("#edit-modal").style.display = "flex";
}

function closeEditModal() {
  document.querySelector("#edit-modal").style.display = "none";
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

async function checkEditSlugAvailability() {
  const originalSlug = document.querySelector("#edit-original-slug").value.trim();
  const rawVal = document.querySelector("#edit-slug").value.trim();
  const statusEl = document.querySelector("#edit-slug-status");
  if (!statusEl) return;

  if (!rawVal || rawVal.toLowerCase() === originalSlug.toLowerCase()) {
    statusEl.style.display = "none";
    return;
  }

  const newSlug = rawVal
    .replace(/[\s_]+/g, "-")
    .replace(/[@#?&/\\:]+/g, "")
    .toLowerCase();

  // 1. Verificação de profanidade / termos vulgares
  if (window.profanityFilter && window.profanityFilter.isProfane(newSlug)) {
    statusEl.style.display = "flex";
    statusEl.className = "slug-status exists";
    statusEl.innerHTML = `⚠️ O apelido contém termos impróprios ou palavras de baixo calão não permitidas.`;
    return;
  }

  // 2. Consulta no cache local de links carregados
  const existsLocal = allLinks.some(l => l.slug && l.slug.toLowerCase() === newSlug && l.slug.toLowerCase() !== originalSlug.toLowerCase());

  // 3. Consulta global em tempo real no Supabase
  let existsRemote = false;
  if (window.supabaseDb) {
    try {
      existsRemote = await window.supabaseDb.exists(newSlug);
    } catch {}
  }

  statusEl.style.display = "flex";
  if (existsLocal || existsRemote) {
    statusEl.className = "slug-status exists";
    statusEl.innerHTML = `⚠️ O apelido "<strong>${escapeHtml(newSlug)}</strong>" já está em uso por outro link cadastrado.`;
  } else {
    statusEl.className = "slug-status available";
    statusEl.innerHTML = `✓ Apelido "<strong>${escapeHtml(newSlug)}</strong>" disponível para uso!`;
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
    .replace(/[@#?&/\\:]+/g, "")
    .toLowerCase();

  if (!newSlug) {
    alert("Por favor, informe um apelido válido para o link.");
    return;
  }

  // 1. Validação de profanidade
  if (window.profanityFilter && window.profanityFilter.isProfane(newSlug)) {
    alert("O apelido personalizado contém termos impróprios ou palavras de baixo calão não permitidas.");
    return;
  }

  // 2. Validação de disponibilidade caso o apelido tenha mudado
  if (newSlug !== originalSlug.toLowerCase()) {
    if (window.supabaseDb) {
      const exists = await window.supabaseDb.exists(newSlug);
      if (exists) {
        alert(`O apelido "/${newSlug}" já está em uso por outro link no sistema. Escolha outro nome.`);
        return;
      }
    }
  }

  // 3. Validação de segurança da URL
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

  // 4. Validação de confirmação de senha
  if (newPassword && newPassword !== confirmPassword) {
    alert("As senhas digitadas não coincidem. Verifique e tente novamente.");
    const confirmInput = document.querySelector("#edit-password-confirm");
    if (confirmInput) confirmInput.focus();
    return;
  }

  const link = allLinks.find(l => (l.slug || "").toLowerCase() === originalSlug.toLowerCase());
  if (!link) return;

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

    // Cenário A: Usuário definiu uma NOVA SENHA (ou alterou a existente)
    if (newPassword) {
      const api = apiVersions['0.0.1'];
      const salt = await api.randomSalt();
      const iv = await api.randomIv();
      const encryptedBuffer = await api.encrypt(newTargetUrl, newPassword, salt, iv);

      enc = {
        v: "0.0.1",
        e: b64.binaryToBase64(new Uint8Array(encryptedBuffer)),
        s: b64.binaryToBase64(salt),
        i: b64.binaryToBase64(iv)
      };
      if (newHint) enc.h = newHint;
    }
    // Cenário B: Usuário marcou para REMOVER A SENHA
    else if (removePassword) {
      enc = {
        v: "0.0.1",
        open: true,
        u: newTargetUrl
      };
      if (newHint) enc.h = newHint;
    }
    // Cenário C: Campos de senha em branco e não marcou para remover senha (manter proteção atual)
    else {
      const hadPassword = !!(link.encryptedData && link.encryptedData.e);
      if (hadPassword) {
        // Se a URL de destino mudou mas não foi digitada nova senha, exige a senha para recriptografar com segurança
        if (link.targetUrl && newTargetUrl !== link.targetUrl) {
          alert("Para alterar a URL de destino de um link protegido por senha, digite a nova senha (ou redigite a atual) para que a nova URL seja criptografada com segurança.");
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnHtml;
          }
          const pwdInput = document.querySelector("#edit-password");
          if (pwdInput) pwdInput.focus();
          return;
        }

        enc = typeof link.encryptedData === "object" ? { ...link.encryptedData } : {};
        if (newHint) enc.h = newHint;
        else delete enc.h;
      } else {
        // Link aberto
        enc = {
          v: "0.0.1",
          open: true,
          u: newTargetUrl
        };
        if (newHint) enc.h = newHint;
      }
    }

    // Preserva metadados de autoria do criador
    if (link.authorType) enc.author_type = link.authorType;
    if (link.authorUsername) enc.author_username = link.authorUsername;
    if (link.authorName) enc.author_name = link.authorName;

    // Atualiza no banco de dados Supabase
    if (window.supabaseDb) {
      await window.supabaseDb.updateLink(originalSlug, {
        newSlug: newSlug,
        encryptedData: enc,
        hint: newHint,
        targetUrl: newTargetUrl
      });
    }

    // Atualiza também no localStorage local se estiver registrado
    try {
      const localRaw = localStorage.getItem("linklock_saved_custom_links");
      if (localRaw) {
        const localList = JSON.parse(localRaw);
        const idx = localList.findIndex(l => l.slug && l.slug.toLowerCase() === originalSlug.toLowerCase());
        if (idx !== -1) {
          const baseUrl = new URL('../', window.location.href).href;
          const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
          
          localList[idx].slug = newSlug;
          localList[idx].targetUrl = newTargetUrl;
          localList[idx].hint = newHint;
          localList[idx].encryptedData = enc;
          localList[idx].outputUrl = `${cleanBaseUrl}${encodeURIComponent(newSlug)}`;
          localStorage.setItem("linklock_saved_custom_links", JSON.stringify(localList));
        }
      }
    } catch {}

    closeEditModal();
    showToast("Link e credenciais atualizados no banco de dados com sucesso!");
    await loadDashboardData();
  } catch (err) {
    console.error("[Painel] Erro ao salvar edição do link:", err);
    alert("Erro ao salvar alterações no banco de dados. Tente novamente.");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalBtnHtml;
    }
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

// Abre a tela modal moderna de confirmação de exclusão permanente no painel
function openDeleteModal(slug, onConfirm, customTitle, customMsg) {
  let modal = document.querySelector("#confirm-delete-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "confirm-delete-modal";
    modal.className = "modal-backdrop";
    document.body.appendChild(modal);
  }

  const title = customTitle || "Confirmar Exclusão Permanente";
  const targetText = slug ? `/${slug}` : "Link selecionado";
  const msg = customMsg || `Atenção: Este link será <strong>excluído permanentemente</strong> do seu painel e <strong>não poderá ser recuperado</strong>. O identificador será liberado para novos cadastros.`;

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
        <button type="button" id="confirm-delete-action-btn" class="btn btn-danger" style="flex: 1.2; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: center; gap: 0.45rem;">
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
  if (modal) {
    modal.style.display = "none";
  }
}

function deleteLink(slug) {
  openDeleteModal(slug, async () => {
    try {
      // 1. Remove do Supabase Cloud imediatamente
      if (window.supabaseDb && slug) {
        await window.supabaseDb.deleteLink(slug);
      }

      // 2. Limpa tracker local caso exista
      if (window.clickTracker && slug) {
        window.clickTracker.resetLink(slug);
      }

      // 3. Recarrega as informações exclusivamente do banco de dados na nuvem
      showToast(`Link "/${slug}" excluído permanentemente do banco de dados.`);
      await loadDashboardData();
    } catch (e) {
      console.error("Erro ao excluir link no painel:", e);
    }
  });
}

// Sanitização contra CSV Formula Injection (CWE-1236)
function sanitizeCsvValue(val) {
  let str = String(val == null ? "" : val);
  // Se iniciar com caracteres especiais de fórmula (=, +, -, @, tab, retorno de carro), prefixa com apóstrofo
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Exportação de Dados
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
    const headers = ["Apelido", "URL Destino", "Cliques", "Dica", "Data Criacao", "Link Completo"];
    const rows = allLinks.map(l => [
      sanitizeCsvValue(l.slug),
      sanitizeCsvValue(l.targetUrl),
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
    toastText.innerText = text;
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
