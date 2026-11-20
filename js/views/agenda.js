import { $, esc, pl, uid, today, parseKey, addDays, mondayOf, toMin, fromMin, nowMin, cap, fmtLong, fmtDur, ceil5, dueLabel, DAYL, DAYN, daysText, IC_PLAY, seg } from '../utils.js';
import { S, UI, SH, setSH, save, cmp, findTask, estStats, dayItems, routineRow, openSheet } from '../state.js';
import { gcalHint, gcalPanelHTML } from '../sync.js';

/* ---------- planejador local: sugestões (sem duração inventada, sem IA externa) ---------- */
export var DAY_START=8*60,DAY_END=21*60;
export function freeWindows(k,from){
  var cur=from!=null?from:DAY_START,end=DAY_END,out=[];
  var busy=dayItems(k).filter(function(i){return !i.allDay}).map(function(i){return [toMin(i.start),toMin(i.end)]}).sort(function(a,b){return a[0]-b[0]});
  busy.forEach(function(b){if(b[1]<=cur)return;if(b[0]>cur){var e=Math.min(b[0],end);if(e-cur>=15)out.push([cur,e])}cur=Math.max(cur,b[1])});
  if(end-cur>=15)out.push([cur,end]);
  return out;
}
export function dueDays(t,k){return t.due?Math.round((parseKey(t.due)-parseKey(k))/864e5):null}
export function taskScore(t,k){
  var s={1:30,2:20,3:10}[t.prio]||20,dd=dueDays(t,k);
  if(dd!==null)s+=dd<0?45:dd===0?40:dd===1?30:dd<=3?18:dd<=7?8:0;
  if(t.plan===k)s+=12;
  return s;
}
export function estNote(t){
  var st=estStats(t.cat);if(!t.est||!st||st.n<5)return '';
  var pct=Math.round((st.ratio-1)*100);
  return Math.abs(pct)>=10?'Você costuma levar cerca de '+Math.abs(pct)+'% '+(pct>0?'mais':'menos')+' que o estimado em tarefas desta categoria.':'';
}
export function suggestionsFor(k,fromMin){
  var from=(k===today())?Math.max(DAY_START,ceil5(fromMin!=null?fromMin:nowMin())):DAY_START;
  var wins=freeWindows(k,from),already=(S.blocks[k]||[]).map(function(b){return b.taskId}).filter(Boolean);
  var cand=S.tasks.filter(function(t){return !t.done&&already.indexOf(t.id)<0&&!UI.dismissed[k+'|'+t.id]}).sort(function(a,b){return taskScore(b,k)-taskScore(a,k)});
  var used={},out=[];
  wins.forEach(function(w){
    if(out.length>=4)return;
    var len=w[1]-w[0],top=cand.filter(function(t){return !used[t.id]})[0];
    var fit=cand.filter(function(t){return !used[t.id]&&t.est>0&&t.est<=len})[0];
    if(fit){
      used[fit.id]=1;
      var note=(top&&top!==fit&&top.est>len)?'A tarefa mais urgente, "'+top.text+'", tem estimativa de '+fmtDur(top.est)+' e a janela tem '+fmtDur(len)+'.':'';
      out.push({win:w,len:len,task:fit,fits:true,note:note});return;
    }
    if(!top)return;
    used[top.id]=1;out.push({win:w,len:len,task:top,fits:top.est>0?false:null,note:''});
  });
  return out;
}
export function placeSuggestion(k,s){
  var t=s.task,st=s.win[0];
  (S.blocks[k]=S.blocks[k]||[]).push({id:uid(),start:fromMin(st),end:fromMin(st+t.est),title:t.text,taskId:t.id,source:'local',extId:''});
  save();
}
export function plannerSheet(k){
  UI.sgDay=k;var list=suggestionsFor(k);UI.sg=list;
  var h='<p class="muted small">'+esc(cap(fmtLong(k)))+'</p>';
  if(!list.length)h+='<p class="lead" style="margin-top:12px">Não encontrei um horário livre com uma tarefa que caiba. Defina o tempo estimado das tarefas ou libere espaço na agenda.</p>';
  list.forEach(function(s,i){
    var t=s.task,pw={1:'alta',2:'média',3:'baixa'}[t.prio]||'média',dd=dueDays(t,k),meta=['prioridade '+pw];
    if(dd!==null)meta.push('prazo: '+dueLabel(t.due));
    meta.push(t.est?fmtDur(t.est)+' estimados':'sem estimativa');
    h+='<div class="icard"><p><b>Você tem '+fmtDur(s.len)+' livres às '+fromMin(s.win[0])+'.</b></p><p style="margin-top:6px">'+esc(t.text)+'</p><p class="muted small">'+esc(meta.join(', '))+'</p>';
    var nt=estNote(t);
    if(s.fits===true)h+='<p class="small" style="margin-top:8px">Uma tarefa importante cabe neste horário.</p>'+(s.note?'<p class="small muted">'+esc(s.note)+'</p>':'')+(nt?'<p class="small muted">'+esc(nt)+'</p>':'')+'<div class="row"><button class="btn small" data-act="sg-place" data-i="'+i+'">Colocar na agenda</button><button class="btn quiet small" data-act="sg-no" data-i="'+i+'">Agora não</button></div>';
    else if(s.fits===null)h+='<p class="small" style="margin-top:8px">Sem estimativa de tempo: o Brewer não sabe quanto isso leva.</p><div class="row"><button class="btn small" data-act="sg-edit" data-id="'+t.id+'">Definir tempo</button><button class="btn quiet small" data-act="sg-no" data-i="'+i+'">Agora não</button></div>';
    else h+='<p class="small" style="margin-top:8px">Essa é uma prioridade, mas a estimativa é de '+fmtDur(t.est)+' e a janela tem '+fmtDur(s.len)+'.</p><div class="row"><button class="btn quiet small" data-act="sg-edit" data-id="'+t.id+'">Editar tarefa</button><button class="btn quiet small" data-act="sg-no" data-i="'+i+'">Agora não</button></div>';
    h+='</div>';
  });
  var nfit=list.filter(function(s){return s.fits===true}).length;
  h+='<div class="stack">'+(nfit>1?'<button class="btn quiet block" data-act="sg-all">Colocar todas que cabem ('+nfit+')</button>':'')+'<button class="btn quiet block" data-act="sheet-close">Fechar</button></div>';
  openSheet('Sugestões para o dia',h);
}
export function nowSuggestion(){
  var list=suggestionsFor(today(),nowMin()),s=list[0];
  if(!s||s.win[0]>ceil5(nowMin())+4)return null;
  return s;
}
export function sugCardHTML(){
  if(UI.hideSug===today())return '';
  var s=nowSuggestion();if(!s||s.fits===false)return '';
  var t=s.task,pw={1:'alta',2:'média',3:'baixa'}[t.prio]||'média';
  var line=s.fits===true?'Uma tarefa de prioridade '+pw+' cabe aqui: <b>'+esc(t.text)+'</b> ('+fmtDur(t.est)+').':'Sugestão: <b>'+esc(t.text)+'</b>. Sem estimativa de tempo.';
  return '<div class="nudge"><h3>Você tem '+fmtDur(s.len)+' livres agora.</h3><p style="margin-top:4px">'+line+'</p><div class="row"><button class="btn small" data-act="sg-focus" data-id="'+t.id+'">Preparar café</button><button class="btn quiet small" data-act="sg-hide">Agora não</button></div></div>';
}

