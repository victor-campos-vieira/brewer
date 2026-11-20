import { $, esc, today, parseKey, addDays, mondayOf, fmtHM, DAYL, lastDays, IC_PLAY, IC_FLAME } from '../utils.js';
import { S, UI, L, qualifies, streakInfo, phaseIdx, PHASES, openSheet } from '../state.js';
import { catTotals, interruptLine } from './foco.js';
import { pushSettingsHTML } from '../notifications.js';

/* ---------- RESUMO v3 (2 Sub-abas Limpas: Ritmo | Diário + Engrenagem de Configs + stoic. Opt-Out de Ofensiva) ---------- */
const IC_GEAR='<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

export function settingsSheet(){
  var minF=S.focusGoal||25;
  var goalBtns=[15,25,45,60].map(function(g){
    return '<button class="chip" data-act="focus-goal-set" data-v="'+g+'" aria-pressed="'+(minF===g)+'">'+g+' min/dia</button>';
  }).join('');
  var showStreak=!S.hideStreaks;
  openSheet('Preferências & Alertas',
    '<p class="flabel" style="margin-top:2px">Meta diária leve de foco</p>'+
    '<div class="chips" style="margin-top:6px">'+goalBtns+'</div>'+
    '<div class="stoic-streak-opt">'+
      '<div><b>Mostrar contador de ofensiva</b><span>Inspirado no stoic.: você pode ocultar se dias seguidos te geram ansiedade.</span></div>'+
      '<button class="chip" data-act="toggle-streaks" aria-pressed="'+showStreak+'">'+(showStreak?'Ativo':'Oculto')+'</button>'+
    '</div>'+
    '<div style="margin-top:14px">'+pushSettingsHTML()+'</div>'+
    '<div class="stack" style="margin-top:16px">'+
      '<button class="btn quiet block" data-act="tab" data-tab="jornada">Ver Jornada de Torras &amp; Modo Teste</button>'+
      '<button class="btn block" data-act="sheet-close">Fechar</button>'+
    '</div>'
  );
}

/* BLOCO 1 DO RITMO: Cápsulas Semanais + Corte Diagonal (Gentler_Streak_iOS_52.png) */
export function gentlerWeeklyCardHTML(k){
  var days=lastDays(7);
  var prevDays=[];
  for(var i=13;i>=7;i--)prevDays.push(addDays(k,-i));

  var curVals=days.map(function(d){return L(d).focus||0});
  var prevVals=prevDays.map(function(d){return L(d).focus||0});
  var curTot=curVals.reduce(function(a,b){return a+b},0);
  var prevTot=prevVals.reduce(function(a,b){return a+b},0);
  var maxV=Math.max.apply(null,curVals.concat([30]));

  var curSessions=S.sessions.filter(function(s){return days.indexOf(s.d)>-1}).length;
  var prevSessions=S.sessions.filter(function(s){return prevDays.indexOf(s.d)>-1}).length;

  var cols=days.map(function(d,idx){
    var v=curVals[idx];
    var hPct=v>0?Math.max(18,Math.round((v/maxV)*100)):0;
    var isT=(d===k);
    var caps='';
    if(v>=45){
      caps='<span class="gs-cap" style="height:'+Math.round(hPct*0.48)+'%"></span><span class="gs-cap" style="height:'+Math.round(hPct*0.48)+'%"></span>';
    }else if(v>0){
      caps='<span class="gs-cap" style="height:'+hPct+'%"></span>';
    }else{
      caps='<span class="gs-cap empty"></span>';
    }
    return '<div class="gs-col'+(isT?' is-today':'')+'">'+
      '<div class="gs-bar-well">'+caps+'</div>'+
      '<span class="gs-day-lbl">'+(isT?'Hoje':DAYL[parseKey(d).getDay()])+'</span>'+
    '</div>';
  }).join('');

  var minF=S.focusGoal||25;
  var goalPills=[15,25,45,60].map(function(g){
    return '<button class="gs-goal-chip" data-act="focus-goal-set" data-v="'+g+'" aria-pressed="'+(minF===g)+'">'+g+'m</button>';
  }).join('');

  return '<section class="gentler-card-v3">'+
    '<div class="gc3-top">'+
      '<div><h2 class="gc3-orange-title">Esta Semana</h2><span class="gc3-sub">Meta leve: '+minF+' min/dia</span></div>'+
      '<div class="gc3-goals" role="group" aria-label="Meta diária">'+goalPills+'</div>'+
    '</div>'+
    '<div class="gs-chart-grid">'+cols+'</div>'+
    '<div class="gs-diagonal-split">'+
      '<div class="gsd-left">'+
        '<span class="gsd-kicker">Esta semana</span>'+
        '<b class="gsd-big">'+fmtHM(curTot)+'</b>'+
        '<span class="gsd-meta">'+curSessions+' '+(curSessions===1?'bloco':'blocos')+'</span>'+
      '</div>'+
      '<div class="gsd-right">'+
        '<span class="gsd-kicker">Semana passada</span>'+
        '<b class="gsd-big">'+fmtHM(prevTot)+'</b>'+
        '<span class="gsd-meta">'+prevSessions+' '+(prevSessions===1?'bloco':'blocos')+'</span>'+
      '</div>'+
    '</div>'+
  '</section>';
}

