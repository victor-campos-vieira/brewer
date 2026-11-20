import { $, esc, mmss, today } from '../utils.js';
import { S, L, save, cmp, holdScreen, releaseLock, toast } from '../state.js';
import { render, go } from '../app.js';

/* ---------- curva da vontade ---------- */
export function inten(t){return .05+.95*Math.exp(-Math.pow(t-.3,2)/(2*.16*.16))}
export function WX(t){return 6+t*308}
export function WY(t){return 108-inten(t)*86}
export var curvePath=(function(){var d='';for(var i=0;i<=60;i++){var t=i/60;d+=(i?'L':'M')+WX(t).toFixed(1)+' '+WY(t).toFixed(1)}return d})();
export var curveArea=curvePath+'L'+WX(1).toFixed(1)+' 112L'+WX(0).toFixed(1)+' 112Z';
export function curveSVG(){
  return '<svg class="curve" viewBox="0 0 320 130" role="img" aria-label="A vontade sobe, chega ao pico e passa">'+
  '<defs><clipPath id="wc"><rect id="curveClip" x="0" y="0" width="0" height="130"/></clipPath></defs>'+
  '<path d="'+curveArea+'" fill="var(--sea)" opacity=".18" clip-path="url(#wc)"/>'+
  '<path d="'+curvePath+'" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>'+
  '<path d="'+curvePath+'" fill="none" stroke="var(--sea)" stroke-width="3.5" stroke-linecap="round" clip-path="url(#wc)"/>'+
  '<circle id="curveDot" r="7" cx="6" cy="'+WY(0).toFixed(1)+'" fill="var(--sun)" stroke="var(--bg)" stroke-width="3"/>'+
  '<text x="'+WX(.08).toFixed(0)+'" y="126">sobe</text><text x="'+WX(.3).toFixed(0)+'" y="126">pico</text><text x="'+WX(.72).toFixed(0)+'" y="126">passa</text>'+
  '</svg>';
}

/* ---------- VONTADE & MODO SCREENZEN (GATE) ---------- */
export var GATE_STEPS=[15,20,25,30];
export var FEELS={
  'Só hábito':'O polegar foi no piloto automático. Respire fundo 3 vezes.',
  'Tédio':'Levante, beba água ou olhe pela janela. O tédio passa rápido.',
  'Ansiedade':'Solte o ar bem devagar. Escreva em 1 linha o que te preocupa.',
  'Procrastinando':'Combine consigo: só 2 minutos na tarefa. Começar é o segredo.',
  'Responder alguém':'Entre, responda quem precisa e saia direto sem olhar o feed.',
  'Lazer consciente':'Tudo bem descansar no seu tempo livre. Aproveite os 5 min com foco.'
};
export var LEISURE_FEELS={'Responder alguém':1,'Lazer consciente':1,'Lazer / tempo livre':1};

