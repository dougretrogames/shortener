# Encurtador de Links 🔒

> **Proteja e encurte URLs com senha usando criptografia AES-256 de padrão militar diretamente no navegador.**

Uma aplicação web moderna com **tema escuro**, visual sofisticado, **totalmente responsiva para celulares e computadores**, suporte a **login opcional com Google, GitHub e Outlook**, **painel de controle (Dashboard)** com contador de cliques, **links personalizados com verificação instantânea de duplicidade** e **100% em Português do Brasil (PT-BR)**.

[👉 Veja no GitHub](https://github.com/dougretrogames/encurtador)

---

## 🌟 Principais Funcionalidades

### 1. 🛡️ Criptografia Militar no Lado do Cliente (100% Client-Side)
- Toda a criptografia e descriptografia ocorre localmente no seu dispositivo utilizando a API padrão [`SubtleCrypto`](https://developer.mozilla.org/pt-BR/docs/Web/API/SubtleCrypto).
- Emprega **AES-256-GCM** para proteção de dados e **PBKDF2** com **100.000 iterações** de **SHA-256** para derivação segura de chaves a partir da senha digitada.
- Suporte a **Vetor de Inicialização (IV) aleatório** e **Salt criptográfico** para proteção contra tabelas rainbow e ataques de dicionário.

### 2. 🔑 Login Opcional Social (Google, GitHub, Outlook / Microsoft)
- **Zero Obrigatoriedade:** Usuários que valorizam anonimato total podem usar o site sem login (modo visitante / armazenamento local).
- **Conexão Rápida:** Conecte sua conta do Google, GitHub ou Microsoft para obter avatar de perfil, sincronização e acesso à sua Dashboard dedicada em qualquer dispositivo.

### 3. 📊 Painel de Controle & Dashboard de Gerenciamento (`/painel`)
- **Métricas e KPIs:** Acompanhe total de links criados, contagem acumulada de cliques, link mais acessado e média de acessos.
- **Rastreamento de Cliques:** Cada vez que um link protegido é aberto e descriptografado, o contador de acessos é atualizado em tempo real.
- **Edição de Links:** Altere o apelido (slug), atualize a URL de destino ou edite a dica de senha com checagem automática de duplicidade.
- **Busca e Filtros:** Pesquise instantaneamente por nome, URL ou dica, e ordene por data ou cliques.
- **Exportação de Dados:** Faça download do backup de todos os seus links em formatos **JSON** ou planilha **CSV**.

### 4. 🏷️ Links Personalizados & Apelidos Exclusivos
- Crie links identificáveis com apelidos amigáveis no formato:  
  `https://[seu-site]/#[apelido-personalizado]@[dados_criptografados]`
- Na tela de desbloqueio, o usuário final visualiza um badge de destaque com o nome do link antes de digitar a senha (ex: `Link: projeto-secreto`).

### 5. ⚡ Verificação de Duplicidade em Tempo Real
- Enquanto você digita o apelido personalizado, o sistema verifica instantaneamente se o link já foi criado anteriormente:
  - 🟢 **Disponível:** Confirma que o apelido está livre para uso.
  - 🟡 **Aviso de Duplicidade:** Alerta caso você já tenha criado um link com o mesmo apelido, informando a data/hora da criação anterior e prevenindo sobreescritas acidentais.

### 6. 👁️ Alternância de Visibilidade de Senhas
- Botões interativos com ícone de olho em todos os campos de senha para alternar facilmente entre modo oculto e visível, facilitando a digitação no celular e desktop.

### 7. 📱 Totalmente Adaptado para Dispositivos Móveis
- **Prevenção de Zoom no iOS Safari:** Inputs com tipografia dimensionada em 16px para evitar que iPhones apliquem zoom automático indesejado.
- **Navegação Deslizável:** Menu horizontal deslizável por toque (*touch-scroll*) suave.
- **Alvos de Toque Ergonômicos:** Botões, campos e checkboxes com altura mínima de 44px para facilidade de uso com o polegar.
- Suporte a entalhes (*notches* / *Dynamic Island*) em celulares modernos com `env(safe-area-inset-*)`.

### 8. 🕵️ Inspeção Segura sem Redirecionamento (`/descriptografar`)
- Permite colar qualquer link criptografado e descriptografá-lo manualmente para inspecionar o destino real antes de abrir no navegador.

### 9. 🔖 Favoritos Ocultos e Disfarçados (`/favoritos-ocultos`)
- Técnica de *Bookmark Knocking* para disfarçar links confidenciais como páginas inofensivas na sua barra de favoritos (ex: artigos da Wikipédia em português ou páginas comuns).

### 10. 🧪 Teste Educacional de Força Bruta (`/forca-bruta`)
- Ferramenta de prova de conceito que demonstra em tempo real a resistência dos links protegidos contra tentativas automatizadas de quebra de senha.

---

## 🚀 Como Usar o Encurtador de Links

### 1. Criando um Link Protegido
1. Acesse a página **Criar Link** (`/criar`).
2. Digite a **URL de Destino** (ex: `https://meu-site.com/conteudo-secreto`).
3. *(Opcional)* Defina um **Apelido Personalizado** (o sistema verificará a disponibilidade automaticamente).
4. *(Opcional)* Insira uma **Dica de Senha** para ajudar a lembrar a senha futuramente.
5. Digite e confirme a **Senha de Proteção**.
6. Clique no botão **"Criptografar e Gerar Link"**.
7. Copie o link gerado ou teste-o diretamente em uma nova aba!

### 2. Gerenciando seus Links no Painel (`/painel`)
1. Acesse o menu **Painel** no topo da página.
2. Veja o número de vezes que cada link foi clicado.
3. Clique em **Editar** para trocar o apelido ou destino do link.
4. Utilize a barra de busca para encontrar links rapidamente ou clique em **Exportar JSON/CSV** para salvar cópias de segurança.

### 3. Desbloqueando um Link
1. Ao abrir o link gerado (`/#...` ou `/#apelido@...`), a tela de desbloqueio será exibida.
2. Caso o link possua uma dica ou apelido personalizado, eles serão mostrados na tela.
3. Digite a senha correta e clique em **"Desbloquear Link"** (ou pressione `Enter`).
4. O clique será contabilizado no seu Painel e o navegador será redirecionado imediatamente para o destino seguro.

---

## 📥 Instalação e Execução Local (Git Clone)

Como a aplicação é 100% estática (HTML, CSS e JavaScript puros), você não precisa instalar nenhuma dependência pesada para rodá-la localmente.

### Passo a passo:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/dougretrogames/encurtador.git
   ```

2. **Acesse a pasta do projeto:**
   ```bash
   cd encurtador
   ```

3. **Abra a aplicação:**
   - **Opção 1 (Direto no Navegador):** Dê um duplo clique no arquivo `index.html` ou abra-o em qualquer navegador.
   - **Opção 2 (Com Servidor Local - Recomendado para testar APIs do navegador):**
     - Com **Python 3**:
       ```bash
       python -m http.server 8000
       ```
     - Com **Node.js**:
       ```bash
       npx serve .
       ```
     - Com **VS Code**: Utilize a extensão *Live Server*.
   - Acesse `http://localhost:8000` no seu navegador.

---

## 🌐 Como Habilitar o GitHub Pages (Publicação Gratuita)

Você pode hospedar o seu **Encurtador de Links** gratuitamente utilizando o **GitHub Pages**. Siga os passos abaixo:

1. Acesse o seu repositório no GitHub:  
   👉 `https://github.com/dougretrogames/encurtador`
2. Clique na aba **Settings** (Configurações) no menu superior do repositório.
3. No menu lateral esquerdo, clique na opção **Pages** (dentro da seção *Code and automation*).
4. Na seção **Build and deployment**:
   - Em **Source**, selecione a opção **Deploy from a branch**.
   - Em **Branch**, selecione o ramo **`master`** (ou `main`) e a pasta **`/(root)`**.
5. Clique no botão **Save**.
6. Aguarde cerca de 1 a 2 minutos para que o GitHub conclua a publicação.
7. Recarregue a página de configurações do GitHub Pages e seu link público estará ativo no topo, no formato:  
   👉 **`https://dougretrogames.github.io/encurtador/`**

---

## 🔐 Especificações Técnicas e Algoritmos

| Recurso | Detalhes da Implementação |
| :--- | :--- |
| **Algoritmo de Criptografia** | AES-GCM (Chave de 256 bits) |
| **Derivação de Chave** | PBKDF2 (100.000 iterações com SHA-256) |
| **Vetor de Inicialização (IV)** | 12 bytes gerados via `window.crypto.getRandomValues` |
| **Salt Criptográfico** | 16 bytes gerados aleatoriamente |
| **Provedores de Login Social** | Google, GitHub, Outlook / Microsoft (Opcionais) |
| **Rastreamento de Analytics** | Cliques totais, data de último acesso e histórico |
| **Codificação de URL** | Base64 URL-Safe em formato JSON |
| **Armazenamento de Histórico** | `localStorage` do navegador e nuvem |
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
