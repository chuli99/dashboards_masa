const API_URL = window.API_URL || `http://${window.location.hostname}:5050`;
function formatValUnit(val, unit) {
  if (!unit || /bool/i.test(unit)) return val >= 1 ? 'On' : 'Off';
  return val.toFixed(2) + ' ' + unit;
}

const SERIES = [
  { key: 'bajo',  label: 'Bajo',  color: '#ef4444' },
  { key: 'medio', label: 'Medio', color: '#22c55e' },
  { key: 'alto',  label: 'Alto',  color: '#f97316' },
];

const chartInstances = {};

async function fetchVariable(codigo) {
  const res = await fetch(`${API_URL}/api/variables/${codigo}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

const FROM_LAST_DATA = document.body.dataset.historico === '1';

async function fetchStats(codigo, period, valormin, valormax) {
  const params = new URLSearchParams({ period, valormin, valormax, from_last_data: FROM_LAST_DATA });
  const res = await fetch(`${API_URL}/api/variables/${codigo}/stats?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

const TOOLTIP_OPTS = {
  filter: (item) => item.raw != null,
  callbacks: {
    label: (ctx) => ctx.raw != null ? `${ctx.dataset.label}: ${ctx.raw.toFixed(4)}` : null,
  },
  backgroundColor: '#0f172a',
  titleColor: '#94a3b8',
  bodyColor: '#f1f5f9',
  padding: 10,
  cornerRadius: 6,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
};

function renderChart(period, data) {
  const canvas = document.getElementById(`chart-${period}`);
  const noData = document.getElementById(`nodata-${period}`);

  if (chartInstances[period]) {
    chartInstances[period].destroy();
    chartInstances[period] = null;
  }

  if (!data.labels.length) {
    canvas.style.display = 'none';
    noData.style.display = 'block';
    return;
  }

  canvas.style.display = 'block';
  noData.style.display = 'none';

  const isLine = period === '30d';

  chartInstances[period] = new Chart(canvas, {
    type: isLine ? 'line' : 'bar',
    data: {
      labels: data.labels,
      datasets: SERIES.map(({ key, label, color }) => isLine ? {
        label,
        data: data[key],
        borderColor: color,
        backgroundColor: color + '18',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        tension: 0.4,
        fill: false,
        spanGaps: false,
      } : {
        label,
        data: data[key],
        backgroundColor: color + 'cc',
        borderColor: color,
        borderWidth: 1,
        borderRadius: 3,
      }),
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
          labels: { boxWidth: isLine ? 16 : 12, font: { size: 11 }, usePointStyle: isLine },
        },
        tooltip: TOOLTIP_OPTS,
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 11 }, color: '#94a3b8' },
          border: { color: '#e2e8f0' },
        },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 11 }, color: '#94a3b8' },
          border: { color: '#e2e8f0' },
        },
      },
      ...(isLine && { interaction: { mode: 'index', intersect: false } }),
    },
  });
}

async function loadPeriod(codigo, period, valormin, valormax) {
  const loadingEl = document.getElementById(`loading-${period}`);
  loadingEl.textContent = 'Cargando...';
  loadingEl.style.display = 'block';
  document.getElementById(`nodata-${period}`).style.display = 'none';
  document.getElementById(`chart-${period}`).style.display = 'none';

  try {
    const data = await fetchStats(codigo, period, valormin, valormax);
    renderChart(period, data);
  } catch (e) {
    loadingEl.style.display = 'block';
    loadingEl.textContent = `Error: ${e.message}`;
    return;
  }

  loadingEl.style.display = 'none';
}

async function load(codigo, unit) {
  clearError();
  document.getElementById('btnRefresh').disabled = true;

  let variable;
  try {
    variable = await fetchVariable(codigo);
  } catch (e) {
    showError(`Variable ${codigo}: ${e.message}`);
    document.getElementById('btnRefresh').disabled = false;
    return;
  }

  document.getElementById('header-title').textContent = variable.nombre || `Variable ${codigo}`;
  document.getElementById('header-sub').textContent =
    `Código ${codigo}  ·  Min: ${variable.valormin}  ·  Max: ${variable.valormax}`;

  const cardEl = document.getElementById('card-current');
  const nombreEl = document.getElementById('current-nombre');
  const valorEl = document.getElementById('current-valor');
  const resolvedUnit = variable.unidad || unit;
  nombreEl.textContent = variable.nombre || `Variable ${codigo}`;
  valorEl.textContent = '–';
  cardEl.style.display = 'flex';

  fetch(`${API_URL}/api/variables/${codigo}/last`)
    .then(r => r.json())
    .then(data => { valorEl.textContent = formatValUnit(data.valor, resolvedUnit); })
    .catch(() => {});

  await Promise.all([
    loadPeriod(codigo, '30d', variable.valormin, variable.valormax),
    loadPeriod(codigo, '7d',  variable.valormin, variable.valormax),
    loadPeriod(codigo, '12h', variable.valormin, variable.valormax),
  ]);

  document.getElementById('btnRefresh').disabled = false;
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  document.getElementById('error').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('codigo');
  const unit = params.get('unit') || '';

  if (!codigo) {
    showError('Falta el parámetro ?codigo= en la URL.');
    return;
  }

  const btnRefresh = document.getElementById('btnRefresh');
  btnRefresh.addEventListener('click', () => load(codigo, unit));

  load(codigo, unit);
});
