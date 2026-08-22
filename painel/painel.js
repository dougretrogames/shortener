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
    const remoteList = await window.supabaseDb.getUserLinks(userIdentifier);

    if (Array.isArray(remoteList)) {
      const baseUrl = new URL('../', window.location.href).href;
      const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      
      allLinks = remoteList.map(remote => {
        const enc = (remote.encrypted_data && typeof remote.encrypted_data === "object") ? remote.encrypted_data : {};
        const remoteClicks = Number(remote.clicks) || 0;
        const outputUrl = `${cleanBaseUrl}${encodeURIComponent(remote.slug)}`;
        
        // Identifica o criador vinculado à conta no banco
        const isGithubAuthor = enc.author_type === "github" || remote.author_type === "github" || (enc.author_username && enc.author_username !== "visitante") || (remote.author_username && remote.author_username !== "visitante");
        let authorType = isGithubAuthor ? "github" : "visitante";
        let authorUsername = enc.author_username || remote.author_username || (user ? user.username : "");
        let authorName = enc.author_name || remote.author_name || (isGithubAuthor ? (authorUsername ? `@${authorUsername}` : "GitHub") : "Visitante");

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
    const isGithub = link.authorType === "github" || (link.authorUsername && link.authorUsername !== "visitante");
    const authorDisplay = link.authorName || (isGithub ? `@${link.authorUsername || "GitHub"}` : "Visitante");
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
          ${isGithub ? `
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
        <td>
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

  const statusEl = document.querySelector("#edit-slug-status");
  statusEl.style.display = "none";

  document.querySelector("#edit-modal").style.display = "flex";
}

function closeEditModal() {
  document.querySelector("#edit-modal").style.display = "none";
}

function checkEditSlugAvailability() {
  const originalSlug = document.querySelector("#edit-original-slug").value.trim();
  const newSlug = document.querySelector("#edit-slug").value.trim().toLowerCase();
  const statusEl = document.querySelector("#edit-slug-status");

  if (!newSlug || newSlug === originalSlug.toLowerCase()) {
    statusEl.style.display = "none";
    return;
  }

  const exists = allLinks.some(l => l.slug && l.slug.toLowerCase() === newSlug && l.slug.toLowerCase() !== originalSlug.toLowerCase());

  statusEl.style.display = "flex";
  if (exists) {
    statusEl.className = "slug-status exists";
    statusEl.innerHTML = `⚠️ O apelido "${escapeHtml(newSlug)}" já está em uso por outro link.`;
  } else {
    statusEl.className = "slug-status available";
    statusEl.innerHTML = `✓ Apelido disponível!`;
  }
}

async function saveEditedLink(e) {
  e.preventDefault();
  const originalSlug = document.querySelector("#edit-original-slug").value;
  const newSlug = document.querySelector("#edit-slug").value.trim().toLowerCase();
  const newTargetUrl = document.querySelector("#edit-target-url").value.trim();
  const newHint = document.querySelector("#edit-hint").value.trim();

  // Validação de segurança da URL
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

  const link = allLinks.find(l => (l.slug || "").toLowerCase() === originalSlug.toLowerCase());
  if (!link) return;

  if (window.supabaseDb) {
    try {
      const enc = (link.encryptedData && typeof link.encryptedData === "object") ? link.encryptedData : {};
      enc.t = newTargetUrl;
      enc.u = newTargetUrl;
      enc.h = newHint;

      if (newSlug !== originalSlug.toLowerCase()) {
        // Se mudou o apelido, recria com o novo slug no Supabase e remove o antigo
        await window.supabaseDb.deleteLink(originalSlug);
        await window.supabaseDb.saveLink({
          slug: newSlug,
          encryptedData: enc,
          hint: newHint,
          targetUrl: newTargetUrl,
          authorType: link.authorType,
          authorUsername: link.authorUsername,
          authorName: link.authorName
        });
      } else {
        // Atualiza os dados no banco Supabase
        const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?slug=eq.${encodeURIComponent(originalSlug)}`;
        await fetch(endpoint, {
          method: "PATCH",
          headers: window.supabaseDb.getHeaders(),
          body: JSON.stringify({
            encrypted_data: enc,
            hint: newHint || null
          })
        });
      }
    } catch (err) {
      console.error("[Supabase] Erro ao editar link no banco:", err);
    }
  }

  closeEditModal();
  showToast("Link atualizado no banco de dados com sucesso!");
  await loadDashboardData();
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
