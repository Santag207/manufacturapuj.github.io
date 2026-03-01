/**
 * script.js — Calculadora de Mecanizado · PUJ
 * Pontificia Universidad Javeriana · Ingeniería Industrial
 *
 * Lee datos desde data.json y gestiona toda la lógica de la UI:
 *   - Selección de operación, material y herramienta
 *   - Inputs dinámicos con slider + número sincronizados
 *   - Tipo de pasada con sugerencia de avance automática
 *   - Cálculo de S (rpm), F (mm/min) y t (min)
 *   - Renderizado de resultados animados y pasos del cálculo
 */


/* ══════════════════════════════════════════════════════════════
   ESTADO GLOBAL
══════════════════════════════════════════════════════════════ */
let DB = null;        // Base de datos cargada desde data.json

const state = {
  operation : null,   // 'torneado' | 'fresado' | 'taladrado'
  material  : null,   // id del material de la pieza
  tool      : null,   // id del material de la herramienta
  passType  : null,   // 'desbaste' | 'semiacabado' | 'acabado'
};


/* ══════════════════════════════════════════════════════════════
   CARGA DEL JSON
══════════════════════════════════════════════════════════════ */

/**
 * Intenta cargar data.json. Si falla (ej. apertura directa del
 * archivo sin servidor), usa los datos embebidos como fallback.
 */
async function loadData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DB = await res.json();
  } catch (e) {
    DB = getEmbeddedData();
    showToast('Datos cargados en modo local.', '');
  }
  init();
}


/* ══════════════════════════════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════════════════════════════ */

function init() {
  renderOperations();
  renderMaterials();
  renderToolMaterials();
  startClock();

  // Ocultar pantalla de carga
  document.getElementById('loadingScreen').classList.add('hidden');
}


/* ══════════════════════════════════════════════════════════════
   RENDERIZADO DE OPERACIONES
══════════════════════════════════════════════════════════════ */

function renderOperations() {
  const grid = document.getElementById('opGrid');
  const ops  = DB.operations;

  grid.innerHTML = Object.values(ops).map(op => `
    <div class="op-card" id="opCard_${op.id}" onclick="selectOperation('${op.id}')">
      <span class="op-icon">${getOpEmoji(op.id)}</span>
      <div>
        <span class="op-label">${op.label}</span>
        <p class="op-desc">${op.description}</p>
        <span class="op-badge">${Object.keys(op.formula).map(k => k.toUpperCase()).join(' · ')}</span>
      </div>
    </div>
  `).join('');
}

/** Devuelve un emoji representativo para cada operación. */
function getOpEmoji(id) {
  const map = { torneado: '◎', fresado: '✦', taladrado: '▼' };
  return map[id] || '⚙';
}


/* ══════════════════════════════════════════════════════════════
   SELECCIÓN DE OPERACIÓN
══════════════════════════════════════════════════════════════ */

function selectOperation(opId) {
  state.operation = opId;
  state.passType  = null;

  // Activar tarjeta seleccionada
  document.querySelectorAll('.op-card').forEach(c => c.classList.remove('active'));
  document.getElementById('opCard_' + opId).classList.add('active');

  // Actualizar secciones dependientes
  renderVars();
  renderFormulas();
  renderPassButtons();
  updateVcDisplay();

  // Mostrar paneles que requieren operación elegida
  document.getElementById('passPanel').style.display  = '';
  document.getElementById('formulaBox').style.display = '';
}


/* ══════════════════════════════════════════════════════════════
   MATERIALES DE PIEZA
══════════════════════════════════════════════════════════════ */

function renderMaterials() {
  const sel    = document.getElementById('selMaterial');
  const groups = {};

  // Agrupar materiales por su propiedad 'group'
  DB.workpieceMaterials.forEach(m => {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  });

  let html = '<option value="">— Seleccionar material —</option>';
  Object.entries(groups).forEach(([grp, mats]) => {
    html += `<optgroup label="${grp}">`;
    mats.forEach(m => {
      html += `<option value="${m.id}">${m.label} — ${m.hardness}</option>`;
    });
    html += '</optgroup>';
  });

  sel.innerHTML = html;
  sel.addEventListener('change', () => {
    state.material = sel.value;
    updateVcDisplay();
  });
}