/* ---------- formulários de blocos e rotinas ---------- */
export function blockSheet(k,preStart,preEnd){
  var st=preStart?toMin(preStart):((k===today())?Math.min(22*60,Math.ceil((nowMin()+5)/15)*15):9*60);
  var en=preEnd?toMin(preEnd):Math.min(1439,st+45);
  if(en<=st)en=Math.min(1439,st+45);
  var tasks=S.tasks.filter(function(t){return !t.done}).sort(cmp);
  setSH({kind:'block',k:k});
  openSheet('Novo bloco',
    '<label class="flabel" for="bTitle">Nome do bloco</label><input class="field" id="bTitle" maxlength="80" placeholder="Ex.: estudar inglês">'+
    '<div class="pair"><div><label class="flabel" for="bStart">Início</label><input class="field" id="bStart" type="time" value="'+fromMin(st)+'"></div><div><label class="flabel" for="bEnd">Fim</label><input class="field" id="bEnd" type="time" value="'+fromMin(en)+'"></div></div>'+
    '<label class="flabel" for="bTask">Ligar a uma tarefa (opcional)</label><select class="field" id="bTask"><option value="">Nenhuma</option>'+tasks.map(function(t){return '<option value="'+t.id+'">'+esc(t.text)+'</option>'}).join('')+'</select>'+
    '<div class="stack"><button class="btn block" data-act="block-save">Salvar</button><button class="btn quiet block" data-act="sheet-close">Cancelar</button></div>');
}
export var PRESETS={
  manha:{name:'Manhã',time:'07:00',dur:40,days:[1,2,3,4,5],steps:['Beber um copo de água','Arrumar a cama','Tomar café sem celular','Olhar a agenda e as 3 prioridades do dia']},
  noite:{name:'Noite',time:'22:00',dur:30,days:[0,1,2,3,4,5,6],steps:['Deixar o celular carregando longe da cama','Fazer a revisão do dia no Brewer','Separar o que vai usar amanhã','Desligar as telas 30 min antes de dormir']},
  estudo:{name:'Estudo',time:'19:00',dur:90,days:[1,2,3,4,5],steps:['Celular de tela para baixo','Escolher o que estudar','Bloco de foco de 45 min','Pausa de 5 min','Bloco de foco de 45 min']}
};
export function dayChips(sel){return DAYL.map(function(l,i){return '<button class="chip dayc" data-act="sh-day" data-v="'+i+'" aria-pressed="'+(sel.indexOf(i)>-1)+'" aria-label="'+DAYN[i]+'">'+l+'</button>'}).join('')}
export function routineSheet(id){
  var r=id?S.routines.find(function(x){return x.id===id}):null;
  var days=r?r.days.slice():[1,2,3,4,5];
  setSH({kind:'routine',id:id||'',days:days});
  openSheet(r?'Editar rotina':'Nova rotina',
    (r?'':'<p class="muted small">Comece por um modelo:</p><div class="presets"><button class="chip" data-act="preset" data-v="manha">Manhã</button><button class="chip" data-act="preset" data-v="noite">Noite</button><button class="chip" data-act="preset" data-v="estudo">Estudo</button></div>')+
    '<label class="flabel" for="rName">Nome</label><input class="field" id="rName" maxlength="40" value="'+esc(r?r.name:'')+'" placeholder="Ex.: Manhã">'+
    '<div class="pair"><div><label class="flabel" for="rTime">Horário</label><input class="field" id="rTime" type="time" value="'+(r?r.time:'07:00')+'"></div><div><label class="flabel" for="rDur">Duração (min)</label><input class="field" id="rDur" type="number" inputmode="numeric" min="5" max="480" value="'+(r?(r.dur||30):30)+'"></div></div>'+
    '<p class="flabel">Dias</p><div class="chips" id="rDays">'+dayChips(SH.days)+'</div>'+
    '<label class="flabel" for="rSteps">Passos (um por linha)</label><textarea class="field" id="rSteps" placeholder="Um passo por linha">'+esc(r?r.steps.map(function(s){return s.text}).join('\n'):'')+'</textarea>'+
    '<div class="stack"><button class="btn block" data-act="r-save">Salvar</button>'+(r?'<button class="btn quiet block danger" data-act="r-del" data-id="'+r.id+'">Excluir rotina</button>':'')+'<button class="btn quiet block" data-act="sheet-close">Cancelar</button></div>');
}

