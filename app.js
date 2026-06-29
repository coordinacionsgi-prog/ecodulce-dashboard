const COLORS = {
  merm: '#e8a93e', snack: '#5b9bd5', accent: '#4fd1a5', danger: '#e85d5d',
  grid: 'rgba(255,255,255,.06)', text: '#8b98a8',
  palette: ['#4fd1a5','#5b9bd5','#e8a93e','#e85d5d','#b08fe0','#5cd6d6','#d6a45c','#9bd65c']
};
Chart.defaults.color = COLORS.text;
Chart.defaults.borderColor = COLORS.grid;
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";

function fmt(n, d = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
}
function pct(n) { return n === null ? '—' : (n * 100).toFixed(1) + '%'; }

let DATA = null;

async function init() {
  const res = await fetch('data/data.json');
  DATA = await res.json();
  document.getElementById('updated-badge').textContent =
    'Datos sincronizados desde Google Sheets · ' + new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  [buildResumen, buildVentas, buildMateriaPrima, buildFichasMP, buildCAP, buildMaquinas, buildFichasProducto, buildLayout].forEach(fn => {
    try { fn(); } catch (e) { console.error('Error en ' + fn.name + ':', e); }
  });
  setupNav();
}

const NAV_GROUPS = {
  resumen: { label: 'Resumen', tabs: [{ id: 'resumen', label: 'Resumen' }] },
  prefactibilidad: { label: 'Prefactibilidad', tabs: [{ id: 'prefactibilidad', label: 'Prefactibilidad' }] },
  comercial: { label: 'Factibilidad Comercial', tabs: [{ id: 'ventas', label: 'Plan de Ventas' }] },
  tecnica: {
    label: 'Factibilidad Técnica',
    tabs: [
      { id: 'materia', label: 'Materia Prima' },
      { id: 'fichasmp', label: 'Fichas MP' },
      { id: 'cap', label: 'CAP' },
      { id: 'maquinas', label: 'Máquinas' },
      { id: 'fichasprod', label: 'Fichas Producto' },
      { id: 'layout', label: 'Layout' },
    ],
  },
};

function showTab(tabId) {
  document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const doResize = () => Object.values(Chart.instances).forEach(c => c.resize());
  requestAnimationFrame(doResize);
  setTimeout(doResize, 60);
}

function renderSubNav(groupKey) {
  const sub = document.getElementById('nav-sub');
  const group = NAV_GROUPS[groupKey];
  if (group.tabs.length <= 1) {
    sub.innerHTML = '';
    showTab(group.tabs[0].id);
    return;
  }
  sub.innerHTML = group.tabs
    .map((t, i) => `<button data-tab="${t.id}" class="${i === 0 ? 'active' : ''}">${t.label}</button>`)
    .join('');
  sub.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      sub.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showTab(btn.dataset.tab);
    });
  });
  showTab(group.tabs[0].id);
}

function setupNav() {
  const groupButtons = document.querySelectorAll('#nav-groups button');
  groupButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      groupButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSubNav(btn.dataset.group);
    });
  });
}

function buildResumen() {
  const g = DATA.guerchet.totales;
  const cd = DATA.carga_distancia;
  const pv = DATA.plan_ventas;
  const kpis = [
    { label: 'Superficie productiva neta', value: fmt(g['TOTAL PRODUCTIVO NETO'], 2) + ' m²', sub: 'Guerchet, K=0,5' },
    { label: 'Ventas Mermeladas Año 10', value: fmt(pv.mermeladas[9].unidades) + ' frascos', sub: pct(pv.mermeladas[9].mercado) + ' de mercado' },
    { label: 'Ventas Snacks Año 8', value: fmt(pv.snacks[7].unidades) + ' bolsas', sub: pct(pv.snacks[7].mercado) + ' de mercado' },
    { label: 'C0 → C1 Carga-Distancia', value: fmt(cd.C0_TOTAL) + ' → ' + fmt(cd.C1_TOTAL), sub: 'kg·m/día' },
  ];
  document.getElementById('kpi-grid').innerHTML = kpis.map(k =>
    `<div class="card"><h3>${k.label}</h3><div class="big">${k.value}</div><div class="sub">${k.sub}</div></div>`
  ).join('');

  new Chart('chart-resumen-ventas', {
    type: 'line',
    data: {
      labels: pv.mermeladas.map(r => 'Año ' + r.anio),
      datasets: [
        { label: 'Mermeladas (frascos)', data: pv.mermeladas.map(r => r.unidades), borderColor: COLORS.merm, backgroundColor: COLORS.merm + '33', tension: .3, fill: true },
        { label: 'Snacks (bolsas)', data: pv.snacks.map(r => r.unidades), borderColor: COLORS.snack, backgroundColor: COLORS.snack + '33', tension: .3, fill: true },
      ]
    },
    options: baseOpts()
  });

  new Chart('chart-resumen-guerchet', {
    type: 'doughnut',
    data: {
      labels: ['Mermeladas', 'Snacks', 'Auxiliares'],
      datasets: [{ data: [g['TOTAL MERMELADAS'], g['TOTAL SNACKS'], g['TOTAL AUXILIARES']], backgroundColor: [COLORS.merm, COLORS.snack, COLORS.accent], borderWidth: 0 }]
    },
    options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%' }
  });
}