/* ══════════════════════════════════════════════════════════════
   MATERIALES DE HERRAMIENTA
══════════════════════════════════════════════════════════════ */

function renderToolMaterials() {
  const sel  = document.getElementById('selTool');
  let   html = '<option value="">— Seleccionar herramienta —</option>';

  DB.toolMaterials.forEach(t => {
    html += `<option value="${t.id}">${t.icon} ${t.label}</option>`;
  });

  sel.innerHTML = html;
  sel.addEventListener('change', () => {
    state.tool = sel.value;
    updateVcDisplay();
  });
}


/* ══════════════════════════════════════════════════════════════
   VELOCIDAD DE CORTE (Vc)
══════════════════════════════════════════════════════════════ */

/**
 * Obtiene la Vc de la tabla según la combinación actual de
 * material de pieza, material de herramienta y operación.
 * Retorna null si la combinación no es válida o no tiene datos.
 */
function getVc() {
  if (!state.material || !state.tool || !state.operation) return null;
  const mat = DB.workpieceMaterials.find(m => m.id === state.material);
  if (!mat) return null;
  const vc = mat.cuttingSpeeds[state.tool]?.[state.operation];
  return (vc && vc > 0) ? vc : null;
}

/** Muestra u oculta el campo Vc según si la combinación es válida. */
function updateVcDisplay() {
  const vc       = getVc();
  const infoVc   = document.getElementById('infoVc');
  const vcInput  = document.getElementById('vcDisplay');

  if (vc !== null) {
    infoVc.style.display = '';
    vcInput.value = vc;
  } else {
    infoVc.style.display = 'none';
  }
}


/* ══════════════════════════════════════════════════════════════
   VARIABLES DE PROCESO (inputs dinámicos)
══════════════════════════════════════════════════════════════ */

/** Genera los controles de rango + número para cada variable de la operación. */
function renderVars() {
  if (!state.operation) return;
  const op        = DB.operations[state.operation];
  const container = document.getElementById('varsContainer');

  container.innerHTML = op.variables.map(v => `
    <div class="form-group">
      <label>${v.label}</label>
      <div class="range-row">
        <input
          type="range"
          id="range_${v.id}"
          min="${v.min}" max="${v.max}" step="${v.step}" value="${v.default}"
          oninput="syncInput('${v.id}', this.value)"
        />
        <span class="range-val" id="rv_${v.id}">${v.default}</span>
      </div>
      <div class="input-with-unit" style="margin-top:6px">
        <input
          type="number"
          id="num_${v.id}"
          min="${v.min}" max="${v.max}" step="${v.step}" value="${v.default}"
          oninput="syncRange('${v.id}', this.value)"
        />
        <span class="unit-badge">${v.unit}</span>
      </div>
    </div>
  `).join('');
}

/** Sincroniza el input numérico y el badge de valor cuando el slider cambia. */
function syncInput(id, val) {
  const num = parseFloat(val);
  document.getElementById('num_' + id).value        = num;
  document.getElementById('rv_'  + id).textContent  = num;
}

/** Sincroniza el slider cuando el input numérico cambia. */
function syncRange(id, val) {
  const num   = parseFloat(val);
  const range = document.getElementById('range_' + id);
  if (!isNaN(num)) {
    range.value = num;
    document.getElementById('rv_' + id).textContent = num;
  }
}

/** Lee el valor numérico actual de una variable. */
function getVarValue(id) {
  const el = document.getElementById('num_' + id);
  return el ? parseFloat(el.value) : NaN;
}


/* ══════════════════════════════════════════════════════════════
   FÓRMULAS
══════════════════════════════════════════════════════════════ */

/** Renderiza las fórmulas de la operación seleccionada. */
function renderFormulas() {
  if (!state.operation) return;
  const op  = DB.operations[state.operation];
  const box = document.getElementById('formulaContent');

  box.innerHTML = Object.entries(op.formula).map(([varName, eq]) => `
    <div class="formula-item">
      <span class="formula-var">${varName.toUpperCase()}</span>
      <span class="formula-eq">${eq}</span>
    </div>
  `).join('');
}


/* ══════════════════════════════════════════════════════════════
   TIPOS DE PASADA
══════════════════════════════════════════════════════════════ */

