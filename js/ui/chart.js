import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm';
import { h } from '../core/dom.js';

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function lineChart({ label, points, formatX, formatY }) {
  const canvas = h('canvas', { role: 'img', 'aria-label': label });
  const element = h('div', { class: 'chart' }, canvas);
  const accent = token('--accent');
  const surface = token('--surface');
  const muted = token('--muted');
  const grid = token('--border');
  const ticks = { color: muted, font: { size: 11 } };

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [{
        label,
        data: points,
        borderColor: accent,
        borderWidth: 2,
        borderJoinStyle: 'round',
        borderCapStyle: 'round',
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: accent,
        pointBorderColor: surface,
        pointBorderWidth: 2,
        pointHitRadius: 16,
        tension: 0,
      }],
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          border: { color: grid },
          ticks: { ...ticks, maxTicksLimit: 5, callback: (value) => formatX(value) },
        },
        y: {
          grid: { color: grid },
          border: { display: false },
          ticks: { ...ticks, maxTicksLimit: 5, callback: (value) => formatY(value) },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => formatX(items[0].parsed.x),
            label: (item) => formatY(item.parsed.y),
          },
        },
      },
    },
  });

  return { element, destroy: () => chart.destroy() };
}
