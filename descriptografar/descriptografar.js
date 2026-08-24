/**
 * Shortener - Descriptografia de Links (descriptografar.js)
 * Suporte completo a URLs encurtadas, slugs personalizados, Supabase Nuvem e Base64
 */

// Seleciona e destaca o texto de um campo de entrada
function highlight(id) {
  const output = document.querySelector("#" + id);
  if (!output) return null;
  output.focus();
  output.select();
  output.setSelectionRange(0, output.value.length + 1);
  return output;
}

// Exibe mensagem de erro ou status
function showStatus(text, isError = true) {
  const statusBox = document.querySelector("#status-box");
  if (!statusBox) return;

  statusBox.style.display = "block";
  if (isError) {
    statusBox.innerHTML = `
      <div style="padding: 0.75rem 1rem; border-radius: var(--radius-md); background: var(--danger-bg); border: 1px solid var(--danger-border); color: #fda4af; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>${text}</span>
      </div>
    `;
  } else {
    statusBox.innerHTML = `
      <div style="padding: 0.75rem 1rem; border-radius: var(--radius-md); background: var(--success-bg); border: 1px solid var(--success-border); color: #6ee7b7; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${text}</span>
      </div>
    `;
  }
}

function hideStatus() {
  const statusBox = document.querySelector("#status-box");
  if (statusBox) statusBox.style.display = "none";
}

// Extrai o identificador ou dados do link a partir de qualquer formato inserido pelo usuário
function extractTargetFromInput(inputStr) {
  if (!inputStr) return "";
  let raw = String(inputStr).trim();

  // 1. Se for uma URL completa (ex: https://dougretrogames.github.io/shortener/meu-link ou https://.../#meu-link)
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const urlObj = new URL(raw);
      if (urlObj.hash) {
        let h = urlObj.hash.slice(1).trim().replace(/^\/+/, '');
        if (h) return decodeURIComponent(h);
      }
      if (urlObj.search) {
        const searchParams = new URLSearchParams(urlObj.search);
        if (searchParams.has("s")) return searchParams.get("s").trim();
        const rawSearch = urlObj.search.slice(1).replace(/^\/+/, '').trim();
        if (rawSearch && !rawSearch.includes("=")) return decodeURIComponent(rawSearch);
      }
      const segments = urlObj.pathname.split("/").filter(s => s && s.trim() !== "");
      const reserved = ["criar", "painel", "descriptografar", "index.html", "404.html", "shortener", "encurtador"];
      if (segments.length > 0) {
        const last = decodeURIComponent(segments[segments.length - 1]).trim();
        if (last && !reserved.includes(last.toLowerCase())) {
          return last;
        }
      }
    }
  } catch {}

  // 2. Se contiver fragmento hash direto (ex: #/meu-slug ou #meu-slug)
  if (raw.includes("#")) {
    const hashPart = raw.split("#")[1].replace(/^\/+/, '').trim();
    if (hashPart) return decodeURIComponent(hashPart);
  }

  // 3. Se for um caminho relativo (ex: /meu-slug)
  if (raw.startsWith("/")) {
    raw = raw.replace(/^\/+/, '');
  }

  return raw;
}

