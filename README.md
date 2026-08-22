# Encurtador de Links 🔒

> **Proteja e encurte URLs com senha usando criptografia AES-256 de padrão militar diretamente no navegador.**

Uma aplicação web moderna com **tema escuro**, visual sofisticado, **totalmente responsiva para celulares e computadores**, suporte a **autenticação com GitHub**, **painel de controle (Dashboard)** com contador de cliques, **links curtos 100% limpos (`/apelido` ou `/5digitos`)**, **banco de dados em nuvem Supabase em tempo real**, **verificação global instantânea de duplicidade** e **100% em Português do Brasil (PT-BR)**.

[👉 Acesse o Repositório no GitHub](https://github.com/dougretrogames/encurtador) | [🚀 Teste a Aplicação Online](https://dougretrogames.github.io/encurtador/criar/)

---

## 🌟 Principais Funcionalidades

### 1. 🛡️ Criptografia Militar no Lado do Cliente (100% Client-Side)
- Toda a criptografia e descriptografia ocorre localmente no seu dispositivo utilizando a API nativa [`SubtleCrypto`](https://developer.mozilla.org/pt-BR/docs/Web/API/SubtleCrypto).
- Emprega **AES-256-GCM** para proteção de dados e **PBKDF2** com **100.000 iterações** de **SHA-256** para derivação segura de chaves a partir da senha digitada.
- Suporte a **Vetor de Inicialização (IV) aleatório de 96 bits** e **Salt criptográfico de 128 bits** para proteção contra tabelas rainbow e ataques de dicionário.

### 2. 🔗 Links Curtos 100% Limpos e Elegantes (`/apelido` e `/5digitos`)
- **URLs Ultra-Curtas (Sem `#`):** Links limpos e profissionais:
  - Com apelido personalizado: `https://dougretrogames.github.io/encurtador/retrogamebox-vip`
  - Automático com 5 dígitos: `https://dougretrogames.github.io/encurtador/6x8qt`
- **Zero Exposição de Chave:** A chave criptografada não fica visível na barra de endereços do link compartilhado.

### 3. 🎲 Gerador Automático de Códigos de 5 Dígitos
- Se nenhum apelido for digitado, o sistema gera automaticamente um código único de **5 caracteres**:
  - **Pool de 60 Caracteres:** Maiúsculas (`A-Z` sem o `I`), Minúsculas (`a-z` sem o `l`) e Números (`0-9`).
  - **Sem Repetição Interna:** Os 5 dígitos sorteados são estritamente distintos entre si.
  - **Legibilidade Total:** As letras `I` maiúsculo e `l` minúsculo foram excluídas para evitar qualquer ambiguidade visual com `1` ou `l`.

### 4. ⚡ Banco de Dados em Nuvem em Tempo Real (Supabase)
- Todos os links criados por **qualquer visitante no mundo** são salvos instantaneamente (tempo de resposta de ~50ms) no Supabase.
- **Segurança Máxima:** O banco de dados armazena apenas o *ciphertext* cifrado em AES-256 com Salt e IV. É matematicamente impossível descobrir a URL de destino sem a senha correta.
- **Zero Dependência de Commits:** Não requer commits manuais no repositório; os links ficam disponíveis mundialmente no exato momento do clique.

### 5. 🌐 Validação Global de Unicidade em Tempo Real
- Impede colisões de links entre todos os usuários:
  - Consulta o banco em nuvem Supabase e o armazenamento local.
  - Alerta imediatamente se um apelido já estiver em uso: `❌ O apelido "..." já está em uso por outro link cadastrado.`
  - Garante que códigos automáticos de 5 dígitos sejam sempre 100% inéditos no mundo.

### 6. ⚠️ Tela Modal de Confirmação de Exclusão Permanente
- Ao excluir um link ou limpar o histórico, uma tela modal de segurança avisa com destaque:
  - Tag visual: `⚠️ AÇÃO PERMANENTE E IRREVERSÍVEL`.
  - Exibe o identificador do link a ser apagado.
  - Alerta explícito de que o link será **excluído permanentemente** e não poderá ser recuperado, liberando o apelido para novos cadastros.

### 7. 🔑 Autenticação com GitHub & Dashboard (`/painel`)
- **Login Opcional:** Conecte sua conta do GitHub para gerenciar links e acompanhar estatísticas de cliques.
- **Métricas e KPIs:** Acompanhe contagem de cliques em tempo real, link mais acessado e histórico detalhado.
- **Edição e Exportação:** Edite destinos, altere dicas e exporte relatórios em **JSON** e planilha **CSV** (com sanitização contra injeção de fórmulas CWE-1236).

### 8. 👁️ Alternância de Visibilidade de Senhas & Design Responsivo
- Botões de alternância de visualização de senha com correção de sobreposição para Microsoft Edge/Chromium.
- Layout 100% responsivo com cabeçalho perfeitamente centralizado e otimizado para celulares, tablets e desktops (suporte a iOS safe areas e touch scroll suave).

### 9. 🕵️ Descriptografar (`/descriptografar`), Favoritos Ocultos (`/favoritos-ocultos`) e Força Bruta (`/forca-bruta`)
- **Descriptografar Manual:** Inspecione destinos de links sem redirecionamento automático.
- **Bookmark Knocking:** Disfarce links confidenciais na barra de favoritos do navegador.
- **Teste de Força Bruta:** Ferramenta educacional interativa de demonstração de resistência criptográfica.

---

## 🚀 Como Usar o Encurtador de Links

### 1. Criando um Link Protegido
1. Acesse a página **Criar Link** (`/criar/`).
2. Digite a **URL de Destino** (ex: pasta do Google Drive, arquivo ou página web).
3. *(Opcional)* Defina um **Apelido Personalizado** (ou deixe em branco para gerar um código automático de 5 dígitos).
4. *(Opcional)* Insira uma **Dica de Senha**.
5. Digite e confirme a **Senha de Proteção** (opcional caso queira apenas encurtar).
6. Clique em **"Criptografar e Gerar Link"**.
7. Copie o link curto gerado (ex: `https://dougretrogames.github.io/encurtador/retrogamebox-vip` ou `/6x8qt`).

### 2. Desbloqueando um Link
1. Acesse o link encurtado.
2. A página carregará os parâmetros seguros via Supabase.
3. Digite a senha correta e clique em **"Desbloquear Link"** (ou pressione `Enter`).
4. O navegador descriptografará o destino localmente e redirecionará com segurança!

---

## 📥 Instalação e Execução Local

Por ser uma aplicação 100% estática (HTML, CSS e JavaScript puros), não requer instalação de pacotes pesados de backend.

```bash
# 1. Clone o repositório
git clone https://github.com/dougretrogames/encurtador.git

# 2. Acesse a pasta
cd encurtador

# 3. Inicie um servidor local (escolha um):
python -m http.server 8000
# ou
npx serve .
```

Acesse `http://localhost:8000` no seu navegador.

---

## 🌐 Publicação no GitHub Pages

1. Acesse as **Configurações (Settings)** do seu repositório no GitHub.
2. No menu lateral, clique em **Pages**.
3. Em **Source**, selecione **Deploy from a branch**.
4. Em **Branch**, selecione a branch **`master`** e a pasta **`/(root)`**.
5. Clique em **Save**. Seu site estará disponível em instantes em:  
   👉 **`https://dougretrogames.github.io/encurtador/`**

---

## 🔐 Especificações Técnicas

| Recurso | Detalhes da Implementação |
| :--- | :--- |
| **Algoritmo de Criptografia** | AES-GCM (Chave de 256 bits) |
| **Derivação de Chave** | PBKDF2 (100.000 iterações com SHA-256) |
| **Vetor de Inicialização (IV)** | 12 bytes (96 bits) gerados via `window.crypto.getRandomValues` |
| **Salt Criptográfico** | 16 bytes (128 bits) gerados aleatoriamente |
| **Formato de Rota** | Roteamento Direto (`/apelido` e `/5digitos` via 404 router) |
| **Gerador Aleatório** | 5 dígitos únicos sem repetição (pool de 60 chars sem `I` e `l`) |
| **Banco de Dados** | Supabase Cloud Database (REST API em tempo real) |
| **Validação de Unicidade** | Verificação em tempo real no Supabase + Cache Local |
| **Compatibilidade** | Chrome, Edge, Firefox, Safari, Opera, iOS Safari, Android Chrome |

---

## 🤝 Créditos e Licença

- **Mantido por:** [DougRetroGames](https://github.com/dougretrogames/encurtador)
- **Base original inspirada em:** [Jacob Strieb](https://jstrieb.github.io)
- **Licença:** Código aberto sob a licença [MIT](LICENSE).
