function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function error(text) {
  const formEl = document.querySelector(".form");
  if (formEl) formEl.style.display = "none";
  
  const errorEl = document.querySelector(".error");
  if (errorEl) errorEl.style.display = "block";
  
  const errorTextEl = document.querySelector("#errortext");
  if (errorTextEl) errorTextEl.innerText = text;
}

// Executado quando o <body> é carregado
async function main() {
  if (window.location.hash) {
    const formEl = document.querySelector(".form");
    if (formEl) formEl.style.display = "block";
    
    const pwdInput = document.querySelector("#password");
    if (pwdInput) {
      pwdInput.value = "";
      pwdInput.focus();
    }
    
    const errorEl = document.querySelector(".error");
    if (errorEl) errorEl.style.display = "none";
    
    const errorTextEl = document.querySelector("#errortext");
    if (errorTextEl) errorTextEl.innerText = "";

    // Valida se as bibliotecas necessárias foram carregadas
    if (!("b64" in window)) {
      error("Biblioteca Base64 não foi carregada.");
      return;
    }
    if (!("apiVersions" in window)) {
      error("Biblioteca de criptografia da API não foi carregada.");
      return;
    }

    // Tenta obter os parâmetros codificados no fragmento da URL (suporta #/slug e #slug)
    let rawHash = window.location.hash.slice(1);
    if (rawHash.startsWith("/")) {
      rawHash = rawHash.replace(/^\/+/, '');
    }
    let payload = rawHash;
    let customSlug = null;
    let params = null;

    // Caso 1: Suporte a formato composto: #meu-link@base64Data
    if (rawHash.includes("@")) {
      const atIndex = rawHash.indexOf("@");
      customSlug = decodeURIComponent(rawHash.slice(0, atIndex));
      payload = rawHash.slice(atIndex + 1);
      try {
        params = JSON.parse(b64.decode(payload));
      } catch {}
    } else if ((rawHash.startsWith("ey") || rawHash.startsWith("e3")) && /^[A-Za-z0-9+/=_-]+$/.test(rawHash)) {
      // Caso 2: Tentar decodificar direto como Base64 payload apenas se tiver formato Base64
      try {
        const decoded = b64.decode(rawHash);
        const parsed = JSON.parse(decoded);
        if (parsed && (parsed.v || parsed.e || parsed.open || parsed.u)) {
          params = parsed;
        }
      } catch {}
    }

    // Caso 3: Apelido curto limpo (ex: #retrogamebox-vip) - busca no db.json e no localStorage
    if (!params) {
      customSlug = decodeURIComponent(rawHash).trim();
      const slugKey = customSlug.toLowerCase();

      // Busca no banco de dados db.json do repositório
      let db = {};
      try {
        const dbRes = await fetch('./db.json?t=' + Date.now(), { cache: 'no-store' });
        if (dbRes.ok) {
          db = await dbRes.json();
        }
      } catch (e) {
        console.warn("db.json não pôde ser carregado:", e);
      }

      let entry = db[slugKey] || db[customSlug];

      // Se não encontrou no db.json, procura no histórico local (localStorage)
      if (!entry) {
        try {
          const localRaw = localStorage.getItem("linklock_saved_custom_links");
          if (localRaw) {
            const list = JSON.parse(localRaw);
            const found = list.find(l => (l.slug && l.slug.toLowerCase() === slugKey));
            if (found) {
              if (found.encryptedData) {
                entry = found.encryptedData;
              } else if (found.autonomousUrl && found.autonomousUrl.includes("@")) {
                const atIdx = found.autonomousUrl.indexOf("@");
                const b64Part = found.autonomousUrl.slice(atIdx + 1);
                entry = JSON.parse(b64.decode(b64Part));
              } else if (found.outputUrl && found.outputUrl.includes("@")) {
                const atIdx = found.outputUrl.indexOf("@");
                const b64Part = found.outputUrl.slice(atIdx + 1);
                entry = JSON.parse(b64.decode(b64Part));
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
      error(`O link encurtado "#${escapeHtml(rawHash)}" não foi encontrado no banco de dados.`);
      return;
    }

    // Exibe o badge de link personalizado se houver
    const slugContainer = document.querySelector("#custom-slug-container");
    const slugText = document.querySelector("#custom-slug-text");
    if (customSlug && slugContainer && slugText) {
      slugText.innerText = customSlug;
      slugContainer.style.display = "block";
    } else if (slugContainer) {
      slugContainer.style.display = "none";
    }

    // Suporte a links diretos encurtados sem senha
    if (params["open"] || params["u"] || (!("e" in params) && params["u"])) {
      const targetUrl = params["u"];
      try {
        const urlObj = new URL(targetUrl);
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:" || urlObj.protocol === "magnet:") {
          // Registra clique no tracker
          if (window.clickTracker) {
            window.clickTracker.recordClick(customSlug || rawHash);
          }

          // Exibe status visual de redirecionamento imediato
          if (formEl) {
            formEl.innerHTML = `
              <div style="text-align: center; padding: 2rem 1rem;">
                <div style="display: inline-block; width: 44px; height: 44px; border: 3px solid rgba(56,189,248,0.2); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem;"></div>
                <h3 style="margin-bottom: 0.5rem; font-size: 1.15rem;">Redirecionando...</h3>
                <p style="color: var(--text-muted); font-size: 0.88rem;">Você será encaminhado para o destino em instantes.</p>
              </div>
            `;
            formEl.style.display = "block";
          }
          window.location.href = targetUrl;
          return;
        }
      } catch (e) {
        error("A URL de destino é inválida.");
        return;
      }
    }

    // Verifica se os parâmetros essenciais estão presentes para links criptografados
    if (!("v" in params && "e" in params)) {
      error("O link está corrompido. Parâmetros essenciais de decodificação estão ausentes.");
      return;
    }

    // Verifica suporte à versão da API
    if (!(params["v"] in apiVersions)) {
      error("Versão de API não suportada. O link pode ter sido gerado com uma versão diferente.");
      return;
    }

    const api = apiVersions[params["v"]];

    // Obtém os dados binários para descriptografia
    const encrypted = b64.base64ToBinary(params["e"]);
    const salt = "s" in params ? b64.base64ToBinary(params["s"]) : null;
    const iv = "i" in params ? b64.base64ToBinary(params["i"]) : null;

    const hintContainer = document.querySelector("#hint-container");
    const hintEl = document.querySelector("#hint");
    if ("h" in params && params["h"]) {
      if (hintEl) hintEl.innerText = "Dica: " + params["h"];
      if (hintContainer) hintContainer.style.display = "block";
    } else {
      if (hintContainer) hintContainer.style.display = "none";
    }

    const unlockButton = document.querySelector("#unlockbutton");
    const passwordPrompt = document.querySelector("#password");

    // Remove listeners antigos se houver e adiciona novos
    const handleKeypress = (e) => {
      if (e.key === "Enter") {
        unlockButton.click();
      }
    };
    passwordPrompt.onkeypress = handleKeypress;

    unlockButton.onclick = async () => {
      const password = passwordPrompt.value;
      if (!password) {
        passwordPrompt.focus();
        return;
      }

      // Descriptografa e redireciona se a senha estiver correta
      let url;
      try {
        url = await api.decrypt(encrypted, password, salt, iv);
      } catch {
        // Senha incorreta
        error("Senha incorreta. Verifique a digitação e tente novamente.");

        // Atualiza links de ajuda para a mesma hash
        const noRedirect = document.querySelector("#no-redirect");
        if (noRedirect) {
          noRedirect.href = `./descriptografar/#${rawHash}`;
        }

        const hiddenLink = document.querySelector("#hidden");
        if (hiddenLink) {
          hiddenLink.href = `./favoritos-ocultos/#${rawHash}`;
        }
        return;
      }

      try {
        // Validação de segurança da URL descriptografada
        let urlObj = new URL(url);

        // Previne ataques XSS permitindo apenas HTTP, HTTPS e links MAGNET
        if (!(urlObj.protocol === "http:" || urlObj.protocol === "https:" || urlObj.protocol === "magnet:")) {
          error(`O link descriptografado utiliza o protocolo "${urlObj.protocol}", que não é permitido por segurança.`);
          return;
        }

        // Registra o clique para estatísticas na Dashboard
        if (window.clickTracker) {
          window.clickTracker.recordClick(customSlug || rawHash);
        }

        // Redireciona para o destino seguro
        window.location.href = url;
      } catch {
        error("A URL descriptografada é inválida ou corrompida. Não é possível redirecionar.");
        console.error("URL descriptografada inválida:", url);
        return;
      }
    };
  } else {
    // Caso não haja hash na URL, redireciona para a página de criação de links
    window.location.replace("./criar");
  }
}
