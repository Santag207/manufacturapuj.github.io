/**
 * script.js v3.0 — Calculadora de Mecanizado · PUJ
 * Modo Rápido + Wizard Guiado paso a paso con diagramas SVG
 */

/* ══════════════ ESTADO GLOBAL ══════════════ */
let DB = null;
const S = { // estado global compartido
  mode:'quick', operation:null, material:null, tool:null, passType:null,
  vars:{}, results:null,
  // wizard
  wizStep:0, wizSteps:[], wizDirty:false
};

/* ══════════════ ARRANQUE ══════════════ */
async function loadData(){
  try{ const r=await fetch('data.json'); if(!r.ok)throw 0; DB=await r.json(); }
  catch(e){ DB=getEmbeddedData(); }
  init();
}
function init(){
  renderOperations();
  renderMaterialsSelect('selMaterial');
  renderToolsSelect('selTool');
  startClock();
  updateProgress(1);
  document.getElementById('loadingScreen').classList.add('hidden');
  setMode('home'); // Mostrar home por defecto al cargar
}

/* ══════════════ MODO ══════════════ */
function setMode(m){
  S.mode = m;
  document.getElementById('modeQuickBtn').classList.toggle('active', m==='quick');
  document.getElementById('modeGuideBtn').classList.toggle('active', m==='guided');
  document.querySelector('.concepts-btn').classList.toggle('active', m==='concepts');
  document.getElementById('panelHome').style.display   = m==='home'    ? '' : 'none';
  document.getElementById('panelQuick').style.display   = m==='quick'   ? '' : 'none';
  document.getElementById('panelGuided').style.display  = m==='guided'  ? '' : 'none';
  document.getElementById('panelConcepts').style.display = m==='concepts' ? '' : 'none';
  if(m==='guided'){ initWizard(); }
  if(m==='concepts'){ initConceptsTabs(); }
}

/* ══════════════════════════════════════════════════════════
   MODO RÁPIDO — mismo flujo anterior
══════════════════════════════════════════════════════════ */
function renderOperations(){
  const g=document.getElementById('opGrid');
  g.innerHTML=Object.values(DB.operations).map(op=>`
    <div class="op-card" id="opCard_${op.id}" onclick="selectOperation('${op.id}')">
      <span class="op-icon">${opEmoji(op.id)}</span>
      <div>
        <span class="op-label">${op.label}</span>
        <p class="op-desc">${op.description}</p>
        <span class="op-badge">${Object.keys(op.formula).map(k=>k.toUpperCase()).join(' · ')}</span>
      </div>
    </div>`).join('');
}
function opEmoji(id){return{torneado:'◎',fresado:'✦',taladrado:'▼'}[id]||'⚙'}

function selectOperation(id){
  S.operation=id;
  document.querySelectorAll('.op-card').forEach(c=>c.classList.remove('active'));
  document.getElementById('opCard_'+id)?.classList.add('active');
  document.getElementById('noOpNotice').style.display='none';
  document.getElementById('matToolWrap').style.display='';
  renderVars(); renderFormulas(); renderPassButtons(); updateVcDisplay();
  document.getElementById('passPanel').style.display='';
  document.getElementById('formulaBox').style.display='';
  updateProgress(2);
}

function renderMaterialsSelect(selId){
  const sel=document.getElementById(selId); if(!sel)return;
  const groups={};
  DB.workpieceMaterials.forEach(m=>{ if(!groups[m.group])groups[m.group]=[]; groups[m.group].push(m); });
  let h='<option value="">— Seleccionar —</option>';
  Object.entries(groups).forEach(([g,ms])=>{ h+=`<optgroup label="${g}">`; ms.forEach(m=>{ h+=`<option value="${m.id}">${m.label} — ${m.hardness}</option>`; }); h+='</optgroup>'; });
  sel.innerHTML=h;
  sel.onchange=()=>{ S.material=sel.value; updateVcDisplay(); };
}

function renderToolsSelect(selId){
  const sel=document.getElementById(selId); if(!sel)return;
  let h='<option value="">— Seleccionar —</option>';
  DB.toolMaterials.forEach(t=>{ h+=`<option value="${t.id}">${t.icon} ${t.label}</option>`; });
  sel.innerHTML=h;
  sel.onchange=()=>{ S.tool=sel.value; updateVcDisplay(); };
}

function getVc(mat,tool,op){
  mat=mat||S.material; tool=tool||S.tool; op=op||S.operation;
  if(!mat||!tool||!op) return null;
  const m=DB.workpieceMaterials.find(x=>x.id===mat); if(!m)return null;
  const v=m.cuttingSpeeds[tool]?.[op];
  return (v&&v>0)?v:null;
}

function updateVcDisplay(){
  const vc=getVc();
  document.getElementById('infoVc').style.display=vc?'':'none';
  if(vc) document.getElementById('vcDisplay').value=vc;
}

function renderVars(){
  if(!S.operation)return;
  const op=DB.operations[S.operation];
  const c=document.getElementById('varsContainer');
  c.innerHTML=op.variables.map(v=>`
    <div class="form-group">
      <div class="var-label-row">
        <span class="var-label-text">${v.label}</span>
        <button class="help-icon-btn" onclick="openVarHelpModal('${S.operation}','${v.id}')">?</button>
      </div>
      <div class="range-row">
        <input type="range" id="range_${v.id}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.default}" oninput="syncQ('${v.id}',this.value)"/>
        <span class="range-val" id="rv_${v.id}">${v.default}</span>
      </div>
      <div class="input-with-unit" style="margin-top:6px">
        <input type="number" id="num_${v.id}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.default}" oninput="syncQR('${v.id}',this.value)"/>
        <span class="unit-badge">${v.unit}</span>
      </div>
    </div>`).join('');
}

function syncQ(id,val){ const n=parseFloat(val); document.getElementById('num_'+id).value=n; document.getElementById('rv_'+id).textContent=n; }
function syncQR(id,val){ const n=parseFloat(val); if(!isNaN(n)){ document.getElementById('range_'+id).value=n; document.getElementById('rv_'+id).textContent=n; } }
function qVar(id){ const e=document.getElementById('num_'+id); return e?parseFloat(e.value):NaN; }

function renderFormulas(){
  if(!S.operation)return;
  const op=DB.operations[S.operation];
  document.getElementById('formulaContent').innerHTML=Object.entries(op.formula).map(([k,eq])=>`
    <div class="formula-item"><span class="formula-var">${k.toUpperCase()}</span><span class="formula-eq">${eq}</span></div>`).join('');
}

function renderPassButtons(){
  if(!S.operation)return;
  const c=document.getElementById('passButtons');
  c.innerHTML=Object.entries(DB.passTypes).map(([id,p])=>`
    <button class="pass-btn" id="passBtn_${id}" onclick="selectPassQ('${id}')">${p.label}</button>`).join('');
}

function selectPassQ(pid){
  S.passType=pid;
  Object.keys(DB.passTypes).forEach(id=>{ document.getElementById('passBtn_'+id).className='pass-btn'; });
  document.getElementById('passBtn_'+pid).className=`pass-btn active-${pid}`;
  const op=DB.operations[S.operation];
  const hint=document.getElementById('feedHint');
  const match=Object.entries(op.feedSuggestions).find(([k])=>k===pid||k.includes(pid));
  if(match){
    const[,sg]=match;
    hint.innerHTML=`<strong>${sg.label}:</strong> Rango <strong>${sg.range}</strong> — Típico: <strong>${sg.typical}</strong>`;
    hint.classList.add('visible');
    const fid=S.operation==='fresado'?'fz':'f';
    const ne=document.getElementById('num_'+fid);
    if(ne){ ne.value=sg.typical; syncQR(fid,sg.typical); }
  } else hint.classList.remove('visible');
}

function updateProgress(step){
  for(let i=1;i<=3;i++){
    const el=document.getElementById('prog'+i);
    if(!el)return;
    el.classList.remove('active','done');
    if(i<step) el.classList.add('done');
    if(i===step) el.classList.add('active');
  }
}

function calculateResults(){
  if(!S.operation){ showToast('Selecciona una operación','error'); return; }
  if(!S.material){ showToast('Selecciona el material','error'); return; }
  if(!S.tool){ showToast('Selecciona la herramienta','error'); return; }
  const vc=getVc();
  if(!vc){ showWarning('Combinación no disponible. Elige otra herramienta o material.'); return; }
  hideWarning();
  const op=DB.operations[S.operation];
  const vars={};
  op.variables.forEach(v=>{ vars[v.id]=qVar(v.id); });
  for(const[k,v] of Object.entries(vars)){
    if(isNaN(v)||v<=0){ showToast(`Valor inválido: ${k.toUpperCase()}`, 'error'); return; }
  }
  const res=compute(S.operation, vc, vars);
  displayResults(res, vars, vc);
  updateProgress(3);
  showToast('Cálculo completado ✓','success');
}

function compute(op, vc, vars){
  const PI=Math.PI, {D,L,f,fz,Z}=vars;
  const Sv=(1000*vc)/(PI*D);
  let Fv,tv,steps;
  if(op==='torneado'){
    Fv=f*Sv; tv=L/Fv;
    steps=[
      {n:1,eq:`S = (1000×${vc})/(π×${D})`,r:fmt(Sv)+' rpm'},
      {n:2,eq:`F = f×S = ${f}×${fmt(Sv)}`,r:fmt(Fv)+' mm/min'},
      {n:3,eq:`t = L/F = ${L}/${fmt(Fv)}`,r:fmtT(tv)+' min'},
    ];
  } else if(op==='fresado'){
    Fv=fz*Z*Sv; tv=L/Fv;
    steps=[
      {n:1,eq:`S = (1000×${vc})/(π×${D})`,r:fmt(Sv)+' rpm'},
      {n:2,eq:`F = fz×Z×S = ${fz}×${Z}×${fmt(Sv)}`,r:fmt(Fv)+' mm/min'},
      {n:3,eq:`t = L/F = ${L}/${fmt(Fv)}`,r:fmtT(tv)+' min'},
    ];
  } else {
    const ap=0.3*D; Fv=f*Sv; tv=(L+ap)/Fv;
    steps=[
      {n:1,eq:`S = (1000×${vc})/(π×${D})`,r:fmt(Sv)+' rpm'},
      {n:2,eq:`F = f×S = ${f}×${fmt(Sv)}`,r:fmt(Fv)+' mm/min'},
      {n:3,eq:`t = (${L}+${fmtD(ap)})/${fmt(Fv)}`,r:fmtT(tv)+' min'},
    ];
  }
  return {S:Sv,F:Fv,t:tv,steps};
}

function displayResults(res, vars, vc){
  const op=DB.operations[S.operation];
  const mat=DB.workpieceMaterials.find(m=>m.id===S.material);
  const tool=DB.toolMaterials.find(t=>t.id===S.tool);
  const pass=S.passType?DB.passTypes[S.passType]:null;
  document.getElementById('resOpLabel').innerHTML=`${opEmoji(S.operation)} ${op.label}<span class="badge">${pass?pass.label.toUpperCase():'CALCULADO'}</span>`;
  document.getElementById('resTimestamp').textContent=new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  animVal('valS',fmt(res.S)); animVal('valF',fmt(res.F)); animVal('valT',fmtT(res.t));
  document.getElementById('calcSteps').innerHTML=res.steps.map(s=>`
    <div class="calc-step">
      <div class="step-num">${s.n}</div>
      <div class="step-formula"><em>Paso ${s.n}:</em> ${esc(s.eq)}</div>
      <div class="step-result">${s.r}</div>
    </div>`).join('');
  const rows=[
    {k:'Operación',v:op.label},{k:'Material',v:mat?.label||'—'},{k:'Herramienta',v:tool?.label||'—'},{k:'Vc',v:vc+' m/min'},
    ...op.variables.map(vr=>({k:vr.label.split(' (')[0],v:vars[vr.id]+' '+vr.unit}))
  ];
  document.getElementById('inputSummary').innerHTML=rows.map(r=>`
    <div class="summary-row"><span class="summary-key">${r.k}</span><span class="summary-val">${r.v}</span></div>`).join('');
  document.getElementById('resultsWrapper').classList.add('visible');
  setTimeout(()=>document.getElementById('resultsWrapper').scrollIntoView({behavior:'smooth',block:'start'}),200);
}

/* ══════════════════════════════════════════════════════════
   WIZARD GUIADO — MOTOR COMPLETO
══════════════════════════════════════════════════════════ */
const WIZ={
  stepIndex:0,
  steps:[],
  state:{ operation:null, material:null, tool:null, passType:null, vars:{} },

  /* Construye la lista de pasos según la operación (se recalcula al elegir operación) */
  buildSteps(op){
    const base=['welcome'];
    if(!op) return base;
    const opDef=DB.operations[op];
    const steps=['op','material','tool'];
    opDef.variables.forEach(v=>steps.push('var_'+v.id));
    steps.push('pass','results');
    return steps;
  },

  totalSteps(){ return this.steps.length; },
  currentKey(){ return this.steps[this.stepIndex]; },
};

function initWizard(){
  WIZ.stepIndex=0;
  WIZ.state={ operation:null, material:null, tool:null, passType:null, vars:{} };
  WIZ.steps=['op'];
  renderWizardStep();
}

function renderWizardStep(){
  const key=WIZ.steps[WIZ.stepIndex];
  updateWizDots();
  updateWizNav();
  const body=document.getElementById('wizardBody');
  body.innerHTML='';
  body.style.animation='none'; void body.offsetWidth; body.style.animation='';
  body.classList.remove('fade-in'); void body.offsetWidth; body.classList.add('fade-in');

  if(key==='op')             renderWizOp(body);
  else if(key==='material')  renderWizMaterial(body);
  else if(key==='tool')      renderWizTool(body);
  else if(key==='pass')      renderWizPass(body);
  else if(key==='results')   renderWizResults(body);
  else if(key.startsWith('var_')){
    const varId=key.replace('var_','');
    renderWizVar(body, varId);
  }
}

/* ── Puntos de progreso ── */
function updateWizDots(){
  const total=WIZ.steps.length;
  const cur=WIZ.stepIndex;
  let html='';
  for(let i=0;i<total;i++){
    if(i<cur)        html+=`<div class="wiz-dot done" title="${stepTitle(WIZ.steps[i])}"></div>`;
    else if(i===cur) html+=`<div class="wiz-dot active" title="${stepTitle(WIZ.steps[i])}"></div>`;
    else             html+=`<div class="wiz-dot" title="${stepTitle(WIZ.steps[i])}"></div>`;
  }
  document.getElementById('wizardDots').innerHTML=html;
  document.getElementById('wizardStepLabel').textContent=`Paso ${cur+1} de ${total}`;
}

function stepTitle(key){
  if(key==='op')return 'Operación';
  if(key==='material')return 'Material';
  if(key==='tool')return 'Herramienta';
  if(key==='pass')return 'Pasada';
  if(key==='results')return 'Resultados';
  if(key.startsWith('var_')){
    const vid=key.replace('var_','');
    const op=WIZ.state.operation;
    if(!op)return vid.toUpperCase();
    const v=DB.operations[op].variables.find(x=>x.id===vid);
    return v?v.label.split(' (')[0]:vid.toUpperCase();
  }
  return key;
}

/* ── Navegación ── */
function updateWizNav(){
  const back=document.getElementById('wizBackBtn');
  const next=document.getElementById('wizNextBtn');
  const center=document.getElementById('wizardNavInfo');
  back.disabled=WIZ.stepIndex===0;
  const key=WIZ.steps[WIZ.stepIndex];
  if(key==='results'){
    next.style.display='none';
  } else {
    next.style.display='';
    next.textContent='Siguiente →';
    next.className='wiz-btn-next';
    // pulse si hay selección
    if(key==='op'&&WIZ.state.operation) next.classList.add('pulse');
  }
  const pct=Math.round((WIZ.stepIndex/(WIZ.steps.length-1))*100)||0;
  center.textContent=`${pct}% completado`;
}