/* BLOCO 2 DO RITMO: Matriz Visual de 35 Dias (timespent_iOS_3.png) */
export function heatmapHTML(){
  var k=today(),curMon=mondayOf(k),startDay=addDays(curMon,-28);
  var cells='',weekFocus=0;
  for(var i=0;i<35;i++){
    var d=addDays(startDay,i),lg=S.log[d],f=(lg&&lg.focus)||0,ok=qualifies(d);
    if(i>=28)weekFocus+=f;
    var lvl=f>=60?'lv-3':f>=25?'lv-2':(f>0||ok)?'lv-1':'lv-0';
    var isT=(d===k)?' is-today':'';
    cells+='<span class="hm-cell '+lvl+isT+'" title="'+d+': '+fmtHM(f)+'"></span>';
  }
  return '<section class="ts-heatmap-card" style="margin-top:12px">'+
    '<div class="ts-hm-head">'+
      '<div><span class="smart-eyebrow">Últimas 5 semanas</span><b>Matriz de Presença</b></div>'+
      '<div class="ts-hm-total"><b>'+fmtHM(weekFocus)+'</b><span>Nesta semana</span></div>'+
    '</div>'+
    '<div class="ts-hm-body">'+
      '<button class="ts-start-stamp" data-act="tab" data-tab="hoje" aria-label="Iniciar sessão de foco">'+
        '<span class="ts-stamp-ring">INICIAR SESSÃO · FOCO ·</span>'+
        '<span class="ts-stamp-play">'+IC_PLAY+'</span>'+
      '</button>'+
      '<div style="flex:1">'+
        '<div class="ts-hm-weekdays"><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span><span>D</span></div>'+
        '<div class="ts-hm-grid">'+cells+'</div>'+
      '</div>'+
    '</div>'+
  '</section>';
}

/* BLOCO 3 DO RITMO: Barra Proporcional Única de Atenção (How_We_Feel_iOS_265.png) */
export function categorySpectrumCardHTML(){
  var days=lastDays(UI.catRange||7);
  var r=catTotals(days);
  var palette=['#E8833A','#47A85C','#5C85E6','#D95B5B','#9673E8'];
  var inner='';
  if(!r.sum){
    inner='<p class="muted small" style="margin-top:10px">Conclua blocos de foco para ver para onde foi sua atenção.</p>';
  }else{
    var segs=r.arr.map(function(x,idx){
      var pct=Math.max(8,Math.round((x[1]/r.sum)*100));
      return '<span class="hwf-seg" style="width:'+pct+'%;background:'+palette[idx%palette.length]+'"></span>';
    }).join('');
    var rows=r.arr.map(function(x,idx){
      var pct=Math.round((x[1]/r.sum)*100);
      var col=palette[idx%palette.length];
      return '<div class="cat-spec-row">'+
        '<span class="csr-dot" style="background:'+col+'"></span>'+
        '<b class="csr-name">'+esc(x[0])+'</b>'+
        '<span class="csr-val">'+fmtHM(x[1])+' · <b>'+pct+'%</b></span>'+
      '</div>';
    }).join('');
    inner='<div class="hwf-master-bar" style="margin-top:12px">'+segs+'</div><div class="cat-spec-list">'+rows+'</div>';
  }
  return '<section class="bevel-ceramic-deck" style="margin-top:12px">'+
    '<div class="bcd-coach-head"><b>Para onde foi sua atenção</b>'+
      '<div class="vfd-status-chips">'+
        '<button class="vfd-chip" data-act="cat-range" data-v="7" aria-pressed="'+((UI.catRange||7)===7)+'">7d</button>'+
        '<button class="vfd-chip" data-act="cat-range" data-v="30" aria-pressed="'+(UI.catRange===30)+'">30d</button>'+
      '</div>'+
    '</div>'+
    inner+
    '<div style="margin-top:8px">'+interruptLine()+'</div>'+
  '</section>';
}

