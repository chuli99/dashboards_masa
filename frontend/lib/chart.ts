import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

export { Chart };

// Grises translúcidos: se leen igual en tema claro y oscuro
export const AXIS = {
  grid: { color: 'rgba(148, 163, 184, 0.15)' },
  ticks: { font: { size: 11 }, color: '#94a3b8' },
  border: { color: 'rgba(148, 163, 184, 0.3)' },
};

export const TOOLTIP = {
  backgroundColor: '#0f172a',
  titleColor: '#94a3b8',
  bodyColor: '#f1f5f9',
  padding: 10,
  cornerRadius: 6,
  boxWidth: 8,
  boxHeight: 8,
};

export const LEGEND_LABELS = { font: { size: 11 }, color: '#94a3b8' };
