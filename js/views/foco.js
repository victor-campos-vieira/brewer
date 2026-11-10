import { $, esc, pl, mmss, uid, today, fmtHM, fmtDur, seg } from '../utils.js';
import { S, UI, L, save, cmp, findTask, archiveFocus, CUP_ASSETS, cupMeta, cupImg, pickModel, addCup, cupShow, v60CarafeSVG, holdScreen, releaseLock, setAmbience, alertUser, playZenSound, toast, openSheet, closeSheet, addCafeFocus } from '../state.js';
import { render, go } from '../app.js';
import { notifyFocusDone, notifyBreakDone, notifyAwayWarning, notifyPermission } from '../notifications.js';
import { setupMediaHandlers, startFocusMedia, pauseFocusMedia, resumeFocusMedia, completeFocusMedia, stopFocusMedia, updateMediaSession } from '../media.js';

/* Conecta as ações da tela bloqueada (Play/Pause/Concluir) aos métodos de foco do Brewer */
setupMediaHandlers({
  onPlay: function() { resumeFocus(); },
  onPause: function() { pauseFocus(); },
  onStop: function() { breakFocus('gaveup'); },
  onComplete: function() { completeFocus(); }
});

/* ---------- foco: motor baseado em timestamps ---------- */
export var AWAY_ASK_MS=15000,EMERGENCY_MAX_MS=10*60000;
export function fmtAway(ms){var s=Math.round(ms/1000);return s<60?pl(s,'segundo','segundos'):pl(Math.round(s/60),'minuto','minutos')}
export function cupWorthy(mins,f){return mins>=15||!!(f&&f.test)}
export function logSession(f,mins,ok,cup){
  S.sessions.push({id:uid(),d:today(),t0:f.startTime,t1:Date.now(),mins:mins,mode:f.kind||'total',ok:!!ok,cupId:cup?cup.id:'',model:cup?cup.model:(f.model!=null?f.model:null),cat:f.cat||'',label:f.label||'',taskId:f.taskId||'',src:f.src||'manual',blockId:f.blockId||'',ext:f.ext||'',approx:false,sim:!!f.test});
  if(S.sessions.length>3000)S.sessions=S.sessions.slice(-3000);
}
export function breakFocus(reason,away){
  var f=S.focus;if(!f||f.mode!=='focus'||f.kind==='parcial')return;
  if(f.isPomo){
    toast(reason==='gaveup'?'Pomodoro interrompido. Grãos dos ciclos concluídos foram salvos!':'Pomodoro interrompido por pausa excedida.');
    releaseLock();stopFocusMedia(false);S.focus=null;save();render();
    return;
  }
  var c=(f.total>=900||f.test)?addCup(false,f,f.test):null;
  var el=Math.max(0,Math.floor((Date.now()-f.startTime-(f.pauseMs||0))/60000));
  logSession(f,Math.min(el,Math.round(f.total/60)),false,c);
  f.mode='failed';f.cupId=c?c.id:'';delete f.hiddenAt;delete f.pausedAt;
  f.msg=reason==='phone'?'Você usou o celular durante o bloco ('+fmtAway(away)+' fora). A interrupção foi registrada.':reason==='pause'?'A pausa de emergência passou de 10 minutos.':'Você desistiu do bloco.';
  if(reason==='phone')S.interruptions.push({t:Date.now(),type:'phone',mins:Math.max(1,Math.round(away/60000)),cat:f.cat||'',label:f.label});
  releaseLock();stopFocusMedia(false);save();render();
  if(S.tab!=='foco'&&S.tab!=='hoje')toast('O foco foi interrompido.');
}
export function completeFocus(){
  var f=S.focus;if(!f||f.mode!=='focus')return;
  var mins=Math.max(f.test?1:0,Math.round(f.total/60));f.mins=mins;
  if(f.isPomo&&f.pomo){
    var cycleBeans=f.kind==='parcial'?Math.max(1,Math.floor(mins/2)):mins;
    f.pomo.beansEarned=(f.pomo.beansEarned||0)+cycleBeans;
    f.pomo.completedCycles=(f.pomo.completedCycles||0)+1;
    f.beansEarned=f.pomo.beansEarned;
    logFocus(mins,f,cycleBeans);
    logSession(f,mins,true,null);
    playZenSound();alertUser();
    notifyFocusDone(mins,'Ciclo '+f.pomo.cycle+' do Pomodoro');
    if(f.pomo.cycle>=f.pomo.totalCycles){
      f.mode='done';f.pomo.phase='finished';releaseLock();completeFocusMedia(f);save();render();return;
    }
    var isLong=(f.pomo.cycle%4===0)&&(f.pomo.longBreakMins>0);
    var breakMins=isLong?f.pomo.longBreakMins:f.pomo.breakMins;
    var breakTot=breakMins*60;
    f.mode='break';f.pomo.phase=isLong?'longBreak':'break';
    f.total=breakTot;f.startTime=Date.now();f.endTime=Date.now()+breakTot*1000;
    delete f.pausedAt;delete f.hiddenAt;
    holdScreen();startFocusMedia(f);save();render();return;
  }
  var earnedBeans=f.kind==='parcial'?Math.max(1,Math.floor(mins/2)):mins;
  f.beansEarned=earnedBeans;
  logFocus(mins,f,earnedBeans);
  var c=cupWorthy(mins,f)?addCup(true,f,f.test):null;if(c)f.cupId=c.id;
  logSession(f,mins,true,c);
  f.mode='done';delete f.hiddenAt;alertUser();releaseLock();completeFocusMedia(f);save();render();
  notifyFocusDone(mins, f.label);
}
/* foco parcial: encerrar antes registra o tempo real, sem punição */
export function endPartial(){
  var f=S.focus;if(!f||f.mode!=='focus'||f.kind!=='parcial')return;
  if(f.isPomo){finishPomodoroEarly();return}
  var ref=f.pausedAt||Date.now(),mins=Math.floor(Math.max(0,ref-f.startTime-(f.pauseMs||0))/60000);
  if(f.test&&mins<1)mins=1;
  if(mins<1){S.focus=null;releaseLock();stopFocusMedia(false);save();render();toast('Menos de 1 minuto: nada foi registrado.');return}
  f.mins=mins;
  var earnedBeans=Math.max(1,Math.floor(mins/2));
  f.beansEarned=earnedBeans;
  logFocus(mins,f,earnedBeans);
  var c=cupWorthy(mins,f)?addCup(true,f,f.test):null;if(c)f.cupId=c.id;
  logSession(f,mins,true,c);
  f.early=true;f.mode='done';delete f.hiddenAt;delete f.pausedAt;releaseLock();completeFocusMedia(f);save();render();
}
export function checkReturn(){
  var f=S.focus;
  if(!f||f.mode!=='focus'||f.kind==='parcial'||!f.hiddenAt||f.pausedAt||document.hidden||UI.asking)return;
  var away=Date.now()-f.hiddenAt;
  if(away<AWAY_ASK_MS){delete f.hiddenAt;save();return}
  UI.asking=true;
  openSheet('Bem-vindo de volta','<p>Você ficou fora do Brewer por <b>'+fmtAway(away)+'</b>.</p><p class="muted small" style="margin-top:8px">O Brewer não consegue saber se você só bloqueou a tela ou usou outro app. Conte como foi:</p><div class="stack"><button class="btn block" data-act="ret-lock">Bloqueei a tela</button><button class="btn quiet block" data-act="ret-phone">Precisei usar o celular</button><button class="btn quiet block danger" data-act="ret-quit">Desisti do foco</button></div>');
}
export function answerReturn(a){
  var f=S.focus;UI.asking=false;closeSheet();
  if(!f||f.mode!=='focus')return;
  var away=f.hiddenAt?Date.now()-f.hiddenAt:0;delete f.hiddenAt;
  if(a==='lock'){save();render();if(Date.now()>=f.endTime)completeFocus()}
  else if(a==='phone')breakFocus('phone',away);
  else breakFocus('gaveup');
}
export function pauseFocus(){var f=S.focus;if(!f||f.mode!=='focus'||f.pausedAt)return;f.pausedAt=Date.now();delete f.hiddenAt;releaseLock();pauseFocusMedia();save();render()}
export function resumeFocus(){
  var f=S.focus;if(!f||!f.pausedAt)return;
  var now=Date.now(),d=now-f.pausedAt;
  if(f.kind==='parcial'){f.endTime+=d;f.pauseMs=(f.pauseMs||0)+d;delete f.pausedAt;delete f.hiddenAt;holdScreen();resumeFocusMedia();save();render();return}
  S.interruptions.push({t:now,type:'emergency',mins:Math.max(1,Math.round(d/60000)),cat:f.cat||'',label:f.label});
  if(d>EMERGENCY_MAX_MS){breakFocus('pause');return}
  f.endTime+=d;f.pauseMs=(f.pauseMs||0)+d;delete f.pausedAt;delete f.hiddenAt;holdScreen();resumeFocusMedia();save();render();
}
export function interruptLine(){
  var from=Date.now()-7*864e5,a=S.interruptions.filter(function(x){return x.t>=from});
  if(!a.length)return '';
  var ph=a.filter(function(x){return x.type==='phone'}).length;
  return '<p class="sumline">Interrupções de foco na semana: '+a.length+' ('+ph+' por uso do celular, '+(a.length-ph)+' pausas de emergência).</p>';
}