/* Barra Viva de Progresso do Dia + Total de Janelas Livres (Structured + Cron) */
export function dayPulseBarHTML(k,isT,nm,wins){
  var freeTot=wins.reduce(function(a,w){return a+(w[1]-w[0])},0);
  var dayPct=isT?Math.max(0,Math.min(100,Math.round(((nm-DAY_START)/(DAY_END-DAY_START))*100))):0;
  var subTxt=freeTot>0
    ?'<b>'+fmtDur(freeTot)+'</b> livres '+(isT?'ainda hoje':'neste dia')+' ('+pl(wins.length,'janela','janelas')+')'
    :'Dia preenchido · toque em + para ajustar blocos';
  return '<div class="agenda-day-pulse">'+
    '<div class="adp-top">'+
      '<span class="adp-free">'+subTxt+'</span>'+
      '<button class="cub-btn" data-act="auto-plan-k">Montar dia</button>'+
    '</div>'+
    (isT
      ?'<div class="adp-track-row">'+
          '<span>08h</span>'+
          '<div class="adp-track"><span class="adp-fill" style="width:'+dayPct+'%"></span><i class="adp-dot" style="left:'+dayPct+'%"></i></div>'+
          '<span>21h</span>'+
        '</div>'
      :'')+
  '</div>';
}

