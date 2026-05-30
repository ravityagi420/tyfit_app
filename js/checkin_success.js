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

    function setText(id, value) {
        const node = el(id);
        if (node) node.textContent = value;
    }

    function renderUpdatedState() {
        setText("successTitle", "Check-in Updated");
        setText("successSubtitle", "Your day has been updated");
        setText("successJourneyBadge", "Progress counted");
        setText("successXpAward", "No new XP");
        setText("successStreak", "Today was already counted");
        setText("successJourneyText", "No new streak XP because this check-in date was already counted.");
        const progress = el("successJourneyProgress");
        if (progress) progress.style.width = "100%";
        const confetti = el("successConfetti");
        if (confetti) confetti.hidden = true;
        const btn = el("viewJourneyBtn");
        if (btn) btn.innerHTML = '<i data-lucide="activity"></i> View Progress';
    }

    function renderAwardState({ xp, streak, stage, title, totalXp }) {
        const progress = window.tyfitJourney?.progressForXp(totalXp || 0);
        const stageInfo = progress?.current || window.tyfitJourney?.STAGES?.[(Number(stage) || 1) - 1];
        setText("successTitle", "Amazing!");
        setText("successSubtitle", "You completed your check-in");
        setText("successJourneyBadge", title || stageInfo?.title || "Journey Progress");
        setText("successXpAward", `+${Number(xp) || 0} XP`);
        setText("successStreak", `${Number(streak) || 1} Day Streak`);
        setText("successJourneyText", progress?.next ? `${progress.remainingXp} XP to ${progress.next.name}.` : "Summit reached. Legendary consistency.");
        const progressNode = el("successJourneyProgress");
        if (progressNode) progressNode.style.width = `${progress?.percent ?? 0}%`;
        const confetti = el("successConfetti");
        if (confetti) confetti.hidden = false;
        const img = el("successJourneyImage");
        if (img && stageInfo?.asset) img.src = stageInfo.asset;
    }

    async function hydrateJourneyState(params) {
        const isUpdated = params.get("state") === "updated";
        if (isUpdated) {
            renderUpdatedState();
            return;
        }

        const queryXp = params.get("xp");
        const queryStreak = params.get("streak");
        const queryStage = params.get("stage");
        const queryTitle = params.get("title");
        const queryTotalXp = params.get("total_xp");

        let userId = "";
        let journey = null;
        let event = null;
        try {
            const sessionResult = await window.supabaseClient?.auth?.getSession();
            userId = sessionResult?.data?.session?.user?.id || "";
            const date = params.get("date");
            if (userId && window.tyfitJourney) {
                [journey, event] = await Promise.all([
                    window.tyfitJourney.fetchJourney(userId),
                    date ? window.tyfitJourney.fetchJourneyEvent(userId, date) : Promise.resolve(null)
                ]);
            }
        } catch (error) {
            console.warn("journey success hydrate warning:", error?.message || error);
        }

        renderAwardState({
            xp: queryXp || event?.xp_awarded || 0,
            streak: queryStreak || journey?.current_streak || event?.streak_after || 1,
            stage: queryStage || journey?.current_stage || event?.stage_after || 1,
            title: queryTitle || journey?.current_title || event?.title_after || "",
            totalXp: queryTotalXp || journey?.total_xp || 0
        });
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

        await hydrateJourneyState(params);

        refreshIcons();
    }

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error("checkin_success init error:", error);
        });
    });
}());
