export const metricConfigs = {
    weight: { key: 'weight', name: 'Weight', unit: 'kg', decimals: 1, icon: 'scale', units: { kg: 1, lb: 0.45359237, lbs: 0.45359237 } }
};
export function normalizeRecords(rows, config) {
    const records = [], invalid = [];
    for (const row of rows) {
        const factor = config.units[String(row.unit || config.unit).toLowerCase()];
        const value = row.value === null || row.value === '' ? NaN : Number(row.value);
        const time = new Date(row.logged_at).getTime();
        if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(time) || !factor) invalid.push(row);
        else records.push({ ...row, value: value * factor, time });
    }
    records.sort((a, b) => a.time - b.time || String(a.id).localeCompare(String(b.id)));
    return { records, invalid };
}
export function filterRecords(records, range, now = new Date()) {
    if (range === 'All') return records;
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    if (range === '1W' || range === '30D') start.setDate(start.getDate() - (range === '1W' ? 6 : 29));
    else {
        const day = start.getDate();
        start.setDate(1);
        start.setMonth(start.getMonth() - ({ '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[range] || 1));
        const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        start.setDate(Math.min(day, last));
    }
    return records.filter(row => row.time >= start.getTime() && row.time <= now.getTime());
}
export function metricStats(records) {
    if (!records.length) return null;
    const first = records[0], latest = records.at(-1);
    const change = latest.value - first.value;
    return { first, latest, change, percentage: change / first.value * 100, average: records.reduce((sum, row) => sum + row.value, 0) / records.length, count: records.length };
}
export function resolveMetricOwner(access, selectedId, allowedIds = []) {
    if (!access?.user?.id) throw new Error('Please sign in to view your progress.');
    if (!access.isAdmin) {
        if (selectedId && selectedId !== access.user.id) throw new Error('You can only view your own measurements.');
        return access.user.id;
    }
    if (!selectedId || !allowedIds.includes(selectedId)) throw new Error('Select a client to view their progress.');
    return selectedId;
}
export async function fetchMetricHistory(client, access, config, selectedId, allowedIds) {
    const owner = resolveMetricOwner(access, selectedId, allowedIds);
    const rows = [];
    // Page through every record; Supabase normally caps a response at 1,000 rows.
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from('user_metric_logs')
            .select('id,user_id,value,unit,logged_at').eq('user_id', owner).eq('metric_key', config.key)
            .order('logged_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 1000) break;
    }
    return normalizeRecords(rows, config);
}
