(function () {
    function el(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    function ringColorForScore(score) {
        if (score < 40) return "#FF5E7D";
        if (score <= 75) return "#FFB800";
        return "#22A861";
    }

    function updateProgressRing(score) {
        const ring = document.querySelector(".summary-ring-progress");
        if (!ring) return;

        const clamped = Math.max(0, Math.min(100, Number(score) || 0));
        const circumference = 2 * Math.PI * 54; // radius = 54
        const offset = circumference * (1 - (clamped / 100));
        ring.style.strokeDasharray = `${circumference - offset} ${circumference}`;
        ring.style.stroke = ringColorForScore(clamped);
    }

    function setSummary(data) {
        const score = Math.max(0, Math.min(100, Number(data.score || 0)));
        const done = Number(data.done || 0);
        const partial = Number(data.partial || 0);
        const missed = Number(data.missed || 0);

        // Update visible elements
        const scoreEl = el("successScoreValue");
        if (scoreEl) scoreEl.textContent = `${Math.round(score)}%`;
        
        if (el("successDone")) el("successDone").textContent = String(done);
        if (el("successPartial")) el("successPartial").textContent = String(partial);
        if (el("successMissed")) el("successMissed").textContent = String(missed);

        // Update progress ring
        updateProgressRing(score);
    }

    async function hydrateFromLatestCheckin() {
        if (!window.supabaseClient?.auth) return;

        const sessionResult = await window.supabaseClient.auth.getSession();
        const userId = sessionResult?.data?.session?.user?.id;
        if (!userId) return;

        try {
            // Fetch latest check-in
            const { data: checkinData, error: checkinError } = await window.supabaseClient
                .from("daily_checkins")
                .select("*")
                .eq("user_id", userId)
                .order("checkin_date", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (checkinError || !checkinData) return;

            // Update summary
            setSummary({
                score: checkinData.overall_score ?? checkinData.adherence_percent ?? 0,
                done: checkinData.done_count || 0,
                partial: checkinData.partial_count || 0,
                missed: checkinData.missed_count || 0
            });
        } catch (error) {
            console.error("Error fetching checkin data:", error);
        }
    }

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = {
            score: params.get("score") || params.get("adherence"),
            done: params.get("done"),
            partial: params.get("partial"),
            missed: params.get("missed")
        };

        if (fromQuery.score !== null) {
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
