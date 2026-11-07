# Registro de Decisões e Tópicos em Aberto — Brewer

## 1. Decisões Consolidadas (Fatos e Histórico)

1. **Separação do projeto "Onda"**:
   - O Brewer nasceu como um projeto independente, abandonando a temática náutica (ondas/pranchas) para abraçar a temática de café artesanal e xícaras.
   - Usa namespace isolado (`brewer.v1`) para nunca colidir com dados de outros apps na mesma origem.

2. **Stack Vanilla JS e Sem Servidor Próprio de Banco**:
   - Decidiu-se manter o app estático, leve e independente, sem custos de hospedagem de banco de dados e com tempo de carregamento instantâneo no celular.

3. **Arquitetura de Notificações com Cloudflare**:
   - Devido às restrições severas do iOS Safari para PWAs, notificações no app fechado exigiram um Cloudflare Worker leve que envia Web Push via VAPID para a Apple.

4. **Estabilidade v34 Restabelecida**:
   - Após experimentos com feedback tátil de áudio e scrolls que geraram comportamentos indesejados no iOS, o projeto foi revertido e estabilizado na versão **v34** (commit `4303810`).

---

## 2. Tópicos em Aberto (Hipóteses e Próximos Passos)

1. **Evolução da Gamificação de Coleção**:
   - *Status*: **Em Aberto / Discussão Conceitual**.
   - *Contexto*: A aba atual de xícaras (`js/views/colecao.js`) funciona, mas busca-se uma mecânica mais engajante, prazerosa e com sensação de jogo (inspirada em jogos como *Forest*, *Cats & Soup* ou *PewDiePie's Tuber Simulator*).
   - *Hipóteses em estudo*:
     - **Hipótese A**: Pote de grãos de café com física de enchimento e estante de safras.
     - **Hipótese B**: Cafeteria customizável com slots fixos (balcão, parede, chão) onde moedas de foco compram móveis e decorações.
   - *Decisão Pendente*: Estilo de arte visual (Pixel Art vs 2D Ilustrado Cozy) e aprovação de protótipo visual pelo usuário antes de qualquer codificação no app oficial.
