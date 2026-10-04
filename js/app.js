'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const V=$('#view');
const KEY='ingles-em-formacao-v1';
let S={u:{},m:{},dr:{},da:{},qz:{},notes:{},theme:null,fs:17,focus:false,last:null,gam:{xp:0,days:{}},place:null};
try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o)S=Object.assign(S,o);}catch(e){}
S.gam=S.gam||{xp:0,days:{}};
let saveT=null;
function persist(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function save(){S._ts=Date.now();clearTimeout(saveT);saveT=setTimeout(()=>{persist();updTop();sbQueuePush();},200);}

/* ---------- Supabase (progresso na nuvem) ---------- */
const SB_URL='https://undpiclnsmmlipxaxxti.supabase.co';
const SB_KEY='sb_publishable_-R2FQRy2fxKseO_4mkvuhA_NuO4gUPG';
const SB_TABLE='english_progress';
let sb=null,sbUser=null,sbPushT=null,sbTries=0,sbBusy=false,sbLastSync=null;
function sbInit(){
  if(!window.supabase){if(++sbTries<40){setTimeout(sbInit,300);return;}console.warn('Supabase JS não carregou a tempo; usando apenas armazenamento local.');refreshAcct();return;}
  sbInitReal();
}
async function sbInitReal(){
  try{
    sb=window.supabase.createClient(SB_URL,SB_KEY);
    sb.auth.onAuthStateChange((event,session)=>{
      const prev=sbUser&&sbUser.id;sbUser=session&&session.user;
      if((event==='SIGNED_IN'&&sbUser&&sbUser.id!==prev)||event==='USER_UPDATED')setTimeout(sbPull,0);
      setTimeout(refreshAcct,0);
    });
    let {data:{session}}=await sb.auth.getSession();
    if(!session){const {data,error}=await sb.auth.signInAnonymously();if(error)throw error;session=data.session;}
    sbUser=session&&session.user;
    if(sbUser)await sbPull();
  }catch(e){console.warn('Supabase indisponível; usando apenas armazenamento local.',e);}
  refreshAcct();
}
/* junta dois estados sem perder progresso (usado quando o progresso local veio de outra conta/aparelho) */
function mergeState(R){
  ['u','m','dr'].forEach(k=>{S[k]=S[k]||{};Object.entries(R[k]||{}).forEach(([id,v])=>{if(!S[k][id])S[k][id]=v;});});
  S.da=Object.assign({},R.da||{},S.da||{});
  S.qz=S.qz||{};Object.entries(R.qz||{}).forEach(([k,v])=>{if(S.qz[k]==null||v>S.qz[k])S.qz[k]=v;});
  S.notes=S.notes||{};Object.entries(R.notes||{}).forEach(([k,v])=>{if(!S.notes[k]||String(v).length>String(S.notes[k]).length)S.notes[k]=v;});
  const rg=R.gam||{xp:0,days:{}};S.gam.xp=Math.max(S.gam.xp||0,rg.xp||0);
  Object.entries(rg.days||{}).forEach(([d,v])=>{S.gam.days[d]=Math.max(S.gam.days[d]||0,v);});
  if(R.place&&(!S.place||R.place.date>S.place.date))S.place=R.place;
  if(!S.last)S.last=R.last||null;
}
async function sbPull(){
  if(!sb||!sbUser)return;
  if(sbBusy){setTimeout(sbPull,800);return;}
  sbBusy=true;let changed=false;
  try{
    const {data,error}=await sb.from(SB_TABLE).select('state,updated_at').eq('user_id',sbUser.id).maybeSingle();
    if(error)throw error;
    const R=data&&data.state;
    if(R&&Object.keys(R).length){
      const before=JSON.stringify(S);
      if(!S._uid||S._uid!==sbUser.id){mergeState(R);S._ts=Date.now();}
      else if(new Date(data.updated_at).getTime()>(S._ts||0)){const keep={theme:S.theme,fs:S.fs,focus:S.focus};S=Object.assign({u:{},m:{},dr:{},da:{},qz:{},notes:{},gam:{xp:0,days:{}}},R,keep);S._ts=new Date(data.updated_at).getTime();}
      changed=JSON.stringify(S)!==before;
    }
    S._uid=sbUser.id;persist();sbLastSync=Date.now();
  }catch(e){console.warn('Falha ao buscar progresso no Supabase.',e);}
  sbBusy=false;
  if(changed){applyPrefs();buildMenus();updTop();const a=document.activeElement;if(!$('#smodal')&&!(a&&/^(INPUT|TEXTAREA)$/.test(a.tagName)))route();toast('Progresso sincronizado da nuvem');}
  await sbPushNow();
}
function sbQueuePush(){if(!sb||!sbUser)return;clearTimeout(sbPushT);sbPushT=setTimeout(sbPushNow,1200);}
async function sbPushNow(){
  if(!sb||!sbUser)return;
  if(sbBusy){sbQueuePush();return;}
  sbBusy=true;
  try{
    S._uid=sbUser.id;
    const {error}=await sb.from(SB_TABLE).upsert({user_id:sbUser.id,state:S,updated_at:new Date(S._ts||Date.now()).toISOString()});
    if(error)throw error;
    persist();sbLastSync=Date.now();
  }catch(e){console.warn('Falha ao sincronizar progresso com Supabase.',e);}
  sbBusy=false;refreshAcct();
}
function sbAccountStatusHTML(){
  if(!sb)return '<p class="sub">Sincronização com a nuvem indisponível neste momento. Seu progresso continua salvo neste navegador.</p>';
  if(!sbUser)return '<p class="sub">Conectando à nuvem…</p>';
  const when=sbLastSync?' Última sincronização: '+new Date(sbLastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.':'';
  if(sbUser.email&&!sbUser.is_anonymous)return `<p class="sub"><span class="okc">✓</span> Conectado como <strong>${esc(sbUser.email)}</strong>. Seu progresso sincroniza com qualquer aparelho em que você entrar com esse e-mail.${when}</p>`;
  return `<p class="sub">Este aparelho usa uma conta anônima: o progresso fica salvo na nuvem, mas só este navegador acessa. Vincule um e-mail para usar em outros aparelhos sem perder nada do que já estudou.${when}</p>`;
}
function refreshAcct(){const b=$('#acctstatus');if(b)b.innerHTML=sbAccountStatusHTML();const f=$('#acctform');if(f)f.style.display=sbUser&&sbUser.email&&!sbUser.is_anonymous?'none':'';}
async function sbLinkEmail(email){
  const box=$('#acctmsg');if(!box)return;
  if(!sb||!sbUser){box.textContent='Sincronização indisponível agora. Tente novamente mais tarde.';return;}
  box.textContent='Enviando…';
  const redirect=location.origin+location.pathname;
  try{
    if(sbUser.is_anonymous){
      const {error}=await sb.auth.updateUser({email},{emailRedirectTo:redirect});
      if(error){
        if(/already|registrad|exist|taken|in use/i.test(error.message||'')){
          const {error:e2}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:redirect}});
          if(e2)throw e2;
          box.textContent='Esse e-mail já tem conta. Enviamos um link de acesso para '+email+'. Abra-o neste aparelho para entrar: o progresso daqui será somado ao da sua conta.';
        }else throw error;
      }else box.textContent='Enviamos um link de confirmação para '+email+'. Abra-o para vincular este progresso ao seu e-mail.';
    }else box.textContent='Este aparelho já está conectado a '+sbUser.email+'.';
  }catch(e){box.textContent='Não foi possível enviar: '+(e&&e.message||'erro desconhecido');}
}
function toast(m){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(()=>t.style.display='none',2200);}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const strip=s=>String(s).replace(/<[^>]+>/g,'');
const range=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
const pct=(a,b)=>b?Math.round(a/b*100):0;
const ICO={
  say:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  cards:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/></svg>',
  quiz:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.8-2.5 2.2-2.5 3.9M12 17.2v.1"/></svg>',
  book:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7"/></svg>',
  fire:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1.2 3.4-1 4.6-1 6.8a3 3 0 0 0 5.8.9c1.6 2 2.2 3.7 2.2 5.6A7 7 0 1 1 6.2 12c1.2 1.2 2.4 1.1 3 0 .9-1.7-.7-3.3.4-5C10.8 5.6 12 4.2 12 2z"/></svg>',
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  ok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
  trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v6a5 5 0 0 1-10 0zM17 4h3.5v2.5A4 4 0 0 1 17 10.4M7 4H3.5v2.5A4 4 0 0 0 7 10.4M10 14.5h4v3h-4zM7.5 21a4.5 4.5 0 0 1 9 0z"/></svg>',
  guide:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 5.5C5 4 8.5 4 12 6c3.5-2 7-2 9.5-.5V19c-2.5-1.5-6-1.5-9.5.5-3.5-2-7-2-9.5-.5z"/><path d="M12 6v13.5"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>'
};
/* mascote: balãozinho de fala */
function mascotSVG(c,mood){
  c=c||'#58CC02';
  const mouth=mood==='sad'?'<path d="M48 78q12-9 24 0" stroke="#2b2b2b" stroke-width="5" fill="none" stroke-linecap="round"/>':mood==='wow'?'<ellipse cx="60" cy="74" rx="8" ry="9" fill="#2b2b2b"/><ellipse cx="60" cy="78" rx="5" ry="4" fill="#ff6b81"/>':'<path d="M46 70q14 14 28 0" stroke="#2b2b2b" stroke-width="5" fill="#fff" stroke-linecap="round" stroke-linejoin="round"/>';
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 8c28 0 50 19 50 44s-22 44-50 44c-6 0-12-1-17-3L18 108l7-22C14 78 10 66 10 52 10 27 32 8 60 8z" fill="${c}"/><path d="M60 8c28 0 50 19 50 44 0 5-1 10-3 15-6-20-26-35-47-35S20 47 13 67c-2-5-3-10-3-15C10 27 32 8 60 8z" fill="#fff" opacity=".18"/><ellipse cx="44" cy="48" rx="13" ry="15" fill="#fff"/><ellipse cx="76" cy="48" rx="13" ry="15" fill="#fff"/><circle cx="47" cy="51" r="7" fill="#2b2b2b"/><circle cx="79" cy="51" r="7" fill="#2b2b2b"/><circle cx="49.5" cy="48" r="2.4" fill="#fff"/><circle cx="81.5" cy="48" r="2.4" fill="#fff"/>${mouth}<ellipse cx="31" cy="66" rx="6" ry="4" fill="#ff8fa3" opacity=".55"/><ellipse cx="89" cy="66" rx="6" ry="4" fill="#ff8fa3" opacity=".55"/></svg>`;
}
const lvStyle=L=>`--lc:${L.color};--lcd:${L.dark||L.color}`;
/* sons curtos (Web Audio) */
let AC=null;
function tone(kind){
  if(S.sound===false)return;
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const t=AC.currentTime;
    const seq=kind==='ok'?[[784,0,'sine'],[1047,.09,'sine']]:kind==='win'?[[523,0,'triangle'],[659,.1,'triangle'],[784,.2,'triangle'],[1047,.3,'triangle']]:[[233,0,'triangle'],[196,.13,'triangle']];
    seq.forEach(([f,d,type])=>{const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(.2,t+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d+.22);o.connect(g);g.connect(AC.destination);o.start(t+d);o.stop(t+d+.25);});
  }catch(e){}
}
function confetti(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const box=document.createElement('div');box.className='confetti';
  const cols=['#58CC02','#1CB0F6','#FF9600','#FFC800','#CE82FF','#FF4B4B'];
  for(let i=0;i<90;i++){const p=document.createElement('i');p.style.left=Math.random()*100+'%';p.style.background=cols[i%cols.length];p.style.setProperty('--dx',(Math.random()*200-100)+'px');p.style.setProperty('--r',(Math.random()*720-360)+'deg');p.style.animationDuration=(1.6+Math.random()*1.6)+'s';p.style.animationDelay=(Math.random()*.4)+'s';box.appendChild(p);}
  document.body.appendChild(box);setTimeout(()=>box.remove(),3800);
}

