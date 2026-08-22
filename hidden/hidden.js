/**
 * Link Lock - Favoritos Ocultos e Disfarçados (hidden.js)
 * Traduzido e modernizado para Português do Brasil com suporte a Slugs Personalizados
 */

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

async function onHide() {
  hideStatus();

  // Validação de bibliotecas
  if (!("b64" in window && "apiVersions" in window)) {
    showStatus("Bibliotecas essenciais não foram carregadas corretamente.", true);
    return;
  }

  const urlText = document.querySelector("#encrypted-url").value.trim();
  let hiddenUrl;
  try {
    hiddenUrl = new URL(urlText);
  } catch {
    showStatus("A URL protegida inserida não é válida. Certifique-se de incluir 'https://'!", true);
    return;
  }

  const bookmarkUrlText = document.querySelector("#bookmark-url").value.trim();
  let bookmarkUrl;
  try {
    bookmarkUrl = new URL(bookmarkUrlText);
  } catch {
    showStatus("A URL de disfarce inserida não é válida. Certifique-se de incluir 'https://'!", true);
    return;
  }

  const bookmarkTitle = document.querySelector("#bookmark-title").value.trim();
  if (!bookmarkTitle) {
    showStatus("Por favor, preencha o nome de exibição do favorito disfarçado.", true);
    return;
  }

  // Verifica se o hash contém dados válidos do Link Lock
  const rawHash = hiddenUrl.hash.slice(1);
  let payload = rawHash;
  if (rawHash.includes("@")) {
    payload = rawHash.slice(rawHash.indexOf("@") + 1);
  }

  try {
    JSON.parse(b64.decode(payload));
  } catch {
    showStatus("A URL protegida parece estar corrompida. Ela precisa ser um link gerado pelo Link Lock.", true);
    return;
  }

  const output = document.querySelector("#output");
  const outputSection = document.querySelector("#output-section");

  // Anexa o hash criptografado na URL de disfarce
  bookmarkUrl.hash = hiddenUrl.hash;
  output.setAttribute("href", bookmarkUrl.toString());

  // Habilita o botão para arraste
  output.setAttribute("aria-disabled", "false");
  output.innerText = bookmarkTitle;

  if (outputSection) {
    outputSection.style.display = "block";
  }

  showStatus("Favorito gerado com sucesso! Arraste o botão abaixo para sua barra de favoritos.", false);

  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
}

function onChangeDecrypt() {
  let newUrl;
  try {
    const newUrlInput = document.querySelector("#decrypt-bookmark-disguise");
    const _ = new URL(newUrlInput.value);
    newUrl = newUrlInput.value;
  } catch (_) {
    alert("Por favor, insira uma URL válida para o destino do disfarce.");
    return;
  }

  const decryptBookmark = document.querySelector("#decrypt-bookmark");
  decryptBookmark.href = decryptBookmark.href.replace(/replace\("[^"]*"\)/, `replace("${newUrl}")`);
  alert("Destino de disfarce atualizado com sucesso!");
}

async function randomLink() {
  try {
    let page = await fetch("https://pt.wikipedia.org/w/api.php?"
        + "format=json"
        + "&action=query"
        + "&generator=random"
        + "&grnnamespace=0"
        + "&prop=info"
        + "&inprop=url"
        + "&origin=*")
      .then(r => r.json())
      .then(d => {
        let pages = d.query.pages;
        return pages[Object.keys(pages)[0]];
      });

    document.querySelector("#bookmark-url").value = page.canonicalurl || page.fullurl;
    document.querySelector("#bookmark-title").value = page.title;
    hideStatus();
  } catch (err) {
    console.error("Erro ao buscar link da Wikipédia:", err);
    document.querySelector("#bookmark-url").value = "https://pt.wikipedia.org/wiki/Especial:Aleat%C3%B3ria";
    document.querySelector("#bookmark-title").value = "Artigo Aleatório da Wikipédia";
  }
}

function main() {
  if (window.location.hash) {
    const baseUrl = new URL('../', window.location.href).href;
    document.querySelector("#encrypted-url").value = `${baseUrl}${window.location.hash}`;
    window.location.hash = "";
    document.querySelector("#bookmark-title").focus();
  }
}