function wizardBack(){
  if(WIZ.stepIndex>0){ WIZ.stepIndex--; renderWizardStep(); }
}

function wizardNext(){
  const key=WIZ.steps[WIZ.stepIndex];
  // Validar antes de avanzar
  if(key==='op' && !WIZ.state.operation){ showToast('Toca una operación para continuar','error'); return; }
  if(key==='material' && !WIZ.state.material){ showToast('Selecciona el material','error'); return; }
  if(key==='tool' && !WIZ.state.tool){ showToast('Selecciona la herramienta','error'); return; }
  if(key==='pass' && !WIZ.state.passType){ showToast('Elige un tipo de pasada','error'); return; }
  if(key.startsWith('var_')){
    const vid=key.replace('var_','');
    const varDef=DB.operations[WIZ.state.operation]?.variables?.find(v=>v.id===vid);
    // Si el usuario no movió el slider, usar el valor por defecto
    if(WIZ.state.vars[vid]===undefined||WIZ.state.vars[vid]===null){
      WIZ.state.vars[vid]= varDef ? varDef.default : 0;
    }
    const val=WIZ.state.vars[vid];
    if(isNaN(val)||val<=0){ showToast('Ingresa un valor válido mayor a 0','error'); return; }
  }
  // Si completamos op, reconstruir steps
  if(key==='op'){
    WIZ.steps=WIZ.buildSteps(WIZ.state.operation);
  }
  if(WIZ.stepIndex<WIZ.steps.length-1){
    WIZ.stepIndex++;
    renderWizardStep();
  }
}

/* ══════════════════════════════════════════════
   PASO 1 — SELECCIÓN DE OPERACIÓN
══════════════════════════════════════════════ */
function renderWizOp(body){
  body.innerHTML=`
  <div class="wiz-card">
    <div class="wiz-card-header">
      <div class="wiz-step-number">PASO 1 — ELIGE LA OPERACIÓN</div>
      <div class="wiz-big-title">¿Qué quieres hacer?</div>
      <div class="wiz-subtitle">Toca la máquina que vas a usar. Si no sabes cuál, mira el dibujo.</div>
    </div>
    <div class="wiz-op-grid" id="wizOpGrid">
      ${Object.values(DB.operations).map(op=>`
        <div class="wiz-op-card ${WIZ.state.operation===op.id?'selected':''}"
             id="wop_${op.id}" onclick="wizSelectOp('${op.id}')">
          <span class="wiz-op-check">✓</span>
          <span class="wiz-op-big-icon">${wizOpBigSvg(op.id)}</span>
          <span class="wiz-op-title">${op.label}</span>
          <p class="wiz-op-detail">${op.description}</p>
        </div>`).join('')}
    </div>
    <!-- Ilustración de la máquina seleccionada -->
    <div id="wizOpIllustration" style="display:${WIZ.state.operation?'':'none'}">
      <div class="wiz-illustration">
        <span class="wiz-illustration-label">Vista de la máquina</span>
        <div id="wizOpSvgContent">${WIZ.state.operation?getMachineSvg(WIZ.state.operation):''}</div>
      </div>
      <div class="wiz-steps-area" style="padding-bottom:24px">
        <div class="wiz-steps-col">
          <div class="wiz-steps-title orange">¿Cómo funciona esta máquina?</div>
          <ul class="wiz-step-list" id="wizOpExplain"></ul>
        </div>
        <div class="wiz-steps-col">
          <div class="wiz-steps-title green">Lo que vamos a calcular</div>
          <ul class="wiz-tip-list" id="wizOpWillCalc"></ul>
        </div>
      </div>
    </div>
  </div>`;
  if(WIZ.state.operation) updateWizOpExplain(WIZ.state.operation);
}

function wizSelectOp(id){
  WIZ.state.operation=id;
  WIZ.state.material=null; WIZ.state.tool=null; WIZ.state.passType=null; WIZ.state.vars={};
  document.querySelectorAll('.wiz-op-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('wop_'+id)?.classList.add('selected');
  const ill=document.getElementById('wizOpIllustration');
  if(ill){ ill.style.display=''; document.getElementById('wizOpSvgContent').innerHTML=getMachineSvg(id); }
  updateWizOpExplain(id);
  updateWizNav();
  document.getElementById('wizNextBtn')?.classList.add('pulse');
}

function updateWizOpExplain(id){
  const explains={
    torneado:['La pieza de metal gira muy rápido','Una cuchilla que no gira va cortando el exterior','Es como pelar una papa en forma cilíndrica','Se usa para hacer ejes, tornillos y piezas redondas'],
    fresado:['La herramienta (fresa) gira rapidísimo','La pieza se mueve debajo de la fresa','La fresa tiene varios dientes que cortan','Se usa para hacer ranuras, cajeras y superficies planas'],
    taladrado:['La broca gira y se mueve hacia adentro de la pieza','Va taladrando un agujero cilíndrico','Como un taladro de casa pero mucho más preciso','Se usa para hacer agujeros redondos']
  };
  const willCalc={
    torneado:['S = velocidad de giro (rpm)','F = velocidad de avance (mm/min)','t = tiempo que dura el corte (min)'],
    fresado:['S = velocidad de giro de la fresa (rpm)','F = velocidad de avance (mm/min)','t = tiempo que dura el fresado (min)'],
    taladrado:['S = velocidad de giro de la broca (rpm)','F = velocidad de entrada (mm/min)','t = tiempo de taladrado (min)']
  };
  const el=document.getElementById('wizOpExplain');
  const el2=document.getElementById('wizOpWillCalc');
  if(!el||!el2)return;
  el.innerHTML=(explains[id]||[]).map((t,i)=>`<li><span class="wiz-step-n orange">${i+1}</span>${t}</li>`).join('');
  el2.innerHTML=(willCalc[id]||[]).map(t=>`<li class="wiz-tip info">${t}</li>`).join('');
}

function wizOpBigSvg(id){
  const m={torneado:'🔩',fresado:'⚙️',taladrado:'🔩'};
  const icons={torneado:'◎',fresado:'✦',taladrado:'▼'};
  return icons[id]||'⚙';
}

/* ══════════════════════════════════════════════
   PASO 2 — MATERIAL DE LA PIEZA
══════════════════════════════════════════════ */
function renderWizMaterial(body){
  const groups={};
  DB.workpieceMaterials.forEach(m=>{ if(!groups[m.group])groups[m.group]=[]; groups[m.group].push(m); });

  body.innerHTML=`
  <div class="wiz-card">
    <div class="wiz-card-header">
      <div class="wiz-step-number">PASO ${WIZ.stepIndex+1}</div>
      <div class="wiz-big-title">¿De qué material<br>es la pieza?</div>
      <div class="wiz-subtitle">Si no sabes el material, mira el plano técnico o pregunta a tu instructor.</div>
    </div>
    <!-- SVG identificación de materiales -->
    <div class="wiz-mat-svg">${svgMaterialIdentification()}</div>
    <div class="wiz-steps-area" style="padding-top:20px;padding-bottom:8px">
      <div class="wiz-steps-col">
        <div class="wiz-steps-title blue">¿Cómo identifico el material?</div>
        <ul class="wiz-step-list">
          <li><span class="wiz-step-n blue">1</span>Mira si tiene algún número grabado en el extremo de la barra (Ej: "AISI 1045")</li>
          <li><span class="wiz-step-n blue">2</span>Busca en el plano de la pieza — siempre dice qué material es</li>
          <li><span class="wiz-step-n blue">3</span>Si es brillante y plateado → probablemente acero o aluminio</li>
          <li><span class="wiz-step-n blue">4</span>Si es rojizo → cobre o bronce. Si es gris opaco → hierro fundido</li>
        </ul>
      </div>
      <div class="wiz-steps-col">
        <div class="wiz-steps-title green">Consejos</div>
        <ul class="wiz-tip-list">
          <li class="wiz-tip good">Si el plano dice el material, úsalo directamente</li>
          <li class="wiz-tip good">El acero medio carbono es el más común en el taller</li>
          <li class="wiz-tip bad">Nunca adivines el material — afecta la velocidad de corte</li>
          <li class="wiz-tip info">Aluminio = muy liviano. Acero = pesado y magnético</li>
        </ul>
      </div>
    </div>
    <div class="wiz-mat-select-wrap">
      <label style="font-family:var(--mono);font-size:11px;color:var(--text2);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;display:block">Selecciona el material:</label>
      <select id="wizSelMat" style="font-size:15px;padding:14px 16px;border-radius:12px;border:2px solid var(--border)">
        <option value="">— Toca aquí para elegir —</option>
        ${Object.entries(groups).map(([g,ms])=>`<optgroup label="${g}">${ms.map(m=>`<option value="${m.id}" ${WIZ.state.material===m.id?'selected':''}>${m.label} — ${m.hardness}</option>`).join('')}</optgroup>`).join('')}
      </select>
    </div>
  </div>`;
  document.getElementById('wizSelMat').onchange=function(){
    WIZ.state.material=this.value||null;
  };
}

/* ══════════════════════════════════════════════
   PASO 3 — HERRAMIENTA
══════════════════════════════════════════════ */
function renderWizTool(body){
  body.innerHTML=`
  <div class="wiz-card">
    <div class="wiz-card-header">
      <div class="wiz-step-number">PASO ${WIZ.stepIndex+1}</div>
      <div class="wiz-big-title">¿Qué herramienta<br>tienes?</div>
      <div class="wiz-subtitle">Mira el mango de tu herramienta — casi siempre tiene escrito el material. Si no, pregunta al técnico del taller.</div>
    </div>
    ${svgToolsIllustration()}
    <div class="wiz-tool-grid">
      ${DB.toolMaterials.map(t=>`
        <div class="wiz-tool-card ${WIZ.state.tool===t.id?'selected':''}" id="wtool_${t.id}" onclick="wizSelectTool('${t.id}')">
          <span class="wiz-tool-check">✓</span>
          <div class="wiz-tool-header">
            <span class="wiz-tool-icon">${t.icon}</span>
            <span class="wiz-tool-name">${t.label}</span>
          </div>
          <div class="wiz-tool-desc">${t.description}</div>
          <span class="wiz-tool-badge">${toolBadgeText(t.id)}</span>
        </div>`).join('')}
    </div>
    <!-- Vc resultado -->
    <div class="wiz-vc-display ${getVc(WIZ.state.material,WIZ.state.tool,WIZ.state.operation)?'':'wiz-vc-hidden'}" id="wizVcBox">
      <div class="wiz-vc-label">Velocidad de corte (Vc) obtenida de la tabla:</div>
      <div>
        <span class="wiz-vc-value" id="wizVcVal">${getVc(WIZ.state.material,WIZ.state.tool,WIZ.state.operation)||'—'}</span>
        <span class="wiz-vc-unit"> m/min</span>
      </div>
    </div>
  </div>`;
}

function toolBadgeText(id){
  return {hss:'Económica · Más común',carburo:'Alta velocidad · Duradera',ceramica:'Solo torneado · Muy rápida',cbn:'Para materiales duros'}[id]||'';
}

function wizSelectTool(id){
  WIZ.state.tool=id;
  document.querySelectorAll('.wiz-tool-card').forEach(c=>c.classList.remove('selected'));
  document.getElementById('wtool_'+id)?.classList.add('selected');
  // actualizar Vc
  const vc=getVc(WIZ.state.material,WIZ.state.tool,WIZ.state.operation);
  const box=document.getElementById('wizVcBox');
  if(box){
    if(vc){ box.classList.remove('wiz-vc-hidden'); document.getElementById('wizVcVal').textContent=vc; }
    else   { box.classList.add('wiz-vc-hidden'); }
  }
}

/* ══════════════════════════════════════════════
   PASO VARIABLE — MEDIR D, L, f, fz, Z
══════════════════════════════════════════════ */
function renderWizVar(body, varId){
  const op=DB.operations[WIZ.state.operation];
  const varDef=op.variables.find(v=>v.id===varId);
  const guide=DB.guides?.operations?.[WIZ.state.operation]?.variables?.[varId];
  // ── FIX: almacenar el valor por defecto para que la validación de Siguiente funcione
  if(WIZ.state.vars[varId]===undefined || WIZ.state.vars[varId]===null){
    WIZ.state.vars[varId]=varDef.default;
  }
  const curVal=WIZ.state.vars[varId];
  const svgFn=getVarSvg(WIZ.state.operation, varId);
  const varIdx=op.variables.findIndex(v=>v.id===varId)+1;
  const totalVars=op.variables.length;
  const plainDesc=guide?.plainDescription || getDefaultDesc(varId, WIZ.state.operation);
  const steps=guide?.steps || [];
  const tips=guide?.tips || [];
  const mistakes=guide?.mistakes || [];
  const tool=guide?.tool || 'Calibrador vernier o regla';
  const whereToMeasure=guide?.whereToMeasure || '';

  body.innerHTML=`
  <div class="wiz-card">
    <div class="wiz-card-header">
      <div class="wiz-step-number">MEDIDA ${varIdx} DE ${totalVars} · PASO ${WIZ.stepIndex+1}</div>
      <div class="wiz-big-title" style="display:flex;align-items:center;gap:14px">
        <div style="width:52px;height:52px;border-radius:10px;background:rgba(245,166,35,.12);border:2px solid rgba(245,166,35,.4);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:28px;font-weight:bold;color:var(--accent);flex-shrink:0">${varId.toUpperCase()}</div>
        ${varDef.label.split('(')[0].trim()}
      </div>
      <div class="wiz-subtitle">${plainDesc}</div>
    </div>

    <!-- Ilustración grande -->
    <div class="wiz-illustration">
      <span class="wiz-illustration-label">¿Dónde se mide ${varId.toUpperCase()}?</span>
      ${svgFn ? svgFn() : svgGenericMeasure(varId, varDef.unit)}
    </div>

    <!-- Instrumento + dónde medir -->
    <div style="padding:16px 28px 0;display:flex;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px;background:rgba(79,195,247,.07);border:1px solid rgba(79,195,247,.2);border-radius:8px;padding:10px 16px;flex:1;min-width:200px">
        <span style="font-size:22px">🔧</span>
        <div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px;text-transform:uppercase">Instrumento</div>
          <div style="font-size:13px;color:var(--blue);font-weight:500">${tool}</div>
        </div>
      </div>
      ${whereToMeasure?`<div style="display:flex;align-items:center;gap:10px;background:rgba(245,166,35,.07);border:1px solid rgba(245,166,35,.2);border-radius:8px;padding:10px 16px;flex:1;min-width:200px">
        <span style="font-size:22px">📍</span>
        <div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);letter-spacing:1px;text-transform:uppercase">Dónde medir</div>
          <div style="font-size:13px;color:var(--accent);font-weight:500">${whereToMeasure}</div>
        </div>
      </div>`:''}
    </div>

    <!-- Pasos + tips -->
    ${(steps.length||tips.length||mistakes.length)?`
    <div class="wiz-steps-area">
      ${steps.length?`<div class="wiz-steps-col">
        <div class="wiz-steps-title blue">Cómo medir ${varId.toUpperCase()} paso a paso</div>
        <ul class="wiz-step-list">
          ${steps.map((s,i)=>`<li><span class="wiz-step-n blue">${i+1}</span>${s}</li>`).join('')}
        </ul>
      </div>`:''}
      <div class="wiz-steps-col">
        ${tips.length?`<div class="wiz-steps-title green">✓ Hazlo así</div>
        <ul class="wiz-tip-list" style="margin-bottom:12px">
          ${tips.map(t=>`<li class="wiz-tip good">${t}</li>`).join('')}
        </ul>`:''}
        ${mistakes.length?`<div class="wiz-steps-title" style="color:var(--red)">✕ Errores comunes</div>
        <ul class="wiz-tip-list">
          ${mistakes.map(m=>`<li class="wiz-tip bad">${m}</li>`).join('')}
        </ul>`:''}
      </div>
    </div>`:''}

    <!-- Input de la medida -->
    <div class="wiz-input-section">
      <div class="wiz-input-label">
        <div class="wiz-input-symbol">${varId.toUpperCase()}</div>
        Ingresa el valor medido
      </div>
      <div class="wiz-value-display">
        <div class="wiz-value-big" id="wizVarDisplay">${fmtD(curVal)}</div>
        <div class="wiz-value-unit">${varDef.unit}</div>
      </div>
      <div class="wiz-big-slider">
        <input type="range" id="wizVarSlider"
          min="${varDef.min}" max="${varDef.max}" step="${varDef.step}" value="${curVal}"
          oninput="wizUpdateVar('${varId}', this)"/>
        <div class="wiz-range-labels"><span>${varDef.min} ${varDef.unit}</span><span>${varDef.max} ${varDef.unit}</span></div>
      </div>
      <div class="wiz-value-input-row">
        <input type="number" class="wiz-number-input" id="wizVarNum"
          min="${varDef.min}" max="${varDef.max}" step="${varDef.step}" value="${curVal}"
          oninput="wizUpdateVarNum('${varId}', this)"/>
        <span style="font-family:var(--mono);font-size:14px;color:var(--text2)">${varDef.unit}</span>
      </div>
    </div>
  </div>`;
  // Iniciar slider gradient
  // Si aún no se ha guardado, inicializar con el valor actual (default)
  if(WIZ.state.vars[varId]===undefined) WIZ.state.vars[varId]=curVal;
  updateSliderGradient(document.getElementById('wizVarSlider'), varDef);
}