/* ---------- dados ---------- */
const LVS=window.LV||[];
const byLv={};
LVS.forEach((L,li)=>{
  byLv[L.id]=L;L.idx=li;
  L.mods.forEach((m,i)=>{m.lv=L;m.i=i;m.key=L.id+'-'+i;m.code=L.code+'-'+String(i+1).padStart(2,'0');m.units=range(m.u[0],m.u[1]);});
});
const ALLMODS=LVS.flatMap(L=>L.mods);
const uKey=(L,n)=>L.id+'-u'+n;
const lvUnitsDone=L=>L.units.reduce((a,_,i)=>a+(S.u[uKey(L,i+1)]?1:0),0);
const modUnitsDone=m=>m.units.filter(n=>S.u[uKey(m.lv,n)]).length;
const modPct=m=>pct(modUnitsDone(m),m.units.length);
const modDone=m=>!!S.m[m.key];
const totalUnits=()=>LVS.reduce((a,L)=>a+L.units.length,0);
const totalDone=()=>LVS.reduce((a,L)=>a+lvUnitsDone(L),0);
const unitPage=(L,n)=>L.pdf0+2*n;
const bookPages=n=>(2*n)+'–'+(2*n+1);

/* ---------- gamificacao ---------- */
const dayKey=(d=new Date())=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function addXP(n,msg){
  S.gam.xp=(S.gam.xp||0)+n;const k=dayKey(),before=S.gam.days[k]||0;S.gam.days[k]=before+n;save();
  if(before<goalXP()&&before+n>=goalXP()){toast('🎉 Meta diária cumprida! +'+n+' XP');setTimeout(()=>{tone('win');confetti();},150);}
  else if(msg)toast('+'+n+' XP · '+msg);
}
/* meta diária */
const GOALS=[{xp:10,n:'Leve',d:'cerca de 5 min por dia'},{xp:20,n:'Regular',d:'cerca de 10 min por dia'},{xp:30,n:'Puxada',d:'cerca de 15 min por dia'},{xp:50,n:'Intensa',d:'cerca de 25 min por dia'}];
const goalXP=()=>S.goal||30;
const goalName=()=>(GOALS.find(g=>g.xp===goalXP())||GOALS[2]).n;
function openGoal(){
  const w=modal('Meta diária','Escolha sua meta diária',`<div class="goal-pick"><span class="mascot bob">${mascotSVG('#FF9600')}</span><p class="sub" style="margin:0">Quanto XP você quer ganhar por dia? Dá para mudar quando quiser. Cumprir a meta mantém o ritmo; estudar qualquer coisa já conta para a ofensiva.</p></div>
    <div class="goal-opts">${GOALS.map(g=>`<button type="button" class="goal-opt${g.xp===goalXP()?' on':''}" data-goal="${g.xp}"><span class="goal-n">${g.n}</span><span class="goal-d">${g.d}</span><span class="goal-x">${g.xp} XP</span></button>`).join('')}</div>`);
  $$('.goal-opt',w).forEach(b=>b.onclick=()=>{S.goal=+b.dataset.goal;save();closeModal();updTop();toast('Meta diária: '+goalName()+' · '+S.goal+' XP por dia');});
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-goal-edit]');if(b){e.preventDefault();openGoal();}});
function streak(){
  let d=new Date(),n=0;
  if(!S.gam.days[dayKey(d)])d.setDate(d.getDate()-1);
  while(S.gam.days[dayKey(d)]){n++;d.setDate(d.getDate()-1);}
  return n;
}
const LV_NAMES=['Starter','Beginner','Elementary','Pre-intermediate','Intermediate','Upper-intermediate','Advanced','Proficient','Master'];
const XP_STEP=300;
const gLevel=()=>Math.floor((S.gam.xp||0)/XP_STEP)+1;
const gLevelName=l=>LV_NAMES[Math.min(l-1,LV_NAMES.length-1)];