/* ---------- FOCO & RITUAL V60 ANIMADO ---------- */
export function v60PourSVG(){
  return '<div class="forest-stage">'+v60CarafeSVG(true)+'</div>';
}

export function previewStageHTML(compact){
  var cm=S.draft&&S.draft.cupModel!=null&&S.unlocked.indexOf(+S.draft.cupModel)>-1?+S.draft.cupModel:null;
  var cls='forest-stage'+(compact?' compact':'');
  if(cm!==null){
    return '<div class="'+cls+'">'+cupImg({ok:true,model:cm,id:''},'hero-img',false)+'</div>';
  }
  return '<div class="'+cls+'">'+v60CarafeSVG(false)+'</div>';
}
export function cupPickerHTML(){
  var cur=S.draft&&S.draft.cupModel!=null&&S.unlocked.indexOf(+S.draft.cupModel)>-1?+S.draft.cupModel:null;
  var total=CUP_ASSETS.good.length,un=S.unlocked.length;
  var items='<button class="cp-item" data-act="cup-pick" data-v="" aria-pressed="'+(cur===null)+'"><span class="cp-dot" style="background:var(--sun)"></span>'+(un<total?'Descobrir ('+un+'/'+total+')':'Automático')+'</button>';
  S.unlocked.forEach(function(m){
    var meta=cupMeta(m);
    items+='<button class="cp-item" data-act="cup-pick" data-v="'+m+'" aria-pressed="'+(cur===m)+'"><span class="cp-dot" style="background:'+meta.color+'"></span>'+esc(meta.name)+'</button>';
  });
  return '<div class="cup-picker" role="group" aria-label="Escolher xícara">'+items+'</div>';
}
export function ambienceHTML(){
  var cur=UI.amb||'off';
  return '<div class="amb-bar" role="group" aria-label="Som ambiente de foco">'+
    '<button class="amb-btn" data-act="amb-set" data-v="off" aria-pressed="'+(cur==='off')+'">🔇 Silêncio</button>'+
    '<button class="amb-btn" data-act="amb-set" data-v="rain" aria-pressed="'+(cur==='rain')+'">🌧️ Chuva suave</button>'+
    '<button class="amb-btn" data-act="amb-set" data-v="cafe" aria-pressed="'+(cur==='cafe')+'">☕ Cafeteria</button>'+
  '</div>';
}

