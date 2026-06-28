const COLORS = {
  merm: '#e8a93e', snack: '#5b9bd5', accent: '#4fd1a5',
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

  [buildResumen, buildVentas, buildMateriaPrima, buildCAP, buildMaquinas, buildLayout].forEach(fn => {
    try { fn(); } catch (e) { console.error('Error en ' + fn.name + ':', e); }
  });
  setupNav();
}

function setupNav() {
  const buttons = document.querySelectorAll('nav button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('main section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
      requestAnimationFrame(() => Object.values(Chart.instances).forEach(c => c.resize()));
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
  const ctx = document.getElementById('chart-cap');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: merm10.secciones.map(s => s.seccion),
      datasets: [
        { label: 'Mermeladas Año 10 (%)', data: merm10.secciones.map(s => +(s.aprovechamiento * 100).toFixed(1)), backgroundColor: COLORS.merm, borderRadius: 4 },
      ]
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

function buildMaquinas() {
  const f = DATA.fichas_tecnicas;
  const rowsMerm = f.mermeladas.map(m => `<tr><td>${m.seccion}</td><td>${m.equipo}</td><td>${m.marca}</td><td>${m.ancho}×${m.largo} m</td><td>${fmt(m.cantidad)}</td></tr>`).join('');
  const rowsSnack = f.snacks.map(m => `<tr><td>${m.seccion}</td><td>${m.equipo}</td><td>${m.marca}</td><td>${m.ancho}×${m.largo} m</td><td>${fmt(m.cantidad)}</td></tr>`).join('');
  const head = `<tr><th>Sección</th><th>Equipo</th><th>Marca / Modelo</th><th>Dimensiones</th><th>Cant.</th></tr>`;
  document.getElementById('tabla-fichas-merm').innerHTML = head + rowsMerm;
  document.getElementById('tabla-fichas-snack').innerHTML = head + rowsSnack;
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
      labels: DATA.rel.map(s => s.codigo),
      datasets: [{ label: 'm²', data: DATA.rel.map(s => s.m2), backgroundColor: DATA.rel.map(s => s.zona === 'Zona Sucia' ? COLORS.merm : s.zona === 'Zona Limpia' ? COLORS.snack : COLORS.accent), borderRadius: 4 }]
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
