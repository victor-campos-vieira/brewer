import { $, mmss, uid, today, addDays, toMin, nowMin, fmtShort, mondayOf } from './utils.js';
import { S, UI, SH, resetState, save, L, cmp, findTask, normTask, setDone, planned, setPlan, archiveFocus, currentGoal, updateTheme, screenStatusHTML, CUP_ASSETS, cupMeta, addCup, cupFallback, heroFallbackHTML, holdScreen, releaseLock, setAmbience, alertUser, playZenSound, toast, openSheet, closeSheet } from './state.js';
import { gcCfg, gcResetToken, gcRun, gcDiag, gcDisconnect, gcToggleCal, gcReloadCals, mdSync, mdFile, confirmInbox, ignoreInbox } from './sync.js';
import { renderHoje, prioSheet, moodSheet } from './views/hoje.js';
import { suggestionsFor, placeSuggestion, plannerSheet, blockSheet, PRESETS, dayChips, routineSheet, renderAgenda } from './views/agenda.js';
import { prioChips, applyPhrase, startVoice, readForm, taskSheet, inboxSheet, renderTarefas } from './views/tarefas.js';
import { AWAY_ASK_MS, breakFocus, completeFocus, endPartial, checkReturn, answerReturn, pauseFocus, resumeFocus, effCat, effTaskId, openRitual, beginFocus, startFocus, updateDur, setKindUI, renderFoco, startPomodoro, startNextPomoCycle, finishPomodoroEarly, pomodoroSheetHTML, updatePomoSummary, focusTaskSheet, focusConfigSheet } from './views/foco.js';
import { WX, WY, startGate, selectFeel, start10m, gateStay, gateOpenApp, gateConfig, gateBtnText, startWait, logUrge, finishWait, renderVontade } from './views/vontade.js';
import { renderRevisao, settingsSheet } from './views/revisao.js';
import { renderColecao } from './views/colecao.js';
import { requestNotifyPermission, notifyBreakDone, subscribeWebPush, unsubscribeWebPush, sendTestPush } from './notifications.js';
import { recordMorningActivity, scheduleSmartSync } from './smart-push.js';
import { primeFocusAudio, updateMediaSession, startFocusMedia, stopFocusMedia } from './media.js';
import { renderJornada, simSession, testAdd, testRem, testSkip, testJump, testClear } from './views/jornada.js';
import { bindBrewDial, bindSwipeTriageDeck, triggerCheckRipple, initLivingAtmosphere, initPausaFluidCanvas, initFocusVesselCanvas, updateFocusVesselState, bindHoldToBrew, MOOD_META, MOOD_ORDER, resolveCafeMood, playTactileTick, playSoftChime } from './interactions.js';

/* ---------- navegação ---------- */
export var TABS=['hoje','agenda','tarefas','foco','vontade','revisao','colecao','jornada'];

