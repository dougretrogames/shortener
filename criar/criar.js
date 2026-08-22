/**
 * Encurtador de Links - Gerador de Links Criptografados e Personalizados (create.js)
 * Traduzido e modernizado para Português do Brasil com Verificação de Duplicidade
 */

const STORAGE_KEY = "linklock_saved_custom_links";

// Obtém os links salvos do LocalStorage
function getSavedLinks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    renderHistory();
  } catch (e) {
    console.error("Erro ao salvar no LocalStorage:", e);
  }
}

// Remove um link do histórico
function deleteHistoryItem(slug) {
  if (!confirm(`Deseja realmente remover o link com apelido "${slug}" do seu histórico local?`)) {
    return;
  }
  try {
    let links = getSavedLinks();
    links = links.filter(l => l.slug !== slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
    renderHistory();
    checkSlugAvailability();
  } catch (e) {
    console.error("Erro ao remover item:", e);
  }
}

// Limpa todo o histórico de links salvos
function clearAllHistory() {
  if (!confirm("Tem certeza de que deseja limpar todos os links salvos do seu histórico local?")) {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    checkSlugAvailability();
  } catch (e) {
    console.error("Erro ao limpar histórico:", e);
  }
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

// Verifica disponibilidade de apelido personalizado em tempo real
function checkSlugAvailability() {
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
  const links = getSavedLinks();
  const existing = links.find(l => l.slug && l.slug.toLowerCase() === cleanSlug);

  statusEl.style.display = "flex";
  if (existing) {
    statusEl.className = "slug-status exists";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>Aviso: O apelido <strong>"${escapeHtml(cleanSlug)}"</strong> já foi criado anteriormente (${formatDate(existing.createdAt)}). Salvar novamente irá atualizá-lo.</span>
    `;
  } else {
    statusEl.className = "slug-status available";
    statusEl.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      <span>Apelido <strong>"${escapeHtml(cleanSlug)}"</strong> disponível!</span>
    `;
  }
}

// Seleciona e destaca o texto de um campo de entrada
function highlight(id) {
  let output = document.querySelector("#" + id);
  output.focus();
  output.select();
  output.setSelectionRange(0, output.value.length + 1);
  return output;
}

// Valida todos os campos obrigatórios do formulário
function validateInputs() {
  const inputs = document.querySelectorAll(".form .labeled-input input");
  for (let i = 0; i < inputs.length; i++) {
    let input = inputs[i];
    input.reportValidity = input.reportValidity || (() => true);
    if (!input.reportValidity()) {
      return false;
    }
  }

  const url = document.querySelector("#url");
  let urlObj;
  try {
    urlObj = new URL(url.value);
  } catch {
    if (!("reportValidity" in url)) {
      alert("URL inválida. Certifique-se de incluir 'http://', 'https://' ou 'magnet:' no início.");
    }
    url.setCustomValidity("Por favor, insira uma URL válida iniciando com http://, https:// ou magnet:");
    url.reportValidity();
    return false;
  }

  // Permite apenas protocolos seguros para evitar ataques XSS
  if (!(urlObj.protocol === "http:" || urlObj.protocol === "https:" || urlObj.protocol === "magnet:")) {
    url.setCustomValidity(`O link utiliza um protocolo não seguro ou não permitido (${urlObj.protocol}).`);
    url.reportValidity();
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
  if (!validateInputs()) {
    return;
  }

  // Validação de confirmação de senha apenas se informada
  const passwordInput = document.querySelector("#password");
  const confirmPasswordInput = document.querySelector("#confirm-password");
  
  if (passwordInput.value && passwordInput.value !== confirmPasswordInput.value) {
    confirmPasswordInput.setCustomValidity("As senhas não coincidem. Digite a mesma senha em ambos os campos.");
    confirmPasswordInput.reportValidity();
    return;
  }

  // Parâmetros de criptografia
  const url = document.querySelector("#url").value.trim();
  const useRandomIv = document.querySelector("#iv").checked;
  const useRandomSalt = document.querySelector("#salt").checked;
  const hint = document.querySelector("#hint").value.trim();
  const rawSlug = document.querySelector("#custom-slug").value.trim();
  const customSlug = normalizeSlug(rawSlug);

  const encrypted = await generateFragment(url, passwordInput.value, hint, useRandomSalt, useRandomIv);
  
  // Constrói a URL de forma dinâmica considerando o domínio e caminho atual
  const baseUrl = new URL('../', window.location.href).href;
  
  // Se houver apelido personalizado, anexa formato #slug@encrypted
  let outputUrl = "";
  let rawHash = "";
  if (customSlug) {
    rawHash = `${encodeURIComponent(customSlug)}@${encrypted}`;
    outputUrl = `${baseUrl}#${rawHash}`;
  } else {
    rawHash = encrypted;
    outputUrl = `${baseUrl}#${rawHash}`;
  }

  const outputField = document.querySelector("#output");
  outputField.value = outputUrl;
  
  // Salva no histórico de links personalizados se houver apelido ou link criado
  if (customSlug || url) {
    saveToHistory({
      slug: customSlug || "link-" + Math.random().toString(36).substring(2, 7),
      outputUrl: outputUrl,
      targetUrl: url,
      hint: hint,
      createdAt: new Date().toISOString()
    });
  }

  // Exibe a seção de saída
  const outputSection = document.querySelector("#output-section");
  if (outputSection) {
    outputSection.style.display = "block";
  }

  highlight("output");

  // Ajusta o link de "Favorito Oculto"
  const hiddenBaseUrl = new URL('../favoritos-ocultos/', window.location.href).href;
  const bookmarkLink = document.querySelector("#bookmark");
  if (bookmarkLink) {
    bookmarkLink.href = `${hiddenBaseUrl}#${rawHash}`;
  }

  // Ajusta o link de "Testar Link"
  const openLink = document.querySelector("#open");
  if (openLink) {
    openLink.href = outputUrl;
  }

  // Rolagem suave até a área de resultado
  window.scrollTo({
    top: outputSection ? outputSection.offsetTop - 80 : document.body.scrollHeight,
    behavior: "smooth",
  });
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