function wizUpdateVar(id, sliderEl){
  const val=parseFloat(sliderEl.value);
  WIZ.state.vars[id]=val;
  document.getElementById('wizVarDisplay').textContent=fmtD(val);
  document.getElementById('wizVarNum').value=val;
  updateSliderGradient(sliderEl, DB.operations[WIZ.state.operation].variables.find(v=>v.id===id));
}

function wizUpdateVarNum(id, numEl){
  const val=parseFloat(numEl.value);
  if(!isNaN(val)&&val>0){
    WIZ.state.vars[id]=val;
    document.getElementById('wizVarDisplay').textContent=fmtD(val);
    const sl=document.getElementById('wizVarSlider');
    sl.value=val;
    updateSliderGradient(sl, DB.operations[WIZ.state.operation].variables.find(v=>v.id===id));
  }
}

function updateSliderGradient(slider, varDef){
  if(!slider||!varDef)return;
  const pct=((slider.value-varDef.min)/(varDef.max-varDef.min))*100;
  slider.style.setProperty('--slider-pct', pct+'%');
}

function getDefaultDesc(varId, op){
  const descs={
    D:{torneado:'El diámetro es qué tan gruesa es la pieza cilíndrica — la medida de lado a lado pasando por el centro.',
       fresado:'El diámetro es qué tan ancha es la fresa (la herramienta de corte).',
       taladrado:'El diámetro es qué tan ancha es la broca — igual al tamaño del agujero que hará.'},
    L:{torneado:'La longitud es qué tan largo es el tramo que vas a mecanizar — de donde empieza a donde termina.',
       fresado:'La longitud es cuánto recorre la fresa de inicio a fin sobre la pieza.',
       taladrado:'La profundidad es qué tan adentro debe entrar la broca — qué tan hondo queda el agujero.'},
    f:{torneado:'El avance es cuánto se mueve la herramienta por cada vuelta de la pieza. No se mide, se elige.',
       taladrado:'El avance es cuánto baja la broca por cada vuelta. No se mide, se elige según el tamaño de la broca.'},
    fz:'El avance por diente es cuánto avanza la pieza por cada diente de la fresa. No se mide, se elige.',
    Z:'El número de dientes es cuántos filos cortantes tiene la fresa. Se cuenta visualmente mirando la punta.'
  };
  const d=descs[varId];
  if(!d)return `Valor de ${varId.toUpperCase()} para la operación.`;
  return typeof d==='string'?d:(d[op]||d['torneado']||'');
}

/* ══════════════════════════════════════════════
   PASO — TIPO DE PASADA
══════════════════════════════════════════════ */
function renderWizPass(body){
  body.innerHTML=`
  <div class="wiz-card">
    <div class="wiz-card-header">
      <div class="wiz-step-number">PASO ${WIZ.stepIndex+1}</div>
      <div class="wiz-big-title">¿Qué tipo de<br>corte es?</div>
      <div class="wiz-subtitle">Elige según qué tanto material tienes que quitar y qué tan liso necesitas que quede.</div>
    </div>
    ${svgPassTypes()}
    <div class="wiz-pass-grid">
      <div class="wiz-pass-card ${WIZ.state.passType==='desbaste'?'selected-desbaste':''}" id="wpass_desbaste" onclick="wizSelectPass('desbaste')">
        <div class="wiz-pass-emoji">🔨</div>
        <div class="wiz-pass-name">Desbaste</div>
        <div class="wiz-pass-detail">Quitar mucho material rápido. La pieza queda rugosa — no es el corte final.</div>
        <div class="wiz-pass-range">${DB.operations[WIZ.state.operation]?.feedSuggestions?.desbaste?.range||'0.25–0.50'} mm</div>
      </div>
      <div class="wiz-pass-card ${WIZ.state.passType==='semiacabado'?'selected-semiacabado':''}" id="wpass_semiacabado" onclick="wizSelectPass('semiacabado')">
        <div class="wiz-pass-emoji">⚖️</div>
        <div class="wiz-pass-name">Semiacabado</div>
        <div class="wiz-pass-detail">Corte intermedio. Ya quitaste lo grueso y ahora afinas la forma de la pieza.</div>
        <div class="wiz-pass-range">${DB.operations[WIZ.state.operation]?.feedSuggestions?.semiacabado?.range||'0.10–0.25'} mm</div>
      </div>
      <div class="wiz-pass-card ${WIZ.state.passType==='acabado'?'selected-acabado':''}" id="wpass_acabado" onclick="wizSelectPass('acabado')">
        <div class="wiz-pass-emoji">✨</div>
        <div class="wiz-pass-name">Acabado</div>
        <div class="wiz-pass-detail">El corte final. La pieza queda lisa y con las medidas exactas del plano.</div>
        <div class="wiz-pass-range">${DB.operations[WIZ.state.operation]?.feedSuggestions?.acabado?.range||'0.05–0.10'} mm</div>
      </div>
    </div>
    <!-- Avance sugerido -->
    <div id="wizPassHint" style="margin:0 28px 28px;display:${WIZ.state.passType?'':'none'}">
      <div style="background:rgba(245,166,35,.07);border:1px solid rgba(245,166,35,.3);border-radius:10px;padding:14px 18px">
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:1px;margin-bottom:6px">AVANCE AUTOCOMPLETADO:</div>
        <div style="font-family:var(--mono);font-size:16px;color:var(--accent)" id="wizPassHintText"></div>
      </div>
    </div>
  </div>`;
  if(WIZ.state.passType) updateWizPassHint(WIZ.state.passType);
}

function wizSelectPass(pid){
  WIZ.state.passType=pid;
  ['desbaste','semiacabado','acabado'].forEach(id=>{
    document.getElementById('wpass_'+id)?.classList.remove('selected-desbaste','selected-semiacabado','selected-acabado');
  });
  document.getElementById('wpass_'+pid)?.classList.add('selected-'+pid);
  // Autocompletar avance
  const op=DB.operations[WIZ.state.operation];
  const match=Object.entries(op.feedSuggestions).find(([k])=>k===pid||k.includes(pid));
  if(match){
    const[,sg]=match;
    const fid=WIZ.state.operation==='fresado'?'fz':'f';
    WIZ.state.vars[fid]=sg.typical;
    document.getElementById('wizPassHint').style.display='';
    updateWizPassHint(pid);
  }
}

function updateWizPassHint(pid){
  const op=DB.operations[WIZ.state.operation];
  const match=Object.entries(op.feedSuggestions).find(([k])=>k===pid||k.includes(pid));
  const el=document.getElementById('wizPassHintText');
  if(match&&el){
    const[,sg]=match;
    const fid=WIZ.state.operation==='fresado'?'fz':'f';
    el.textContent=`${fid.toUpperCase()} = ${sg.typical} ${fid==='fz'?'mm/diente':'mm/rev'} (${sg.label})`;
  }
}

/* ══════════════════════════════════════════════
   PASO FINAL — RESULTADOS
══════════════════════════════════════════════ */
function renderWizResults(body){
  // Calcular
  const op=DB.operations[WIZ.state.operation];
  const vc=getVc(WIZ.state.material,WIZ.state.tool,WIZ.state.operation);
  const vars=Object.assign({},WIZ.state.vars);
  // Rellenar valores default para cualquier var que falte
  op.variables.forEach(v=>{ if(!vars[v.id]) vars[v.id]=v.default; });
  // Si passType y no f/fz, autocompletar
  if(WIZ.state.passType){
    const match=Object.entries(op.feedSuggestions).find(([k])=>k===WIZ.state.passType||k.includes(WIZ.state.passType));
    if(match){ const[,sg]=match; const fid=WIZ.state.operation==='fresado'?'fz':'f'; if(!vars[fid])vars[fid]=sg.typical; }
  }
  let res=null; let errMsg='';
  if(!vc){ errMsg='No hay datos de velocidad de corte para esta combinación de material y herramienta.'; }
  else {
    try{ res=compute(WIZ.state.operation,vc,vars); }
    catch(e){ errMsg='Error en el cálculo. Verifica los valores.'; }
  }
  const mat=DB.workpieceMaterials.find(m=>m.id===WIZ.state.material);
  const tool=DB.toolMaterials.find(t=>t.id===WIZ.state.tool);
  const pass=WIZ.state.passType?DB.passTypes[WIZ.state.passType]:null;

  body.innerHTML=`
  <div class="wiz-card">
    <div class="wiz-card-header">
      <div class="wiz-step-number">¡CÁLCULO COMPLETADO!</div>
      <div class="wiz-big-title" style="color:var(--green)">Aquí están<br>tus resultados 🎉</div>
      <div class="wiz-subtitle">Estos son los valores que debes programar en la máquina o entregar en el parcial.</div>
    </div>
    ${errMsg?`<div style="margin:0 28px 20px;background:rgba(255,82,82,.08);border:1px solid rgba(255,82,82,.3);border-radius:10px;padding:16px;color:#ff8080;font-family:var(--mono)">⚠ ${errMsg}</div>`:`
    <!-- Tarjetas grandes de resultado -->
    <div class="wiz-results-panel">
      <div class="wiz-res-grid">
        <div class="wiz-res-card s" onclick="openResultHelp('S')">
          <div class="wiz-res-name">Velocidad de Husillo</div>
          <div class="wiz-res-val animated">${fmt(res.S)}</div>
          <div class="wiz-res-unit">rev / min (rpm)</div>
          <div class="wiz-res-desc">S — Spindle Speed</div>
          <div class="wiz-res-hint">Toca para saber cómo usarlo</div>
        </div>
        <div class="wiz-res-card f" onclick="openResultHelp('F')">
          <div class="wiz-res-name">Velocidad de Avance</div>
          <div class="wiz-res-val animated">${fmt(res.F)}</div>
          <div class="wiz-res-unit">mm / min</div>
          <div class="wiz-res-desc">F — Feed Rate</div>
          <div class="wiz-res-hint">Toca para saber cómo usarlo</div>
        </div>
        <div class="wiz-res-card t" onclick="openResultHelp('t')">
          <div class="wiz-res-name">Tiempo de Mecanizado</div>
          <div class="wiz-res-val animated">${fmtT(res.t)}</div>
          <div class="wiz-res-unit">min</div>
          <div class="wiz-res-desc">t — Machining Time</div>
          <div class="wiz-res-hint">Toca para saber cómo usarlo</div>
        </div>
      </div>
      <!-- Desglose -->
      <div class="wiz-steps-title" style="margin-bottom:8px;font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase">Así se calculó:</div>
      <div class="wiz-calc-steps">
        ${res.steps.map(s=>`
          <div class="wiz-calc-step">
            <div class="wiz-step-num">${s.n}</div>
            <div class="wiz-step-eq">${esc(s.eq)}</div>
            <div class="wiz-step-res">${s.r}</div>
          </div>`).join('')}
      </div>
      <!-- Resumen de entradas -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:16px">
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Lo que ingresaste:</div>
        ${[
          ['Operación', DB.operations[WIZ.state.operation].label],
          ['Material pieza', mat?.label||'—'],
          ['Herramienta', tool?.label||'—'],
          ['Vc de tabla', vc+' m/min'],
          ['Tipo de pasada', pass?.label||'No seleccionado'],
          ...op.variables.map(v=>([v.label.split(' (')[0], (vars[v.id]||v.default)+' '+v.unit]))
        ].map(([k,v])=>`
          <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(42,48,64,.6);font-size:12px">
            <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">${k}</span>
            <span style="font-family:var(--mono);font-size:12px;color:var(--text)">${v}</span>
          </div>`).join('')}
      </div>
      <!-- Botón reiniciar -->
      <button class="wiz-restart-btn" onclick="initWizard()">↺ Hacer otro cálculo</button>
    </div>`}
  </div>`;
  // Ocultar botón siguiente en resultados
  document.getElementById('wizNextBtn').style.display='none';
}

/* ══════════════════════════════════════════════
   SVGs PARA EL WIZARD
══════════════════════════════════════════════ */

function getMachineSvg(op){
  if(op==='torneado') return svgMachineTorno();
  if(op==='fresado')  return svgMachineFresadora();
  if(op==='taladrado')return svgMachineTaladro();
  return '';
}