function buildVentas() {
  const pv = DATA.plan_ventas;
  new Chart('chart-ventas-merm', {
    type: 'bar',
    data: { labels: pv.mermeladas.map(r => 'Año ' + r.anio), datasets: [{ label: 'Frascos', data: pv.mermeladas.map(r => r.unidades), backgroundColor: COLORS.merm, borderRadius: 4 }] },
    options: baseOpts()
  });
  new Chart('chart-ventas-snack', {
    type: 'bar',
    data: { labels: pv.snacks.map(r => 'Año ' + r.anio), datasets: [{ label: 'Bolsas', data: pv.snacks.map(r => r.unidades), backgroundColor: COLORS.snack, borderRadius: 4 }] },
    options: baseOpts()
  });
  new Chart('chart-ventas-market', {
    type: 'line',
    data: {
      labels: pv.mermeladas.map(r => 'Año ' + r.anio),
      datasets: [
        { label: 'Mermeladas % mercado', data: pv.mermeladas.map(r => r.mercado * 100), borderColor: COLORS.merm, tension: .3 },
        { label: 'Snacks % mercado', data: pv.snacks.map(r => r.mercado * 100), borderColor: COLORS.snack, tension: .3 },
      ]
    },
    options: baseOpts(v => v + '%')
  });
}

function buildMateriaPrima() {
  const mp = DATA.materia_prima;
  const etapasMerm = mp.mermeladas.filter(e => !e.etapa.includes('resultantes'));
  const etapasSnack = mp.snacks.filter(e => !e.etapa.includes('resultantes'));
  new Chart('chart-mp-merm', {
    type: 'bar',
    data: {
      labels: etapasMerm.map(e => e.etapa.replace(/\(.*?\)/, '').trim()),
      datasets: [
        { label: 'Año 1', data: etapasMerm.map(e => e.anio1), backgroundColor: COLORS.merm + 'aa' },
        { label: 'Año 5', data: etapasMerm.map(e => e.anio_mid), backgroundColor: COLORS.merm + '66' },
        { label: 'Año 10', data: etapasMerm.map(e => e.anio_final), backgroundColor: COLORS.merm + '33' },
      ]
    },
    options: { ...baseOpts(), indexAxis: 'y' }
  });
  new Chart('chart-mp-snack', {
    type: 'bar',
    data: {
      labels: etapasSnack.map(e => e.etapa.replace(/\(.*?\)/, '').trim()),
      datasets: [
        { label: 'Año 1', data: etapasSnack.map(e => e.anio1), backgroundColor: COLORS.snack + 'aa' },
        { label: 'Año 4', data: etapasSnack.map(e => e.anio_mid), backgroundColor: COLORS.snack + '66' },
        { label: 'Año 8', data: etapasSnack.map(e => e.anio_final), backgroundColor: COLORS.snack + '33' },
      ]
    },
    options: { ...baseOpts(), indexAxis: 'y' }
  });
}

