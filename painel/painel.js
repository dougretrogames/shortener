/**
 * Encurtador de Links - Lógica do Painel de Controle (painel.js)
 * Gerenciamento de links, métricas de cliques, edição e exportação de dados
 */

let allLinks = [];
let filteredLinks = [];

function initDashboard() {
  updateSessionInfo();
  loadDashboardData();
}

function updateSessionInfo() {
  const user = window.authManager.getUser();
  const sessionBadge = document.querySelector("#session-badge");
  const dashboardTitle = document.querySelector("#dashboard-title");
  const dashboardSubtitle = document.querySelector("#dashboard-subtitle");

  if (user) {
    sessionBadge.className = `badge provider-badge ${user.provider}`;
    sessionBadge.innerText = `Conectado via ${user.providerName} (@${user.username || user.name})`;
    const nameDisplay = user.name && user.name !== user.username ? `${user.name} (@${user.username})` : `@${user.username || user.name}`;
    dashboardTitle.innerText = `Olá, ${nameDisplay}!`;
    dashboardSubtitle.innerText = `Gerencie seus links sincronizados e acompanhe suas estatísticas de cliques.`;
  } else {
    sessionBadge.className = "badge badge-info";
    sessionBadge.innerText = "Modo Convidado (Armazenamento Local)";
    dashboardTitle.innerText = "Painel de Gerenciamento";
    dashboardSubtitle.innerText = "Acompanhe cliques, gerencie apelidos e controle seus links protegidos.";
  }
}

async function loadDashboardData() {
  try {
    const raw = localStorage.getItem("linklock_saved_custom_links");
    allLinks = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao carregar links:", e);
    allLinks = [];
  }

  // Preenche dados de cliques usando o tracker
  allLinks.forEach(link => {
    const slugKey = (link.slug || "").toLowerCase();
    const stats = window.clickTracker ? window.clickTracker.getLinkStats(slugKey) : { total: 0 };
    link.clicks = stats.total || link.clicks || 0;
  });

  renderStats();
  filterLinks();

  // Sincroniza contadores de cliques em tempo real direto do Supabase Nuvem
  if (window.supabaseDb && allLinks.length > 0) {
    try {
      let changed = false;
      for (const link of allLinks) {
        if (link.slug) {
          const remote = await window.supabaseDb.getLink(link.slug);
          if (remote && remote.clicks !== undefined) {
            const remoteClicks = Number(remote.clicks) || 0;
            if (remoteClicks !== link.clicks) {
              link.clicks = Math.max(remoteClicks, link.clicks || 0);
              changed = true;
            }
          }
        }
      }
      if (changed) {
        renderStats();
        filterLinks();
      }
    } catch (e) {
      console.warn("[Supabase] Erro ao sincronizar cliques com o painel:", e);
    }
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
    return slug.includes(query) || target.includes(query) || hint.includes(query);
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
          <span style="max-width: 260px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; color: var(--text-secondary);" title="${escapeHtml(targetUrl)}">
            ${escapeHtml(targetUrl)}
          </span>
        </td>
        <td>
          <span class="clicks-badge">
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

function saveEditedLink(e) {
  e.preventDefault();
  const originalSlug = document.querySelector("#edit-original-slug").value;
  const newSlug = document.querySelector("#edit-slug").value.trim();
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

  const index = allLinks.findIndex(l => (l.slug || "").toLowerCase() === originalSlug.toLowerCase());
  if (index === -1) return;

  // Atualiza os dados
  allLinks[index].slug = newSlug;
  allLinks[index].targetUrl = newTargetUrl;
  allLinks[index].hint = newHint;

  // Atualiza o fragmento no outputUrl se houver
  if (allLinks[index].outputUrl) {
    let url = allLinks[index].outputUrl;
    if (url.includes("#")) {
      const parts = url.split("#");
      const hash = parts[1];
      if (hash.includes("@")) {
        const payload = hash.slice(hash.indexOf("@") + 1);
        allLinks[index].outputUrl = `${parts[0]}#${encodeURIComponent(newSlug)}@${payload}`;
      }
    }
  }

  localStorage.setItem("linklock_saved_custom_links", JSON.stringify(allLinks));
  closeEditModal();
  showToast("Link atualizado com sucesso!");
  loadDashboardData();
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
  const targetText = slug ? `/#/${slug}` : "Link selecionado";
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

      // 2. Remove do localStorage local
      allLinks = allLinks.filter(l => (l.slug || "").toLowerCase() !== (slug || "").toLowerCase());
      localStorage.setItem("linklock_saved_custom_links", JSON.stringify(allLinks));

      // 3. Atualiza interface e estatísticas instantaneamente sem recarregar a página
      renderStats();
      filterLinks();
      showToast(`Link "/#/${slug}" excluído com sucesso.`);
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
    filename = `encurtador_links_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
    filename = `encurtador_links_${new Date().toISOString().slice(0, 10)}.csv`;
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
