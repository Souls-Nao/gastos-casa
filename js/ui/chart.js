import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/auto/+esm';
import { h } from '../core/dom.js';

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function lineStyle(color) {
  return {
    borderColor: color,
    borderWidth: 2,
    borderJoinStyle: 'round',
    borderCapStyle: 'round',
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: color,
    pointBorderColor: token('--surface'),
    pointBorderWidth: 2,
    pointHitRadius: 16,
    tension: 0,
  };
}

function axes(formatX, formatY, type) {
  const ticks = { color: token('--muted'), font: { size: 11 }, maxTicksLimit: 6 };
  return {
    x: {
      type,
      grid: { display: false },
      border: { color: token('--border') },
      ticks: formatX ? { ...ticks, callback: (value) => formatX(value) } : ticks,
    },
    y: {
      beginAtZero: type === 'category',
      grid: { color: token('--border') },
      border: { display: false },
      ticks: { ...ticks, callback: (value) => formatY(value) },
    },
  };
}

function mount(label, className, config) {
  const canvas = h('canvas', { role: 'img', 'aria-label': label });
  const element = h('div', { class: className }, canvas);
  const chart = new Chart(canvas, config);
  return { element, destroy: () => chart.destroy() };
}

export function lineChart({ label, points, formatX, formatY }) {
  return mount(label, 'chart', {
    type: 'line',
    data: { datasets: [{ label, data: points, ...lineStyle(token('--accent')) }] },
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      scales: axes(formatX, formatY, 'linear'),
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { title: (items) => formatX(items[0].parsed.x), label: (item) => formatY(item.parsed.y) },
        },
      },
    },
  });
}

export function trendChart({ label, labels, series, formatY, formatTick }) {
  const colors = [token('--chart-1'), token('--chart-2')];
  return mount(label, 'chart', {
    type: 'line',
    data: {
      labels,
      datasets: series.map((entry, index) => ({ label: entry.label, data: entry.data, ...lineStyle(colors[index]) })),
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      scales: axes(null, formatTick, 'category'),
      plugins: {
        legend: { display: false },
        tooltip: { boxWidth: 12, boxHeight: 2, callbacks: { label: (item) => `${formatY(item.parsed.y)}  ${item.dataset.label}` } },
      },
    },
  });
}

export function donutChart({ label, segments, formatValue, center, onSelect }) {
  const result = mount(label, 'chart chart--donut', {
    type: 'doughnut',
    data: {
      labels: segments.map((segment) => segment.label),
      datasets: [{
        data: segments.map((segment) => segment.value),
        backgroundColor: segments.map((segment) => segment.color),
        borderColor: token('--surface'),
        borderWidth: 2,
        hoverOffset: 4,
      }],
    },
    options: {
      maintainAspectRatio: false,
      animation: false,
      cutout: '68%',
      layout: { padding: 4 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => formatValue(item.parsed) } },
      },
      onClick(event, elements) {
        if (elements.length) onSelect(elements[0].index);
      },
    },
  });
  result.element.append(h('div', { class: 'chart__center' }, center));
  return result;
}