/* ---------- PDFs (IndexedDB) ---------- */
const PDF_URL={};
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('ingles-pdfs',1);r.onupgradeneeded=()=>r.result.createObjectStore('pdf');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function idbOp(mode,fn){const db=await idb();return new Promise((res,rej)=>{const t=db.transaction('pdf',mode);const st=t.objectStore('pdf');const r=fn(st);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);});}
const idbGet=k=>idbOp('readonly',st=>st.get(k));
const idbPut=(k,v)=>idbOp('readwrite',st=>st.put(v,k));
const idbDel=k=>idbOp('readwrite',st=>st.delete(k));
async function loadPdfs(){for(const L of LVS){try{const b=await idbGet(L.id);if(b)PDF_URL[L.id]=URL.createObjectURL(b);}catch(e){}}}
const isLocal=()=>location.protocol==='file:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
function openPdf(lid,n){
  const L=byLv[lid];const page=n?unitPage(L,n):1;
  if(PDF_URL[lid]){window.open(PDF_URL[lid]+'#page='+page,'_blank');return;}
  if(isLocal()){window.open(encodeURI(L.file)+'#page='+page,'_blank');return;}
  toast('Carregue o PDF deste livro uma vez para abrir as páginas direto daqui');
  location.hash='#/livros';
}

/* ---------- preferencias ---------- */
function applyPrefs(){
  if(S.theme)document.documentElement.setAttribute('data-theme',S.theme);else document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.setProperty('--fs',S.fs+'px');
  document.body.classList.toggle('focus',!!S.focus);
  $('#focusbtn').setAttribute('aria-pressed',S.focus?'true':'false');
  $('#soundbtn').setAttribute('aria-pressed',S.sound===false?'false':'true');
  const dark=S.theme?S.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
  $('#themebtn').setAttribute('aria-pressed',dark?'true':'false');
}
$('#soundbtn').onclick=()=>{S.sound=S.sound===false;applyPrefs();save();if(S.sound)tone('ok');toast(S.sound?'Sons ativados':'Sons desativados');};
$('#xpchip').onclick=()=>openGam();
$('#lvchip').onclick=()=>openGam();
['#logomark','#logomark2'].forEach(s=>{const e=$(s);if(e)e.innerHTML=mascotSVG('#58CC02');});
$('#themebtn').onclick=()=>{const dark=S.theme?S.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;S.theme=dark?'light':'dark';applyPrefs();save();};
$('#fontbtn').onclick=()=>{S.fs=S.fs>=21?15:S.fs+2;applyPrefs();save();toast('Fonte: '+S.fs+'px');};
$('#focusbtn').onclick=()=>{S.focus=!S.focus;applyPrefs();save();toast(S.focus?'Modo foco ativado':'Modo foco desativado');};
$('#gamchip').onclick=openGam;

function updTop(){
  const s=streak();$('#gcstreak').textContent=s;$('#gamchip').classList.toggle('on',!!S.gam.days[dayKey()]);
  $('#gcxp').textContent=S.gam.xp||0;
  $('#gclv').textContent=gLevel();
  if(document.body.classList.contains('has-rail'))renderRail();
}
function buildMenus(){if(document.body.classList.contains('has-rail'))renderRail();}

/* ---------- trilho lateral direito ---------- */
function renderRail(){
  const r=$('#rail');if(!r)return;
  const DAILY_GOAL=goalXP(),today=S.gam.days[dayKey()]||0,gp=Math.min(100,Math.round(today/DAILY_GOAL*100));
  const rec=S.place?byLv[S.place.level]:null;
  r.innerHTML=`
  <section class="rcard"><h3>Meta diária <button type="button" class="linkbtn" data-goal-edit>Editar</button></h3><div class="goal"><span class="goal-ico">${gp>=100?mascotSVG('#FF9600','wow'):`<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="#FFC800"/></svg>`}</span><div class="goal-txt"><b>${gp>=100?'Meta cumprida!':'Ganhe '+DAILY_GOAL+' XP hoje'}</b><div class="pbar"><i style="width:${gp}%;--bc:var(--orange)"></i></div><span class="pbar-n">${today} / ${DAILY_GOAL} XP · meta ${goalName().toLowerCase()}</span></div></div></section>
  <section class="rcard"><h3>Seus níveis <a href="#/progresso">Ver tudo</a></h3>${LVS.map(L=>{const p=pct(lvUnitsDone(L),L.units.length);return `<a class="rlv" href="#/nivel/${L.id}" style="${lvStyle(L)}"><span class="rlv-dot">${L.code}</span><span class="rlv-txt">${esc(L.name)} · ${L.cefr}<div class="pbar"><i style="width:${p}%;--bc:${L.color}"></i></div></span><span class="rlv-n">${p}%</span></a>`;}).join('')}</section>
  <section class="rcard">${rec?`<h3>Nivelamento</h3><p>Seu teste indicou o nível <b>${esc(rec.name)}</b> (${rec.cefr}), com ${S.place.score}% de acertos.</p><a class="btn" href="#/nivelamento" style="width:100%">Refazer o teste</a>`:`<h3>Não sabe por onde começar?</h3><p>Faça o teste de nivelamento: 18 questões e a plataforma indica o seu nível.</p><a class="btn blue" href="#/nivelamento" style="width:100%">Fazer o teste</a>`}</section>
  <p class="rfoot">${totalDone()} de ${totalUnits()} unidades estudadas · ${Object.keys(S.m).filter(k=>S.m[k]).length} de ${ALLMODS.length} módulos</p>`;
}

/* ---------- componentes ---------- */
const sayBtn=t=>`<button class="say" type="button" data-say="${esc(strip(t))}" aria-label="Ouvir pronúncia" title="Ouvir">${ICO.say}</button>`;
function speak(t){
  if(!('speechSynthesis' in window)){toast('Seu navegador não suporta leitura em voz alta');return;}
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(t.replace(/___/g,'blank'));u.lang='en-US';u.rate=.92;
  const v=speechSynthesis.getVoices().find(v=>/^en(-|_)(US|GB)/i.test(v.lang));if(v)u.voice=v;
  speechSynthesis.speak(u);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b){e.preventDefault();e.stopPropagation();speak(b.dataset.say);}});
function ring(p,col){const r=29,c=2*Math.PI*r;return `<div class="ring"><svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="${r}" fill="none" stroke="var(--soft)" stroke-width="6"/><circle cx="35" cy="35" r="${r}" fill="none" stroke="${col||'var(--accent)'}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-p/100)}"/></svg><div class="ring-txt"><b>${p}%</b><span>FEITO</span></div></div>`;}
const barH=(p,col)=>`<div class="bar"><i style="width:${p}%;${col?'--bc:'+col:''}"></i></div>`;
function nextModule(){
  if(S.last){const [lid,i]=S.last.split('-');const L=byLv[lid];if(L&&L.mods[+i]&&!modDone(L.mods[+i]))return L.mods[+i];}
  const start=S.place?byLv[S.place.level].idx:0;
  for(const L of LVS.slice(start).concat(LVS.slice(0,start)))for(const m of L.mods)if(!modDone(m))return m;
  return ALLMODS[0];
}

