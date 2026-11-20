import { $, esc, pl, mmss, uid, today, fmtHM, fmtDur, seg, IC_BELL, IC_SPARK, IC_LOCK_PHONE, IC_CAFE, IC_TARGET, IC_PLAY } from '../utils.js';
import { S, UI, L, save, cmp, findTask, archiveFocus, CUP_ASSETS, cupMeta, cupImg, pickModel, addCup, cupShow, v60CarafeSVG, holdScreen, releaseLock, setAmbience, alertUser, playZenSound, toast, openSheet, closeSheet, addCafeFocus, nextCafeUnlock } from '../state.js';
import { render, go } from '../app.js';
import { notifyFocusDone, notifyBreakDone, notifyAwayWarning, notifyPermission } from '../notifications.js';
import { setupMediaHandlers, startFocusMedia, pauseFocusMedia, resumeFocusMedia, completeFocusMedia, stopFocusMedia, updateMediaSession } from '../media.js';
import { methodForMins, finishAtLabel, updateDialVisuals, playTactileTick } from '../interactions.js';
import { calcLevelInfo } from './cafe.js';

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
  var bonus=0;
  if(f.kind==='total'){
    // Bônus de Microlote aleatório (+20% a +40%, mín 2 grãos) para incentivar Foco Total
    bonus=Math.max(2,Math.round(mins*(0.20+Math.random()*0.20)));
  }
  if(f.isPomo&&f.pomo){
    var cycleBeans=mins+bonus;
    f.pomo.beansEarned=(f.pomo.beansEarned||0)+cycleBeans;
    f.pomo.completedCycles=(f.pomo.completedCycles||0)+1;
    f.beansEarned=f.pomo.beansEarned;
    f.lastBonus=bonus;
    logFocus(mins,f,cycleBeans);
    logSession(f,mins,true,null);
    playZenSound();alertUser();
    var bonusTxt=bonus?' (+'+bonus+' bônus microlote!)':'';
    notifyFocusDone(mins,'Ciclo '+f.pomo.cycle+' do Pomodoro'+bonusTxt);
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
  var earnedBeans=mins+bonus;
  f.beansEarned=earnedBeans;
  f.bonusBeans=bonus;
  logFocus(mins,f,earnedBeans);
  var c=cupWorthy(mins,f)?addCup(true,f,f.test):null;if(c)f.cupId=c.id;
  logSession(f,mins,true,c);
  f.mode='done';delete f.hiddenAt;alertUser();releaseLock();completeFocusMedia(f);save();render();
  var bonusTxt2=bonus?' (+'+bonus+' bônus safra!)':'';
  notifyFocusDone(mins, f.label+bonusTxt2);
}
/* foco parcial: encerrar antes registra o tempo real, pontuando 50% dos minutos cumpridos */
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
  var icOff='<svg class="ic-v2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  var icRain='<svg class="ic-v2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>';
  return '<div class="endel-orb-dock" role="group" aria-label="Paisagem sonora Endel">'+
    '<button class="endel-orb" data-act="amb-set" data-v="off" aria-pressed="'+(cur==='off')+'">'+
      '<span class="eo-circle">'+icOff+'</span><span class="eo-lbl">Silêncio</span>'+
    '</button>'+
    '<button class="endel-orb" data-act="amb-set" data-v="cafe" aria-pressed="'+(cur==='cafe')+'">'+
      '<span class="eo-circle">'+IC_CAFE+'</span><span class="eo-lbl">Cafeteria</span>'+
    '</button>'+
    '<button class="endel-orb" data-act="amb-set" data-v="rain" aria-pressed="'+(cur==='rain')+'">'+
      '<span class="eo-circle">'+icRain+'</span><span class="eo-lbl">Chuva</span>'+
    '</button>'+
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
export var KIND_NOTE={
  total:'Rígido (All-or-nothing): complete o bloco para ganhar o valor cheio + Bônus de Microlote (+20% a +40%). Sair do app ou desistir zera a colheita.',
  parcial:'Flexível: conclua o tempo para ganhar 100% dos grãos. Se precisar pausar ou encerrar antes, pontua a metade (50%) dos minutos cumpridos.'
};
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
  var presets=[15,25,45,60].map(function(p){
    return '<button class="dur-chip-v2" data-act="dur-set" data-v="'+p+'" aria-pressed="'+(Math.round(m)===p)+'">'+p+'m</button>';
  }).join('');
  return '<div class="durbox compact durbox-v2">'+
    '<div class="dur-display-frame">'+
      '<button class="dur-step-v2" data-act="dur-minus" aria-label="Menos 5 minutos">−5</button>'+
      '<div class="durval" id="durVal">'+(m<1?'10 s':fmtDur(m))+'</div>'+
      '<button class="dur-step-v2" data-act="dur-plus" aria-label="Mais 5 minutos">+5</button>'+
    '</div>'+
    '<div class="dur-presets-v2" role="group" aria-label="Durações rápidas">'+presets+'</div>'+
    '<input type="range" class="durrange" id="durRange" min="5" max="240" step="5" value="'+Math.min(240,Math.max(5,m<5?5:m))+'" aria-label="Duração do foco em minutos">'+
    (S.testMode?'<div class="row" style="justify-content:center;margin-top:4px"><button class="btn quiet small" data-act="dur-test">10 s (teste)</button></div>':'')+
  '</div>';
}
export function kindHTML(){return '<p class="label">Como você quer focar?</p>'+seg('kind-set',S.draft.kind,[['total','Foco total'],['parcial','Foco parcial']])+'<p class="small muted" style="margin-top:8px" id="kindNote">'+KIND_NOTE[S.draft.kind]+'</p>'}
export function updateDur(){
  var m=S.draft.mins;
  playTactileTick(520+Math.min(120,m)*2.5,0.015,0.04);
  updateDialVisuals(m,S.draft.kind);
}
export function setKindUI(){document.querySelectorAll('[data-act="kind-set"]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===S.draft.kind)});var ks=$('#kindSel');if(ks)ks.value=S.draft.kind;var n=$('#kindNote');if(n)n.textContent=KIND_NOTE[S.draft.kind]}
export function partialDone(f,task){
  return '<p class="lead">Você ficou '+fmtDur(Math.max(1,f.mins||Math.round(f.total/60)))+' em '+esc(f.label)+(f.early?' (encerrado antes do previsto)':'')+'. Sem punição: tudo conta.</p><div class="stack">'+(task&&!task.done?'<button class="btn quiet block" data-act="done-task">Marcar &ldquo;'+esc(task.text)+'&rdquo; como feita</button>':'')+'<button class="btn block" data-act="skip-break">Novo foco</button></div>';
}
export function renderPreHTML(){
  var p=UI.pre,c=p.cfg;
  var mins=Math.max(1,Math.round(c.mins||25));
  var meth=methodForMins(mins);
  var estBeans=c.kind==='parcial'?Math.max(1,Math.floor(mins/2)):mins;
  var curAmb=UI.amb||'off';
  var ambSeg='<div class="bls-amb-seg" role="group" aria-label="Som ambiente">'+
    '<button type="button" class="bas-btn'+(curAmb==='off'?' active':'')+'" data-act="amb-set" data-v="off">Silêncio</button>'+
    '<button type="button" class="bas-btn'+(curAmb==='cafe'?' active':'')+'" data-act="amb-set" data-v="cafe">Cafeteria</button>'+
    '<button type="button" class="bas-btn'+(curAmb==='rain'?' active':'')+'" data-act="amb-set" data-v="rain">Chuva</button>'+
  '</div>';

  return '<div class="brew-launch-stage">'+
    '<canvas id="brewVesselCanvas" class="brew-vessel-canvas" aria-hidden="true"></canvas>'+
    '<div class="bls-content">'+
      '<div class="bls-top-pills">'+
        '<span class="bls-pill">'+esc(meth.name)+' &middot; '+(c.mins<1?'10 s (teste)':fmtDur(c.mins))+'</span>'+
        '<span class="bls-pill gold">+'+estBeans+'g'+(c.kind==='total'?' + bônus':'')+'</span>'+
      '</div>'+
      '<h2 class="bls-task-title">'+esc(c.label)+'</h2>'+
      '<p class="bls-tip">'+esc(p.tip)+'</p>'+
      (c.gcal?'<p class="bls-gcal-note">Compromisso do Google Agenda: iniciado como foco parcial.</p>':'')+

      /* Som ambiente em cápsula limpa idêntica ao design system do restante do app */
      ambSeg+

      /* Pílula Tátil Hold-to-Fill (preenchimento creme deslizante 100% coeso com o botão Iniciar Foco) */
      '<div class="bls-hold-wrap">'+
        '<button id="holdBrewBtn" class="hold-pill-btn" type="button" style="--hold:0%" aria-label="Segure para começar a sessão de foco">'+
          '<span class="hpb-layer base">'+IC_PLAY+' <span class="hpb-txt">Segure para começar</span></span>'+
          '<span class="hpb-layer fill" aria-hidden="true">'+IC_PLAY+' <span class="hpb-txt">Segure para começar</span></span>'+
        '</button>'+
        '<span class="hpb-hint" id="holdBrewHint">Segure por 1 segundo para entrar no foco</span>'+
      '</div>'+

      '<div class="bls-foot-actions">'+
        '<button class="bls-fast-link" data-act="pre-skip">Começar direto sem segurar</button>'+
        '<button class="bls-back-link" data-act="pre-back">Voltar</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}
const IC_CLOCK='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const IC_CUP='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>';
const IC_REST='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>';
const IC_SOFA='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18v3M20 18v3M2 11h20M4 11V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/></svg>';
const IC_REPEAT='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>';
const IC_BEAN='<svg width="15" height="15" viewBox="0 0 16 16" style="vertical-align:middle;display:inline-block;margin-right:4px" aria-hidden="true"><g transform="rotate(28 8 8)"><ellipse cx="8" cy="8" rx="4.6" ry="6.4" fill="currentColor"/><path d="M8 2.2c-2 2.5 2 5.6 0 11.6" stroke="var(--surface)" stroke-width="1.3" fill="none" stroke-linecap="round"/></g></svg>';

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
  cfg=cfg||S.draft.pomo||{preset:'classic',focusMins:25,breakMins:5,longBreakMins:15,cycles:4,kind:'total'};
  var fM=cfg.focusMins||25,bM=cfg.breakMins||5,lM=cfg.longBreakMins||15,cy=cfg.cycles||4;
  var kd=cfg.kind||'total';
  var totalFocusMins=fM*cy;
  var totalBreakMins=bM*Math.max(0,cy-1)+(cy>=4?(lM-bM):0);
  var maxBeans=kd==='parcial'?Math.floor(totalFocusMins/2):totalFocusMins;

  var noteTotal='Rígido (All-or-nothing): conclua cada ciclo para ganhar o valor cheio + Bônus de Microlote (+20% a +40% grãos extras). Sair do app ou desistir zera a colheita do ciclo.';
  var noteParcial='Flexível: conclua o tempo para ganhar 100% dos grãos. Se precisar pausar ou encerrar antes, pontua a metade (50%) dos minutos cumpridos.';

  return '<div class="pomo-sheet">'+
    '<p class="muted small" style="margin-bottom:14px">Ciclos conscientes de foco com pausas estruturadas para recuperar a atenção no seu ritmo.</p>'+
    
    '<div class="pomo-presets">'+
      '<button class="pomo-chip '+(cfg.preset==='espresso'?'active':'')+'" data-act="pomo-preset" data-v="espresso">'+IC_CUP+'Espresso<small>20 / 4 min</small></button>'+
      '<button class="pomo-chip '+(cfg.preset==='classic'?'active':'')+'" data-act="pomo-preset" data-v="classic">'+IC_CUP+'Coado<small>25 / 5 min</small></button>'+
      '<button class="pomo-chip '+(cfg.preset==='chemex'?'active':'')+'" data-act="pomo-preset" data-v="chemex">'+IC_CUP+'Chemex<small>50 / 10 min</small></button>'+
    '</div>'+

    '<div class="pomo-control-card" style="margin-bottom:10px">'+
      '<label class="mini-lbl" style="display:block;margin-bottom:8px;font-weight:700">Regra de Foco &amp; Grãos</label>'+
      '<div class="seg" style="margin-top:0">'+
        '<button data-act="pomo-kind" data-v="total" aria-pressed="'+(kd==='total')+'">Foco Total</button>'+
        '<button data-act="pomo-kind" data-v="parcial" aria-pressed="'+(kd==='parcial')+'">Foco Parcial</button>'+
      '</div>'+
      '<p class="small muted" id="pomoKindNote" style="margin-top:8px;line-height:1.4">'+(kd==='total'?noteTotal:noteParcial)+'</p>'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>'+IC_CLOCK+' Tempo de Foco</label>'+
        '<div class="dur-inline" style="gap:8px">'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="focusMins" data-d="-5">&minus;5</button>'+
          '<b class="pomo-val" id="pomoFocusVal">'+fmtDur(fM)+'</b>'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="focusMins" data-d="5">+5</button>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>'+IC_REST+' Pausa Curta</label>'+
        '<div class="dur-inline" style="gap:8px">'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="breakMins" data-d="-1">&minus;1</button>'+
          '<b class="pomo-val" id="pomoBreakVal">'+bM+' min</b>'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="breakMins" data-d="1">+1</button>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>'+IC_SOFA+' Pausa Longa (4&ordm; ciclo)</label>'+
        '<div class="dur-inline" style="gap:8px">'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="longBreakMins" data-d="-5">&minus;5</button>'+
          '<b class="pomo-val" id="pomoLongBreakVal">'+lM+' min</b>'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="longBreakMins" data-d="5">+5</button>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="pomo-control-card">'+
      '<div class="pomo-row-head">'+
        '<label>'+IC_REPEAT+' Total de Ciclos</label>'+
        '<div class="dur-inline" style="gap:8px">'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="cycles" data-d="-1">&minus;1</button>'+
          '<b class="pomo-val" id="pomoCyclesVal">'+pl(cy,'ciclo','ciclos')+'</b>'+
          '<button class="vop-step sm" data-act="pomo-step" data-f="cycles" data-d="1">+1</button>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="nudge" id="pomoSummary" style="margin-top:14px;text-align:center">'+
      '<b>'+pl(cy,'ciclo','ciclos')+'</b> · '+fmtDur(totalFocusMins)+' de foco + '+fmtDur(totalBreakMins)+' de pausas<br>'+
      '<span class="muted small">'+IC_BEAN+'Recompensa: até <b>'+maxBeans+' grãos</b> ('+(kd==='parcial'?'50% do tempo':'100% ao concluir ciclos')+')</span>'+
    '</div>'+

    '<div class="stack" style="margin-top:16px">'+
      '<button class="btn sun block" data-act="start-pomo-session" style="font-size:16px;font-weight:700;padding:14px 18px">'+IC_CLOCK+' Iniciar Pomodoro</button>'+
      '<button class="btn quiet block" data-act="sheet-close">Fechar</button>'+
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
  var kn=$('#pomoKindNote');
  var kd=p.kind||'total';

  if(fv)fv.textContent=fmtDur(p.focusMins);
  if(fr)fr.value=p.focusMins;
  if(bv)bv.textContent=p.breakMins+' min';
  if(br)br.value=p.breakMins;
  if(lv)lv.textContent=p.longBreakMins+' min';
  if(lr)lr.value=p.longBreakMins;
  if(cv)cv.textContent=pl(p.cycles,'ciclo','ciclos');
  if(cr)cr.value=p.cycles;
  if(kn){
    var noteTotal='Rígido: cada ciclo completo rende 100% dos grãos ('+p.focusMins+' grãos por ciclo). Sair do app ou desistir interrompe o ciclo atual, mas os ciclos anteriores continuam salvos.';
    var noteParcial='Flexível: você pode pausar ou encerrar quando quiser sem penalidade. Cada minuto cumprido rende 50% em grãos.';
    kn.textContent=kd==='total'?noteTotal:noteParcial;
  }
  if(sm){
    var totalFocusMins=p.focusMins*p.cycles;
    var totalBreakMins=p.breakMins*Math.max(0,p.cycles-1)+(p.cycles>=4?(p.longBreakMins-p.breakMins):0);
    var maxBeans=kd==='parcial'?Math.floor(totalFocusMins/2):totalFocusMins;
    sm.innerHTML='<b>'+pl(p.cycles,'ciclo','ciclos')+'</b> · '+fmtDur(totalFocusMins)+' de foco + '+fmtDur(totalBreakMins)+' de pausas<br>'+
      '<span class="muted small">'+IC_BEAN+'Recompensa: até <b>'+maxBeans+' grãos</b> ('+(kd==='parcial'?'50% do tempo':'100% ao concluir ciclos')+')</span>';
  }
}

export function startPomodoro(cfg){
  cfg=cfg||S.draft.pomo||{focusMins:25,breakMins:5,longBreakMins:15,cycles:4,kind:'total'};
  var id=effTaskId(),t=id?findTask(id):null;
  var cl=$('#customLabel'),custom=cl?cl.value.trim():'';
  var focusMins=cfg.focusMins||25,tot=Math.max(1,Math.round(focusMins*60));
  var label=t?t.text:(custom||'Pomodoro de Café');
  var pomoKind=(cfg.kind==='parcial'||(S.draft.pomo&&S.draft.pomo.kind==='parcial'))?'parcial':'total';
  S.focus={
    mode:'focus',
    kind:pomoKind,
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
  toast('Pomodoro encerrado: +'+totalBeans+' grãos guardados na Cafeteria');
}

export function focusTaskSheet(){
  var k=today(),undone=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===k)-(a.plan===k))||cmp(a,b)});
  var cur=effTaskId();
  var list=undone.map(function(t){
    var pCls=t.prio===1?'prio-1':t.prio===3?'prio-3':'prio-2';
    var sel=(t.id===cur);
    return '<li class="task task-card-v2"><span class="prio-dot '+pCls+'"></span>'+
      '<button class="ttext" data-act="focus-pick-id" data-id="'+t.id+'"><b>'+esc(t.text)+'</b>'+(t.plan===k?' <span class="tag">3 de Hoje</span>':'')+'</button>'+
      '<button class="task-act-btn'+(sel?' primary':'')+'" data-act="focus-pick-id" data-id="'+t.id+'">'+(sel?'Selecionada':'Escolher')+'</button>'+
    '</li>';
  }).join('');
  openSheet('No que você vai focar?',
    '<button class="v2-free-focus-opt'+(cur===''?' active':'')+'" data-act="focus-pick-id" data-id="__other">'+
      '<b>Foco livre / Outra atividade</b><span>Sem vínculo com tarefa específica</span>'+
    '</button>'+
    '<input class="field field-sm" id="sheetCustomLabel" type="text" maxlength="60" value="'+esc(S.draft.customLabel||'')+'" placeholder="Nome do bloco livre (ex.: Leitura, Estudo...)" style="margin-top:8px">'+
    (list?'<p class="flabel" style="margin-top:16px">Suas tarefas abertas</p><ul class="tasks tasks-cards-v2">'+list+'</ul>':'')+
    '<div class="stack" style="margin-top:18px"><button class="btn block" data-act="focus-pick-save">Confirmar escolha</button></div>'
  );
}

