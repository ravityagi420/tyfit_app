const STORAGE_KEYS = {
    selectedTickers: 'stock_tracker_selected_tickers',
    buyPrices: 'stock_tracker_buy_prices',
    autoRefresh: 'stock_tracker_auto_refresh',
    refreshInterval: 'stock_tracker_refresh_interval',
    sortOption: 'stock_tracker_sort_option'
};

const STOCKS = [
    { ticker: 'VBK', label: 'Verbio' },
    { ticker: 'DRO', label: 'German Oil' },
    { ticker: 'LLY', label: 'Eli Lilly' },
    { ticker: 'NVD', label: 'NVIDIA' },
    { ticker: 'FB2A', label: 'Meta' },
    { ticker: 'BMW', label: 'BMW' },
    { ticker: 'CBK', label: 'Commerzbank' },
    { ticker: 'AIR', label: 'Airbus' },
    { ticker: 'SIE', label: 'Siemens' },
    { ticker: 'ABEC', label: 'Alphabet' },
];

const USE_REAL_API = false;
const DEFAULT_REFRESH_INTERVAL = 30;
const MOCK_BASE_PRICES = {
    BMW: 76.45,
    RHM: 124.90,
    DTE: 17.75,
    SIE: 109.60
};

const state = {
    selectedTickers: [],
    buyPrices: {},
    autoRefresh: false,
    refreshInterval: DEFAULT_REFRESH_INTERVAL,
    sortOption: 'ticker',
    filterQuery: '',
    quotes: {},
    history: {},
    combinedChart: null,
    miniCharts: {},
    autoRefreshTimer: null
};

window.addEventListener('DOMContentLoaded', initStockTracker);

function initStockTracker() {
    loadSelectedTickers();
    loadBuyPrices();
    loadAutoRefresh();
    loadRefreshInterval();
    loadSortOption();
    attachUiEvents();
    renderTickerSelector();
    refreshAllData();
    if (state.autoRefresh) {
        startAutoRefresh();
    }
}

function getConfiguredStocks() {
    return STOCKS.slice();
}

function loadSelectedTickers() {
    const raw = localStorage.getItem(STORAGE_KEYS.selectedTickers);
    if (!raw) {
        state.selectedTickers = getConfiguredStocks().map(stock => stock.ticker);
        return;
    }
    try {
        const parsed = JSON.parse(raw);
        state.selectedTickers = Array.isArray(parsed) && parsed.length ? parsed : getConfiguredStocks().map(stock => stock.ticker);
    } catch {
        state.selectedTickers = getConfiguredStocks().map(stock => stock.ticker);
    }
}

function saveSelectedTickers() {
    localStorage.setItem(STORAGE_KEYS.selectedTickers, JSON.stringify(state.selectedTickers));
}

function loadBuyPrices() {
    const raw = localStorage.getItem(STORAGE_KEYS.buyPrices);
    if (!raw) {
        state.buyPrices = {};
        return;
    }
    try {
        state.buyPrices = JSON.parse(raw) || {};
    } catch {
        state.buyPrices = {};
    }
}

function saveBuyPrice(ticker, value) {
    const normalized = Number(value);
    if (!value || Number.isNaN(normalized) || normalized <= 0) {
        delete state.buyPrices[ticker];
    } else {
        state.buyPrices[ticker] = Number(normalized.toFixed(2));
    }
    localStorage.setItem(STORAGE_KEYS.buyPrices, JSON.stringify(state.buyPrices));
    renderDashboard();
}

function loadAutoRefresh() {
    const raw = localStorage.getItem(STORAGE_KEYS.autoRefresh);
    state.autoRefresh = raw === 'true';
    const toggle = document.getElementById('autoRefreshToggle');
    if (toggle) toggle.checked = state.autoRefresh;
}

function saveAutoRefresh(value) {
    state.autoRefresh = Boolean(value);
    localStorage.setItem(STORAGE_KEYS.autoRefresh, state.autoRefresh.toString());
}

function loadRefreshInterval() {
    const raw = localStorage.getItem(STORAGE_KEYS.refreshInterval);
    const parsed = Number(raw);
    state.refreshInterval = parsed > 0 ? parsed : DEFAULT_REFRESH_INTERVAL;
    const input = document.getElementById('refreshInterval');
    if (input) input.value = state.refreshInterval.toString();
}