/* ---------- roteamento ---------- */
function route(){
  const h=decodeURIComponent(location.hash.replace(/^#\/?/,''))||'inicio';const p=h.split('/');
  const nav=p[0]==='modulo'||p[0]==='nivel'?'inicio':p[0];
  $$('.nav a').forEach(a=>a.classList.toggle('on',a.dataset.nav===nav||(!['modulos','nivelamento','busca','progresso','livros','inicio'].includes(nav)&&a.dataset.nav==='inicio')));
  const rail=['inicio','modulos'].includes(p[0])||!['modulo','nivel','nivelamento','busca','progresso','livros'].includes(p[0]);
  document.body.classList.toggle('has-rail',rail);
  closeModal();
  if(p[0]==='nivel'&&byLv[p[1]])renderLevel(byLv[p[1]]);
  else if(p[0]==='modulo'&&byLv[p[1]]&&byLv[p[1]].mods[+p[2]])renderMod(byLv[p[1]].mods[+p[2]]);
  else if(p[0]==='modulos')renderModules(p[1]);
  else if(p[0]==='nivelamento')renderPlace();
  else if(p[0]==='busca')renderSearch(p.slice(1).join('/'));
  else if(p[0]==='progresso')renderProg();
  else if(p[0]==='livros')renderBooks();
  else renderHome();
  if(rail)renderRail();
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',route);

/* ---------- inicio ---------- */
function renderHome(){
  document.title='Inglês em Formação';
  const nm=nextModule();
  const started=totalDone()>0||Object.keys(S.m).length>0;
  const X=[0,52,80,52,0,-52,-80,-52];
  V.innerHTML=LVS.map((L,li)=>{
    let k=0;
    const nodes=L.mods.map(m=>{
      const p=modPct(m),done=modDone(m)||p===100,cur=m===nm;
      const cls=cur?'cur':(done?'done':'');
      const x=X[(k++)%X.length];
      return `<div class="pwrap${cur?' is-cur':''}" style="--x:${x}px">
        <span class="pnode-h">${cur?`<span class="pbubble">${started?'Continuar':'Começar'}</span><span class="pring" style="--p:${Math.max(p,4)}"></span>`:''}<a class="pnode ${cls}" href="#/modulo/${L.id}/${m.i}" aria-label="${esc(m.code+' · '+m.t)}${done?' (concluído)':cur?' (atual)':''}">${done&&!cur?ICO.check:ICO.star}</a></span>
        <span class="plabel"><b>${m.code}</b>${esc(m.t)}</span></div>`;
    }).join('');
    const lvDone=L.mods.every(m=>modDone(m)||modPct(m)===100);
    const trophy=`<div class="pwrap" style="--x:${X[k%X.length]}px"><a class="pnode trophy${lvDone?' done':''}" href="#/nivel/${L.id}" aria-label="Visão geral do nível ${esc(L.name)}">${ICO.trophy}</a><span class="plabel"><b>Fim do nível</b>${esc(L.name)} ${L.cefr}</span></div>`;
    const mas=[`<span class="path-mascot ${li%2?'l':'r'}" style="--my:150px">${mascotSVG(L.color,li===2?'wow':'')}</span>`,`<span class="path-mascot ${li%2?'r':'l'}" style="--my:${Math.round(L.mods.length*0.55)*130}px">${mascotSVG(L.color)}</span>`].join('');
    return `<section style="${lvStyle(L)}">
      <header class="lv-banner"><div><small>Nível ${li+1} · ${L.cefr}</small><h2>${esc(L.name)}</h2><p>${esc(L.book)} · ${esc(L.author)}</p></div><a class="lv-guide" href="#/nivel/${L.id}">${ICO.guide}<span>Guia</span></a></header>
      <div class="path">${mas}${nodes}${trophy}</div></section>`;
  }).join('')+`<p class="path-end"><a class="btn" href="#/modulos">Ver todos os ${ALLMODS.length} módulos</a></p>`;
}

/* ---------- modulos ---------- */
function renderModules(f){
  document.title='Módulos · Inglês em Formação';
  const sel=byLv[f]?[byLv[f]]:LVS;
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / módulos</p><h1>Módulos</h1>
  <p class="sub">Todos os ${ALLMODS.length} módulos da trilha, em ordem de dificuldade. Cada um cobre um grupo de unidades do livro do nível.</p>
  <div class="filters" role="group" aria-label="Filtrar por nível"><a class="btn${!byLv[f]?' sel':''}" href="#/modulos">Todos</a>${LVS.map(L=>`<a class="btn${f===L.id?' sel':''}" href="#/modulos/${L.id}"><span class="diff-mark d${L.d}">${L.cefr}</span>${esc(L.name)}</a>`).join('')}</div>
  ${sel.map(L=>{const done=L.mods.filter(modDone).length;return `<div class="home-sec"><span class="diff-mark d${L.d}">${L.name}</span>${esc(L.book)}<span style="margin-left:auto;font-family:var(--f-mono);font-size:.78rem;font-weight:400;color:var(--muted)">${done}/${L.mods.length} concluídos</span></div>
    <div class="modgrid">${L.mods.map(m=>{const p=modPct(m);return `<a class="modp" style="${lvStyle(L)}" href="#/modulo/${L.id}/${m.i}"><div class="modp-head"><span class="modp-badge" style="background:${L.color}">${m.code}</span><span class="modp-name">${esc(m.t)}</span><span class="modp-pct">${modDone(m)?'✓':p+'%'}</span></div>${barH(modDone(m)?100:p,L.color)}<div class="modp-meta">Unidades ${m.u[0]}–${m.u[1]}</div></a>`;}).join('')}</div>`;}).join('')}

  <div class="call k-dica" style="margin-top:2.4rem"><div class="lab">Como estudar</div>
    <ul><li>Comece pelo <a href="#/nivelamento">teste de nivelamento</a> se não souber por qual nível começar.</li>
    <li>Em cada módulo, leia a explicação, ouça os exemplos e faça os exercícios. Depois estude as unidades no livro e marque cada uma como estudada.</li>
    <li>Feche o módulo com o quiz e revise com os flashcards nos dias seguintes. Estudar um pouco todo dia mantém a ofensiva acesa.</li></ul></div>`;
}

/* ---------- nivel ---------- */
function renderLevel(L){
  document.title=L.name+' · Inglês em Formação';
  const d=lvUnitsDone(L),p=pct(d,L.units.length);
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / nível ${esc(L.name.toLowerCase())}</p>
  <section class="sheet"><div class="course-head"><div class="hero" style="flex:1;min-width:260px"><div class="acell" style="--cc:${L.color}"><small>${L.cefr}</small>${L.code}</div><div>
    <h1>${esc(L.name)}</h1><p class="sub" style="margin:.3rem 0 0">${esc(L.book)} — ${esc(L.author)}${L.ed?' · '+esc(L.ed):''}</p>
    <div class="meta"><span class="diff-mark d${L.d}">${L.cefr}</span><span class="tag">${L.mods.length} módulos</span><span class="tag">${L.units.length} unidades</span><span class="tag">${d} estudadas</span></div>
    <p style="margin:.4rem 0 .8rem">${L.desc}</p>
    <div class="acts"><button class="btn" type="button" data-pdf="${L.id}">${ICO.book}Abrir livro (PDF)</button><a class="btn primary" href="#/modulo/${L.id}/${(L.mods.find(m=>!modDone(m))||L.mods[0]).i}">Continuar neste nível →</a></div>
  </div></div>${ring(p,L.color)}</div></section>
  <h2 class="sec"><span class="hn2">${L.code}</span><span>Módulos</span></h2>
  <div class="lesson-list">${L.mods.map(m=>{const mp=modPct(m);return `<a class="lesson${modDone(m)?' done':''}" style="${lvStyle(L)}" href="#/modulo/${L.id}/${m.i}"><span class="lchk"></span><span class="lnum">${m.code}</span><span class="ltitle">${esc(m.t)}<small>Unidades ${m.u[0]}–${m.u[1]} · ${modUnitsDone(m)}/${m.units.length} estudadas${S.qz[m.key]!=null?' · quiz '+S.qz[m.key]+'%':''}</small></span><span class="lbar">${barH(mp,L.color)}</span></a>`;}).join('')}</div>`;
  bindPdf();
}
function bindPdf(){$$('[data-pdf]').forEach(b=>b.onclick=()=>openPdf(b.dataset.pdf,b.dataset.unit?+b.dataset.unit:0));}

/* ---------- modulo ---------- */
function renderMod(m){
  const L=m.lv;S.last=m.key;save();
  document.title=m.code+' '+m.t+' · Inglês em Formação';
  const prev=L.mods[m.i-1]||(LVS[L.idx-1]&&LVS[L.idx-1].mods.slice(-1)[0]);
  const next=L.mods[m.i+1]||(LVS[L.idx+1]&&LVS[L.idx+1].mods[0]);
  const drill=m.drill.map((d,k)=>{const id=m.key+'-d'+k;const parts=d[0].split('___');const w=Math.max(6,Math.max(...d[1].split('|').map(s=>s.length))+2);
    return `<li class="dr${S.dr[id]?' ok':''}" data-id="${id}" data-a="${esc(d[1])}">${parts[0]}<input type="text" aria-label="Resposta da questão ${k+1}" value="${esc(S.da[id]||'')}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:${w}ch">${parts.slice(1).join('___')}<span class="drfb">${S.dr[id]?'✓':''}</span></li>`;}).join('');
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / <a href="#/nivel/${L.id}">${esc(L.name.toLowerCase())}</a> / ${m.code.toLowerCase()}</p>
  <div class="lesson-page"><article class="lp-main">
    <div class="lp-eyebrow"><span class="diff-mark d${L.d}">${esc(L.name)} · ${L.cefr}</span>${m.code} · ${esc(L.book)} · unidades ${m.u[0]}–${m.u[1]}</div>
    <h1>${esc(m.t)}</h1>
    <div class="study-tools"><span class="stt">Ferramentas</span>
      <button class="stbtn" type="button" id="bquiz">${ICO.quiz}Quiz (${m.quiz.length})</button>
      <button class="stbtn ghost" type="button" id="bcards">${ICO.cards}Flashcards (${m.cards.length})</button>
      <button class="stbtn ghost" type="button" data-pdf="${L.id}" data-unit="${m.u[0]}">${ICO.book}Abrir no livro</button>
    </div>
    <div class="call k-obj"><span class="mascot bob">${mascotSVG(L.color)}</span><div class="lab">Neste módulo</div><p>${m.intro}</p></div>

    <h2 class="sec"><span class="hn2">01</span><span>Explicação</span></h2>
    ${m.pts.map((p,i)=>`<div class="pt-card"><h3><span class="hn2">${String(i+1).padStart(2,'0')}</span>${p[0]}</h3>${p[1]}</div>`).join('')}

    <h2 class="sec"><span class="hn2">02</span><span>Exemplos</span></h2>
    <div class="tw"><table><thead><tr><th>Inglês</th><th>Português</th></tr></thead><tbody>${m.ex.map(e=>`<tr><td class="en"><div class="en-row">${sayBtn(e[0])}<span>${e[0]}</span></div></td><td class="pt">${e[1]}</td></tr>`).join('')}</tbody></table></div>
    ${m.trap&&m.trap.length?`<div class="call k-atencao"><div class="lab">Erros comuns</div><ul>${m.trap.map(t=>`<li>${t}</li>`).join('')}</ul></div>`:''}

    <h2 class="sec"><span class="hn2">03</span><span>Pratique</span></h2>
    <p class="sub">Complete as lacunas e clique em <strong>Corrigir</strong>. Cada acerto novo vale 2 XP.</p>
    <ol class="drill" id="drill">${drill}</ol>
    <div class="drill-acts"><button class="btn primary" type="button" id="dcheck">Corrigir</button><button class="btn" type="button" id="dshow">Mostrar respostas</button><button class="btn" type="button" id="dclear">Limpar</button><span class="drscore" id="dscore"></span></div>

    <h2 class="sec"><span class="hn2">04</span><span>Estude no livro</span></h2>
    <p class="sub">Leia a explicação (página da esquerda) e faça os exercícios (página da direita) de cada unidade. Depois marque como estudada (+10 XP).</p>
    <div class="units">${m.units.map(n=>{const k=uKey(L,n);return `<div class="unit${S.u[k]?' done':''}"><input type="checkbox" id="u-${k}" data-u="${k}"${S.u[k]?' checked':''}><label for="u-${k}"><small>Unidade ${n} · pp. ${bookPages(n)}</small>${esc(L.units[n-1])}</label><button class="pdf" type="button" data-pdf="${L.id}" data-unit="${n}" title="Abrir a unidade ${n} no PDF">PDF p.${unitPage(L,n)} ↗</button></div>`;}).join('')}</div>

    <h2 class="sec"><span class="hn2">05</span><span>Minhas anotações</span></h2>
    <textarea id="notes" placeholder="Anote regras, frases que você criou, dúvidas para revisar…">${esc(S.notes[m.key]||'')}</textarea>
    <span class="saved" id="nsaved"></span>
    <div><label class="secchk"><input type="checkbox" id="mdone"${modDone(m)?' checked':''}>Concluí este módulo</label></div>

    <nav class="lp-nav">${prev?`<a class="navbtn" href="#/modulo/${prev.lv.id}/${prev.i}">← ${prev.code}</a>`:'<span></span>'}${next?`<a class="navbtn next" href="#/modulo/${next.lv.id}/${next.i}">${next.code} · ${esc(next.t)} →</a>`:''}</nav>
  </article>
  <aside class="lp-side"><div class="side-block"><b>${esc(L.name)} · ${L.cefr}</b>${barH(pct(lvUnitsDone(L),L.units.length),L.color)}
    <div class="mini-list" style="margin-top:.9rem">${L.mods.map(x=>`<a class="mini-item${x===m?' active':''}${modDone(x)?' done':''}" href="#/modulo/${L.id}/${x.i}"><span class="mini-dot"></span>${x.code} · ${esc(x.t)}</a>`).join('')}</div></div>
    <div class="side-block"><b>Outros níveis</b><div class="mini-list">${LVS.filter(x=>x!==L).map(x=>`<a class="mini-item" href="#/nivel/${x.id}"><span class="mini-dot" style="background:${x.color}"></span>${esc(x.name)} · ${x.cefr}</a>`).join('')}</div></div>
  </aside></div>`;
  bindPdf();
  $('#bquiz').onclick=()=>openQuiz(m.code+' · '+m.t,m.quiz.map(q=>({q:q[0],o:q[1],a:q[2],e:q[3]})),sc=>{const old=S.qz[m.key];if(old==null||sc>old)S.qz[m.key]=sc;addXP(Math.round(sc/10)+5,'quiz concluído');});
  $('#bcards').onclick=()=>openCards(m.code+' · '+m.t,m.cards);
  $$('.unit input').forEach(c=>c.onchange=()=>{const k=c.dataset.u;if(c.checked){S.u[k]=Date.now();addXP(10,'unidade estudada');}else{delete S.u[k];save();}c.closest('.unit').classList.toggle('done',c.checked);buildMenus();});
  $('#mdone').onchange=e=>{if(e.target.checked){S.m[m.key]=Date.now();addXP(30,'módulo concluído');tone('win');confetti();}else{delete S.m[m.key];save();}buildMenus();};
  let nt;$('#notes').oninput=e=>{S.notes[m.key]=e.target.value;clearTimeout(nt);nt=setTimeout(()=>{save();$('#nsaved').textContent='Salvo '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});},400);};
  const norm=s=>String(s).toLowerCase().replace(/[’‘`´]/g,"'").replace(/\s+/g,' ').replace(/[.!?]+$/,'').trim();
  $$('#drill input').forEach(inp=>{inp.oninput=()=>{const li=inp.closest('.dr');S.da[li.dataset.id]=inp.value;li.classList.remove('bad');save();};inp.onkeydown=e=>{if(e.key==='Enter')$('#dcheck').click();};});
  $('#dcheck').onclick=()=>{let ok=0,gain=0;const items=$$('#drill .dr');items.forEach(li=>{const v=norm(li.querySelector('input').value);const ans=li.dataset.a.split('|').map(norm);const good=v&&ans.includes(v);li.classList.toggle('ok',good);li.classList.toggle('bad',!good);li.querySelector('.drfb').textContent=good?'✓':(v?'✗':'');if(good){ok++;if(!S.dr[li.dataset.id]){S.dr[li.dataset.id]=1;gain+=2;}}});
    $('#dscore').textContent=ok+'/'+items.length+' corretas';tone(ok===items.length?'win':ok?'ok':'bad');if(ok===items.length)confetti();if(gain)addXP(gain,'exercícios');else save();};
  $('#dshow').onclick=()=>$$('#drill .dr').forEach(li=>{if(!li.classList.contains('ok'))li.querySelector('.drfb').textContent='→ '+li.dataset.a.split('|')[0];});
  $('#dclear').onclick=()=>$$('#drill .dr').forEach(li=>{li.querySelector('input').value='';delete S.da[li.dataset.id];li.classList.remove('ok','bad');li.querySelector('.drfb').textContent='';save();});
}

/* ---------- modal ---------- */
function modal(kind,title,body,foot){
  closeModal();
  const w=document.createElement('div');w.className='smodal';w.id='smodal';w.setAttribute('role','dialog');w.setAttribute('aria-modal','true');w.setAttribute('aria-label',title);
  w.innerHTML=`<div class="smodal-box"><div class="smodal-head"><span class="smk">${kind}</span><p class="smt">${esc(title)}</p><button class="smx" type="button" aria-label="Fechar">✕</button></div><div class="smodal-body"></div><div class="smodal-foot"></div></div>`;
  document.body.appendChild(w);
  $('.smodal-body',w).innerHTML=body;$('.smodal-foot',w).innerHTML=foot||'';
  if(!foot)$('.smodal-foot',w).remove();
  $('.smx',w).onclick=closeModal;w.onclick=e=>{if(e.target===w)closeModal();};
  document.body.style.overflow='hidden';
  return w;
}
function closeModal(){const w=$('#smodal');if(w){w.remove();document.body.style.overflow='';}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

function openCards(title,cards){
  let deck=cards.slice(),i=0;
  const w=modal('Flashcards',title,`<div class="fc-wrap"><div class="fc-progress"><i class="fc-bar"></i></div><div class="fc-deck"><div class="flashcard" tabindex="0" role="button" aria-label="Virar cartão"><div class="fc-inner"><div class="fc-face fc-front"><span class="fc-chip">Frente</span><div class="fc-q"></div><span class="fc-hint">clique ou espaço para virar</span></div><div class="fc-face fc-back"><span class="fc-chip">Verso</span><div class="fc-a"></div></div></div></div></div><span class="fc-count"></span></div>`,
    `<button class="btn" type="button" data-a="prev">← Anterior</button><button class="btn" type="button" data-a="say">${ICO.say}Ouvir</button><button class="btn" type="button" data-a="shuf">Embaralhar</button><button class="btn primary" type="button" data-a="next" style="margin-left:auto">Próximo →</button>`);
  const fc=$('.flashcard',w);
  const show=()=>{fc.classList.remove('flipped');$('.fc-q',w).innerHTML=deck[i][0];$('.fc-a',w).innerHTML=deck[i][1];$('.fc-count',w).textContent=(i+1)+' / '+deck.length;$('.fc-bar',w).style.width=((i+1)/deck.length*100)+'%';};
  fc.onclick=()=>fc.classList.toggle('flipped');
  fc.onkeydown=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();fc.classList.toggle('flipped');}};
  $('.smodal-foot',w).onclick=e=>{const a=e.target.closest('[data-a]');if(!a)return;const k=a.dataset.a;
    if(k==='next'){if(i<deck.length-1){i++;show();}else{addXP(5,'baralho revisado');closeModal();}}
    else if(k==='prev'){if(i>0){i--;show();}}
    else if(k==='shuf'){deck.sort(()=>Math.random()-.5);i=0;show();}
    else if(k==='say')speak(strip(fc.classList.contains('flipped')?deck[i][1]:deck[i][0]));};
  show();fc.focus();
}