function buildCAP() {
  const bloques = DATA.cap;
  // Tomamos el horizonte final de cada linea: Mermeladas Año10 (idx2), Snacks Año8 (idx5)
  const merm10 = bloques[2], snack8 = bloques[5];
  new Chart('chart-cap-merm', {
    type: 'bar',
    data: {
      labels: merm10.secciones.map(s => s.seccion),
      datasets: [{ label: 'Mermeladas Año 10 (%)', data: merm10.secciones.map(s => +(s.aprovechamiento * 100).toFixed(1)), backgroundColor: COLORS.merm, borderRadius: 4 }]
    },
    options: { ...baseOpts(v => v + '%'), scales: { y: { max: 110, grid: { color: COLORS.grid } } } }
  });
  new Chart('chart-cap-snack', {
    type: 'bar',
    data: {
      labels: snack8.secciones.map(s => s.seccion),
      datasets: [{ label: 'Snacks Año 8 (%)', data: snack8.secciones.map(s => +(s.aprovechamiento * 100).toFixed(1)), backgroundColor: COLORS.snack, borderRadius: 4 }]
    },
    options: { ...baseOpts(v => v + '%'), scales: { y: { max: 110, grid: { color: COLORS.grid } } } }
  });

  const tables = bloques.map(b => `
    <h3 style="margin-top:24px">${b.titulo.replace('CAP — ', '')}</h3>
    <table>
      <tr><th>Sección</th><th>Requerido</th><th>Unidad</th><th>Máquinas</th><th>Aprovechamiento</th></tr>
      ${b.secciones.map(s => `<tr><td>${s.seccion}</td><td>${fmt(s.requerido, 1)}</td><td>${s.unidad}</td><td>${fmt(s.maquinas)}</td>
        <td><span class="pill ${s.aprovechamiento > .9 ? 'danger' : s.aprovechamiento > .6 ? 'warn' : 'ok'}">${pct(s.aprovechamiento)}</span></td></tr>`).join('')}
    </table>`).join('');
  document.getElementById('cap-tables').innerHTML = tables;
}

function fichaImg(m) {
  if (!m.foto) return '';
  return `<img src="${m.foto}" alt="${m.equipo || ''}" loading="lazy" onerror="this.style.display='none'">`;
}
function maquinaCard(m) {
  return `<div class="ficha">
    ${fichaImg(m)}
    <h4>${m.seccion} — ${m.equipo}</h4>
    <dl>
      <dt>Marca/Modelo</dt><dd>${m.marca || '—'}</dd>
      <dt>Dimensiones</dt><dd>${fmt(m.ancho,2)} × ${fmt(m.largo,2)} × ${fmt(m.alto,2)} m</dd>
      <dt>Peso</dt><dd>${m.peso || '—'}</dd>
      <dt>Potencia</dt><dd>${m.potencia || '—'}</dd>
      <dt>Capacidad</dt><dd>${m.cap_teorica || '—'} ${m.unidad || ''}</dd>
      <dt>Rendimiento</dt><dd>${pct(m.rendimiento)}</dd>
      <dt>Cantidad en planta</dt><dd>${fmt(m.cantidad)}</dd>
      <dt>Precio</dt><dd>${m.precio || '—'}</dd>
      <dt>Fuente</dt><dd>${m.fuente || '—'}</dd>
    </dl>
  </div>`;
}
function auxCard(m) {
  return `<div class="ficha">
    ${fichaImg(m)}
    <h4>${m.equipo}</h4>
    <dl>
      <dt>Dimensiones</dt><dd>${fmt(m.ancho,2)} × ${fmt(m.largo,2)} × ${fmt(m.alto,2)} m</dd>
      <dt>Cantidad</dt><dd>${fmt(m.cantidad)}</dd>
      <dt>Fuente</dt><dd>${m.fuente || '—'}</dd>
    </dl>
  </div>`;
}
function buildMaquinas() {
  const f = DATA.fichas_tecnicas;
  document.getElementById('fichas-maquinas-merm').innerHTML = f.mermeladas.map(maquinaCard).join('');
  document.getElementById('fichas-maquinas-snack').innerHTML = f.snacks.map(maquinaCard).join('');
  document.getElementById('fichas-maquinas-aux').innerHTML = f.auxiliares.map(auxCard).join('');
}

function buildFichasMP() {
  const cards = DATA.materia_prima_fichas.map(f => `
    <div class="ficha">
      <h4>${f.fruta}</h4>
      <dl>
        <dt>Destino</dt><dd>${f.producto_destino || '—'}</dd>
        <dt>Origen</dt><dd>${f.origen || '—'}</dd>
        <dt>Estacionalidad</dt><dd>${f.estacionalidad || '—'}</dd>
        <dt>Color</dt><dd>${f.color || '—'}</dd>
        <dt>Aroma</dt><dd>${f.aroma || '—'}</dd>
        <dt>Textura</dt><dd>${f.textura || '—'}</dd>
        <dt>°Brix</dt><dd>${f.brix || '—'}</dd>
        <dt>pH</dt><dd>${f.ph || '—'}</dd>
        <dt>Humedad</dt><dd>${f.humedad || '—'}</dd>
        <dt>Calibre</dt><dd>${f.calibre || '—'}</dd>
        <dt>Criterio aceptación</dt><dd>${f.criterio_aceptacion || '—'}</dd>
        <dt>Almacenamiento</dt><dd>${f.almacenamiento || '—'}</dd>
        <dt>Tiempo máx.</dt><dd>${f.tiempo_max || '—'}</dd>
      </dl>
    </div>`).join('');
  document.getElementById('fichas-mp-grid').innerHTML = cards;
}