export function effCat(){
  if(S.draft.cat)return S.draft.cat;
  var id=effTaskId(),t=id?findTask(id):null;return t&&t.cat?t.cat:(S.cats[0]||'Estudo');
}
export function catChips(){var c=effCat();return S.cats.map(function(n){return '<button class="chip" data-act="cat" data-v="'+esc(n)+'" aria-pressed="'+(n===c)+'">'+esc(n)+'</button>'}).join('')+'<button class="chip" data-act="cat-new">+ Nova</button>'}
export function catSelectHTML(){
  var c=effCat();
  var opts=S.cats.map(function(n){return '<option value="'+esc(n)+'"'+(n===c?' selected':'')+'>'+esc(n)+'</option>'}).join('')+'<option value="__new">+ Nova categoria...</option>';
  return '<select class="field field-sm" id="catSel" aria-label="Categoria">'+opts+'</select>';
}
export function catTotals(days){
  var t={},sum=0;
  days.forEach(function(d){var c=S.log[d]&&S.log[d].cats;if(c)Object.keys(c).forEach(function(k){t[k]=(t[k]||0)+c[k];sum+=c[k]})});
  var arr=Object.keys(t).map(function(k){return [k,t[k]]}).sort(function(a,b){return b[1]-a[1]});
  return {arr:arr,sum:sum};
}
export function catBars(days){
  var r=catTotals(days);
  if(!r.sum)return '<p class="sumline muted" style="margin-top:12px">Ainda sem blocos concluídos neste período.</p>';
  return '<div style="margin-top:14px">'+r.arr.map(function(x){
    return '<div class="crow"><span class="cname">'+esc(x[0])+'</span><span class="btrack"><span class="bfill" style="width:'+Math.round(x[1]/r.arr[0][1]*100)+'%"></span></span><span class="bval">'+fmtHM(x[1])+' ('+Math.round(x[1]/r.sum*100)+'%)</span></div>';
  }).join('')+'</div>';
}
export function catHTML(days){
  var r=catTotals(days);
  return r.sum?'<p class="sumline">Para onde foi o foco: '+r.arr.map(function(x){return esc(x[0])+' '+fmtHM(x[1])}).join(', ')+'.</p>':'';
}
export function effTaskId(){
  var undone=S.tasks.filter(function(t){return !t.done}),k=today();
  if(S.draft.taskId==='__other')return '';
  if(S.draft.taskId&&undone.some(function(t){return t.id===S.draft.taskId}))return S.draft.taskId;
  var p=undone.filter(function(t){return t.plan===k}).sort(cmp)[0];
  if(p)return p.id;
  var f=undone.sort(cmp)[0];return f?f.id:'';
}
export function logFocus(mins,f,beans){
  if(mins<=0)return;
  var lg0=L();lg0.focus+=mins;if(f){lg0.cats=lg0.cats||{};var ck=f.cat||'Sem categoria';lg0.cats[ck]=(lg0.cats[ck]||0)+mins}
  var t=f&&f.taskId?findTask(f.taskId):null;
  if(t)t.spent=(t.spent||0)+mins;
  addCafeFocus(mins,beans);
}
export var KIND_NOTE={total:'Rígido: sair do app ou desistir interrompe o bloco e não pontua grãos.',parcial:'Flexível: pode pausar e encerrar antes, pontuando pelo tempo cumprido.'};
export var TIPS=['Pegue um copo d’água e deixe o celular longe.','Abra apenas o material que você vai usar.','Organize sua mesa e vamos começar.','Deixe o celular virado para baixo.','Respire fundo e comece pela primeira pequena ação.','Feche as abas que você não vai usar.','Escolha uma única coisa para terminar neste bloco.','Ajuste a luz e a cadeira. Depois, comece.'];
export function pickTip(cfg){
  var pool=TIPS.slice(),h=new Date().getHours();
  if(cfg.kind==='parcial')pool.push('Sem pressa: comece e encerre quando precisar.','Você pode pausar quando quiser.');
  if(cfg.cat==='Estudo')pool.push('Deixe caderno e caneta ao lado.');
  if(cfg.cat==='Trabalho')pool.push('Silencie mensagens por um momento.');
  if(cfg.cat==='Saúde')pool.push('Alongue o pescoço antes de começar.');
  if(h>=20||h<6)pool.push('Baixe o brilho e deixe só o que importa aberto.');
  return pool[Math.floor(Math.random()*pool.length)];
}
export function openRitual(cfg){
  if(S.focus&&S.focus.mode==='focus'){toast('Já existe um foco em andamento.');go('foco');return}
  archiveFocus();
  cfg.kind=cfg.kind==='parcial'?'parcial':'total';UI.pre={step:'ritual',cfg:cfg,tip:pickTip(cfg)};go('foco');
}
export function beginFocus(){
  if(!UI.pre)return;var c=UI.pre.cfg;
  startFocus(c.mins,{taskId:c.taskId,label:c.label,kind:c.kind,cat:c.cat,src:c.src,blockId:c.blockId,blockDay:c.blockDay,ext:c.ext});
}
export function startFocus(mins,opts){
  opts=opts||{};
  var id=opts.taskId!==undefined?opts.taskId:effTaskId();
  var t=id?findTask(id):null;
  var cl=$('#customLabel');var custom=cl?cl.value.trim():'';
  var tot=Math.max(1,Math.round(mins*60));
  S.focus={mode:'focus',kind:opts.kind==='parcial'?'parcial':'total',src:opts.src||'manual',blockId:opts.blockId||'',blockDay:opts.blockDay||'',ext:opts.ext||'',taskId:t?t.id:'',label:opts.label||(t?t.text:(custom||'Foco livre')),total:tot,startTime:Date.now(),endTime:Date.now()+tot*1000,model:pickModel(),starter:!!opts.starter,test:mins<1,cat:(opts.cat!==undefined?opts.cat:(opts.taskId!==undefined?(t&&t.cat)||'':effCat()))||'Sem categoria'};
  UI.giveUp=false;UI.pre=null;clearTimeout(UI.preTimer);
  holdScreen();startFocusMedia(S.focus);save();go('foco');
}
export function durHTML(){
  var m=S.draft.mins;
  return '<div class="durbox compact">'+
    '<div class="dur-inline">'+
      '<button class="btn quiet small" data-act="dur-minus" aria-label="Menos 5 minutos">−5</button>'+
      '<div class="durval" id="durVal">'+(m<1?'10 s':fmtDur(m))+'</div>'+
      '<button class="btn quiet small" data-act="dur-plus" aria-label="Mais 5 minutos">+5</button>'+
    '</div>'+
    '<input type="range" class="durrange" id="durRange" min="5" max="240" step="5" value="'+Math.min(240,Math.max(5,m<5?5:m))+'" aria-label="Duração do foco em minutos">'+
    (S.testMode?'<div class="row" style="justify-content:center;margin-top:4px"><button class="btn quiet small" data-act="dur-test">10 s (teste)</button></div>':'')+
  '</div>';
}
export function kindHTML(){return '<p class="label">Como você quer focar?</p>'+seg('kind-set',S.draft.kind,[['total','Foco total'],['parcial','Foco parcial']])+'<p class="small muted" style="margin-top:8px" id="kindNote">'+KIND_NOTE[S.draft.kind]+'</p>'}
export function updateDur(){var m=S.draft.mins,v=$('#durVal'),r=$('#durRange');if(v)v.textContent=m<1?'10 s':fmtDur(m);if(r)r.value=Math.min(240,Math.max(5,m<5?5:m))}
export function setKindUI(){document.querySelectorAll('[data-act="kind-set"]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===S.draft.kind)});var ks=$('#kindSel');if(ks)ks.value=S.draft.kind;var n=$('#kindNote');if(n)n.textContent=KIND_NOTE[S.draft.kind]}
export function partialDone(f,task){
  return '<p class="lead">Você ficou '+fmtDur(Math.max(1,f.mins||Math.round(f.total/60)))+' em '+esc(f.label)+(f.early?' (encerrado antes do previsto)':'')+'. Sem punição: tudo conta.</p><div class="stack">'+(task&&!task.done?'<button class="btn quiet block" data-act="done-task">Marcar &ldquo;'+esc(task.text)+'&rdquo; como feita</button>':'')+'<button class="btn block" data-act="skip-break">Novo foco</button></div>';
}
export function renderPreHTML(){
  var p=UI.pre,c=p.cfg;
  if(p.step==='v60'){
    return '<div class="prep" style="text-align:center;padding-top:16px">'+
      v60PourSVG()+
      '<h2>Passando o café...</h2>'+
      '<p class="muted small" style="margin-top:4px">Infusão lenta na jarra. Respire fundo.</p>'+
      '<div class="bar-track" style="margin-top:14px"><div class="bar-fill"></div></div>'+
      '<div class="stack" style="margin-top:14px"><button class="btn quiet block" data-act="pre-skip">Pular e começar</button></div>'+
    '</div>';
  }
  return '<div style="text-align:center;padding-top:8px"><div class="forest-stage compact">'+v60CarafeSVG(false)+'</div><h2>Vamos preparar o café.</h2></div>'+
    '<div class="ritual" style="margin-top:12px;padding:12px 14px"><p class="small"><b>'+esc(c.label)+'</b> · '+(c.mins<1?'10 s (teste)':fmtDur(c.mins))+' ('+(c.kind==='parcial'?'foco parcial':'foco total')+')</p></div>'+
    '<p class="tip-line" style="margin-top:12px;font-size:17px">'+esc(p.tip)+'</p>'+
    (c.gcal?'<p class="small muted" style="margin-top:8px">Compromisso do Google Agenda: começa como foco parcial.</p>':'')+
    '<div class="stack" style="margin-top:14px"><button class="btn block" data-act="pre-go">Coar café e começar</button><button class="btn quiet block" data-act="pre-skip">Pular ritual</button><button class="btn quiet block" data-act="pre-back">Voltar</button></div>';
}
export function pomoDots(f){
  if(!f||!f.isPomo||!f.pomo)return '';
  var dots='',tot=f.pomo.totalCycles||4,cur=f.pomo.cycle||1;
  for(var i=1;i<=tot;i++){
    var cls='pomo-dot';
    if(i<cur||(i===cur&&f.mode==='break'))cls+=' done';
    else if(i===cur)cls+=' curr';
    dots+='<span class="'+cls+'" aria-label="Ciclo '+i+'"></span>';
  }
  return '<div class="pomo-dots">'+dots+'</div>';
}

export function pomodoroSheetHTML(cfg){
  cfg=cfg||S.draft.pomo||{preset:'classic',focusMins:25,breakMins:5,longBreakMins:15,cycles:4};
  var fM=cfg.focusMins||25,bM=cfg.breakMins||5,lM=cfg.longBreakMins||15,cy=cfg.cycles||4;
  var totalFocusMins=fM*cy;
  var totalBreakMins=bM*Math.max(0,cy-1)+(cy>=4?(lM-bM):0);
  var maxBeans=S.draft.kind==='parcial'?Math.floor(totalFocusMins/2):totalFocusMins;

  return '<div class="pomo-sheet">'+
    '<p class="muted small" style="margin-bottom:12px">Ciclos conscientes de foco com pausas para saborear seu café e recuperar o ritmo sem pressa.</p>'+
    '<div class="pomo-presets">'+
      '<button class="chip pomo-chip '+(cfg.preset==='espresso'?'active':'')+'" data-act="pomo-preset" data-v="espresso">☕ Espresso<br><small>20 / 4 min</small></button>'+
      '<button class="chip pomo-chip '+(cfg.preset==='classic'?'active':'')+'" data-act="pomo-preset" data-v="classic">☕ Coado<br><small>25 / 5 min</small></button>'+
      '<button class="chip pomo-chip '+(cfg.preset==='chemex'?'active':'')+'" data-act="pomo-preset" data-v="chemex">☕ Chemex<br><small>50 / 10 min</small></button>'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>⏱️ Tempo de Foco</label>'+
        '<div class="dur-inline" style="gap:6px">'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="focusMins" data-d="-5">−5</button>'+
          '<b class="pomo-val" id="pomoFocusVal">'+fmtDur(fM)+'</b>'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="focusMins" data-d="5">+5</button>'+
        '</div>'+
      '</div>'+
      '<input type="range" class="durrange" id="pomoFocusRange" min="10" max="60" step="5" value="'+fM+'" aria-label="Tempo de foco">'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>☕ Pausa Curta</label>'+
        '<div class="dur-inline" style="gap:6px">'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="breakMins" data-d="-1">−1</button>'+
          '<b class="pomo-val" id="pomoBreakVal">'+bM+' min</b>'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="breakMins" data-d="1">+1</button>'+
        '</div>'+
      '</div>'+
      '<input type="range" class="durrange" id="pomoBreakRange" min="2" max="15" step="1" value="'+bM+'" aria-label="Pausa curta">'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>🛋️ Pausa Longa (após 4 ciclos)</label>'+
        '<div class="dur-inline" style="gap:6px">'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="longBreakMins" data-d="-5">−5</button>'+
          '<b class="pomo-val" id="pomoLongBreakVal">'+lM+' min</b>'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="longBreakMins" data-d="5">+5</button>'+
        '</div>'+
      '</div>'+
      '<input type="range" class="durrange" id="pomoLongBreakRange" min="5" max="30" step="5" value="'+lM+'" aria-label="Pausa longa">'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>🔁 Total de Ciclos</label>'+
        '<div class="dur-inline" style="gap:6px">'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="cycles" data-d="-1">−1</button>'+
          '<b class="pomo-val" id="pomoCyclesVal">'+pl(cy,'ciclo','ciclos')+'</b>'+
          '<button class="btn quiet small btn-icon" data-act="pomo-step" data-f="cycles" data-d="1">+1</button>'+
        '</div>'+
      '</div>'+
      '<input type="range" class="durrange" id="pomoCyclesRange" min="1" max="8" step="1" value="'+cy+'" aria-label="Ciclos de foco">'+
    '</div>'+

    '<div class="nudge" id="pomoSummary" style="margin-top:14px;text-align:center">'+
      '<b>'+pl(cy,'ciclo','ciclos')+'</b> · '+fmtDur(totalFocusMins)+' foco + '+fmtDur(totalBreakMins)+' pausas<br>'+
      '<span class="muted small">☕ Recompensa: até <b>'+maxBeans+' grãos</b> de café</span>'+
    '</div>'+

    '<div class="stack" style="margin-top:16px">'+
      '<button class="btn brown block" data-act="start-pomo-session" style="font-size:16px;padding:14px 18px">Iniciar Pomodoro ☕</button>'+
    '</div>'+
  '</div>';
}

export function updatePomoSummary(){
  var p=S.draft.pomo;if(!p)return;
  var fv=$('#pomoFocusVal'),fr=$('#pomoFocusRange');
  var bv=$('#pomoBreakVal'),br=$('#pomoBreakRange');
  var lv=$('#pomoLongBreakVal'),lr=$('#pomoLongBreakRange');
  var cv=$('#pomoCyclesVal'),cr=$('#pomoCyclesRange');
  var sm=$('#pomoSummary');
  if(fv)fv.textContent=fmtDur(p.focusMins);
  if(fr)fr.value=p.focusMins;
  if(bv)bv.textContent=p.breakMins+' min';
  if(br)br.value=p.breakMins;
  if(lv)lv.textContent=p.longBreakMins+' min';
  if(lr)lr.value=p.longBreakMins;
  if(cv)cv.textContent=pl(p.cycles,'ciclo','ciclos');
  if(cr)cr.value=p.cycles;
  if(sm){
    var totalFocusMins=p.focusMins*p.cycles;
    var totalBreakMins=p.breakMins*Math.max(0,p.cycles-1)+(p.cycles>=4?(p.longBreakMins-p.breakMins):0);
    var maxBeans=S.draft.kind==='parcial'?Math.floor(totalFocusMins/2):totalFocusMins;
    sm.innerHTML='<b>'+pl(p.cycles,'ciclo','ciclos')+'</b> · '+fmtDur(totalFocusMins)+' foco + '+fmtDur(totalBreakMins)+' pausas<br>'+
      '<span class="muted small">☕ Recompensa: até <b>'+maxBeans+' grãos</b> de café</span>';
  }
}

export function startPomodoro(cfg){
  cfg=cfg||S.draft.pomo||{focusMins:25,breakMins:5,longBreakMins:15,cycles:4};
  var id=effTaskId(),t=id?findTask(id):null;
  var cl=$('#customLabel'),custom=cl?cl.value.trim():'';
  var focusMins=cfg.focusMins||25,tot=Math.max(1,Math.round(focusMins*60));
  var label=t?t.text:(custom||'Pomodoro de Café');
  S.focus={
    mode:'focus',
    kind:S.draft.kind==='parcial'?'parcial':'total',
    isPomo:true,
    pomo:{
      cycle:1,
      totalCycles:cfg.cycles||4,
      focusMins:focusMins,
      breakMins:cfg.breakMins||5,
      longBreakMins:cfg.longBreakMins||15,
      phase:'focus',
      beansEarned:0,
      completedCycles:0
    },
    src:'manual',
    taskId:t?t.id:'',
    label:label,
    cat:effCat(),
    total:tot,
    startTime:Date.now(),
    endTime:Date.now()+tot*1000,
    model:pickModel(),
    starter:false,
    test:false
  };
  UI.giveUp=false;UI.pre=null;clearTimeout(UI.preTimer);closeSheet();
  holdScreen();startFocusMedia(S.focus);save();go('foco');
}

export function startNextPomoCycle(){
  var f=S.focus;if(!f||!f.isPomo||!f.pomo)return;
  f.pomo.cycle+=1;
  f.pomo.phase='focus';
  f.mode='focus';
  var tot=Math.max(1,Math.round(f.pomo.focusMins*60));
  f.total=tot;
  f.startTime=Date.now();
  f.endTime=Date.now()+tot*1000;
  delete f.pausedAt;delete f.hiddenAt;
  holdScreen();startFocusMedia(f);save();render();
}

export function finishPomodoroEarly(){
  var f=S.focus;if(!f||!f.isPomo||!f.pomo)return;
  if(f.mode==='focus'&&f.kind==='parcial'){
    var ref=f.pausedAt||Date.now();
    var elapsed=Math.floor(Math.max(0,ref-f.startTime-(f.pauseMs||0))/60000);
    if(elapsed>=1){
      var pb=Math.max(1,Math.floor(elapsed/2));
      logFocus(elapsed,f,pb);
      f.pomo.beansEarned=(f.pomo.beansEarned||0)+pb;
    }
  }
  var totalBeans=f.pomo.beansEarned||0;
  releaseLock();stopFocusMedia(false);S.focus=null;save();go('hoje');
  toast('Pomodoro encerrado: +'+totalBeans+' grãos guardados na Cafeteria ☕');
}

export function focusBuilderHTML(inHome){
  var k=today(),undone=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===k)-(a.plan===k))||cmp(a,b)});
  var cur=effTaskId();
  var opts=undone.map(function(t){return '<option value="'+t.id+'"'+(t.id===cur?' selected':'')+'>'+esc(t.text)+'</option>'}).join('')+'<option value="__other"'+(cur===''?' selected':'')+'>Outra coisa / Foco livre</option>';
  var kd=S.draft.kind==='parcial'?'parcial':'total';
  return '<div class="'+(inHome?'forest-card':'')+'">'+
    '<div class="forest-head">'+
      previewStageHTML(true)+
      cupPickerHTML()+
      durHTML()+
    '</div>'+
    '<div class="focus-fields">'+
      '<select class="field field-sm" id="taskSel" aria-label="No que você vai focar?">'+opts+'</select>'+
      (cur===''?'<input class="field field-sm" id="customLabel" type="text" maxlength="60" placeholder="O que você vai fazer agora?" style="margin-top:8px">':'')+
      '<div class="focus-grid-2">'+
        '<div><label class="mini-lbl" for="catSel">Categoria</label>'+catSelectHTML()+'</div>'+
        '<div><label class="mini-lbl" for="kindSel">Modo</label><select class="field field-sm" id="kindSel" aria-label="Modo de foco"><option value="total"'+(kd==='total'?' selected':'')+'>Total (rígido)</option><option value="parcial"'+(kd==='parcial'?' selected':'')+'>Parcial (livre)</option></select></div>'+
      '</div>'+
    '</div>'+
    '<button class="btn block" data-act="start-focus" style="margin-top:12px">Preparar café</button>'+
    '<button class="btn brown block" data-act="pomo-sheet" style="margin-top:8px">☕ Modo Pomodoro</button>'+
  '</div>';
}

