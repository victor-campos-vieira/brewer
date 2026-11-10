# Registro de Decisões e Tópicos em Aberto — Brewer

## 1. Decisões Consolidadas (Fatos e Histórico)

1. **Separação do projeto "Onda"**:
   - O Brewer nasceu como um projeto independente, abandonando a temática náutica (ondas/pranchas) para abraçar a temática de café artesanal e foco anti-ansiedade.
   - Usa namespace isolado (`brewer.v1`) no `localStorage` para nunca colidir com dados de outros apps na mesma origem.

2. **Stack Vanilla JS e Sem Servidor Próprio de Banco**:
   - O app roda 100% como PWA estático, leve e independente, sem custos de servidor e com tempo de carregamento instantâneo no celular.

3. **Arquitetura de Notificações com Cloudflare**:
   - Devido às restrições severas do iOS Safari para PWAs, notificações no app fechado utilizam um Cloudflare Worker leve (`server/worker.js`) que envia Web Push via VAPID para a Apple (APNs).

4. **Transição de Xícaras para a Cafeteria Customizável (v35)**:
   - A mecânica de 7 xícaras foi substituída na versão v35 por uma **Cafeteria Customizável** isométrica a 30° (`js/views/cafe.js`), com pisos, paredes e móveis alimentados pelo catálogo central em `assets/cafe/v2/catalog.js`.
   - Cada minuto de foco rende grãos de café, que funcionam como moeda de troca na lojinha.

5. **Modo Pomodoro Café Refinado (v38 - v41)**:
   - Implementado o timer Pomodoro com presets, sliders, transições sonoras e o gate-lock contra distrações de redes sociais (`gate.html`). Versão de produção atual estabilizada em **v41**.

---

## 2. Tópicos em Aberto (Roadmap de Melhorias para o Futuro)

1. **Segurança de Dados (Backup & Restore)**:
   - *Status*: Alta prioridade.
   - *Proposta*: Criar botão de exportar/importar backup JSON nas configurações para evitar perda acidental do progresso do usuário no Safari.

2. **Modularização do Motor da Cafeteria**:
   - *Status*: Média prioridade.
   - *Proposta*: Fatiar `js/views/cafe.js` (atualmente com 72 KB) em módulos menores (`cafe-render.js`, `cafe-shop.js`, `cafe-state.js`) para facilitar a manutenção da IA e evitar regressões.

3. **Pré-carregamento Inteligente de Sprites (Prefetch)**:
   - *Status*: Média prioridade.
   - *Proposta*: Garantir que itens equipados da cafeteria carreguem instantaneamente mesmo em conexões lentas móveis.

4. **Nuvem e Multi-dispositivos (Visão de Produto Comercial)**:
   - *Status*: Futuro (etapa comercial).
   - *Proposta*: Adicionar autenticação leve (Apple ID / Google) conectada a um banco como Supabase para sincronizar a cafeteria entre computador e celular.