function buildFichasProducto() {
  const merm = DATA.producto_fichas.filter(p => p.producto.includes('Mermelada'));
  const snack = DATA.producto_fichas.filter(p => p.producto.includes('Snack'));
  const card = p => `
    <div class="ficha">
      <h4>${p.denominacion}</h4>
      <dl>
        <dt>Composición</dt><dd>${p.composicion || '—'}</dd>
        <dt>Color</dt><dd>${p.color || '—'}</dd>
        <dt>Sabor</dt><dd>${p.sabor || '—'}</dd>
        <dt>pH</dt><dd>${p.ph || '—'}</dd>
        <dt>°Brix / Aw</dt><dd>${p.brix || '—'}</dd>
        <dt>Humedad</dt><dd>${p.humedad || '—'}</dd>
        <dt>Energía (100g)</dt><dd>${p.kcal_100g || '—'}</dd>
        <dt>Carbohidratos</dt><dd>${p.carbs_100g || '—'}</dd>
        <dt>Azúcares</dt><dd>${p.azucares_100g || '—'}</dd>
        <dt>Proteínas</dt><dd>${p.proteinas_100g || '—'}</dd>
        <dt>Grasas</dt><dd>${p.grasas_100g || '—'}</dd>
        <dt>Fibra</dt><dd>${p.fibra_100g || '—'}</dd>
        <dt>Sodio</dt><dd>${p.sodio_100g || '—'}</dd>
        <dt>Envasado</dt><dd>${p.envasado || '—'}</dd>
        <dt>Vida útil</dt><dd>${p.vida_util || '—'}</dd>
      </dl>
    </div>`;
  document.getElementById('fichas-prod-merm').innerHTML = merm.map(card).join('');
  document.getElementById('fichas-prod-snack').innerHTML = snack.map(card).join('');
}

function buildLayout() {
  const g = DATA.guerchet;
  document.getElementById('g-merm').textContent = fmt(g.totales['TOTAL MERMELADAS'], 2) + ' m²';
  document.getElementById('g-snack').textContent = fmt(g.totales['TOTAL SNACKS'], 2) + ' m²';
  document.querySelectorAll('#layout .card .big')[2].textContent = fmt(g.totales['TOTAL AUXILIARES'], 2) + ' m²';
  const cd = DATA.carga_distancia;
  document.getElementById('g-cd').textContent = fmt(cd.C0_TOTAL) + ' → ' + fmt(cd.C1_TOTAL);

  const allSectors = [...g.mermeladas.map(s => ({ ...s, linea: 'Mermeladas' })), ...g.snacks.map(s => ({ ...s, linea: 'Snacks' }))];
  new Chart('chart-guerchet', {
    type: 'bar',
    data: {
      labels: allSectors.map(s => s.nombre),
      datasets: [{ label: 'm²', data: allSectors.map(s => s.m2), backgroundColor: allSectors.map(s => s.linea === 'Mermeladas' ? COLORS.merm : COLORS.snack), borderRadius: 4 }]
    },
    options: { ...baseOpts(), indexAxis: 'y' }
  });

  new Chart('chart-rel', {
    type: 'bar',
    data: {
      labels: DATA.rel.sectores.map(s => s.codigo),
      datasets: [{ label: 'm²', data: DATA.rel.sectores.map(s => s.m2), backgroundColor: DATA.rel.sectores.map(s => s.zona === 'Zona Sucia' ? COLORS.merm : s.zona === 'Zona Limpia' ? COLORS.snack : COLORS.accent), borderRadius: 4 }]
    },
    options: baseOpts()
  });

  new Chart('chart-craft', {
    type: 'bar',
    data: {
      labels: ['Layout 0 (tentativo)', 'Layout 1 (post-CRAFT)'],
      datasets: [{ label: 'C (kg·m/día)', data: [cd.C0_TOTAL, cd.C1_TOTAL], backgroundColor: [COLORS.snack, COLORS.accent], borderRadius: 6 }]
    },
    options: { ...baseOpts(), indexAxis: 'y' }
  });

  buildRelDiagram();
}