function svgMachineTorno(){
  return `<svg viewBox="0 0 600 290" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="290" fill="#131619"/>
  <g stroke="rgba(245,166,35,.03)" stroke-width="0.5"><line x1="0" y1="72" x2="600" y2="72"/><line x1="0" y1="145" x2="600" y2="145"/><line x1="0" y1="218" x2="600" y2="218"/><line x1="150" y1="0" x2="150" y2="290"/><line x1="300" y1="0" x2="300" y2="290"/><line x1="450" y1="0" x2="450" y2="290"/></g>
  <!-- Base del torno -->
  <rect x="40" y="208" width="520" height="30" fill="#1e2228" stroke="#3a4558" stroke-width="1.5" rx="3"/>
  <!-- Bancada -->
  <rect x="55" y="163" width="490" height="46" fill="#1a1e23" stroke="#2a3040" stroke-width="1" rx="2"/>
  <!-- Cabezal (lado chuck) -->
  <rect x="60" y="96" width="100" height="115" fill="#1e2228" stroke="#3a4558" stroke-width="2" rx="4"/>
  <!-- Chuck -->
  <circle cx="110" cy="130" r="36" fill="#131619" stroke="#4fc3f7" stroke-width="2"/>
  <circle cx="110" cy="130" r="26" fill="#1a1e23" stroke="#3a4558" stroke-width="1"/>
  <circle cx="110" cy="130" r="9" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <!-- Mordazas chuck (4) -->
  <rect x="95" y="95" width="30" height="11" fill="#243040" stroke="#4fc3f7" stroke-width="1" rx="2"/>
  <rect x="95" y="154" width="30" height="11" fill="#243040" stroke="#4fc3f7" stroke-width="1" rx="2"/>
  <rect x="73" y="124" width="11" height="12" fill="#243040" stroke="#4fc3f7" stroke-width="1" rx="2"/>
  <rect x="136" y="124" width="11" height="12" fill="#243040" stroke="#4fc3f7" stroke-width="1" rx="2"/>
  <!-- Eje de rotación (línea punteada) -->
  <line x1="146" y1="130" x2="495" y2="130" stroke="rgba(245,166,35,.35)" stroke-width="1" stroke-dasharray="8,4"/>
  <!-- Pieza cilíndrica montada -->
  <rect x="146" y="102" width="258" height="56" fill="#1d2d3e" stroke="none"/>
  <line x1="146" y1="102" x2="404" y2="102" stroke="#4fc3f7" stroke-width="2"/>
  <line x1="146" y1="158" x2="404" y2="158" stroke="#4fc3f7" stroke-width="2"/>
  <ellipse cx="404" cy="130" rx="7" ry="28" fill="#152030" stroke="#4fc3f7" stroke-width="2"/>
  <!-- Contrapunto -->
  <rect x="422" y="96" width="76" height="68" fill="#1e2228" stroke="#3a4558" stroke-width="1.5" rx="3"/>
  <rect x="418" y="125" width="8" height="10" fill="#9aa5b4" stroke="#5c6a7a" stroke-width="1"/>
  <text x="460" y="178" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">CONTRAPUNTO</text>
  <!-- Herramienta de corte posicionada correctamente sobre la pieza -->
  <polygon points="380,118 402,126 380,134" fill="#9aa5b4" stroke="#5c6a7a" stroke-width="1"/>
  <rect x="402" y="124" width="24" height="4" fill="#5c6a7a" rx="1"/>
  <!-- Viruta -->
  <ellipse cx="386" cy="104" rx="5" ry="2" fill="#f39c12" opacity=".7" transform="rotate(30 386 104)"/>
  <!-- Flecha rotación pieza -->
  <path d="M 128 78 Q 145 62 162 78" fill="none" stroke="#f5a623" stroke-width="2.5"/>
  <polygon points="162,78 153,69 165,71" fill="#f5a623"/>
  <text x="145" y="56" fill="#f5a623" font-size="11" font-family="Share Tech Mono" text-anchor="middle" font-weight="bold">GIRA</text>
  <!-- Flecha avance herramienta (hacia la izquierda = hacia el chuck) -->
  <path d="M 415 148 L 360 148" fill="none" stroke="#3ddc84" stroke-width="2.5"/>
  <polygon points="360,148 372,142 372,154" fill="#3ddc84"/>
  <text x="390" y="168" fill="#3ddc84" font-size="9" font-family="Share Tech Mono" text-anchor="middle">AVANZA</text>
  <!-- Label -->
  <text x="300" y="278" fill="#f5a623" font-size="11" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="2">TORNO — LA PIEZA GIRA</text>
</svg>`;
}

function svgMachineFresadora(){
  return `<svg viewBox="0 0 600 290" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="290" fill="#131619"/>
  <g stroke="rgba(245,166,35,.03)" stroke-width="0.5"><line x1="0" y1="72" x2="600" y2="72"/><line x1="0" y1="145" x2="600" y2="145"/><line x1="0" y1="218" x2="600" y2="218"/><line x1="150" y1="0" x2="150" y2="290"/><line x1="300" y1="0" x2="300" y2="290"/><line x1="450" y1="0" x2="450" y2="290"/></g>
  <!-- Base -->
  <rect x="80" y="238" width="440" height="24" fill="#1e2228" stroke="#3a4558" stroke-width="1.5" rx="3"/>
  <!-- Mesa de trabajo -->
  <rect x="130" y="206" width="340" height="34" fill="#1a1e23" stroke="#2a3040" stroke-width="1.5" rx="3"/>
  <!-- Pieza sobre mesa -->
  <rect x="190" y="178" width="220" height="30" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="1.5" rx="2"/>
  <!-- Columna vertical izquierda -->
  <rect x="88" y="46" width="46" height="196" fill="#1e2228" stroke="#3a4558" stroke-width="1.5" rx="3"/>
  <!-- Cabezal horizontal -->
  <rect x="86" y="34" width="240" height="52" fill="#1e2228" stroke="#3a4558" stroke-width="2" rx="4"/>
  <!-- Husillo: desde cabezal (y=86) hasta fresa (cy=152) -->
  <rect x="189" y="86" width="22" height="66" fill="#243040" stroke="#5c6a7a" stroke-width="1.2" rx="2"/>
  <!-- Fresa: cy=152, r=26, bottom=178 → toca la pieza en y=178 ✓ -->
  <circle cx="200" cy="152" r="26" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1.5"/>
  <circle cx="200" cy="152" r="10" fill="#131619" stroke="#3a4558" stroke-width="1"/>
  <!-- Dientes de la fresa (4) -->
  <polygon points="187,126 200,110 213,126" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="226,139 242,152 226,165" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <!-- Diente inferior (zona de corte activa) -->
  <polygon points="187,178 200,194 213,178" fill="rgba(245,166,35,.25)" stroke="#f5a623" stroke-width="1.5"/>
  <polygon points="158,139 174,152 158,165" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <!-- Ranura fresada en la pieza -->
  <rect x="190" y="178" width="96" height="8" fill="#0d1520" stroke="rgba(61,220,132,.4)" stroke-width="1" rx="1"/>
  <!-- Virutas -->
  <ellipse cx="244" cy="177" rx="5" ry="2" fill="#f39c12" opacity=".7" transform="rotate(-25 244 177)"/>
  <ellipse cx="258" cy="176" rx="4" ry="2" fill="#f39c12" opacity=".5" transform="rotate(12 258 176)"/>
  <!-- Flecha rotación fresa -->
  <path d="M 224 120 Q 238 107 238 124" fill="none" stroke="#f5a623" stroke-width="2.5"/>
  <polygon points="238,124 229,116 239,116" fill="#f5a623"/>
  <text x="255" y="112" fill="#f5a623" font-size="11" font-family="Share Tech Mono" font-weight="bold">GIRA</text>
  <!-- Flecha avance mesa -->
  <path d="M 310 220 L 420 220" fill="none" stroke="#3ddc84" stroke-width="2.5"/>
  <polygon points="420,220 408,214 408,226" fill="#3ddc84"/>
  <text x="365" y="238" fill="#3ddc84" font-size="9" font-family="Share Tech Mono" text-anchor="middle">MESA AVANZA</text>
  <!-- Etiqueta RANURA -->
  <text x="238" y="200" fill="#3ddc84" font-size="9" font-family="Share Tech Mono">RANURA</text>
  <!-- Label principal -->
  <text x="300" y="278" fill="#f5a623" font-size="11" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="2">FRESADORA — LA HERRAMIENTA GIRA</text>
</svg>`;
}

function svgMachineTaladro(){
  return `<svg viewBox="0 0 600 290" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="290" fill="#131619"/>
  <g stroke="rgba(245,166,35,.03)" stroke-width="0.5"><line x1="0" y1="72" x2="600" y2="72"/><line x1="0" y1="145" x2="600" y2="145"/><line x1="0" y1="218" x2="600" y2="218"/><line x1="200" y1="0" x2="200" y2="290"/><line x1="400" y1="0" x2="400" y2="290"/></g>
  <!-- Base -->
  <rect x="180" y="240" width="240" height="20" fill="#1e2228" stroke="#3a4558" stroke-width="1.5" rx="3"/>
  <!-- Columna -->
  <rect x="285" y="46" width="30" height="196" fill="#1e2228" stroke="#3a4558" stroke-width="1.5"/>
  <!-- Cabezal -->
  <rect x="240" y="36" width="120" height="70" fill="#1e2228" stroke="#3a4558" stroke-width="2" rx="5"/>
  <!-- Motor -->
  <rect x="260" y="40" width="80" height="40" fill="#1a1e23" stroke="#2a3040" stroke-width="1" rx="3"/>
  <circle cx="300" cy="60" r="12" fill="#131619" stroke="#4fc3f7" stroke-width="1.5"/>
  <circle cx="300" cy="60" r="4" fill="#243040"/>
  <!-- Manivela -->
  <circle cx="355" cy="96" r="12" fill="#1e2228" stroke="#3a4558" stroke-width="1.5"/>
  <line x1="355" y1="84" x2="355" y2="108" stroke="#5c6a7a" stroke-width="2"/>
  <circle cx="355" cy="86" r="5" fill="#3a4558"/>
  <text x="380" y="100" fill="#5c6a7a" font-size="9" font-family="Share Tech Mono">PALANCA</text>
  <!-- Portabrocas -->
  <rect x="290" y="106" width="20" height="25" fill="#243040" stroke="#5c6a7a" stroke-width="1" rx="2"/>
  <!-- Broca: portabrocas hasta justo tocar la pieza (y=198) -->
  <rect x="294" y="131" width="12" height="58" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1.5"/>
  <!-- Punta broca: polígono apunta a y=198 (toca la pieza) -->
  <polygon points="294,189 300,204 306,189" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="2"/>
  <!-- Espiral broca -->
  <path d="M 297 138 Q 303 146, 297 154 Q 303 162, 297 170 Q 303 178, 297 186" fill="none" stroke="#4fc3f7" stroke-width="1" opacity=".7"/>
  <!-- Mesa taladro -->
  <rect x="220" y="218" width="160" height="22" fill="#1a1e23" stroke="#3a4558" stroke-width="1.5" rx="2"/>
  <!-- Pieza sobre mesa (pieza top = y=198) -->
  <rect x="240" y="198" width="120" height="22" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="1.5" rx="2"/>
  <!-- Agujero parcial en la pieza (la broca está penetrando) -->
  <rect x="293" y="198" width="14" height="14" fill="#0d0f12" stroke="#3a4558" stroke-width="1"/>
  <!-- Viruta de la broca -->
  <ellipse cx="285" cy="196" rx="4" ry="2" fill="#f39c12" opacity=".7" transform="rotate(-30 285 196)"/>
  <ellipse cx="316" cy="196" rx="4" ry="2" fill="#f39c12" opacity=".5" transform="rotate(20 316 196)"/>
  <!-- Flecha de rotación broca -->
  <path d="M 316 142 Q 330 134 330 150" fill="none" stroke="#f5a623" stroke-width="2"/>
  <polygon points="330,150 322,142 332,142" fill="#f5a623"/>
  <text x="340" y="140" fill="#f5a623" font-size="9" font-family="Share Tech Mono">GIRA</text>
  <!-- Flecha de avance (broca baja) -->
  <path d="M 265 160 L 265 188" fill="none" stroke="#3ddc84" stroke-width="2"/>
  <polygon points="265,188 260,178 270,178" fill="#3ddc84"/>
  <text x="206" y="176" fill="#3ddc84" font-size="9" font-family="Share Tech Mono">BAJA</text>
  <text x="300" y="278" fill="#f5a623" font-size="11" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="2">TALADRO — LA BROCA GIRA Y BAJA</text>
</svg>`;
}

function svgMaterialIdentification(){
  return `<svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="200" fill="#131619"/>
  <!-- Título -->
  <text x="300" y="22" fill="#9aa5b4" font-size="10" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="2">CÓMO IDENTIFICAR EL MATERIAL</text>
  <!-- Barra con grabado -->
  <rect x="40" y="60" width="140" height="50" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1.5" rx="4"/>
  <text x="110" y="80" fill="#4fc3f7" font-size="11" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">AISI 1045</text>
  <text x="110" y="96" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">HB 200-250</text>
  <text x="110" y="126" fill="#9aa5b4" font-size="9" text-anchor="middle" font-family="Share Tech Mono">① Grabado en la barra</text>
  <!-- Plano técnico -->
  <rect x="220" y="50" width="100" height="70" fill="#1a1e23" stroke="#3a4558" stroke-width="1.5" rx="2"/>
  <line x1="230" y1="62" x2="310" y2="62" stroke="#2a3040" stroke-width="1"/>
  <line x1="230" y1="72" x2="290" y2="72" stroke="#2a3040" stroke-width="1"/>
  <line x1="230" y1="82" x2="300" y2="82" stroke="#2a3040" stroke-width="1"/>
  <rect x="230" y="92" width="80" height="18" fill="#1d2d3e" stroke="#f5a623" stroke-width="1" rx="1"/>
  <text x="270" y="104" fill="#f5a623" font-size="8" text-anchor="middle" font-family="Share Tech Mono">MAT: A36</text>
  <text x="270" y="136" fill="#9aa5b4" font-size="9" text-anchor="middle" font-family="Share Tech Mono">② En el plano</text>
  <!-- Colores de referencia -->
  <rect x="360" y="50" width="40" height="30" fill="#b87333" stroke="#3a4558" stroke-width="1" rx="2"/>
  <text x="380" y="70" fill="white" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Cu</text>
  <rect x="405" y="50" width="40" height="30" fill="#c0c0c0" stroke="#3a4558" stroke-width="1" rx="2"/>
  <text x="425" y="70" fill="#131619" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Al</text>
  <rect x="450" y="50" width="40" height="30" fill="#4a4a4a" stroke="#3a4558" stroke-width="1" rx="2"/>
  <text x="470" y="70" fill="white" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Fe</text>
  <text x="430" y="96" fill="#5c6a7a" font-size="7" text-anchor="middle" font-family="Share Tech Mono">Cobre/Bronce · Aluminio · Acero</text>
  <text x="430" y="136" fill="#9aa5b4" font-size="9" text-anchor="middle" font-family="Share Tech Mono">③ Por el color</text>
  <text x="300" y="175" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">Si tienes dudas, pregunta a tu instructor — nunca adivines el material</text>
</svg>`;
}

function svgToolsIllustration(){
  return `<div class="wiz-illustration">
  <span class="wiz-illustration-label">Tipos de herramienta de corte</span>
  <svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="200" fill="#131619"/>
  <!-- HSS -->
  <rect x="20" y="50" width="120" height="20" fill="#4a4a4a" stroke="#9aa5b4" stroke-width="1.5" rx="2"/>
  <polygon points="140,50 160,60 140,70" fill="#9aa5b4" stroke="#5c6a7a" stroke-width="1"/>
  <text x="80" y="40" fill="#9aa5b4" font-size="10" text-anchor="middle" font-family="Share Tech Mono">HSS</text>
  <text x="80" y="88" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Gris oscuro</text>
  <text x="80" y="100" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Marcado "HSS"</text>
  <!-- Carburo -->
  <rect x="175" y="50" width="120" height="20" fill="#555" stroke="#9aa5b4" stroke-width="1.5" rx="2"/>
  <polygon points="295,50 315,60 295,70" fill="#e8eaed" stroke="#9aa5b4" stroke-width="1"/>
  <text x="245" y="40" fill="#e8eaed" font-size="10" text-anchor="middle" font-family="Share Tech Mono">CARBURO</text>
  <text x="245" y="88" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Filo brillante</text>
  <text x="245" y="100" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Marcado "HM" o "WC"</text>
  <!-- Cerámica -->
  <rect x="330" y="50" width="100" height="20" fill="#555" stroke="#9aa5b4" stroke-width="1.5" rx="2"/>
  <rect x="430" y="50" width="20" height="20" fill="#f5e6d0" stroke="#9aa5b4" stroke-width="1"/>
  <text x="390" y="40" fill="#f5e6d0" font-size="10" text-anchor="middle" font-family="Share Tech Mono">CERÁMICA</text>
  <text x="390" y="88" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Inserto blanco/crema</text>
  <text x="390" y="100" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Solo torneado</text>
  <!-- CBN -->
  <rect x="475" y="50" width="80" height="20" fill="#555" stroke="#9aa5b4" stroke-width="1.5" rx="2"/>
  <rect x="555" y="50" width="20" height="20" fill="#1a1a2e" stroke="#bb86fc" stroke-width="1.5"/>
  <text x="525" y="40" fill="#bb86fc" font-size="10" text-anchor="middle" font-family="Share Tech Mono">CBN</text>
  <text x="525" y="88" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Oscuro/dorado</text>
  <text x="525" y="100" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Muy caro</text>
  <!-- Texto guía -->
  <text x="300" y="140" fill="#f5a623" font-size="11" text-anchor="middle" font-family="Share Tech Mono">Mira el MANGO — siempre dice qué material es</text>
  <text x="300" y="160" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">En el taller universitario casi siempre usarás HSS o Carburo Cementado</text>
</svg></div>`;
}

