(function () {
    "use strict";

    function el(id) {
        return document.getElementById(id);
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") window.tyfitRefreshIcons();
        else if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    async function getCurrentUser() {
        if (window.tyfitProfile?.getCurrentUser) return window.tyfitProfile.getCurrentUser();
        const { data } = await window.supabaseClient.auth.getUser();
        return data?.user || null;
    }

    function emptyJourney() {
        return {
            total_xp: 0,
            current_xp: 0,
            current_streak: 0,
            longest_streak: 0,
            current_stage: 1,
            current_title: "Starter"
        };
    }

    function renderHero(journey) {
        const hero = el("journeyHeroPanel");
        const progress = window.tyfitJourney.progressForXp(journey.total_xp || 0);
        hero.innerHTML = `
            <div class="journey-hero-copy">
                <span class="tyfit-hero-badge"><i data-lucide="mountain"></i>Conquer Everest</span>
                <h2>${escapeHtml(journey.current_title || progress.current.title)}</h2>
                <p>${escapeHtml(progress.current.name)}</p>
                <div class="tyfit-journey-progress-track"><span style="width:${progress.percent}%"></span></div>
                <div class="journey-hero-progress-row">
                    <span>${progress.next ? `${progress.remainingXp} XP to ${escapeHtml(progress.next.name)}` : "Summit reached"}</span>
                    <strong>${Number(journey.total_xp) || 0} XP</strong>
                </div>
            </div>
            <img src="${escapeHtml(progress.current.asset)}" alt="" class="journey-hero-art" aria-hidden="true">
        `;
    }

    function renderStats(journey) {
        el("journeyStatsGrid").innerHTML = [
            ["Current Streak", Number(journey.current_streak) || 0, "flame"],
            ["Longest Streak", Number(journey.longest_streak) || 0, "trophy"],
            ["Total XP", Number(journey.total_xp) || 0, "sparkles"]
        ].map(([label, value, icon]) => `
            <article class="journey-stat-card">
                <i data-lucide="${icon}"></i>
                <strong>${value}</strong>
                <span>${label}</span>
            </article>
        `).join("");
    }

    function renderMilestones(journey) {
        const stage = Number(journey.current_stage) || 1;
        el("journeyMilestones").innerHTML = window.tyfitJourney.STAGES.map((item) => {
            const state = item.stage < stage ? "is-complete" : item.stage === stage ? "is-current" : "is-locked";
            return `
                <article class="journey-milestone ${state}">
                    <span class="journey-milestone-dot"><i data-lucide="${item.stage <= stage ? "check" : "lock"}"></i></span>
                    <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <p>${item.threshold} XP</p>
                    </div>
                    <em>${escapeHtml(item.title)}</em>
                </article>
            `;
        }).join("");
    }

    function renderCalendar(events) {
        const checked = new Set((events || []).map((event) => String(event.checkin_date)));
        const today = window.tyfitJourney.todayISO();
        const days = [];
        for (let i = 13; i >= 0; i -= 1) {
            const date = window.tyfitJourney.addDaysISO(today, -i);
            const label = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
            days.push(`
                <article class="journey-day ${checked.has(date) ? "is-done" : ""}">
                    <span></span>
                    <strong>${escapeHtml(label)}</strong>
                </article>
            `);
        }
        el("journeyCalendar").innerHTML = days.join("");
    }

    async function init() {
        try {
            const user = await getCurrentUser();
            if (!user?.id) {
                window.location.href = "login.html";
                return;
            }

            const [journey, events] = await Promise.all([
                window.tyfitJourney.fetchJourney(user.id),
                window.tyfitJourney.fetchRecentEvents(user.id, 14)
            ]);
            const state = journey || emptyJourney();
            renderHero(state);
            renderStats(state);
            renderMilestones(state);
            renderCalendar(events);
            refreshIcons();
        } catch (error) {
            console.error("journey page init error:", error);
            const hero = el("journeyHeroPanel");
            if (hero) {
                hero.innerHTML = '<div class="journey-empty"><h2>Journey unavailable</h2><p>Please refresh or try again later.</p></div>';
            }
        }
    }

    document.addEventListener("DOMContentLoaded", init);
}());