/** Genera los botones de tipo de pasada. */
function renderPassButtons() {
  if (!state.operation) return;
  const container = document.getElementById('passButtons');

  container.innerHTML = Object.entries(DB.passTypes).map(([id, p]) => `
    <button class="pass-btn" id="passBtn_${id}" onclick="selectPass('${id}')">
      ${p.label}
    </button>
  `).join('');
}

/**
 * Selecciona un tipo de pasada, resalta el botón correspondiente
 * y muestra la sugerencia de avance (autocompletando el campo de avance).
 */
function selectPass(passId) {
  state.passType = passId;

  // Resetear estilos de todos los botones
  Object.keys(DB.passTypes).forEach(id => {
    document.getElementById('passBtn_' + id).className = 'pass-btn';
  });

  // Activar el botón seleccionado
  document.getElementById('passBtn_' + passId).className = `pass-btn active-${passId}`;

  const op   = DB.operations[state.operation];
  const hint = document.getElementById('feedHint');

  // Buscar sugerencia: coincidencia exacta de clave o clave que contenga passId
  const match = Object.entries(op.feedSuggestions).find(
    ([k]) => k === passId || k.includes(passId)
  );

  if (match) {
    const [, sug] = match;
    hint.innerHTML = `<strong>${sug.label}:</strong> Rango recomendado <strong>${sug.range}</strong> mm — Valor típico: <strong>${sug.typical}</strong>`;
    hint.classList.add('visible');

    // Autocompletar el campo de avance (f o fz según operación)
    const feedVarId = (state.operation === 'fresado') ? 'fz' : 'f';
    const numEl     = document.getElementById('num_' + feedVarId);
    if (numEl) {
      numEl.value = sug.typical;
      syncRange(feedVarId, sug.typical);
    }
  } else {
    hint.classList.remove('visible');
  }
}


/* ══════════════════════════════════════════════════════════════
   CÁLCULO PRINCIPAL
══════════════════════════════════════════════════════════════ */

/**
 * Valida entradas, ejecuta las fórmulas según la operación
 * seleccionada y llama a displayResults() con los resultados.
 *
 * Fórmulas:
 *   S  = (1000 × Vc) / (π × D)          [rev/min]
 *
 *   Torneado:
 *     F = f × S                           [mm/min]
 *     t = L / F                           [min]
 *
 *   Fresado:
 *     F = fz × Z × S                      [mm/min]
 *     t = L / F                           [min]
 *
 *   Taladrado:
 *     F = f × S                           [mm/min]
 *     t = (L + 0.3 × D) / F              [min]  (aproximación punta de broca)
 */
function calculateResults() {

  // ── Validaciones ──────────────────────────────────
  if (!state.operation) { showToast('Selecciona una operación.',              'error'); return; }
  if (!state.material)  { showToast('Selecciona el material de la pieza.',    'error'); return; }
  if (!state.tool)      { showToast('Selecciona el material de la herramienta.', 'error'); return; }

  const vc = getVc();
  if (!vc) {
    showWarning(
      `La combinación ${state.tool.toUpperCase()} + ${state.operation} no tiene datos disponibles. ` +
      'Verifica que la herramienta sea compatible con el material seleccionado.'
    );
    return;
  }
  hideWarning();

  // ── Recoger variables ─────────────────────────────
  const op   = DB.operations[state.operation];
  const vars = {};
  op.variables.forEach(v => { vars[v.id] = getVarValue(v.id); });

  // Validar que todos los valores sean números positivos
  for (const [k, v] of Object.entries(vars)) {
    if (isNaN(v) || v <= 0) {
      showToast(`El valor de ${k.toUpperCase()} es inválido. Ingresa un número positivo.`, 'error');
      return;
    }
  }

  const { D, L, f, fz, Z } = vars;
  const PI = DB.unitConversions.Pi;

  // ── Cálculo de S (común a todas las operaciones) ──
  const S = (1000 * vc) / (PI * D);

  let F, t, steps;

  // ── Fórmulas por operación ────────────────────────
  if (state.operation === 'torneado') {
    F     = f * S;
    t     = L / F;
    steps = [
      { n: 1, formula: `S = (1000 × ${vc}) / (π × ${D})`,              result: fmt(S)  + ' rpm'    },
      { n: 2, formula: `F = f × S = ${f} × ${fmt(S)}`,                 result: fmt(F)  + ' mm/min' },
      { n: 3, formula: `t = L / F = ${L} / ${fmt(F)}`,                 result: fmtT(t) + ' min'    },
    ];

  } else if (state.operation === 'fresado') {
    F     = fz * Z * S;
    t     = L / F;
    steps = [
      { n: 1, formula: `S = (1000 × ${vc}) / (π × ${D})`,              result: fmt(S)  + ' rpm'    },
      { n: 2, formula: `F = fz × Z × S = ${fz} × ${Z} × ${fmt(S)}`,   result: fmt(F)  + ' mm/min' },
      { n: 3, formula: `t = L / F = ${L} / ${fmt(F)}`,                 result: fmtT(t) + ' min'    },
    ];

  } else if (state.operation === 'taladrado') {
    const approach = 0.3 * D;
    F     = f * S;
    t     = (L + approach) / F;
    steps = [
      { n: 1, formula: `S = (1000 × ${vc}) / (π × ${D})`,              result: fmt(S)  + ' rpm'    },
      { n: 2, formula: `F = f × S = ${f} × ${fmt(S)}`,                 result: fmt(F)  + ' mm/min' },
      { n: 3, formula: `t = (L + 0.3D) / F = (${L} + ${fmtD(approach)}) / ${fmt(F)}`, result: fmtT(t) + ' min' },
    ];
  }

  displayResults({ S, F, t, steps, vars, vc });
  showToast('Cálculo completado ✓', 'success');
}