export function focusConfigSheet(){
  var kd=S.draft.kind==='parcial'?'parcial':'total';
  var curCat=effCat();
  var curId=effTaskId(),curTask=curId?findTask(curId):null;
  var taskLabel=curTask?curTask.text:(S.draft.customLabel||'Foco livre');
  var cats=S.cats.map(function(c){
    return '<button class="chip" data-act="cat" data-v="'+esc(c)+'" aria-pressed="'+(c===curCat)+'">'+esc(c)+'</button>';
  }).join('')+'<button class="chip" data-act="cat-new">+ Nova</button>';

  openSheet('Ajustar sessão de foco',
    '<p class="flabel" style="margin-top:2px">Alvo da sessão</p>'+
    '<button class="wbs-task-pill" data-act="focus-pick-sheet" style="margin-top:6px">'+
      '<span class="wtp-ico">'+IC_TARGET+'</span>'+
      '<div class="wtp-txt"><span class="wtp-lbl">Tarefa vinculada</span><b class="wtp-name">'+esc(taskLabel)+'</b></div>'+
      '<span class="wtp-ch">Escolher &rsaquo;</span>'+
    '</button>'+
    '<p class="flabel" style="margin-top:14px">Regra de colheita</p>'+
    '<div class="seg" style="margin-top:6px">'+
      '<button data-act="kind-set" data-v="total" aria-pressed="'+(kd==='total')+'">Foco Total (+bônus)</button>'+
      '<button data-act="kind-set" data-v="parcial" aria-pressed="'+(kd==='parcial')+'">Foco Parcial</button>'+
    '</div>'+
    '<p class="small muted" id="kindNote" style="margin-top:6px">'+KIND_NOTE[kd]+'</p>'+
    '<p class="flabel" style="margin-top:14px">Categoria</p>'+
    '<div class="chips" style="margin-top:6px">'+cats+'</div>'+
    '<div class="stack" style="margin-top:18px">'+
      '<button class="btn quiet block" data-act="pomo-sheet">'+IC_CLOCK+' Configurar modo Pomodoro (ciclos)</button>'+
      '<button class="btn block" data-act="sheet-close">Pronto</button>'+
    '</div>'
  );
}