function openQuiz(title,qs,onDone,opts={}){
  let i=0,score=0;const res=[];
  const w=modal(opts.kind||'Quiz',title,'<div class="qz-wrap"></div>');
  const box=$('.qz-wrap',w);
  const keys='ABCD';
  function show(){
    const q=qs[i];
    box.innerHTML=`<div class="qz-count">Questão ${i+1} de ${qs.length}${q.tag?` · <span class="diff-mark d${q.d}">${q.tag}</span>`:''}<span class="qz-score" style="margin-left:auto">${score} acerto${score===1?'':'s'}</span></div><div class="fc-progress" style="max-width:none;margin-bottom:1rem"><i class="fc-bar" style="width:${i/qs.length*100}%"></i></div>
    <div class="qz-stem">${q.q}</div><div class="qz-opts">${q.o.map((o,k)=>`<button class="qz-opt" type="button" data-k="${k}"><span class="qz-key">${keys[k]}</span><span class="qz-txt">${o}</span></button>`).join('')}</div><div class="qz-after"></div>`;
    $$('.qz-opt',box).forEach(b=>b.onclick=()=>{
      const k=+b.dataset.k,good=k===q.a;if(good)score++;res.push(good);
      $$('.qz-opt',box).forEach(x=>{x.disabled=true;const kk=+x.dataset.k;if(kk===q.a)x.classList.add('ok');else if(kk===k)x.classList.add('bad');});
      tone(good?'ok':'bad');
      const PRAISE=['Muito bem!','Excelente!','Isso aí!','Mandou bem!','Perfeito!'];
      $('.qz-after',box).innerHTML=`<div class="qz-fb ${good?'ok':'bad'}"><span class="qz-fb-ico">${good?ICO.ok:ICO.x}</span><div class="qz-fb-txt"><b>${good?PRAISE[Math.floor(Math.random()*PRAISE.length)]:'Resposta correta:'}</b>${good?'':`<span style="display:block;font-weight:900">${q.o[q.a]}</span>`}${q.e?`<span>${q.e}</span>`:''}</div><button class="btn primary" type="button" id="qznext">${i<qs.length-1?'Continuar':'Ver resultado'}</button></div>`;
      $('#qznext').onclick=()=>{i++;i<qs.length?show():end();};$('#qznext').focus();
      $('.qz-fb',box).scrollIntoView({block:'nearest',behavior:'smooth'});
    });
  }
  function end(){
    const p=pct(score,qs.length);
    const extra=opts.result?opts.result(res,p):'';
    if(p>=80){tone('win');confetti();}
    box.innerHTML=`<div class="qz-result"><span class="mascot bob">${mascotSVG(p>=60?'#58CC02':'#FF9600',p>=80?'wow':p>=50?'':'sad')}</span><b>${p>=80?'Lição dominada!':p>=50?'Bom trabalho!':'Continue praticando!'}</b>
      <div class="qz-boxes"><div class="qz-box" style="--bx:var(--green)"><small>Acertos</small><b>${score}/${qs.length}</b></div><div class="qz-box" style="--bx:${p>=70?'var(--blue)':'var(--orange)'}"><small>Precisão</small><b>${p}%</b></div></div>
      <span>${extra||(p>=80?'Você domina este conteúdo.':p>=50?'Revise os pontos que errou e tente de novo.':'Vale reler a explicação e as unidades do livro antes de tentar outra vez.')}</span><div class="acts qz-ractions"><button class="btn" type="button" id="qzagain">Refazer</button><button class="btn primary" type="button" id="qzclose">Continuar</button></div></div>`;
    $('#qzagain').onclick=()=>{i=0;score=0;res.length=0;show();};$('#qzclose').onclick=closeModal;
    if(onDone)onDone(p,res);
  }
  show();
}