function svgPassTypes(){
  return `<div class="wiz-illustration" style="border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg2);overflow:hidden;margin-bottom:0">
  <svg viewBox="0 0 600 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="200" fill="#131619"/>
  <!-- Pieza antes -->
  <text x="100" y="22" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="1">ANTES</text>
  <rect x="30" y="30" width="140" height="80" fill="#1d2d3e" stroke="#3a4558" stroke-width="1.5" rx="2"/>
  <text x="100" y="75" fill="#5c6a7a" font-size="10" text-anchor="middle" font-family="Share Tech Mono">Pieza bruta</text>
  <!-- Flecha -->
  <line x1="175" y1="70" x2="210" y2="70" stroke="#5c6a7a" stroke-width="1.5"/>
  <polygon points="210,70 202,65 202,75" fill="#5c6a7a"/>
  <!-- Desbaste -->
  <rect x="215" y="40" width="95" height="60" fill="#1d2d3e" stroke="#ff5252" stroke-width="2" rx="2"/>
  <text x="262" y="68" fill="#ff5252" font-size="9" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">DESBASTE</text>
  <text x="262" y="82" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Rugoso</text>
  <text x="262" y="115" fill="#ff5252" font-size="8" text-anchor="middle" font-family="Share Tech Mono">🔨 Rápido</text>
  <!-- Flecha -->
  <line x1="315" y1="70" x2="340" y2="70" stroke="#5c6a7a" stroke-width="1.5"/>
  <polygon points="340,70 332,65 332,75" fill="#5c6a7a"/>
  <!-- Semiacabado -->
  <rect x="342" y="44" width="85" height="52" fill="#1d2d3e" stroke="#f39c12" stroke-width="2" rx="2"/>
  <text x="384" y="68" fill="#f39c12" font-size="8" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">SEMI</text>
  <text x="384" y="80" fill="#f39c12" font-size="8" text-anchor="middle" font-family="Share Tech Mono">ACABADO</text>
  <text x="384" y="112" fill="#f39c12" font-size="8" text-anchor="middle" font-family="Share Tech Mono">⚖ Intermedio</text>
  <!-- Flecha -->
  <line x1="432" y1="70" x2="455" y2="70" stroke="#5c6a7a" stroke-width="1.5"/>
  <polygon points="455,70 447,65 447,75" fill="#5c6a7a"/>
  <!-- Acabado -->
  <rect x="458" y="48" width="80" height="44" fill="#1d2d3e" stroke="#3ddc84" stroke-width="2" rx="2"/>
  <text x="498" y="68" fill="#3ddc84" font-size="9" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">ACABADO</text>
  <text x="498" y="82" fill="#3ddc84" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Liso ✨</text>
  <text x="498" y="112" fill="#3ddc84" font-size="8" text-anchor="middle" font-family="Share Tech Mono">✨ Preciso</text>
  <!-- Regla de acabado superficial -->
  <text x="300" y="152" fill="#9aa5b4" font-size="10" text-anchor="middle" font-family="Share Tech Mono">Primero desbaste → Luego semiacabado → Finalmente acabado</text>
  <text x="300" y="170" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">Para el cálculo: elige el tipo de corte que estás haciendo AHORA</text>
</svg></div>`;
}

/* ── SVGs específicos de variables (versión wizard grande) ── */
function getVarSvg(op, varId){
  const map={
    'torneado_D': ()=>svgWizTorneadoD(),
    'torneado_L': ()=>svgWizTorneadoL(),
    'torneado_f': ()=>svgWizTorneadoF(),
    'fresado_D':  ()=>svgWizFresadoD(),
    'fresado_L':  ()=>svgWizFresadoL(),
    'fresado_Z':  ()=>svgWizFresadoZ(),
    'fresado_fz': ()=>svgWizFresadoFz(),
    'taladrado_D':()=>svgWizTaladradoD(),
    'taladrado_L':()=>svgWizTaladradoL(),
    'taladrado_f':()=>svgWizTaladradoF(),
  };
  return map[`${op}_${varId}`]||null;
}

function svgGenericMeasure(id, unit){
  return `<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="220" fill="#131619"/>
  <text x="300" y="100" fill="#2a3040" font-size="80" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">${id.toUpperCase()}</text>
  <text x="300" y="140" fill="#f5a623" font-size="18" text-anchor="middle" font-family="Share Tech Mono">Mide e ingresa el valor en ${unit}</text>
</svg>`;
}

/* ── D Torneado ── */
function svgWizTorneadoD(){
  return `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="260" fill="#131619"/>
  <g stroke="rgba(245,166,35,.025)" stroke-width="0.5"><line x1="0" y1="65" x2="600" y2="65"/><line x1="0" y1="130" x2="600" y2="130"/><line x1="0" y1="195" x2="600" y2="195"/><line x1="150" y1="0" x2="150" y2="260"/><line x1="300" y1="0" x2="300" y2="260"/><line x1="450" y1="0" x2="450" y2="260"/></g>
  <!-- Eje -->
  <line x1="60" y1="130" x2="560" y2="130" stroke="rgba(245,166,35,.3)" stroke-width="1" stroke-dasharray="10,5"/>
  <!-- Chuck -->
  <rect x="35" y="78" width="65" height="104" fill="#1e2228" stroke="#3a4558" stroke-width="2" rx="3"/>
  <text x="67" y="134" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">CHUCK</text>
  <!-- Pieza -->
  <rect x="100" y="82" width="370" height="96" fill="#1d2d3e" stroke="none"/>
  <ellipse cx="470" cy="130" rx="8" ry="48" fill="#152030" stroke="#4fc3f7" stroke-width="2"/>
  <line x1="100" y1="82" x2="470" y2="82" stroke="#4fc3f7" stroke-width="2"/>
  <line x1="100" y1="178" x2="470" y2="178" stroke="#4fc3f7" stroke-width="2"/>
  <!-- Calibrador más grande y visible -->
  <g opacity=".95">
    <!-- Cuerpo calibrador -->
    <rect x="200" y="30" width="80" height="14" fill="#f5a623" rx="3"/>
    <rect x="220" y="44" width="12" height="42" fill="#f5a623" rx="1"/>
    <!-- Escala -->
    <rect x="205" y="32" width="60" height="6" fill="rgba(0,0,0,.3)" rx="1"/>
    <line x1="210" y1="31" x2="210" y2="34" stroke="#0d0f12" stroke-width="1.5"/>
    <line x1="220" y1="31" x2="220" y2="34" stroke="#0d0f12" stroke-width="1.5"/>
    <line x1="230" y1="31" x2="230" y2="35" stroke="#0d0f12" stroke-width="1.5"/>
    <line x1="240" y1="31" x2="240" y2="34" stroke="#0d0f12" stroke-width="1.5"/>
    <line x1="250" y1="31" x2="250" y2="34" stroke="#0d0f12" stroke-width="1.5"/>
    <line x1="260" y1="31" x2="260" y2="35" stroke="#0d0f12" stroke-width="1.5"/>
    <text x="240" y="27" fill="#f5a623" font-size="8" text-anchor="middle" font-family="Share Tech Mono">mm</text>
    <!-- Mordaza superior -->
    <rect x="195" y="44" width="16" height="40" fill="#f5a623" rx="1"/>
    <!-- Mordaza inferior -->
    <rect x="195" y="172" width="80" height="14" fill="#f5a623" rx="3"/>
    <rect x="195" y="146" width="16" height="26" fill="#f5a623" rx="1"/>
  </g>
  <!-- Flecha D horizontal entre mordazas -->
  <line x1="215" y1="82" x2="215" y2="178" stroke="#f5a623" stroke-width="3"/>
  <polygon points="215,82 208,96 222,96" fill="#f5a623"/>
  <polygon points="215,178 208,164 222,164" fill="#f5a623"/>
  <!-- Etiqueta D grande -->
  <rect x="228" y="118" width="36" height="28" fill="#0d0f12" rx="6"/>
  <text x="246" y="136" fill="#f5a623" font-size="20" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">D</text>
  <!-- Nota -->
  <rect x="290" y="88" width="200" height="18" fill="rgba(79,195,247,.1)" rx="4"/>
  <text x="390" y="100" fill="#4fc3f7" font-size="10" text-anchor="middle" font-family="Share Tech Mono">← Mide AQUÍ con el calibrador</text>
  <!-- Flecha apuntando a zona -->
  <line x1="290" y1="97" x2="260" y2="110" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="260,110 265,100 270,108" fill="#4fc3f7"/>
  <!-- Instrucción abajo -->
  <text x="300" y="218" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">D = medida de un lado al otro pasando por el centro</text>
  <text x="300" y="238" fill="#5c6a7a" font-size="10" text-anchor="middle" font-family="Share Tech Mono">Cierra las mordazas del calibrador sobre la pieza · Lee el número</text>
</svg>`;
}

/* ── L Torneado ── */
function svgWizTorneadoL(){
  return `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="240" fill="#131619"/>
  <g stroke="rgba(245,166,35,.025)" stroke-width="0.5"><line x1="0" y1="60" x2="600" y2="60"/><line x1="0" y1="120" x2="600" y2="120"/><line x1="0" y1="180" x2="600" y2="180"/></g>
  <line x1="50" y1="120" x2="560" y2="120" stroke="rgba(245,166,35,.25)" stroke-width="1" stroke-dasharray="8,4"/>
  <!-- Chuck -->
  <rect x="30" y="78" width="65" height="84" fill="#1e2228" stroke="#3a4558" stroke-width="2" rx="3"/>
  <text x="62" y="123" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">CHUCK</text>
  <!-- Pieza -->
  <rect x="95" y="85" width="390" height="70" fill="#1d2d3e"/>
  <ellipse cx="485" cy="120" rx="7" ry="35" fill="#152030" stroke="#4fc3f7" stroke-width="2"/>
  <line x1="95" y1="85" x2="485" y2="85" stroke="#4fc3f7" stroke-width="2"/>
  <line x1="95" y1="155" x2="485" y2="155" stroke="#4fc3f7" stroke-width="2"/>
  <!-- Zona de corte (highlight) -->
  <rect x="180" y="85" width="230" height="70" fill="rgba(245,166,35,.06)" stroke="rgba(245,166,35,.4)" stroke-width="1.5" stroke-dasharray="5,3"/>
  <!-- Marcas inicio y fin -->
  <line x1="180" y1="70" x2="180" y2="165" stroke="#f5a623" stroke-width="2"/>
  <line x1="410" y1="70" x2="410" y2="165" stroke="#f5a623" stroke-width="2"/>
  <!-- Flecha L -->
  <line x1="180" y1="62" x2="410" y2="62" stroke="#f5a623" stroke-width="3"/>
  <polygon points="180,62 192,56 192,68" fill="#f5a623"/>
  <polygon points="410,62 398,56 398,68" fill="#f5a623"/>
  <!-- Etiqueta L -->
  <rect x="277" y="50" width="36" height="28" fill="#0d0f12" rx="6"/>
  <text x="295" y="68" fill="#f5a623" font-size="20" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">L</text>
  <!-- Texto en zona -->
  <text x="295" y="122" fill="rgba(245,166,35,.5)" font-size="10" text-anchor="middle" font-family="Share Tech Mono">ZONA A MECANIZAR</text>
  <!-- Herramienta -->
  <polygon points="430,106 448,114 430,122" fill="#9aa5b4" stroke="#5c6a7a" stroke-width="1"/>
  <rect x="448" y="112" width="30" height="5" fill="#5c6a7a"/>
  <!-- Regla al costado -->
  <rect x="504" y="85" width="16" height="70" fill="#1e2228" stroke="#9aa5b4" stroke-width="1" rx="1"/>
  <line x1="505" y1="92" x2="516" y2="92" stroke="#9aa5b4" stroke-width="1"/>
  <line x1="505" y1="100" x2="512" y2="100" stroke="#9aa5b4" stroke-width="0.7"/>
  <line x1="505" y1="108" x2="516" y2="108" stroke="#9aa5b4" stroke-width="1"/>
  <line x1="505" y1="116" x2="512" y2="116" stroke="#9aa5b4" stroke-width="0.7"/>
  <line x1="505" y1="124" x2="516" y2="124" stroke="#9aa5b4" stroke-width="1"/>
  <line x1="505" y1="132" x2="512" y2="132" stroke="#9aa5b4" stroke-width="0.7"/>
  <line x1="505" y1="140" x2="516" y2="140" stroke="#9aa5b4" stroke-width="1"/>
  <line x1="505" y1="148" x2="512" y2="148" stroke="#9aa5b4" stroke-width="0.7"/>
  <text x="512" y="205" fill="#5c6a7a" font-size="8" font-family="Share Tech Mono" text-anchor="middle">REGLA</text>
  <text x="300" y="198" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">L = distancia desde donde empieza hasta donde termina el corte</text>
  <text x="300" y="218" fill="#5c6a7a" font-size="10" text-anchor="middle" font-family="Share Tech Mono">Usa una regla metálica paralela al eje de la pieza</text>
</svg>`;
}

/* ── f Torneado ── */
function svgWizTorneadoF(){
  return `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="240" fill="#131619"/>
  <!-- Representación de 1 vuelta = f -->
  <rect x="50" y="60" width="420" height="100" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="1.5" rx="3"/>
  <!-- Hélice de avance -->
  <path d="M 80 110 Q 130 60, 180 110 Q 230 160, 280 110 Q 330 60, 380 110 Q 430 160, 470 110" fill="none" stroke="rgba(245,166,35,.5)" stroke-width="2" stroke-dasharray="6,3"/>
  <!-- Marcas de 1 vuelta -->
  <line x1="80"  y1="50" x2="80"  y2="170" stroke="#4fc3f7" stroke-width="1.5" stroke-dasharray="4,3" opacity=".6"/>
  <line x1="280" y1="50" x2="280" y2="170" stroke="#4fc3f7" stroke-width="1.5" stroke-dasharray="4,3" opacity=".6"/>
  <!-- Arco de 1 revolución -->
  <path d="M 80 46 Q 180 32 280 46" fill="none" stroke="#4fc3f7" stroke-width="2"/>
  <polygon points="280,46 268,40 272,50" fill="#4fc3f7"/>
  <text x="180" y="28" fill="#4fc3f7" font-size="11" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">1 VUELTA COMPLETA</text>
  <!-- Flecha f -->
  <line x1="80" y1="172" x2="280" y2="172" stroke="#f5a623" stroke-width="3"/>
  <polygon points="80,172 92,166 92,178" fill="#f5a623"/>
  <polygon points="280,172 268,166 268,178" fill="#f5a623"/>
  <rect x="152" y="162" width="56" height="24" fill="#0d0f12" rx="6"/>
  <text x="180" y="178" fill="#f5a623" font-size="18" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">f</text>
  <!-- Tabla de referencia -->
  <rect x="490" y="50" width="100" height="110" fill="#1e2228" stroke="#2a3040" stroke-width="1" rx="4"/>
  <text x="540" y="66" fill="#9aa5b4" font-size="9" text-anchor="middle" font-family="Share Tech Mono">TABLA f</text>
  <line x1="495" y1="70" x2="585" y2="70" stroke="#2a3040" stroke-width="1"/>
  <text x="516" y="84" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Desbaste</text><text x="566" y="84" fill="#ff5252" font-size="8" text-anchor="middle" font-family="Share Tech Mono">0.25-0.50</text>
  <text x="516" y="98" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Semiacab.</text><text x="566" y="98" fill="#f39c12" font-size="8" text-anchor="middle" font-family="Share Tech Mono">0.10-0.25</text>
  <text x="516" y="112" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">Acabado</text><text x="566" y="112" fill="#3ddc84" font-size="8" text-anchor="middle" font-family="Share Tech Mono">0.05-0.10</text>
  <text x="300" y="205" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">f = cuánto avanza la herramienta por cada vuelta</text>
  <text x="300" y="225" fill="#3ddc84" font-size="11" text-anchor="middle" font-family="Share Tech Mono">✓ NO se mide — se elige según el tipo de pasada</text>
</svg>`;
}

