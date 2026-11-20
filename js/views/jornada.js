import { $, esc, pl, uid, today, addDays, fmtHM } from '../utils.js';
import { S, L, PHASES, phaseIdx, qualifies, streakInfo, CUP_ASSETS, cupMeta, addCafeFocus } from '../state.js';

/* ---------- JORNADA v2 (Evolução automática por Foco Real — Sem Tempo de Tela) ---------- */
export function goalPanelHTML(){
  var minF=S.focusGoal||15,lg=L(),s=streakInfo();
  var pct=Math.min(100,Math.round(((lg.focus||0)/minF)*100));
  return '<div class="sec"><h2>Ritual diário de consistência</h2>'+
    '<p class="sumline">Meta diária: <b>'+minF+' min de foco</b> (ou fechamento na Revisão).</p>'+
    '<p class="sumline">Hoje: <b>'+fmtHM(lg.focus||0)+'</b> focados '+(s.todayDone?'· <b>Dia contabilizado</b>':'· Faltam '+Math.max(0,minF-(lg.focus||0))+' min')+'.</p>'+
    '<div class="pbar" style="max-width:none;margin-top:10px" aria-hidden="true"><span style="width:'+pct+'%"></span></div>'+
  '</div>';
}
export function renderJornada(){
  var s=streakInfo(),ci=phaseIdx(s.n),nx=PHASES[ci+1];
  var tl=PHASES.map(function(p,i){
    var cls=i===ci?'current':i<ci?'done':'locked',fut=i>ci;
    return '<div class="t-node '+cls+'"><div class="t-dot"></div><div><h3>'+(fut?'[ ? ] Desbloqueia no dia '+p.min:esc(p.name))+'</h3><p class="small muted">'+(fut?'Continue focando para descobrir esta torra.':esc(p.desc))+'</p></div></div>';
  }).join('');
  var po=PHASES.slice(1).map(function(p,i){return '<option value="'+(i+1)+'">'+esc(p.name)+' (dia '+p.min+')</option>'}).join('');
  var mo='<option value="">Automático</option>'+CUP_ASSETS.good.map(function(_,i){return '<option value="'+i+'">'+esc(cupMeta(i).name)+'</option>'}).join('');
  var test=S.testMode?'<div class="test-panel"><h3>Modo teste</h3><p class="small muted" style="margin-top:4px">Simule dias de consistência, fases de torra e sessões de foco.</p>'+
    '<p class="small" style="margin-top:10px">Sequência atual: <b>'+s.n+'</b></p>'+
    '<div class="row"><button class="btn quiet small" data-act="t-add">+1 dia</button><button class="btn quiet small" data-act="t-rem">-1 dia</button><button class="btn quiet small" data-act="t-skip">Perder um dia</button></div>'+
    '<select class="field" id="tPhase" aria-label="Fase" style="margin-top:12px">'+po+'</select><div class="row"><button class="btn quiet small" data-act="t-jump">Ir para a fase</button><button class="btn quiet small" data-act="t-clear">Limpar dias simulados</button></div><hr>'+
    '<div class="row" style="margin-top:0"><button class="btn quiet small" data-act="t-win">+ Sessão boa (25g)</button><button class="btn quiet small" data-act="t-fail">+ Sessão interrompida</button><button class="btn quiet small" data-act="t-clearb">Limpar sessões simuladas</button></div>'+
    '<select class="field" id="tModel" aria-label="Modelo" style="margin-top:12px">'+mo+'</select><div class="row"><button class="btn quiet small" data-act="t-model">Usar no próximo foco</button><button class="btn quiet small" data-act="t-unlock">Descobrir todas</button><button class="btn quiet small" data-act="t-lockall">Esconder todas</button></div>'+
    '<hr><button class="btn quiet small danger" data-act="t-reset">Apagar todos os dados</button></div>':'';
  $('#tab-jornada').innerHTML='<div class="pd-glass-card jornada-glass-card">'+
    '<div class="ns-head" style="margin-bottom:10px"><button class="ns-link" data-act="tab" data-tab="revisao">&lsaquo; Voltar ao Resumo</button><span class="ns-kicker">Jornada de Torra</span></div>'+
    '<h1 style="margin:0;font-size:28px">Sua jornada</h1><p class="lead" style="margin-top:6px">Cada dia em que você completa seu ritual de foco ou fecha o diário evolui a torra do seu café.</p>'+
    '<p style="margin-top:14px">Sequência atual: <b>'+pl(s.n,'dia','dias')+'</b> · Recorde: <b>'+s.best+'</b>.</p><p class="muted small">'+(nx?'Faltam '+pl(nx.min-s.n,'dia','dias')+' para a torra '+esc(nx.name)+'.':'Você alcançou a torra máxima: Mestre do V60.')+'</p>'+
    '<div class="row" style="margin-top:12px"><button class="btn small" data-act="tab" data-tab="hoje">Iniciar foco</button><button class="btn quiet small" data-act="tab" data-tab="revisao">Ver resumo</button></div>'+goalPanelHTML()+'<div class="timeline">'+tl+'</div>'+
    '<div class="row" style="margin-top:14px"><button class="btn quiet small" data-act="test-toggle" aria-pressed="'+S.testMode+'">'+(S.testMode?'Fechar modo teste':'Modo teste')+'</button></div>'+test+
  '</div>';
}
export function simSession(c){S.sessions.push({id:uid(),d:c.d,t0:Date.now(),t1:Date.now(),mins:25,mode:'total',ok:c.ok,cupId:c.id,model:c.model,cat:'',label:'Teste',taskId:'',src:'manual',blockId:'',ext:'',approx:false,sim:true});if(c&&c.ok)addCafeFocus(25)}
export function simDay(k){var l=L(k);l.focus=Math.max(l.focus||0,S.focusGoal||15);l.sim=true}
export function testAdd(){var s=streakInfo();simDay(addDays(s.end,-s.n))}
export function testRem(){var s=streakInfo();if(s.n>0){var l=L(addDays(s.end,-(s.n-1)));l.focus=0;l.win='';l.next='';l.mood='';l.screen=null;l.sim=false}}
export function testSkip(){var l=L(addDays(today(),-1));l.focus=0;l.win='';l.next='';l.mood='';l.screen=null;l.sim=false}
export function testJump(i){var n=PHASES[i].min;for(var j=0;j<n;j++){var k=addDays(today(),-j);if(!qualifies(k))simDay(k)}}
export function testClear(){Object.keys(S.log).forEach(function(k){if(S.log[k].sim){S.log[k].focus=0;S.log[k].screen=null;S.log[k].sim=false}})}
