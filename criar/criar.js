/**
 * Encurtador de Links - Gerador de Links Criptografados e Personalizados (create.js)
 * Traduzido e modernizado para Português do Brasil com Verificação de Duplicidade
 */

var CRIAR_STORAGE_KEY = "linklock_saved_custom_links";

// Obtém os links salvos do LocalStorage
function getSavedLinks() {
  try {
    const raw = localStorage.getItem(CRIAR_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao acessar LocalStorage:", e);
    return [];
  }
}

// Salva ou atualiza um link no histórico
function saveToHistory(linkItem) {
  try {
    const links = getSavedLinks();
    const existingIndex = links.findIndex(l => l.slug && l.slug.toLowerCase() === linkItem.slug.toLowerCase());
    
    if (existingIndex >= 0) {
      links[existingIndex] = linkItem;
    } else {
      links.unshift(linkItem);
    }
    
    localStorage.setItem(CRIAR_STORAGE_KEY, JSON.stringify(links));
    renderHistory();
  } catch (e) {
    console.error("Erro ao salvar no LocalStorage:", e);
  }
}

// Abre a tela modal moderna de confirmação de exclusão permanente
function openDeleteModal(slug, onConfirm, customTitle, customMsg) {
  let modal = document.querySelector("#confirm-delete-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "confirm-delete-modal";
    modal.className = "modal-backdrop";
    document.body.appendChild(modal);
  }

  const title = customTitle || "Confirmar Exclusão Permanente";
  const targetText = slug ? `/#/${slug}` : "Todos os links salvos";
  const msg = customMsg || `Atenção: Este link será <strong>excluído permanentemente</strong> do sistema e <strong>não poderá ser recuperado</strong>. O identificador será liberado para novos cadastros.`;

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

// Remove um link do histórico com tela de confirmação e libera o apelido
function deleteHistoryItem(slug) {
  openDeleteModal(slug, async () => {
    try {
      // 1. Exclui do banco de dados na nuvem Supabase
      if (window.supabaseDb && slug) {
        await window.supabaseDb.deleteLink(slug);
      }

      // 2. Remove do localStorage local
      let links = getSavedLinks();
      links = links.filter(l => (l.slug || "").toLowerCase() !== (slug || "").toLowerCase());
      localStorage.setItem(CRIAR_STORAGE_KEY, JSON.stringify(links));

      // 3. Atualiza a interface e reavalia a disponibilidade na hora
      renderHistory();
      checkSlugAvailability();

      const alertToast = document.querySelector(".alert-toast");
      const toastMsg = document.querySelector("#toast-msg");
      if (toastMsg) toastMsg.innerText = `Link "/#/${slug}" excluído com sucesso!`;
      if (alertToast) {
        alertToast.classList.add("visible");
        setTimeout(() => alertToast.classList.remove("visible"), 3000);
      }
    } catch (e) {
      console.error("Erro ao remover item:", e);
    }
  });
}

// Limpa todo o histórico de links salvos com tela de confirmação e libera todos os apelidos
function clearAllHistory() {
  openDeleteModal(null, async () => {
    try {
      const links = getSavedLinks();
      // Exclui todos os links do Supabase
      if (window.supabaseDb && links.length > 0) {
        for (const l of links) {
          if (l.slug) await window.supabaseDb.deleteLink(l.slug);
        }
      }

      localStorage.removeItem(CRIAR_STORAGE_KEY);
      renderHistory();
      checkSlugAvailability();

      const alertToast = document.querySelector(".alert-toast");
      const toastMsg = document.querySelector("#toast-msg");
      if (toastMsg) toastMsg.innerText = `Todo o histórico de links foi limpo com sucesso!`;
      if (alertToast) {
        alertToast.classList.add("visible");
        setTimeout(() => alertToast.classList.remove("visible"), 3000);
      }
    } catch (e) {
      console.error("Erro ao limpar histórico:", e);
    }
  }, "Limpar Todo o Histórico", "Tem certeza de que deseja apagar todos os links salvos? Todos os apelidos serão liberados e essa ação não pode ser desfeita.");
}

// Formata data ISO para formato legível em PT-BR
function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

// Renderiza a lista de histórico na interface
function renderHistory() {
  const listEl = document.querySelector("#history-list");
  const emptyEl = document.querySelector("#history-empty");
  const clearBtn = document.querySelector("#clear-history-btn");
  if (!listEl || !emptyEl) return;

  const links = getSavedLinks();

  if (links.length === 0) {
    emptyEl.style.display = "block";
    listEl.innerHTML = "";
    if (clearBtn) clearBtn.style.display = "none";
    return;
  }

  emptyEl.style.display = "none";
  if (clearBtn) clearBtn.style.display = "inline-flex";

  listEl.innerHTML = links.map(item => `
    <div class="history-item">
      <div class="history-info">
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span class="history-slug">/#${escapeHtml(item.slug || 'link')}</span>
          ${item.hint ? `<span class="badge" style="background: rgba(99,102,241,0.15); color: #a5b4fc; font-size: 0.7rem;">Dica: ${escapeHtml(item.hint)}</span>` : ''}
        </div>
        <span class="history-target" title="${escapeHtml(item.targetUrl)}">Destino: ${escapeHtml(item.targetUrl)}</span>
        <span class="history-date">Criado em: ${formatDate(item.createdAt)}</span>
      </div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm" onclick="copyDirectText(decodeURIComponent('${encodeURIComponent(item.outputUrl || '')}'))">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copiar
        </button>
        <a href="${escapeHtml(item.outputUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          Testar
        </a>
        <button class="btn btn-danger btn-sm" onclick="deleteHistoryItem(decodeURIComponent('${encodeURIComponent(item.slug || '')}'))">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join("");
}

function initHistory() {
  renderHistory();
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJsString(text) {
  if (!text) return "";
  return String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Normaliza o apelido (slug) digitado pelo usuário
function normalizeSlug(str) {
  if (!str) return "";
  return str.trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[@#?&/\\:]+/g, "")
    .toLowerCase();
}

// Obtém o conjunto de TODOS os links existentes (Supabase Nuvem como autoridade principal)
async function getAllExistingSlugs() {
  const slugSet = new Set();

  // 1. Supabase (Nuvem em tempo real - Fonte Única de Verdade)
  if (window.supabaseDb) {
    try {
      const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?select=slug`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: window.supabaseDb.getHeaders()
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          rows.forEach(r => {
            if (r.slug) slugSet.add(r.slug.toLowerCase());
          });
          // O Supabase é a autoridade máxima mundial:
          return slugSet;
        }
      }
    } catch (e) {
      console.warn("[Supabase] Erro ao carregar slugs remotos:", e);
    }
  }

  // 2. Fallback apenas se o Supabase estiver offline
  const localLinks = getSavedLinks();
  localLinks.forEach(l => {
    if (l.slug) slugSet.add(l.slug.toLowerCase());
  });

  return slugSet;
}

