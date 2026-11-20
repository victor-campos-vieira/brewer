export var $=function(s){return document.querySelector(s)};
export var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
export var pl=function(n,s,p){return n+' '+(n===1?s:p)};
export var mmss=function(ms){var s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
export var uid=function(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)};

/* ---------- datas e horas ---------- */
export function key(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
export function today(){return key(new Date())}
export function parseKey(k){var p=k.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
export function addDays(k,n){var d=parseKey(k);d.setDate(d.getDate()+n);return key(d)}
export function toMin(h){var p=String(h||'0:0').split(':');return (+p[0]||0)*60+(+p[1]||0)}
export function fromMin(m){m=Math.max(0,Math.min(1439,Math.round(m)));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
export function nowMin(){var d=new Date();return d.getHours()*60+d.getMinutes()}
export function cap(s){return s.charAt(0).toUpperCase()+s.slice(1)}
export function fmtLong(k){return parseKey(k).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}
export function fmtShort(k){var p=k.split('-');return p[2]+'/'+p[1]}
export function fmtHM(min){min=Math.round(min);var h=Math.floor(min/60),m=min%60;return h?(h+'h'+(m?String(m).padStart(2,'0'):'')):(m+' min')}
export function fmtDur(m){m=Math.round(m);if(m<60)return m+' min';var h=Math.floor(m/60),r=m%60;return h+' h'+(r?' '+String(r).padStart(2,'0'):'')}
export function ceil5(m){return Math.ceil(m/5)*5}
export function dueLabel(d){
  var diff=Math.round((parseKey(d)-parseKey(today()))/864e5);
  if(diff<-1)return 'atrasada há '+(-diff)+' dias';
  if(diff===-1)return 'era ontem';
  if(diff===0)return 'hoje';
  if(diff===1)return 'amanhã';
  return fmtShort(d);
}
export var DAYL=['D','S','T','Q','Q','S','S'];
export var DAYN=['dom','seg','ter','qua','qui','sex','sáb'];
export function daysText(a){
  if(a.length===7)return 'todos os dias';
  if(a.length===5&&[1,2,3,4,5].every(function(x){return a.indexOf(x)>-1}))return 'seg a sex';
  return a.slice().sort().map(function(i){return DAYN[i]}).join(', ');
}
export function mondayOf(k){var d=parseKey(k),wd=(d.getDay()+6)%7;d.setDate(d.getDate()-wd);return key(d)}
export function lastDays(n,end){var a=[];for(var i=n-1;i>=0;i--)a.push(addDays(end||today(),-i));return a}
export function stripAcc(s){try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')}catch(e){return s}}

/* ---------- ícones vetoriais (1.5px/1.8px stroke, zero emojis) e controles ---------- */
export var CHECK='<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export var STAR='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
export var MIC='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
export var IC_CAFE='<svg class="ic-v2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v7a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/><path d="M6 2v3M10 2v3M14 2v3"/></svg>';
export var IC_BELL='<svg class="ic-v2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
export var IC_CAL='<svg class="ic-v2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
export var IC_SPARK='<svg class="ic-v2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"/></svg>';
export var IC_TARGET='<svg class="ic-v2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>';
export var IC_MOON='<svg class="ic-v2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
export var IC_PLAY='<svg class="ic-v2" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
export var IC_FLAME='<svg class="ic-v2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>';
export var IC_LOCK_PHONE='<svg class="ic-v2" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
export function seg(act,cur,opts,cls){return '<div class="seg'+(cls?' '+cls:'')+'" role="group">'+opts.map(function(o){return '<button data-act="'+act+'" data-v="'+o[0]+'" aria-pressed="'+(cur===o[0])+'">'+o[1]+'</button>'}).join('')+'</div>'}
