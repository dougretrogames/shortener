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
  SUPABASE_URL: "https://rrtwrmfbbdsmrvirrmsm.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJydHdybWZiYmRzbXJ2aXJybXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTM3MDgsImV4cCI6MjA4NzA2OTcwOH0.0210214c77bb1cba816d1f973c1d43a13a89ee155d36e2ce98b3c3b0eb62aef7"
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