// Verifica disponibilidade de apelido personalizado em tempo real (consulta global)
async function checkSlugAvailability() {
  const slugInput = document.querySelector("#custom-slug");
  const statusEl = document.querySelector("#slug-status");
  if (!slugInput || !statusEl) return;

  const rawVal = slugInput.value.trim();
  if (!rawVal) {
    statusEl.style.display = "none";
    statusEl.innerHTML = "";
    return;
  }

  const cleanSlug = normalizeSlug(rawVal);
  const existingSlugs = await getAllExistingSlugs();
  const isTaken = existingSlugs.has(cleanSlug.toLowerCase());

  statusEl.style.display = "flex";
  if (isTaken) {
    statusEl.className = "slug-status exists";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>O apelido <strong>"${escapeHtml(cleanSlug)}"</strong> já está em uso por outro link cadastrado. Escolha outro nome.</span>
    `;
  } else {
    statusEl.className = "slug-status available";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Apelido <strong>"${escapeHtml(cleanSlug)}"</strong> disponível para uso!</span>
    `;
  }
}

// Alfabeto seguro para geração de links automáticos de 5 dígitos:
// - Letras maiúsculas sem 'I' (25 caracteres)
// - Letras minúsculas sem 'l' (25 caracteres)
// - Números 0-9 (10 caracteres)
// Total = 60 caracteres possíveis
const SAFE_SLUG_CHARS = "ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";

