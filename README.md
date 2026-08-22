# Link Lock 🔒 (Fork Moderno em Português)

> **Proteja URLs e links com senha usando criptografia AES-256 no navegador.**

Interface modernizada com **tema escuro**, design responsivo elegante, suporte a **links personalizados com verificação de duplicidade** e **100% em Português do Brasil (PT-BR)**.

[👉 Veja no GitHub](https://github.com/dougretrogames/link-lock)

---

## 🌟 Recursos

- **Criptografia Militar no Cliente:** Criptografia `AES-256-GCM` com derivação de chave `PBKDF2` (100.000 iterações de `SHA-256`) através da API nativa `SubtleCrypto` do navegador.
- **Links Personalizados & Verificação de Duplicidade:** Crie apelidos personalizados para seus links (ex: `/#meu-link@...`) com checagem em tempo real para evitar links duplicados e gerenciamento de histórico local.
- **Privacidade Total:** Toda a informação necessária fica armazenada no próprio fragmento (`#hash`) da URL. Nenhum dado é enviado a servidores, sem banco de dados, sem cookies, sem rastreamento e sem cadastro.
- **Tema Escuro Moderno:** Interface visual contemporânea com cartões em vidro fosco (*glassmorphism*), navegação unificada, alternância de visibilidade de senha e feedback tátil.
- **Favoritos Ocultos (Disfarçados):** Suporte à criação de links disfarçados na barra de favoritos para abertura discreta via bookmarklet.
- **Inspeção Segura:** Descriptografe links sem redirecionamento automático para verificar a legitimidade da URL de destino antes de abri-la.
- **Totalmente em Português do Brasil:** Textos, formulários, dicas, validações e alertas adaptados para PT-BR.

---

## 🚀 Como Usar

1. **Criar Link Protegido (`/create`):**
   - Insira o link de destino (ex: `https://...`).
   - (Opcional) Defina um apelido/slug personalizado (com checagem instantânea se já existe).
   - (Opcional) Adicione uma dica para lembrar a senha.
   - Digite e confirme a senha.
   - Clique em **"Criptografar e Gerar Link"** e copie a URL gerada.

2. **Desbloquear Link (`/#...`):**
   - Ao acessar o link criptografado, o usuário visualiza o apelido personalizado e é convidado a digitar a senha.
   - Se a senha estiver correta, é feito o redirecionamento imediato para o destino seguro.

3. **Descriptografar sem Redirecionar (`/decrypt`):**
   - Permite colar o link e verificar a URL original sem abrir o site automaticamente.

4. **Criar Favoritos Ocultos (`/hidden`):**
   - Disfarce o link como uma página inocente (ex: Wikipédia ou Gmail) e abra com o botão de descriptografia.

5. **Teste Educacional de Força Bruta (`/bruteforce`):**
   - Demonstração prática da resistência de links criptografados contra ataques automatizados.

---

## 🔒 Segurança e Isenção de Responsabilidade

- A criptografia é executada inteiramente no cliente.
- Caso a senha seja perdida, é matematicamente inviável recuperar o link original sem força bruta massiva.
- Uma vez que alguém descriptografa um link, essa pessoa tem acesso à URL de destino. Compartilhe links protegidos apenas com pessoas de sua confiança.

---

## 🤝 Créditos e Licença

- Mantido por [DougRetroGames](https://github.com/dougretrogames/link-lock).
- Projeto original criado por [Jacob Strieb](https://jstrieb.github.io).
- Código aberto sob a licença [MIT](LICENSE).
