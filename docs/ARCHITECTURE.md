# Arquitetura e Engenharia — Brewer

## 1. Visão Geral da Stack
O Brewer foi desenhado para ser extremamente leve, rápido e resiliente, rodando como uma Progressive Web App (PWA) pura.

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5 e CSS3 nativo. Sem bibliotecas de renderização (sem React, Vue, Svelte) e sem build step (sem Webpack/Vite).
- **Armazenamento**: LocalStorage do navegador sob a chave `brewer.v1`.
- **Hospedagem Frontend**: GitHub Pages a partir da branch `main`.
- **Notificações**: Cloudflare Worker (`server/worker.js`) via Web Push API (Apple APNs / VAPID).

---

## 2. Estrutura de Pastas e Módulos

```text
brewer v2/
├── index.html          # Ponto de entrada, marcação das abas, dialogs e barra de navegação
├── style.css           # Design system completo, variáveis e 10 temas de torra
├── manifest.json       # Manifesto PWA (ícones, nome, cores de status bar)
├── sw.js               # Service Worker para funcionamento offline e cache
├── AGENTS.md           # Instruções permanentes para agentes de IA
├── .agents/            # Regras e convenções do Antigravity
│   └── rules/          # Guardrails e padrões do projeto
├── docs/               # Documentação técnica e de produto sob demanda
├── assets/             # Mídias locais (áudios de chuva/café, xícaras WebP)
├── server/             # Código do Cloudflare Worker para Web Push
└── js/                 # Código-fonte JavaScript modular
    ├── app.js          # Roteamento de abas, ciclo de vida e eventos de UI
    ├── state.js        # Estado global centralizado (objeto S) e persistência
    ├── sync.js         # Integrações (Google Calendar API v3)
    ├── media.js        # Motor de áudio de fundo (ruído branco/chuva)
    ├── notifications.js# Gerenciamento de permissões e envio para o Worker
    ├── utils.js        # Funções puras (datas, formatação de tempo, strings)
    └── views/          # Lógica e renderização de cada aba
        ├── hoje.js     # Painel principal do dia e blocos imediatos
        ├── agenda.js   # Calendário diário e integração com Google Agenda
        ├── tarefas.js  # Gerenciador de tarefas com categorias e prazos
        ├── foco.js     # Cronômetro de foco e detecção de tela bloqueada
        ├── vontade.js  # Gatilho de contenção de impulsos e respiração
        ├── colecao.js  # Prateleira de xícaras e catálogo
        ├── revisao.js  # Revisão noturna, tempo de tela e estatísticas
        └── jornada.js  # Progresso pelas fases de torra e metas semanais
```

---

## 3. Fluxo de Estado (`js/state.js`)
- O estado de todo o app reside em um único objeto global: `export var S = { ... }`.
- Qualquer mutação de dados é seguida pela chamada de `save()`, que serializa `S` em JSON e armazena em `localStorage.setItem('brewer.v1', ...)`.
- As abas leem `S` diretamente e re-renderizam seu HTML quando chamadas pela função `render()` em `js/app.js`.
