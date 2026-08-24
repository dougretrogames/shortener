/**
 * Shortener - Módulo de Verificação em Duas Etapas (2FA / TOTP)
 * Padrão RFC 6238 compatível com Microsoft Authenticator, Google Authenticator, etc.
 * 100% Client-Side com Web Crypto API nativa.
 */

const TOTP = (() => {
  const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  // Gera chave secreta Base32 aleatória de 160 bits (20 bytes / 32 chars)
  function generateSecret(length = 32) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    let result = "";
    for (let i = 0; i < length; i++) {
      result += BASE32_CHARS[bytes[i] % 32];
    }
    return result;
  }

  // Converte Base32 para Uint8Array
  function base32ToUint8Array(base32) {
    const clean = base32.replace(/[\s=-]+/g, "").toUpperCase();
    let bits = 0;
    let value = 0;
    const output = [];

    for (let i = 0; i < clean.length; i++) {
      const idx = BASE32_CHARS.indexOf(clean[i]);
      if (idx === -1) continue;

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return new Uint8Array(output);
  }

  // Gera código TOTP de 6 dígitos para uma determinada chave e timestamp
  async function generateToken(secret, timeStepOffset = 0) {
    try {
      const keyBytes = base32ToUint8Array(secret);
      if (keyBytes.length === 0) return null;

      const epochSeconds = Math.floor(Date.now() / 1000);
      const counter = Math.floor(epochSeconds / 30) + timeStepOffset;

      const counterBuffer = new ArrayBuffer(8);
      const counterView = new DataView(counterBuffer);
      // Escreve counter como BigEndian 64-bit integer
      counterView.setUint32(0, Math.floor(counter / 0x100000000), false);
      counterView.setUint32(4, counter & 0xffffffff, false);

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: { name: "SHA-1" } },
        false,
        ["sign"]
      );

      const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
      const hashBytes = new Uint8Array(signature);

      // Truncamento dinâmico (RFC 4226)
      const offset = hashBytes[hashBytes.length - 1] & 0x0f;
      const binaryCode =
        ((hashBytes[offset] & 0x7f) << 24) |
        ((hashBytes[offset + 1] & 0xff) << 16) |
        ((hashBytes[offset + 2] & 0xff) << 8) |
        (hashBytes[offset + 3] & 0xff);

      const token = binaryCode % 1000000;
      return token.toString().padStart(6, "0");
    } catch (e) {
      console.error("[TOTP] Erro ao gerar token:", e);
      return null;
    }
  }

  // Valida um token de 6 dígitos com janela de tolerância de +/- 1 time step (30 segundos)
  async function verifyToken(secret, token) {
    if (!secret || !token) return false;
    const cleanToken = String(token).trim().replace(/\D/g, "");
    if (cleanToken.length !== 6) return false;

    // Testa o período atual e as janelas adjacentes para compensar pequenas variações no relógio
    for (const offset of [0, -1, 1, -2, 2]) {
      const generated = await generateToken(secret, offset);
      if (generated && generated === cleanToken) {
        return true;
      }
    }
    return false;
  }

  // Gera URI padrão para leitura no Microsoft Authenticator / Google Authenticator
  function getOtpAuthUrl(secret, accountName = "dougretrogames", issuer = "Shortener") {
    const cleanSecret = secret.replace(/[\s=-]+/g, "").toUpperCase();
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedAccount = encodeURIComponent(accountName);
    return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  }

  // Gera URL do QR Code
  function getQrCodeUrl(otpAuthUrl) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpAuthUrl)}&format=svg`;
  }

  // Gestão de Armazenamento Local / Sessão Confiável
  const STORAGE_KEY_SECRET = "shortener_admin_2fa_secret";
  const STORAGE_KEY_ENABLED = "shortener_admin_2fa_enabled";
  const STORAGE_KEY_REMEMBERED_UNTIL = "shortener_admin_2fa_remembered_until";
  const SESSION_KEY_VERIFIED = "shortener_admin_2fa_session_verified";

  function is2FAEnabled() {
    return localStorage.getItem(STORAGE_KEY_ENABLED) === "true" && !!localStorage.getItem(STORAGE_KEY_SECRET);
  }

  function getSavedSecret() {
    return localStorage.getItem(STORAGE_KEY_SECRET) || "";
  }

  function enable2FA(secret, rememberDays = 30) {
    if (!secret) return;
    localStorage.setItem(STORAGE_KEY_SECRET, secret.trim().toUpperCase());
    localStorage.setItem(STORAGE_KEY_ENABLED, "true");
    setSessionVerified(true, rememberDays);
  }

  function disable2FA() {
    localStorage.removeItem(STORAGE_KEY_SECRET);
    localStorage.removeItem(STORAGE_KEY_ENABLED);
    localStorage.removeItem(STORAGE_KEY_REMEMBERED_UNTIL);
    sessionStorage.removeItem(SESSION_KEY_VERIFIED);
  }

  function isDeviceRemembered() {
    const rememberedUntil = parseInt(localStorage.getItem(STORAGE_KEY_REMEMBERED_UNTIL) || "0", 10);
    return !isNaN(rememberedUntil) && rememberedUntil > Date.now();
  }

  function isSessionVerified() {
    if (!is2FAEnabled()) return true;

    // 1. Sessão atual já verificada
    if (sessionStorage.getItem(SESSION_KEY_VERIFIED) === "true") {
      return true;
    }

    // 2. Dispositivo lembrado neste navegador (persistência)
    if (isDeviceRemembered()) {
      sessionStorage.setItem(SESSION_KEY_VERIFIED, "true");
      return true;
    }

    return false;
  }

  function setSessionVerified(verified = true, rememberDays = 0) {
    if (verified) {
      sessionStorage.setItem(SESSION_KEY_VERIFIED, "true");
      if (rememberDays > 0) {
        const expiresAt = Date.now() + (rememberDays * 24 * 60 * 60 * 1000);
        localStorage.setItem(STORAGE_KEY_REMEMBERED_UNTIL, String(expiresAt));
      }
    } else {
      sessionStorage.removeItem(SESSION_KEY_VERIFIED);
      localStorage.removeItem(STORAGE_KEY_REMEMBERED_UNTIL);
    }
  }

  function forgetTrustedDevice() {
    localStorage.removeItem(STORAGE_KEY_REMEMBERED_UNTIL);
    sessionStorage.removeItem(SESSION_KEY_VERIFIED);
  }

  return {
    generateSecret,
    generateToken,
    verifyToken,
    getOtpAuthUrl,
    getQrCodeUrl,
    is2FAEnabled,
    getSavedSecret,
    enable2FA,
    disable2FA,
    isDeviceRemembered,
    isSessionVerified,
    setSessionVerified,
    forgetTrustedDevice
  };
})();

window.TOTP = TOTP;