// Gera um identificador aleatório único de 5 dígitos sem repetição de caracteres dentro do código,
// e que NUNCA tenha sido utilizado por NENHUM usuário no sistema (db.json global ou local).
async function generateUniqueSlug() {
  const existingSlugs = await getAllExistingSlugs();

  for (let attempt = 0; attempt < 5000; attempt++) {
    const chars = SAFE_SLUG_CHARS.split("");
    let slug = "";

    // Usa criptografia segura WebCrypto para aleatoriedade
    const randomBuffer = new Uint32Array(5);
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(randomBuffer);
    } else {
      for (let j = 0; j < 5; j++) randomBuffer[j] = Math.floor(Math.random() * 0xFFFFFFFF);
    }

    for (let i = 0; i < 5; i++) {
      const idx = randomBuffer[i] % chars.length;
      slug += chars[idx];
      chars.splice(idx, 1); // Garante que nenhum caractere se repita dentro do mesmo código
    }

    // Garante que o slug gerado é 100% inédito em todos os links já criados
    if (!existingSlugs.has(slug.toLowerCase())) {
      return slug;
    }
  }

  return "lk" + Math.random().toString(36).substring(2, 5);
}

// Seleciona e destaca o texto de um campo de entrada
function highlight(id) {
  let output = document.querySelector("#" + id);
  output.focus();
  output.select();
  output.setSelectionRange(0, output.value.length + 1);
  return output;
}

// Valida e formata a URL e campos obrigatórios do formulário
function validateInputs() {
  const urlInput = document.querySelector("#url");
  if (!urlInput) return false;

  let rawUrl = (urlInput.value || "").trim();
  if (!rawUrl) {
    alert("Por favor, insira o link de destino que deseja encurtar ou proteger.");
    urlInput.focus();
    return false;
  }

  // Se o usuário não digitou o protocolo (ex: google.com), adiciona https://
  if (!/^[a-zA-Z]+:\/\//.test(rawUrl) && !rawUrl.startsWith("magnet:")) {
    rawUrl = "https://" + rawUrl;
    urlInput.value = rawUrl;
  }

  let urlObj;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    alert("Por favor, insira uma URL válida (ex: https://exemplo.com)");
    urlInput.focus();
    return false;
  }

  // Permite apenas protocolos seguros para evitar ataques XSS
  if (!(urlObj.protocol === "http:" || urlObj.protocol === "https:" || urlObj.protocol === "magnet:")) {
    alert(`O link utiliza o protocolo "${urlObj.protocol}", que não é permitido por segurança. Use http://, https:// ou magnet:`);
    urlInput.focus();
    return false;
  }

  return true;
}

// Executa a criptografia AES-GCM (ou empacota link direto se sem senha) e retorna o objeto codificado em Base64
async function generateFragment(url, passwd, hint, useRandomSalt, useRandomIv) {
  // Se não foi informada senha, cria link direto aberto
  if (!passwd || passwd.trim() === "") {
    const output = {
      v: LATEST_API_VERSION,
      open: true,
      u: url
    };
    if (hint && hint.trim() !== "") {
      output["h"] = hint.trim();
    }
    return b64.encode(JSON.stringify(output));
  }

  const api = apiVersions[LATEST_API_VERSION];

  const salt = useRandomSalt ? await api.randomSalt() : null;
  const iv = useRandomIv ? await api.randomIv() : null;
  const encrypted = await api.encrypt(url, passwd, salt, iv);
  
  const output = {
    v: LATEST_API_VERSION,
    e: b64.binaryToBase64(new Uint8Array(encrypted))
  };

  // Adiciona dica caso informada
  if (hint && hint.trim() !== "") {
    output["h"] = hint.trim();
  }

  // Adiciona salt e/ou IV se foram gerados aleatoriamente
  if (useRandomSalt) {
    output["s"] = b64.binaryToBase64(salt);
  }
  if (useRandomIv) {
    output["i"] = b64.binaryToBase64(iv);
  }

  // Retorna a string final codificada em base64
  return b64.encode(JSON.stringify(output));
}