function saveRefreshInterval(value) {
    const parsed = Number(value);
    state.refreshInterval = parsed > 0 ? parsed : DEFAULT_REFRESH_INTERVAL;
    localStorage.setItem(STORAGE_KEYS.refreshInterval, state.refreshInterval.toString());
}

function loadSortOption() {
    const raw = localStorage.getItem(STORAGE_KEYS.sortOption);
    const select = document.getElementById('sortOption');
    if (raw) {
        state.sortOption = raw;
    }
    if (select) {
        select.value = state.sortOption;
    }
}

function saveSortOption(value) {
    state.sortOption = value;
    localStorage.setItem(STORAGE_KEYS.sortOption, value);
    renderDashboard();
}

function attachUiEvents() {
    const search = document.getElementById('tickerSearch');
    const selectAll = document.getElementById('selectAllTickers');
    const clearAll = document.getElementById('clearAllBtn');
    const refreshButton = document.getElementById('refreshDataBtn');
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    const refreshInterval = document.getElementById('refreshInterval');
    const sortOption = document.getElementById('sortOption');

    if (search) {
        search.addEventListener('input', event => {
            state.filterQuery = event.target.value.trim().toLowerCase();
            renderTickerSelector();
        });
    }

    if (selectAll) {
        selectAll.addEventListener('change', event => {
            if (event.target.checked) {
                state.selectedTickers = getConfiguredStocks().map(stock => stock.ticker);
            } else {
                state.selectedTickers = [];
            }
            saveSelectedTickers();
            renderTickerSelector();
            renderDashboard();
        });
    }

    if (clearAll) {
        clearAll.addEventListener('click', () => {
            state.selectedTickers = [];
            saveSelectedTickers();
            if (document.getElementById('selectAllTickers')) {
                document.getElementById('selectAllTickers').checked = false;
            }
            renderTickerSelector();
            renderDashboard();
        });
    }

    if (refreshButton) {
        refreshButton.addEventListener('click', refreshAllData);
    }

    if (autoRefreshToggle) {
        autoRefreshToggle.addEventListener('change', event => {
            saveAutoRefresh(event.target.checked);
            if (state.autoRefresh) {
                startAutoRefresh();
            } else {
                stopAutoRefresh();
            }
        });
    }

    if (refreshInterval) {
        refreshInterval.addEventListener('change', event => {
            saveRefreshInterval(event.target.value);
            if (state.autoRefresh) {
                stopAutoRefresh();
                startAutoRefresh();
            }
        });
    }

    if (sortOption) {
        sortOption.addEventListener('change', event => saveSortOption(event.target.value));
    }
}

async function fetchStockPrices() {
    const tickers = getConfiguredStocks().map(stock => stock.ticker);
    const quotes = await getLiveQuotes(tickers);
    state.quotes = quotes;
    return quotes;
}

async function fetchStockHistory(ticker) {
    const history = await getTickerHistory(ticker, '1D');
    state.history[ticker] = history;
    return history;
}

async function refreshAllData() {
    const selector = document.getElementById('refreshDataBtn');
    if (selector) selector.disabled = true;
    await fetchStockPrices();
    const selected = state.selectedTickers.slice();
    await Promise.all(selected.map(ticker => fetchStockHistory(ticker)));
    renderDashboard();
    if (selector) selector.disabled = false;
}

function renderDashboard() {
    renderSummary();
    renderCombinedChart();
    renderStockCards();
}