async function onDecrypt() {
  hideStatus();

  // Validação de bibliotecas
  if (!("b64" in window && "apiVersions" in window)) {
    showStatus("Bibliotecas essenciais não foram carregadas corretamente.", true);
    return;
  }

  const urlInput = document.querySelector("#encrypted-url");
  const rawInput = urlInput ? urlInput.value.trim() : "";
  if (!rawInput) {
    showStatus("Por favor, insira a URL criptografada ou o link encurtado.", true);
    if (urlInput) urlInput.focus();
    return;
  }

  const decryptBtn = document.querySelector("#decrypt-btn");
  const originalBtnHtml = decryptBtn ? decryptBtn.innerHTML : "";
  if (decryptBtn) {
    decryptBtn.disabled = true;
    decryptBtn.innerHTML = `
      <div style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span>Consultando e Decodificando...</span>
    `;
  }

  try {
    const rawTarget = extractTargetFromInput(rawInput);
    let params = null;
    let customSlug = null;

    // Caso 1: Suporte a formato composto: #meu-link@base64Data
    if (rawTarget.includes("@")) {
      const atIndex = rawTarget.indexOf("@");
      customSlug = decodeURIComponent(rawTarget.slice(0, atIndex));
      const payload = rawTarget.slice(atIndex + 1);
      try {
        params = JSON.parse(b64.decode(payload));
      } catch {}
    } 
    // Caso 2: Tentar decodificar direto como Base64 payload (ey... ou e3...)
    else if ((rawTarget.startsWith("ey") || rawTarget.startsWith("e3")) && /^[A-Za-z0-9+/=_-]+$/.test(rawTarget)) {
      try {
        const decoded = b64.decode(rawTarget);
        const parsed = JSON.parse(decoded);
        if (parsed && (parsed.v || parsed.e || parsed.open || parsed.u)) {
          params = parsed;
        }
      } catch {}
    }

    // Caso 3: Apelido curto / Slug personalizado (ex: meu-link ou 6x8qt) - busca no Supabase Nuvem e localStorage
    if (!params) {
      customSlug = decodeURIComponent(rawTarget).trim().toLowerCase().replace(/^[/#]+/, '');
      let entry = null;

      // 3.1 Consulta no Supabase Nuvem
      if (window.supabaseDb) {
        try {
          const remoteLink = await window.supabaseDb.getLink(customSlug);
          if (remoteLink && remoteLink.encrypted_data) {
            entry = remoteLink.encrypted_data;
          }
        } catch (e) {
          console.warn("[Supabase] Erro ao consultar link remoto:", e);
        }
      }

      // 3.2 Se não encontrado no Supabase, consulta o cache local (localStorage)
      if (!entry) {
        try {
          const localRaw = localStorage.getItem("linklock_saved_custom_links");
          if (localRaw) {
            const list = JSON.parse(localRaw);
            const found = list.find(l => l.slug && l.slug.toLowerCase() === customSlug);
            if (found) {
              if (found.encryptedData) {
                entry = found.encryptedData;
              } else if (found.targetUrl) {
                entry = { v: "0.0.1", open: true, u: found.targetUrl, h: found.hint };
              }
            }
          }
        } catch {}
      }

      if (entry) {
        if (typeof entry === "string") {
          try { params = JSON.parse(b64.decode(entry)); } catch {}
        } else {
          params = entry;
        }
      }
    }

    if (!params) {
      showStatus(`O link ou apelido "${escapeHtml(rawTarget)}" não foi encontrado no banco de dados.`, true);
      return;
    }

    // Valida se o link temporário de visitante expirou (30 dias)
    const expiresAt = params.expires_at || params.expiresAt;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      showStatus("Este link temporário de visitante expirou após 30 dias de validade. Para criar links permanentes sem expiração, conecte-se com sua conta no Shortener.", true);
      return;
    }

    // Caso o link possua uma dica de senha, exibe na tela
    if (params.h && typeof params.h === "string") {
      const hintMsg = `💡 Dica de senha: "${escapeHtml(params.h)}"`;
      const pwdInput = document.querySelector("#password");
      if (pwdInput && !pwdInput.placeholder.includes("Dica:")) {
        pwdInput.placeholder = `Dica: ${params.h}`;
      }
    }

    // Caso o link seja ABERTO (sem senha)
    if (params["open"] || params["u"] || (!("e" in params) && params["u"])) {
      const targetUrl = params["u"];
      try {
        const parsed = new URL(targetUrl);
        if (!(parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "magnet:")) {
          showStatus(`O link possui o protocolo não permitido "${parsed.protocol}". Por segurança, apenas links http://, https:// e magnet: são aceitos.`, true);
          return;
        }
      } catch {
        showStatus("A URL de destino é inválida ou malformatada.", true);
        return;
      }

      const outputField = document.querySelector("#output");
      const outputSection = document.querySelector("#output-section");
      const openBtn = document.querySelector("#open");

      if (outputField) outputField.value = targetUrl;
      if (openBtn) openBtn.href = targetUrl;
      if (outputSection) outputSection.style.display = "block";

      showStatus("✓ Link inspecionado com sucesso! (Este link foi criado sem senha)", false);
      
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
      return;
    }

    // Link PROTEGIDO POR SENHA
    if (!("v" in params && "e" in params)) {
      showStatus("Link corrompido. Parâmetros essenciais de decodificação estão ausentes.", true);
      return;
    }

    if (!(params["v"] in apiVersions)) {
      showStatus("Versão de API de criptografia não suportada.", true);
      return;
    }

    const passwordInput = document.querySelector("#password");
    const password = passwordInput ? passwordInput.value : "";
    if (!password) {
      let msg = "Por favor, digite a senha do link para descriptografar.";
      if (params.h) msg += ` (Dica: ${params.h})`;
      showStatus(msg, true);
      if (passwordInput) passwordInput.focus();
      return;
    }

    const api = apiVersions[params["v"]];
    const encrypted = b64.base64ToBinary(params["e"]);
    const salt = "s" in params ? b64.base64ToBinary(params["s"]) : null;
    const iv = "i" in params ? b64.base64ToBinary(params["i"]) : null;

    let decrypted;
    try {
      decrypted = await api.decrypt(encrypted, password, salt, iv);
    } catch {
      let errText = "Senha incorreta ou dados corrompidos. Verifique e tente novamente.";
      if (params.h) errText += ` (Dica: ${params.h})`;
      showStatus(errText, true);
      if (passwordInput) passwordInput.focus();
      return;
    }

    // Validação de segurança da URL descriptografada
    try {
      const parsed = new URL(decrypted);
      if (!(parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "magnet:")) {
        showStatus(`O link descriptografado utiliza o protocolo "${parsed.protocol}", que não é permitido por segurança.`, true);
        return;
      }
    } catch {
      showStatus("A URL descriptografada é inválida ou não pôde ser interpretada como um endereço web seguro.", true);
      return;
    }

    // Exibe o resultado descriptografado com sucesso
    const outputField = document.querySelector("#output");
    if (outputField) outputField.value = decrypted;

    const outputSection = document.querySelector("#output-section");
    if (outputSection) outputSection.style.display = "block";

    const openBtn = document.querySelector("#open");
    if (openBtn) openBtn.href = decrypted;

    showStatus("✓ Link descriptografado com sucesso!", false);

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  } catch (err) {
    console.error("[Descriptografar] Erro:", err);
    showStatus("Ocorreu um erro ao processar o link. Verifique o endereço digitado.", true);
  } finally {
    if (decryptBtn) {
      decryptBtn.disabled = false;
      decryptBtn.innerHTML = originalBtnHtml;
    }
  }
}

// Copiar texto para a área de transferência
async function onCopy(id) {
  const output = highlight(id);
  if (!output) return;

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(output.value);
  } else {
    document.execCommand("copy");
  }

  const alertToast = document.querySelector("#copy-toast");
  const toastMsg = document.querySelector("#toast-msg");
  if (toastMsg) {
    toastMsg.innerText = `URL copiada com sucesso! (${output.value.length} caracteres)`;
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

function main() {
  if (window.location.hash) {
    const raw = window.location.hash.slice(1);
    document.querySelector("#encrypted-url").value = raw;
    document.querySelector("#password").focus();
  }
}

