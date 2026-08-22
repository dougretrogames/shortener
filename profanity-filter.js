/**
 * Shortener - Filtro de Conteúdo e Palavras Inadequadas / Baixo Calão (profanity-filter.js)
 * Bloqueia termos ofensivos, palavrões e linguagem vulgar em Português do Brasil (PT-BR), Inglês (EN) e Espanhol (ES).
 * Suporte a detecção contra evasões por leetspeak (números e símbolos), repetidores e separadores.
 */

(function(global) {
  "use strict";

  // Lista de exceções / palavras legítimas que não devem disparar falso positivo
  const WHITELIST = new Set([
    "computador", "computadores", "computacao", "computer", "computers",
    "disputa", "disputar", "disputas", "reputacao", "reputacoes", "reputado",
    "deputado", "deputados", "deputada", "deputadas",
    "input", "inputs", "output", "outputs", "throughput",
    "assistente", "assistentes", "associacao", "associacoes", "association", "assistant",
    "asset", "assets", "pass", "password", "passwords", "passport", "passaporte",
    "classic", "classify", "class", "classes", "classe", "classico",
    "document", "documents", "documento", "documentos", "documentacao",
    "button", "buttons", "botao", "botoes", "cocktail", "cocktails",
    "consultar", "consulta", "consultas", "consultoria",
    "distribuir", "distribuicao", "curriculo", "circulo", "circulos",
    "popular", "populares", "populacao", "habitante", "habitantes",
    "analytics", "analysis", "analise", "analises", "analitico"
  ]);

  // Lista de termos e raízes proibidas (PT-BR, EN, ES)
  const BAD_WORDS = [
    // --- PORTUGUÊS (PT-BR) ---
    "arrombado", "arrombada", "arrombados", "arrombadas",
    "babaca", "babacas", "babaquice",
    "boceta", "bocetas", "buceta", "bucetas", "bocetinha", "bucetinha", "bucetao", "bocetao",
    "boquete", "boquetes", "boqueteiro", "boqueteira",
    "bosta", "bostas", "bostinha",
    "cacete", "cacetes", "cacetinho",
    "cadela", "cadelas",
    "caralho", "caralhos", "caralhudo", "caralhada",
    "chereca", "chota", "chotas",
    "chupeta", "chupetas", "chupador", "chupadora",
    "corno", "cornos", "corna", "cornas", "cornagem",
    "cu", "cus", "cusao", "cuzao", "cuzaos", "cuzaes", "cuzinho", "cuzinhos",
    "desgraca", "desgracas", "desgracado", "desgracados", "desgracada", "desgracadas",
    "foda", "fodas", "fodao", "fodoes", "fodasse", "fodase", "fode", "fodem", "foder", "fodeu",
    "fodido", "fodidos", "fodida", "fodidas", "fudendo", "fuder", "fudeu", "fudido", "fudidos", "fudida", "fudidas",
    "masturba", "masturbacao", "masturbar", "masturbador",
    "merda", "merdas", "merdinha", "merdinhas",
    "otario", "otarios", "otaria", "otarias",
    "paspalho", "paspalhos",
    "pepeca", "pepecas", "pepeka", "pepekas", "perereca", "pererecas",
    "pica", "picas", "picao", "picoes", "picoa",
    "pinto", "pintos", "pintudo", "pintudos",
    "piroca", "pirocas", "pirocudo", "pirocudos",
    "porra", "porras", "porralouca", "porraloucas",
    "punheta", "punhetas", "punheteiro", "punheteiros",
    "puta", "putas", "putaria", "putarias", "putinha", "putinhas", "putona", "putonas", "puto", "putos",
    "quenga", "quengas",
    "rola", "rolas", "rolao", "roloes",
    "safado", "safados", "safada", "safadas",
    "siririca", "siriricas",
    "tarado", "tarados", "tarada", "taradas",
    "transa", "transas", "transar", "trepar",
    "vagabundo", "vagabundos", "vagabunda", "vagabundas",
    "vagina", "vaginas", "penis",
    "viadagem", "viado", "viados", "viadinho", "viadinhos", "veado", "veados",
    "xana", "xanas", "xaninha", "xoxota", "xoxotas", "xereca", "xerecas", "xexeca",

    // --- INGLÊS (EN) ---
    "anal", "anus",
    "ass", "asses", "asshole", "assholes", "arse", "arsehole",
    "bastard", "bastards",
    "bitch", "bitches", "bitchy",
    "blowjob", "blowjobs",
    "bollocks", "boner", "boners",
    "boob", "boobs", "booty",
    "bullshit",
    "clit", "clitoris",
    "cock", "cocks", "cocksucker", "cocksuckers",
    "cum", "cums", "cumshot", "cumshots", "cumming",
    "cunt", "cunts",
    "dick", "dicks", "dickhead", "dickheads",
    "dildo", "dildos",
    "dyke", "dykes",
    "fag", "fags", "faggot", "faggots",
    "fellate", "fellatio",
    "fuck", "fucks", "fucker", "fuckers", "fuckin", "fucking", "fuckoff",
    "handjob", "handjobs",
    "horny", "incest",
    "jackoff", "jerkoff",
    "jizz",
    "milf", "milfs",
    "motherfucker", "motherfuckers", "motherfucking",
    "nazi", "nazis",
    "nigga", "niggas", "nigger", "niggers",
    "nipple", "nipples",
    "nude", "nudes",
    "orgasm", "orgasms",
    "piss", "pissed", "pissing",
    "poop", "porn", "porno", "pornography",
    "prick", "pricks",
    "pussy", "pussies",
    "rape", "rapist", "rapists",
    "retard", "retards",
    "scrotum", "semen",
    "sex", "sexy", "shag",
    "shit", "shits", "shitty",
    "slut", "sluts", "slutty",
    "smegma", "spic",
    "tits", "titties", "titty",
    "twat", "twats",
    "wank", "wanker", "wankers",
    "whore", "whores",
    "xxx",

    // --- ESPANHOL (ES) ---
    "boludo", "boludos", "boluda", "boludas",
    "cabron", "cabrones", "cabrona", "cabronas",
    "cagar", "cagada", "cagadas",
    "carajo", "carajos",
    "chinga", "chingar", "chingada", "chingadas", "chingado", "chingados", "chingon", "chingones",
    "choto", "chotos", "chota", "chotas",
    "chupala", "chupame", "chupapollas",
    "cojones", "cojonudo",
    "concha", "conchas", "conchudo", "conchudos", "conchuda", "conchudas",
    "coño", "coños",
    "culiao", "culiaos", "culia", "culo", "culos", "culon", "culona",
    "follar", "follador", "folladora",
    "gilipollas",
    "guarra", "guarras", "guarro", "guarros",
    "hdp", "hijodeputa", "hijadeputa", "hijosdeputa",
    "joder", "jodido", "jodidos", "jodida", "jodidas", "jodete",
    "mamada", "mamadas", "mamon", "mamones", "mamona",
    "marica", "maricas", "maricon", "maricones", "mariconada",
    "mierda", "mierdas", "mierdon",
    "nabo", "nabos", "orto", "ortos",
    "paja", "pajas", "pajero", "pajeros", "pajillero",
    "pelotudo", "pelotudos", "pelotuda", "pelotudas",
    "pendejo", "pendejos", "pendeja", "pendejas",
    "picha", "pichas",
    "pinche", "pinches",
    "pito", "pitos",
    "polla", "pollas", "pollon",
    "puton", "putones", "ramera", "rameras",
    "tetas", "teton", "tetona", "tetonas",
    "verga", "vergas", "vergudo",
    "zorra", "zorras", "zorrillo"
  ];

  // Mapeamento de Leetspeak para caracteres normais
  const LEET_MAP = {
    "0": "o",
    "1": "i",
    "!": "i",
    "|": "i",
    "3": "e",
    "4": "a",
    "@": "a",
    "5": "s",
    "$": "s",
    "7": "t",
    "+": "t",
    "8": "b",
    "9": "g"
  };

  /**
   * Normaliza uma string para comparação de profanidade:
   * 1. Remove acentuação
   * 2. Converte para minúsculas
   * 3. Aplica tradução de leetspeak (0->o, 1->i, @->a, etc.)
   */
  function normalizeText(text) {
    if (!text) return "";
    let str = String(text)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    let leetReplaced = "";
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      leetReplaced += (LEET_MAP[ch] !== undefined) ? LEET_MAP[ch] : ch;
    }
    return leetReplaced;
  }

  /**
   * Remove repetições sucessivas de caracteres (ex: "fuuuuck" -> "fuck", "pppuuutttaaa" -> "puta")
   */
  function removeRepeats(text) {
    return text.replace(/(.)\1+/g, "$1");
  }

  // Normaliza a lista de termos proibidos na inicialização
  const NORMALIZED_BAD_WORDS = BAD_WORDS.map(w => normalizeText(w));

  /**
   * Verifica se o slug contém termos impróprios
   * @param {string} slug
   * @returns {{ isProfane: boolean, word?: string }}
   */
  function checkProfanity(slug) {
    if (!slug || typeof slug !== "string") {
      return { isProfane: false };
    }

    const raw = slug.trim().toLowerCase();
    if (!raw) return { isProfane: false };

    // Se estiver explicitamente na whitelist, autoriza imediatamente
    const normalizedRaw = normalizeText(raw).replace(/[^a-z0-9]/g, "");
    if (WHITELIST.has(raw) || WHITELIST.has(normalizedRaw)) {
      return { isProfane: false };
    }

    // Variações do texto para testar diferentes técnicas de evasão
    const normalized = normalizeText(raw);
    const stripped = normalized.replace(/[^a-z0-9]/g, "");
    const collapsed = removeRepeats(stripped);
    const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);

    // 1. Checagem em Tokens separados por delimitadores (ex: "meu-link-puta-123")
    for (const token of tokens) {
      if (WHITELIST.has(token)) continue;

      const tokenCollapsed = removeRepeats(token);
      for (const bad of NORMALIZED_BAD_WORDS) {
        if (token === bad || tokenCollapsed === bad) {
          return { isProfane: true, word: bad };
        }
      }
    }

    // 2. Checagem em string aglutinada (ex: "superputa", "f-u-c-k", "p_o_r_r_a", "c0rn0")
    for (const bad of NORMALIZED_BAD_WORDS) {
      // Para palavras curtas (<= 3 caracteres como "cu", "ass", "fag", "sex"), exige match exato de token ou ponta
      if (bad.length <= 3) {
        if (tokens.includes(bad) || stripped === bad || collapsed === bad) {
          return { isProfane: true, word: bad };
        }
        continue;
      }

      // Para palavras com 4 ou mais caracteres, verifica se está contida na string aglutinada
      if (stripped.includes(bad) || collapsed.includes(bad)) {
        // Valida se não faz parte de palavra permitida na whitelist
        let isWhitelisted = false;
        for (const white of WHITELIST) {
          if (white.includes(bad) && (raw.includes(white) || stripped.includes(white))) {
            isWhitelisted = true;
            break;
          }
        }

        if (!isWhitelisted) {
          return { isProfane: true, word: bad };
        }
      }
    }

    return { isProfane: false };
  }

  const profanityFilter = {
    check: checkProfanity,
    isProfane: function(slug) {
      return checkProfanity(slug).isProfane;
    }
  };

  global.profanityFilter = profanityFilter;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = profanityFilter;
  }
})(typeof window !== "undefined" ? window : global);