function renderSummary() {
    const stats = { selected: 0, gainers: 0, losers: 0, totalMove: 0, validMoves: 0 };
    const selectedTickers = state.selectedTickers.map(ticker => ticker.toUpperCase());

    selectedTickers.forEach(ticker => {
        const quote = state.quotes[ticker];
        const buyPrice = Number(state.buyPrices[ticker]);
        if (!quote) return;
        stats.selected += 1;
        const delta = calculateDelta(quote.price, buyPrice);
        if (delta && typeof delta.percent === 'number') {
            stats.totalMove += delta.percent;
            stats.validMoves += 1;
            if (delta.delta > 0) stats.gainers += 1;
            if (delta.delta < 0) stats.losers += 1;
        }
    });

    document.getElementById('selectedCount').textContent = stats.selected.toString();
    document.getElementById('gainersCount').textContent = stats.gainers.toString();
    document.getElementById('losersCount').textContent = stats.losers.toString();
    document.getElementById('averageMove').textContent = stats.validMoves ? `${(stats.totalMove / stats.validMoves).toFixed(2)} %` : '—';
}

function renderTickerSelector() {
    const selector = document.getElementById('tickerSelector');
    if (!selector) return;

    const query = state.filterQuery.toLowerCase();
    const stocks = getConfiguredStocks().filter(stock => {
        if (!query) return true;
        return stock.ticker.toLowerCase().includes(query) || stock.label.toLowerCase().includes(query);
    });

    selector.innerHTML = stocks.map(stock => {
        const isChecked = state.selectedTickers.includes(stock.ticker);
        return `
            <label class="ticker-row">
                <input type="checkbox" data-ticker="${stock.ticker}" ${isChecked ? 'checked' : ''}>
                <div class="ticker-content">
                    <span class="ticker-name">${stock.ticker}</span>
                    <span class="ticker-description">${stock.label}</span>
                </div>
            </label>
        `;
    }).join('');

    const availableCount = stocks.length;
    const selectedCount = state.selectedTickers.length;
    document.getElementById('selectedBadge').textContent = `${selectedCount} selected`;
    document.getElementById('availableBadge').textContent = `${availableCount} available`;

    const selectAllNode = document.getElementById('selectAllTickers');
    if (selectAllNode) {
        selectAllNode.checked = state.selectedTickers.length === getConfiguredStocks().length;
    }

    selector.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', event => {
            const ticker = event.target.dataset.ticker;
            if (!ticker) return;
            if (event.target.checked) {
                state.selectedTickers = Array.from(new Set([...state.selectedTickers, ticker]));
            } else {
                state.selectedTickers = state.selectedTickers.filter(item => item !== ticker);
            }
            saveSelectedTickers();
            renderTickerSelector();
            renderDashboard();
            fetchStockHistory(ticker);
        });
    });
}

