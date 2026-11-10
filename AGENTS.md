# Instruções Permanentes para Agentes de IA — Brewer

Bem-vindo ao desenvolvimento do **Brewer**. Este arquivo é a sua âncora de contexto e deve ser lido e respeitado em qualquer conversa ou tarefa neste repositório.

---

## 1. O que é o Brewer?
O Brewer é um web app progressivo (PWA) focado em **gestão de tempo, rotina e foco anti-ansiedade**. Ele transforma blocos de foco em rituais conscientes de café: cada minuto de foco rende grãos que são usados para construir e mobiliar uma **Cafeteria Customizável** isométrica.
* **Stack**: 100% Vanilla JavaScript (ES Modules), HTML5 e CSS3 nativo.
* **Persistência**: `localStorage` sob a chave `brewer.v1`.
* **Hospedagem**: GitHub Pages (`https://vitinho12.github.io/brewer/`).
* **Backend de Notificações**: Cloudflare Worker (`server/worker.js`) para envio Web Push (APNs da Apple).
* **Versão de Produção Atual**: `v41`.

---

## 2. Regras Inegociáveis de Segurança e Fluxo

1. **PROIBIDO `git push` SEM AUTORIZAÇÃO EXPLÍCITA**:
   * Nunca execute `git push` ou publique no GitHub por iniciativa própria.
   * Sempre apresente o que foi feito e pergunte: *"Posso fazer o push para o GitHub?"*. Aguarde a resposta em texto do usuário.

2. **PROTEÇÃO DA VERSÃO EM PRODUÇÃO**:
   * Não altere arquivos principais (`index.html`, `js/*`, `style.css`, `sw.js`) durante fases conceituais ou experimentações visuais.
   * Experimentos visuais ou novas features grandes devem ser desenvolvidos em uma **branch isolada** (`git checkout -b feature/...`) para não colocar rascunhos no ar via GitHub Pages.

3. **SINCRONIZAÇÃO OBRIGATÓRIA DE CACHE PWA**:
   * Sempre que arquivos de produção forem alterados (`index.html`, `js/*`, `style.css`), a versão do cache DEVE ser incrementada no Service Worker (`sw.js`, ex: `brewer-v42`) e sincronizada com as query strings dos assets no `index.html` (ex: `style.css?v=42`).

4. **CONSULTA SOB DEMANDA DA DOCUMENTAÇÃO**:
   * Não carregue todos os arquivos de uma vez para poupar contexto.
   * Consulte a documentação em `docs/` conforme a necessidade:
     * Regras visuais e cores: consulte `docs/DESIGN_SYSTEM.md`.
     * Arquitetura e estado global: consulte `docs/ARCHITECTURE.md`.
     * Filosofia e tom de voz do produto: consulte `docs/PRODUCT_BRIEF.md`.
     * Histórico de decisões e itens em aberto: consulte `docs/DECISIONS.md`.

---

## 3. Filosofia de Fluxo Contínuo (Sem fragmentação de chats)

1. **TRABALHO CONTÍNUO NA MESMA CONVERSA (PROIBIDO MANDAR ABRIR NOVO CHAT)**:
   * **NÃO** sugira abrir um novo chat ao final de cada resposta ou tarefa. O usuário deve conseguir trabalhar continuamente na mesma sala de conversa para tarefas relacionadas.
   * Conduza cada tarefa do início ao fim no mesmo chat: **Plano (/plan) $\to$ Código $\to$ Teste $\to$ Commit $\to$ Próxima tarefa**.

2. **QUANDO USAR O COMANDO `/compact`**:
   * Se o histórico da conversa estiver muito longo ou o contexto estiver pesado, sugira ao usuário utilizar o comando nativo `/compact` para enxugar o histórico sem precisar sair da conversa.
   * Novos chats só devem ser sugeridos em casos excepcionais (ex: mudança total de domínio, como sair do frontend e ir configurar Cloudflare/DNS externo).

3. **COMUNICAÇÃO COM O USUÁRIO**:
   * O usuário prefere explicações acessíveis, didáticas e sem jargões desnecessários.
   * Ao concluir uma etapa, apresente o resultado com clareza e pergunte qual é a próxima melhoria que ele gostaria de priorizar.