export function checkGateParam(){
  try{
    var pending=localStorage.getItem('brewer_gate_pending');
    if(pending){
      localStorage.removeItem('brewer_gate_pending');
      startGate(pending);
      S.tab='vontade';
      save();
      return true;
    }
    var sp=new URLSearchParams(window.location.search||'');
    var directTab=sp.get('tab');
    if(directTab&&TABS.indexOf(directTab)>-1){
      S.tab=directTab;
      if(directTab!=='vontade')S.wait=null;
      save();
      return true;
    }
    var hash=window.location.hash||'';
    var g=null;
    for(var pair of sp.entries()){
      var k=pair[0].toLowerCase();
      if(k==='gate'||k==='app'||k==='vontade'||k==='bloqueio'){g=pair[1];break}
    }
    if(!g&&hash){
      var h=hash.replace(/^#/,'');
      if(h.toLowerCase().indexOf('gate=')>-1)g=h.split(/gate=/i)[1];
      else if(h.toLowerCase().indexOf('app=')>-1)g=h.split(/app=/i)[1];
      else if(h.toLowerCase()==='gate'||h.toLowerCase()==='vontade')g='Instagram';
      else if(['instagram','twitter','x','youtube','tiktok','reddit','linkedin'].indexOf(h.toLowerCase())>-1)g=h;
    }
    if(g){
      if(g==='1'||g.toLowerCase()==='true')g='Instagram';
      if(g.toLowerCase()==='x')g='Twitter';
      var formatted=g.charAt(0).toUpperCase()+g.slice(1).toLowerCase();
      startGate(formatted);
      S.tab='vontade';
      save();
      return true;
    }
  }catch(e){}
  return false;
}
export function go(tab){
  var f=S.focus;
  if(f&&(f.mode==='failed'||(f.mode==='done'&&tab!=='foco')))archiveFocus();
  if(tab==='vontade'&&(!S.wait||S.wait.phase==='result'||(S.wait.phase==='gate'&&Date.now()>=S.wait.end)))startGate('Instagram');
  else if(tab!=='vontade'&&S.wait&&S.wait.phase==='gate')S.wait=null;
  S.tab=tab;save();render();
  var sc=document.getElementById('scroll');if(sc)sc.scrollTop=0;
  window.scrollTo(0,0);
}
export function render(){
  document.documentElement.classList.remove('gate-lock');
  if(TABS.indexOf(S.tab)<0)S.tab='hoje';
  document.body.dataset.tab=S.tab;
  TABS.forEach(function(t){$('#tab-'+t).hidden=(t!==S.tab)});
  document.body.classList.toggle('tab-vontade', S.tab === 'vontade');
  document.body.classList.toggle('tab-colecao-active', S.tab === 'colecao');
  document.body.classList.toggle('focus-running', S.tab === 'foco' && !!(UI.pre || (S.focus && (S.focus.mode === 'focus' || S.focus.mode === 'break' || S.focus.mode === 'pomo-ready'))));
  document.querySelectorAll('.bar button').forEach(function(b){b.setAttribute('aria-current',b.dataset.tab===(['colecao','jornada','foco'].indexOf(S.tab)>-1?'hoje':S.tab)?'page':'false')});
  updateTheme();
  var moodKey=resolveCafeMood(S.cafeMood);
  document.body.dataset.mood=moodKey;
  var moodIsDark=!!(MOOD_META[moodKey]&&MOOD_META[moodKey].dark);
  document.body.classList.toggle('v2-dark',moodIsDark);
  initLivingAtmosphere();
  ({hoje:renderHoje,agenda:renderAgenda,tarefas:renderTarefas,foco:renderFoco,vontade:renderVontade,revisao:renderRevisao,colecao:renderColecao,jornada:renderJornada})[S.tab]();
  renderRun();
  updateLive();
  initPausaFluidCanvas(function(){
    var s0=S.wait;
    if(!s0||s0.phase!=='gate')return {elapsedMs:0,pct:0};
    var now0=Date.now(),rem0=Math.max(0,s0.end-now0);
    var elap0=Math.max(0,now0-(s0.start||(s0.end-s0.total*1000)));
    return {elapsedMs:elap0,pct:Math.max(0,Math.min(1,1-rem0/(s0.total*1000)))};
  });
  initFocusVesselCanvas(function(){
    var f0=S.focus;
    var th=UI.studioBg||'crema';
    if(['crema','ambar','noturno'].indexOf(th)<0)th='crema';
    if(UI.pre&&!f0)return {isPre:true,pct:0,paused:false,theme:th};
    if(!f0||f0.mode!=='focus')return {isPre:false,pct:0.25,paused:false,theme:th};
    var now0=Date.now(),rem0=f0.pausedAt?f0.endTime-f0.pausedAt:f0.endTime-now0;
    var elap0=Math.max(0,(f0.total*1000)-rem0);
    return {isPre:false,pct:Math.max(0,Math.min(1,elap0/(f0.total*1000))),paused:!!f0.pausedAt,theme:th};
  });
  bindHoldToBrew(function(){
    primeFocusAudio(UI.amb);
    clearTimeout(UI.preTimer);
    beginFocus();
  });
  bindBrewDial(
    function(){return {mins:S.draft.mins,kind:S.draft.kind}},
    function(newMins){S.draft.mins=newMins;save()}
  );
  bindSwipeTriageDeck({
    onConfirm:function(ibId){var ic=S.inbox.find(function(x){return x.id===ibId});if(ic){confirmInbox(ic);save();render();toast('Confirmada em Pendentes.')}},
    onIgnore:function(ibId){var ii=S.inbox.find(function(x){return x.id===ibId});if(ii){ignoreInbox(ii);save();render();toast('Ignorada.')}},
    onToday:function(ibId){
      var it=S.inbox.find(function(x){return x.id===ibId});
      if(!it)return;
      var before=S.tasks.length;
      confirmInbox(it);
      var added=S.tasks.length>before?S.tasks[S.tasks.length-1]:null;
      if(added&&planned(today()).length<3){setPlan(added,true);toast('Confirmada e colocada nas 3 de Hoje!')}
      else toast('Confirmada em Pendentes (3 de Hoje já completas).');
      save();render();
    }
  });
}
export function renderRun(){
  var f=S.focus,el=$('#runpill');
  if(f&&f.mode==='focus'&&S.tab!=='foco'&&S.tab!=='vontade'){
    el.innerHTML='<button data-act="tab" data-tab="foco">Foco em andamento: <b id="runTime">'+mmss(f.endTime-Date.now())+'</b></button>';
  }else el.innerHTML='';
}

/* ---------- fallback de imagens ---------- */
document.addEventListener('error',function(e){
  var i=e.target;if(!i||i.tagName!=='IMG')return;
  var d=document.createElement('div');
  if(i.dataset.model!==undefined){
    d.className=i.className+' cup-fb';if(i.dataset.act){d.dataset.act=i.dataset.act;d.dataset.id=i.dataset.id}
    d.setAttribute('role','img');d.setAttribute('aria-label',i.alt);d.innerHTML=cupFallback(cupMeta(+i.dataset.model).color,i.dataset.ok==='0');i.replaceWith(d);
  }else if(i.classList.contains('hero-img')){
    d.className='hero-fb';d.innerHTML=heroFallbackHTML();i.replaceWith(d);
  }
},true);

/* ---------- ao vivo ---------- */
var lastTick=Date.now();
export function updateLive(){
  var now=Date.now(),f=S.focus,s=S.wait,title='Brewer';
  var navLocked=!!((S.tab==='vontade'&&s&&s.phase==='gate'&&now<s.end)||(S.tab==='foco'&&(UI.pre||(f&&f.mode==='focus'))));
  document.body.classList[navLocked?'add':'remove']('gate-lock');
  document.body.classList.toggle('focus-running', S.tab === 'foco' && !!(UI.pre || (f && (f.mode === 'focus' || f.mode === 'break' || f.mode === 'pomo-ready'))));
  if(f&&(f.mode==='focus'||f.mode==='break')){
    var rem=f.pausedAt?f.endTime-f.pausedAt:f.endTime-now;
    var elap=Math.max(0,(f.total*1000)-rem);
    var pctF=Math.max(0,Math.min(1,elap/(f.total*1000)));
    var ft=$('#focusTime');if(ft)ft.textContent=mmss(rem);
    var fe=$('#focusElapsed');if(fe)fe.textContent='- '+mmss(elap);
    var b=$('#focusBar');if(b)b.style.width=(pctF*100)+'%';
    var ra=$('#focusRingArc');
    if(ra){var cR=2*Math.PI*96;ra.setAttribute('stroke-dashoffset',(cR*(1-pctF)).toFixed(1))}
    var rd=$('#focusRingDot');
    if(rd){var ang=(pctF*360-90)*(Math.PI/180);rd.style.transform='translate('+(114+96*Math.cos(ang)).toFixed(1)+'px,'+(114+96*Math.sin(ang)).toFixed(1)+'px)'}
    var lb=$('#liveBeansEarned');
    if(lb&&f.mode==='focus'){
      var mTot=Math.max(1,Math.round(f.total/60));
      var expB=f.kind==='parcial'?Math.max(1,Math.floor(mTot/2)):mTot;
      var curB=Math.min(expB,Math.floor(expB*pctF));
      lb.textContent='+'+curB+'g / '+expB+'g'+(f.kind==='total'?' + bônus':'');
    }
    var fst=$('#focusStageTxt');
    if(fst&&f.mode==='focus'){
      fst.textContent=pctF<0.20?'Pré-infusão · Bloom':pctF<0.85?'Extração em fluxo':'Finalizando crema';
    }
    updateFocusVesselState({pct:pctF,paused:!!f.pausedAt,isPre:false});
    var rt=$('#runTime');if(rt)rt.textContent=mmss(rem);
    title=(f.pausedAt?'Pausa · ':'')+mmss(rem)+' · Brewer';
    updateMediaSession(f);
  }
  if(s&&s.phase==='gate'){
    var grem=Math.max(0,s.end-now);
    var gpct=Math.max(0,Math.min(1,1-grem/(s.total*1000)));
    var wt=$('#waitTime');if(wt)wt.textContent=mmss(grem);
    var gb=$('#gateBar');if(gb)gb.style.width=(gpct*100)+'%';
    var gra=$('#gateRingArc');if(gra){var cG=Math.round(2*Math.PI*86);gra.setAttribute('stroke-dashoffset',String(Math.round(cG*(1-gpct))))}
    var gbl=$('#breathLabel');if(gbl){var ge=Math.max(0,now-(s.start||(s.end-s.total*1000)))%10000;gbl.textContent=ge<4000?'Inspira':'Solta'}
    var gob=$('#gateOpenBtn');
    if(gob){
      gob.textContent=gateBtnText(s,grem);
      gob.disabled=!(grem<=0&&!!s.feel);
    }
  }else if(s&&s.phase==='wait'){
    var st=$('#waitTime');if(st)st.textContent=mmss(s.end-now);
    var p=Math.max(0,Math.min(1,1-(s.end-now)/(s.total*1000)));
    var t0=s.ext?.55:0,t=t0+p*(1-t0);
    var c=$('#curveClip');if(c)c.setAttribute('width',WX(t).toFixed(1));
    var d=$('#curveDot');if(d){d.setAttribute('cx',WX(t).toFixed(1));d.setAttribute('cy',WY(t).toFixed(1))}
    var bl=$('#breathLabel');if(bl){var e=(now-(s.end-s.total*1000))%10000;bl.textContent=e<4000?'Inspira':'Solta'}
  }
  document.title=title;
}
if(!window.__brewerAppInit){
window.__brewerAppInit=true;
setInterval(function(){
  var now=Date.now(),ch=false,f=S.focus,gap=now-lastTick;lastTick=now;
  if(f&&f.mode==='focus'&&f.kind!=='parcial'&&!f.pausedAt&&!f.hiddenAt&&gap>AWAY_ASK_MS&&!document.hidden){f.hiddenAt=now-gap;save()}
  if(f&&f.mode==='focus'&&f.hiddenAt&&!document.hidden)checkReturn();
  if(f&&f.mode==='focus'&&!f.pausedAt&&!f.hiddenAt&&!UI.asking&&now>=f.endTime){completeFocus();return}
  if(f&&f.mode==='break'&&now>=f.endTime){
    if(f.isPomo){
      f.mode='pomo-ready';
      ch=true;
      alertUser();
      playZenSound();
      notifyBreakDone();
    } else {
      f.mode='breakdone';
      ch=true;
      alertUser();
      notifyBreakDone();
    }
  }
  if(S.wait&&S.wait.phase==='gate'&&!S.wait.notified&&now>=S.wait.end){S.wait.notified=true;ch=true}
  if(S.wait&&S.wait.phase==='wait'&&now>=S.wait.end){S.wait.phase='end';ch=true;alertUser();releaseLock()}
  if(ch){save();render()}else updateLive();
},250);
function markAway(){
  var f=S.focus;
  if(f&&f.mode==='focus'&&f.kind!=='parcial'&&!f.pausedAt&&!f.hiddenAt){f.hiddenAt=Date.now();save()}
  else if(f&&f.mode==='failed'){archiveFocus();save()}
  /* Sempre que sair/fechar o Brewer (se não estiver em foco ativo), engatilha a tela Bateu a Vontade para a próxima abertura */
  if(!f||(f.mode!=='focus'&&f.mode!=='break')){
    S.tab='vontade';
    startGate((S.wait&&S.wait.app)||'Instagram');
    save();
    render();
  }else if(S.tab==='vontade'&&S.wait&&S.wait.phase==='gate'){
    S.wait=null;
    save();
  }
}
document.addEventListener('visibilitychange',function(){
  var f=S.focus;
  if(document.hidden){markAway();return}
  if(checkGateParam()){render();return}
  if(!f||(f.mode!=='focus'&&f.mode!=='break')){
    var prevApp=(S.wait&&S.wait.app)||'Instagram';
    S.tab='vontade';
    startGate(prevApp);
    render();
    return;
  }
  if(S.tab==='vontade'&&(!S.wait||S.wait.phase==='gate')){
    var prevApp2=(S.wait&&S.wait.app)||'Instagram';
    startGate(prevApp2);render();return;
  }
  if((f&&f.mode==='focus'&&!f.pausedAt)||(S.wait&&(S.wait.phase==='wait'||S.wait.phase==='gate')))holdScreen();
  render();checkReturn();updateLive();
});
window.addEventListener('pagehide',markAway);
window.addEventListener('pageshow',function(e){
  if(checkGateParam()){render();return}
  var f=S.focus;
  if(e&&e.persisted&&(!f||(f.mode!=='focus'&&f.mode!=='break'))){
    S.tab='vontade';
    startGate((S.wait&&S.wait.app)||'Instagram');
    render();
    return;
  }
  checkReturn();
});
window.addEventListener('focus',function(){if(checkGateParam())render()});
window.addEventListener('hashchange',function(){if(checkGateParam())render()});
window.addEventListener('popstate',function(){if(checkGateParam())render()});

/* ---------- ações ---------- */
document.addEventListener('click',function(e){
  if(e.target&&e.target.id==='sheetBack'){if(UI.asking)return;closeSheet();return}
  var el=e.target.closest('[data-act]');if(!el)return;
  var a=el.dataset.act,id=el.dataset.id,t,k;
  switch(a){
    case 'tab':closeSheet();if(el.dataset.sub)UI.agView=el.dataset.sub;if(el.dataset.rev)UI.revTab=el.dataset.rev;go(el.dataset.tab);break;
    case 'draft-mode':
      S.draft.mode=(el.dataset.v==='pomo'?'pomo':'unico');
      save();playTactileTick(600,0.015,0.04);render();
      break;
    case 'pomo-quick':
      var pq=el.dataset.v,dpq=S.draft.pomo=S.draft.pomo||{focusMins:25,breakMins:5,longBreakMins:15,cycles:4,kind:'total'};
      dpq.preset=pq;
      if(pq==='espresso'){dpq.focusMins=20;dpq.breakMins=4;dpq.longBreakMins=15;dpq.cycles=4}
      else if(pq==='chemex'){dpq.focusMins=50;dpq.breakMins=10;dpq.longBreakMins=20;dpq.cycles=4}
      else{dpq.focusMins=25;dpq.breakMins=5;dpq.longBreakMins=15;dpq.cycles=4}
      save();playTactileTick(620,0.015,0.04);render();
      break;
    case 'next-skip':
      UI.nextSkip=(UI.nextSkip||0)+1;
      playTactileTick(520,0.014,0.035);render();
      break;
    case 'rev-tab':
      UI.revTab=(el.dataset.v==='diario'?'diario':'ritmo');
      playTactileTick(560,0.014,0.035);render();
      break;
    case 'settings-sheet':settingsSheet();break;
    case 'toggle-streaks':
      S.hideStreaks=!S.hideStreaks;
      save();playTactileTick(540,0.014,0.035);render();settingsSheet();
      break;
    case 'gap-focus':
      var gd0=Math.max(5,Math.min(120,+el.dataset.dur||25));
      S.draft.mins=gd0;S.draft.mode='unico';save();
      var gtid=effTaskId(),gtk=gtid?findTask(gtid):null;
      openRitual({mins:gd0,kind:S.draft.kind,taskId:gtid,label:gtk?gtk.text:(S.draft.customLabel||'Janela livre'),cat:effCat()||'Sem categoria',src:'agenda'});
      break;
    case 'mood-sheet':moodSheet();break;
    case 'set-mood':
      var mv0=el.dataset.v;
      if(mv0==='auto'){S.cafeMood='';}
      else if(MOOD_META[mv0]){S.cafeMood=mv0;}
      var effM=resolveCafeMood(S.cafeMood);
      S.darkMode=!!MOOD_META[effM].dark;save();playTactileTick(640,0.016,0.04);render();moodSheet();
      break;
    case 'cycle-mood':
      var curM=resolveCafeMood(S.cafeMood);
      var nextM=MOOD_ORDER[(MOOD_ORDER.indexOf(curM)+1)%MOOD_ORDER.length];
      S.cafeMood=nextM;S.darkMode=!!MOOD_META[nextM].dark;save();playTactileTick(640,0.016,0.04);render();
      toast('Luz da cafeteria: '+MOOD_META[nextM].label);
      break;
    case 'focus-config-sheet':focusConfigSheet();break;
    case 'scroll-drawer':
      var dr=$('#hojeDayDrawer');if(dr)dr.scrollIntoView({behavior:'smooth',block:'start'});
      break;
    case 'theme-mode-toggle':S.darkMode=!S.darkMode;S.cafeMood=S.darkMode?'torrefacao':'manha';save();updateTheme();render();break;
    case 'prio-sheet':prioSheet();break;
    case 'notify-enable':requestNotifyPermission();break;
    case 'push-connect':var psi=$('#pushServerInput');subscribeWebPush(psi?psi.value.trim():'');break;
    case 'push-disconnect':unsubscribeWebPush();break;
    case 'push-test':var psi2=$('#pushServerInput');sendTestPush(psi2?psi2.value.trim():'');break;
    case 'pwa-force-update':
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(regs) {
          for (var reg of regs) reg.unregister();
        });
      }
      if ('caches' in window) {
        caches.keys().then(function(names) {
          for (var name of names) caches.delete(name);
        });
      }
      toast('Limpando cache e atualizando...');
      setTimeout(function() {
        window.location.reload(true);
      }, 300);
      break;
    case 'toggle-lock-audio':S.lockScreenAudio=S.lockScreenAudio===false?true:false;save();render();break;
    case 'toggle':t=findTask(id);if(t){var nextD=!t.done;if(nextD)triggerCheckRipple(el);setDone(t,nextD);save();render()}break;
    case 'toggle-sh':t=findTask(id);if(t){var nextD2=!t.done;if(nextD2)triggerCheckRipple(el);setDone(t,nextD2);save();prioSheet();render()}break;
    case 'plan':t=findTask(id);if(t){if(setPlan(t,t.plan!==today())){save();render()}}break;
    case 'plan-sh':t=findTask(id);if(t){if(setPlan(t,t.plan!==today())){save();prioSheet();render()}}break;
    case 'pick':UI.pick=!UI.pick;render();break;
    case 'task-new':taskSheet('',false);break;
    case 'task-new-today':taskSheet('',true,'pessoal');break;
    case 'task-edit':taskSheet(id);break;
    case 'task-save':
      var fm=readForm(),txt=fm.text;
      if(!txt){toast('Escreva o que precisa ser feito.');break}
      var wantToday=$('#fToday').checked,due=fm.due;
      t=SH.id?findTask(SH.id):null;
      if(!t){t=normTask({id:uid(),text:txt,done:false,doneAt:'',due:due,prio:SH.prio,plan:'',spent:0,cat:'',kind:SH.tk||'pessoal',createdAt:Date.now()})}
      var was=t.plan===today();
      if(wantToday&&!was&&planned(today()).length>=3){toast('Só 3 por dia. Já tem 3 em hoje.');break}
      t.text=txt;t.due=due;t.prio=SH.prio;t.cat=fm.cat;t.est=fm.est;t.note=fm.note;if(t.kind==='faculdade')t.subject=fm.subject;
      if(wantToday)t.plan=today();else if(was)t.plan='';
      if(!SH.id)S.tasks.push(t);
      save();closeSheet();render();break;
    case 'task-del':
      if(confirm('Excluir esta tarefa permanentemente?')){
        S.tasks=S.tasks.filter(function(x){return x.id!==id});
        save();closeSheet();render();
      }
      break;
    case 'task-focus':closeSheet();S.draft.taskId=id;S.draft.cat='';save();go('foco');break;
    case 'sh-prio':SH.prio=+el.dataset.v;$('#fPrio').innerHTML=prioChips(SH.prio);break;
    case 'sheet-close':closeSheet();break;
    case 'tk-kind':UI.tkKind=el.dataset.v;render();break;
    case 'tk-sub':if(UI.tkKind==='pessoal')UI.tkP=el.dataset.v;else UI.tkF=el.dataset.v;render();break;
    case 'voice':startVoice();break;
    case 'phrase-fill':var ph=$('#fPhrase');applyPhrase(ph?ph.value:'');break;
    case 'ib-confirm':var ic=S.inbox.find(function(x){return x.id===id});if(ic){confirmInbox(ic);save();render();toast('Confirmada. Ela está em Projetos, Pendentes.')}break;
    case 'ib-today':
      var it0=S.inbox.find(function(x){return x.id===id});
      if(it0){
        var b0=S.tasks.length;confirmInbox(it0);
        var ad0=S.tasks.length>b0?S.tasks[S.tasks.length-1]:null;
        if(ad0&&planned(today()).length<3){setPlan(ad0,true);toast('Confirmada e colocada nas 3 de Hoje!')}
        else toast('Confirmada em Pendentes (limite de 3 em Hoje).');
        save();render();
      }
      break;
    case 'ib-edit':inboxSheet(id);break;
    case 'ib-ignore':var ii=S.inbox.find(function(x){return x.id===id});if(ii){ignoreInbox(ii);save();closeSheet();render();toast('Ignorada. Dá para restaurar em "Ver ignoradas".')}break;
    case 'ib-ign-toggle':UI.showIgn=!UI.showIgn;render();break;
    case 'ib-restore':var rest=null;Object.keys(S.moodle.ignored).forEach(function(k){var e2=S.moodle.ignored[k];if(e2.item&&e2.item.id===id){rest=e2.item;delete S.moodle.ignored[k]}});if(rest){rest.edited=true;S.inbox.push(rest);save();render()}break;
    case 'ib-save':
    case 'ib-save-confirm':
      var f2=readForm(),it2=S.inbox.find(function(x){return x.id===SH.id});
      if(!it2){closeSheet();break}
      if(!f2.text){toast('Escreva o título da atividade.');break}
      it2.title=f2.text;it2.subject=f2.subject;it2.due=f2.due;it2.est=f2.est;it2.prio=SH.prio;it2.note=f2.note;it2.edited=true;
      if(a==='ib-save-confirm'){confirmInbox(it2);toast('Confirmada. Ela está em Projetos, Pendentes.')}
      save();closeSheet();render();break;
    case 'md-ics':var fi=$('#mdIcs');if(fi)fi.click();break;
    case 'md-cfg':UI.mdCfg=!UI.mdCfg;render();break;
    case 'md-save':
      var mu=($('#mdUrl').value||'').trim(),mt=($('#mdTok').value||'').trim();
      if(mu&&!/^https?:\/\//i.test(mu))mu='https://'+mu;
      S.moodle.baseUrl=mu;if(mt)S.moodle.token=mt;save();toast('Conexão salva neste aparelho.');render();break;
    case 'md-clear':S.moodle.token='';save();toast('Token apagado.');render();break;
    case 'md-sync':mdSync();break;
    case 'cup-pick':S.draft.cupModel=el.dataset.v===''?null:+el.dataset.v;save();render();break;
    case 'amb-set':setAmbience(el.dataset.v);render();break;
    case 'focus-task':closeSheet();S.draft.taskId=id;S.draft.cat='';save();go('hoje');break;
    case 'dur-minus':S.draft.mins=Math.max(5,(S.draft.mins<5?5:Math.round(S.draft.mins/5)*5)-5);save();updateDur();break;
    case 'dur-plus':S.draft.mins=Math.min(720,(S.draft.mins<5?0:Math.round(S.draft.mins/5)*5)+5);save();updateDur();break;
    case 'dur-set':S.draft.mins=Math.max(5,Math.min(240,+el.dataset.v||25));save();updateDur();break;
    case 'dur-test':S.draft.mins=0.1667;save();updateDur();break;
    case 'rev-mood':L().mood=(L().mood===el.dataset.v?'':el.dataset.v);playTactileTick(580,0.015,0.04);save();updateTheme();render();break;
    case 'rev-save':
      var lgS=L(),fw=$('#fWin'),fn=$('#fNext');
      if(fw)lgS.win=fw.value.trim();
      if(fn)lgS.next=fn.value.trim();
      playSoftChime();save();updateTheme();render();
      toast('Fechamento do dia salvo!');
      break;
    case 'focus-goal-set':S.focusGoal=+el.dataset.v||15;save();updateTheme();render();if(!$('#sheetBack').hidden)settingsSheet();toast('Meta diária ajustada para '+S.focusGoal+' min.');break;
    case 'kind-set':S.draft.kind=el.dataset.v==='parcial'?'parcial':'total';if(S.draft.pomo)S.draft.pomo.kind=S.draft.kind;save();setKindUI();render();break;
    case 'focus-pick-sheet':focusTaskSheet();break;
    case 'focus-pick-id':
      var scl=$('#sheetCustomLabel');if(scl)S.draft.customLabel=scl.value.trim();
      S.draft.taskId=id||'__other';S.draft.cat='';save();closeSheet();render();break;
    case 'focus-pick-save':
      var scl2=$('#sheetCustomLabel');if(scl2&&scl2.value.trim()){S.draft.customLabel=scl2.value.trim();S.draft.taskId='__other'}
      save();closeSheet();render();break;
    case 'start-focus':
      var cl2=$('#customLabel'),tid=effTaskId(),tk=tid?findTask(tid):null;
      openRitual({mins:S.draft.mins,kind:S.draft.kind,taskId:tid,label:tk?tk.text:((cl2&&cl2.value.trim())||S.draft.customLabel||'Foco livre'),cat:effCat()||'Sem categoria',src:'manual'});break;
    case 'pomo-sheet':openSheet('Modo Pomodoro',pomodoroSheetHTML());break;
    case 'pomo-kind':
      var pk=el.dataset.v;
      var dpk=S.draft.pomo=S.draft.pomo||{focusMins:25,breakMins:5,longBreakMins:15,cycles:4};
      dpk.kind=pk==='parcial'?'parcial':'total';
      document.querySelectorAll('[data-act="pomo-kind"]').forEach(function(b){
        b.setAttribute('aria-pressed',b.dataset.v===dpk.kind);
      });
      updatePomoSummary();save();render();break;
    case 'pomo-preset':
      var pr=el.dataset.v,dp=S.draft.pomo=S.draft.pomo||{cycles:4};
      dp.preset=pr;
      if(pr==='espresso'){dp.focusMins=20;dp.breakMins=4;dp.longBreakMins=15;dp.cycles=4}
      else if(pr==='chemex'){dp.focusMins=50;dp.breakMins=10;dp.longBreakMins=20;dp.cycles=4}
      else{dp.focusMins=25;dp.breakMins=5;dp.longBreakMins=15;dp.cycles=4}
      document.querySelectorAll('.pomo-chip').forEach(function(c){c.classList.toggle('active',c.dataset.v===pr)});
      updatePomoSummary();save();render();break;
    case 'pomo-step':
      var fld=el.dataset.f,delta=+el.dataset.d;
      var dp2=S.draft.pomo=S.draft.pomo||{focusMins:25,breakMins:5,longBreakMins:15,cycles:4};
      dp2.preset='custom';
      document.querySelectorAll('.pomo-chip').forEach(function(c){c.classList.remove('active')});
      if(fld==='focusMins')dp2.focusMins=Math.min(60,Math.max(10,(dp2.focusMins||25)+delta));
      else if(fld==='breakMins')dp2.breakMins=Math.min(15,Math.max(2,(dp2.breakMins||5)+delta));
      else if(fld==='longBreakMins')dp2.longBreakMins=Math.min(30,Math.max(5,(dp2.longBreakMins||15)+delta));
      else if(fld==='cycles')dp2.cycles=Math.min(8,Math.max(1,(dp2.cycles||4)+delta));
      playTactileTick(540+(delta>0?60:-60),0.014,0.036);
      updatePomoSummary();save();render();break;
    case 'start-pomo-session':startPomodoro();break;
    case 'pomo-start-next':
    case 'pomo-skip-break':startNextPomoCycle();break;
    case 'pomo-finish-early':finishPomodoroEarly();break;
    case 'pre-kind':if(UI.pre){UI.pre.cfg.kind=el.dataset.v==='parcial'?'parcial':'total';render()}break;
    case 'pre-go':if(UI.pre){primeFocusAudio(UI.amb);UI.pre.step='v60';clearTimeout(UI.preTimer);UI.preTimer=setTimeout(beginFocus,2400);render()}break;
    case 'pre-skip':primeFocusAudio(UI.amb);clearTimeout(UI.preTimer);beginFocus();break;
    case 'pre-back':clearTimeout(UI.preTimer);UI.pre=null;go('hoje');break;
    case 'end-partial':endPartial();break;
    case 'sg-place':var sp=UI.sg[+el.dataset.i];if(sp){placeSuggestion(UI.sgDay,sp);toast('Colocado na agenda.');render();plannerSheet(UI.sgDay)}break;
    case 'sg-no':var sn=UI.sg[+el.dataset.i];if(sn){UI.dismissed[UI.sgDay+'|'+sn.task.id]=true;plannerSheet(UI.sgDay)}break;
    case 'sg-edit':closeSheet();taskSheet(id);break;
    case 'sg-all':for(var gd=0;gd<8;gd++){var gl=suggestionsFor(UI.sgDay).filter(function(x){return x.fits===true});if(!gl.length)break;placeSuggestion(UI.sgDay,gl[0])}toast('Colocadas as que cabem.');render();plannerSheet(UI.sgDay);break;
    case 'sg-focus':var gt=findTask(id);if(gt)openRitual({mins:gt.est>0?gt.est:S.draft.mins,kind:S.draft.kind,taskId:gt.id,label:gt.text,cat:gt.cat||'Sem categoria',src:'manual'});break;
    case 'sg-hide':UI.hideSug=today();render();break;
    case 'gc-save-id':var cid=($('#gcClientId').value||'').trim();if(!/\.apps\.googleusercontent\.com$/.test(cid)){toast('Isso não parece um Client ID do Google (termina em .apps.googleusercontent.com).');break}gcCfg().clientId=cid;gcCfg().status='ready';save();render();break;
    case 'gc-change-id':gcCfg().clientId='';gcCfg().status='off';gcResetToken(false);save();render();break;
    case 'gc-sync':gcRun();break;
    case 'gc-diag':gcDiag();break;
    case 'gc-switch':UI.gcSelect=true;gcResetToken(true);gcRun();break;
    case 'gc-disconnect':gcDisconnect();break;
    case 'gc-toggle-cal':gcToggleCal(id,false);break;
    case 'gc-toggle-md':gcToggleCal(id,true);break;
    case 'gc-reload-cals':gcReloadCals();break;
    case 'studio-bg':UI.studioBg=el.dataset.v||'crema';updateFocusVesselState({theme:UI.studioBg});render();break;
    case 'give-up':UI.giveUp=true;render();break;
    case 'stop-focus':UI.giveUp=false;breakFocus('gaveup');break;
    case 'pause':pauseFocus();break;
    case 'resume':resumeFocus();break;
    case 'ret-lock':answerReturn('lock');break;
    case 'ret-phone':answerReturn('phone');break;
    case 'ret-quit':answerReturn('quit');break;
    case 'sim-away':if(S.focus&&S.focus.mode==='focus'){S.focus.hiddenAt=Date.now()-(+el.dataset.v)*1000;checkReturn()}break;
    case 'to-urge':go('vontade');break;
    case 'done-task':
      if(S.focus){t=findTask(S.focus.taskId);if(t){setDone(t,true)}S.focus.taskId=''}
      save();render();break;
    case 'more-block':startFocus(25,{taskId:S.focus?S.focus.taskId:'',label:S.focus?S.focus.label:''});break;
    case 'start-break':S.focus={mode:'break',taskId:'',label:'Pausa',total:300,startTime:Date.now(),endTime:Date.now()+300000,starter:false};startFocusMedia(S.focus);save();render();break;
    case 'skip-break':S.focus=null;stopFocusMedia(false);save();go('hoje');break;
    case 'feel':selectFeel(el.dataset.v);break;
    case 'start-10m':start10m();break;
    case 'gate-stay':gateStay();break;
    case 'gate-open-app':gateOpenApp(el.dataset.app);break;
    case 'gate-cfg':gateConfig();break;
    case 'wait-pass':finishWait('resisted');break;
    case 'wait-gave':finishWait('gave');break;
    case 'wait-more':S.wait.phase='wait';S.wait.total=300;S.wait.end=Date.now()+300000;S.wait.ext=true;holdScreen();save();render();break;
    case 'do-two':
      var first=S.tasks.filter(function(x){return !x.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
      L().resisted++;logUrge(S.wait?S.wait.feel:'','redirect');S.wait=null;releaseLock();
      startFocus(2,{taskId:first?first.id:'',starter:true,label:'Só 2 minutos'});break;
    case 'wait-back':S.wait=null;save();go(S.focus&&S.focus.mode==='focus'?'foco':'hoje');break;
    /* agenda */
    case 'ag-view':UI.agView=el.dataset.v;render();break;
    case 'day-prev':UI.agDay=addDays(UI.agDay||today(),-1);render();break;
    case 'day-next':UI.agDay=addDays(UI.agDay||today(),1);render();break;
    case 'day-pick':UI.agDay=el.dataset.k||null;render();break;
    case 'day-today':UI.agDay=null;render();break;
    case 'r-open':
      k=el.dataset.k||today();
      if(!el.dataset.r){UI.open[k]=!UI.open[k];render();break}
      UI.open[k+'|'+el.dataset.r]=!UI.open[k+'|'+el.dataset.r];
      if(S.tab==='hoje'&&el.textContent.indexOf('Abrir rotina')>-1)UI.open[k+'|'+el.dataset.r]=true;
      render();break;
    case 'step':
      k=el.dataset.k;var rk=k+'|'+el.dataset.r,arr=S.rdone[rk]||[],ix=arr.indexOf(el.dataset.s);
      if(ix>-1)arr.splice(ix,1);else arr.push(el.dataset.s);
      S.rdone[rk]=arr;save();render();break;
    case 'auto-plan':
    case 'auto-plan-k':plannerSheet(a==='auto-plan'?today():(UI.agDay||today()));break;
    case 'block-new':blockSheet(UI.agDay||today(),el.dataset.start||'',el.dataset.end||'');break;
    case 'block-save':
      var st=$('#bStart').value,en=$('#bEnd').value,tk=$('#bTask').value,tt=($('#bTitle').value||'').trim();
      if(!tt&&tk){var tobj=findTask(tk);if(tobj)tt=tobj.text}
      if(!tt){toast('Dê um nome ao bloco.');break}
      if(!st||!en||toMin(en)<=toMin(st)){toast('O fim precisa ser depois do início.');break}
      (S.blocks[SH.k]=S.blocks[SH.k]||[]).push({id:uid(),start:st,end:en,title:tt,taskId:tk||'',source:'local',extId:''});
      save();closeSheet();render();break;
    case 'block-del':
      k=el.dataset.k;var gone=(S.blocks[k]||[]).find(function(b){return b.id===id});if(gone&&gone.extId&&gone.source!=='gcal'){gcCfg().pendingDelete.push(gone.extId)}S.blocks[k]=(S.blocks[k]||[]).filter(function(b){return b.id!==id});save();render();break;
    case 'focus-block':
      k=el.dataset.k;var b=(S.blocks[k]||[]).find(function(x){return x.id===id});
      if(b){
        var s0=toMin(b.start),e0=toMin(b.end),nmn=nowMin(),dur=Math.max(5,e0-s0);
        if(k===today()&&nmn>=s0&&nmn<e0)dur=Math.max(5,e0-nmn);   /* evento em andamento: usa o que falta, sem teto de 60 min */
        var tk2=b.taskId?findTask(b.taskId):null;
        openRitual({mins:dur,kind:b.source==='gcal'?'parcial':'total',taskId:b.taskId||'',label:b.title,cat:(tk2&&tk2.cat)||'Sem categoria',src:'agenda',blockId:b.id,blockDay:k,ext:b.extId||'',gcal:b.source==='gcal'});
      }break;
    /* rotinas */
    case 'r-new':routineSheet('');break;
    case 'r-edit':routineSheet(id);break;
    case 'preset':
      var p=PRESETS[el.dataset.v];
      $('#rName').value=p.name;$('#rTime').value=p.time;$('#rDur').value=p.dur;SH.days=p.days.slice();$('#rDays').innerHTML=dayChips(SH.days);$('#rSteps').value=p.steps.join('\n');break;
    case 'sh-day':
      var di=+el.dataset.v,pos=SH.days.indexOf(di);if(pos>-1)SH.days.splice(pos,1);else SH.days.push(di);
      $('#rDays').innerHTML=dayChips(SH.days);break;
    case 'r-save':
      var nm=($('#rName').value||'').trim(),lines=($('#rSteps').value||'').split('\n').map(function(x){return x.trim()}).filter(Boolean);
      if(!nm){toast('Dê um nome à rotina.');break}
      if(!SH.days.length){toast('Escolha pelo menos um dia.');break}
      if(!lines.length){toast('Adicione pelo menos um passo.');break}
      var ro=SH.id?S.routines.find(function(x){return x.id===SH.id}):null;
      var old=ro?ro.steps:[];
      var steps=lines.map(function(tx){var m=old.find(function(s){return s.text===tx});return {id:m?m.id:uid(),text:tx}});
      var obj={id:ro?ro.id:uid(),name:nm,time:$('#rTime').value||'07:00',dur:Math.max(5,+$('#rDur').value||30),days:SH.days.slice(),steps:steps,created:ro?ro.created:today()};
      if(ro)S.routines[S.routines.indexOf(ro)]=obj;else S.routines.push(obj);
      save();closeSheet();render();break;
    case 'r-del':S.routines=S.routines.filter(function(x){return x.id!==id});save();closeSheet();render();break;
    /* revisão */
    case 'rev-view':UI.revView=el.dataset.v;render();break;
    case 'home-sub':UI.homeSub=el.dataset.v;render();break;
    /* jogo */
    case 'cat':S.draft.cat=el.dataset.v;save();render();if(!$('#sheetBack').hidden)focusConfigSheet();break;
    case 'cat-new':var cn=(prompt('Nome da nova categoria:')||'').trim();if(cn){if(S.cats.indexOf(cn)<0)S.cats.push(cn);S.draft.cat=cn;save();render();if(!$('#sheetBack').hidden)focusConfigSheet()}break;
    case 'cat-range':UI.catRange=+el.dataset.v;render();break;
    case 'col-view':UI.colView=el.dataset.v;render();break;
    case 'col-back':go('hoje');break;
    case 'cup-info':var bd=S.cups.find(function(x){return x.id===id});if(bd)toast('Xícara '+cupMeta(bd.model).name+(bd.ok?' (inteira)':' (quebrada)')+': '+(bd.label||'bloco de foco')+(bd.cat&&bd.cat!=='Sem categoria'?' ['+bd.cat+']':'')+(bd.mins?', '+bd.mins+' min':'')+', '+fmtShort(bd.d));break;
    case 'weekly-toggle':S.weekly1=!S.weekly1;if(S.weekly1)S.goalStart=mondayOf(today());save();render();break;
    case 't-week':var wv=+el.dataset.v;S.testWeeks=wv===0?0:Math.max(0,(S.testWeeks||0)+wv);save();render();break;
    case 't-model':var mv=$('#tModel').value;S.forceModel=mv===''?null:+mv;save();toast(mv===''?'Modelo automático.':'Próximo modelo: '+cupMeta(+mv).name);break;
    case 't-unlock':S.unlocked=CUP_ASSETS.good.map(function(_,i){return i});save();render();break;
    case 't-lockall':S.unlocked=[];save();render();break;
    case 'test-toggle':S.testMode=!S.testMode;save();render();break;
    case 't-add':testAdd();save();render();break;
    case 't-rem':testRem();save();render();break;
    case 't-skip':testSkip();save();render();break;
    case 't-jump':testJump(+$('#tPhase').value);save();render();break;
    case 't-clear':testClear();save();render();break;
    case 't-win':simSession(addCup(true,null,true));save();render();break;
    case 't-fail':simSession(addCup(false,null,true));save();render();break;
    case 't-clearb':S.cups=S.cups.filter(function(b){return !b.sim});S.sessions=S.sessions.filter(function(s){return !s.sim});save();render();break;
    case 't-reset':if(confirm('Apagar todos os dados do Brewer neste navegador?')){resetState();save();render()}break;
  }
});
document.addEventListener('submit',function(e){
  var form=e.target&&e.target.closest?e.target.closest('form[data-quick-form]'):null;
  if(!form)return;
  e.preventDefault();
  var inp=form.querySelector('.qif-input');
  var text=(inp&&inp.value||'').trim();
  if(!text){toast('Escreva a tarefa antes de adicionar.');return}
  var fk=form.dataset.quickForm;
  var kind=(fk==='faculdade')?'faculdade':'pessoal';
  var t=normTask({id:uid(),text:text,done:false,doneAt:'',due:'',prio:2,plan:'',spent:0,cat:'',kind:kind,createdAt:Date.now()});
  S.tasks.push(t);
  UI.nextSkip=0;
  playSoftChime();
  save();
  render();
  toast('Tarefa adicionada!');
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!$('#sheetBack').hidden&&!UI.asking){closeSheet();return}
  if(e.key==='Enter'&&e.target&&e.target.id==='fText'){e.preventDefault();var b=$('[data-act="task-save"]');if(b)b.click()}
});
document.addEventListener('change',function(e){
  var t=e.target;if(!t)return;
  if(t.id==='taskSel'){S.draft.taskId=t.value;S.draft.cat='';save();render();return}
  if(t.id==='catSel'){
    if(t.value==='__new'){
      var cn=(prompt('Nome da nova categoria:')||'').trim();
      if(cn){if(S.cats.indexOf(cn)<0)S.cats.push(cn);S.draft.cat=cn}
    }else S.draft.cat=t.value;
    save();render();return;
  }
  if(t.id==='kindSel'){S.draft.kind=t.value==='parcial'?'parcial':'total';save();return}
  if(t.id==='fAwake'){S.keepAwake=t.checked;save();return}
  if(t.id==='durRange'){save();return}
  if(t.id==='gcMoodle'){gcCfg().moodleCals=t.value.split(',').map(function(x){return x.trim()}).filter(Boolean);save();toast('Calendários para gerar tarefas salvos. Toque em Sincronizar.');return}
  if(t.id==='mdIcs'){mdFile(t);return}
  if(t.id==='gcPush'){gcCfg().push=t.checked;save();return}
  if(t.id==='gcExtra'){gcCfg().extraCals=t.value.split(',').map(function(x){return x.trim()}).filter(Boolean);save();toast('Calendários extras salvos. Toque em Sincronizar.');return}
  var f=t.dataset&&t.dataset.f;if(!f)return;
  var lg=L();
  if(f==='screenH'||f==='screenM'){
    var h=$('#fScreenH').value,m=$('#fScreenM').value;
    lg.screen=(h===''&&m==='')?null:Math.max(0,(+h||0)*60+(+m||0));lg.goal=currentGoal();
  }else if(f==='goalH'||f==='goalM'){
    S.goal=Math.max(30,(+$('#fGoalH').value||0)*60+(+$('#fGoalM').value||0));S.goalStart=mondayOf(today());S.testWeeks=0;
    if(lg.screen!=null)lg.goal=currentGoal();
  }else if(f==='win'){lg.win=t.value.trim()}
  else if(f==='next'){lg.next=t.value.trim()}
  save();var ss=$('#screenStatus');if(ss)ss.innerHTML=screenStatusHTML();updateTheme();
});

document.addEventListener('input',function(e){
  var t=e.target;if(!t)return;
  if(t.id==='durRange'){S.draft.mins=+t.value;updateDur();return}
  if(t.id==='pomoFocusRange'||t.id==='pomoBreakRange'||t.id==='pomoLongBreakRange'||t.id==='pomoCyclesRange'){
    var dp=S.draft.pomo=S.draft.pomo||{focusMins:25,breakMins:5,longBreakMins:15,cycles:4};
    dp.preset='custom';
    document.querySelectorAll('.pomo-chip').forEach(function(c){c.classList.remove('active')});
    if(t.id==='pomoFocusRange')dp.focusMins=+t.value;
    if(t.id==='pomoBreakRange')dp.breakMins=+t.value;
    if(t.id==='pomoLongBreakRange')dp.longBreakMins=+t.value;
    if(t.id==='pomoCyclesRange')dp.cycles=+t.value;
    updatePomoSummary();save();return;
  }
});
if(!checkGateParam()){
  var f0=S.focus;
  if(!f0||(f0.mode!=='focus'&&f0.mode!=='break')){
    S.tab='vontade';
    startGate((S.wait&&S.wait.app)||'Instagram');
    save();
  }
}
render();
checkReturn();
recordMorningActivity();
scheduleSmartSync();
}
