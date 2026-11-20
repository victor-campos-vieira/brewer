import { $, esc, today, parseKey, addDays, mondayOf, toMin, nowMin, fmtDur, fmtHM, dueLabel, DAYL, CHECK, IC_CAFE, IC_BELL, IC_CAL, IC_MOON, IC_PLAY } from '../utils.js';
import { S, UI, L, cmp, planned, dayItems, qualifies, streakInfo, phaseIdx, PHASES, openSheet, nextCafeUnlock } from '../state.js';
import { focusPodHTML } from './foco.js';
import { calcLevelInfo } from './cafe.js';
import { notifyPermission } from '../notifications.js';
import { MOOD_META, MOOD_ORDER, resolveCafeMood } from '../interactions.js';

/* ---------- HOJE v3 (Palco Aberto + Botão Pomodoro + Próximo Passo Automático + Meta Viva da Cafeteria) ---------- */
export function greeting(){var h=new Date().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'}

const IC_AMBIENT='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/></svg>';

export function moodSheet(){
  var cur=resolveCafeMood(S.cafeMood);
  var isAuto=!S.cafeMood;
  var cards=MOOD_ORDER.map(function(k){
    var m=MOOD_META[k];
    var act=(!isAuto&&cur===k);
    return '<button class="mood-swatch-card'+(act?' active':'')+'" data-act="set-mood" data-v="'+k+'">'+
      '<span class="msc-preview" style="background:'+m.swatch+'"></span>'+
      '<div class="msc-txt"><b>'+esc(m.label)+'</b><span>'+esc(m.desc)+'</span></div>'+
    '</button>';
  }).join('');
  openSheet('Clima e Luz da Cafeteria',
    '<p class="muted small" style="margin-bottom:12px">Escolha a atmosfera viva em tela cheia ou deixe mudar automaticamente conforme a hora do dia.</p>'+
    '<div class="mood-swatch-grid">'+cards+'</div>'+
    '<div class="stack" style="margin-top:14px">'+
      '<button class="btn quiet block" data-act="set-mood" data-v="auto"'+(isAuto?' style="border-color:var(--ink)"':'')+'>'+(isAuto?'✓ ':'')+'Automático pelo horário do dia</button>'+
      '<button class="btn block" data-act="sheet-close">Fechar</button>'+
    '</div>'
  );
}

export function prioSheet(){
  var k=today(),pl3=planned(k);
  var rows=pl3.map(function(t){
    var pCls=t.prio===1?'prio-1':t.prio===3?'prio-3':'prio-2';
    return '<li class="task task-card-v2'+(t.done?' done':'')+'">'+
      '<button class="check squircle-check '+pCls+'" data-act="toggle-sh" data-id="'+t.id+'" aria-label="'+(t.done?'Desmarcar':'Marcar como feita')+': '+esc(t.text)+'">'+CHECK+'</button>'+
      '<button class="ttext" data-act="task-edit" data-id="'+t.id+'"><b>'+esc(t.text)+'</b>'+(t.kind==='faculdade'?' <span class="tag">Projeto</span>':'')+'</button>'+
      '<div class="task-row-acts">'+
        '<button class="task-act-btn" data-act="plan-sh" data-id="'+t.id+'" aria-label="Remover das fixadas">Remover</button>'+
        (t.done?'':'<button class="task-act-btn primary" data-act="sg-focus" data-id="'+t.id+'">'+IC_PLAY+' Focar</button>')+
      '</div>'+
    '</li>';
  }).join('');
  var cands=pl3.length<3?S.tasks.filter(function(t){return !t.done&&t.plan!==k}).sort(cmp).slice(0,8):[];
  var pickHTML=pl3.length<3
    ?'<p class="flabel" style="margin-top:18px">Fixar da fila ('+pl3.length+'/3)</p>'+
      (cands.length?'<ul class="tasks tasks-cards-v2">'+cands.map(function(t){
        var pCls=t.prio===1?'prio-1':t.prio===3?'prio-3':'prio-2';
        return '<li class="task task-card-v2"><span class="prio-dot '+pCls+'"></span><button class="ttext" data-act="task-edit" data-id="'+t.id+'"><b>'+esc(t.text)+'</b>'+(t.kind==='faculdade'?' <span class="tag">Projeto</span>':'')+'</button><button class="task-act-btn primary" data-act="plan-sh" data-id="'+t.id+'">+ Fixar</button></li>';
      }).join('')+'</ul>':'<p class="muted small" style="margin-top:6px">Nenhuma tarefa pendente na fila.</p>')+
      '<div class="row" style="margin-top:12px"><button class="btn quiet small" data-act="task-new-today">+ Criar nova tarefa</button></div>'
    :'';
  openSheet('Prioridades Fixadas ('+pl3.length+'/3)',
    (pl3.length?'<ul class="tasks tasks-cards-v2">'+rows+'</ul>':'<p class="muted small">Fixar é opcional — sem fixar nada, o Brewer já sugere automaticamente seu próximo passo mais urgente.</p>')+
    pickHTML+
    '<div class="stack" style="margin-top:18px"><button class="btn block" data-act="sheet-close">Concluir</button></div>'
  );
}

/* Fila inteligente de Próximo Passo (zero atrito: fixadas primeiro, depois prazo próximo, depois prioridade) */
export function smartCandidates(k){
  return S.tasks.filter(function(t){return !t.done}).sort(function(a,b){
    var ap=(a.plan===k)?1:0, bp=(b.plan===k)?1:0;
    if(ap!==bp)return bp-ap;
    var ad=a.due||'9999-99-99', bd=b.due||'9999-99-99';
    if(ad!==bd)return ad<bd?-1:1;
    return cmp(a,b);
  });
}

/* Barra Minimalista Flutuante sobre a Luz Viva de Cafeteria */
export function openStageTopBarHTML(k){
  var beans=(S.cafe&&S.cafe.beans)||0;
  var lg=L(k),minF=S.focusGoal||25,foc=lg.focus||0;
  var pctGoal=Math.min(100,Math.round((foc/Math.max(1,minF))*100));
  var cR=2*Math.PI*6.5,offR=(cR*(1-pctGoal/100)).toFixed(1);
  var moodKey=resolveCafeMood(S.cafeMood);
  var moodInfo=MOOD_META[moodKey]||MOOD_META.torrefacao;
  var dt=parseKey(k).toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'});
  var dtCap=dt.charAt(0).toUpperCase()+dt.slice(1);
  var notifBtn=notifyPermission()==='default'
    ?'<button class="glass-chip-icon" data-act="notify-enable" aria-label="Ativar alertas">'+IC_BELL+'</button>'
    :'';

  return '<header class="stage-topbar">'+
    '<div class="stb-left">'+
      '<span class="stb-date">'+esc(dtCap)+'</span>'+
      '<h1 class="stb-greet">'+greeting()+'.</h1>'+
    '</div>'+
    '<div class="stb-right">'+
      notifBtn+
      '<button class="glass-goal-pill" data-act="tab" data-tab="revisao" title="Meta de foco hoje">'+
        '<svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="6.5" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="2.2"/><circle cx="9" cy="9" r="6.5" fill="none" stroke="#E8833A" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="'+cR.toFixed(1)+'" stroke-dashoffset="'+offR+'" transform="rotate(-90 9 9)"/></svg>'+
        '<b>'+foc+'/'+minF+'m</b>'+
      '</button>'+
      '<button class="glass-mood-pill" data-act="mood-sheet" title="Escolher clima e luz da cafeteria">'+IC_AMBIENT+'</button>'+
      '<button class="glass-beans-pill" data-act="tab" data-tab="colecao" title="Abrir Cafeteria">'+IC_CAFE+' <b>'+beans+'g</b></button>'+
    '</div>'+
  '</header>';
}

/* Gaveta do Dia: Pulso Semanal + Próximo Passo Vivo (com atalho para 3 de Hoje) + Portal da Cafeteria */
export function dayDrawerContentHTML(k,cands,items,lg){
  var nm=nowMin();
  var s=streakInfo(),pIdx=phaseIdx(s.n),p=PHASES[pIdx];
  var nxtCafe=nextCafeUnlock();
  var nextEv=items.find(function(i){return toMin(i.end)>nm});
  var pl3=planned(k),done3=pl3.filter(function(t){return t.done}).length;

  /* Faixa Compacta de Ritmo Semanal (S T Q Q S S D) + 3 indicadores clicáveis úteis */
  var mon=mondayOf(k),wdots='';
  for(var wi=0;wi<7;wi++){
    var wd=addDays(mon,wi),wdt=parseKey(wd),isToday=(wd===k),wOk=qualifies(wd),wFoc=(S.log[wd]&&S.log[wd].focus)||0;
    wdots+='<div class="hwp-day'+(isToday?' today':'')+(wOk?' done':wFoc>0?' part':'')+'" title="'+DAYL[wdt.getDay()]+': '+wFoc+'m">'+
      '<span class="hwp-dot">'+(wOk?'&check;':'')+'</span>'+
      '<em>'+DAYL[wdt.getDay()]+'</em>'+
    '</div>';
  }
  var weekPulse='<section class="hoje-week-pulse">'+
    '<div class="hwp-strip">'+wdots+'</div>'+
    '<div class="hwp-stats">'+
      '<button class="hwp-stat" data-act="tab" data-tab="revisao"><span>Foco hoje</span><b>'+fmtHM(lg.focus||0)+'</b></button>'+
      '<button class="hwp-stat" data-act="prio-sheet"><span>3 de Hoje</span><b>'+done3+'/'+pl3.length+'</b></button>'+
      '<button class="hwp-stat" data-act="tab" data-tab="colecao"><span>Cafeteria</span><b>'+nxtCafe.beans+'g</b></button>'+
    '</div>'+
  '</section>';

  /* CARTÃO 1: Próximo Passo Vivo (Zero atrito + acesso direto às 3 fixadas quando quiser) */
  var card1Body='';
  if(cands.length){
    var curIdx=(UI.nextSkip||0)%cands.length;
    var topT=cands[curIdx];
    var isPinned=(topT.plan===k);
    var meta=[];
    if(topT.due)meta.push('Prazo: '+dueLabel(topT.due));
    meta.push(topT.kind==='faculdade'?(topT.subject||'Projeto'):(topT.cat||'Pessoal'));
    if(topT.est)meta.push(fmtDur(topT.est));
    if(topT.spent)meta.push(topT.spent+'m já focados');

    var otherPinned=cands.filter(function(x){return x.id!==topT.id&&x.plan===k});
    var pinnedChips=otherPinned.length
      ?'<div class="ns-pinned-row">'+otherPinned.map(function(ot){
          return '<button class="ns-mini-chip" data-act="sg-focus" data-id="'+ot.id+'">'+IC_PLAY+' <span>'+esc(ot.text)+'</span></button>';
        }).join('')+'</div>'
      :'';

    card1Body=
      '<div class="ns-head">'+
        '<span class="ns-kicker">'+(isPinned?'Prioridade fixada':'Próximo passo sugerido')+'</span>'+
        '<div class="ns-head-acts">'+
          (cands.length>1?'<button class="ns-link" data-act="next-skip">Outra &orarr;</button>':'')+
          '<button class="ns-link" data-act="prio-sheet">Fixar 3</button>'+
          '<button class="ns-link" data-act="task-new">+ Nova</button>'+
        '</div>'+
      '</div>'+
      '<button class="ns-title-btn" data-act="task-edit" data-id="'+topT.id+'">'+esc(topT.text)+'</button>'+
      '<p class="ns-meta">'+esc(meta.join(' · '))+'</p>'+
      '<div class="ns-actions">'+
        '<button class="ns-cta primary" data-act="sg-focus" data-id="'+topT.id+'">'+IC_PLAY+' Focar agora</button>'+
        '<button class="ns-cta" data-act="toggle" data-id="'+topT.id+'">'+CHECK+' Concluir</button>'+
      '</div>'+
      pinnedChips;
  } else {
    card1Body=
      '<div class="ns-head">'+
        '<span class="ns-kicker">Próximo passo</span>'+
        '<div class="ns-head-acts">'+
          '<button class="ns-link" data-act="prio-sheet">Fixar 3</button>'+
          '<button class="ns-link" data-act="tab" data-tab="tarefas">Tarefas &rarr;</button>'+
        '</div>'+
      '</div>'+
      '<p class="ns-empty-copy">Sua fila está limpa. Escreva 1 coisa que você quer tirar do papel hoje:</p>'+
      '<form class="quick-inline-form" data-quick-form="hoje">'+
        '<input id="homeQuickTask" class="qif-input" type="text" maxlength="90" placeholder="Ex.: Revisar capítulo 3...">'+
        '<button type="submit" class="qif-submit" aria-label="Adicionar tarefa">+</button>'+
      '</form>';
  }

  /* Linha discreta de próximo horário ou janelas livres da Agenda */
  var agendaRow=nextEv
    ?'<button class="ns-agenda-line" data-act="tab" data-tab="agenda">'+
        '<span>'+IC_CAL+' <b>'+(nextEv.start||(nextEv.r&&nextEv.r.time)||'')+'</b> &middot; '+esc(nextEv.title||(nextEv.r&&nextEv.r.name)||'')+'</span>'+
        '<span class="ns-ag-go">Agenda &rsaquo;</span>'+
      '</button>'
    :'<button class="ns-agenda-line" data-act="tab" data-tab="agenda" data-sub="dia">'+
        '<span>'+IC_CAL+' Ver janelas livres na Agenda</span>'+
        '<span class="ns-ag-go">Abrir &rsaquo;</span>'+
      '</button>';

  /* CARTÃO 2: Sua Cafeteria — Progresso real do Nível + Cofre de Grãos (sem empurrar item aleatório!) */
  var cafeLv=calcLevelInfo((S.cafe&&S.cafe.focusMins)||0);
  var cafeBeans=(S.cafe&&S.cafe.beans)||0;
  var placedCnt=((S.cafe&&S.cafe.placed)||[]).length;
  var shopNote=nxtCafe.canBuyCount>0
    ?('<b>'+cafeBeans+'g</b> no cofre · '+nxtCafe.canBuyCount+' '+(nxtCafe.canBuyCount===1?'item disponível':'itens disponíveis')+' na loja')
    :('<b>'+cafeBeans+'g</b> no cofre · '+placedCnt+' '+(placedCnt===1?'peça':'peças')+' na sala');

  var icStorefront='<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10z"/><path d="M2 10l2-6h16l2 6"/><path d="M9 21v-6h6v6"/></svg>';

  var cafeCard='<section class="pd-glass-card cafe-goal-card">'+
    '<div class="cgc-top">'+
      '<div class="cgc-info">'+
        '<span class="ns-kicker">Sua Cafeteria &middot; Nível '+cafeLv.lv+'</span>'+
        '<h3 class="cgc-title">'+esc(p.name)+'</h3>'+
        '<p class="cgc-sub">'+shopNote+'</p>'+
      '</div>'+
      '<button class="cgc-badge-ico" data-act="tab" data-tab="colecao" aria-label="Abrir Cafeteria">'+icStorefront+'</button>'+
    '</div>'+
    '<div class="cgc-bar-row">'+
      '<div class="cgc-track"><span class="cgc-fill" style="width:'+cafeLv.pct+'%"></span></div>'+
      '<span class="cgc-nums">'+cafeLv.xpLabel+'</span>'+
    '</div>'+
    '<div class="cgc-foot">'+
      '<span class="cgc-phase">Evolução para o Nível '+(cafeLv.lv+1)+'</span>'+
      '<button class="cgc-cta" data-act="tab" data-tab="colecao">Entrar na Cafeteria &rarr;</button>'+
    '</div>'+
  '</section>';

  return '<div id="hojeDayDrawer" class="hoje-glass-drawer">'+
    weekPulse+
    '<section class="pd-glass-card next-step-card">'+
      card1Body+
      agendaRow+
    '</section>'+
    cafeCard+
  '</div>';
}

export function renderHoje(){
  var k=today(),hr=new Date().getHours();
  var items=dayItems(k).filter(function(i){return !i.allDay});
  var cands=smartCandidates(k);
  var yest=L(addDays(k,-1)).next;
  var lg=L(k);

  var reviewDone=!!(lg.win||lg.next||lg.mood);
  var nudge=(hr>=20&&!reviewDone)?'<div class="stage-soft-nudge"><span>'+IC_MOON+' Hora de fechar o dia no diário</span><button data-act="tab" data-tab="revisao" data-rev="diario">Abrir</button></div>':'';
  var yline=(yest&&!lg.focus&&!nudge)?'<div class="stage-soft-nudge"><span>Intenção de ontem: <b>'+esc(yest)+'</b></span></div>':'';

  var topText=cands.length?('Próximo: '+esc(cands[(UI.nextSkip||0)%cands.length].text.slice(0,24))+(cands[(UI.nextSkip||0)%cands.length].text.length>24?'…':'')):('Hoje: '+(lg.focus||0)+'m focados');

  var drawerLip='<button class="stage-drawer-lip" data-act="scroll-drawer">'+
    '<span class="sdl-grip" aria-hidden="true"></span>'+
    '<div class="sdl-row">'+
      '<span>'+topText+'</span>'+
      '<span class="sdl-more">Ver dia &#8964;</span>'+
    '</div>'+
  '</button>';

  $('#tab-hoje').innerHTML=
    '<div class="hoje-open-viewport">'+
      openStageTopBarHTML(k)+
      nudge+yline+
      focusPodHTML()+
      drawerLip+
    '</div>'+
    dayDrawerContentHTML(k,cands,items,lg);
}
