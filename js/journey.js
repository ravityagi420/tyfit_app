(function () {
    "use strict";

    const STAGES = [
        { stage: 1, threshold: 0, name: "Base Camp", title: "Base Camp", subtitle: "You’ve taken the first step.", asset: "assets/gamification/mountain-stage-1.png?v=20260601-sunny" },
        { stage: 2, threshold: 500, name: "Trailblazer", title: "Trailblazer", subtitle: "You’re building momentum.", asset: "assets/gamification/mountain-stage-2.png?v=20260601-sunny" },
        { stage: 3, threshold: 1500, name: "Ascent", title: "Ascent", subtitle: "You’re rising above the rest.", asset: "assets/gamification/mountain-stage-3.png?v=20260601-sunny" },
        { stage: 4, threshold: 3000, name: "Summit Push", title: "Summit Push", subtitle: "You’re almost there.", asset: "assets/gamification/mountain-stage-4.png?v=20260601-sunny" },
        { stage: 5, threshold: 5500, name: "Peak Achiever", title: "Peak Achiever", subtitle: "You’ve reached new heights.", asset: "assets/gamification/mountain-stage-5.png?v=20260601-sunny" },
        { stage: 6, threshold: 9000, name: "Summit Master", title: "Summit Master", subtitle: "You’re an inspiration.", asset: "assets/gamification/mountain-stage-6.png?v=20260601-sunny" }
    ];

    function todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    function addDaysISO(dateISO, days) {
        const date = new Date(`${dateISO}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    }

    function clampScore(score) {
        const numeric = Number(score);
        if (!Number.isFinite(numeric)) return 0;
        return Math.max(0, Math.min(100, numeric));
    }

    function xpForScore(score) {
        const clamped = clampScore(score);
        if (clamped >= 80) return 75;
        if (clamped >= 50) return 60;
        return 55;
    }

    function stageForXp(totalXp) {
        const xp = Math.max(0, Number(totalXp) || 0);
        return STAGES.reduce((current, item) => (xp >= item.threshold ? item : current), STAGES[0]);
    }

    function nextStageForXp(totalXp) {
        const xp = Math.max(0, Number(totalXp) || 0);
        return STAGES.find((item) => item.threshold > xp) || null;
    }

    function progressForXp(totalXp) {
        const xp = Math.max(0, Number(totalXp) || 0);
        const current = stageForXp(xp);
        const next = nextStageForXp(xp);
        if (!next) {
            return {
                current,
                next: null,
                currentXp: xp - current.threshold,
                neededXp: 0,
                percent: 100,
                remainingXp: 0
            };
        }
        const currentXp = xp - current.threshold;
        const neededXp = next.threshold - current.threshold;
        return {
            current,
            next,
            currentXp,
            neededXp,
            percent: Math.max(0, Math.min(100, Math.round((currentXp / neededXp) * 100))),
            remainingXp: Math.max(0, next.threshold - xp)
        };
    }

    function isDuplicateError(error) {
        const code = String(error?.code || "");
        const message = String(error?.message || "").toLowerCase();
        return code === "23505" || message.includes("duplicate") || message.includes("unique");
    }

    async function fetchJourney(userId) {
        if (!userId || !window.supabaseClient) return null;
        const { data, error } = await window.supabaseClient
            .from("user_journeys")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async function createJourney(userId) {
        const { data, error } = await window.supabaseClient
            .from("user_journeys")
            .insert({ user_id: userId, journey_type: "mountain" })
            .select("*")
            .single();
        if (error) {
            if (isDuplicateError(error)) return fetchJourney(userId);
            throw error;
        }
        return data;
    }

    async function getOrCreateJourney(userId) {
        return (await fetchJourney(userId)) || createJourney(userId);
    }

    async function fetchJourneyEvent(userId, checkinDate, eventType = "daily_checkin") {
        const { data, error } = await window.supabaseClient
            .from("journey_events")
            .select("*")
            .eq("user_id", userId)
            .eq("checkin_date", checkinDate)
            .eq("event_type", eventType)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    async function fetchRecentEvents(userId, limit = 14) {
        const { data, error } = await window.supabaseClient
            .from("journey_events")
            .select("*")
            .eq("user_id", userId)
            .eq("event_type", "daily_checkin")
            .order("checkin_date", { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    }

    async function hasCheckedIn(userId, checkinDate = todayISO()) {
        const { data, error } = await window.supabaseClient
            .from("daily_checkins")
            .select("id, overall_score, adherence_percent")
            .eq("user_id", userId)
            .eq("checkin_date", checkinDate)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    }

    function computeNextJourneyState(journey, checkinDate, score) {
        const xpAwarded = xpForScore(score);
        const previousLastDate = journey?.last_checkin_date || null;
        let currentStreak = 1;

        if (previousLastDate === checkinDate) {
            currentStreak = Number(journey?.current_streak) || 1;
        } else if (previousLastDate && previousLastDate === addDaysISO(checkinDate, -1)) {
            currentStreak = (Number(journey?.current_streak) || 0) + 1;
        }

        const totalXp = (Number(journey?.total_xp) || 0) + xpAwarded;
        const progress = progressForXp(totalXp);
        const longestStreak = Math.max(Number(journey?.longest_streak) || 0, currentStreak);

        return {
            xpAwarded,
            totalXp,
            currentXp: progress.currentXp,
            currentStreak,
            longestStreak,
            stage: progress.current.stage,
            title: progress.current.title
        };
    }

    async function awardJourneyProgressIfEligible({ userId, dailyCheckinId, checkinDate, overallScore }) {
        if (!userId || !checkinDate) {
            return { awarded: false, reason: "missing-input" };
        }

        const existingEvent = await fetchJourneyEvent(userId, checkinDate);
        if (existingEvent) {
            return {
                awarded: false,
                reason: "already-counted",
                event: existingEvent,
                journey: await fetchJourney(userId)
            };
        }

        const journey = await getOrCreateJourney(userId);
        const next = computeNextJourneyState(journey, checkinDate, overallScore);
        const eventPayload = {
            user_id: userId,
            daily_checkin_id: dailyCheckinId || null,
            checkin_date: checkinDate,
            event_type: "daily_checkin",
            xp_awarded: next.xpAwarded,
            adherence_score: clampScore(overallScore),
            streak_after: next.currentStreak,
            stage_after: next.stage,
            title_after: next.title
        };

        const eventInsert = await window.supabaseClient
            .from("journey_events")
            .insert(eventPayload)
            .select("*")
            .single();

        if (eventInsert.error) {
            if (isDuplicateError(eventInsert.error)) {
                return {
                    awarded: false,
                    reason: "already-counted",
                    event: await fetchJourneyEvent(userId, checkinDate),
                    journey: await fetchJourney(userId)
                };
            }
            throw eventInsert.error;
        }

        const journeyUpdate = await window.supabaseClient
            .from("user_journeys")
            .update({
                current_xp: next.currentXp,
                total_xp: next.totalXp,
                current_streak: next.currentStreak,
                longest_streak: next.longestStreak,
                current_stage: next.stage,
                current_title: next.title,
                last_checkin_date: checkinDate
            })
            .eq("user_id", userId)
            .select("*")
            .single();

        if (journeyUpdate.error) throw journeyUpdate.error;

        return {
            awarded: true,
            xpAwarded: next.xpAwarded,
            event: eventInsert.data,
            journey: journeyUpdate.data
        };
    }

    window.tyfitJourney = {
        STAGES,
        todayISO,
        addDaysISO,
        xpForScore,
        stageForXp,
        nextStageForXp,
        progressForXp,
        fetchJourney,
        fetchJourneyEvent,
        fetchRecentEvents,
        hasCheckedIn,
        awardJourneyProgressIfEligible
    };
}());