function freeGapRowHTML(k,startM,endM,isNowGap){
  var dur=endM-startM;
  var sugDur=Math.min(60,Math.max(15,Math.floor(dur/5)*5));
  var sStr=fromMin(startM),eStr=fromMin(endM);
  var endBlockStr=fromMin(Math.min(endM,startM+Math.min(60,dur)));
  return '<li class="structured-free-gap'+(isNowGap?' is-now-gap':'')+'">'+
    '<div class="sfg-info">'+
      '<span class="sfg-pill">'+(isNowGap?'Livre agora':'Janela livre')+'</span>'+
      '<b>'+fmtDur(dur)+'</b>'+
      '<span class="sfg-span">'+sStr+' &ndash; '+eStr+'</span>'+
    '</div>'+
    '<div class="sfg-acts">'+
      (isNowGap?'<button class="sfg-btn primary" data-act="gap-focus" data-dur="'+sugDur+'">'+IC_PLAY+' '+sugDur+'m</button>':'')+
      '<button class="sfg-btn" data-act="block-new" data-start="'+sStr+'" data-end="'+endBlockStr+'">+ Bloco</button>'+
    '</div>'+
  '</li>';
}

/* ---------- AGENDA v3 (Timepage Split Rail + Structured Clickable Free Gaps + Amie Timeblocks + TickTick Routines) ---------- */
export function renderAgenda(){
  var el=$('#tab-agenda');
  if(UI.agView==='energia')UI.agView='dia';
  var k=UI.agDay||today(),isT=k===today(),nm=nowMin();
  var mon=mondayOf(k),rail='';
  for(var ri=0;ri<7;ri++){
    var rd=addDays(mon,ri),rdt=parseKey(rd),rwd=DAYN[rdt.getDay()].slice(0,3).toUpperCase(),rnum=rdt.getDate();
    var rSel=(rd===k),rToday=(rd===today());
    rail+='<button class="tp-rail-day'+(rSel?' active':'')+(rToday?' today':'')+'" data-act="day-pick" data-k="'+rd+'">'+
      '<span class="trd-wd">'+rwd+'</span>'+
      '<b class="trd-num">'+rnum+'</b>'+
      (rToday?'<span class="trd-dot"></span>':'')+
    '</button>';
  }

  var viewTabs='<div class="ticktick-seg-bar agenda-seg" role="group">'+
    '<button class="tt-seg-btn'+(UI.agView==='dia'?' active':'')+'" data-act="ag-view" data-v="dia">Dia</button>'+
    '<button class="tt-seg-btn'+(UI.agView==='rotinas'?' active':'')+'" data-act="ag-view" data-v="rotinas">Rotinas <span class="tt-badge">'+S.routines.length+'</span></button>'+
    '<button class="tt-seg-btn'+(UI.agView==='gcal'?' active':'')+'" data-act="ag-view" data-v="gcal">Google</button>'+
  '</div>';

  var rightContent='';
  if(UI.agView==='gcal'){
    rightContent='<div class="tp-stream-head"><div><h2 class="tp-day-title">Google Agenda</h2></div></div>'+
      viewTabs+gcalPanelHTML();
  } else if(UI.agView==='rotinas'){
    /* Agrupamento por período do dia estilo TickTick_iOS_333.png (Morning / Afternoon / Night) */
    var periods=[
      {id:'morning',title:'Manhã',sub:'Antes das 12h',color:'#F5B841',items:[]},
      {id:'afternoon',title:'Tarde',sub:'12h às 18h',color:'#34C759',items:[]},
      {id:'night',title:'Noite',sub:'Após as 18h',color:'#8E7DFF',items:[]}
    ];
    S.routines.forEach(function(r){
      var tm=toMin(r.time||'07:00');
      if(tm<12*60)periods[0].items.push(r);
      else if(tm<18*60)periods[1].items.push(r);
      else periods[2].items.push(r);
    });
    var groupsHTML=S.routines.length?periods.map(function(p){
      if(!p.items.length)return '';
      var rows=p.items.map(function(r){
        return '<div class="ticktick-routine-item">'+
          '<div class="tri-top-meta">'+
            '<span class="tri-meta">'+r.time+' &middot; '+(r.dur||30)+'m &middot; '+daysText(r.days)+'</span>'+
            '<button class="task-act-btn" data-act="r-edit" data-id="'+r.id+'">Editar</button>'+
          '</div>'+
          '<div class="tri-checklist">'+routineRow(r,k)+'</div>'+
        '</div>';
      }).join('');
      return '<section class="ticktick-group-card">'+
        '<div class="tgc-head"><b>'+p.title+'</b><span>'+p.sub+'</span></div>'+
        rows+
      '</section>';
    }).join(''):'<div class="tp-empty-state" style="margin-top:16px"><b>Nenhuma rotina cadastrada</b><p class="muted small">Crie rituais de Manhã, Tarde ou Noite com checklists expansíveis estilo Tiimo e TickTick.</p></div>';

    rightContent='<div class="tp-stream-head">'+
      '<div><span class="v2-sec-eyebrow">HÁBITOS &amp; RITUAIS</span><h2 class="tp-day-title">Rotinas Diárias</h2></div>'+
      '<button class="things-magic-plus sm" data-act="r-new" aria-label="Nova rotina">+</button>'+
    '</div>'+
    viewTabs+
    groupsHTML+
    '<div class="tp-actions-row" style="margin-top:14px"><button class="btn block" data-act="r-new">+ Criar Nova Rotina</button></div>';
  } else {
    var items=dayItems(k);
    var fromWin=isT?Math.max(DAY_START,ceil5(nm)):DAY_START;
    var wins=freeWindows(k,fromWin);
    var nowPlaced=false;
    var nowLineHTML='<li class="amie-now-horizon" aria-label="Horário atual"><span class="anh-time">'+fromMin(nm)+'</span><span class="anh-dot"></span><span class="anh-line"></span></li>';
    var rows=[];
    var prevEnd=fromWin;

    items.forEach(function(i){
      var sMin=i.allDay?0:toMin(i.start),eMin=i.allDay?1440:toMin(i.end);
      var durMins=Math.max(15,eMin-sMin);
      if(isT&&!nowPlaced&&!i.allDay&&sMin>nm){
        rows.push(nowLineHTML);
        nowPlaced=true;
      }
      /* Injeta janela livre clicável antes do evento (estilo Structured) */
      if(!i.allDay&&sMin>=prevEnd+20&&prevEnd<DAY_END){
        var gStart=Math.max(prevEnd,DAY_START),gEnd=Math.min(sMin,DAY_END);
        if(gEnd-gStart>=20){
          rows.push(freeGapRowHTML(k,gStart,gEnd,isT&&gStart<=nm+5&&gEnd>nm));
        }
      }
      if(!i.allDay)prevEnd=Math.max(prevEnd,eMin);

      var isNow=isT&&!i.allDay&&sMin<=nm&&nm<eMin;
      var blockTheme=i.kind==='rotina'?'amie-plum':(i.source==='gcal'?'amie-cobalt':'amie-sage');
      var spanTxt=i.allDay?'DIA TODO':(i.start+' &ndash; '+i.end);
      var durBadge=i.allDay?'Dia todo':fmtDur(durMins);
      var nowBadge=isNow?' <span class="tp-now-pill">AGORA</span>':'';

      var propH=i.allDay?58:Math.max(60,Math.min(144,Math.round(durMins*1.2)));
      if(i.kind==='rotina'){
        rows.push('<li class="amie-timeblock '+blockTheme+(isNow?' is-now':'')+'" style="min-height:'+propH+'px">'+
          '<span class="atb-rail"></span>'+
          '<div class="atb-body">'+
            '<div class="atb-top"><span class="atb-time">'+spanTxt+nowBadge+'</span><span class="atb-dur">'+durBadge+'</span></div>'+
            routineRow(i.r,k)+
          '</div>'+
        '</li>');
      } else {
        var tk=i.taskId?findTask(i.taskId):null;
        rows.push('<li class="amie-timeblock '+blockTheme+(isNow?' is-now':'')+'" style="min-height:'+propH+'px">'+
          '<span class="atb-rail"></span>'+
          '<div class="atb-body">'+
            '<div class="atb-top"><span class="atb-time">'+spanTxt+nowBadge+'</span><span class="atb-dur">'+durBadge+'</span></div>'+
            '<div class="atb-main-row">'+
              '<div class="atb-titles">'+
                '<b class="atb-title">'+esc(i.title)+'</b>'+
                '<span class="atb-sub">'+(i.source==='gcal'?'Google Agenda':'Bloco de Foco')+(tk&&tk.done?' · Concluída':'')+'</span>'+
              '</div>'+
              '<div class="tp-acts">'+
                (i.allDay?'':'<button class="tiimo-start-pill sm" data-act="focus-block" data-k="'+k+'" data-id="'+i.id+'">'+IC_PLAY+' <span>Focar</span></button>')+
                (i.source==='gcal'?'':'<button class="lpc-remove" data-act="block-del" data-k="'+k+'" data-id="'+i.id+'" aria-label="Remover '+esc(i.title)+'">&times;</button>')+
              '</div>'+
            '</div>'+
          '</div>'+
        '</li>');
      }
      if(isT&&isNow&&!nowPlaced){
        rows.push(nowLineHTML);
        nowPlaced=true;
      }
    });
    if(isT&&!nowPlaced)rows.push(nowLineHTML);
    if(DAY_END-prevEnd>=20){
      rows.push(freeGapRowHTML(k,prevEnd,DAY_END,isT&&prevEnd<=nm+5&&DAY_END>nm));
    }

    var label=(isT?'Hoje · ':'')+fmtLong(k);
    var body='<ul class="tlist amie-timeline-list">'+rows.join('')+'</ul>';

    rightContent='<div class="tp-stream-head">'+
      '<div><span class="v2-sec-eyebrow">LINHA DO DIA · '+parseKey(k).getFullYear()+'</span><h2 class="tp-day-title">'+esc(cap(label))+'</h2></div>'+
      '<div class="tci-actions">'+(isT?'':'<button class="tci-btn" data-act="day-today">Hoje</button>')+'<button class="things-magic-plus sm" data-act="block-new" aria-label="Novo bloco">+</button></div>'+
    '</div>'+
    viewTabs+
    dayPulseBarHTML(k,isT,nm,wins)+
    body+
    gcalHint(k)+
    '<div class="tp-actions-row"><button class="btn small" data-act="auto-plan-k">Montar meu dia</button><button class="btn quiet small" data-act="block-new">+ Novo bloco</button></div>';
  }

  el.innerHTML='<div class="timepage-edge-split">'+
    '<aside class="tp-dark-rail" aria-label="Dias da semana">'+
      '<button class="tp-rail-step" data-act="day-prev" aria-label="Semana anterior">&lsaquo;</button>'+
      rail+
      '<button class="tp-rail-step" data-act="day-next" aria-label="Próxima semana">&rsaquo;</button>'+
    '</aside>'+
    '<div class="tp-stream-col">'+rightContent+'</div>'+
  '</div>';
}