/* ── D Fresado ── */
function svgWizFresadoD(){
  return `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="260" fill="#131619"/>
  <!-- Fresa vista frontal (grande y centrada) -->
  <circle cx="230" cy="118" r="85" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="2"/>
  <!-- Dientes (4) -->
  <polygon points="218,33 230,15 242,33 242,55 218,55" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="315,106 333,118 315,130 293,130 293,106" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="218,203 230,221 242,203 242,181 218,181" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="127,106 109,118 127,130 149,130 149,106" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <!-- Centro -->
  <circle cx="230" cy="118" r="20" fill="#131619" stroke="#3a4558" stroke-width="1.5"/>
  <circle cx="230" cy="118" r="6"  fill="#f5a623"/>
  <!-- Flecha diámetro -->
  <line x1="145" y1="118" x2="315" y2="118" stroke="#f5a623" stroke-width="3.5"/>
  <polygon points="145,118 160,111 160,125" fill="#f5a623"/>
  <polygon points="315,118 300,111 300,125" fill="#f5a623"/>
  <!-- Etiqueta D -->
  <rect x="214" y="106" width="32" height="26" fill="#0d0f12" rx="6"/>
  <text x="230" y="123" fill="#f5a623" font-size="18" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">D</text>
  <!-- Anotación mango -->
  <rect x="218" y="203" width="24" height="38" fill="#243040" stroke="#3a4558" stroke-width="1.5" rx="2"/>
  <text x="230" y="228" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">MANGO</text>
  <text x="230" y="246" fill="#5c6a7a" font-size="7" text-anchor="middle" font-family="Share Tech Mono">NO medir aquí</text>
  <!-- Instrucciones a la derecha -->
  <rect x="360" y="50" width="220" height="160" fill="#1e2228" stroke="#2a3040" stroke-width="1" rx="8"/>
  <text x="470" y="72" fill="#9aa5b4" font-size="10" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="1">CÓMO MEDIR</text>
  <line x1="368" y1="78" x2="572" y2="78" stroke="#2a3040" stroke-width="1"/>
  <text x="380" y="96" fill="#4fc3f7" font-size="10" font-family="Share Tech Mono">1. Toma la fresa</text>
  <text x="380" y="112" fill="#4fc3f7" font-size="10" font-family="Share Tech Mono">2. Abre el calibrador</text>
  <text x="380" y="128" fill="#4fc3f7" font-size="10" font-family="Share Tech Mono">3. Mide de punta</text>
  <text x="390" y="144" fill="#4fc3f7" font-size="10" font-family="Share Tech Mono">a punta</text>
  <text x="380" y="162" fill="#f5a623" font-size="10" font-family="Share Tech Mono">4. Lee el número</text>
  <text x="380" y="194" fill="#3ddc84" font-size="9" font-family="Share Tech Mono">✓ O mira el mango:</text>
  <text x="380" y="208" fill="#3ddc84" font-size="9" font-family="Share Tech Mono">  "⌀20" = D=20mm</text>
</svg>`;
}

/* ── Z Fresado ── */
function svgWizFresadoZ(){
  return `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="260" fill="#131619"/>
  <!-- Fresa 4 dientes con numeración grande -->
  <circle cx="200" cy="120" r="80" fill="#1d2d3e" stroke="#3a4558" stroke-width="1.5"/>
  <circle cx="200" cy="120" r="32" fill="#131619" stroke="#3a4558" stroke-width="1"/>
  <!-- Diente 1 - arriba - AMARILLO (activo) -->
  <path d="M 188,40 Q 200,22 212,40 L 212,62 Q 200,56 188,62 Z" fill="#2a4060" stroke="#f5a623" stroke-width="2.5"/>
  <circle cx="200" cy="42" r="10" fill="rgba(245,166,35,.25)" stroke="#f5a623" stroke-width="2"/>
  <text x="200" y="47" fill="#f5a623" font-size="12" font-weight="bold" text-anchor="middle" font-family="Share Tech Mono">1</text>
  <!-- Diente 2 - derecha -->
  <path d="M 278,108 Q 296,120 278,132 L 258,132 Q 264,120 258,108 Z" fill="#2a4060" stroke="#4fc3f7" stroke-width="2"/>
  <circle cx="290" cy="120" r="10" fill="rgba(79,195,247,.15)" stroke="#4fc3f7" stroke-width="2"/>
  <text x="290" y="125" fill="#4fc3f7" font-size="12" font-weight="bold" text-anchor="middle" font-family="Share Tech Mono">2</text>
  <!-- Diente 3 - abajo -->
  <path d="M 212,200 Q 200,218 188,200 L 188,178 Q 200,184 212,178 Z" fill="#2a4060" stroke="#4fc3f7" stroke-width="2"/>
  <circle cx="200" cy="200" r="10" fill="rgba(79,195,247,.15)" stroke="#4fc3f7" stroke-width="2"/>
  <text x="200" y="205" fill="#4fc3f7" font-size="12" font-weight="bold" text-anchor="middle" font-family="Share Tech Mono">3</text>
  <!-- Diente 4 - izquierda -->
  <path d="M 120,132 Q 102,120 120,108 L 140,108 Q 134,120 140,132 Z" fill="#2a4060" stroke="#4fc3f7" stroke-width="2"/>
  <circle cx="108" cy="120" r="10" fill="rgba(79,195,247,.15)" stroke="#4fc3f7" stroke-width="2"/>
  <text x="108" y="125" fill="#4fc3f7" font-size="12" font-weight="bold" text-anchor="middle" font-family="Share Tech Mono">4</text>
  <!-- Centro y etiqueta Z -->
  <circle cx="200" cy="120" r="8" fill="#0d0f12" stroke="#5c6a7a"/>
  <text x="200" y="130" fill="#9aa5b4" font-size="10" text-anchor="middle" font-family="Share Tech Mono">Z=4</text>
  <!-- Instrucciones a la derecha -->
  <rect x="340" y="50" width="240" height="180" fill="#1e2228" stroke="#2a3040" stroke-width="1" rx="8"/>
  <text x="460" y="72" fill="#9aa5b4" font-size="10" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="1">CONTAR DIENTES Z</text>
  <line x1="348" y1="78" x2="572" y2="78" stroke="#2a3040" stroke-width="1"/>
  <text x="356" y="100" fill="#4fc3f7" font-size="11" font-family="Share Tech Mono">1. Mira la punta de</text>
  <text x="356" y="116" fill="#4fc3f7" font-size="11" font-family="Share Tech Mono">   la fresa de frente</text>
  <text x="356" y="136" fill="#4fc3f7" font-size="11" font-family="Share Tech Mono">2. Cuenta los filos</text>
  <text x="356" y="152" fill="#4fc3f7" font-size="11" font-family="Share Tech Mono">   cortantes</text>
  <text x="356" y="172" fill="#f5a623" font-size="10" font-family="Share Tech Mono">★ Común: 2, 3 o 4</text>
  <text x="356" y="192" fill="#3ddc84" font-size="9" font-family="Share Tech Mono">✓ 2 filos = aluminio</text>
  <text x="356" y="208" fill="#3ddc84" font-size="9" font-family="Share Tech Mono">✓ 4 filos = acero</text>
  <text x="460" y="246" fill="#f5a623" font-size="11" text-anchor="middle" font-family="Share Tech Mono">El número 1 (amarillo) = diente cortando ahora</text>
</svg>`;
}

/* ── L Fresado ── */
function svgWizFresadoL(){
  return `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="240" fill="#131619"/>
  <!-- Mesa y pieza -->
  <rect x="40" y="170" width="520" height="22" fill="#1e2228" stroke="#3a4558" stroke-width="1.5" rx="2"/>
  <rect x="80" y="140" width="440" height="32" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="1.5" rx="2"/>
  <!-- Ranura fresada -->
  <rect x="150" y="140" width="240" height="14" fill="#0d1520" stroke="#3a4558" stroke-width="1" rx="1"/>
  <!-- Fresa encima -->
  <circle cx="270" cy="96" r="34" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="2"/>
  <!-- Dientes -->
  <polygon points="258,62 270,50 282,62" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="304,84 316,96 304,108" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="258,130 270,142 282,130" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <polygon points="236,84 224,96 236,108" fill="#243040" stroke="#4fc3f7" stroke-width="1.5"/>
  <circle cx="270" cy="96" r="10" fill="#131619" stroke="#3a4558" stroke-width="1"/>
  <!-- Mango -->
  <rect x="265" y="30" width="10" height="34" fill="#243040" stroke="#3a4558" stroke-width="1" rx="2"/>
  <!-- Líneas de inicio y fin L -->
  <line x1="150" y1="120" x2="150" y2="158" stroke="#f5a623" stroke-width="2"/>
  <line x1="390" y1="120" x2="390" y2="158" stroke="#f5a623" stroke-width="2"/>
  <!-- Flecha L -->
  <line x1="150" y1="118" x2="390" y2="118" stroke="#f5a623" stroke-width="3"/>
  <polygon points="150,118 162,112 162,124" fill="#f5a623"/>
  <polygon points="390,118 378,112 378,124" fill="#f5a623"/>
  <!-- Etiqueta L -->
  <rect x="254" y="106" width="32" height="26" fill="#0d0f12" rx="6"/>
  <text x="270" y="123" fill="#f5a623" font-size="18" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">L</text>
  <!-- Flecha dirección avance -->
  <path d="M 100 155 L 500 155" fill="none" stroke="rgba(61,220,132,.4)" stroke-width="1.5" stroke-dasharray="8,4"/>
  <polygon points="500,155 490,150 490,160" fill="rgba(61,220,132,.4)"/>
  <text x="300" y="170" fill="rgba(61,220,132,.6)" font-size="9" font-family="Share Tech Mono" text-anchor="middle">→ Dirección de avance de la mesa</text>
  <text x="300" y="202" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">L = largo de la ranura o superficie a fresar</text>
  <text x="300" y="220" fill="#5c6a7a" font-size="10" text-anchor="middle" font-family="Share Tech Mono">Mide con regla desde donde entra la fresa hasta donde sale</text>
</svg>`;
}

/* ── fz Fresado ── */
function svgWizFresadoFz(){
  return `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="240" fill="#131619"/>
  <!-- Pieza -->
  <rect x="30" y="90" width="480" height="60" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="1.5" rx="2"/>
  <!-- Huellas de cada diente -->
  <rect x="60"  y="90" width="72" height="12" fill="#0d1520" stroke="#3a4558" stroke-width="0.5" rx="1"/>
  <rect x="152" y="90" width="72" height="12" fill="#0d1520" stroke="#3a4558" stroke-width="0.5" rx="1"/>
  <rect x="244" y="90" width="72" height="12" fill="#0d1520" stroke="#3a4558" stroke-width="0.5" rx="1"/>
  <!-- fz entre dos posiciones de diente -->
  <line x1="60"  y1="80" x2="60"  y2="94" stroke="#f5a623" stroke-width="2"/>
  <line x1="132" y1="80" x2="132" y2="94" stroke="#f5a623" stroke-width="2"/>
  <line x1="60"  y1="76" x2="132" y2="76" stroke="#f5a623" stroke-width="3"/>
  <polygon points="60,76 72,70 72,82" fill="#f5a623"/>
  <polygon points="132,76 120,70 120,82" fill="#f5a623"/>
  <rect x="80" y="66" width="32" height="22" fill="#0d0f12" rx="5"/>
  <text x="96" y="80" fill="#f5a623" font-size="14" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">fz</text>
  <!-- Fresa en 3 posiciones (fantasma) -->
  <circle cx="96"  cy="62" r="28" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1" opacity=".3"/>
  <circle cx="188" cy="62" r="28" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1" opacity=".6"/>
  <circle cx="280" cy="62" r="28" fill="#1d2d3e" stroke="#f5a623" stroke-width="1.5"/>
  <text x="300" y="56" fill="#f5a623" font-size="9" font-family="Share Tech Mono">Posición actual</text>
  <!-- Tabla fz ref -->
  <rect x="420" y="65" width="160" height="105" fill="#1e2228" stroke="#2a3040" stroke-width="1" rx="6"/>
  <text x="500" y="82" fill="#9aa5b4" font-size="9" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="1">TABLA fz</text>
  <line x1="426" y1="88" x2="574" y2="88" stroke="#2a3040" stroke-width="1"/>
  <text x="450" y="102" fill="#ff5252" font-size="8" font-family="Share Tech Mono">Desbaste</text><text x="546" y="102" fill="#ff5252" font-size="8" font-family="Share Tech Mono">0.05-0.20</text>
  <text x="450" y="116" fill="#f39c12" font-size="8" font-family="Share Tech Mono">Semiacab.</text><text x="546" y="116" fill="#f39c12" font-size="8" font-family="Share Tech Mono">0.02-0.05</text>
  <text x="450" y="130" fill="#3ddc84" font-size="8" font-family="Share Tech Mono">Acabado</text><text x="546" y="130" fill="#3ddc84" font-size="8" font-family="Share Tech Mono">0.01-0.02</text>
  <text x="500" y="156" fill="#9aa5b4" font-size="8" text-anchor="middle" font-family="Share Tech Mono">mm / diente</text>
  <text x="300" y="178" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">fz = "bocado" que toma cada diente por vuelta</text>
  <text x="300" y="198" fill="#3ddc84" font-size="11" text-anchor="middle" font-family="Share Tech Mono">✓ NO se mide — se elige según la pasada</text>
  <text x="300" y="218" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">La calculadora lo autocompleta al elegir el tipo de pasada</text>
</svg>`;
}

