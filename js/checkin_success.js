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
        const color = clamped < 40 ? "#FF5E7D" : (clamped <= 75 ? "#FFB800" : "#22A861");
        const circumference = 2 * Math.PI * 54; // radius = 54
        const offset = circumference * (1 - (clamped / 100));
        ring.style.strokeDasharray = `${circumference - offset} ${circumference}`;
        ring.style.stroke = color;
    }

    function setTrailProgress(percent) {
        const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
        const fill = el("successJourneyProgress");
        const hiker = el("successTrailHiker");
        if (fill) fill.style.width = `${clamped}%`;
        if (hiker) {
            hiker.style.left = `${clamped}%`;
            hiker.style.setProperty("--trail-progress", `${clamped}%`);
        }
    }

    function setSummary(data) {
        const done = Number(data.done || 0);
        const partial = Number(data.partial || 0);
        const missed = Number(data.missed || 0);
        const total = done + partial + missed;
        const queryScore = Number(data.score);
        const score = Number.isFinite(queryScore) && queryScore > 0
            ? Math.max(0, Math.min(100, Math.round(queryScore)))
            : (total > 0 ? Math.round(((done + partial * 0.5) / total) * 100) : 0);

        const scoreEl = el("successScoreValue");
        if (scoreEl) scoreEl.textContent = `${Math.round(score)}%`;
        setText("successClimbTitle", score >= 80 ? "Great climb today! 🔥" : "Nice climb today!");
        setText("successWorkouts", `${done}/${total || 0}`);
        
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

    function formatDisplayDate(dateISO) {
        const date = dateISO ? new Date(`${dateISO}T00:00:00`) : new Date();
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    function resolveStageView({ totalXp, stage }) {
        const numericTotalXp = Number(totalXp) || 0;
        const progress = window.tyfitJourney?.progressForXp(numericTotalXp);
        const stageIndex = Math.max(0, Math.min(5, (Number(stage) || 1) - 1));
        const stageInfo = progress?.current || window.tyfitJourney?.STAGES?.[stageIndex];
        return { progress, stageInfo };
    }

    function setHeroStageImage(stageInfo) {
        const image = el("successJourneyImage");
        if (!image || !stageInfo?.asset) return;
        image.src = stageInfo.asset;
        image.alt = `${stageInfo.name || "Mountain"} journey stage`;
        image.removeAttribute("aria-hidden");
    }

    function renderUpdatedState({ stageInfo, progress } = {}) {
        setText("successTitle", "Check-in Updated");
        setText("successSubtitle", "Your day has been updated.");
        setText("successJourneyBadge", "Progress counted");
        setText("successXpAward", "No new XP");
        setText("successXpAwardDisplay", "No new XP");
        setText("successStreak", "Today was already counted");
        setText("successJourneyText", "No new streak XP because this check-in date was already counted.");
        setHeroStageImage(stageInfo);
        renderStageProgress(progress);
        const btn = el("viewJourneyBtn");
        if (btn) btn.innerHTML = 'View Progress <i data-lucide="activity"></i>';
    }

    function startConfetti() {
        const canvas = el("tyfitConfettiCanvas");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const colors = ["#6C63FF", "#8B7CFF", "#22C55E", "#F59E0B", "#EF4444", "#60A5FA"];
        const start = performance.now();
        const duration = 2200;
        const particles = Array.from({ length: 104 }, () => ({
            x: Math.random() * window.innerWidth,
            y: -20 - Math.random() * 180,
            size: 4 + Math.random() * 6,
            speed: 1.6 + Math.random() * 2.8,
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

    function renderStageProgress(progress) {
        const current = progress?.current;
        const next = progress?.next;
        const currentXp = Number(progress?.currentXp) || 0;
        const neededXp = Number(progress?.neededXp) || 0;
        const percent = next ? Number(progress?.percent) || 0 : 100;

        setText("successJourneyBadge", current?.name || "Base Camp");
        if (next) {
            setText("successStageXpText", `${Math.max(0, currentXp)} / ${neededXp} XP`);
            setText("successNextXpText", `${neededXp} XP`);
            setText("successJourneyText", `${progress.remainingXp} XP to ${next.name}.`);
        } else {
            setText("successStageXpText", "Summit reached");
            setText("successNextXpText", "9000 XP");
            setText("successJourneyText", "Summit reached. Legendary consistency.");
        }
        setTrailProgress(percent);
        window.requestAnimationFrame(() => setTrailProgress(percent));
    }

    function renderAwardState({ xp, streak, stage, title, totalXp, awarded }) {
        const { progress, stageInfo } = resolveStageView({ totalXp, stage });
        setHeroStageImage(stageInfo);
        setText("successTitle", "Check-in Successful!");
        setText("successSubtitle", "Great job showing up for yourself today. Consistency is your superpower.");
        setText("successJourneyBadge", title || stageInfo?.title || "Journey Progress");
        setText("successXpAward", `+${Number(xp) || 0} XP`);
        setText("successXpAwardDisplay", `+${Number(xp) || 0} XP`);
        setText("successStreak", `${Number(streak) || 1} Day Streak`);
        setText("successHeroStreak", `${Number(streak) || 1} Day Streak`);
        renderStageProgress(progress);
        if (awarded && Number(xp) > 0) startConfetti();
    }

    function formatDayShort(dateISO) {
        const date = new Date(`${dateISO}T00:00:00`);
        return date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
    }

    function formatDayNumber(dateISO) {
        const date = new Date(`${dateISO}T00:00:00`);
        return date.toLocaleDateString("en-US", { day: "numeric" });
    }

    function renderWeekRow(events, today) {
        const row = el("successWeekRow");
        if (!row || !window.tyfitJourney) return;
        const eventMap = new Map((events || []).map((event) => [String(event.checkin_date), event]));
        const days = [];
        for (let i = 6; i >= 0; i -= 1) {
            const date = window.tyfitJourney.addDaysISO(today, -i);
            const event = eventMap.get(date);
            const score = Number(event?.adherence_score ?? 0);
            const isToday = date === today;
            const state = event ? (score >= 50 ? "done" : "partial") : "missed";
            const icon = state === "done" ? "check" : (state === "partial" ? "zap" : "mountain");
            days.push(
                `<span class="success-week-day is-${state}${isToday ? " is-today" : ""}">
                    <em>${isToday ? "TODAY" : formatDayShort(date)}</em>
                    <strong>${formatDayNumber(date)}</strong>
                    <i><svg data-lucide="${icon}"></svg></i>
                </span>`
            );
        }
        row.innerHTML = days.join("");
    }

    async function hydrateJourneyState(params) {
        const isUpdated = params.get("state") === "updated";
        const wasAwarded = params.get("journey_awarded") === "1" || params.get("firstCheckinAwarded") === "true";
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
                let events = [];
                [journey, event, events] = await Promise.all([
                    window.tyfitJourney.fetchJourney(userId),
                    date ? window.tyfitJourney.fetchJourneyEvent(userId, date) : Promise.resolve(null),
                    window.tyfitJourney.fetchRecentEvents(userId, 7)
                ]);
                renderWeekRow(events, date || window.tyfitJourney.todayISO());
            }
        } catch (error) {
            console.warn("journey success hydrate warning:", error?.message || error);
        }

        if (!el("successWeekRow")?.children.length && window.tyfitJourney) {
            const fallbackDate = params.get("date") || window.tyfitJourney.todayISO();
            const fallbackScore = Number(params.get("score") || params.get("adherence") || 0);
            const fallbackEvents = isUpdated ? [] : [{ checkin_date: fallbackDate, adherence_score: fallbackScore || 100 }];
            renderWeekRow(fallbackEvents, fallbackDate);
        }

        const currentStreak = Number(queryStreak || event?.streak_after || journey?.current_streak || 0);
        const longestStreak = Number(journey?.longest_streak || currentStreak || 0);
        setText("successStreakNumber", String(currentStreak || 1));
        setText("successHeroStreak", `${currentStreak || 1} Day Streak`);
        setText("successStreakDays", `${currentStreak || 1} days`);
        const best = el("successBestStreak");
        if (best) best.innerHTML = `Best Streak: <strong>${longestStreak || currentStreak || 1} days</strong>`;

        if (isUpdated) {
            const { progress, stageInfo } = resolveStageView({
                totalXp: queryTotalXp || journey?.total_xp || 0,
                stage: queryStage || journey?.current_stage || event?.stage_after || 1
            });
            renderUpdatedState({ stageInfo, progress });
            return;
        }

        renderAwardState({
            xp: queryXp || event?.xp_awarded || 0,
            streak: queryStreak || journey?.current_streak || event?.streak_after || 1,
            stage: queryStage || journey?.current_stage || event?.stage_after || 1,
            title: queryTitle || journey?.current_title || event?.title_after || "",
            totalXp: queryTotalXp || journey?.total_xp || 0,
            awarded: wasAwarded
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
        setText("successDateText", formatDisplayDate(params.get("date")));
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
