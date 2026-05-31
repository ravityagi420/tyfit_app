(function () {
    function el(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    function updateProgressRing(score) {
        const ring = document.querySelector(".summary-ring-progress");
        if (!ring) return;

        const clamped = Math.max(0, Math.min(100, Number(score) || 0));
        const circumference = 2 * Math.PI * 54; // radius = 54
        const offset = circumference * (1 - (clamped / 100));
        ring.style.strokeDasharray = `${circumference - offset} ${circumference}`;
    }

    function setSummary(data) {
        const done = Number(data.done || 0);
        const partial = Number(data.partial || 0);
        const missed = Number(data.missed || 0);
        const total = done + partial + missed;
        const score = total > 0 ? Math.round(((done + partial * 0.5) / total) * 100) : 0;

        const scoreEl = el("successScoreValue");
        if (scoreEl) scoreEl.textContent = `${Math.round(score)}%`;
        
        if (el("successDone")) el("successDone").textContent = String(done);
        if (el("successPartial")) el("successPartial").textContent = String(partial);
        if (el("successMissed")) el("successMissed").textContent = String(missed);
        setText("successInsightPill", `${done + partial} of ${total} tasks completed`);
        setText("successInsightText", score >= 80 ? "Strong finish. Your routine is stacking up." : "Keep going! You’re almost there.");

        updateProgressRing(score);
    }

    function setText(id, value) {
        const node = el(id);
        if (node) node.textContent = value;
    }

    function renderUpdatedState() {
        setText("successTitle", "Check-in Updated");
        setText("successSubtitle", "Your day has been updated.");
        setText("successJourneyBadge", "Progress counted");
        setText("successXpAward", "No new XP");
        setText("successStreak", "Today was already counted");
        setText("successJourneyText", "No new streak XP because this check-in date was already counted.");
        const progress = el("successJourneyProgress");
        if (progress) progress.style.width = "100%";
        const btn = el("viewJourneyBtn");
        if (btn) btn.innerHTML = '<i data-lucide="activity"></i> View Progress';
    }

    function startConfetti() {
        const canvas = el("tyfitConfettiCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const colors = ["#6C63FF", "#8B7CFF", "#22C55E", "#F59E0B", "#EF4444", "#60A5FA"];
        const start = performance.now();
        const duration = 2200;
        const particles = Array.from({ length: 110 }, () => ({
            x: Math.random() * window.innerWidth,
            y: -20 - Math.random() * 180,
            size: 5 + Math.random() * 8,
            speed: 2 + Math.random() * 3.5,
            drift: -1 + Math.random() * 2,
            rotation: Math.random() * Math.PI,
            spin: -0.12 + Math.random() * 0.24,
            color: colors[Math.floor(Math.random() * colors.length)],
            circle: Math.random() > 0.72
        }));
        const ratio = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * ratio;
        canvas.height = window.innerHeight * ratio;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        canvas.hidden = false;
        function frame(now) {
            const alpha = Math.max(0, 1 - ((now - start) / duration));
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            particles.forEach((p) => {
                p.x += p.drift;
                p.y += p.speed;
                p.rotation += p.spin;
                ctx.save();
                ctx.globalAlpha = Math.min(1, alpha + 0.15);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                if (p.circle) {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                }
                ctx.restore();
            });
            if (now - start < duration) {
                requestAnimationFrame(frame);
            } else {
                ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
                canvas.hidden = true;
            }
        }
        requestAnimationFrame(frame);
    }

    function renderAwardState({ xp, streak, stage, title, totalXp }) {
        const progress = window.tyfitJourney?.progressForXp(totalXp || 0);
        const stageInfo = progress?.current || window.tyfitJourney?.STAGES?.[(Number(stage) || 1) - 1];
        setText("successTitle", "Check-in Successful!");
        setText("successSubtitle", "Great job! Consistency is your superpower.");
        setText("successJourneyBadge", title || stageInfo?.title || "Journey Progress");
        setText("successXpAward", `+${Number(xp) || 0} XP`);
        setText("successStreak", `${Number(streak) || 1} Day Streak`);
        setText("successJourneyText", progress?.next ? `${progress.remainingXp} XP to ${progress.next.name}.` : "Summit reached. Legendary consistency.");
        const progressNode = el("successJourneyProgress");
        if (progressNode) progressNode.style.width = `${progress?.percent ?? 0}%`;
        const img = el("successJourneyImage");
        if (img && stageInfo?.asset) img.src = stageInfo.asset;
        if (Number(xp) > 0) startConfetti();
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
