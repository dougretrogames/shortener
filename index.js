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

// Extrai o identificador ou dados do link da URL (suporta caminho direto /slug, hash #/slug ou query ?slug)
function extractTargetFromLocation() {
  // 1. Tenta obter pelo Pathname (ex: /shortener/retrogamebox-vip, /encurtador/retrogamebox-vip ou /retrogamebox-vip)
  const pathname = window.location.pathname || "";
  const segments = pathname.split("/").filter(s => s && s.trim() !== "");
  const reservedPages = [
    "criar", "painel", "descriptografar", "favoritos-ocultos",
    "forca-bruta", "index.html", "404.html", "shortener", "encurtador"
  ];

  if (segments.length > 0) {
    const last = decodeURIComponent(segments[segments.length - 1]).trim();
    if (last && !reservedPages.includes(last.toLowerCase())) {
      return last;
    }
  }

  // 2. Tenta obter pelo Hash (ex: #/retrogamebox-vip, #retrogamebox-vip ou #slug@base64)
  if (window.location.hash) {
    let h = window.location.hash.slice(1).trim();
    if (h.startsWith("/")) h = h.replace(/^\/+/, '');
    if (h) return decodeURIComponent(h);
  }

  // 3. Tenta obter pela Query String (ex: ?retrogamebox-vip ou ?s=retrogamebox-vip)
  if (window.location.search) {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("s")) return searchParams.get("s").trim();
    const rawSearch = window.location.search.slice(1).replace(/^\/+/, '').trim();
    if (rawSearch && !rawSearch.includes("=")) return decodeURIComponent(rawSearch);
  }

  return "";
}

// Executado quando o documento/corpo é carregado
async function main() {
  const rawTarget = extractTargetFromLocation();

  if (rawTarget) {
    const formEl = document.querySelector(".form");
    const pwdInput = document.querySelector("#password");
    
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

    let rawHash = rawTarget;
    let payload = rawTarget;
    let customSlug = null;
    let params = null;

    // Caso 1: Suporte a formato composto: #meu-link@base64Data
    if (rawTarget.includes("@")) {
      const atIndex = rawTarget.indexOf("@");
      customSlug = decodeURIComponent(rawTarget.slice(0, atIndex));
      payload = rawTarget.slice(atIndex + 1);
      try {
        params = JSON.parse(b64.decode(payload));
      } catch {}
    } else if ((rawTarget.startsWith("ey") || rawTarget.startsWith("e3")) && /^[A-Za-z0-9+/=_-]+$/.test(rawTarget)) {
      // Caso 2: Tentar decodificar direto como Base64 payload apenas se tiver formato Base64
      try {
        const decoded = b64.decode(rawTarget);
        const parsed = JSON.parse(decoded);
        if (parsed && (parsed.v || parsed.e || parsed.open || parsed.u)) {
          params = parsed;
        }
      } catch {}
    }

    // Caso 3: Apelido curto limpo (ex: retrobox ou 6x8qt) - busca no Supabase Nuvem e localStorage
    if (!params) {
      customSlug = decodeURIComponent(rawTarget).trim();
      const slugKey = customSlug.toLowerCase();

      // Busca no Supabase (Nuvem em tempo real para todos os usuários)
      let entry = null;
      if (window.supabaseDb) {
        try {
          const remoteLink = await window.supabaseDb.getLink(slugKey);
          if (remoteLink && remoteLink.encrypted_data) {
            entry = remoteLink.encrypted_data;
          }
        } catch (e) {
          console.warn("[Supabase] Erro ao buscar link remoto:", e);
        }
      }

      // Se não encontrou no Supabase, procura no histórico local (localStorage)
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

    // Contabiliza o clique em tempo real no banco de dados Supabase imediatamente ao abrir o link
    const finalSlug = (customSlug || (rawHash ? rawHash.split("@")[0] : "")).trim().toLowerCase();
    if (window.supabaseDb && finalSlug) {
      try {
        window.supabaseDb.incrementClicks(finalSlug);
      } catch (e) {
        console.warn("[Supabase] Erro ao contabilizar clique na abertura:", e);
      }
    }

    // Suporte a links diretos encurtados sem senha (redirecionamento IMEDIATO e transparente)
    if (params["open"] || params["u"] || (!("e" in params) && params["u"])) {
      const targetUrl = params["u"];
      try {
        const urlObj = new URL(targetUrl);
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:" || urlObj.protocol === "magnet:") {
          // Redireciona instantaneamente sem exibir formulário ou qualquer tela intermediária
          window.location.replace(targetUrl);
          return;
        }
      } catch (e) {
        error("A URL de destino é inválida.");
        return;
      }
    }

    // Exibe o badge de link personalizado se houver (para links com senha)
    const slugContainer = document.querySelector("#custom-slug-container");
    const slugText = document.querySelector("#custom-slug-text");
    if (customSlug && slugContainer && slugText) {
      slugText.innerText = customSlug;
      slugContainer.style.display = "block";
    } else if (slugContainer) {
      slugContainer.style.display = "none";
    }

    // Apenas para links protegidos por senha: exibe o formulário de desbloqueio
    if (formEl) formEl.style.display = "block";
    if (pwdInput) {
      pwdInput.value = "";
      pwdInput.focus();
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

        // Redireciona para o destino seguro
        window.location.href = url;
      } catch {
        error("A URL descriptografada é inválida ou corrompida. Não é possível redirecionar.");
        console.error("URL descriptografada inválida:", url);
        return;
      }
    };
  } else {
    // Caso seja acesso direto à raiz (homepage), redireciona no modo topo/home
    window.location.replace("./criar?home=1");
  }
}
