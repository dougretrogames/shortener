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

function loadDashboardData() {
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
            <button class="btn btn-secondary btn-sm" onclick="copyLink('${escapeHtml(link.outputUrl)}')" title="Copiar Link Criptografado">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <a href="${escapeHtml(link.outputUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="Testar / Abrir Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('${escapeHtml(slug)}')" title="Editar Apelido ou Dados">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteLink('${escapeHtml(slug)}')" title="Excluir Link">
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
    statusEl.innerHTML = `⚠️ O apelido "${newSlug}" já está em uso por outro link.`;
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

function deleteLink(slug) {
  if (!confirm(`Deseja realmente excluir o link "${slug}" do seu painel?`)) return;

  allLinks = allLinks.filter(l => (l.slug || "").toLowerCase() !== slug.toLowerCase());
  localStorage.setItem("linklock_saved_custom_links", JSON.stringify(allLinks));
  showToast(`Link "${slug}" removido com sucesso.`);
  loadDashboardData();
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
      `"${(l.slug || '').replace(/"/g, '""')}"`,
      `"${(l.targetUrl || '').replace(/"/g, '""')}"`,
      l.clicks || 0,
      `"${(l.hint || '').replace(/"/g, '""')}"`,
      `"${l.createdAt || ''}"`,
      `"${(l.outputUrl || '').replace(/"/g, '""')}"`
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