/* ---------- ofensiva / XP ---------- */
function openGam(){
  const st=streak(),xp=S.gam.xp||0,lv=gLevel(),into=xp%XP_STEP;
  const days=[];const d=new Date();d.setDate(d.getDate()-6);
  for(let k=0;k<7;k++){const key=dayKey(d);days.push(`<div class="gm-day${S.gam.days[key]?' done':''}${k===6?' today':''}"><span class="gm-day-l">${d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</span><span>${S.gam.days[key]?'🔥':'·'}</span></div>`);d.setDate(d.getDate()+1);}
  modal('Progresso','Ofensiva e XP',`<div class="gm-hero"><div class="gm-flame${st?' on':''}">${ICO.fire}<span class="gm-flame-n">${st}</span></div><div><b>${st} dia${st===1?'':'s'} seguido${st===1?'':'s'}</b><span>${S.gam.days[dayKey()]?'Você já estudou hoje. Ofensiva garantida!':'Estude algo hoje para manter a ofensiva.'}</span></div></div>
  <div class="gm-level"><div class="gm-lv-top"><span class="gm-lv-badge">Nv ${lv}</span><div><b>${gLevelName(lv)}</b><span>${xp} XP no total · faltam ${XP_STEP-into} XP para o próximo nível</span></div></div><div class="gm-bar"><i style="width:${into/XP_STEP*100}%"></i></div></div>
  <div class="gm-level"><div class="gm-lv-top"><span class="gm-lv-badge" style="background:var(--orange);box-shadow:0 3px 0 var(--orange-d)">${ICO.bolt.replace('<svg','<svg width="18" height="18" fill="#fff"')}</span><div><b>Meta diária: ${goalName()} · ${goalXP()} XP</b><span>Hoje: ${Math.min(S.gam.days[dayKey()]||0,9999)} XP${(S.gam.days[dayKey()]||0)>=goalXP()?' · cumprida! 🎉':''}</span></div><button type="button" class="btn" data-goal-edit style="margin-left:auto;min-height:40px">Alterar</button></div><div class="gm-bar"><i style="width:${Math.min(100,(S.gam.days[dayKey()]||0)/goalXP()*100)}%;background:var(--orange)"></i></div></div>
  <p class="gm-sub">Últimos 7 dias</p><div class="gm-week">${days.join('')}</div>
  <p class="gm-legend">Como ganhar XP: +2 por exercício acertado (primeira vez), +10 por unidade estudada, +5 a +15 por quiz, +5 por baralho de flashcards e +30 por módulo concluído.</p>`);
}