export function activeFocusHTML(){
  var f=S.focus;
  if(f.mode==='focus'){
    var paused=!!f.pausedAt,rem=paused?f.endTime-f.pausedAt:f.endTime-Date.now();
    var gu=UI.giveUp?'<button class="btn quiet block danger" data-act="stop-focus">Tenho certeza: interromper foco</button>':'<button class="btn quiet block" data-act="give-up">Desistir</button>';
    var btns;
    if(f.isPomo){
      btns=f.kind==='parcial'
        ?(paused?'<div class="stack"><button class="btn block" data-act="resume">Retomar</button><button class="btn quiet block danger" data-act="pomo-finish-early">Encerrar Pomodoro</button></div>':'<div class="stack"><button class="btn sun block" data-act="to-urge">A vontade bateu</button><button class="btn quiet block" data-act="pause">Pausar</button><button class="btn quiet block danger" data-act="pomo-finish-early">Encerrar Pomodoro</button></div>')
        :(paused?'<div class="stack"><button class="btn block" data-act="resume">Retomar o foco</button><button class="btn quiet block danger" data-act="pomo-finish-early">Desistir do Pomodoro</button></div>':'<div class="stack"><button class="btn sun block" data-act="to-urge">A vontade bateu</button><button class="btn quiet block" data-act="pause">Pausa de emergência</button><button class="btn quiet block danger" data-act="pomo-finish-early">Desistir do Pomodoro</button></div>');
    } else {
      btns=f.kind==='parcial'
        ?(paused?'<div class="stack"><button class="btn block" data-act="resume">Retomar</button><button class="btn quiet block" data-act="end-partial">Encerrar foco</button></div>':'<div class="stack"><button class="btn sun block" data-act="to-urge">A vontade bateu</button><button class="btn quiet block" data-act="pause">Pausar</button><button class="btn quiet block" data-act="end-partial">Encerrar foco</button></div>')
        :(paused?'<div class="stack"><button class="btn block" data-act="resume">Retomar o foco</button>'+gu+'</div>':'<div class="stack"><button class="btn sun block" data-act="to-urge">A vontade bateu</button><button class="btn quiet block" data-act="pause">Pausa de emergência</button>'+gu+'</div>');
    }
    var sim=(S.testMode&&!paused&&f.kind!=='parcial')?'<div class="row"><button class="btn quiet small" data-act="sim-away" data-v="10">Simular 10 s fora</button><button class="btn quiet small" data-act="sim-away" data-v="30">Simular 30 s fora</button><button class="btn quiet small" data-act="sim-away" data-v="120">Simular 2 min fora</button></div>':'';
    var headerBadge=f.isPomo
      ?'<div class="pomo-badge">☕ Pomodoro · Ciclo '+f.pomo.cycle+' de '+f.pomo.totalCycles+' ('+(f.kind==='parcial'?'Parcial':'Total')+')</div>'
      :'<p class="muted small" style="text-transform:uppercase;letter-spacing:.06em;font-weight:700">'+esc(f.cat||'Foco')+(f.kind==='parcial'?' · Parcial':' · Foco Total')+'</p>';

    return '<div class="focus-immersive">'+
      headerBadge+
      (f.isPomo?pomoDots(f):'')+
      '<h2 style="margin-top:6px">'+esc(f.label)+'</h2>'+
      (paused?(f.kind==='parcial'?'<div class="nudge small" style="margin-top:12px">Em pausa. O tempo está parado.</div>':'<div class="nudge small" style="margin-top:12px">Pausa de emergência (máx. 10 min).</div>'):'')+
      '<div class="bigtime" id="focusTime" style="margin-top:24px">'+mmss(rem)+'</div>'+
      '<div class="bar-track" style="max-width:280px;margin:14px auto 0"><div class="bar-fill" id="focusBar"></div></div>'+
      (paused?'':ambienceHTML())+
      (paused?'':(notifyPermission()==='default'?'<div style="margin-top:12px"><button class="btn quiet small" style="min-height:30px;font-size:12px;padding:0 12px" data-act="notify-enable">🔔 Ativar alertas de término</button></div>':'<p class="muted small" style="font-size:11px;margin-top:10px">🔔 Alerta ativado ao terminar</p>'))+
      (paused?'':'<p class="muted small" style="margin-top:14px">'+(f.kind==='parcial'?'Modo flexível: você pode pausar e encerrar quando quiser.':'Pode bloquear a tela. Sair para outro app interrompe o foco.')+'</p>')+
      (paused?'':'<p class="muted small" style="font-size:11px;margin-top:6px;opacity:.8">📱 Contador e controles ativos na tela bloqueada</p>')+
      '<div style="margin-top:22px">'+btns+sim+'</div>'+
    '</div>';
  }
  if(f.mode==='break'){
    if(f.isPomo&&f.pomo){
      return '<div class="focus-immersive">'+
        '<div class="pomo-badge break">☕ '+(f.pomo.phase==='longBreak'?'Pausa Longa':'Pausa do Café')+' · Ciclo '+f.pomo.cycle+' de '+f.pomo.totalCycles+'</div>'+
        pomoDots(f)+
        '<h2 style="margin-top:6px">Momento do Café</h2>'+
        '<div class="bigtime" id="focusTime" style="margin-top:24px">'+mmss(f.endTime-Date.now())+'</div>'+
        '<div class="bar-track" style="max-width:280px;margin:14px auto 0"><div class="bar-fill" id="focusBar"></div></div>'+
        '<div class="nudge" style="margin:16px 0;text-align:center;font-size:14px">☕ <b>+'+(f.pomo.beansEarned||0)+' grãos</b> colhidos até agora!</div>'+
        '<p class="lead" style="max-width:340px;margin:10px auto">Hora de alongar, tomar uma água fresca ou saborear um café. Celular liberado até o fim da pausa.</p>'+
        '<div class="stack" style="margin-top:22px"><button class="btn brown block" data-act="pomo-start-next">Pular pausa e começar Ciclo '+(f.pomo.cycle+1)+'</button><button class="btn quiet block danger" data-act="pomo-finish-early">Encerrar Pomodoro por aqui</button></div>'+
      '</div>';
    }
    return '<h2>Pausa</h2><div class="bigtime" id="focusTime">'+mmss(f.endTime-Date.now())+'</div>'+
      '<div class="bar-track"><div class="bar-fill" id="focusBar"></div></div>'+
      '<p class="lead">Celular liberado até o fim do tempo. Quando acabar, ele volta para o bolso.</p>'+
      '<div class="stack"><button class="btn quiet block" data-act="skip-break">Encerrar pausa</button></div>';
  }
  if(f.mode==='pomo-ready'){
    return '<div class="focus-immersive">'+
      '<div class="pomo-badge break">☕ Pausa Finalizada</div>'+
      pomoDots(f)+
      '<h2>Pronto para o Ciclo '+(f.pomo.cycle+1)+' de '+f.pomo.totalCycles+'?</h2>'+
      '<div class="nudge" style="margin:16px 0;text-align:center;font-size:15px">☕ <b>+'+(f.pomo.beansEarned||0)+' grãos</b> guardados na Cafeteria!</div>'+
      '<p class="lead" style="max-width:340px;margin:10px auto">A pausa terminou. Respire fundo, deixe as distrações de lado e prepare o próximo bloco de '+f.pomo.focusMins+' min.</p>'+
      '<div class="stack" style="margin-top:24px"><button class="btn brown block" data-act="pomo-start-next" style="font-size:16px;padding:14px 18px">☕ Iniciar Ciclo '+(f.pomo.cycle+1)+' ('+f.pomo.focusMins+' min)</button><button class="btn quiet block" data-act="pomo-finish-early">Encerrar Pomodoro e guardar grãos</button></div>'+
    '</div>';
  }
  if(f.mode==='done'){
    if(f.isPomo&&f.pomo){
      return '<h1>☕ Pomodoro Concluído!</h1>'+
        '<div class="nudge" style="margin:16px 0;text-align:center;font-size:16px">☕ <b>+'+(f.pomo.beansEarned||0)+' grãos de café</b> colhidos para a sua Cafeteria!</div>'+
        '<p class="lead">Parabéns! Você concluiu todos os <b>'+(f.pomo.completedCycles||f.pomo.totalCycles)+' ciclos</b> ('+((f.pomo.completedCycles||f.pomo.totalCycles)*f.pomo.focusMins)+' minutos focados).</p>'+
        '<div class="stack" style="margin-top:20px"><button class="btn brown block" data-act="tab" data-tab="colecao">Ver minha Cafeteria ☕</button><button class="btn quiet block" data-act="skip-break">Voltar ao Hoje</button></div>';
    }
    var task=f.taskId?findTask(f.taskId):null;
    var body=f.starter
      ?'<p class="lead">Você começou, que era a parte difícil. Quer continuar?</p><div class="stack"><button class="btn block" data-act="more-block">Continuar por mais 25 min</button>'+(task&&!task.done?'<button class="btn quiet block" data-act="done-task">Terminei a tarefa</button>':'')+'<button class="btn quiet block" data-act="skip-break">Parar por aqui</button></div>'
      :'<p class="lead">Você ficou '+Math.max(1,Math.round(f.total/60))+' minutos em '+esc(f.cat&&f.cat!=='Sem categoria'?f.cat:'uma coisa só')+'. Agora a pausa é sua, com hora para acabar.</p><div class="stack"><button class="btn sun block" data-act="start-break">Pausa de 5 min, celular liberado</button>'+(task&&!task.done?'<button class="btn quiet block" data-act="done-task">Marcar &ldquo;'+esc(task.text)+'&rdquo; como feita</button>':'')+'<button class="btn quiet block" data-act="skip-break">Pular pausa</button></div>';
    var earnedCount=f.beansEarned!==undefined?f.beansEarned:Math.max(1,Math.round(f.total/60));
    var beansBadge='<div class="nudge" style="margin:16px 0;text-align:center;font-size:15px">☕ <b>+'+earnedCount+' grãos de café</b> adicionados à sua Cafeteria!</div>';
    return '<h1>'+(f.kind==='parcial'?'Foco parcial registrado.':'Bloco concluído!')+'</h1>'+beansBadge+(f.kind==='parcial'?partialDone(f,task):body);
  }
  if(f.mode==='failed'){
    return '<h1>Bloco interrompido</h1><p class="lead">'+esc(f.msg)+' Acontece! Nenhum grão foi perdido, mas você não colheu grãos dessa vez. O importante é descansar um pouco e tentar de novo no seu ritmo.</p><div class="stack"><button class="btn block" data-act="skip-break">Tentar de novo</button><button class="btn quiet block" data-act="tab" data-tab="colecao">Ver cafeteria</button></div>';
  }
  return '<h1>A pausa acabou.</h1><p class="lead">Combinado é combinado. Hora do próximo bloco.</p><div class="stack"><button class="btn block" data-act="skip-break">Novo bloco</button></div>';
}
export function renderFoco(){
  var f=S.focus,el=$('#tab-foco');
  if(f&&UI.pre&&f.mode!=='focus'){archiveFocus();f=S.focus}
  if(!f){
    if(UI.pre){el.innerHTML=renderPreHTML();return}
    el.innerHTML=focusBuilderHTML(false);
    return;
  }
  el.innerHTML=activeFocusHTML();
}
