/**
 * Encurtador de Links - Teste de Força Bruta Educacional (bruteforce.js)
 * Traduzido e modernizado para Português do Brasil com suporte a Slugs Personalizados
 */

let progressInterval = null;

function showStatus(text, isError = false, isDone = false) {
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
  } else if (isDone) {
    statusBox.innerHTML = `
      <div style="padding: 0.75rem 1rem; border-radius: var(--radius-md); background: var(--success-bg); border: 1px solid var(--success-border); color: #6ee7b7; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${text}</span>
      </div>
    `;
  } else {
    statusBox.innerHTML = `
      <div style="padding: 0.75rem 1rem; border-radius: var(--radius-md); background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); color: #7dd3fc; font-size: 0.9rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          <span style="font-weight: 600;">Executando teste de força bruta...</span>
        </div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">${text}</p>
      </div>
      <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
      </style>
    `;
  }
}

function hideStatus() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  const statusBox = document.querySelector("#status-box");
  if (statusBox) statusBox.style.display = "none";
}

async function onBruteForce() {
  hideStatus();

  if (!("crypto" in window && "subtle" in window.crypto)) {
    showStatus("A API window.crypto não está disponível neste ambiente. Use HTTPS ou localhost.", true);
    return;
  }
  if (!("b64" in window && "apiVersions" in window)) {
    showStatus("Bibliotecas de criptografia essenciais não foram carregadas!", true);
    return;
  }

  const urlText = document.querySelector("#encrypted-url").value.trim();
  if (!urlText) {
    showStatus("Por favor, insira a URL criptografada.", true);
    return;
  }

  let rawHash = "";
  try {
    if (urlText.includes("#")) {
      rawHash = urlText.split("#")[1];
    } else {
      rawHash = urlText;
    }
  } catch {
    showStatus("A URL fornecida não contém um hash criptográfico válido.", true);
    return;
  }

  let payload = rawHash;
  if (rawHash.includes("@")) {
    payload = rawHash.slice(rawHash.indexOf("@") + 1);
  }

  let params;
  try {
    params = JSON.parse(b64.decode(payload));
  } catch {
    showStatus("O link fornecido está corrompido ou em formato inválido.", true);
    return;
  }

  if (!("v" in params && "e" in params)) {
    showStatus("O link está incompleto ou parâmetros criptográficos estão ausentes.", true);
    return;
  }

  if (!(params["v"] in apiVersions)) {
    showStatus("Versão de API de criptografia incompatível.", true);
    return;
  }

  const api = apiVersions[params["v"]];
  const encrypted = b64.base64ToBinary(params["e"]);
  const salt = "s" in params ? b64.base64ToBinary(params["s"]) : null;
  const iv = "i" in params ? b64.base64ToBinary(params["i"]) : null;

  const charsetInput = document.querySelector("#charset").value;
  if (!charsetInput || charsetInput.length === 0) {
    showStatus("O conjunto de caracteres (charset) não pode estar vazio.", true);
    return;
  }
  const cset = charsetInput.split("");

  const progress = {
    tried: 0,
    total: 0,
    len: 0,
    overallTotal: 0,
    done: false,
    startTime: performance.now()
  };

  async function tryAllLen(prefix, len, curLen) {
    if (progress.done) return;
    if (len === curLen) {
      progress.tried++;
      try {
        await api.decrypt(encrypted, prefix, salt, iv);
        document.querySelector("#output").value = prefix;
        const outputSection = document.querySelector("#output-section");
        if (outputSection) outputSection.style.display = "block";
        progress.done = true;
        showStatus(`Sucesso! A senha "${prefix}" foi encontrada com sucesso.`, false, true);
        if (progressInterval) clearInterval(progressInterval);
      } catch {}
      return;
    }
    for (let i = 0; i < cset.length; i++) {
      if (progress.done) return;
      let c = cset[i];
      await tryAllLen(prefix + c, len, curLen + 1);
    }
  }

  function progressUpdate() {
    if (progress.done) {
      if (progressInterval) clearInterval(progressInterval);
      return;
    }
    let delta = (performance.now() - progress.startTime) || 1;
    let percent = progress.total > 0 ? (Math.round(100000 * progress.tried / progress.total) / 1000) : 0;
    let speed = Math.round(1000000 * (progress.overallTotal + progress.tried) / delta) / 1000;
    
    showStatus(`Testando ${progress.total} senhas de tamanho ${progress.len} &bull; ${percent}% do nível concluído &bull; Velocidade média: ${speed} senhas/seg.`);
  }

  showStatus("Iniciando testes de combinações...");

  (async () => {
    for (let len = 1; !progress.done; len++) {
      progress.overallTotal += progress.tried;
      progress.tried = 0;
      progress.total = Math.pow(cset.length, len);
      progress.len = len;
      progressUpdate();
      await tryAllLen("", len, 0);
    }
  })();

  progressInterval = setInterval(progressUpdate, 3000);
}