export function focusPodHTML(){
  var isPomoMode=(S.draft.mode==='pomo');
  var curId=effTaskId(),curTask=curId?findTask(curId):null;
  var taskLabel=curTask?curTask.text:(S.draft.customLabel||'Foco livre');
  var curCat=effCat();

  /* Botão claro de 1º nível: Bloco Único | Pomodoro */
  var modeSwitch='<div class="ofs-mode-switch" role="tablist" aria-label="Modo de foco">'+
    '<button class="oms-btn'+(!isPomoMode?' active':'')+'" data-act="draft-mode" data-v="unico" role="tab" aria-selected="'+(!isPomoMode)+'">Bloco Único</button>'+
    '<button class="oms-btn'+(isPomoMode?' active':'')+'" data-act="draft-mode" data-v="pomo" role="tab" aria-selected="'+isPomoMode+'">'+IC_CLOCK+' Pomodoro</button>'+
  '</div>';

  if(isPomoMode){
    var p=S.draft.pomo||{preset:'classic',focusMins:25,breakMins:5,longBreakMins:15,cycles:4,kind:'total'};
    var fM=p.focusMins||25,bM=p.breakMins||5,lM=p.longBreakMins||15,cy=p.cycles||4,pkd=p.kind==='parcial'?'parcial':'total';
    var totFocus=fM*cy;
    var totBreaks=bM*Math.max(0,cy-1)+(cy>=4?(lM-bM):0);
    var totMins=totFocus+totBreaks;
    var estPomoBeans=pkd==='parcial'?Math.floor(totFocus/2):totFocus;
    var pr=p.preset||'classic';

    /* Faixa Visual Proporcional de Ciclos (você enxerga o ritmo real antes de iniciar!) */
    var stripSegs='';
    for(var ci=1;ci<=cy;ci++){
      stripSegs+='<span class="pvs-seg focus" style="flex:'+fM+'" title="Ciclo '+ci+': '+fM+'m de foco"><b>'+fM+'m</b></span>';
      if(ci<cy){
        var isLng=(ci%4===0&&lM>0);
        var brDur=isLng?lM:bM;
        stripSegs+='<span class="pvs-seg rest'+(isLng?' long':'')+'" style="flex:'+Math.max(4,Math.round(brDur*0.85))+'" title="Pausa: '+brDur+'m"></span>';
      }
    }

    return '<section class="open-focus-stage is-pomo-stage">'+
      modeSwitch+
      '<button class="ofs-context-pill" data-act="focus-config-sheet">'+
        '<span class="ocp-dot"></span>'+
        '<span class="ocp-txt">'+esc(curCat)+' · <b>'+esc(taskLabel)+'</b> · '+(pkd==='total'?'Total (+bônus)':'Parcial')+'</span>'+
        '<span class="ocp-chev">&#8964;</span>'+
      '</button>'+

      '<div class="ofs-clock-wrap pomo-compact">'+
        '<div class="ofs-big-time">'+fM+'<span class="ofs-slash">/</span>'+bM+'</div>'+
        '<div class="ofs-whisper">'+
          '<span>'+fmtDur(totFocus)+' foco &middot; '+finishAtLabel(totMins)+'</span>'+
          '<span class="ofs-sep">&middot;</span>'+
          '<span>+'+estPomoBeans+'g'+(pkd==='total'?' + bônus':'')+'</span>'+
        '</div>'+
      '</div>'+

      /* Timeline Visual Interativa dos Ciclos */
      '<div class="pomo-visual-strip" aria-label="Linha do tempo visual dos ciclos">'+stripSegs+'</div>'+

      /* 3 Controles Táteis DIRETOS no palco — personalizar pausas e ciclos sempre aparente! */
      '<div class="pomo-live-dials" role="group" aria-label="Personalizar foco, pausa e ciclos">'+
        '<div class="pld-pod">'+
          '<span class="pld-lbl">Foco</span>'+
          '<div class="pld-ctrl">'+
            '<button class="pld-step" data-act="pomo-step" data-f="focusMins" data-d="-5" aria-label="Diminuir foco">&minus;</button>'+
            '<b>'+fM+'m</b>'+
            '<button class="pld-step" data-act="pomo-step" data-f="focusMins" data-d="5" aria-label="Aumentar foco">+</button>'+
          '</div>'+
        '</div>'+
        '<div class="pld-pod">'+
          '<span class="pld-lbl">Pausa</span>'+
          '<div class="pld-ctrl">'+
            '<button class="pld-step" data-act="pomo-step" data-f="breakMins" data-d="-1" aria-label="Diminuir pausa">&minus;</button>'+
            '<b>'+bM+'m</b>'+
            '<button class="pld-step" data-act="pomo-step" data-f="breakMins" data-d="1" aria-label="Aumentar pausa">+</button>'+
          '</div>'+
        '</div>'+
        '<div class="pld-pod">'+
          '<span class="pld-lbl">Ciclos</span>'+
          '<div class="pld-ctrl">'+
            '<button class="pld-step" data-act="pomo-step" data-f="cycles" data-d="-1" aria-label="Menos ciclos">&minus;</button>'+
            '<b>'+cy+'&times;</b>'+
            '<button class="pld-step" data-act="pomo-step" data-f="cycles" data-d="1" aria-label="Mais ciclos">+</button>'+
          '</div>'+
        '</div>'+
      '</div>'+

      /* 3 receitas rápidas + atalho de pausa longa / regra */
      '<div class="ofs-pomo-presets" role="group" aria-label="Ritmos prontos de Pomodoro">'+
        '<button class="opp-chip'+(pr==='espresso'?' active':'')+'" data-act="pomo-quick" data-v="espresso"><b>Espresso</b><span>20/4m</span></button>'+
        '<button class="opp-chip'+(pr==='classic'?' active':'')+'" data-act="pomo-quick" data-v="classic"><b>Coado</b><span>25/5m</span></button>'+
        '<button class="opp-chip'+(pr==='chemex'?' active':'')+'" data-act="pomo-quick" data-v="chemex"><b>Chemex</b><span>50/10m</span></button>'+
      '</div>'+

      '<div class="ofs-cta-zone">'+
        '<button class="ofs-start-btn" data-act="start-pomo-session">'+
          IC_PLAY+' <span>Iniciar Pomodoro · <b>'+cy+'&times;'+fM+'m</b></span>'+
        '</button>'+
        '<button class="ofs-pomo-link" data-act="pomo-sheet">Pausa longa ('+lM+'m) e regra Total/Parcial &rsaquo;</button>'+
      '</div>'+
    '</section>';
  }

  var m=S.draft.mins||25;
  var clampedM=Math.max(5,Math.min(120,Math.round(m)));
  var idx=Math.round((clampedM-5)/5);
  var kd=S.draft.kind==='parcial'?'parcial':'total';
  var meth0=methodForMins(clampedM);
  var estBeans=kd==='parcial'?Math.max(1,Math.floor(clampedM/2)):clampedM;
  var yieldTxt='+'+estBeans+'g'+(kd==='total'?' + bônus':'');

  var rulerTicks='';
  for(var ti=0;ti<24;ti++){
    var tm=5+ti*5;
    var isMajor=(tm===5||tm%15===0);
    var isAct=(ti===idx);
    rulerTicks+='<span class="br-tick'+(isMajor?' major':'')+(isAct?' is-active':'')+'" data-m="'+tm+'">'+
      '<i class="br-bar"></i>'+
      (isMajor?'<b>'+tm+'</b>':'')+
    '</span>';
  }

  return '<section class="open-focus-stage" style="--brew-glow:'+meth0.glow+'">'+
    modeSwitch+
    '<button class="ofs-context-pill" data-act="focus-config-sheet">'+
      '<span class="ocp-dot"></span>'+
      '<span class="ocp-txt">'+esc(curCat)+' · <b>'+esc(taskLabel)+'</b> · '+(kd==='total'?'Total':'Parcial')+'</span>'+
      '<span class="ocp-chev">&#8964;</span>'+
    '</button>'+

    '<div class="ofs-clock-wrap has-aura">'+
      '<div class="ofs-big-time" id="durVal">'+(m<1?'00:10':String(clampedM).padStart(2,'0')+':00')+'</div>'+
      '<div class="ofs-whisper">'+
        '<span id="brewFinishAt">'+finishAtLabel(clampedM)+'</span>'+
        '<span class="ofs-sep">&middot;</span>'+
        '<span id="brewYieldVal">'+yieldTxt+'</span>'+
      '</div>'+
    '</div>'+

    '<div id="brewRuler" class="brew-scrub-ruler" role="slider" aria-label="Deslize para ajustar minutos de foco" aria-valuemin="5" aria-valuemax="120" aria-valuenow="'+clampedM+'">'+
      '<div class="bsr-needle" aria-hidden="true"></div>'+
      '<div class="bsr-fade-l" aria-hidden="true"></div>'+
      '<div class="bsr-fade-r" aria-hidden="true"></div>'+
      '<div id="brewRulerTrack" class="bsr-track" style="transform:translate3d('+(-idx*20)+'px,0,0)">'+rulerTicks+'</div>'+
    '</div>'+
    '<div class="ofs-ruler-hint">Deslize a régua para ajustar os minutos</div>'+

    '<div class="ofs-cta-zone">'+
      '<button class="ofs-start-btn" data-act="start-focus">'+
        IC_PLAY+' <span>Iniciar Foco · <b id="brewStartDur">'+fmtDur(clampedM)+'</b></span>'+
      '</button>'+
      (S.testMode?'<button class="ofs-pomo-link" data-act="dur-test">modo teste 10s</button>':'')+
    '</div>'+
  '</section>';
}

