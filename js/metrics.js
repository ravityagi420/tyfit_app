import { fetchSelectableClients, populateClientSelector } from './client-selector.js';
import { metricConfigs, filterRecords, metricStats, fetchMetricHistory } from './metric-data.js';
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const date = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const cardDate = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const shortDate = value => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const number = (value, config) => value.toFixed(config.decimals);
const valueLabel = (value, config) => `${number(value, config)} ${config.unit}`;
const signed = value => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
const scaleIcon = '<span class="metric-icon" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><rect x="4" y="3" width="24" height="27" rx="7" fill="currentColor"/><path d="M10 8h12a6 6 0 0 1-12 0Z" fill="white"/><path d="m16 8 2 3" stroke="#7054ff" stroke-width="2"/><circle cx="16" cy="21" r="2" fill="white"/></svg></span>';
const icon = config => config.key === 'weight' ? scaleIcon : `<span class="metric-icon"><i data-lucide="${esc(config.icon)}"></i></span>`;
let chartSequence = 0;
export function renderMetricChart(records, config, compact = false) {
    if (!records.length) return '';
    const width = compact ? 400 : Math.min(640, Math.max(320, globalThis.innerWidth || 640)), height = compact ? 150 : 260, left = compact ? 8 : 48, right = width - 18, top = 20, bottom = height - 32;
    const values = records.map(row => row.value), spread = Math.max(...values) - Math.min(...values);
    const padding = Math.max(spread * .25, .5), min = Math.min(...values) - padding, max = Math.max(...values) + padding;
    const first = records[0].time, duration = records.at(-1).time - first;
    const points = records.map(row => ({ x: duration ? left + (row.time - first) / duration * (right - left) : (left + right) / 2, y: bottom - (row.value - min) / (max - min) * (bottom - top), row }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const id = `metric-gradient-${++chartSequence}`;
    const grid = compact ? '' : Array.from({ length: 5 }, (_, i) => {
        const y = top + i / 4 * (bottom - top);
        return `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="#e8e1ff" stroke-dasharray="5 4"/><text x="${left - 10}" y="${y + 4}" text-anchor="end">${number(max - i / 4 * (max - min), config)}</text>`;
    }).join('');
    const ticks = duration ? [0, .5, 1] : [.5];
    return `<svg class="metric-chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(config.name)} trend chart"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8064ff" stop-opacity=".23"/><stop offset="1" stop-color="#8064ff" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${line} L${points.at(-1).x},${bottom} L${points[0].x},${bottom} Z" fill="url(#${id})"/><path d="${line}" fill="none" stroke="#7656ff" stroke-width="2.5" stroke-linejoin="round"/>${points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" stroke="none" ${compact ? '' : `tabindex="0" role="button" data-point="${esc(`${valueLabel(p.row.value, config)} · ${new Date(p.row.time).toLocaleString()}`)}" aria-label="${esc(`${valueLabel(p.row.value, config)}, ${new Date(p.row.time).toLocaleString()}`)}"`}><title>${esc(`${valueLabel(p.row.value, config)} · ${date(p.row.time)}`)}</title></circle><circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="#7656ff" stroke-width="2" pointer-events="none" aria-hidden="true"/>`).join('')}${ticks.map(t => `<text x="${left + t * (right - left)}" y="${height - 6}" text-anchor="${t === 0 ? 'start' : t === 1 ? 'end' : 'middle'}">${esc(shortDate(first + duration * t))}</text>`).join('')}</svg>${compact ? '' : '<div class="metric-tooltip" aria-live="polite">Tap or focus a point to see the measurement</div>'}`;
}
export function renderMetricProgressCard(records, config) {
    const selected = filterRecords(records, '30D'), stats = metricStats(selected), latest = records.at(-1);
    return `<article class="metric-card"><div class="metric-card-head">${icon(config)}<div><h3>${esc(config.name)}</h3><p class="metric-muted">Track your progress</p></div><span class="metric-unit metric-period-label">Last 30 days</span></div><div class="metric-card-body"><div><div class="metric-value">${number(latest.value, config)} <small>${esc(config.unit)}</small></div>${stats && stats.count > 1 ? `<span class="metric-change">${signed(stats.change)} ${esc(config.unit)}</span><p class="metric-muted metric-card-date">since ${esc(cardDate(stats.first.time))}</p>` : `<p class="metric-muted metric-card-date">${esc(cardDate(latest.time))}</p>`}</div>${selected.length ? renderMetricChart(selected, config, true) : '<p class="metric-muted">No measurements in the last 30 days</p>'}</div><a class="metric-button" href="metric_history.html?metric=${encodeURIComponent(config.key)}"><span class="metric-history-link-label"><i data-lucide="chart-no-axes-combined" aria-hidden="true"></i>View ${esc(config.name)} History</span><span aria-hidden="true">→</span></a></article>`;
}
export function renderMetricProgressCarousel(metrics) {
    return `<div class="metric-carousel" aria-label="Your metrics">${metrics.map(item => renderMetricProgressCard(item.records, item.config)).join('')}</div>`;
}
function empty(config, admin, message = `No ${config.name.toLowerCase()} measurements yet`) {
    return `<div class="metric-panel metric-empty">${icon(config)}<h2>${esc(message)}</h2><p class="metric-muted">${admin ? 'Measurements will appear here when the client logs them.' : 'Log a measurement to start tracking your progress.'}</p>${admin ? '' : `<button class="metric-button metric-primary" data-log>+ Log ${esc(config.name)}</button>`}</div>`;
}
function renderHistory(records, invalid, config, range, admin) {
    const selected = filterRecords(records, range), stats = metricStats(selected);
    if (!stats) return `${invalid.length ? `<p class="metric-warning">${invalid.length} record(s) have unsupported units, dates or values and cannot be charted.</p>` : ''}${empty(config, admin, records.length ? 'No measurements in this period' : undefined)}`;
    return `${invalid.length ? `<p class="metric-warning">${invalid.length} record(s) have unsupported units, dates or values and cannot be charted.</p>` : ''}<section class="metric-panel metric-summary"><div class="metric-summary-top"><div><p class="metric-muted">Latest ${esc(config.name)}</p><div class="metric-value">${number(stats.latest.value, config)} <small>${esc(config.unit)}</small></div><span class="metric-change">${signed(stats.change)} ${esc(config.unit)}</span> <span class="metric-muted">since ${esc(shortDate(stats.first.time))}</span></div><div class="metric-stats"><div><span>Starting</span><strong>${valueLabel(stats.first.value, config)}</strong></div><div><span>Change</span><strong>${signed(stats.change)} ${esc(config.unit)}</strong><span>(${signed(stats.percentage)}%)</span></div><div><span>Average</span><strong>${valueLabel(stats.average, config)}</strong></div></div></div>${renderMetricChart(selected, config)}${stats.count === 1 ? '<p class="metric-muted">One measurement recorded. Log another to see a trend.</p>' : ''}</section><section class="metric-panel"><div class="metric-section-head"><h2>✧ Progress Insights</h2></div><p class="metric-muted">Here’s what your data shows</p><div class="metric-insights"><article><i data-lucide="trending-up"></i><strong>${signed(stats.change)} ${esc(config.unit)}</strong><span class="metric-muted">Change in selected period</span></article><article><i data-lucide="chart-no-axes-column"></i><strong>${valueLabel(stats.average, config)}</strong><span class="metric-muted">Average ${esc(config.name.toLowerCase())}</span></article><article><i data-lucide="clipboard-list"></i><strong>${stats.count}</strong><span class="metric-muted">Recorded measurements</span></article></div></section><section class="metric-panel"><div class="metric-section-head"><h2>${esc(config.name)} Entries</h2>${admin ? '' : `<button class="metric-button" data-log>+ Log ${esc(config.name)}</button>`}</div>${[...selected].reverse().map(row => `<div class="metric-entry"><time datetime="${new Date(row.time).toISOString()}">${esc(new Date(row.time).toLocaleDateString(undefined, { weekday: 'short' }))}</time><time>${esc(date(row.time))} · ${esc(new Date(row.time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))}</time><strong>${valueLabel(row.value, config)}</strong></div>`).join('')}</section>`;
}
async function init() {
    const home = document.getElementById('metricProgress'), page = document.getElementById('metricHistory');
    if (!home && !page) return;
    const host = home || page;
    host.innerHTML = '<div class="metric-skeleton" role="status" aria-label="Loading measurements"></div>';
    let access, config, owner, clients = [], records = [], invalid = [], range = '1M', revision = 0;
    const content = () => page ? document.getElementById('metricContent') : home;
    const render = () => {
        if (page) content().innerHTML = renderHistory(records, invalid, config, range, access.isAdmin);
        else home.innerHTML = records.length ? `<div class="metric-carousel" aria-label="Your metrics">${renderMetricProgressCard(records, config)}</div>` : empty(config, access.isAdmin);
        window.lucide?.createIcons();
    };
    const load = async () => {
        const token = ++revision;
        content().innerHTML = '<div class="metric-skeleton" role="status" aria-label="Loading measurements"></div>';
        try {
            if (home) {
                const metrics = await Promise.all(Object.values(metricConfigs).map(async item => ({
                    config: item,
                    ...await fetchMetricHistory(window.supabaseClient, access, item, owner, clients.map(c => c.id))
                })));
                if (token !== revision) return;
                const tracked = metrics.filter(item => item.records.length);
                home.innerHTML = tracked.length ? renderMetricProgressCarousel(tracked) : empty(config, access.isAdmin);
                const invalidCount = metrics.reduce((sum, item) => sum + item.invalid.length, 0);
                if (invalidCount) home.insertAdjacentHTML('beforeend', `<p class="metric-warning">${invalidCount} record(s) have unsupported units, dates or values. Open history for details.</p>`);
                window.lucide?.createIcons();
                return;
            }
            const result = await fetchMetricHistory(window.supabaseClient, access, config, owner, clients.map(c => c.id));
            if (token !== revision) return;
            records = result.records; invalid = result.invalid; render();
        } catch (error) {
            if (token !== revision) return;
            content().innerHTML = `<div class="metric-panel" role="alert"><p>${esc(error.message || 'Could not load measurements.')}</p><button class="metric-button" data-retry>Retry</button></div>`;
        }
    };
    host.addEventListener('click', event => {
        if (event.target.closest('[data-log]') && !access?.isAdmin && config?.key === 'weight') window.tyfitOpenWeightModal?.();
        if (event.target.closest('[data-retry]')) load();
        const filter = event.target.closest('[data-range]');
        if (filter) {
            range = filter.dataset.range;
            host.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(button === filter)));
            if (owner) render();
        }
    });
    function showPoint(event) {
        const point = event.target.closest('[data-point]');
        if (point) { const tooltip = point.closest('section').querySelector('.metric-tooltip'); if (tooltip) tooltip.textContent = point.dataset.point; }
    }
    host.addEventListener('pointerdown', showPoint); host.addEventListener('focusin', showPoint);
    host.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') showPoint(event); });
    try {
        access = await window.getAccessState();
        config = metricConfigs[page ? new URLSearchParams(location.search).get('metric') || 'weight' : 'weight'];
        if (!config) throw new Error('This metric is not available yet.');
        if (!access.isLoggedIn) { host.innerHTML = '<div class="metric-panel metric-empty"><p>Sign in to view your progress.</p><a class="metric-button" href="login.html">Sign in</a></div>'; return; }
        owner = access.isAdmin && page ? '' : access.user.id;
        if (page) {
            document.title = `${config.name} History | TYFIT`;
            host.innerHTML = `<header class="metric-header"><a href="index.html" aria-label="Back to Home"><i data-lucide="arrow-left"></i></a>${icon(config)}<div><h1>${esc(config.name)} History</h1><p>Track your progress over time</p></div><span class="metric-unit">${esc(config.unit)}</span></header>${access.isAdmin ? '<div class="metric-client"><label for="metricClientSelect">Select User</label><select id="metricClientSelect"><option value="">Loading clients…</option></select></div>' : ''}<div class="metric-filters" aria-label="Date range">${['1W','1M','3M','6M','1Y','All'].map(r => `<button type="button" data-range="${r}" aria-pressed="${r === range}">${r}</button>`).join('')}</div><div id="metricContent" aria-live="polite"></div>`;
        }
        if (access.isAdmin && page) {
            clients = await fetchSelectableClients(window.supabaseClient);
            const select = document.getElementById('metricClientSelect');
            populateClientSelector(select, clients);
            content().innerHTML = '<div class="metric-panel metric-empty">Select a client to view their measurements.</div>';
            select.addEventListener('change', () => { owner = select.value; revision++; records = []; invalid = []; if (owner) load(); else content().innerHTML = '<div class="metric-panel metric-empty">Select a client to view their measurements.</div>'; });
        } else {
            // Admin Home displays their own data; the history page opens the client selector.
            if (access.isAdmin) clients = [{ id: access.user.id }];
            await load();
        }
        window.lucide?.createIcons();
        window.supabaseClient.auth?.onAuthStateChange?.(event => {
            if (event === 'SIGNED_OUT') {
                revision++; owner = ''; records = []; invalid = [];
                host.innerHTML = '<div class="metric-panel metric-empty">Sign in to view your progress.</div>';
            }
        });
        window.addEventListener('tyfit:weight-saved', () => { if (owner) load(); });
        window.addEventListener('pageshow', event => { if (event.persisted && owner) load(); });
    } catch (error) { host.innerHTML = `<div class="metric-panel" role="alert">${esc(error.message || 'Could not load progress.')} <a href="index.html">Return Home</a></div>`; }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