/* ---------- nivelamento ---------- */
function renderPlace(){
  document.title='Teste de nivelamento · Inglês em Formação';
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / nivelamento</p>
  <section class="sheet"><div class="hero"><div class="acell ac"><small>teste</small>?</div><div><h1>Teste de nivelamento</h1>
  <p class="sub" style="margin-top:.4rem">São 18 questões sorteadas: 6 do nível Inicial, 6 do Intermediário e 6 do Avançado. No fim, a plataforma indica por qual nível começar. Leva uns 10 minutos.</p>
  <div class="acts"><button class="btn primary" type="button" id="pstart">Começar o teste</button></div>
  ${S.place?`<p class="sub" style="margin-top:1rem">Último resultado (${new Date(S.place.date).toLocaleDateString('pt-BR')}): <strong>${esc(byLv[S.place.level].name)}</strong> · ${S.place.score}% de acertos.</p>`:''}
  </div></div></section>
  <div class="call k-dica"><div class="lab">Como funciona a recomendação</div><p>Se você acertar pelo menos 4 de 6 questões de um nível, ele conta como dominado. A recomendação é o primeiro nível que você ainda não domina. Você pode estudar qualquer nível quando quiser.</p></div>`;
  $('#pstart').onclick=()=>{
    const qs=[];
    LVS.forEach(L=>{const pool=L.mods.flatMap(m=>m.quiz.map(q=>({q:q[0],o:q[1],a:q[2],e:q[3],tag:L.name,d:L.d,lv:L.id})));pool.sort(()=>Math.random()-.5);qs.push(...pool.slice(0,6));});
    openQuiz('Teste de nivelamento',qs,null,{kind:'Nivelamento',result:(res,p)=>{
      const per=LVS.map((L,li)=>res.slice(li*6,li*6+6).filter(Boolean).length);
      let rec=LVS.length-1;for(let k=0;k<LVS.length;k++){if(per[k]<4){rec=k;break;}}
      const L=LVS[rec];S.place={level:L.id,score:p,date:Date.now(),per};addXP(10,'nivelamento feito');
      setTimeout(()=>{if(!$('#smodal'))route();},0);
      return `Acertos por nível: ${LVS.map((x,k)=>x.name+' '+per[k]+'/6').join(' · ')}.<br><br>Recomendação: comece pelo nível <strong>${esc(L.name)}</strong> (${L.cefr}), com o livro <em>${esc(L.book)}</em>. <a href="#/nivel/${L.id}" onclick="closeModal()">Ir para o nível →</a>`;
    }});
  };
}

/* ---------- busca ---------- */
function renderSearch(q){
  document.title='Buscar · Inglês em Formação';
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / busca</p><h1>Buscar</h1>
  <p class="sub">Procure por tema (ex.: <em>present perfect</em>, <em>preposições</em>, <em>phrasal verbs</em>) em módulos e unidades dos três livros.</p>
  <input type="search" id="sq" placeholder="Digite pelo menos 2 letras…" value="${esc(q)}" style="width:100%;max-width:560px" aria-label="Buscar"><div id="sres" style="margin-top:1rem"></div>`;
  const inp=$('#sq');
  const run=()=>{
    const t=inp.value.trim().toLowerCase();const out=$('#sres');
    if(t.length<2){out.innerHTML='';return;}
    const nt=t.normalize('NFD').replace(/[̀-ͯ]/g,'');
    const has=s=>strip(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').includes(nt);
    const hl=s=>esc(strip(s)).replace(new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark class="q">$1</mark>');
    const r=[];
    ALLMODS.forEach(m=>{const txt=[m.t,m.intro,...m.pts.flat(),...m.ex.flat()].join(' ');if(has(txt))r.push(`<div class="res"><a href="#/modulo/${m.lv.id}/${m.i}">${m.code} · ${hl(m.t)}</a><span class="kind">módulo</span> <span class="diff-mark d${m.lv.d}">${m.lv.name}</span><p>${hl(strip(m.intro)).slice(0,400)}</p></div>`);});
    LVS.forEach(L=>L.units.forEach((u,i)=>{if(has(u)){const m=L.mods.find(x=>i+1>=x.u[0]&&i+1<=x.u[1]);r.push(`<div class="res"><a href="#/modulo/${L.id}/${m.i}">Unidade ${i+1} · ${hl(u)}</a><span class="kind">unidade</span> <span class="diff-mark d${L.d}">${L.name}</span><p>${esc(L.book)} · pp. ${bookPages(i+1)} · módulo ${m.code}</p></div>`);}}));
    out.innerHTML=r.length?`<p class="sub">${r.length} resultado${r.length===1?'':'s'}</p>`+r.slice(0,80).join(''):'<p class="sub">Nada encontrado.</p>';
  };
  let tm;inp.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{history.replaceState(null,'','#/busca/'+encodeURIComponent(inp.value));run();},150);};
  run();inp.focus();
}

