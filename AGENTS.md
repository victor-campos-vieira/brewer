# Instruções Permanentes para Agentes de IA — Brewer

Bem-vindo ao desenvolvimento do **Brewer**. Este arquivo é a sua âncora de contexto e deve ser lido e respeitado em qualquer conversa ou tarefa neste repositório.

---

## 1. O que é o Brewer?
O Brewer é um web app progressivo (PWA) focado em **gestão de tempo, rotina e foco anti-ansiedade**. Ele transforma blocos de foco em rituais conscientes de café (cada bloco completo é uma xícara/recompensa colhida). 
* **Stack**: 100% Vanilla JavaScript (ES Modules), HTML5 e CSS3 nativo.
* **Persistência**: `localStorage` sob a chave `brewer.v1`.
* **Hospedagem**: GitHub Pages (`https://vitinho12.github.io/brewer/`).
* **Backend de Notificações**: Cloudflare Worker (`server/worker.js`) para envio Web Push (APNs da Apple).

---

## 2. Regras Inegociáveis de Segurança e Fluxo

1. **PROIBIDO `git push` SEM AUTORIZAÇÃO EXPLÍCITA**:
   * Nunca execute `git push` ou publique no GitHub por iniciativa própria.
   * Sempre apresente o que foi feito e pergunte: *"Posso fazer o push para o GitHub?"*. Aguarde a resposta em texto do usuário.

2. **PROTEÇÃO DA VERSÃO EM PRODUÇÃO**:
   * Não altere arquivos principais (`index.html`, `js/*`, `style.css`, `sw.js`) durante fases conceituais ou experimentações visuais.
   * Experimentos visuais ou testes devem ser realizados em uma **branch isolada** (`git checkout -b feature/...`) para não colocar rascunhos no ar via GitHub Pages.

3. **CONSULTA SOB DEMANDA DA DOCUMENTAÇÃO**:
   * Não carrege todos os arquivos de uma vez para não estourar o contexto da IA.
   * Consulte a documentação em `docs/` conforme a necessidade:
     * Regras visuais e cores: consulte `docs/DESIGN_SYSTEM.md`.
     * Dúvidas de arquitetura ou estado global: consulte `docs/ARCHITECTURE.md`.
     * Filosofia e tom de voz do produto: consulte `docs/PRODUCT_BRIEF.md`.
     * Histórico de decisões e itens em aberto: consulte `docs/DECISIONS.md`.

4. **COMUNICAÇÃO COM O USUÁRIO (REGRA DE FLUXO ATIVO)**:
   * O usuário está aprendendo a coordenar o desenvolvimento assistido por IA e prefere explicações acessíveis, sem tecnicismos excessivos.
   * **OBRIGATÓRIO AO FINAL DE CADA RESPOSTA/ETAPA**:
     * Sugira sempre de forma proativa o **próximo melhor passo de fluxo**.
     * Indique claramente quando for o momento ideal de **abrir um novo chat** para manter o contexto leve e evitar misturar assuntos.
     * Destaque eventuais limitações, pontos de atenção ou sugestões práticas.