function renderStockCards() {
    const container = document.getElementById('stockCardsContainer');
    if (!container) return;

    Object.values(state.miniCharts).forEach(chart => chart.destroy());
    state.miniCharts = {};

    const rows = getSortedTickers().map(ticker => {
        const quote = state.quotes[ticker];
        const buyPrice = Number(state.buyPrices[ticker]);
        const delta = calculateDelta(quote?.price, buyPrice);
        const history = state.history[ticker] || [];
        const priceLabel = quote ? formatEuro(quote.price) : 'Loading…';
        const updatedLabel = quote ? new Date(quote.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending';

        return `
            <article class="stock-card" data-ticker="${ticker}">
                <div class="stock-card-header">
                    <div class="stock-symbol">
                        <span class="symbol-pill">${ticker}</span>
                        <div class="stock-title">
                            <strong>${quote?.label || ticker}</strong>
                            <small>${quote?.company || findStockLabel(ticker)}</small>
                        </div>
                    </div>
                    <div class="stock-price">
                        <span class="price">${priceLabel}</span>
                        <small>Updated ${updatedLabel}</small>
                    </div>
                </div>
                <div class="stock-body">
                    <div class="input-group">
                        <label for="buyPrice-${ticker}">Buy price</label>
                        <input id="buyPrice-${ticker}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Enter buy price" value="${state.buyPrices[ticker] || ''}">
                    </div>
                    <div class="card-grid">
                        <div class="stat-pill">
                            <span class="stat-label">Delta EUR</span>
                            <span class="stat-value ${delta?.delta > 0 ? 'positive' : delta?.delta < 0 ? 'negative' : ''}">${delta ? formatEuro(delta.delta) : '—'}</span>
                        </div>
                        <div class="stat-pill">
                            <span class="stat-label">Delta %</span>
                            <span class="stat-value ${delta?.percent > 0 ? 'positive' : delta?.percent < 0 ? 'negative' : ''}">${delta ? `${delta.percent.toFixed(2)} %` : '—'}</span>
                        </div>
                        <div class="stat-pill">
                            <span class="stat-label">Trend</span>
                            <span class="stat-value ${delta?.trend === 'up' ? 'positive' : delta?.trend === 'down' ? 'negative' : ''}">${delta ? delta.trend : '—'}</span>
                        </div>
                        <div class="stat-pill">
                            <span class="stat-label">Buy price</span>
                            <span class="stat-value">${state.buyPrices[ticker] ? formatEuro(state.buyPrices[ticker]) : '—'}</span>
                        </div>
                    </div>
                    <div class="mini-chart-wrap">
                        <canvas id="miniChart-${ticker}" class="mini-chart"></canvas>
                    </div>
                </div>
            </article>
        `;
    });

    container.innerHTML = rows.join('') || '<div class="no-selection">No tickers selected. Choose instruments from the list above.</div>';

    getSortedTickers().forEach(ticker => {
        const chartId = `miniChart-${ticker}`;
        const canvas = document.getElementById(chartId);
        if (canvas) {
            const history = state.history[ticker] || [];
            state.miniCharts[ticker] = renderMiniChart(canvas, history, ticker);
        }
        const input = document.getElementById(`buyPrice-${ticker}`);
        if (input) {
            input.addEventListener('change', event => {
                saveBuyPrice(ticker, event.target.value);
            });
            input.addEventListener('blur', event => {
                saveBuyPrice(ticker, event.target.value);
            });
        }
    });
}

function renderCombinedChart() {
    const canvas = document.getElementById('combinedChart');
    if (!canvas) return;

    const selected = state.selectedTickers.slice();
    const datasets = selected.map((ticker, index) => {
        const history = state.history[ticker] || [];
        const color = getColor(index);
        return {
            label: ticker,
            data: history.map(point => point.price),
            borderColor: color,
            backgroundColor: color,
            tension: 0.25,
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        };
    });

    const labels = state.history[selected[0]] ? state.history[selected[0]].map(point => new Date(point.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : [];

    if (state.combinedChart) {
        state.combinedChart.data.labels = labels;
        state.combinedChart.data.datasets = datasets;
        state.combinedChart.update();
        return;
    }

    state.combinedChart = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle' } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatEuro(ctx.parsed.y)}` } }
            },
            scales: {
                x: {
                    type: 'category',
                    grid: { color: 'rgba(148, 163, 184, 0.18)' },
                    ticks: { color: '#64748b' }
                },
                y: {
                    grid: { color: 'rgba(148, 163, 184, 0.18)' },
                    ticks: { color: '#64748b', callback: value => formatEuro(value) }
                }
            }
        }
    });
}

function renderMiniChart(canvas, history, ticker) {
    if (!canvas) return null;
    const color = getColor(getConfiguredStocks().findIndex(stock => stock.ticker === ticker));
    const data = history.map(point => point.price);
    const labels = history.map(point => '');

    return new Chart(canvas, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: color,
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false }
            }
        }
    });
}

function calculateDelta(currentPrice, buyPrice) {
    const current = Number(currentPrice);
    const buy = Number(buyPrice);
    if (!current || !buy || Number.isNaN(current) || Number.isNaN(buy) || buy <= 0) {
        return null;
    }
    const delta = Number((current - buy).toFixed(2));
    const percent = Number(((delta / buy) * 100).toFixed(2));
    const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    return { delta, percent, trend };
}

function formatEuro(value) {
    const number = Number(value);
    if (Number.isNaN(number)) {
        return '—';
    }
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(number);
}

function startAutoRefresh() {
    stopAutoRefresh();
    state.autoRefreshTimer = setInterval(() => {
        refreshAllData();
    }, state.refreshInterval * 1000);
}

function stopAutoRefresh() {
    if (state.autoRefreshTimer) {
        clearInterval(state.autoRefreshTimer);
        state.autoRefreshTimer = null;
    }
}

function findStockLabel(ticker) {
    const target = getConfiguredStocks().find(stock => stock.ticker === ticker);
    return target ? target.label : ticker;
}