/* ── D Taladrado ── */
function svgWizTaladradoD(){
  return `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="260" fill="#131619"/>
  <!-- Eje central -->
  <line x1="300" y1="0" x2="300" y2="260" stroke="rgba(245,166,35,.18)" stroke-width="1" stroke-dasharray="8,4"/>
  <!-- Mango broca -->
  <rect x="283" y="18" width="34" height="40" fill="#243040" stroke="#3a4558" stroke-width="1.5" rx="3"/>
  <text x="300" y="44" fill="#5c6a7a" font-size="8" text-anchor="middle" font-family="Share Tech Mono">⌀10</text>
  <!-- Cuerpo broca -->
  <rect x="284" y="58" width="32" height="120" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="2"/>
  <path d="M 288 68 Q 300 80,312 68 Q 318 60,318 74 Q 308 88,288 84 Q 284 92,288 106 Q 300 118,312 106 Q 318 98,318 112 Q 308 126,288 122 Q 284 130,288 144 Q 300 156,312 144 Q 318 136,318 150 Q 308 164,288 160" fill="none" stroke="#4fc3f7" stroke-width="1.5" opacity=".7"/>
  <!-- Punta broca (ángulo 118°) -->
  <polygon points="284,178 300,210 316,178" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="2.5"/>
  <!-- ═══ CALIBRADOR — mordazas tocan las caras del cuerpo de la broca ═══ -->
  <!-- Cuerpo del calibrador (regla superior) -->
  <rect x="230" y="32" width="140" height="10" fill="#f5a623" rx="3"/>
  <!-- Marcas de escala en la regla -->
  <rect x="235" y="34" width="100" height="4" fill="rgba(0,0,0,.25)" rx="1"/>
  <line x1="240" y1="32" x2="240" y2="35" stroke="#0d0f12" stroke-width="1"/>
  <line x1="252" y1="32" x2="252" y2="35" stroke="#0d0f12" stroke-width="1"/>
  <line x1="264" y1="32" x2="264" y2="36" stroke="#0d0f12" stroke-width="1.5"/>
  <line x1="276" y1="32" x2="276" y2="35" stroke="#0d0f12" stroke-width="1"/>
  <line x1="288" y1="32" x2="288" y2="35" stroke="#0d0f12" stroke-width="1"/>
  <line x1="300" y1="32" x2="300" y2="36" stroke="#0d0f12" stroke-width="1.5"/>
  <text x="270" y="28" fill="#f5a623" font-size="8" text-anchor="middle" font-family="Share Tech Mono">mm</text>
  <!-- Brazo izquierdo del calibrador (termina exactamente en x=284, borde izq de la broca) -->
  <rect x="234" y="42" width="10" height="52" fill="#f5a623" rx="1"/>  <!-- brazo vertical izq -->
  <rect x="234" y="86" width="50" height="10" fill="#f5a623" rx="1"/>  <!-- mordaza horizontal izq, hasta x=284 -->
  <!-- Brazo derecho del calibrador (empieza exactamente en x=316, borde der de la broca) -->
  <rect x="316" y="86" width="50" height="10" fill="#f5a623" rx="1"/>  <!-- mordaza horizontal der, desde x=316 -->
  <rect x="356" y="42" width="10" height="52" fill="#f5a623" rx="1"/>  <!-- brazo vertical der -->
  <!-- ═══ Flecha D — exactamente entre las caras de la broca ═══ -->
  <line x1="284" y1="118" x2="316" y2="118" stroke="#f5a623" stroke-width="3.5"/>
  <polygon points="284,118 296,111 296,125" fill="#f5a623"/>
  <polygon points="316,118 304,111 304,125" fill="#f5a623"/>
  <!-- Etiqueta D — flotando encima con fondo oscuro -->
  <rect x="284" y="104" width="32" height="24" fill="#0d0f12" rx="5"/>
  <text x="300" y="120" fill="#f5a623" font-size="16" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">D</text>
  <!-- Líneas guía de que las mordazas tocan la broca -->
  <line x1="284" y1="86" x2="284" y2="134" stroke="rgba(245,166,35,.35)" stroke-width="1" stroke-dasharray="3,2"/>
  <line x1="316" y1="86" x2="316" y2="134" stroke="rgba(245,166,35,.35)" stroke-width="1" stroke-dasharray="3,2"/>
  <!-- Nota del número en el mango -->
  <line x1="317" y1="38" x2="390" y2="22" stroke="#5c6a7a" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="396" y="18" fill="#5c6a7a" font-size="9" font-family="Share Tech Mono">Número grabado</text>
  <text x="396" y="30" fill="#4fc3f7" font-size="9" font-family="Share Tech Mono">= diámetro del agujero</text>
  <!-- Ángulo punta -->
  <path d="M 308 182 Q 316 194 308 205" fill="none" stroke="#5c6a7a" stroke-width="1"/>
  <text x="322" y="198" fill="#5c6a7a" font-size="9" font-family="Share Tech Mono">118°</text>
  <!-- Labels -->
  <text x="300" y="232" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">D = ancho de las alas cortantes de la broca</text>
  <text x="300" y="250" fill="#5c6a7a" font-size="10" text-anchor="middle" font-family="Share Tech Mono">También puedes leer el número grabado en el mango</text>
</svg>`;
}

/* ── L Taladrado ── */
function svgWizTaladradoL(){
  return `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="260" fill="#131619"/>
  <!-- Pieza (corte transversal) -->
  <rect x="100" y="60" width="320" height="140" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="2" rx="3"/>
  <!-- Agujero ciego -->
  <rect x="245" y="60" width="30" height="108" fill="#0d0f12" stroke="#3a4558" stroke-width="1"/>
  <!-- Fondo cónico del agujero ciego (punta broca) -->
  <polygon points="245,168 260,186 275,168" fill="#152030" stroke="#4fc3f7" stroke-width="1.5"/>
  <!-- Broca dentro -->
  <rect x="250" y="15" width="20" height="96" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1.5"/>
  <polygon points="250,111 260,126 270,111" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="1.5"/>
  <!-- Eje -->
  <line x1="260" y1="15" x2="260" y2="186" stroke="rgba(245,166,35,.25)" stroke-width="1" stroke-dasharray="5,3"/>
  <!-- Flecha L (parte cilíndrica solamente) -->
  <line x1="320" y1="60" x2="320" y2="168" stroke="#f5a623" stroke-width="3"/>
  <polygon points="320,60 313,74 327,74" fill="#f5a623"/>
  <polygon points="320,168 313,154 327,154" fill="#f5a623"/>
  <!-- Etiqueta L -->
  <rect x="330" y="104" width="32" height="26" fill="#0d0f12" rx="6"/>
  <text x="346" y="121" fill="#f5a623" font-size="18" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">L</text>
  <!-- Flechita 0.3D -->
  <line x1="338" y1="168" x2="338" y2="186" stroke="#3ddc84" stroke-width="2"/>
  <polygon points="338,168 333,175 343,175" fill="#3ddc84"/>
  <polygon points="338,186 333,179 343,179" fill="#3ddc84"/>
  <text x="355" y="180" fill="#3ddc84" font-size="10" font-family="Share Tech Mono">+0.3D</text>
  <text x="355" y="194" fill="#5c6a7a" font-size="8" font-family="Share Tech Mono">(automático)</text>
  <!-- Lineas guia L -->
  <line x1="275" y1="60"  x2="330" y2="60"  stroke="rgba(245,166,35,.5)" stroke-width="1"/>
  <line x1="275" y1="168" x2="330" y2="168" stroke="rgba(245,166,35,.5)" stroke-width="1"/>
  <!-- Espesor total -->
  <line x1="60" y1="60" x2="60" y2="200" stroke="#4fc3f7" stroke-width="2"/>
  <polygon points="60,60 54,74 66,74" fill="#4fc3f7"/>
  <polygon points="60,200 54,186 66,186" fill="#4fc3f7"/>
  <text x="40" y="128" fill="#4fc3f7" font-size="9" text-anchor="middle" font-family="Share Tech Mono">Espesor</text>
  <text x="40" y="140" fill="#4fc3f7" font-size="9" text-anchor="middle" font-family="Share Tech Mono">pieza</text>
  <text x="300" y="220" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">L = solo la parte CILÍNDRICA del agujero</text>
  <text x="300" y="240" fill="#3ddc84" font-size="10" text-anchor="middle" font-family="Share Tech Mono">✓ La calculadora suma 0.3D automáticamente — no tienes que hacerlo tú</text>
</svg>`;
}

/* ── f Taladrado ── */
function svgWizTaladradoF(){
  return `<svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="240" fill="#131619"/>
  <!-- Broca -->
  <line x1="260" y1="10" x2="260" y2="200" stroke="rgba(245,166,35,.2)" stroke-width="1" stroke-dasharray="5,3"/>
  <rect x="245" y="20" width="30" height="120" fill="#1d2d3e" stroke="#9aa5b4" stroke-width="1.5"/>
  <polygon points="245,140 260,162 275,140" fill="#1d2d3e" stroke="#4fc3f7" stroke-width="2"/>
  <path d="M 249 32 Q 260 42,271 32 Q 275 25,275 38 Q 265 52,249 48 Q 245 56,249 68 Q 260 78,271 68 Q 275 61,275 74 Q 265 88,249 84 Q 245 92,249 104 Q 260 114,271 104 Q 275 97,275 110 Q 265 124,249 120" fill="none" stroke="#4fc3f7" stroke-width="1.2" opacity=".7"/>
  <!-- Flecha de 1 revolución -->
  <path d="M 290 40 Q 320 30 320 50" fill="none" stroke="#4fc3f7" stroke-width="2"/>
  <polygon points="320,50 313,42 323,43" fill="#4fc3f7"/>
  <text x="335" y="38" fill="#4fc3f7" font-size="10" font-family="Share Tech Mono">1 vuelta</text>
  <!-- Flecha f (bajada) -->
  <line x1="180" y1="40" x2="180" y2="78" stroke="#f5a623" stroke-width="3"/>
  <polygon points="180,40 173,54 187,54" fill="#f5a623"/>
  <polygon points="180,78 173,64 187,64" fill="#f5a623"/>
  <rect x="158" y="50" width="32" height="22" fill="#0d0f12" rx="5"/>
  <text x="174" y="65" fill="#f5a623" font-size="15" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">f</text>
  <!-- Tabla por D -->
  <rect x="360" y="35" width="220" height="130" fill="#1e2228" stroke="#2a3040" stroke-width="1" rx="6"/>
  <text x="470" y="55" fill="#9aa5b4" font-size="9" text-anchor="middle" font-family="Share Tech Mono" letter-spacing="1">SEGÚN DIÁMETRO D</text>
  <line x1="366" y1="62" x2="574" y2="62" stroke="#2a3040" stroke-width="1"/>
  <text x="408" y="78" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">D &lt; 5 mm</text><text x="530" y="78" fill="#f5a623" font-size="9" text-anchor="middle" font-family="Share Tech Mono">f=0.05–0.10</text>
  <text x="408" y="96" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">5 ≤ D &lt; 15</text><text x="530" y="96" fill="#f5a623" font-size="9" text-anchor="middle" font-family="Share Tech Mono">f=0.10–0.20</text>
  <text x="408" y="114" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">15 ≤ D &lt; 30</text><text x="530" y="114" fill="#f5a623" font-size="9" text-anchor="middle" font-family="Share Tech Mono">f=0.20–0.35</text>
  <text x="408" y="132" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">D ≥ 30 mm</text><text x="530" y="132" fill="#f5a623" font-size="9" text-anchor="middle" font-family="Share Tech Mono">f=0.30–0.50</text>
  <text x="470" y="156" fill="#9aa5b4" font-size="8" text-anchor="middle" font-family="Share Tech Mono">mm por revolución</text>
  <text x="300" y="192" fill="#f5a623" font-size="12" text-anchor="middle" font-family="Share Tech Mono" font-weight="bold">f = cuánto baja la broca por cada vuelta</text>
  <text x="300" y="212" fill="#3ddc84" font-size="11" text-anchor="middle" font-family="Share Tech Mono">✓ NO se mide — elegir según el diámetro de la broca</text>
  <text x="300" y="228" fill="#5c6a7a" font-size="9" text-anchor="middle" font-family="Share Tech Mono">Brocas pequeñas usan f bajo. Brocas grandes pueden usar f mayor.</text>
</svg>`;
}

/* ══════════════════════════════════════════════
   MODALES DE AYUDA
══════════════════════════════════════════════ */
function openVarHelpModal(opId, varId){
  const guide=DB.guides?.operations?.[opId]?.variables?.[varId];
  if(!guide){ showToast('Sin guía disponible',''); return; }
  document.getElementById('helpModalContent').innerHTML=`
    <div class="modal-title">${guide.symbol.toUpperCase()} — ${guide.name}</div>
    <div class="modal-subtitle">Cómo medir · ${guide.unit}</div>
    <div class="modal-plain">${guide.plainDescription}</div>
    ${guide.whereToMeasure?`<div class="modal-plain" style="border-left-color:var(--blue)">📍 ${guide.whereToMeasure}</div>`:''}
    ${guide.steps?.length?`<div style="font-family:var(--mono);font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">Pasos</div>
    <ul style="list-style:none">${guide.steps.map((s,i)=>`<li style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)"><span style="width:20px;height:20px;border-radius:50%;background:rgba(245,166,35,.1);border:1px solid rgba(245,166,35,.3);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--accent);flex-shrink:0">${i+1}</span>${s}</li>`).join('')}</ul>`:''}`;
  openModal();
}
function openMaterialHelp(){
  document.getElementById('helpModalContent').innerHTML=`
    <div class="modal-title">¿Cómo identifico el material?</div>
    <div class="modal-plain">El material siempre debe estar en el plano técnico. Si no tienes plano, mira si la barra tiene un número grabado (ej: "AISI 1045"). Si es rojiza = cobre/bronce. Si es plateada y liviana = aluminio. Si es gris y pesada = acero. Si tienes dudas, pregunta al instructor.</div>`;
  openModal();
}
function openToolHelp(){
  document.getElementById('helpModalContent').innerHTML=`
    <div class="modal-title">¿Cómo identifico la herramienta?</div>
    <div class="modal-plain">Mira el mango de la herramienta. Si dice "HSS" o "M2" → Acero Rápido. Si dice "HM", "WC" o "Carbide" → Carburo. Si el inserto es blanco/crema → Cerámica. Si no puedes identificarla, pregunta al técnico del laboratorio.</div>`;
  openModal();
}
function openPassHelp(){
  document.getElementById('helpModalContent').innerHTML=`
    <div class="modal-title">¿Qué tipo de pasada es?</div>
    <div class="modal-plain"><strong>Desbaste 🔨</strong> — Quitar mucho material rápido. La superficie queda rugosa. Avance grande.<br><br><strong>Semiacabado ⚖️</strong> — Afinar la forma. Queda poco material. Avance mediano.<br><br><strong>Acabado ✨</strong> — El corte final. Superficie lisa y dimensiones exactas. Avance pequeño.</div>`;
  openModal();
}
function openResultHelp(key){
  const d={
    S:{t:'¿Qué hago con S (rpm)?',c:'S es la velocidad a la que debe girar el husillo de tu máquina. En el torno: ajusta la palanca de velocidades al valor más cercano disponible. En CNC: es el valor "S" en el programa (Ej: S637).'},
    F:{t:'¿Qué hago con F (mm/min)?',c:'F es la velocidad de avance — qué tan rápido se mueve la herramienta. En torno manual: ajusta la palanca de avances. En CNC: es el valor "F" en el programa (Ej: F127).'},
    t:{t:'¿Qué hago con t (min)?',c:'t es el tiempo teórico del corte. Es solo una estimación — el tiempo real incluye preparación, montaje y mediciones. Si t = 0.8 min, el corte dura aprox. 48 segundos.'}
  }[key];
  if(!d)return;
  document.getElementById('helpModalContent').innerHTML=`<div class="modal-title">${d.t}</div><div class="modal-plain">${d.c}</div>`;
  openModal();
}
function openModal(){
  document.getElementById('helpOverlay').classList.add('show');
  document.getElementById('helpModal').classList.add('show');
  document.body.style.overflow='hidden';
}
function closeHelpModal(){
  document.getElementById('helpOverlay').classList.remove('show');
  document.getElementById('helpModal').classList.remove('show');
  document.body.style.overflow='';
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeHelpModal(); });

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function animVal(id,val){ const e=document.getElementById(id); if(!e)return; e.classList.remove('animated'); void e.offsetWidth; e.textContent=val; e.classList.add('animated'); }
function fmt(n){ return parseFloat(n.toFixed(2)).toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtT(n){ return parseFloat(n.toFixed(4)).toLocaleString('es-CO',{minimumFractionDigits:4,maximumFractionDigits:4}); }
function fmtD(n){ return parseFloat(parseFloat(n).toFixed(3)).toString(); }
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(m,t=''){
  const el=document.getElementById('toast'); el.textContent=m; el.className='toast show '+t;
  setTimeout(()=>el.classList.remove('show'),3200);
}
function showWarning(m){ const w=document.getElementById('warningBox'); if(!w)return; w.textContent=m; w.classList.add('show'); document.getElementById('resultsWrapper')?.classList.add('visible'); }
function hideWarning(){ document.getElementById('warningBox')?.classList.remove('show'); }
function startClock(){
  const el=document.getElementById('currentTime');
  const tick=()=>{ if(el) el.textContent=new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); };
  tick(); setInterval(tick,1000);
}

