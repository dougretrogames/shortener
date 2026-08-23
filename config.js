/**
 * Shortener - Configurações Centrais da Aplicação (config.js)
 * 
 * Se você clonou ou fez fork deste repositório:
 * 1. Altere o ADMIN_GITHUB_USERNAME para o seu nome de usuário do GitHub.
 * 2. Crie seu projeto gratuito no Supabase (supabase.com) e cole sua URL e Anon Key abaixo.
 */

const APP_CONFIG = {
  // Nome de usuário do GitHub com privilégios de Administrador Geral
  ADMIN_GITHUB_USERNAME: "dougretrogames",

  // Quando true, detecta automaticamente o dono do repositório no GitHub Pages (*.github.io)
  AUTO_DETECT_GITHUB_OWNER: true,

  // Credenciais do Banco de Dados Supabase Cloud
  SUPABASE_URL: "https://nmqzjcriwggemfawpjqc.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_d8Ex_hrPcVGw61BhTuhoJQ_DAcG1s2W"
};

// Obtém o nome de usuário do Administrador para o ambiente atual
function getAppAdminUsername() {
  if (APP_CONFIG.AUTO_DETECT_GITHUB_OWNER && typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname || "";
    if (hostname.endsWith(".github.io")) {
      const detectedOwner = hostname.split(".")[0].toLowerCase();
      if (detectedOwner && detectedOwner !== "www") {
        return detectedOwner;
      }
    }
  }
  return (APP_CONFIG.ADMIN_GITHUB_USERNAME || "dougretrogames").toLowerCase().replace(/^@/, '');
}

window.APP_CONFIG = APP_CONFIG;
window.getAppAdminUsername = getAppAdminUsername;
