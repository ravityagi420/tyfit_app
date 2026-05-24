(function () {
    function el(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    function setSummary(data) {
        const adherence = Math.max(0, Math.min(100, Number(data.adherence || 0)));
        const done = Number(data.done || 0);
        const partial = Number(data.partial || 0);
        const missed = Number(data.missed || 0);

        if (el("successPercent")) el("successPercent").textContent = `${Math.round(adherence)}%`;
        if (el("successDone")) el("successDone").textContent = String(done);
        if (el("successPartial")) el("successPartial").textContent = String(partial);
        if (el("successMissed")) el("successMissed").textContent = String(missed);
    }

    async function hydrateFromLatestCheckin() {
        if (!window.supabaseClient?.auth) return;

        const sessionResult = await window.supabaseClient.auth.getSession();
        const userId = sessionResult?.data?.session?.user?.id;
        if (!userId) return;

        const { data, error } = await window.supabaseClient
            .from("daily_checkins")
            .select("adherence_percent, done_count, partial_count, missed_count, checkin_date")
            .eq("user_id", userId)
            .order("checkin_date", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) return;

        setSummary({
            adherence: data.adherence_percent,
            done: data.done_count,
            partial: data.partial_count,
            missed: data.missed_count
        });
    }

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = {
            adherence: params.get("adherence"),
            done: params.get("done"),
            partial: params.get("partial"),
            missed: params.get("missed")
        };

        if (fromQuery.adherence !== null) {
            setSummary(fromQuery);
        } else {
            await hydrateFromLatestCheckin();
        }

        const date = params.get("date");
        if (date) {
            const historyBtn = el("viewHistoryBtn");
            if (historyBtn) {
                historyBtn.href = `checkin_summary.html?date=${encodeURIComponent(date)}`;
            }
        }

        refreshIcons();
    }

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error("checkin_success init error:", error);
        });
    });
}());
