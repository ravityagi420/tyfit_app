(function () {
    const STATE = {
        access: null,
        targetUserId: "",
        selectedDate: "",
        users: [],
        checkins: [],
        goalsById: {},
        activeCheckin: null
    };

    function el(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") {
            window.tyfitRefreshIcons();
            return;
        }
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    function showToast(message) {
        const toast = el("appToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("is-show");
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove("is-show"), 2200);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function buildUserLabel(profile) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.full_name || "";
        return fullName || profile.email || "User";
    }

    function formatISODate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    async function loadUsersForAdmin() {
        const toolbar = el("summaryUserToolbar");
        const select = el("summaryUserSelect");
        if (!toolbar || !select || !STATE.access?.isAdmin) return;

        const { data, error } = await window.supabaseClient
            .from("profiles")
            .select("id, first_name, last_name, full_name, email, role, is_admin")
            .order("full_name", { ascending: true });

        if (error) {
            console.warn("summary user list warning:", error.message || error);
            return;
        }

        STATE.users = (data || []).filter((item) => item?.id).filter((item) => {
            if (item.id === STATE.access.user.id) return true;
            if (item.is_admin === true) return false;
            const role = String(item.role || "").toLowerCase();
            return role !== "admin";
        });

        select.innerHTML = STATE.users.map((user) => `<option value="${user.id}">${escapeHtml(buildUserLabel(user))}</option>`).join("");
        STATE.targetUserId = select.value || STATE.access.user.id;
        toolbar.classList.remove("checkin-hidden");
    }

    async function loadGoalsMap() {
        const { data, error } = await window.supabaseClient
            .from("checkin_goals")
            .select("id, goal_name")
            .eq("user_id", STATE.targetUserId);

        if (error) {
            console.warn("load goals map warning:", error.message || error);
            STATE.goalsById = {};
            return;
        }

        const map = {};
        (data || []).forEach((goal) => {
            map[String(goal.id)] = goal.goal_name || "Goal";
        });
        STATE.goalsById = map;
    }

    async function loadCheckins() {
        const { data, error } = await window.supabaseClient
            .from("daily_checkins")
            .select("*")
            .eq("user_id", STATE.targetUserId)
            .order("checkin_date", { ascending: true });

        if (error) {
            showToast("Could not load check-in history.");
            console.error("load checkins error:", error);
            return;
        }

        STATE.checkins = data || [];
    }

    function renderCalendar() {
        const calendar = el("summaryCalendar");
        if (!calendar) return;

        if (!STATE.checkins.length) {
            calendar.innerHTML = '<p style="margin:0;color:#6f6a95;">No check-ins yet.</p>';
            return;
        }

        const firstDate = new Date(STATE.checkins[0].checkin_date);
        const today = new Date();
        const buttons = [];
        const checkinMap = new Map(STATE.checkins.map((row) => [row.checkin_date, row]));

        const cursor = new Date(firstDate);
        while (cursor <= today) {
            const iso = formatISODate(cursor);
            const checkin = checkinMap.get(iso);
            const active = iso === STATE.selectedDate ? "is-active" : "";
            const label = cursor.toLocaleDateString(undefined, { weekday: "short" });
            const day = String(cursor.getDate()).padStart(2, "0");
            buttons.push(`<button type="button" class="checkin-summary-day ${active}" data-summary-date="${iso}" title="${checkin ? `Adherence ${checkin.adherence_percent || 0}%` : "No check-in"}">${label}<br>${day}</button>`);
            cursor.setDate(cursor.getDate() + 1);
        }

        calendar.innerHTML = buttons.join("");
    }

    function renderWeekStrip() {
        const strip = el("summaryWeekStrip");
        if (!strip) return;

        const recent = [...STATE.checkins].slice(-7).reverse();
        strip.innerHTML = recent.map((row) => {
            const label = new Date(row.checkin_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
            return `<article class="checkin-week-item"><strong>${Math.round(row.adherence_percent || 0)}%</strong><span>${escapeHtml(label)}</span></article>`;
        }).join("");
    }

    async function loadEntriesForCheckin(checkinId) {
        let result = await window.supabaseClient
            .from("daily_checkin_entries")
            .select("*")
            .eq("checkin_id", checkinId);

        if (result.error) {
            result = await window.supabaseClient
                .from("daily_checkin_entries")
                .select("*")
                .eq("daily_checkin_id", checkinId);
        }

        if (result.error) {
            console.error("load summary entries error:", result.error);
            return [];
        }

        return result.data || [];
    }

    function renderEntries(entries) {
        const list = el("summaryList");
        if (!list) return;

        if (!entries.length) {
            list.innerHTML = '<article class="checkin-empty-card"><h3 style="font-size:22px;">No check-in on this day</h3><p>Pick another date or log a check-in for this day.</p></article>';
            return;
        }

        list.innerHTML = entries.map((entry) => {
            const goalName = STATE.goalsById[String(entry.goal_id)] || "Goal";
            const status = String(entry.status || "missed").toLowerCase();
            const titleStatus = status === "done" ? "Done" : status === "partial" ? "Partial" : "Missed";
            const noteParts = [];
            if (entry.actual_value !== null && entry.actual_value !== undefined && String(entry.actual_value).trim() !== "") {
                noteParts.push(`Actual: ${entry.actual_value}`);
            }
            if (entry.comment) {
                noteParts.push(entry.comment);
            }

            return `<article class="checkin-summary-item">
                <span class="checkin-goal-icon"><i data-lucide="target"></i></span>
                <div>
                    <h4 style="margin:0;color:#281f53;font-size:15px;">${escapeHtml(goalName)}</h4>
                    <p style="margin:2px 0 0;color:#6d6894;font-size:12px;">${escapeHtml(noteParts.join(" • ") || "No additional note")}</p>
                </div>
                <span class="checkin-status-badge ${status}">${escapeHtml(titleStatus)}</span>
            </article>`;
        }).join("");

        refreshIcons();
    }

    async function renderSelectedDay() {
        const selected = STATE.checkins.find((row) => row.checkin_date === STATE.selectedDate) || null;
        STATE.activeCheckin = selected;

        const coachCard = el("coachNoteCard");
        const coachInput = el("coachNoteInput");

        if (STATE.access?.isAdmin) {
            coachCard.classList.remove("checkin-hidden");
            coachInput.value = selected?.coach_note || "";
        } else {
            coachCard.classList.add("checkin-hidden");
        }

        if (!selected?.id) {
            renderEntries([]);
            return;
        }

        const entries = await loadEntriesForCheckin(selected.id);
        renderEntries(entries);
    }

    async function reloadSummary() {
        await loadGoalsMap();
        await loadCheckins();

        if (!STATE.checkins.length) {
            STATE.selectedDate = "";
            renderCalendar();
            renderWeekStrip();
            renderEntries([]);
            return;
        }

        if (!STATE.selectedDate || !STATE.checkins.some((item) => item.checkin_date === STATE.selectedDate)) {
            STATE.selectedDate = STATE.checkins[STATE.checkins.length - 1].checkin_date;
        }

        renderCalendar();
        renderWeekStrip();
        await renderSelectedDay();
    }

    async function saveCoachNote() {
        if (!STATE.access?.isAdmin) return;
        if (!STATE.activeCheckin?.id) {
            showToast("Pick a date with a check-in first.");
            return;
        }

        const note = String(el("coachNoteInput")?.value || "").trim();
        const { error } = await window.supabaseClient
            .from("daily_checkins")
            .update({
                coach_note: note || null,
                updated_at: new Date().toISOString()
            })
            .eq("id", STATE.activeCheckin.id);

        if (error) {
            showToast("Could not save coach note.");
            console.error("save coach note error:", error);
            return;
        }

        showToast("Coach note saved.");
        await reloadSummary();
    }

    function bindEvents() {
        const calendar = el("summaryCalendar");
        if (calendar) {
            calendar.addEventListener("click", async (event) => {
                const btn = event.target.closest("[data-summary-date]");
                if (!btn) return;
                STATE.selectedDate = btn.getAttribute("data-summary-date") || "";
                renderCalendar();
                await renderSelectedDay();
            });
        }

        const editBtn = el("summaryEditDayBtn");
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                if (!STATE.selectedDate) return;
                const query = new URLSearchParams();
                query.set("date", STATE.selectedDate);
                if (STATE.access?.isAdmin && STATE.targetUserId && STATE.targetUserId !== STATE.access.user.id) {
                    query.set("user", STATE.targetUserId);
                }
                window.location.href = `daily_checkin.html?${query.toString()}`;
            });
        }

        const userSelect = el("summaryUserSelect");
        if (userSelect) {
            userSelect.addEventListener("change", async () => {
                STATE.targetUserId = userSelect.value;
                STATE.selectedDate = "";
                await reloadSummary();
            });
        }

        const saveCoach = el("saveCoachNoteBtn");
        if (saveCoach) {
            saveCoach.addEventListener("click", async () => {
                await saveCoachNote();
            });
        }
    }

    async function init() {
        bindEvents();

        if (typeof window.getAccessState !== "function") {
            showToast("Auth state is not ready yet.");
            return;
        }

        STATE.access = await window.getAccessState();
        if (!STATE.access?.isLoggedIn || !STATE.access?.user?.id) {
            showToast("Please log in first.");
            return;
        }

        const params = new URLSearchParams(window.location.search);
        STATE.targetUserId = STATE.access.user.id;

        if (STATE.access.isAdmin) {
            await loadUsersForAdmin();
            const userFromQuery = params.get("user");
            if (userFromQuery) {
                const select = el("summaryUserSelect");
                if (select && Array.from(select.options).some((item) => item.value === userFromQuery)) {
                    select.value = userFromQuery;
                    STATE.targetUserId = userFromQuery;
                }
            }
        }

        STATE.selectedDate = params.get("date") || "";

        await reloadSummary();
        refreshIcons();
    }

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error("checkin_summary init error:", error);
            showToast("Could not load check-in summary.");
        });
    });
}());
