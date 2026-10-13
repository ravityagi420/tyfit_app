import test from 'node:test';
import assert from 'node:assert/strict';
import { metricConfigs, normalizeRecords, filterRecords, metricStats, resolveMetricOwner, fetchMetricHistory } from '../../js/metric-data.js';
const config = metricConfigs.weight;
const normalized = rows => normalizeRecords(rows, config).records;
const record = (id, value, logged_at, unit = 'kg') => ({ id, value, logged_at, unit });
test('sorts records without discarding same-day entries and converts pounds', () => {
    const result = normalizeRecords([record('b', 70, '2026-10-12T12:00:00Z'), record('a', 150, '2026-10-12T08:00:00Z', 'lb'), record('c', null, '2026-10-12'), record('d', 70, 'bad'), record('e', 70, '2026-10-12', 'unknown')], config);
    assert.equal(result.records.length, 2); assert.equal(result.invalid.length, 3);
    assert.equal(result.records[0].id, 'a'); assert.ok(Math.abs(result.records[0].value - 68.0388555) < 1e-6);
});
test('calculates period baseline, average, percentage, empty and single record states', () => {
    const records = normalized([record('a', 80, '2026-08-01'), record('b', 70, '2026-10-01'), record('c', 72, '2026-10-12')]);
    const stats = metricStats(filterRecords(records, '1M', new Date('2026-10-13T12:00:00Z')));
    assert.equal(stats.first.value, 70); assert.equal(stats.change, 2); assert.equal(stats.average, 71);
    assert.equal(stats.percentage, 2 / 70 * 100); assert.equal(metricStats([]), null);
    assert.equal(metricStats(records.slice(0, 1)).change, 0);
});
test('calendar month clamp and local midnight boundaries', () => {
    const now = new Date(2026, 2, 31, 12);
    const rows = normalized([record('a', 70, new Date(2026, 1, 27, 23, 59).toISOString()), record('b', 71, new Date(2026, 1, 28, 0).toISOString())]);
    assert.deepEqual(filterRecords(rows, '1M', now).map(r => r.id), ['b']);
    assert.equal(filterRecords(rows, 'All', now).length, 2);
    const week = normalized([record('c', 70, new Date(2026, 2, 25, 0).toISOString()), record('d', 71, new Date(2026, 2, 24, 23, 59).toISOString())]);
    assert.deepEqual(filterRecords(week, '1W', now).map(r => r.id), ['c']);
});
test('rejects unauthenticated and cross-user queries and restricts admin selection', () => {
    const user = { user: { id: 'self' }, isAdmin: false };
    assert.equal(resolveMetricOwner(user), 'self');
    assert.throws(() => resolveMetricOwner(user, 'other', ['other']));
    assert.throws(() => resolveMetricOwner({}, 'other'));
    assert.throws(() => resolveMetricOwner({ ...user, isAdmin: true }, 'other', []));
    assert.equal(resolveMetricOwner({ ...user, isAdmin: true }, 'other', ['other']), 'other');
});
test('fetch applies both owner and metric filters and paginates', async () => {
    const calls = []; let pages = 0;
    const client = { from(table) { assert.equal(table, 'user_metric_logs'); return { select() { return this; }, eq(key, value) { calls.push([key, value]); return this; }, order() { return this; }, async range(start, end) { assert.equal(end - start, 999); pages++; return { data: pages === 1 ? Array.from({ length: 1000 }, (_, i) => record(String(i), 70, '2026-10-01')) : [record('last', 71, '2026-10-02')] }; } }; } };
    const result = await fetchMetricHistory(client, { user: { id: 'self' }, isAdmin: false }, config);
    assert.equal(result.records.length, 1001); assert.equal(pages, 2);
    assert.deepEqual(calls, [['user_id','self'], ['metric_key','weight'], ['user_id','self'], ['metric_key','weight']]);
});
test('all supported date ranges and future exclusion', () => {
    const now = new Date(2026, 9, 13, 12);
    const rows = normalized([record('old', 80, new Date(2025, 8, 1).toISOString()), record('year', 79, new Date(2025, 10, 1).toISOString()), record('six', 78, new Date(2026, 4, 1).toISOString()), record('three', 77, new Date(2026, 7, 1).toISOString()), record('month', 76, new Date(2026, 9, 1).toISOString()), record('week', 75, new Date(2026, 9, 12).toISOString()), record('future', 74, new Date(2026, 10, 1).toISOString())]);
    for (const [range, count] of [['1W',1],['1M',2],['3M',3],['6M',4],['1Y',5],['All',7]]) assert.equal(filterRecords(rows,range,now).length,count,range);
});
test('unauthorized selection never reaches database; database errors propagate', async () => {
    let touched = false;
    await assert.rejects(fetchMetricHistory({from(){touched=true;}}, {user:{id:'self'},isAdmin:false},config,'other'));
    assert.equal(touched,false);
    const client = {from(){return{select(){return this},eq(){return this},order(){return this},async range(){return{error:new Error('Permission denied')}}}}};
    await assert.rejects(fetchMetricHistory(client,{user:{id:'self'},isAdmin:false},config),/Permission denied/);
});
test('reusable carousel renders multiple configured metrics and chart points are accessible', async () => {
    globalThis.document = { readyState:'complete', getElementById:()=>null };
    const { renderMetricProgressCarousel, renderMetricChart } = await import('../../js/metrics.js');
    const records = normalized([record('a',70,new Date().toISOString())]);
    const html = renderMetricProgressCarousel([{config,records},{config:{...config,key:'body-fat',name:'Body Fat',unit:'%',icon:'activity'},records}]);
    assert.equal((html.match(/class="metric-card"/g)||[]).length,2);
    assert.match(html,/metric=body-fat/);
    const chart = renderMetricChart(records,config);
    assert.match(chart,/tabindex="0" role="button"/); assert.match(chart,/data-point=/);
    delete globalThis.document;
});
