/**
 * Encurtador de Links - Descriptografia de Links (decrypt.js)
 * Traduzido e modernizado para Português do Brasil com suporte a Slugs Personalizados
 */

// Seleciona e destaca o texto de um campo de entrada
function highlight(id) {
  let output = document.querySelector("#" + id);
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

async function onDecrypt() {
  hideStatus();

  // Validação de bibliotecas
  if (!("b64" in window && "apiVersions" in window)) {
    showStatus("Bibliotecas essenciais não foram carregadas corretamente.", true);
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
    showStatus("O link fornecido não possui um fragmento de dados criptografados válido.", true);
    return;
  }

  // Se houver apelido personalizado no formato slug@payload
  let payload = rawHash;
  if (rawHash.includes("@")) {
    payload = rawHash.slice(rawHash.indexOf("@") + 1);
  }

  let params;
  try {
    params = JSON.parse(b64.decode(payload));
  } catch {
    showStatus("O link parece estar corrompido ou não pôde ser decodificado.", true);
    return;
  }

  // Se for um link sem senha (direto)
  if (params["open"] || params["u"] || (!("e" in params) && params["u"])) {
    const targetUrl = params["u"];
    const resultOutput = document.querySelector("#result-output");
    const resultSection = document.querySelector("#result-section");
    const openLinkBtn = document.querySelector("#open-decrypted");

    if (resultOutput) resultOutput.value = targetUrl;
    if (openLinkBtn) openLinkBtn.href = targetUrl;
    if (resultSection) resultSection.style.display = "block";

    showStatus("✓ Link inspecionado com sucesso! (Este link foi criado sem senha)", false);
    return;
  }

  // Verifica parâmetros obrigatórios para links criptografados
  if (!("v" in params && "e" in params)) {
    showStatus("Link corrompido. Parâmetros essenciais ausentes na URL.", true);
    return;
  }

  // Verifica compatibilidade da API
  if (!(params["v"] in apiVersions)) {
    showStatus("Versão de API de criptografia não suportada.", true);
    return;
  }

  const api = apiVersions[params["v"]];

  // Extrai componentes binários
  const encrypted = b64.base64ToBinary(params["e"]);
  const salt = "s" in params ? b64.base64ToBinary(params["s"]) : null;
  const iv = "i" in params ? b64.base64ToBinary(params["i"]) : null;

  const password = document.querySelector("#password").value;

  // Executa descriptografia
  let decrypted;
  try {
    decrypted = await api.decrypt(encrypted, password, salt, iv);
  } catch {
    showStatus("Senha incorreta ou dados corrompidos. Tente novamente.", true);
    return;
  }

  // Exibe resultado
  const outputField = document.querySelector("#output");
  outputField.value = decrypted;
  
  const outputSection = document.querySelector("#output-section");
  if (outputSection) {
    outputSection.style.display = "block";
  }

  showStatus("Link descriptografado com sucesso!", false);

  // Atualiza botão de abrir em nova aba
  const openBtn = document.querySelector("#open");
  if (openBtn) {
    openBtn.href = decrypted;
  }

  // Rolagem suave até a área de resultado
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
}

// Copiar texto para a área de transferência
async function onCopy(id) {
  const output = highlight(id);

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
    const baseUrl = new URL('../', window.location.href).href;
    document.querySelector("#encrypted-url").value = `${baseUrl}${window.location.hash}`;
    document.querySelector("#password").focus();
  }
}