/* ---------- progresso ---------- */
function renderProg(){
  document.title='Progresso · Inglês em Formação';
  const drOk=Object.keys(S.dr).length,drTot=ALLMODS.reduce((a,m)=>a+m.drill.length,0);
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / progresso</p><h1>Meu progresso</h1>
  <div class="grid">
    <div class="stat"><b>${pct(totalDone(),totalUnits())}%</b>da trilha completa</div>
    <div class="stat" style="--sc:var(--good)"><b>${drOk}</b>de ${drTot} exercícios acertados</div>
    <div class="stat" style="--sc:var(--orange)"><b>${streak()}</b>dias de ofensiva</div>
    <div class="stat" style="--sc:var(--ref-p)"><b>${S.gam.xp||0}</b>XP · Nv ${gLevel()}</div>
  </div>
  ${LVS.map(L=>`<h2 class="sec"><span class="diff-mark d${L.d}">${L.cefr}</span><span>${esc(L.name)}</span><span style="margin-left:auto;font-family:var(--f-mono);font-size:.8rem;color:var(--muted)">${lvUnitsDone(L)}/${L.units.length} unidades</span></h2>
    ${L.mods.map(m=>`<div class="modrow"><a href="#/modulo/${L.id}/${m.i}">${modDone(m)?'✓ ':''}${m.code} · ${esc(m.t)}${S.qz[m.key]!=null?` <span class="tag">quiz ${S.qz[m.key]}%</span>`:''}</a>${barH(modPct(m),L.color)}<span class="n">${modPct(m)}%</span></div>`).join('')}`).join('')}
  <h2 class="sec"><span>Sincronização na nuvem</span></h2>
  <div id="acctstatus">${sbAccountStatusHTML()}</div>
  <form id="acctform" class="acts" style="margin-top:.4rem${sbUser&&sbUser.email&&!sbUser.is_anonymous?';display:none':''}"><input type="email" id="acctemail" required placeholder="seu@email.com" aria-label="E-mail" style="flex:1 1 240px;min-width:0"><button class="btn primary" type="submit">Vincular e-mail</button></form>
  <p class="sub" id="acctmsg" role="status" style="margin-top:.6rem"></p>
  <div class="acts"><button class="btn" type="button" id="bsync">Sincronizar agora</button></div>
  <h2 class="sec"><span>Backup</span></h2>
  <p class="sub">Exporte um arquivo para guardar uma cópia do seu progresso ou levá-lo para outro aparelho.</p>
  <div class="acts"><button class="btn" type="button" id="bexp">Exportar progresso</button><label class="btn filebtn">Importar progresso<input type="file" id="bimp" accept="application/json"></label><button class="btn danger" type="button" id="breset">Apagar tudo</button></div>`;
  $('#acctform').onsubmit=e=>{e.preventDefault();sbLinkEmail($('#acctemail').value.trim());};
  $('#bsync').onclick=async()=>{if(!sb||!sbUser){toast('Nuvem indisponível agora');return;}$('#acctmsg').textContent='Sincronizando…';await sbPull();$('#acctmsg').textContent='';toast('Sincronizado');};
  $('#bexp').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));a.download='ingles-progresso-'+dayKey()+'.json';a.click();};
  $('#bimp').onchange=e=>{const f=e.target.files[0];if(!f)return;f.text().then(t=>{try{const o=JSON.parse(t);if(typeof o!=='object'||!o.u)throw 0;S=Object.assign(S,o);save();applyPrefs();buildMenus();route();toast('Progresso importado');}catch(err){toast('Arquivo inválido');}});};
  $('#breset').onclick=()=>{if(confirm('Apagar todo o progresso, anotações e XP deste navegador?')){S={u:{},m:{},dr:{},da:{},qz:{},notes:{},theme:S.theme,fs:S.fs,focus:false,last:null,gam:{xp:0,days:{}},place:null,_uid:S._uid};save();buildMenus();route();toast('Progresso apagado');}};
}

/* ---------- livros ---------- */
function renderBooks(){
  document.title='Meus livros · Inglês em Formação';
  V.innerHTML=`<p class="crumb"><a href="#/inicio">início</a> / livros</p><h1>Meus livros (PDF)</h1>
  <p class="sub">Os PDFs não ficam no site, por direitos autorais e pelo tamanho. Carregue cada arquivo uma vez: ele fica guardado só neste navegador, e os botões “PDF p.” passam a abrir a página exata de cada unidade.</p>
  ${isLocal()?'<div class="call k-dica"><div class="lab">Rodando localmente</div><p>Os PDFs na mesma pasta do <code>index.html</code>, com os nomes abaixo, já abrem direto. Não é preciso carregar nada.</p></div>':''}
  ${LVS.map(L=>`<div class="bookcard"><div class="acell" style="--cc:${L.color};min-width:4rem;height:4rem;font-size:1.4rem"><small>${L.cefr}</small>${L.code}</div><div>
    <h3>${esc(L.book)}</h3><p class="sub" style="margin:0">${esc(L.author)} · <span class="diff-mark d${L.d}">${esc(L.name)}</span> · arquivo esperado: <code>${esc(L.file)}</code></p>
    <p style="margin:.5rem 0 0" id="st-${L.id}">${PDF_URL[L.id]?'<span class="okc">✓ PDF carregado neste navegador</span>':'<span class="noc">PDF ainda não carregado</span>'}</p>
    <div class="acts"><label class="btn filebtn">${PDF_URL[L.id]?'Trocar PDF':'Carregar PDF'}<input type="file" accept="application/pdf" data-load="${L.id}"></label>${PDF_URL[L.id]?`<button class="btn" type="button" data-pdf="${L.id}">${ICO.book}Abrir</button><button class="btn danger" type="button" data-rm="${L.id}">Remover</button>`:''}</div>
  </div></div>`).join('')}`;
  bindPdf();
  $$('[data-load]').forEach(inp=>inp.onchange=async()=>{const f=inp.files[0];if(!f)return;const id=inp.dataset.load;$('#st-'+id).textContent='Salvando…';try{await idbPut(id,f);if(PDF_URL[id])URL.revokeObjectURL(PDF_URL[id]);PDF_URL[id]=URL.createObjectURL(f);toast('PDF salvo neste navegador');renderBooks();}catch(e){$('#st-'+id).textContent='Não foi possível salvar: '+(e&&e.message||'espaço insuficiente');}});
  $$('[data-rm]').forEach(b=>b.onclick=async()=>{const id=b.dataset.rm;await idbDel(id);URL.revokeObjectURL(PDF_URL[id]);delete PDF_URL[id];renderBooks();});
}

/* ---------- init ---------- */
applyPrefs();buildMenus();updTop();route();
loadPdfs();
sbInit();
if('speechSynthesis' in window)speechSynthesis.getVoices();