function getSortedTickers() {
    const selected = state.selectedTickers.slice();
    const values = selected.map(ticker => ({ ticker, quote: state.quotes[ticker], buyPrice: Number(state.buyPrices[ticker]) }));

    values.sort((a, b) => {
        switch (state.sortOption) {
            case 'price':
                return (b.quote?.price || 0) - (a.quote?.price || 0);
            case 'delta': {
                const deltaA = calculateDelta(a.quote?.price, a.buyPrice)?.percent || 0;
                const deltaB = calculateDelta(b.quote?.price, b.buyPrice)?.percent || 0;
                return deltaB - deltaA;
            }
            case 'trend': {
                const trendWeight = { up: 2, flat: 1, down: 0 };
                const trendA = trendWeight[calculateDelta(a.quote?.price, a.buyPrice)?.trend] || 1;
                const trendB = trendWeight[calculateDelta(b.quote?.price, b.buyPrice)?.trend] || 1;
                return trendB - trendA;
            }
            default:
                return a.ticker.localeCompare(b.ticker);
        }
    });

    return values.map(item => item.ticker);
}

function getColor(index) {
    const palette = ['#2563eb', '#16a34a', '#eab308', '#f97316', '#7c3aed', '#0891b2'];
    return palette[index % palette.length];
}

async function getLiveQuotes(tickers) {
    if (USE_REAL_API) {
        // Replace this section with a real quote provider.
        // Example: fetch prices from a stock API and return an object of { ticker: { price, timestamp, company } }
        return fetchRealQuotes(tickers);
    }
    return generateMockQuotes(tickers);
}

async function getTickerHistory(ticker) {
    if (USE_REAL_API) {
        // Replace this with a real history provider.
        return fetchRealHistory(ticker);
    }
    return generateMockHistory(ticker);
}

async function fetchRealQuotes(tickers) {
    // Placeholder for future API integration.
    // const response = await fetch(`YOUR_API_ENDPOINT?symbols=${tickers.join(',')}`);
    // const data = await response.json();
    // return transformApiResponse(data);
    return generateMockQuotes(tickers);
}

async function fetchRealHistory(ticker) {
    // Placeholder for future API integration.
    // const response = await fetch(`YOUR_HISTORY_ENDPOINT?ticker=${ticker}`);
    // return transformHistoryResponse(await response.json());
    return generateMockHistory(ticker);
}

function generateMockQuotes(tickers) {
    const quotes = {};
    tickers.forEach(ticker => {
        const previous = state.quotes[ticker]?.price || MOCK_BASE_PRICES[ticker] || 50;
        const change = (Math.random() * 0.018 - 0.009) * previous;
        const nextPrice = Number(Math.max(1, previous + change).toFixed(2));
        quotes[ticker] = {
            ticker,
            label: findStockLabel(ticker),
            company: findStockLabel(ticker),
            price: nextPrice,
            timestamp: Date.now()
        };
    });
    return new Promise(resolve => setTimeout(() => resolve(quotes), 250));
}

function generateMockHistory(ticker, pointCount = 24) {
    const existing = state.history[ticker] || [];
    const lastPrice = state.quotes[ticker]?.price || MOCK_BASE_PRICES[ticker] || 50;
    const now = Date.now();
    const interval = 15 * 60 * 1000;

    if (existing.length >= pointCount) {
        const history = existing.slice(-pointCount);
        const base = history[history.length - 1].price;
        const nextPrice = Number(Math.max(1, base * (1 + (Math.random() * 0.018 - 0.009))).toFixed(2));
        history.push({ time: now, price: nextPrice });
        return history.slice(-pointCount);
    }

    const history = [];
    let price = lastPrice * (0.94 + Math.random() * 0.12);
    for (let index = 0; index < pointCount; index += 1) {
        price = Math.max(1, price * (1 + (Math.random() * 0.014 - 0.007)));
        history.push({ time: now - (pointCount - index) * interval, price: Number(price.toFixed(2)) });
    }
    history.push({ time: now, price: Number((lastPrice * (1 + (Math.random() * 0.014 - 0.007))).toFixed(2)) });
    return history.slice(-pointCount);
}