function buildRelDiagram() {
  const sectores = DATA.rel.sectores;
  const coords = DATA.carga_distancia.coordenadas;
  const flujosA = DATA.carga_distancia.flujos_a;
  const flujosE = DATA.carga_distancia.flujos_e;
  const relX = DATA.rel.relaciones_x;

  const codigoOf = (nombreCompleto) => nombreCompleto.split(' ')[0];
  const sectorByCodigo = {};
  sectores.forEach(s => { sectorByCodigo[s.codigo] = s; });

  const nodes = Object.entries(coords).map(([nombreCompleto, xy]) => {
    const cod = codigoOf(nombreCompleto);
    const s = sectorByCodigo[cod] || {};
    return { nombreCompleto, codigo: cod, nombre: s.nombre || nombreCompleto, zona: s.zona || '', m2: s.m2 || 4, x: xy.x, y: xy.y };
  });
  const nodeByCodigo = {};
  nodes.forEach(n => { nodeByCodigo[n.codigo] = n; });

  const PX_PER_M = 13;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const PAD = 60;
  const W = (maxX - minX) * PX_PER_M + PAD * 2;
  const H = (maxY - minY) * PX_PER_M + PAD * 2;
  const px = (x) => (x - minX) * PX_PER_M + PAD;
  const py = (y) => (maxY - y) * PX_PER_M + PAD; // flip so +y is up

  const sizeOf = (m2) => Math.max(26, Math.sqrt(m2) * 9);

  const zonaColor = (zona) => zona === 'Zona Sucia' ? COLORS.merm
    : zona === 'Zona Limpia' ? COLORS.snack
    : zona === 'Transición BPM' ? '#9bd65c'
    : '#b08fe0';

  const lines = [];
  const maxFij = Math.max(...flujosA.map(f => f.fij));
  flujosA.forEach(f => {
    const a = nodeByCodigo[codigoOf(f.a)], b = nodeByCodigo[codigoOf(f.b)];
    if (!a || !b) return;
    const sw = 1.5 + (f.fij / maxFij) * 7;
    lines.push(`<line x1="${px(a.x)}" y1="${py(a.y)}" x2="${px(b.x)}" y2="${py(b.y)}" stroke="${COLORS.accent}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round" opacity="0.85"/>`);
  });
  flujosE.forEach(f => {
    const a = nodeByCodigo[codigoOf(f.a)], b = nodeByCodigo[codigoOf(f.b)];
    if (!a || !b) return;
    lines.push(`<line x1="${px(a.x)}" y1="${py(a.y)}" x2="${px(b.x)}" y2="${py(b.y)}" stroke="${COLORS.snack}" stroke-width="2" stroke-dasharray="6,4" opacity="0.8"/>`);
  });
  relX.forEach(rel => {
    const a = nodeByCodigo[codigoOf(rel.a)], b = nodeByCodigo[codigoOf(rel.b)];
    if (!a || !b) return;
    lines.push(`<line x1="${px(a.x)}" y1="${py(a.y)}" x2="${px(b.x)}" y2="${py(b.y)}" stroke="${COLORS.danger}" stroke-width="1.5" stroke-dasharray="2,5" opacity="0.55"/>`);
  });

  const boxes = nodes.map(n => {
    const s = sizeOf(n.m2);
    const x = px(n.x) - s / 2, y = py(n.y) - s / 2;
    return `<g>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" rx="6"
        fill="${zonaColor(n.zona)}" fill-opacity="0.85" stroke="#0f1419" stroke-width="1.5">
        <title>${n.codigo} — ${n.nombre} (${fmt(n.m2, 1)} m²)</title>
      </rect>
      <text x="${px(n.x)}" y="${(py(n.y) - s / 2 - 6).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${COLORS.text}">${n.codigo}</text>
    </g>`;
  }).join('');

  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${Math.min(H, 520)}" style="background:var(--panel2);border-radius:10px">
    ${lines.join('')}
    ${boxes}
  </svg>`;

  const legend = `
    <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:.78rem;color:var(--muted);margin-top:10px">
      <span><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="${COLORS.accent}" stroke-width="4"/></svg> Flujo de materiales (A) — grosor ∝ kg-eq/día</span>
      <span><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="${COLORS.snack}" stroke-width="2" stroke-dasharray="4,3"/></svg> Control de calidad (E)</span>
      <span><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="${COLORS.danger}" stroke-width="1.5" stroke-dasharray="2,4"/></svg> No deseable (X) — riesgo BPM</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:${COLORS.merm};border-radius:2px"></span> Zona Sucia</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:${COLORS.snack};border-radius:2px"></span> Zona Limpia</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#9bd65c;border-radius:2px"></span> Transición BPM</span>
      <span><span style="display:inline-block;width:10px;height:10px;background:#b08fe0;border-radius:2px"></span> Administración</span>
    </div>`;

  document.getElementById('rel-diagram').innerHTML = svg + legend;
}

function baseOpts(tickFmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: COLORS.text } } },
    scales: {
      x: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text } },
      y: { grid: { color: COLORS.grid }, ticks: { color: COLORS.text, callback: tickFmt } }
    }
  };
}

init();
