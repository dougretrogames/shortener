# Encurtador de Links 🔒

> **Proteja e encurte URLs com senha usando criptografia AES-256 de padrão militar diretamente no navegador.**

Uma aplicação web moderna com **tema escuro**, visual sofisticado, **totalmente responsiva para celulares e computadores**, suporte a **links personalizados com verificação instantânea de duplicidade** e **100% em Português do Brasil (PT-BR)**.

[👉 Veja no GitHub](https://github.com/dougretrogames/encurtador)

---

## 🌟 Principais Funcionalidades

### 1. 🛡️ Criptografia Militar no Lado do Cliente (100% Client-Side)
- Toda a criptografia e descriptografia ocorre localmente no seu dispositivo utilizando a API padrão [`SubtleCrypto`](https://developer.mozilla.org/pt-BR/docs/Web/API/SubtleCrypto).
- Emprega **AES-256-GCM** para proteção de dados e **PBKDF2** com **100.000 iterações** de **SHA-256** para derivação segura de chaves a partir da senha digitada.
- Suporte a **Vetor de Inicialização (IV) aleatório** e **Salt criptográfico** para proteção contra tabelas rainbow e ataques de dicionário.

### 2. 🏷️ Links Personalizados & Apelidos Exclusivos
- Crie links identificáveis com apelidos amigáveis no formato:  
  `https://[seu-site]/#[apelido-personalizado]@[dados_criptografados]`
- Na tela de desbloqueio, o usuário final visualiza um badge de destaque com o nome do link antes de digitar a senha (ex: `Link: projeto-secreto`).

### 3. ⚡ Verificação de Duplicidade em Tempo Real
- Enquanto você digita o apelido personalizado, o sistema verifica instantaneamente se o link já foi criado anteriormente:
  - 🟢 **Disponível:** Confirma que o apelido está livre para uso.
  - 🟡 **Aviso de Duplicidade:** Alerta caso você já tenha criado um link com o mesmo apelido, informando a data/hora da criação anterior e prevenindo sobreescritas acidentais.

### 4. 📋 Gerenciador de Links Salvos & Histórico Local
- Painel integrado no criador de links listando todos os links personalizados salvos localmente no seu navegador (`localStorage`).
- Permite visualizar a URL de destino, data de criação, copiar o link com um clique, testar ou remover links individualmente.

### 5. 👁️ Alternância de Visibilidade de Senhas
- Botões interativos com ícone de olho em todos os campos de senha para alternar facilmente entre modo oculto e visível, facilitando a digitação no celular e desktop.

### 6. 📱 Totalmente Adaptado para Dispositivos Móveis
- **Prevenção de Zoom no iOS Safari:** Inputs com tipografia dimensionada em 16px para evitar que iPhones apliquem zoom automático indesejado.
- **Navegação Deslizável:** Menu horizontal deslizável por toque (*touch-scroll*) suave.
- **Alvos de Toque Ergonômicos:** Botões, campos e checkboxes com altura mínima de 44px para facilidade de uso com o polegar.
- Suporte a entalhes (*notches* / *Dynamic Island*) em celulares modernos com `env(safe-area-inset-*)`.

### 7. 🕵️ Inspeção Segura sem Redirecionamento (`/decrypt`)
- Permite colar qualquer link criptografado e descriptografá-lo manualmente para inspecionar o destino real antes de abrir no navegador.

### 8. 🔖 Favoritos Ocultos e Disfarçados (`/hidden`)
- Técnica de *Bookmark Knocking* para disfarçar links confidenciais como páginas inofensivas na sua barra de favoritos (ex: artigos da Wikipédia em português ou páginas comuns).

### 9. 🧪 Teste Educacional de Força Bruta (`/bruteforce`)
- Ferramenta de prova de conceito que demonstra em tempo real a resistência dos links protegidos contra tentativas automatizadas de quebra de senha.

### 10. 🔒 Privacidade Absoluta
- **Sem Servidor de Banco de Dados:** Nada é transmitido para servidores de terceiros.
- **Sem Rastreamento:** Zero cookies, sem telemetria e sem necessidade de cadastro ou login.

---

## 🚀 Como Usar o Encurtador de Links

### 1. Criando um Link Protegido
1. Acesse a página **Criar Link** (`/create`).
2. Digite a **URL de Destino** (ex: `https://meu-site.com/conteudo-secreto`).
3. *(Opcional)* Defina um **Apelido Personalizado** (o sistema verificará a disponibilidade automaticamente).
4. *(Opcional)* Insira uma **Dica de Senha** para ajudar a lembrar a senha futuramente.
5. Digite e confirme a **Senha de Proteção**.
6. Clique no botão **"Criptografar e Gerar Link"**.
7. Copie o link gerado ou teste-o diretamente em uma nova aba!

### 2. Desbloqueando um Link
1. Ao abrir o link gerado (`/#...` ou `/#apelido@...`), a tela de desbloqueio será exibida.
2. Caso o link possua uma dica ou apelido personalizado, eles serão mostrados na tela.
3. Digite a senha correta e clique em **"Desbloquear Link"** (ou pressione `Enter`).
4. O navegador será redirecionado imediatamente para o destino seguro.

### 3. Inspecionando um Link Desconhecido
1. Acesse a ferramenta **Descriptografar** (`/decrypt`).
2. Cole a URL criptografada e a senha fornecida.
3. Clique em **"Descriptografar"** para visualizar a URL original sem ser redirecionado automaticamente.

---

## 🔐 Especificações Técnicas e Algoritmos

| Recurso | Detalhes da Implementação |
| :--- | :--- |
| **Algoritmo de Criptografia** | AES-GCM (Chave de 256 bits) |
| **Derivação de Chave** | PBKDF2 (100.000 iterações com SHA-256) |
| **Vetor de Inicialização (IV)** | 12 bytes gerados via `window.crypto.getRandomValues` |
| **Salt Criptográfico** | 16 bytes gerados aleatoriamente |
| **Codificação de URL** | Base64 URL-Safe em formato JSON |
| **Armazenamento de Histórico** | `localStorage` do navegador (estritamente local) |
| **Compatibilidade** | Todos os navegadores modernos (Chrome, Firefox, Safari, Edge, Opera, navegadores móveis Android/iOS) |

---

## ⚠️ Isenção de Responsabilidade e Dicas de Segurança

- **Guarde bem a sua senha:** Devido à forte segurança criptográfica do algoritmo AES-256, se você esquecer a senha, é matematicamente impossível recuperar o link original.
- **Compartilhamento consciente:** Uma vez que o destinatário desbloqueia o link com a senha correta, ele terá acesso à URL final. Compartilhe links protegidos apenas com pessoas de sua confiança.
- **Navegação Anônima:** Para manter sigilo total ao acessar links confidenciais, utilize abas anônimas para que o endereço de destino não fique salvo no histórico de navegação local.

---

## 🤝 Créditos e Licença

- **Mantido por:** [DougRetroGames](https://github.com/dougretrogames/encurtador)
- **Base original criada por:** [Jacob Strieb](https://jstrieb.github.io)
- **Licença:** Código aberto sob a licença [MIT](LICENSE).