// Disparado ao clicar no botão "Gerar Link Encurtado"
async function onEncrypt() {
  const encryptBtn = document.querySelector("#encrypt");
  const originalBtnHtml = encryptBtn ? encryptBtn.innerHTML : "Gerar Link Encurtado";

  try {
    if (!validateInputs()) {
      return;
    }

    // Validação de confirmação de senha apenas se informada
    const passwordInput = document.querySelector("#password");
    const confirmPasswordInput = document.querySelector("#confirm-password");
    
    if (passwordInput && confirmPasswordInput && passwordInput.value) {
      if (passwordInput.value !== confirmPasswordInput.value) {
        alert("As senhas não coincidem. Digite a mesma senha em ambos os campos de confirmação.");
        confirmPasswordInput.focus();
        return;
      }
    }

    if (encryptBtn) {
      encryptBtn.disabled = true;
      encryptBtn.innerHTML = `
        <div style="display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
        <span>Gerando Link...</span>
      `;
    }

    // Parâmetros de criptografia
    const url = document.querySelector("#url").value.trim();
    const ivCheckbox = document.querySelector("#iv");
    const saltCheckbox = document.querySelector("#salt");
    const useRandomIv = ivCheckbox ? ivCheckbox.checked : true;
    const useRandomSalt = saltCheckbox ? saltCheckbox.checked : true;
    const hint = document.querySelector("#hint") ? document.querySelector("#hint").value.trim() : "";
    const rawSlug = document.querySelector("#custom-slug") ? document.querySelector("#custom-slug").value.trim() : "";
    let customSlug = normalizeSlug(rawSlug);

    const existingSlugs = await getAllExistingSlugs();

    // Se o usuário digitou um apelido, garante que ele não existe no sistema global/local
    if (customSlug) {
      if (existingSlugs.has(customSlug.toLowerCase())) {
        alert(`O apelido "/#/${customSlug}" já está em uso por outro link no sistema. Por favor, escolha um nome diferente.`);
        const slugInput = document.querySelector("#custom-slug");
        if (slugInput) slugInput.focus();
        if (encryptBtn) {
          encryptBtn.disabled = false;
          encryptBtn.innerHTML = originalBtnHtml;
        }
        return;
      }
    } else {
      // Se não digitou, gera automaticamente o código único de 5 dígitos sem repetição
      customSlug = await generateUniqueSlug();
    }

    const encrypted = await generateFragment(url, passwordInput ? passwordInput.value : "", hint, useRandomSalt, useRandomIv);
    
    // Constrói a URL de forma dinâmica considerando o domínio e caminho atual
    const baseUrl = new URL('../', window.location.href).href;
    
    const shortUrl = `${baseUrl}#/${encodeURIComponent(customSlug)}`;
    const autonomousUrl = `${baseUrl}#/${encodeURIComponent(customSlug)}@${encrypted}`;
    const outputUrl = shortUrl; // Link curto e limpo no formato /#/slug
    const rawHash = customSlug;

    const outputField = document.querySelector("#output");
    if (outputField) {
      outputField.value = outputUrl;
    }

    let parsedEncrypted = null;
    try {
      parsedEncrypted = JSON.parse(b64.decode(encrypted));
    } catch {}
    
    // Salva no Supabase Nuvem (visível e ativo para qualquer pessoa no planeta em 50ms)
    if (window.supabaseDb && customSlug) {
      try {
        await window.supabaseDb.saveLink({
          slug: customSlug,
          encryptedData: parsedEncrypted,
          hint: hint,
          targetUrl: url
        });
      } catch (e) {
        console.warn("[Supabase] Erro ao salvar na nuvem:", e);
      }
    }

    // Salva no histórico de links personalizados se houver apelido ou link criado
    if (customSlug || url) {
      saveToHistory({
        slug: customSlug || "link-" + Math.random().toString(36).substring(2, 7),
        outputUrl: outputUrl,
        shortUrl: shortUrl || outputUrl,
        autonomousUrl: autonomousUrl || outputUrl,
        targetUrl: url,
        hint: hint,
        encryptedData: parsedEncrypted,
        createdAt: new Date().toISOString()
      });
    }

    // Exibe a seção de saída
    const outputSection = document.querySelector("#output-section");
    if (outputSection) {
      outputSection.style.display = "block";
    }

    const slugDbInfo = document.querySelector("#slug-db-info");
    if (slugDbInfo) {
      slugDbInfo.style.display = customSlug ? "block" : "none";
    }

    // Ajusta o link de "Favorito Oculto"
    const bookmarkLink = document.querySelector("#bookmark");
    if (bookmarkLink) {
      const hiddenBaseUrl = new URL('../favoritos-ocultos/', window.location.href).href;
      bookmarkLink.href = `${hiddenBaseUrl}#${rawHash}`;
    }

    // Ajusta o link de "Testar Link"
    const openLink = document.querySelector("#open");
    if (openLink) {
      openLink.href = outputUrl;
    }

    setTimeout(() => {
      try { highlight("output"); } catch (e) {}
    }, 50);

    if (encryptBtn) {
      encryptBtn.disabled = false;
      encryptBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Link Gerado com Sucesso!</span>
      `;
      setTimeout(() => {
        if (encryptBtn) encryptBtn.innerHTML = originalBtnHtml;
      }, 3000);
    }

    // Rolagem suave até a área de resultado
    window.scrollTo({
      top: outputSection ? outputSection.offsetTop - 80 : document.body.scrollHeight,
      behavior: "smooth",
    });
  } catch (err) {
    console.error("Erro ao gerar link:", err);
    alert("Ocorreu um erro ao gerar o link: " + (err.message || err));
    if (encryptBtn) {
      encryptBtn.disabled = false;
      encryptBtn.innerHTML = originalBtnHtml;
    }
  }
}

// Disparado ao clicar em "Copiar Link"
async function onCopy(id) {
  const output = highlight(id);
  
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(output.value);
  } else {
    document.execCommand("copy");
  }

  // Feedback visual com toast
  const alertToast = document.querySelector(".alert-toast");
  const toastMsg = document.querySelector("#toast-msg");
  if (toastMsg) {
    toastMsg.innerText = `Link copiado com sucesso! (${output.value.length} caracteres)`;
  }
  
  if (alertToast) {
    alertToast.classList.add("visible");
    setTimeout(() => {
      alertToast.classList.remove("visible");
    }, 3500);
  }

  output.selectionEnd = output.selectionStart;
  output.blur();
}

// Copiar texto direto a partir dos botões do histórico
async function copyDirectText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
  }

  const alertToast = document.querySelector(".alert-toast");
  const toastMsg = document.querySelector("#toast-msg");
  if (toastMsg) {
    toastMsg.innerText = "Link copiado para a área de transferência!";
  }
  if (alertToast) {
    alertToast.classList.add("visible");
    setTimeout(() => {
      alertToast.classList.remove("visible");
    }, 3000);
  }
}


// Aviso de segurança ao tentar desativar o IV aleatório
function onIvCheck(checkbox) {
  if (!checkbox.checked) {
    checkbox.checked = !confirm(
      "Aviso de Segurança:\n\n" +
      "Apenas desative a randomização do Vetor de Inicialização (IV) se tiver certeza absoluta do que está fazendo.\n\n" +
      "Desativar este recurso compromete a segurança criptográfica dos links gerados e economiza apenas de 20 a 25 caracteres no tamanho da URL.\n\n" +
      "Clique em 'Cancelar' para manter a proteção máxima ativada."
    );
  }
}

// Inicialização automática de listeners e atalho Enter
function initCreatePage() {
  initHistory();

  const encryptBtn = document.querySelector("#encrypt");
  if (encryptBtn) {
    encryptBtn.onclick = onEncrypt;
  }

  const urlInput = document.querySelector("#url");
  if (urlInput) {
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onEncrypt();
      }
    });
  }

  const pwdInput = document.querySelector("#password");
  if (pwdInput) {
    pwdInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onEncrypt();
      }
    });
  }

  const confirmInput = document.querySelector("#confirm-password");
  if (confirmInput) {
    confirmInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onEncrypt();
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCreatePage);
} else {
  initCreatePage();
}