export function gateSeconds(){
  var c=L().gateCount||0;
  return GATE_STEPS[Math.min(GATE_STEPS.length-1,c)];
}
export function clearGateURL(){
  try{
    if(window.history&&history.replaceState&&(location.search.indexOf('gate')>-1||location.hash.indexOf('gate')>-1||location.search.indexOf('app')>-1||location.hash.indexOf('app')>-1)){
      history.replaceState(null,'',location.pathname);
    }
  }catch(e){}
}
export function getAppScheme(app){
  var a=(app||'').toLowerCase();
  if(a.includes('twit')||a==='x')return 'twitter://';
  if(a.includes('insta'))return 'instagram://';
  if(a.includes('you'))return 'youtube://';
  if(a.includes('tik'))return 'tiktok://';
  if(a.includes('reddit'))return 'reddit://';
  if(a.includes('link'))return 'linkedin://';
  return null;
}
export function startGate(app){
  var secs=gateSeconds(),now=Date.now();
  var a=(app||'').trim();
  var label=a?String(a).charAt(0).toUpperCase()+String(a).slice(1):'Instagram';
  if(label==='1'||label==='True'||!label)label='Instagram';
  if(label.toLowerCase()==='x')label='Twitter';
  S.wait={phase:'gate',app:label,feel:'',total:secs,start:now,end:now+secs*1000,attempt:(L().gateCount||0)+1,notified:false};
  holdScreen();save();
}
export function selectFeel(feel){
  if(S.wait&&S.wait.phase==='gate'){
    S.wait.feel=feel;save();render();return;
  }
  startWait(feel);
}
export function start10m(){
  var feel=(S.wait&&S.wait.feel)||'Só hábito';
  startWait(feel);
}
export function gateStay(){
  var feel=(S.wait&&S.wait.feel)||'Só hábito';
  L().resisted++;
  logUrge(feel,'resisted');
  S.wait=null;releaseLock();clearGateURL();save();
  toast('Boa escolha! +1 vontade que passou.');
  go(S.focus&&S.focus.mode==='focus'?'foco':'hoje');
}
export function gateOpenApp(targetApp){
  var s=S.wait;
  if(!s||s.phase!=='gate'||Date.now()<s.end||!s.feel)return;
  var lg=L();
  lg.gateCount=(lg.gateCount||0)+1;
  if(!LEISURE_FEELS[s.feel]){
    lg.gave++;
    logUrge(s.feel,'gave');
  }else{
    logUrge(s.feel,'leisure');
  }
  var appTarget=targetApp||s.app||'Instagram';
  var isTw=appTarget.toLowerCase().indexOf('twit')>-1||appTarget.toLowerCase()==='x';
  var shName=isTw?'Liberar Twitter':(S.gateShortcut||'Liberar Instagram');

  S.wait=null;S.tab='vontade';releaseLock();clearGateURL();save();render();

  try{
    window.location.href='shortcuts://run-shortcut?name='+encodeURIComponent(shName)+'&input=text&text='+encodeURIComponent(appTarget);
  }catch(e){}
}
export function gateConfig(){
  var cur=S.gateShortcut||'Liberar Instagram';
  var nv=prompt('Nome exato do Atalho no iPhone que libera os 5 min e abre o Instagram:',cur);
  if(nv!==null&&nv.trim()){
    S.gateShortcut=nv.trim();save();render();
    toast('Atalho salvo: '+S.gateShortcut);
  }
}
export function startWait(feel){S.wait={phase:'wait',feel:feel,total:600,end:Date.now()+600000,ext:false};holdScreen();save();render()}
export function logUrge(feel,res){S.urges.push({t:Date.now(),feel:feel||'',res:res});if(S.urges.length>400)S.urges=S.urges.slice(-400)}
export function finishWait(res){
  var feel=S.wait?S.wait.feel:'';
  if(res==='resisted')L().resisted++;else L().gave++;
  logUrge(feel,res);
  S.wait={phase:'result',result:res,feel:feel};releaseLock();clearGateURL();save();render();
}
export function gateBtnText(s,rem){
  var app=s.app||'Instagram';
  if(rem>0){
    var sec=Math.ceil(rem/1000);
    return 'Aguarde '+sec+'s...';
  }
  if(!s.feel)return 'Toque em um motivo acima para liberar';
  return 'Liberar '+app+' por 5 min';
}
export function renderVontade(){
  var el=$('#tab-vontade');
  if(!S.wait)startGate('Instagram');
  var s=S.wait;
  if(s.phase==='gate'){
    var now=Date.now(),rem=Math.max(0,s.end-now),elapsed=Math.max(0,now-(s.start||(s.end-s.total*1000)));
    var pct=Math.max(0,Math.min(100,(1-rem/(s.total*1000))*100));
    var f=S.focus,focusWarn='';
    if(f&&f.mode==='focus'){
      focusWarn=f.kind==='parcial'
        ?'<div class="pausa-warn-glass soft"><b>Foco parcial em andamento</b><p>Você está em <strong>'+esc(f.label)+'</strong>. Quer mesmo interromper agora?</p></div>'
        :'<div class="pausa-warn-glass"><b>Atenção: foco em andamento</b><p>Você está em <strong>'+esc(f.label)+'</strong>. Abrir o '+esc(s.app||'Instagram')+' agora vai interromper seu bloco.</p></div>';
    }
    /* FASE 1: The Viscous Threshold — fluido vivo 60fps sincronizado com a respiração + ondulações táteis ao toque */
    if(rem>0){
      var rP=86,cP=Math.round(2*Math.PI*rP);
      var offP=Math.round(cP*(1-(pct/100)));
      var mirrors=[
        'Você quer abrir isso agora ou só escapar por 1 minuto?',
        'Daqui a 10 minutos, você vai ficar feliz por ter entrado?',
        'O impulso sobe rápido, atinge o pico e passa em silêncio.',
        'O que você lembra dos últimos 5 minutos que passou no feed?'
      ];
      var mLine=mirrors[(Math.max(1,s.attempt)-1)%mirrors.length];
      var resToday=(L().resisted||0);
      el.innerHTML=
        '<div class="headspace-gate-v2 pausa-clean-v4">'+
          '<div class="hs-waves-bg" aria-hidden="true">'+
            '<canvas id="pausaFluidCanvas" class="pausa-fluid-canvas"></canvas>'+
          '</div>'+
          '<div class="hs-content pc4-content">'+
            '<span class="pc4-pill">'+s.attempt+'&ordf; pausa de hoje'+(resToday?' &middot; '+resToday+' vencida'+(resToday>1?'s':''):' &middot; '+s.total+'s')+'</span>'+
            '<h1 class="pc4-title">Respire fundo.</h1>'+
            '<p class="pc4-mirror">'+esc(mLine)+'</p>'+
            focusWarn+
            '<div class="pc4-ring-wrap">'+
              '<svg viewBox="0 0 196 196" class="pc4-ring-svg" aria-hidden="true">'+
                '<circle cx="98" cy="98" r="'+rP+'" class="pc4-ring-track"/>'+
                '<circle cx="98" cy="98" r="'+rP+'" id="gateRingArc" class="pc4-ring-arc" stroke-dasharray="'+cP+'" stroke-dashoffset="'+offP+'"/>'+
              '</svg>'+
              '<div class="pc4-ring-core">'+
                '<div class="pc4-time" id="waitTime">'+mmss(rem)+'</div>'+
                '<div class="pc4-cue" id="breathLabel">'+(elapsed%10000<4000?'Inspira':'Solta')+'</div>'+
              '</div>'+
            '</div>'+
            '<p class="pc4-guide">4 segundos puxando o ar &middot; 6 segundos soltando</p>'+
            '<div class="pc4-thread"><div class="pc4-thread-fill" id="gateBar" style="width:'+pct+'%"></div></div>'+
            '<p class="pc4-touch-hint" id="pausaTouchHint">Toque ou deslize devagar na tela para acalmar as ondas</p>'+
            '<button class="pc4-back-btn" data-act="tab" data-tab="hoje">Voltar para o Hoje</button>'+
          '</div>'+
        '</div>';
      return;
    }
    /* FASE 2: Tempo zerou (00:00) -> revela os cartões expressivos estilo How We Feel + Headspace */
    var ready=!!s.feel;
    var feelColors={
      'Só hábito':'#FFB830',
      'Tédio':'#FF7E55',
      'Ansiedade':'#A37CFF',
      'Procrastinando':'#FF5C5C',
      'Responder alguém':'#45C486',
      'Lazer consciente':'#4A90E2'
    };
    var chips=Object.keys(FEELS).map(function(k){
      var col=feelColors[k]||'#FFB830';
      var isSel=(s.feel===k);
      return '<button class="hwf-feel-tile'+(isSel?' active':'')+'" style="--fc:'+col+'" data-act="feel" data-v="'+esc(k)+'" aria-pressed="'+isSel+'">'+
        '<span class="hft-dot" style="background:'+col+'"></span>'+
        '<b class="hft-name">'+esc(k)+'</b>'+
      '</button>';
    }).join('');
    var first=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
    var extra=(s.feel==='Procrastinando'||s.feel==='Tédio'||s.feel==='Fugindo de uma tarefa')?'<div style="margin-top:12px"><button class="hs-action-pill dark" data-act="do-two">Trocar por 2 min de foco'+(first?': '+esc(first.text.length>22?first.text.slice(0,22)+'…':first.text):'')+'</button></div>':'';
    var tipBox=s.feel?'<div class="hs-tip-card"><p>'+esc(FEELS[s.feel]||'')+'</p>'+(LEISURE_FEELS[s.feel]?'<p class="small" style="margin-top:6px;opacity:.78">Uso consciente: não conta como recaída no seu resumo.</p>':'')+extra+'</div>':'';
    var nextStep=GATE_STEPS[Math.min(GATE_STEPS.length-1,s.attempt)];
    el.innerHTML=
      '<div class="headspace-gate-v2 pausa-clean-v4 is-revealed">'+
        '<div class="hs-waves-bg" aria-hidden="true">'+
          '<canvas id="pausaFluidCanvas" class="pausa-fluid-canvas"></canvas>'+
        '</div>'+
        '<div class="hs-content pc4-revealed-content">'+
          '<span class="pc4-pill">'+s.attempt+'&ordf; pausa concluída'+(L().resisted?' &middot; '+L().resisted+' vencida'+(L().resisted>1?'s':''):'')+'</span>'+
          '<h1 class="pc4-title sm">O que você está sentindo agora?</h1>'+
          '<p class="pc4-mirror">'+(s.attempt<GATE_STEPS.length?'Nomear a sensação reduz o impulso automático. (Próxima pausa: '+nextStep+'s)':'Pausa máxima de 30s ativa hoje.')+'</p>'+
          focusWarn+
          '<div class="hwf-feels-grid">'+chips+'</div>'+
          tipBox+
          '<div class="hs-decision-stack">'+
            '<button class="hs-stay-primary" data-act="gate-stay">'+(f&&f.mode==='focus'?'Voltar para a Sessão de Foco':'Vencer impulso e voltar ao Brewer')+'</button>'+
            '<div class="gate-row">'+
              '<button class="hs-open-ghost" data-act="gate-open-app" data-app="Instagram"'+(ready?'':' disabled')+'>Liberar Instagram (5m)</button>'+
              '<button class="hs-open-ghost" data-act="gate-open-app" data-app="Twitter"'+(ready?'':' disabled')+'>Liberar Twitter (5m)</button>'+
            '</div>'+
            '<button class="hs-curve-link" data-act="start-10m">Observar por 10 min na Curva da Vontade &rarr;</button>'+
          '</div>'+
          '<p class="hs-shortcut-foot">Atalhos iOS: <b>Liberar Instagram</b> / <b>Twitter</b> · <button class="hs-cfg-link" data-act="gate-cfg">Configurar</button></p>'+
        '</div>'+
      '</div>';
    return;
  }
  if(s.phase==='wait'){
    var first2=S.tasks.filter(function(t){return !t.done}).sort(function(a,b){return ((b.plan===today())-(a.plan===today()))||cmp(a,b)})[0];
    var elapsed2=Date.now()-(s.end-s.total*1000);
    var extra2=(s.feel==='Procrastinando'||s.feel==='Tédio'||s.feel==='Fugindo de uma tarefa')?'<div style="margin-top:12px"><button class="btn sun small" data-act="do-two">Fazer 2 minutos agora'+(first2?': '+esc(first2.text.length>22?first2.text.slice(0,22)+'…':first2.text):'')+'</button></div>':'';
    el.innerHTML='<div class="sanctuary-state-stage">'+
      '<div class="sanctuary-glass-card wide">'+
        '<span class="ssg-badge">CURVA DA VONTADE · 10 MIN</span>'+
        '<h2>Deixando a vontade passar</h2>'+
        curveSVG()+
        '<div class="wait-time" id="waitTime" style="margin:8px 0">'+mmss(s.end-Date.now())+'</div>'+
        '<div class="breath"><div class="orb-box"><div class="orb" style="animation-delay:-'+(elapsed2%10000)+'ms"></div></div><div><b id="breathLabel">Inspira</b><p class="muted small">4 segundos para puxar, 6 para soltar</p></div></div>'+
        '<div class="suggest"><p>'+esc(FEELS[s.feel]||'Observe a sensação subir, chegar ao pico e baixar devagar.')+'</p>'+extra2+'</div>'+
        '<div class="stack" style="margin-top:16px"><button class="ofs-start-btn" style="max-width:100%" data-act="wait-pass">Já passou</button><button class="oura-ghost-btn" data-act="wait-gave">Cedi desta vez</button></div>'+
      '</div>'+
    '</div>';
  }else if(s.phase==='end'){
    el.innerHTML='<div class="sanctuary-state-stage">'+
      '<div class="sanctuary-glass-card">'+
        '<span class="ssg-badge">10 MIN CONCLUÍDOS</span>'+
        '<h2>A vontade passou. Ou quase.</h2>'+
        '<p class="ssg-copy">Como você está se sentindo agora?</p>'+
        '<div class="stack" style="margin-top:18px">'+
          '<button class="ofs-start-btn" style="max-width:100%" data-act="wait-pass">Passou, vou voltar</button>'+
          '<button class="oura-ghost-btn" data-act="wait-more">Ainda quero. Mais 5 min</button>'+
          '<button class="oura-ghost-btn" data-act="wait-gave">Cedi</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }else{
    var ok=s.result==='resisted';
    var resN=L().resisted||0;
    var icDone=ok
      ?'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
      :'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12c2.5-4 5.5-4 8 0s5.5 4 8 0 3.5-2 4-1"/><path d="M2 17c2.5-3.5 5.5-3.5 8 0s5.5 3.5 8 0"/></svg>';
    el.innerHTML='<div class="sanctuary-state-stage">'+
      '<div class="sanctuary-glass-card">'+
        '<div class="prs-emblem'+(ok?' ok':'')+'">'+icDone+'</div>'+
        '<span class="ssg-badge'+(ok?'':' soft')+'">'+(resN?resN+' impulso'+(resN>1?'s':'')+' vencido'+(resN>1?'s':'')+' hoje':'PAUSA CONSCIENTE')+'</span>'+
        '<h2>'+(ok?'Vontade vencida.':'Pausa registrada.')+'</h2>'+
        '<p class="ssg-copy">'+(ok?'Cada impulso observado em silêncio deixa o próximo mais leve. Seu foco agradece.':'Sem culpa nenhuma. Combine cinco minutos conscientes e volte no seu ritmo quando quiser.')+'</p>'+
        '<div class="stack" style="margin-top:22px">'+
          '<button class="ofs-start-btn" style="max-width:100%" data-act="wait-back">'+(S.focus&&S.focus.mode==='focus'?'Voltar ao foco':'Voltar ao Hoje')+'</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
}