export function focusBuilderHTML(inHome){
  return focusPodHTML();
}

export function studioAmbienceBarHTML(){
  var amb=UI.studioBg||'crema';
  if(['crema','ambar','noturno'].indexOf(amb)<0)amb='crema';
  return '<div class="studio-amb-switcher" role="group" aria-label="Clima da câmara de extração">'+
    '<button class="sas-pill'+(amb==='crema'?' active':'')+'" data-act="studio-bg" data-v="crema">Crema</button>'+
    '<button class="sas-pill'+(amb==='ambar'?' active':'')+'" data-act="studio-bg" data-v="ambar">Âmbar</button>'+
    '<button class="sas-pill'+(amb==='noturno'?' active':'')+'" data-act="studio-bg" data-v="noturno">Noturno</button>'+
  '</div>';
}

export function activeFocusHTML(){
  var f=S.focus;
  var amb=UI.studioBg||'crema';
  if(['crema','ambar','noturno'].indexOf(amb)<0)amb='crema';
  if(f.mode==='focus'){
    var paused=!!f.pausedAt,rem=paused?f.endTime-f.pausedAt:f.endTime-Date.now();
    var elapsedMs=Math.max(0,(f.total*1000)-rem);
    var pct=Math.max(0,Math.min(1,elapsedMs/(f.total*1000)));
    var rRing=96,cRing=2*Math.PI*rRing;
    var offRing=cRing*(1-pct);
    var rad=(pct*360-90)*(Math.PI/180);
    var dotX=(114+rRing*Math.cos(rad)).toFixed(1);
    var dotY=(114+rRing*Math.sin(rad)).toFixed(1);

    var minsTot=Math.max(1,Math.round(f.total/60));
    var meth=methodForMins(minsTot);
    var expBeans=f.kind==='parcial'?Math.max(1,Math.floor(minsTot/2)):minsTot;
    var liveBeans=Math.min(expBeans,Math.floor(expBeans*pct));
    var finDate=new Date(Date.now()+Math.max(0,rem));
    var finStr='Termina às '+String(finDate.getHours()).padStart(2,'0')+':'+String(finDate.getMinutes()).padStart(2,'0');
    var stage=pct<0.20?1:pct<0.85?2:3;
    var stageTxt=stage===1?'Pré-infusão · Bloom':stage===2?'Extração em fluxo':'Finalizando crema';

    var gu=UI.giveUp
      ?'<button class="oura-ghost-btn danger" data-act="stop-focus">Confirmar: interromper e zerar colheita</button>'
      :'<button class="oura-ghost-btn" data-act="give-up">Encerrar mais cedo</button>';

    var mainTransport=paused
      ?'<button class="waking-transport-btn" data-act="resume" aria-label="Retomar foco">'+IC_PLAY+'</button>'
      :'<button class="waking-transport-btn" data-act="pause" aria-label="Pausar foco"><svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.5" height="14" rx="1.5"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/></svg></button>';

    var secondaryExit=f.isPomo
      ?'<button class="oura-ghost-btn" data-act="pomo-finish-early">Encerrar Pomodoro</button>'
      :(f.kind==='parcial'?'<button class="oura-ghost-btn" data-act="end-partial">Encerrar e guardar 50%</button>':gu);

    var sim=(S.testMode&&!paused&&f.kind!=='parcial')?'<div class="row" style="justify-content:center;margin-top:8px"><button class="btn quiet small" data-act="sim-away" data-v="10">Simular 10s fora</button></div>':'';

    return '<div class="focus-immersive focus-living-v3 focus-vessel-mode bg-'+amb+'">'+
      '<canvas id="brewVesselCanvas" class="brew-vessel-canvas" aria-hidden="true"></canvas>'+
      '<div class="fsv2-top">'+
        '<span class="oura-session-eyebrow">'+(f.isPomo?'Pomodoro · Ciclo '+f.pomo.cycle+' de '+f.pomo.totalCycles:esc(f.cat||'Foco livre')+' · '+(f.kind==='parcial'?'Parcial':'Foco Total'))+'</span>'+
        studioAmbienceBarHTML()+
      '</div>'+
      (f.isPomo?pomoDots(f):'')+
      '<h2 class="focus-title-v3">'+esc(f.label)+'</h2>'+
      '<div class="vessel-live-strip">'+
        '<span class="vls-stage" id="focusStageTxt">'+stageTxt+'</span>'+
        '<span class="vls-beans" id="liveBeansEarned">+'+liveBeans+'g / '+expBeans+'g'+(f.kind==='total'?' + bônus':'')+'</span>'+
      '</div>'+
      (paused?'<div class="oura-pause-pill">'+(f.kind==='parcial'?'Em pausa — líquido estagnado':'Pausa de emergência ativa (máx. 10 min)')+'</div>':'')+

      '<div class="waking-live-ring">'+
        '<svg viewBox="0 0 228 228" class="wlr-svg" aria-hidden="true">'+
          '<circle cx="114" cy="114" r="'+rRing+'" class="wlr-track"/>'+
          '<circle cx="114" cy="114" r="'+rRing+'" id="focusRingArc" class="wlr-arc" stroke-dasharray="'+cRing.toFixed(1)+'" stroke-dashoffset="'+offRing.toFixed(1)+'"/>'+
        '</svg>'+
        '<div id="focusRingDot" class="wlr-dot" style="transform:translate('+dotX+'px, '+dotY+'px)" aria-hidden="true"></div>'+
        '<div class="wlr-core">'+
          '<div class="bigtime" id="focusTime">'+mmss(rem)+'</div>'+
          '<span class="wlr-elapsed" id="focusElapsed">- '+mmss(elapsedMs)+'</span>'+
        '</div>'+
      '</div>'+

      mainTransport+

      '<div class="waking-finish-bar" id="focusFinishBar">'+finStr+' &middot; '+esc(meth.name)+'</div>'+
      '<div class="opal-ticks-wrap"><div class="bar-track opal-seg-bar"><div class="bar-fill" id="focusBar" style="width:'+Math.round(pct*100)+'%"></div></div></div>'+

      (paused?'':ambienceHTML())+

      '<div class="fsv2-actions">'+
        '<div class="oura-btn-stack">'+
          '<button class="oura-ghost-btn urge-soft" data-act="to-urge">Bateu a vontade (Pausa)</button>'+
          secondaryExit+
        '</div>'+
        sim+
      '</div>'+
    '</div>';
  }
  if(f.mode==='break'){
    if(f.isPomo&&f.pomo){
      return '<div class="focus-immersive focus-opal-v2">'+
        '<div class="pomo-badge break">'+IC_REST+' '+(f.pomo.phase==='longBreak'?'Pausa Longa':'Pausa do Café')+' · Ciclo '+f.pomo.cycle+' de '+f.pomo.totalCycles+'</div>'+
        pomoDots(f)+
        '<h2 style="margin-top:6px">Momento do Café</h2>'+
        '<div class="timespent-timer-frame">'+
          '<span class="ttf-eyebrow">PAUSA LIBERADA</span>'+
          '<div class="bigtime" id="focusTime">'+mmss(f.endTime-Date.now())+'</div>'+
          '<div class="bar-track opal-seg-bar"><div class="bar-fill" id="focusBar"></div></div>'+
        '</div>'+
        '<div class="nudge" style="margin:16px 0;text-align:center;font-size:14px">'+IC_BEAN+'<b>+'+(f.pomo.beansEarned||0)+' grãos</b> colhidos até agora</div>'+
        '<p class="lead" style="max-width:340px;margin:10px auto">Hora de alongar, tomar uma água fresca ou saborear um café. Celular liberado até o fim da pausa.</p>'+
        '<div class="stack" style="margin-top:22px"><button class="btn sun block" data-act="pomo-start-next">Pular pausa e começar Ciclo '+(f.pomo.cycle+1)+'</button><button class="opal-leave-btn" data-act="pomo-finish-early">Encerrar Pomodoro por aqui</button></div>'+
      '</div>';
    }
    return '<div class="sanctuary-state-stage">'+
      '<div class="sanctuary-glass-card">'+
        '<span class="ssg-badge">PAUSA LIBERADA</span>'+
        '<h2>Momento de respiro</h2>'+
        '<div class="bigtime" id="focusTime" style="margin:12px 0">'+mmss(f.endTime-Date.now())+'</div>'+
        '<div class="bar-track opal-seg-bar"><div class="bar-fill" id="focusBar"></div></div>'+
        '<p class="ssg-copy">Celular liberado até o fim do tempo. Quando acabar, ele volta para o bolso.</p>'+
        '<div class="stack" style="margin-top:18px"><button class="ofs-start-btn" style="max-width:100%" data-act="skip-break">Encerrar pausa</button></div>'+
      '</div>'+
    '</div>';
  }
  if(f.mode==='pomo-ready'){
    return '<div class="focus-immersive focus-opal-v2">'+
      '<div class="pomo-badge break">'+IC_REST+' Pausa Finalizada</div>'+
      pomoDots(f)+
      '<h2>Pronto para o Ciclo '+(f.pomo.cycle+1)+' de '+f.pomo.totalCycles+'?</h2>'+
      '<div class="nudge" style="margin:16px 0;text-align:center;font-size:15px">'+IC_BEAN+'<b>+'+(f.pomo.beansEarned||0)+' grãos</b> guardados na Cafeteria</div>'+
      '<p class="lead" style="max-width:340px;margin:10px auto">A pausa terminou. Respire fundo, deixe as distrações de lado e prepare o próximo bloco de '+f.pomo.focusMins+' min.</p>'+
      '<div class="stack" style="margin-top:24px"><button class="btn sun block" data-act="pomo-start-next" style="font-size:16px;padding:14px 18px">'+IC_CLOCK+' Iniciar Ciclo '+(f.pomo.cycle+1)+' ('+f.pomo.focusMins+' min)</button><button class="opal-leave-btn" data-act="pomo-finish-early">Encerrar Pomodoro e guardar grãos</button></div>'+
    '</div>';
  }
  if(f.mode==='done'){
    var minsDone=f.isPomo&&f.pomo?((f.pomo.completedCycles||f.pomo.totalCycles)*f.pomo.focusMins):Math.max(1,f.mins||Math.round(f.total/60));
    var earnedCount=f.isPomo&&f.pomo?(f.pomo.beansEarned||0):(f.beansEarned!==undefined?f.beansEarned:minsDone);
    var bonusCount=f.isPomo?0:(f.bonusBeans||0);
    var meth=methodForMins(minsDone);
    var cafeBeans=(S.cafe&&S.cafe.beans)||0;
    var cafeLv=calcLevelInfo((S.cafe&&S.cafe.focusMins)||0);
    var pixelsSaved=(minsDone*60000).toLocaleString('pt-BR');
    var task=f.taskId?findTask(f.taskId):null;
    var dtNow=new Date();
    var dateStamp=dtNow.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).toUpperCase();

    var cafeProgressHTML='<div class="bt-goal-box">'+
      '<div class="bt-cafe-ico">'+IC_CAFE+'</div>'+
      '<div class="bt-goal-txt">'+
        '<b>Cafeteria · Nível '+cafeLv.lv+' ('+cafeLv.xpLabel+') · Saldo '+cafeBeans+'g</b>'+
        '<div class="bt-goal-track"><span style="width:'+cafeLv.pct+'%"></span></div>'+
      '</div>'+
    '</div>';

    var actionsHTML='';
    if(f.isPomo&&f.pomo){
      actionsHTML='<button class="ofs-start-btn" data-act="tab" data-tab="colecao">'+IC_CAFE+' Entrar na Cafeteria ('+cafeBeans+'g)</button>'+
        '<button class="oura-ghost-btn" data-act="skip-break">Voltar ao Hoje</button>';
    }else if(f.starter){
      actionsHTML='<button class="ofs-start-btn" data-act="more-block">Continuar por mais 25 min</button>'+
        (task&&!task.done?'<button class="oura-ghost-btn" data-act="done-task">Marcar tarefa como feita</button>':'')+
        '<button class="oura-ghost-btn" data-act="skip-break">Voltar ao Hoje</button>';
    }else{
      actionsHTML='<button class="ofs-start-btn" data-act="start-break">Pausa de 5 min (celular livre)</button>'+
        (task&&!task.done?'<button class="oura-ghost-btn" data-act="done-task">Marcar &ldquo;'+esc(task.text)+'&rdquo; como feita</button>':'')+
        '<button class="oura-ghost-btn" data-act="tab" data-tab="colecao">'+IC_CAFE+' Entrar na Cafeteria ('+cafeBeans+'g)</button>'+
        '<button class="ofs-pomo-link" data-act="skip-break">Voltar ao Hoje</button>';
    }

    return '<div class="brew-ticket-stage">'+
      '<div class="brew-ticket-card">'+
        '<div class="bt-head">'+
          '<span class="bt-badge">'+(f.isPomo?'POMODORO COMPLETO':f.kind==='parcial'?'FOCO PARCIAL':'EXTRAÇÃO COMPLETA')+'</span>'+
          '<span class="bt-date">'+dateStamp+'</span>'+
        '</div>'+
        /* Rota física estilo FocusFlight (FocusFlight_iOS_5.png) */
        '<div class="bt-route">'+
          '<div><b class="bt-code">GRÃO</b><span>Início</span></div>'+
          '<div class="bt-mid"><span class="bt-line"></span><b>'+fmtDur(minsDone)+'</b><span class="bt-line"></span></div>'+
          '<div style="text-align:right"><b class="bt-code">XÍCARA</b><span>'+esc(meth.name)+'</span></div>'+
        '</div>'+
        '<div class="bt-hero-row">'+
          '<div class="bt-harvest">'+
            '<span class="bt-h-lbl">COLHEITA REGISTRADA</span>'+
            '<b class="bt-h-num">+'+earnedCount+'<small>g</small></b>'+
            (bonusCount?'<span class="bt-bonus-pill">'+IC_SPARK+' Inclui +'+bonusCount+'g bônus microlote</span>':'<span class="bt-h-sub">'+esc(f.label||'Sessão consciente')+'</span>')+
          '</div>'+
        '</div>'+
        /* Insight concreto estilo Opal (Opal_iOS_91.png) */
        '<div class="bt-opal-insight">'+
          '<span>VOCÊ SABIA?</span>'+
          '<p>Em '+minsDone+' min de foco, você evitou cerca de <b>'+pixelsSaved+' pixels</b> de rolagem infinita.</p>'+
        '</div>'+
        cafeProgressHTML+
        '<div class="bt-tear" aria-hidden="true"><span></span></div>'+
        '<div class="bt-barcode" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
      '</div>'+
      '<div class="bt-actions">'+actionsHTML+'</div>'+
    '</div>';
  }
  if(f.mode==='failed'){
    return '<div class="sanctuary-state-stage">'+
      '<div class="sanctuary-glass-card">'+
        '<span class="ssg-badge warn">BLOCO INTERROMPIDO</span>'+
        '<h2>Tudo bem recomeçar.</h2>'+
        '<p class="ssg-copy">'+esc(f.msg)+' Nenhum grão guardado foi perdido — apenas esta extração não foi colhida. Respire um pouco e tente no seu ritmo.</p>'+
        '<div class="stack" style="margin-top:20px">'+
          '<button class="ofs-start-btn" style="max-width:100%" data-act="skip-break">Tentar novamente</button>'+
          '<button class="oura-ghost-btn" data-act="tab" data-tab="colecao">Entrar na Cafeteria</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  return '<div class="sanctuary-state-stage">'+
    '<div class="sanctuary-glass-card">'+
      '<span class="ssg-badge">PAUSA CONCLUÍDA</span>'+
      '<h2>A pausa acabou.</h2>'+
      '<p class="ssg-copy">Combinado é combinado. Hora de voltar com leveza para o próximo bloco.</p>'+
      '<div class="stack" style="margin-top:20px"><button class="ofs-start-btn" style="max-width:100%" data-act="skip-break">Voltar ao Hoje</button></div>'+
    '</div>'+
  '</div>';
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
