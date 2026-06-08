(function () {
    const STATUS_VALUES = ["done", "partial", "missed"];

    const STATE = {
        access: null,
        targetUserId: "",
        selectedDate: "",
        weekCalendarMonth: null,
        goals: [],
        goalInputs: {},
        checkinId: "",
        users: [],
        actionGoalId: "",
        noteModalGoalId: "",
        checkinsByDate: new Map(),
        autosaveTimer: null,
        hasPendingChanges: false,
        isSaving: false,
        lastSavedAt: 0
    };

    const AUTOSAVE_DELAY_MS = 7000;
    const DRAFT_PREFIX = "tyfit:daily-checkin-draft:";

    function el(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") {
            window.tyfitRefreshIcons();
            return;
        }
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function syncTopbarSaveButton() {
        const button = el("checkinTopbarSaveBtn");
        if (!button) return;
        const isActive = Boolean(STATE.hasPendingChanges && !STATE.isSaving);
        button.disabled = !isActive;
        button.classList.toggle("is-active", isActive);
        button.textContent = STATE.isSaving ? "Saving" : "Save";
    }

    function showToast(message) {
        const toast = el("appToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("is-show");
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove("is-show"), 2200);
    }

    function formatISODate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function parseDate(iso) {
        const [year, month, day] = String(iso || "").split("-").map((item) => Number(item));
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function goalTargetText(goal) {
        if (goal.target_value !== null && goal.target_value !== undefined && String(goal.target_value).trim() !== "") {
            const num = Number(goal.target_value);
            const value = Number.isFinite(num) ? (Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.00$/, "")) : String(goal.target_value);
            return `Target: ${value}${goal.target_unit ? ` ${goal.target_unit}` : ""}`;
        }
        if (String(goal.goal_category || "").toLowerCase().includes("diet")) {
            return "Target: Diet plan";
        }
        if (String(goal.goal_type || "").toLowerCase() === "binary") {
            return "Yes/No";
        }
        return "Yes/No";
    }

    function goalIcon(goal) {
        const key = `${goal.goal_name || ""} ${goal.goal_category || ""}`.toLowerCase();
        if (key.includes("water")) return "droplets";
        if (key.includes("step")) return "footprints";
        if (key.includes("sleep")) return "moon";
        if (key.includes("workout") || key.includes("training")) return "dumbbell";
        if (key.includes("vitamin") || key.includes("supplement")) return "pill";
        if (key.includes("breakfast") || key.includes("lunch") || key.includes("dinner")) return "utensils-crossed";
        if (key.includes("protein")) return "beef";
        return "target";
    }

    function buildUserLabel(profile) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.full_name || "";
        return fullName || profile.email || "User";
    }

    function normalizeGoal(row) {
        return {
            id: row.id,
            goal_name: row.goal_name || row.name || "Untitled Goal",
            goal_category: row.goal_category || row.category || "Lifestyle",
            goal_type: row.goal_type || row.type || "",
            target_value: row.target_value ?? null,
            target_unit: row.target_unit || ""
        };
    }

    function isNumericGoal(goal) {
        const type = String(goal.goal_type || "").toLowerCase();
        if (type.includes("number") || type.includes("numeric") || type.includes("quantitative")) return true;
        if (goal.target_value === null || goal.target_value === undefined || String(goal.target_value).trim() === "") return false;
        return Number.isFinite(Number(goal.target_value));
    }

    function groupName(goal) {
        const category = String(goal.goal_category || "").toLowerCase();
        if (category.includes("diet")) return "Diet";
        if (category.includes("supplement")) return "Supplements";
        if (category.includes("activity") || category.includes("workout")) return "Activity";
        if (category.includes("lifestyle")) return "Lifestyle Goals";
        return "Lifestyle Goals";
    }

    function groupIcon(title) {
        const key = String(title || "").toLowerCase();
        if (key.includes("diet")) return "utensils-crossed";
        if (key.includes("supplement")) return "pill";
        if (key.includes("activity")) return "dumbbell";
        if (key.includes("lifestyle")) return "heart-plus";
        return "target";
    }

    function getManageGoalsHref() {
        if (STATE.access?.isAdmin && STATE.targetUserId && STATE.targetUserId !== STATE.access.user.id) {
            return `checkin_goals.html?user=${encodeURIComponent(STATE.targetUserId)}`;
        }
        return "checkin_goals.html";
    }

    function openGoalActionSheet(goalId) {
        STATE.actionGoalId = String(goalId || "");
        const goal = STATE.goals.find((item) => String(item.id) === STATE.actionGoalId);
        const sheet = el("goalActionSheet");
        const backdrop = el("goalActionBackdrop");
        const title = el("goalActionTitle");
        if (!sheet || !backdrop || !goal) return;

        if (!goal || !backdrop || !modal || !title || !noteInput) return;
        document.body.style.overflow = "hidden";
    }

    function closeGoalActionSheet() {
        const sheet = el("goalActionSheet");
            // actualWrap.classList.remove("checkin-hidden");
            // actualInput.value = input.actual_value || "";
            // unit.textContent = goal.target_unit || "";
        backdrop.classList.add("checkin-hidden");
            // actualWrap.classList.add("checkin-hidden");
            // actualInput.value = "";
            // unit.textContent = "";
    }

    function getInput(goalId) {
        const key = String(goalId);
        if (!STATE.goalInputs[key]) {
            STATE.goalInputs[key] = {
                status: "",
                comment: "",
                actual_value: "",
                commentOpen: false,
                actualOpen: false
            };
        }
        return STATE.goalInputs[key];
    }

    function ringColorForScore(score) {
        if (score < 40) return "#FF5E7D";
        if (score <= 75) return "#FFB800";
        return "#22A861";
    }

    function clearAutosaveTimer() {
        if (STATE.autosaveTimer) {
            clearTimeout(STATE.autosaveTimer);
            STATE.autosaveTimer = null;
        }
    }

    function draftKey() {
        if (!STATE.targetUserId || !STATE.selectedDate) return "";
        return `${DRAFT_PREFIX}${STATE.targetUserId}:${STATE.selectedDate}`;
    }

    function persistDraft() {
        const key = draftKey();
        if (!key) return;
        try {
            window.localStorage.setItem(key, JSON.stringify({
                savedAt: Date.now(),
                selectedDate: STATE.selectedDate,
                targetUserId: STATE.targetUserId,
                goalInputs: STATE.goalInputs
            }));
        } catch (error) {
            console.warn("checkin draft warning:", error?.message || error);
        }
    }

    function clearDraft() {
        const key = draftKey();
        if (!key) return;
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn("clear checkin draft warning:", error?.message || error);
        }
    }

    function restoreDraftIfPresent() {
        const key = draftKey();
        if (!key) return false;
        try {
            const draft = JSON.parse(window.localStorage.getItem(key) || "null");
            if (!draft?.goalInputs || draft.targetUserId !== STATE.targetUserId || draft.selectedDate !== STATE.selectedDate) {
                return false;
            }
            STATE.goalInputs = { ...STATE.goalInputs, ...draft.goalInputs };
            STATE.hasPendingChanges = true;
            syncTopbarSaveButton();
            return true;
        } catch (error) {
            console.warn("restore checkin draft warning:", error?.message || error);
            return false;
        }
    }

    function flushPendingChanges() {
        if (!STATE.hasPendingChanges || STATE.isSaving) return;
        return saveCheckin({
            redirectOnSuccess: false,
            showSuccessToast: false,
            isAutosave: true
        });
    }

    async function runAutosaveIfNeeded() {
        STATE.autosaveTimer = null;
        if (!STATE.hasPendingChanges || STATE.isSaving) return;
        await saveCheckin({
            redirectOnSuccess: false,
            showSuccessToast: false,
            isAutosave: true
        });
    }

    function markPendingChanges() {
        STATE.hasPendingChanges = true;
        syncTopbarSaveButton();
        persistDraft();
        clearAutosaveTimer();
        STATE.autosaveTimer = setTimeout(() => {
            runAutosaveIfNeeded().catch((error) => {
                console.error("autosave error:", error);
            });
        }, AUTOSAVE_DELAY_MS);
    }

    function updateProgressCard() {
        const values = Object.values(STATE.goalInputs);
        let done = 0;
        let partial = 0;
        let missed = 0;

        STATE.goals.forEach((goal) => {
            const value = getInput(goal.id).status;
            if (value === "done") done += 1;
            else if (value === "partial") partial += 1;
            else if (value === "missed") missed += 1;
        });

        const total = STATE.goals.length || 1;
        const adherence = Math.round(((done + partial * 0.5) / total) * 100);
        const ring = el("checkinProgressRing");
        const percentNode = el("checkinProgressPercent");

        if (percentNode) percentNode.textContent = `${adherence}%`;
        if (ring) {
            const clamped = Math.max(0, Math.min(100, adherence));
            const circumference = 2 * Math.PI * 54;
            const progress = circumference * (clamped / 100);
            ring.style.strokeDasharray = `${progress} ${circumference}`;
            ring.style.stroke = ringColorForScore(clamped);
        }

        const doneNode = el("metricDone");
        const partialNode = el("metricPartial");
        const missedNode = el("metricMissed");
        if (doneNode) doneNode.textContent = String(done);
        if (partialNode) partialNode.textContent = String(partial);
        if (missedNode) missedNode.textContent = String(missed);
    }

    function startOfWeek(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const day = (d.getDay() + 6) % 7; // Monday-first week
        d.setDate(d.getDate() - day);
        return d;
    }

    function isSameWeek(dateA, dateB) {
        return formatISODate(startOfWeek(dateA)) === formatISODate(startOfWeek(dateB));
    }

    function getWeekDates(isoDate) {
        const selected = parseDate(isoDate) || new Date();
        const today = new Date();
        const isCurrentWeek = isSameWeek(selected, today);
        const start = isCurrentWeek
            ? (() => {
                const s = new Date(today);
                s.setHours(0, 0, 0, 0);
                s.setDate(today.getDate() - 6);
                return s;
            })()
            : startOfWeek(selected);
        const days = [];
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            days.push(date);
        }
        return days;
    }

    function formatWeekLabel(isoDate) {
        const selected = parseDate(isoDate) || new Date();
        const today = new Date();
        if (isSameWeek(selected, today)) {
            return "This week";
        }
        const week = getWeekDates(isoDate);
        const first = week[0];
        const last = week[6];
        const firstText = first.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        const lastText = last.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return `${firstText} - ${lastText}`;
    }

    function renderGoalGroups() {
        const wrap = el("checkinGroupsWrap");
        const submitWrap = el("submitWrap");
        const manageBtn = el("manageGoalsBtn");
        if (!wrap || !submitWrap) return;

        if (STATE.access?.isAdmin && !STATE.targetUserId) {
            wrap.innerHTML = `<section class="checkin-empty-card">
                <span class="checkin-empty-icon"><i data-lucide="user-round-search"></i></span>
                <h3>Select a client to begin</h3>
                <p>Pick a client from the admin dropdown above to load their goals, progress, and daily check-in details.</p>
            </section>`;
            submitWrap.classList.add("checkin-hidden");
            if (manageBtn) {
                manageBtn.disabled = true;
                manageBtn.innerHTML = '<i data-lucide="sliders-horizontal"></i><span>Goal Settings</span>';
            }
            refreshIcons();
            return;
        }

        if (!STATE.goals.length) {
            wrap.innerHTML = `<section class="checkin-empty-card">
                <span class="checkin-empty-icon"><i data-lucide="target"></i></span>
                <h3>No goals defined yet</h3>
                <p>Create your daily goals to start tracking your consistency and progress.</p>
                <a class="checkin-secondary-btn" href="${escapeHtml(getManageGoalsHref())}"><i data-lucide="plus"></i> Add Goals</a>
            </section>`;
            submitWrap.classList.add("checkin-hidden");
            if (manageBtn) {
                manageBtn.disabled = false;
                manageBtn.innerHTML = '<i data-lucide="sliders-horizontal"></i><span>Goal Settings</span>';
            }
            refreshIcons();
            return;
        }

        submitWrap.classList.remove("checkin-hidden");
        if (manageBtn) {
            manageBtn.disabled = false;
            manageBtn.innerHTML = '<i data-lucide="sliders-horizontal"></i><span>Goal Settings</span>';
        }

        const grouped = {
            "Diet": [],
            "Lifestyle Goals": [],
            "Supplements": [],
            "Activity": []
        };

        STATE.goals.forEach((goal) => {
            grouped[groupName(goal)].push(goal);
        });

        const sections = Object.entries(grouped)
            .filter((entry) => entry[1].length > 0)
            .map(([title, goals]) => {
                const items = goals.map((goal) => {
                    const input = getInput(goal.id);
                    const hasNote = Boolean((input.comment || "").trim());
                    const notePreview = hasNote
                        ? `<p class="checkin-goal-note-preview">Note: ${escapeHtml(String(input.comment).replace(/\s+/g, " ").trim())}</p>`
                        : "";

                    return `<article class="checkin-goal-row-compact" data-goal-row="${goal.id}">
                        <div class="checkin-goal-left">
                            <div class="checkin-goal-title-line">
                                <h4>${escapeHtml(goal.goal_name)}</h4>
                                <button type="button" class="checkin-goal-comment-btn ${hasNote ? "has-note" : ""}" data-goal-note="${goal.id}" title="${hasNote ? "Edit comment" : "Add comment"}" aria-label="${hasNote ? "Edit note" : "Add note"}">
                                    <i data-lucide="message-circle-more"></i>
                                    ${hasNote ? '<span class="note-dot" aria-hidden="true"></span>' : ""}
                                </button>
                            </div>
                            <p class="checkin-goal-target">${escapeHtml(goalTargetText(goal))}</p>
                            ${notePreview}
                        </div>
                        <div class="checkin-status-circles" role="group" aria-label="Status options">
                            ${STATUS_VALUES.map((status) => {
                                const selected = input.status === status ? "is-active" : "";
                                const label = status === "done" ? "Done" : status === "partial" ? "Partial" : "Missed";
                                const icon = status === "done" ? "check" : status === "partial" ? "plus" : "x";
                                return `<button type="button" class="checkin-status-circle-btn ${selected}" data-goal-status="${goal.id}" data-status="${status}" aria-label="${label}"><span class="checkin-status-circle-dot"><i data-lucide="${icon}"></i></span></button>`;
                            }).join("")}
                        </div>
                    </article>`;
                }).join("");

                return `<section class="checkin-group"><h3 class="checkin-group-title"><i data-lucide="${groupIcon(title)}"></i>${escapeHtml(title)}</h3><div class="checkin-goal-list-card">${items}</div></section>`;
            }).join("");

        wrap.innerHTML = sections;
        refreshIcons();
        updateProgressCard();
    }

    function renderDateStrip() {
        const strip = el("checkinDateStrip");
        const weekLabel = el("checkinWeekLabel");
        if (!strip) return;

        const selectedDate = STATE.selectedDate;
        const weekDates = getWeekDates(selectedDate);
        const todayIso = formatISODate(new Date());

        strip.innerHTML = weekDates.map((date) => {
            const iso = formatISODate(date);
            const label = date.toLocaleDateString(undefined, { weekday: "short" });
            const day = date.getDate();
            const month = date.toLocaleDateString(undefined, { month: "short" });
            const active = iso === selectedDate ? "is-active" : "";
            const hasCheckin = STATE.checkinsByDate.has(iso);
            const dot = hasCheckin ? '<span class="checkin-date-dot" aria-hidden="true"></span>' : "";
            const isFuture = iso > todayIso;
            return `<button type="button" class="checkin-date-pill ${active}" data-checkin-date="${iso}" ${isFuture ? "disabled" : ""}><span>${label}</span><strong>${day}</strong><span>${month}</span>${dot}</button>`;
        }).join("");

        if (weekLabel) {
            weekLabel.textContent = formatWeekLabel(selectedDate);
        }

        updateProgressCardTitle(selectedDate);

        const activeNode = strip.querySelector(".checkin-date-pill.is-active");
        if (activeNode) {
            activeNode.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
        }
    }

    function closeWeekCalendar() {
        const backdrop = el("checkinWeekCalendarBackdrop");
        const panel = el("checkinWeekCalendar");
        if (!backdrop || !panel) return;
        backdrop.classList.add("checkin-hidden");
        panel.classList.add("checkin-hidden");
        panel.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function renderWeekCalendar() {
        const title = el("checkinWeekCalendarMonth");
        const grid = el("checkinWeekCalendarGrid");
        if (!title || !grid) return;

        const monthDate = STATE.weekCalendarMonth || parseDate(STATE.selectedDate) || new Date();
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const dayOffset = (monthStart.getDay() + 6) % 7; // Monday-first grid
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - dayOffset);

        title.textContent = monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" });

        const selectedIso = STATE.selectedDate;
        const html = [];

        for (let i = 0; i < 42; i += 1) {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + i);
            const iso = formatISODate(date);
            const isOutside = date.getMonth() !== monthStart.getMonth();
            const isSelected = iso === selectedIso;
            const isFuture = iso > formatISODate(new Date());
            const hasStatus = STATE.checkinsByDate.has(iso);
            const dot = hasStatus ? '<span class="checkin-week-calendar-day-dot" aria-hidden="true"></span>' : "";
            html.push(`<button type="button" class="checkin-week-calendar-day ${isOutside ? "is-outside" : ""} ${isSelected ? "is-selected" : ""} ${isFuture ? "is-disabled" : ""}" data-week-calendar-date="${iso}" ${isFuture ? "disabled" : ""}><span>${date.getDate()}</span>${dot}</button>`);
        }

        grid.innerHTML = html.join("");
    }

    function openWeekCalendar() {
        const backdrop = el("checkinWeekCalendarBackdrop");
        const panel = el("checkinWeekCalendar");
        if (!backdrop || !panel) return;

        const selected = parseDate(STATE.selectedDate) || new Date();
        STATE.weekCalendarMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
        renderWeekCalendar();
        backdrop.classList.remove("checkin-hidden");
        panel.classList.remove("checkin-hidden");
        panel.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        refreshIcons();
    }

    function bindWeekCalendar() {
        const weekBtn = el("checkinWeekBtn");
        const backdrop = el("checkinWeekCalendarBackdrop");
        const panel = el("checkinWeekCalendar");
        const prev = el("checkinWeekCalendarPrev");
        const next = el("checkinWeekCalendarNext");
        const grid = el("checkinWeekCalendarGrid");

        if (weekBtn) {
            weekBtn.addEventListener("click", openWeekCalendar);
        }

        if (backdrop) {
            backdrop.addEventListener("click", closeWeekCalendar);
        }

        if (panel) {
            panel.addEventListener("click", (event) => {
                event.stopPropagation();
            });
        }

        if (prev) {
            prev.addEventListener("click", () => {
                const current = STATE.weekCalendarMonth || new Date();
                STATE.weekCalendarMonth = new Date(current.getFullYear(), current.getMonth() - 1, 1);
                renderWeekCalendar();
            });
        }

        if (next) {
            next.addEventListener("click", () => {
                const current = STATE.weekCalendarMonth || new Date();
                STATE.weekCalendarMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
                renderWeekCalendar();
            });
        }

        if (grid) {
            grid.addEventListener("click", async (event) => {
                const btn = event.target.closest("[data-week-calendar-date]");
                if (!btn) return;

                if (btn.hasAttribute("disabled")) return;

                await flushPendingChanges();
                STATE.selectedDate = btn.getAttribute("data-week-calendar-date") || STATE.selectedDate;
                closeWeekCalendar();
                renderDateStrip();
                await loadGoals();
                await loadCheckinForDate();
                renderGoalGroups();
                refreshIcons();
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                closeWeekCalendar();
            }
        });
    }

    function updateProgressCardTitle(selectedDate) {
        const title = el("progressCardTitle");
        if (!title) return;

        const todayIso = formatISODate(new Date());
        if (selectedDate === todayIso) {
            title.textContent = "Today's Progress";
            return;
        }

        const parsed = parseDate(selectedDate);
        if (!parsed) {
            title.textContent = "Progress";
            return;
        }

        const dateLabel = parsed.toLocaleDateString(undefined, { day: "numeric", month: "short" });
        title.textContent = `${dateLabel} Progress`;
    }

    async function loadUsersForAdmin() {
        const toolbar = el("checkinUserToolbar");
        const select = el("checkinUserSelect");
        if (!toolbar || !select || !STATE.access?.isAdmin) return;

        // Try with role/is_admin columns first; fall back to basic columns if those don't exist
        let data = null;
        let usedExtendedCols = false;
        const extendedResult = await window.supabaseClient
            .from("profiles")
            .select("id, first_name, last_name, full_name, email, role, is_admin")
            .order("full_name", { ascending: true });

        if (!extendedResult.error) {
            data = extendedResult.data;
            usedExtendedCols = true;
        } else {
            const basicResult = await window.supabaseClient
                .from("profiles")
                .select("id, first_name, last_name, full_name, email")
                .order("full_name", { ascending: true });

            if (basicResult.error) {
                console.warn("daily checkin user list warning:", basicResult.error.message || basicResult.error);
                return;
            }
            data = basicResult.data;
        }

        STATE.users = (data || []).filter((item) => {
            if (!item?.id) return false;
            if (item.id === STATE.access.user.id) return true;
            if (usedExtendedCols) {
                if (item.is_admin === true) return false;
                const role = String(item.role || "").toLowerCase();
                if (role === "admin") return false;
            }
            return true;
        });

        select.innerHTML = `<option value="">Select</option>${STATE.users.map((user) => `<option value="${user.id}">${escapeHtml(buildUserLabel(user))}</option>`).join("")}`;
        STATE.targetUserId = "";
        toolbar.classList.remove("checkin-hidden");
        refreshIcons();
    }

    async function loadSubmittedDates() {
        if (!STATE.targetUserId) {
            STATE.checkinsByDate = new Map();
            return;
        }

        const { data, error } = await window.supabaseClient
            .from("daily_checkins")
            .select("checkin_date")
            .eq("user_id", STATE.targetUserId);

        if (error) {
            console.warn("load submitted dates warning:", error.message || error);
            STATE.checkinsByDate = new Map();
            return;
        }

        STATE.checkinsByDate = new Map((data || []).map((row) => [String(row.checkin_date), true]));
    }

    async function loadGoals() {
        if (!STATE.targetUserId) {
            STATE.goals = [];
            STATE.goalInputs = {};
            return;
        }

        const { data, error } = await window.supabaseClient
            .from("checkin_goals")
            .select("*")
            .eq("user_id", STATE.targetUserId)
            .order("created_at", { ascending: true });

        if (error) {
            showToast("Could not load goals.");
            console.error("load goals error:", error);
            return;
        }

        STATE.goals = (data || []).map(normalizeGoal);
        STATE.goalInputs = {};
        STATE.goals.forEach((goal) => getInput(goal.id));
    }

    async function getExistingCheckin() {
        if (!STATE.targetUserId) {
            return null;
        }

        const { data, error } = await window.supabaseClient
            .from("daily_checkins")
            .select("*")
            .eq("user_id", STATE.targetUserId)
            .eq("checkin_date", STATE.selectedDate)
            .maybeSingle();

        if (error) {
            console.error("load checkin error:", error);
            showToast("Could not load check-in data.");
            return null;
        }

        return data || null;
    }

    async function loadEntries(checkinId) {
        const map = {};

        const [checkinRows, dailyRows] = await Promise.all([
            loadEntriesByColumn(checkinId, "checkin_id"),
            loadEntriesByColumn(checkinId, "daily_checkin_id")
        ]);

        const rows = mergeEntryRows([...(checkinRows.data || []), ...(dailyRows.data || [])]);
        const hasFatalError = [checkinRows.error, dailyRows.error].some((error) => error && !isMissingColumnError(error));

        if (hasFatalError && !rows.length) {
            return map;
        }

        rows.forEach((row) => {
            map[String(row.goal_id)] = {
                status: row.status || "",
                comment: row.comment || "",
                actual_value: row.actual_value === null || row.actual_value === undefined ? "" : String(row.actual_value),
                commentOpen: Boolean(row.comment),
                actualOpen: row.actual_value !== null && row.actual_value !== undefined && String(row.actual_value) !== ""
            };
        });

        return map;
    }

    function isMissingColumnError(error) {
        const message = String(error?.message || "").toLowerCase();
        if (!message) return false;
        return (message.includes("column") && message.includes("does not exist"))
            || message.includes("schema cache");
    }

    function mergeEntryRows(rows) {
        const deduped = new Map();
        (rows || []).forEach((row) => {
            if (!row) return;
            const key = row.id
                ? `id:${row.id}`
                : `goal:${row.goal_id}|status:${row.status || ""}|comment:${row.comment || ""}|actual:${row.actual_value ?? ""}`;
            deduped.set(key, row);
        });
        return Array.from(deduped.values());
    }

    async function loadEntriesByColumn(checkinId, columnName) {
        const result = await window.supabaseClient
            .from("daily_checkin_entries")
            .select("*")
            .eq(columnName, checkinId);

        if (result.error && !isMissingColumnError(result.error)) {
            console.error(`load entries (${columnName}) error:`, result.error);
        }

        return {
            data: result.data || [],
            error: result.error || null
        };
    }

    async function clearEntriesForCheckin(checkinId) {
        const [byDaily, byCheckin] = await Promise.all([
            window.supabaseClient
                .from("daily_checkin_entries")
                .delete()
                .eq("daily_checkin_id", checkinId),
            window.supabaseClient
                .from("daily_checkin_entries")
                .delete()
                .eq("checkin_id", checkinId)
        ]);

        const fatalErrors = [byDaily.error, byCheckin.error].filter((error) => error && !isMissingColumnError(error));
        if (fatalErrors.length) {
            console.warn("clear entries warning:", fatalErrors[0]);
        }
    }

    async function loadCheckinForDate() {
        clearAutosaveTimer();
        STATE.hasPendingChanges = false;
        syncTopbarSaveButton();

        if (!STATE.targetUserId) {
            STATE.checkinId = "";
            syncTopbarSaveButton();
            const submitWithoutTarget = el("submitCheckinBtn");
            if (submitWithoutTarget) {
                submitWithoutTarget.innerHTML = '<i data-lucide="save"></i> Save Check-in';
            }
            return;
        }

        const checkin = await getExistingCheckin();
        STATE.checkinId = checkin?.id || "";

        if (checkin?.id) {
            const savedInputs = await loadEntries(checkin.id);
            STATE.goals.forEach((goal) => {
                const key = String(goal.id);
                const input = getInput(goal.id);
                const fromDb = savedInputs[key];
                if (!fromDb) return;
                input.status = fromDb.status || "";
                input.comment = fromDb.comment || "";
                input.actual_value = fromDb.actual_value || "";
                input.commentOpen = Boolean(fromDb.commentOpen || input.status === "partial" || input.status === "missed");
                input.actualOpen = Boolean(fromDb.actualOpen);
            });
        }

        if (restoreDraftIfPresent()) {
            clearAutosaveTimer();
            STATE.autosaveTimer = setTimeout(() => {
                runAutosaveIfNeeded().catch((error) => {
                    console.error("restored draft autosave error:", error);
                });
            }, AUTOSAVE_DELAY_MS);
        }
        syncTopbarSaveButton();

        const submit = el("submitCheckinBtn");
        if (submit) {
            submit.innerHTML = checkin?.id
                ? '<i data-lucide="save"></i> Update Check-in'
                : '<i data-lucide="save"></i> Save Check-in';
        }
    }

    function getSupabaseErrorMessage(error) {
        if (!error) return "unknown error";
        return error.message || error.details || error.hint || "unknown error";
    }

    async function updateDailyCheckinRecord(checkinId, adherence, doneCount, partialCount, missedCount) {
        const primary = await window.supabaseClient
            .from("daily_checkins")
            .update({
                adherence_percent: adherence,
                overall_score: adherence,
                done_count: doneCount,
                partial_count: partialCount,
                missed_count: missedCount,
                updated_at: new Date().toISOString()
            })
            .eq("id", checkinId);

        if (!primary.error) {
            return { error: null };
        }

        // Fallback for schemas where metric columns are different/missing.
        const fallback = await window.supabaseClient
            .from("daily_checkins")
            .update({
                updated_at: new Date().toISOString()
            })
            .eq("id", checkinId);

        if (!fallback.error) {
            return { error: null };
        }

        return { error: fallback.error };
    }

    async function insertDailyCheckinRecord(adherence, doneCount, partialCount, missedCount) {
        const payloads = [
            {
                user_id: STATE.targetUserId,
                checkin_date: STATE.selectedDate,
                adherence_percent: adherence,
                overall_score: adherence,
                done_count: doneCount,
                partial_count: partialCount,
                missed_count: missedCount,
                created_by: STATE.access.user.id
            },
            {
                user_id: STATE.targetUserId,
                checkin_date: STATE.selectedDate,
                adherence_percent: adherence,
                overall_score: adherence,
                done_count: doneCount,
                partial_count: partialCount,
                missed_count: missedCount
            },
            {
                user_id: STATE.targetUserId,
                checkin_date: STATE.selectedDate
            }
        ];

        let lastError = null;

        for (const payload of payloads) {
            const result = await window.supabaseClient
                .from("daily_checkins")
                .insert(payload)
                .select("id")
                .single();

            if (!result.error && result.data?.id) {
                return { id: result.data.id, error: null };
            }

            lastError = result.error || null;
        }

        return { id: "", error: lastError };
    }

    async function saveCheckin(options = {}) {
        const {
            redirectOnSuccess = false,
            showSuccessToast = true,
            isAutosave = false
        } = options;

        if (STATE.isSaving) return;

        if (STATE.access?.isAdmin && !STATE.targetUserId) {
            showToast("Select a client first.");
            return;
        }

        if (!STATE.goals.length) {
            showToast("Add goals first.");
            return;
        }

        STATE.isSaving = true;
        syncTopbarSaveButton();

        try {
            const payload = STATE.goals.map((goal) => {
                const value = getInput(goal.id);
                return {
                    goal_id: goal.id,
                    status: value.status || "missed",
                    comment: (value.comment || "").trim() || null,
                    actual_value: null
                };
            });

            const doneCount = payload.filter((item) => item.status === "done").length;
            const partialCount = payload.filter((item) => item.status === "partial").length;
            const missedCount = payload.filter((item) => item.status === "missed").length;
            const adherence = Math.round(((doneCount + partialCount * 0.5) / (STATE.goals.length || 1)) * 100);

            let checkinId = STATE.checkinId;
            const wasExistingCheckin = Boolean(checkinId);

            if (checkinId) {
                const { error } = await updateDailyCheckinRecord(checkinId, adherence, doneCount, partialCount, missedCount);

                if (error) {
                    showToast(`Could not update check-in: ${getSupabaseErrorMessage(error)}`);
                    console.error("update checkin error:", error);
                    return;
                }
            } else {
                const { id, error } = await insertDailyCheckinRecord(adherence, doneCount, partialCount, missedCount);

                if (error || !id) {
                    showToast(`Could not submit check-in: ${getSupabaseErrorMessage(error)}`);
                    console.error("insert checkin error:", error);
                    return;
                }

                checkinId = id;
                STATE.checkinId = checkinId;

                // Ensure metrics are written even if insert fallback used the minimal payload.
                const updateAfterInsert = await updateDailyCheckinRecord(checkinId, adherence, doneCount, partialCount, missedCount);
                if (updateAfterInsert.error) {
                    console.warn("Post-insert metric update warning:", updateAfterInsert.error);
                }
            }

            await clearEntriesForCheckin(checkinId);

            const entries = payload.map((item) => ({
                checkin_id: checkinId,
                daily_checkin_id: checkinId,
                goal_id: item.goal_id,
                status: item.status,
                comment: item.comment,
                actual_value: item.actual_value
            }));

            let insert = await window.supabaseClient
                .from("daily_checkin_entries")
                .insert(entries);

            if (insert.error) {
                insert = await window.supabaseClient
                    .from("daily_checkin_entries")
                    .insert(entries.map((item) => ({
                        daily_checkin_id: checkinId,
                        goal_id: item.goal_id,
                        status: item.status,
                        comment: item.comment,
                        actual_value: item.actual_value
                    })));
            }

            if (insert.error) {
                showToast(`Could not save check-in entries: ${getSupabaseErrorMessage(insert.error)}`);
                console.error("insert entries error:", insert.error);
                return;
            }

            clearAutosaveTimer();
            STATE.hasPendingChanges = false;
            syncTopbarSaveButton();
            STATE.lastSavedAt = Date.now();
            clearDraft();

            const submit = el("submitCheckinBtn");
            if (submit && !wasExistingCheckin) {
                submit.innerHTML = '<i data-lucide="save"></i> Update Check-in';
                refreshIcons();
            }

            if (redirectOnSuccess) {
                showToast(wasExistingCheckin ? "Checkin updated" : "Checkin saved");
            }

            if (showSuccessToast) {
                showToast(isAutosave ? "Auto-saved" : (wasExistingCheckin ? "Checkin updated" : "Checkin saved"));
            }

            await loadSubmittedDates();
            renderDateStrip();
        } finally {
            STATE.isSaving = false;
            syncTopbarSaveButton();
        }
    }

    function bindDateChange() {
        const strip = el("checkinDateStrip");
        if (!strip) return;
        strip.addEventListener("click", async (event) => {
            const btn = event.target.closest("[data-checkin-date]");
            if (!btn) return;
            await flushPendingChanges();
            STATE.selectedDate = btn.getAttribute("data-checkin-date");
            renderDateStrip();
            await loadGoals();
            await loadCheckinForDate();
            renderGoalGroups();
            refreshIcons();
        });
    }

    function bindGoalInteractions() {
        const wrap = el("checkinGroupsWrap");
        if (!wrap) return;

        wrap.addEventListener("click", (event) => {
            const statusBtn = event.target.closest("[data-goal-status][data-status]");
            if (statusBtn) {
                const goalId = statusBtn.getAttribute("data-goal-status");
                const status = statusBtn.getAttribute("data-status");
                const value = getInput(goalId);
                value.status = status;
                renderGoalGroups();
                markPendingChanges();
                return;
            }

            const noteBtn = event.target.closest("[data-goal-note]");
            if (noteBtn) {
                openGoalNoteModal(noteBtn.getAttribute("data-goal-note"));
            }
        });
    }

    function openGoalNoteModal(goalId) {
        const id = String(goalId || "");
        const goal = STATE.goals.find((item) => String(item.id) === id);
        const input = getInput(id);
        const backdrop = el("goalNoteModalBackdrop");
        const modal = el("goalNoteModal");
        const title = el("goalNoteModalTitle");
        const noteInput = el("goalNoteInput");
        if (!goal || !backdrop || !modal || !title || !noteInput) return;

        STATE.noteModalGoalId = id;
        title.textContent = `Add note for ${goal.goal_name}`;
        noteInput.value = input.comment || "";

        backdrop.classList.remove("checkin-hidden");
        modal.classList.remove("checkin-hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        noteInput.focus();
    }

    function closeGoalNoteModal() {
        const backdrop = el("goalNoteModalBackdrop");
        const modal = el("goalNoteModal");
        if (!backdrop || !modal) return;
        backdrop.classList.add("checkin-hidden");
        modal.classList.add("checkin-hidden");
        modal.setAttribute("aria-hidden", "true");
        STATE.noteModalGoalId = "";
        document.body.style.overflow = "";
    }

    function saveGoalNoteModal() {
        if (!STATE.noteModalGoalId) return;
        const input = getInput(STATE.noteModalGoalId);
        const noteInput = el("goalNoteInput");
        if (!noteInput) return;

        input.comment = (noteInput.value || "").trim();
        input.actual_value = "";

        closeGoalNoteModal();
        renderGoalGroups();
        markPendingChanges();
    }

    function bindGoalNoteModal() {
        const backdrop = el("goalNoteModalBackdrop");
        const cancelBtn = el("goalNoteCancelBtn");
        const saveBtn = el("goalNoteSaveBtn");
        const modal = el("goalNoteModal");
        const noteInput = el("goalNoteInput");

        if (backdrop) backdrop.addEventListener("click", closeGoalNoteModal);
        if (cancelBtn) cancelBtn.addEventListener("click", closeGoalNoteModal);
        if (saveBtn) saveBtn.addEventListener("click", saveGoalNoteModal);
        if (modal) {
            modal.addEventListener("click", (event) => {
                event.stopPropagation();
            });
        }
        if (noteInput) {
            noteInput.addEventListener("keydown", (event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    saveGoalNoteModal();
                }
            });
        }
    }

    function bindActionSheet() {
        const backdrop = el("goalActionBackdrop");
        const closeBtn = el("goalActionCloseBtn");
        const commentBtn = el("goalActionCommentBtn");
        const actualBtn = el("goalActionActualBtn");

        if (backdrop) backdrop.addEventListener("click", closeGoalActionSheet);
        if (closeBtn) closeBtn.addEventListener("click", closeGoalActionSheet);

        if (commentBtn) {
            commentBtn.addEventListener("click", () => {
                if (!STATE.actionGoalId) return;
                const input = getInput(STATE.actionGoalId);
                input.commentOpen = !input.commentOpen;
                renderGoalGroups();
                closeGoalActionSheet();
                const node = document.querySelector(`[data-goal-comment="${STATE.actionGoalId}"]`);
                if (node) node.focus();
            });
        }

        if (actualBtn) {
            actualBtn.addEventListener("click", () => {
                if (!STATE.actionGoalId) return;
                const input = getInput(STATE.actionGoalId);
                input.actualOpen = !input.actualOpen;
                renderGoalGroups();
                closeGoalActionSheet();
                const node = document.querySelector(`[data-goal-actual="${STATE.actionGoalId}"]`);
                if (node) node.focus();
            });
        }
    }

    function bindStaticActions() {
        const manage = el("manageGoalsBtn");

        const openManageGoals = async () => {
            if (STATE.access?.isAdmin && !STATE.targetUserId) {
                showToast("Select a client first.");
                return;
            }
            await flushPendingChanges();
            window.location.href = getManageGoalsHref();
        };

        if (manage) {
            manage.addEventListener("click", openManageGoals);
        }

        const submit = el("submitCheckinBtn");
        if (submit) {
            submit.addEventListener("click", async () => {
                await saveCheckin({
                    redirectOnSuccess: false,
                    showSuccessToast: true,
                    isAutosave: false
                });
            });
        }

        const topbarSave = el("checkinTopbarSaveBtn");
        if (topbarSave) {
            topbarSave.addEventListener("click", async () => {
                if (topbarSave.disabled) return;
                await saveCheckin({
                    redirectOnSuccess: false,
                    showSuccessToast: true,
                    isAutosave: false
                });
            });
        }

        const userSelect = el("checkinUserSelect");
        if (userSelect) {
            userSelect.addEventListener("change", async () => {
                await flushPendingChanges();
                STATE.targetUserId = userSelect.value;
                await loadSubmittedDates();
                renderDateStrip();
                await loadGoals();
                await loadCheckinForDate();
                renderGoalGroups();
                refreshIcons();
            });
        }
    }

    function bindUnloadFlush() {
        window.addEventListener("beforeunload", () => {
            if (STATE.hasPendingChanges) {
                persistDraft();
                flushPendingChanges();
            }
        });

        window.addEventListener("pagehide", () => {
            if (STATE.hasPendingChanges) persistDraft();
            flushPendingChanges();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                if (STATE.hasPendingChanges) persistDraft();
                flushPendingChanges();
            }
        });
    }

    function bindNavigationFlush() {
        document.addEventListener("click", async (event) => {
            const link = event.target.closest("a[href]");
            if (!link || !STATE.hasPendingChanges) return;
            const href = link.getAttribute("href") || "";
            if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

            const target = link.getAttribute("target");
            if (target && target !== "_self") {
                flushPendingChanges();
                return;
            }

            event.preventDefault();
            await flushPendingChanges();
            window.location.href = link.href;
        }, true);
    }

    function setGreeting() {
        const greeting = el("checkinGreeting");
        if (!greeting) return;
        const hour = new Date().getHours();
        const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Night";
        greeting.textContent = `Good ${part} 👋`;
    }

    async function init() {
        bindDateChange();
        bindWeekCalendar();
        bindGoalInteractions();
        bindGoalNoteModal();
        bindActionSheet();
        bindStaticActions();
        bindUnloadFlush();
        bindNavigationFlush();

        const params = new URLSearchParams(window.location.search);
        const todayIso = formatISODate(new Date());
        STATE.selectedDate = todayIso;

        if (typeof window.getAccessState !== "function") {
            showToast("Auth state is not ready yet.");
            return;
        }

        STATE.access = await window.getAccessState();
        if (!STATE.access?.isLoggedIn || !STATE.access?.user?.id) {
            showToast("Please log in first.");
            return;
        }

        STATE.targetUserId = STATE.access.user.id;
        const isAdmin = Boolean(
            STATE.access.isAdmin ||
            (typeof window.isAdminUser === "function" && window.isAdminUser(STATE.access.user))
        );
        STATE.access = { ...STATE.access, isAdmin };
        if (isAdmin) {
            await loadUsersForAdmin();
            refreshIcons();
            STATE.targetUserId = "";

            const userFromQuery = params.get("user");
            if (userFromQuery) {
                const userSelect = el("checkinUserSelect");
                if (userSelect && Array.from(userSelect.options).some((opt) => opt.value === userFromQuery)) {
                    userSelect.value = userFromQuery;
                    STATE.targetUserId = userFromQuery;
                }
            }
        }

        await loadSubmittedDates();
        renderDateStrip();
        setGreeting();
        await loadGoals();
        await loadCheckinForDate();
        renderGoalGroups();
        refreshIcons();
    }

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error("daily_checkin init error:", error);
            showToast("Could not load Daily Check-in.");
        });
    });
}());
