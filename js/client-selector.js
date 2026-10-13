export async function fetchSelectableClients(client) {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await client.from('profiles').select('id,email,full_name,role')
            .order('email', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 999);
        if (error) throw error;
        rows.push(...(data || []));
        if ((data || []).length < 1000) return rows;
    }
}

export function populateClientSelector(select, clients) {
    select.replaceChildren(new Option('Select', ''));
    clients.forEach(client => {
        const role = String(client.role || 'user').replace(/[_-]/g, ' ');
        const label = `${(client.full_name || 'Unnamed User').trim()} - ${role.charAt(0).toUpperCase() + role.slice(1)}`;
        select.appendChild(new Option(label, client.id));
    });
}