/* ══════════════════════════════════════════════
   DATOS EMBEBIDOS (fallback)
══════════════════════════════════════════════ */
function getEmbeddedData(){
  return {
    toolMaterials:[
      {id:'hss',label:'Acero Rápido (HSS)',icon:'⚙️',description:'Herramienta más común y económica. Ideal para velocidades bajas y materiales blandos.'},
      {id:'carburo',label:'Carburo Cementado',icon:'💎',description:'Muy dura y resistente al calor. Permite velocidades de corte mucho más altas.'},
      {id:'ceramica',label:'Cerámica',icon:'🔬',description:'Para velocidades muy altas en materiales duros. Solo torneado.'},
      {id:'cbn',label:'CBN / Diamante',icon:'✦',description:'La herramienta más dura. Solo para materiales muy difíciles.'}
    ],
    workpieceMaterials:[
      {id:'acero_suave',label:'Acero Suave (Bajo Carbono)',group:'Aceros',hardness:'HB 120-180',cuttingSpeeds:{hss:{torneado:30,fresado:25,taladrado:28},carburo:{torneado:120,fresado:100,taladrado:90},ceramica:{torneado:280,fresado:0,taladrado:0},cbn:{torneado:400,fresado:0,taladrado:0}}},
      {id:'acero_medio',label:'Acero Medio Carbono',group:'Aceros',hardness:'HB 180-250',cuttingSpeeds:{hss:{torneado:25,fresado:20,taladrado:22},carburo:{torneado:100,fresado:80,taladrado:75},ceramica:{torneado:240,fresado:0,taladrado:0},cbn:{torneado:350,fresado:0,taladrado:0}}},
      {id:'acero_alto',label:'Acero Alto Carbono',group:'Aceros',hardness:'HB 250-320',cuttingSpeeds:{hss:{torneado:18,fresado:15,taladrado:16},carburo:{torneado:80,fresado:65,taladrado:60},ceramica:{torneado:200,fresado:0,taladrado:0},cbn:{torneado:300,fresado:0,taladrado:0}}},
      {id:'acero_inox',label:'Acero Inoxidable 304',group:'Aceros',hardness:'HB 150-200',cuttingSpeeds:{hss:{torneado:15,fresado:12,taladrado:10},carburo:{torneado:60,fresado:50,taladrado:45},ceramica:{torneado:150,fresado:0,taladrado:0},cbn:{torneado:200,fresado:0,taladrado:0}}},
      {id:'hierro_gris',label:'Hierro Fundido Gris',group:'Hierros',hardness:'HB 180-260',cuttingSpeeds:{hss:{torneado:25,fresado:20,taladrado:22},carburo:{torneado:100,fresado:80,taladrado:75},ceramica:{torneado:300,fresado:180,taladrado:0},cbn:{torneado:450,fresado:0,taladrado:0}}},
      {id:'aluminio',label:'Aluminio (Aleaciones)',group:'No Ferrosos',hardness:'HB 30-80',cuttingSpeeds:{hss:{torneado:100,fresado:80,taladrado:90},carburo:{torneado:300,fresado:250,taladrado:220},ceramica:{torneado:600,fresado:400,taladrado:0},cbn:{torneado:800,fresado:600,taladrado:0}}},
      {id:'bronce',label:'Bronce / Latón',group:'No Ferrosos',hardness:'HB 80-150',cuttingSpeeds:{hss:{torneado:50,fresado:40,taladrado:45},carburo:{torneado:150,fresado:120,taladrado:110},ceramica:{torneado:0,fresado:0,taladrado:0},cbn:{torneado:0,fresado:0,taladrado:0}}},
      {id:'titanio',label:'Titanio Ti-6Al-4V',group:'Especiales',hardness:'HB 300-370',cuttingSpeeds:{hss:{torneado:8,fresado:6,taladrado:5},carburo:{torneado:40,fresado:30,taladrado:25},ceramica:{torneado:0,fresado:0,taladrado:0},cbn:{torneado:100,fresado:0,taladrado:0}}},
      {id:'plastico',label:'Plástico (Nylon / PVC)',group:'No Metálicos',hardness:'Shore 60-85',cuttingSpeeds:{hss:{torneado:80,fresado:60,taladrado:70},carburo:{torneado:200,fresado:160,taladrado:150},ceramica:{torneado:0,fresado:0,taladrado:0},cbn:{torneado:0,fresado:0,taladrado:0}}}
    ],
    operations:{
      torneado:{id:'torneado',label:'Torneado',icon:'◎',description:'Mecanizado en torno por rotación de la pieza',
        formula:{S:'S = (1000 × Vc) / (π × D)',F:'F = f × S',t:'t = L / F'},
        variables:[{id:'D',label:'Diámetro de la pieza (D)',unit:'mm',min:1,max:2000,step:0.1,default:50},{id:'L',label:'Longitud de corte (L)',unit:'mm',min:1,max:5000,step:0.1,default:100},{id:'f',label:'Avance por revolución (f)',unit:'mm/rev',min:0.01,max:2,step:0.01,default:0.2}],
        feedSuggestions:{desbaste:{label:'Desbaste',range:'0.25–0.50',typical:0.35},semiacabado:{label:'Semiacabado',range:'0.10–0.25',typical:0.15},acabado:{label:'Acabado',range:'0.05–0.10',typical:0.07}}},
      fresado:{id:'fresado',label:'Fresado',icon:'✦',description:'Mecanizado por rotación de la herramienta (fresa)',
        formula:{S:'S = (1000 × Vc) / (π × D)',F:'F = fz × Z × S',t:'t = L / F'},
        variables:[{id:'D',label:'Diámetro de la fresa (D)',unit:'mm',min:1,max:500,step:0.1,default:20},{id:'L',label:'Longitud de corte (L)',unit:'mm',min:1,max:5000,step:0.1,default:100},{id:'Z',label:'Número de dientes (Z)',unit:'dientes',min:1,max:20,step:1,default:4},{id:'fz',label:'Avance por diente (fz)',unit:'mm/diente',min:0.001,max:1,step:0.001,default:0.05}],
        feedSuggestions:{desbaste:{label:'Desbaste',range:'0.05–0.20',typical:0.12},semiacabado:{label:'Semiacabado',range:'0.02–0.05',typical:0.03},acabado:{label:'Acabado',range:'0.01–0.02',typical:0.015}}},
      taladrado:{id:'taladrado',label:'Taladrado',icon:'▼',description:'Mecanizado de agujeros por rotación de la broca',
        formula:{S:'S = (1000 × Vc) / (π × D)',F:'F = f × S',t:'t = (L + 0.3 × D) / F'},
        variables:[{id:'D',label:'Diámetro de la broca (D)',unit:'mm',min:0.5,max:100,step:0.1,default:10},{id:'L',label:'Profundidad del agujero (L)',unit:'mm',min:1,max:1000,step:0.1,default:30},{id:'f',label:'Avance por revolución (f)',unit:'mm/rev',min:0.01,max:1,step:0.01,default:0.1}],
        feedSuggestions:{D_menor_5:{label:'D < 5 mm',range:'0.05–0.10',typical:0.07},D_5_15:{label:'5≤D<15 mm',range:'0.10–0.20',typical:0.15},D_15_30:{label:'15≤D<30 mm',range:'0.20–0.35',typical:0.25},D_mayor_30:{label:'D≥30 mm',range:'0.30–0.50',typical:0.40}}}
    },
    passTypes:{
      desbaste:{id:'desbaste',label:'Desbaste',color:'#e74c3c',description:'Remoción rápida de material. Tolerancias amplias.'},
      semiacabado:{id:'semiacabado',label:'Semiacabado',color:'#f39c12',description:'Balance entre velocidad y calidad.'},
      acabado:{id:'acabado',label:'Acabado',color:'#2ecc71',description:'Alta calidad superficial. Tolerancias estrechas.'}
    },
    unitConversions:{Pi:3.141592653589793},
    guides:{
      operations:{
        torneado:{
          intro:'La PIEZA gira y la herramienta avanza en línea recta quitando material.',
          analogy:'Como pelar una papa cilíndrica: la papa gira y el cuchillo avanza.',
          variables:{
            D:{name:'Diámetro de la pieza',symbol:'D',unit:'mm',plainDescription:'El grosor de la barra — de lado a lado pasando por el centro.',whereToMeasure:'En la zona que vas a mecanizar, no en los extremos.',steps:['Apaga la máquina','Abre el calibrador más que la pieza','Cierra las mordazas exteriores sobre la pieza','Lee el número en mm','Repite en 2-3 puntos para verificar'],tool:'Calibrador vernier (mordazas exteriores)',tips:['Si el plano tiene el valor, úsalo directamente','Mide la zona sin mecanizar aún'],mistakes:['No midas en extremos biselados','No confundas radio con diámetro']},
            L:{name:'Longitud de corte',symbol:'L',unit:'mm',plainDescription:'Distancia desde donde empieza el corte hasta donde termina.',whereToMeasure:'Desde el primer contacto de la herramienta hasta donde termina el corte.',steps:['Marca con un lápiz el inicio y fin del corte','Apoya la regla paralela al eje de la pieza','Mide entre las dos marcas','Lee el valor en mm'],tool:'Regla metálica',tips:['Si maquinas toda la barra, L = longitud total'],mistakes:['No midas la barra completa si solo torneas una parte']},
            f:{name:'Avance por revolución',symbol:'f',unit:'mm/rev',plainDescription:'Cuánto avanza la herramienta por cada vuelta de la pieza. No se mide — se elige.',whereToMeasure:'No se mide físicamente.',steps:['Elige el tipo de pasada (desbaste/semiacabado/acabado)','La calculadora sugiere el valor automáticamente'],tool:'No requiere instrumento',tips:['Desbaste: f = 0.25–0.50 mm/rev','Acabado: f = 0.05–0.10 mm/rev'],mistakes:['No uses el mismo f para desbaste y acabado']}
          }
        },
        fresado:{
          intro:'La HERRAMIENTA gira mientras la pieza avanza.',
          analogy:'Como un ventilador que va comiendo el material.',
          variables:{
            D:{name:'Diámetro de la fresa',symbol:'D',unit:'mm',plainDescription:'El ancho del círculo que hacen los dientes de la fresa al girar.',whereToMeasure:'De punta de diente a punta de diente opuestos.',steps:['Toma la fresa fuera de la máquina','Abre el calibrador','Mide de punta a punta','Lee el número — o mira el grabado en el mango'],tool:'Calibrador vernier o lectura del mango',tips:['El número grabado en el mango = diámetro nominal'],mistakes:['No midas el mango de sujeción']},
            L:{name:'Longitud de corte',symbol:'L',unit:'mm',plainDescription:'Distancia que recorre la fresa de inicio a fin.',whereToMeasure:'Largo de la ranura o superficie a fresar.',steps:['Marca inicio y fin del corte','Mide con regla','Agrega 5-10 mm si la fresa entra por los bordes'],tool:'Regla metálica',tips:['Suma la entrada y salida de la herramienta'],mistakes:['No olvides la entrada y salida']},
            Z:{name:'Número de dientes',symbol:'Z',unit:'dientes',plainDescription:'Cuántos filos cortantes tiene la fresa. Se cuenta visualmente.',whereToMeasure:'Mira la punta de la fresa de frente.',steps:['Mira la fresa desde su punta','Cuenta los filos afilados visibles','Las más comunes tienen 2, 3 o 4'],tool:'Observación visual directa',tips:['2 dientes: aluminio','4 dientes: acero'],mistakes:['No confundas canales de alivio con dientes']},
            fz:{name:'Avance por diente',symbol:'fz',unit:'mm/diente',plainDescription:'Cuánto avanza la pieza por cada diente que pasa. No se mide.',whereToMeasure:'No se mide.',steps:['Elige el tipo de pasada','La calculadora completa el valor'],tool:'No requiere instrumento',tips:['Desbaste: fz = 0.05–0.20','Acabado: fz = 0.01–0.02'],mistakes:['No pongas fz = 0']}
          }
        },
        taladrado:{
          intro:'La BROCA gira y baja hacia la pieza haciendo un agujero.',
          analogy:'Exactamente como un taladro de casa pero con control preciso.',
          variables:{
            D:{name:'Diámetro de la broca',symbol:'D',unit:'mm',plainDescription:'El ancho de la broca — igual al tamaño del agujero que hará.',whereToMeasure:'En el cuerpo de la broca (las alas cortantes).',steps:['Toma la broca','Mide el cuerpo con calibrador','O lee el número grabado en el mango'],tool:'Calibrador vernier o lectura del mango',tips:['El número en el mango = diámetro del agujero resultante'],mistakes:['No midas el mango de sujeción']},
            L:{name:'Profundidad del agujero',symbol:'L',unit:'mm',plainDescription:'Qué tan hondo debe quedar el agujero — solo la parte cilíndrica.',whereToMeasure:'Mide el espesor de la pieza o la profundidad del plano.',steps:['Agujero pasante: mide el espesor de la pieza','Agujero ciego: usa la profundidad del plano','La calculadora suma 0.3D automáticamente'],tool:'Calibrador vernier (mordaza de profundidad) o regla',tips:['La calculadora ya suma la punta de la broca'],mistakes:['No incluyas la punta cónica en tu L']},
            f:{name:'Avance por revolución',symbol:'f',unit:'mm/rev',plainDescription:'Cuánto baja la broca por cada vuelta. No se mide — depende del diámetro.',whereToMeasure:'No se mide.',steps:['Mira el diámetro D','D<5mm: usa f=0.07','5-15mm: usa f=0.15','15-30mm: usa f=0.25','D>30mm: usa f=0.40'],tool:'No requiere instrumento',tips:['Brocas pequeñas son frágiles: usa f bajo'],mistakes:['No uses el mismo f para brocas de 3 y 20 mm']}
          }
        }
      }
    }
  };
}

/* ══════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   PANEL DE CONCEPTOS — FUNCIONES INTERACTIVAS
══════════════════════════════════════════════════════════ */

/* Cambiar entre tabs del panel de conceptos */
function switchConceptTab(tabName){
  // Ocultar todos los tabs
  const allTabs = document.querySelectorAll('.concept-tab-content');
  allTabs.forEach(tab => tab.style.display = 'none');
  
  // Remover clase active de todos los botones
  const allBtns = document.querySelectorAll('.concept-tab-btn');
  allBtns.forEach(btn => btn.classList.remove('active'));
  
  // Mostrar el tab seleccionado y activar botón
  const selectedTab = document.getElementById('tab-' + tabName);
  if(selectedTab) selectedTab.style.display = '';
  
  const selectedBtn = document.querySelector('.concept-tab-btn[onclick*="' + tabName + '"]');
  if(selectedBtn) selectedBtn.classList.add('active');
}

/* Expandir/contraer tarjetas de máquinas */
function toggleMachineInfo(element){
  const card = element.closest('.machine-card');
  if(!card) return;
  const infoDiv = card.querySelector('.machine-info');
  if(infoDiv){
    infoDiv.classList.toggle('hidden');
    card.classList.toggle('expandible');
  }
}

/* Expandir/contraer tarjetas de materiales */
function toggleMaterialInfo(element){
  const card = element.closest('.material-card');
  if(!card) return;
  const infoDiv = card.querySelector('.material-info');
  if(infoDiv){
    infoDiv.classList.toggle('hidden');
    card.classList.toggle('expandible');
  }
}

/* Inicializar el primer tab al cargar */
function initConceptsTabs(){
  // Mostrar solo el primer tab por defecto
  const tabs = document.querySelectorAll('.concept-tab-content');
  if(tabs.length > 0){
    tabs.forEach((tab, idx) => {
      tab.style.display = idx === 0 ? '' : 'none';
    });
  }
  
  // Activar el primer botón
  const btns = document.querySelectorAll('.concept-tab-btn');
  if(btns.length > 0){
    btns[0].classList.add('active');
  }
}

/* Ejecutar cuando el DOM esté listo */
document.addEventListener('DOMContentLoaded', function(){
  if(S.mode === 'concepts'){
    initConceptsTabs();
  }
});

loadData();