/* SUB-ABA 2: DIÁRIO DA NOITE LIMPO (5_Minute_Journal_iOS_22.png + 5_Minute_Journal_iOS_53.png) */
export var MOOD_STATES=['Disperso','Oscilante','Equilibrado','Focado','Imerso'];

export function fiveMinJournalCardHTML(k,lg,s){
  var moodChips=MOOD_STATES.map(function(m,idx){
    return '<button type="button" class="fmj-mood-pill" data-act="rev-mood" data-v="'+esc(m)+'" aria-pressed="'+(lg.mood===m)+'">'+
      '<span class="fmp-num">'+(idx+1)+'</span>'+esc(m)+
    '</button>';
  }).join('');

  var closedToday=!!(lg.mood||lg.win||lg.next);
  var from=Date.now()-7*864e5;
  var ur=S.urges.filter(function(u){return u.t>=from&&u.res!=='gave'}).length;
  var streakMeta=(!S.hideStreaks&&s.n>0)?'Sequência: '+s.n+(s.n===1?' dia':' dias'):(ur?ur+' impulsos vencidos na semana':'');

  return '<section class="fmj-parchment-card">'+
    '<div class="fmj-head-row">'+
      '<span class="fmj-top-pill'+(closedToday?' is-saved':'')+'">'+(closedToday?'Dia registrado &check;':'Fechamento da noite')+'</span>'+
      (streakMeta?'<span class="fmj-urges-note">'+streakMeta+'</span>':'')+
    '</div>'+
    '<h2 class="fmj-serif-title">Como esteve sua presença hoje?</h2>'+
    '<p class="fmj-sub">Toque no seu nível de presença hoje e feche o ciclo com calma antes de dormir.</p>'+
    '<div class="mood-strip-v2" role="group" aria-label="Estado de presença do dia">'+moodChips+'</div>'+
    '<label class="flabel" for="fWin" style="margin-top:16px">Uma vitória ou avanço de hoje</label>'+
    '<input class="field field-sm fmj-input" id="fWin" data-f="win" maxlength="120" value="'+esc(lg.win)+'" placeholder="Até um pequeno avanço conta">'+
    '<label class="flabel" for="fNext" style="margin-top:12px">Amanhã eu começo por</label>'+
    '<input class="field field-sm fmj-input" id="fNext" data-f="next" maxlength="120" value="'+esc(lg.next)+'" placeholder="Uma ação concreta para abrir a manhã">'+
    '<div class="stack" style="margin-top:16px">'+
      '<button type="button" class="fmj-save-btn" data-act="rev-save">'+(closedToday?'Atualizar registro de hoje':'Salvar fechamento do dia')+'</button>'+
    '</div>'+
  '</section>';
}

export function renderRevisao(){
  var el=$('#tab-revisao'),k=today(),lg=L(k),s=streakInfo(),p=PHASES[phaseIdx(s.n)];
  var rTab=UI.revTab||'ritmo';

  var streakPill=S.hideStreaks
    ?''
    :'<button class="glass-beans-pill" data-act="tab" data-tab="jornada" title="Jornada de Torra">'+IC_FLAME+' <b>'+s.n+'d</b></button>';

  var body=(rTab==='diario')
    ?fiveMinJournalCardHTML(k,lg,s)
    :(gentlerWeeklyCardHTML(k)+heatmapHTML()+categorySpectrumCardHTML());

  el.innerHTML=
    '<div class="resumo-ceramic-studio">'+
      '<header class="rcs-header">'+
        '<div><h1 class="stb-greet">Resumo</h1><span class="stb-date">'+esc(p.name)+' &middot; '+(lg.focus||0)+'m hoje</span></div>'+
        '<div class="stb-right">'+
          streakPill+
          '<button class="glass-chip-icon" data-act="settings-sheet" aria-label="Preferências e alertas" title="Preferências">'+IC_GEAR+'</button>'+
        '</div>'+
      '</header>'+

      '<div class="ticktick-seg-bar" role="tablist" aria-label="Visão do Resumo">'+
        '<button class="tt-seg-btn'+(rTab==='ritmo'?' active':'')+'" data-act="rev-tab" data-v="ritmo" role="tab" aria-selected="'+(rTab==='ritmo')+'">Ritmo</button>'+
        '<button class="tt-seg-btn'+(rTab==='diario'?' active':'')+'" data-act="rev-tab" data-v="diario" role="tab" aria-selected="'+(rTab==='diario')+'">Diário</button>'+
      '</div>'+

      body+
    '</div>';
}