/* ══════════════════════════════════════════════════════════════
   VISUALIZACIÓN DE RESULTADOS
══════════════════════════════════════════════════════════════ */

/**
 * Renderiza las tarjetas de resultados, los pasos del cálculo
 * y el resumen de parámetros de entrada.
 */
function displayResults({ S, F, t, steps, vars, vc }) {
  const op   = DB.operations[state.operation];
  const mat  = DB.workpieceMaterials.find(m => m.id === state.material);
  const tool = DB.toolMaterials.find(t => t.id === state.tool);
  const pass = state.passType ? DB.passTypes[state.passType] : null;

  // ── Encabezado ────────────────────────────────────
  document.getElementById('resOpLabel').innerHTML = `
    ${getOpEmoji(state.operation)} ${op.label}
    <span class="badge">${pass ? pass.label.toUpperCase() : 'CALCULADO'}</span>
  `;
  document.getElementById('resTimestamp').textContent =
    new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // ── Valores animados ──────────────────────────────
  setAnimatedValue('valS', fmt(S));
  setAnimatedValue('valF', fmt(F));
  setAnimatedValue('valT', fmtT(t));

  // ── Pasos del cálculo ─────────────────────────────
  document.getElementById('calcSteps').innerHTML = steps.map(s => `
    <div class="calc-step">
      <div class="step-num">${s.n}</div>
      <div class="step-formula"><em>Paso ${s.n}:</em> ${escHtml(s.formula)}</div>
      <div class="step-result">${s.result}</div>
    </div>
  `).join('');

  // ── Resumen de entradas ───────────────────────────
  const summaryRows = [
    { k: 'Operación',      v: op.label },
    { k: 'Material pieza', v: mat  ? mat.label  : '—' },
    { k: 'Herramienta',    v: tool ? tool.label : '—' },
    { k: 'Vc (tabla)',     v: vc + ' m/min' },
    ...op.variables.map(vr => ({
      k: vr.label.split(' (')[0],
      v: vars[vr.id] + ' ' + vr.unit,
    })),
  ];

  document.getElementById('inputSummary').innerHTML = summaryRows.map(r => `
    <div class="summary-row">
      <span class="summary-key">${r.k}</span>
      <span class="summary-val">${r.v}</span>
    </div>
  `).join('');

  // ── Mostrar sección de resultados ─────────────────
  document.getElementById('resultsWrapper').classList.add('visible');
  setTimeout(() => {
    document.getElementById('resultsWrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

/** Aplica animación de entrada al valor de una tarjeta. */
function setAnimatedValue(id, val) {
  const el = document.getElementById(id);
  el.classList.remove('animated');
  void el.offsetWidth;           // fuerza reflow para reiniciar la animación
  el.textContent = val;
  el.classList.add('animated');
}


/* ══════════════════════════════════════════════════════════════
   HELPERS DE FORMATO
══════════════════════════════════════════════════════════════ */

/** Formatea un número con 2 decimales en locale colombiano. */
function fmt(n) {
  return parseFloat(n.toFixed(2)).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Formatea el tiempo con 4 decimales para mayor precisión. */
function fmtT(n) {
  return parseFloat(n.toFixed(4)).toLocaleString('es-CO', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/** Formatea decimales sin locale para uso en fórmulas de texto. */
function fmtD(n) {
  return parseFloat(n.toFixed(3)).toString();
}

/** Escapa caracteres HTML para mostrar texto seguro en innerHTML. */
function escHtml(s) {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}


/* ══════════════════════════════════════════════════════════════
   NOTIFICACIONES
══════════════════════════════════════════════════════════════ */

/**
 * Muestra un toast en la esquina inferior derecha.
 * @param {string} msg   - Texto a mostrar
 * @param {string} type  - '' | 'success' | 'error'
 */
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3200);
}

/** Muestra el bloque de advertencia con el mensaje dado. */
function showWarning(msg) {
  const w = document.getElementById('warningBox');
  w.textContent = msg;
  w.classList.add('show');
  document.getElementById('resultsWrapper').classList.add('visible');
}

/** Oculta el bloque de advertencia. */
function hideWarning() {
  document.getElementById('warningBox').classList.remove('show');
}


/* ══════════════════════════════════════════════════════════════
   RELOJ EN TIEMPO REAL
══════════════════════════════════════════════════════════════ */

function startClock() {
  const el = document.getElementById('currentTime');
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString('es-CO', {
      hour:   '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  tick();
  setInterval(tick, 1000);
}


/* ══════════════════════════════════════════════════════════════
   DATOS EMBEBIDOS (fallback sin servidor HTTP)
   Se usa cuando fetch('data.json') falla por política CORS al
   abrir el archivo directamente desde el sistema de archivos.
══════════════════════════════════════════════════════════════ */

function getEmbeddedData() {
  return {
    "appInfo": {
      "title": "Calculadora de Mecanizado",
      "subtitle": "Procesos de Manufactura Moderna",
      "institution": "Pontificia Universidad Javeriana",
      "department": "Ingeniería Industrial",
      "version": "1.0.0"
    },
    "toolMaterials": [
      { "id": "hss",      "label": "Acero Rápido (HSS)",  "icon": "⚙️" },
      { "id": "carburo",  "label": "Carburo Cementado",   "icon": "💎" },
      { "id": "ceramica", "label": "Cerámica",            "icon": "🔬" },
      { "id": "cbn",      "label": "CBN / Diamante",      "icon": "✦"  }
    ],
    "workpieceMaterials": [
      { "id": "acero_suave",    "label": "Acero Suave (Bajo Carbono)",  "group": "Aceros",       "hardness": "HB 120-180",   "cuttingSpeeds": { "hss": { "torneado": 30,  "fresado": 25,  "taladrado": 28  }, "carburo": { "torneado": 120, "fresado": 100, "taladrado": 90  }, "ceramica": { "torneado": 280, "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 400, "fresado": 0,   "taladrado": 0   } } },
      { "id": "acero_medio",    "label": "Acero Medio Carbono",         "group": "Aceros",       "hardness": "HB 180-250",   "cuttingSpeeds": { "hss": { "torneado": 25,  "fresado": 20,  "taladrado": 22  }, "carburo": { "torneado": 100, "fresado": 80,  "taladrado": 75  }, "ceramica": { "torneado": 240, "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 350, "fresado": 0,   "taladrado": 0   } } },
      { "id": "acero_alto",     "label": "Acero Alto Carbono",          "group": "Aceros",       "hardness": "HB 250-320",   "cuttingSpeeds": { "hss": { "torneado": 18,  "fresado": 15,  "taladrado": 16  }, "carburo": { "torneado": 80,  "fresado": 65,  "taladrado": 60  }, "ceramica": { "torneado": 200, "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 300, "fresado": 0,   "taladrado": 0   } } },
      { "id": "acero_inox",     "label": "Acero Inoxidable 304",        "group": "Aceros",       "hardness": "HB 150-200",   "cuttingSpeeds": { "hss": { "torneado": 15,  "fresado": 12,  "taladrado": 10  }, "carburo": { "torneado": 60,  "fresado": 50,  "taladrado": 45  }, "ceramica": { "torneado": 150, "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 200, "fresado": 0,   "taladrado": 0   } } },
      { "id": "acero_inox_316", "label": "Acero Inoxidable 316",        "group": "Aceros",       "hardness": "HB 160-210",   "cuttingSpeeds": { "hss": { "torneado": 12,  "fresado": 10,  "taladrado": 8   }, "carburo": { "torneado": 50,  "fresado": 40,  "taladrado": 38  }, "ceramica": { "torneado": 130, "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 180, "fresado": 0,   "taladrado": 0   } } },
      { "id": "hierro_gris",    "label": "Hierro Fundido Gris",         "group": "Hierros",      "hardness": "HB 180-260",   "cuttingSpeeds": { "hss": { "torneado": 25,  "fresado": 20,  "taladrado": 22  }, "carburo": { "torneado": 100, "fresado": 80,  "taladrado": 75  }, "ceramica": { "torneado": 300, "fresado": 180, "taladrado": 0   }, "cbn": { "torneado": 450, "fresado": 0,   "taladrado": 0   } } },
      { "id": "hierro_nodular", "label": "Hierro Fundido Nodular",      "group": "Hierros",      "hardness": "HB 200-280",   "cuttingSpeeds": { "hss": { "torneado": 20,  "fresado": 18,  "taladrado": 18  }, "carburo": { "torneado": 85,  "fresado": 70,  "taladrado": 65  }, "ceramica": { "torneado": 250, "fresado": 150, "taladrado": 0   }, "cbn": { "torneado": 380, "fresado": 0,   "taladrado": 0   } } },
      { "id": "aluminio",       "label": "Aluminio (Aleaciones)",       "group": "No Ferrosos",  "hardness": "HB 30-80",     "cuttingSpeeds": { "hss": { "torneado": 100, "fresado": 80,  "taladrado": 90  }, "carburo": { "torneado": 300, "fresado": 250, "taladrado": 220 }, "ceramica": { "torneado": 600, "fresado": 400, "taladrado": 0   }, "cbn": { "torneado": 800, "fresado": 600, "taladrado": 0   } } },
      { "id": "bronce",         "label": "Bronce / Latón",              "group": "No Ferrosos",  "hardness": "HB 80-150",    "cuttingSpeeds": { "hss": { "torneado": 50,  "fresado": 40,  "taladrado": 45  }, "carburo": { "torneado": 150, "fresado": 120, "taladrado": 110 }, "ceramica": { "torneado": 0,   "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 0,   "fresado": 0,   "taladrado": 0   } } },
      { "id": "cobre",          "label": "Cobre",                       "group": "No Ferrosos",  "hardness": "HB 40-90",     "cuttingSpeeds": { "hss": { "torneado": 60,  "fresado": 50,  "taladrado": 55  }, "carburo": { "torneado": 180, "fresado": 150, "taladrado": 140 }, "ceramica": { "torneado": 0,   "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 0,   "fresado": 0,   "taladrado": 0   } } },
      { "id": "titanio",        "label": "Titanio Ti-6Al-4V",           "group": "Especiales",   "hardness": "HB 300-370",   "cuttingSpeeds": { "hss": { "torneado": 8,   "fresado": 6,   "taladrado": 5   }, "carburo": { "torneado": 40,  "fresado": 30,  "taladrado": 25  }, "ceramica": { "torneado": 0,   "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 100, "fresado": 0,   "taladrado": 0   } } },
      { "id": "plastico",       "label": "Plástico (Nylon / PVC)",      "group": "No Metálicos", "hardness": "Shore 60-85",  "cuttingSpeeds": { "hss": { "torneado": 80,  "fresado": 60,  "taladrado": 70  }, "carburo": { "torneado": 200, "fresado": 160, "taladrado": 150 }, "ceramica": { "torneado": 0,   "fresado": 0,   "taladrado": 0   }, "cbn": { "torneado": 0,   "fresado": 0,   "taladrado": 0   } } }
    ],
    "operations": {
      "torneado": {
        "id": "torneado", "label": "Torneado", "icon": "◎",
        "description": "Mecanizado en torno por rotación de la pieza",
        "formula": { "S": "S = (1000 × Vc) / (π × D)", "F": "F = f × S", "t": "t = L / F" },
        "variables": [
          { "id": "D",  "label": "Diámetro de la pieza (D)", "unit": "mm",     "min": 1,    "max": 2000, "step": 0.1,  "default": 50  },
          { "id": "L",  "label": "Longitud de corte (L)",    "unit": "mm",     "min": 1,    "max": 5000, "step": 0.1,  "default": 100 },
          { "id": "f",  "label": "Avance por revolución (f)","unit": "mm/rev", "min": 0.01, "max": 2,    "step": 0.01, "default": 0.2 }
        ],
        "feedSuggestions": {
          "desbaste":    { "label": "Desbaste",    "range": "0.25 – 0.50", "typical": 0.35  },
          "semiacabado": { "label": "Semiacabado", "range": "0.10 – 0.25", "typical": 0.15  },
          "acabado":     { "label": "Acabado",     "range": "0.05 – 0.10", "typical": 0.07  }
        }
      },
      "fresado": {
        "id": "fresado", "label": "Fresado", "icon": "✦",
        "description": "Mecanizado por rotación de la herramienta (fresa)",
        "formula": { "S": "S = (1000 × Vc) / (π × D)", "F": "F = fz × Z × S", "t": "t = L / F" },
        "variables": [
          { "id": "D",  "label": "Diámetro de la fresa (D)", "unit": "mm",        "min": 1,     "max": 500,  "step": 0.1,   "default": 20   },
          { "id": "L",  "label": "Longitud de corte (L)",    "unit": "mm",        "min": 1,     "max": 5000, "step": 0.1,   "default": 100  },
          { "id": "Z",  "label": "Número de dientes (Z)",    "unit": "dientes",   "min": 1,     "max": 20,   "step": 1,     "default": 4    },
          { "id": "fz", "label": "Avance por diente (fz)",   "unit": "mm/diente", "min": 0.001, "max": 1,    "step": 0.001, "default": 0.05 }
        ],
        "feedSuggestions": {
          "desbaste":    { "label": "Desbaste",    "range": "0.05 – 0.20", "typical": 0.12  },
          "semiacabado": { "label": "Semiacabado", "range": "0.02 – 0.05", "typical": 0.03  },
          "acabado":     { "label": "Acabado",     "range": "0.01 – 0.02", "typical": 0.015 }
        }
      },
      "taladrado": {
        "id": "taladrado", "label": "Taladrado", "icon": "▼",
        "description": "Mecanizado de agujeros por rotación de la broca",
        "formula": { "S": "S = (1000 × Vc) / (π × D)", "F": "F = f × S", "t": "t = (L + 0.3 × D) / F" },
        "variables": [
          { "id": "D", "label": "Diámetro de la broca (D)",    "unit": "mm",     "min": 0.5,  "max": 100,  "step": 0.1,  "default": 10  },
          { "id": "L", "label": "Profundidad del agujero (L)", "unit": "mm",     "min": 1,    "max": 1000, "step": 0.1,  "default": 30  },
          { "id": "f", "label": "Avance por revolución (f)",   "unit": "mm/rev", "min": 0.01, "max": 1,    "step": 0.01, "default": 0.1 }
        ],
        "feedSuggestions": {
          "D_menor_5":  { "label": "D < 5 mm",       "range": "0.05 – 0.10", "typical": 0.07 },
          "D_5_15":     { "label": "5 ≤ D < 15 mm",  "range": "0.10 – 0.20", "typical": 0.15 },
          "D_15_30":    { "label": "15 ≤ D < 30 mm", "range": "0.20 – 0.35", "typical": 0.25 },
          "D_mayor_30": { "label": "D ≥ 30 mm",      "range": "0.30 – 0.50", "typical": 0.40 }
        }
      }
    },
    "passTypes": {
      "desbaste":    { "id": "desbaste",    "label": "Desbaste",    "color": "#e74c3c" },
      "semiacabado": { "id": "semiacabado", "label": "Semiacabado", "color": "#f39c12" },
      "acabado":     { "id": "acabado",     "label": "Acabado",     "color": "#2ecc71" }
    },
    "unitConversions": {
      "note": "S en rev/min (rpm), F en mm/min, t en min",
      "Pi": 3.141592653589793
    }
  };
}


/* ══════════════════════════════════════════════════════════════
   ARRANQUE
══════════════════════════════════════════════════════════════ */
loadData();
