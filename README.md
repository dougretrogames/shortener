# Shortener 🔒🔗

> **Encurtador de links moderno e protetor de URLs com senha usando criptografia militar AES-256 diretamente no navegador.**

O **Shortener** é uma aplicação web completa que une o melhor dos dois mundos: um **encurtador de links profissional** (com apelidos personalizados ou códigos aleatórios limpos de 5 dígitos) e um **sistema seguro de proteção de URLs por senha**, com **painel de controle (Dashboard)**, **contador de cliques em tempo real**, **banco de dados em nuvem Supabase**, **autenticação oficial via GitHub** e interface moderna com tema escuro 100% responsiva para desktop e dispositivos móveis.

[👉 Acesse o Repositório no GitHub](https://github.com/dougretrogames/shortener) | [🚀 Teste a Aplicação Online](https://dougretrogames.github.io/shortener/criar/)

---

## 🌟 Principais Funcionalidades

### 1. 🔗 Encurtador de Links Limpo e Profissional (`/apelido` e `/5digitos`)
- **URLs Ultra-Curtas:** Gera links compactos, elegantes e diretos sem hash `#` na barra de endereços:
  - Com apelido personalizado: `https://dougretrogames.github.io/shortener/retrobox`
  - Automático com 5 dígitos: `https://dougretrogames.github.io/shortener/6x8qt`
- **Gerador Inteligente de 5 Dígitos:** Sorteia códigos únicos a partir de um pool de 60 caracteres legíveis (excluindo caracteres ambíguos como `I` maiúsculo e `l` minúsculo), sem repetição interna de dígitos.
- **Validação Global de Unicidade:** Impede colisões de apelidos entre usuários no mundo inteiro em tempo real.

### 2. 🛡️ Criptografia Militar no Navegador (100% Client-Side)
- Toda a criptografia e descriptografia ocorre localmente no seu dispositivo utilizando a API nativa [`SubtleCrypto`](https://developer.mozilla.org/pt-BR/docs/Web/API/SubtleCrypto).
- Emprega **AES-256-GCM** para proteção de dados e **PBKDF2** com **100.000 iterações** de **SHA-256** para derivação de chaves.
- Proteção contra ataques de dicionário e tabelas rainbow com **Salt de 128 bits** e **IV de 96 bits** aleatórios.
- Se o usuário não definir uma senha, o link funciona como um encurtador direto de alta performance.

### 3. ⚡ Banco de Dados em Nuvem em Tempo Real (Supabase)
- Links criados ficam imediatamente disponíveis em escala global (~50ms de latência) sem necessidade de commits no repositório.
- Armazena exclusivamente o conteúdo criptografado (*ciphertext*), garantindo privacidade total mesmo para quem administra o banco de dados.

### 4. 🔑 Autenticação com GitHub & Painel de Controle (`/painel`)
- **Login OAuth Oficial:** Conecte sua conta do GitHub com fluxo seguro PKCE.
- **Métricas e KPIs:** Monitore contador de cliques em tempo real, links mais acessados e data de criação.
- **Coluna Fixa de Ações:** Botões de copiar, testar, editar e excluir permanentemente links sempre acessíveis sem depender de scroll horizontal.
- **Exportação de Dados:** Exporte seus relatórios completos em formato **JSON** ou **CSV** com sanitização contra fórmulas maliciosas.

### 5. 📱 Interface Responsiva & Recursos Extras
- Cabeçalho mobile alinhado em linha única com menu hambúrguer ultra-rápido (suporte otimizado para modo retrato e paisagem).
- **Descriptografar Manual (`/descriptografar`):** Inspecione URLs de destino sem redirecionamento automático do navegador.

---

## 🛠️ Passo a Passo: Como Integrar com o Supabase (Para quem clonar o projeto)

Se você clonou este repositório e deseja hospedar sua própria versão com banco de dados em nuvem e login pelo GitHub, siga o passo a passo abaixo:

### Passo 1: Criar uma Conta e um Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita.
2. No painel, clique em **"New Project"**.
3. Escolha uma organização, defina um nome para o projeto, uma senha segura para o banco de dados e selecione a região mais próxima (ex: *South America - São Paulo*).
4. Aguarde cerca de 1 a 2 minutos até o provisionamento do projeto ser concluído.

---

### Passo 2: Criar a Tabela `short_links` e as Políticas de Segurança (SQL)
1. No menu lateral do Supabase, clique em **SQL Editor**.
2. Clique em **"New Query"**, cole o script SQL abaixo e clique em **"Run"** (ou `Ctrl + Enter`):

```sql
-- 1. Criação da tabela principal de links encurtados
CREATE TABLE IF NOT EXISTS public.short_links (
    slug TEXT PRIMARY KEY,
    encrypted_data JSONB NOT NULL,
    author_type TEXT DEFAULT 'visitante',
    author_name TEXT DEFAULT 'Visitante',
    hint TEXT DEFAULT '',
    clicks BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitação da Segurança por Nível de Linha (Row Level Security - RLS)
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- 3. Política para permitir leitura pública de links
CREATE POLICY "Permitir leitura publica de links"
ON public.short_links FOR SELECT
USING (true);

-- 4. Política para permitir criação pública de links
CREATE POLICY "Permitir criacao publica de links"
ON public.short_links FOR INSERT
WITH CHECK (true);

-- 5. Política para permitir atualização de links e incremento de cliques
CREATE POLICY "Permitir atualizacao publica de links"
ON public.short_links FOR UPDATE
USING (true)
WITH CHECK (true);

-- 6. Política para permitir exclusão de links
CREATE POLICY "Permitir exclusao publica de links"
ON public.short_links FOR DELETE
USING (true);
```

---

### Passo 3: Configurar a Autenticação com GitHub (OAuth)
1. **Criar OAuth App no GitHub:**
   - Acesse o GitHub em **Settings** > **Developer settings** > **OAuth Apps** > **New OAuth App**.
   - **Application name:** `Shortener`
   - **Homepage URL:** URL do seu site (ex: `https://seu-usuario.github.io/shortener/` ou `http://localhost:8000/`)
   - **Authorization callback URL:** Obtenha no Supabase em **Authentication** > **Providers** > **GitHub** > campo **Callback URL (for OAuth)** (formato: `https://<seu-projeto>.supabase.co/auth/v1/callback`).
   - Clique em **Register application**.
   - Gere um **Client Secret** e copie o **Client ID** e o **Client Secret**.

2. **Ativar o Provedor no Supabase:**
   - No painel do Supabase, vá em **Authentication** > **Providers** > **GitHub**.
   - Ative a opção **"Enable GitHub"**.
   - Cole o **Client ID** e o **Client Secret** gerados no GitHub.
   - Clique em **Save**.

3. **Configurar URLs de Redirecionamento no Supabase:**
   - Em **Authentication** > **URL Configuration**:
   - Defina o **Site URL** com o endereço principal (ex: `https://seu-usuario.github.io/shortener/`).
   - Em **Redirect URLs**, adicione todas as URLs autorizadas:
     - `http://localhost:8000/**`
     - `https://seu-usuario.github.io/shortener/**`
   - Clique em **Save**.

---

### Passo 4: Conectar o Código ao seu Supabase
1. No Supabase, vá em **Project Settings** > **API**.
2. Copie a **Project URL** (`https://xxxxxxxx.supabase.co`) e a chave **Project API Keys (anon public)**.
3. Abra o arquivo [`supabase-db.js`](supabase-db.js) no seu projeto e atualize as constantes:

```javascript
// Substitua pelas credenciais do seu projeto Supabase:
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANONIMA_PUBLICA_AQUI";
```

Pronto! Seu projeto agora está totalmente conectado e funcional com seu próprio banco de dados e autenticação.

---

## 📥 Execução Local

```bash
# 1. Clone o repositório
git clone https://github.com/dougretrogames/shortener.git

# 2. Acesse a pasta
cd shortener

# 3. Inicie um servidor local estático:
python -m http.server 8000
# ou
npx serve .
```

Acesse `http://localhost:8000` no seu navegador.

---

## 🌐 Publicação no GitHub Pages

1. No seu repositório no GitHub, acesse **Settings** > **Pages**.
2. Em **Build and deployment** > **Source**, escolha **Deploy from a branch**.
3. Selecione a branch **`master`** (ou `main`) e a pasta **`/(root)`**.
4. Clique em **Save**. Em instantes seu encurtador estará online mundialmente!

---

## 🔐 Especificações Técnicas

| Recurso | Detalhes da Implementação |
| :--- | :--- |
| **Tipo de Aplicação** | Encurtador de Links & Protetor de URLs Criptografadas |
| **Algoritmo de Criptografia** | AES-GCM (Chave de 256 bits via Web Crypto API) |
| **Derivação de Chave** | PBKDF2 (100.000 iterações com SHA-256) |
| **Vetor de Inicialização (IV)** | 12 bytes (96 bits) gerados aleatoriamente |
| **Salt Criptográfico** | 16 bytes (128 bits) gerados aleatoriamente |
| **Formato de Rota** | URLs Limpas (`/apelido` e `/5digitos` via SPA fallback 404) |
| **Gerador Aleatório** | 5 caracteres únicos sem repetição (pool de 60 chars sem `I` e `l`) |
| **Banco de Dados** | Supabase Cloud Database (REST API em tempo real) |
| **Autenticação** | GitHub OAuth com suporte a PKCE |
| **Compatibilidade** | Chrome, Edge, Firefox, Safari, Opera, iOS Safari, Android Chrome |

---

## 🤝 Créditos e Licença

- **Mantido por:** [DougRetroGames](https://github.com/dougretrogames/shortener)
- **Base original inspirada em:** [Jacob Strieb](https://jstrieb.github.io)
- **Licença:** Código aberto sob a licença [MIT](LICENSE).

