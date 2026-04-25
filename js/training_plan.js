/* ══════════════════════════════════════
   TYFIT Training Plan — training_plan.js
═══════════════════════════════════════ */

/* ── State ── */
const TP = {
    currentUserId: null,
    plans: [],
    selectedPlanId: null,
    days: [],
    exercises: {},          // { [dayId]: Exercise[] }
    catalog: [],
    selectedCatalogIds: new Set(),
    catalogFilter: { bodyPart: "All", search: "" },
    openDayIds: new Set(),
    inputDialogResolve: null,
    confirmDialogResolve: null,
    editingExerciseId: null,
};

const BODY_PARTS = ["All", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Glutes", "Core", "Full Body"];

/* ── Utilities ── */
function byId(id) { return document.getElementById(id); }

function showToast(msg) {
    const t = byId("appToast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove("is-show"), 2500);
}

function setIcons() {
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function getExerciseIcon(bodyPart) {
    const map = {
        "Chest": "heart-pulse",
        "Back": "move-vertical",
        "Shoulders": "arrow-up-right",
        "Biceps": "dumbbell",
        "Triceps": "dumbbell",
        "Legs": "footprints",
        "Glutes": "circle-dot",
        "Core": "circle-dot",
        "Full Body": "activity",
    };
    return map[bodyPart] || "dumbbell";
}

/* ═══════════════════════════════════════
   AUTH + INIT
═══════════════════════════════════════ */
async function init() {
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) { window.location.href = "login.html"; return; }
        TP.currentUserId = user.id;
        hydrateDesktopHeader(user);
        await fetchAndRenderPlans();
        bindShell();
    } catch (err) {
        console.error("Init error:", err);
        showToast("Failed to load. Please refresh.");
    }
}

function hydrateDesktopHeader(user) {
    const nameEl = byId("desktopProfileName");
    if (nameEl) {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
        nameEl.textContent = name.split(" ")[0] || name;
    }
    if (window.tyfitProfile?.fetchProfile) {
        window.tyfitProfile.fetchProfile(user.id).then(p => {
            const avatarEl = byId("desktopProfileAvatar");
            if (p?.avatar_url && avatarEl) avatarEl.src = p.avatar_url;
        }).catch(() => {});
    }
}

/* ═══════════════════════════════════════
   DB: PLANS
═══════════════════════════════════════ */
async function dbFetchPlans() {
    const { data, error } = await window.supabaseClient
        .from("training_plans")
        .select("*")
        .eq("user_id", TP.currentUserId)
        .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function dbCreatePlan(name) {
    const { data, error } = await window.supabaseClient
        .from("training_plans")
        .insert({ user_id: TP.currentUserId, name })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function dbRenamePlan(id, name) {
    const { error } = await window.supabaseClient
        .from("training_plans")
        .update({ name })
        .eq("id", id)
        .eq("user_id", TP.currentUserId);
    if (error) throw error;
}

async function dbDeletePlan(id) {
    const { error } = await window.supabaseClient
        .from("training_plans")
        .delete()
        .eq("id", id)
        .eq("user_id", TP.currentUserId);
    if (error) throw error;
}

/* ═══════════════════════════════════════
   DB: DAYS
═══════════════════════════════════════ */
async function dbFetchDays(planId) {
    const { data, error } = await window.supabaseClient
        .from("training_plan_days")
        .select("*")
        .eq("training_plan_id", planId)
        .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function dbCreateDay(planId, name) {
    const sortOrder = TP.days.length;
    const { data, error } = await window.supabaseClient
        .from("training_plan_days")
        .insert({ training_plan_id: planId, name, sort_order: sortOrder })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function dbRenameDay(id, name) {
    const { error } = await window.supabaseClient
        .from("training_plan_days")
        .update({ name })
        .eq("id", id);
    if (error) throw error;
}

async function dbDeleteDay(id) {
    const { error } = await window.supabaseClient
        .from("training_plan_days")
        .delete()
        .eq("id", id);
    if (error) throw error;
}

/* ═══════════════════════════════════════
   DB: EXERCISES
═══════════════════════════════════════ */
async function dbFetchExercisesForDay(dayId) {
    const { data, error } = await window.supabaseClient
        .from("training_day_exercises")
        .select("*")
        .eq("training_plan_day_id", dayId)
        .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function dbAddExercisesToDay(dayId, catalogItems) {
    const existingCount = (TP.exercises[dayId] || []).length;
    const rows = catalogItems.map((item, i) => ({
        training_plan_day_id: dayId,
        exercise_catalog_id: item.id,
        exercise_name: item.name,
        body_part: item.body_part,
        equipment: item.equipment,
        sets: 3,
        reps: "8-12",
        rest_seconds: 90,
        sort_order: existingCount + i,
    }));
    const { data, error } = await window.supabaseClient
        .from("training_day_exercises")
        .insert(rows)
        .select();
    if (error) throw error;
    return data || [];
}

async function dbUpdateExercise(id, updates) {
    const { error } = await window.supabaseClient
        .from("training_day_exercises")
        .update(updates)
        .eq("id", id);
    if (error) throw error;
}

async function dbRemoveExercise(id) {
    const { error } = await window.supabaseClient
        .from("training_day_exercises")
        .delete()
        .eq("id", id);
    if (error) throw error;
}

/* ═══════════════════════════════════════
   DB: CATALOG
═══════════════════════════════════════ */
async function dbFetchCatalog() {
    const { data, error } = await window.supabaseClient
        .from("exercise_catalog")
        .select("*")
        .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function dbFetchCatalogItem(id) {
    const { data, error } = await window.supabaseClient
        .from("exercise_catalog")
        .select("*")
        .eq("id", id)
        .single();
    if (error) throw error;
    return data;
}

/* ═══════════════════════════════════════
   RENDER: PLAN SELECTOR
═══════════════════════════════════════ */
async function fetchAndRenderPlans() {
    TP.plans = await dbFetchPlans();
    renderPlanSelector();

    if (TP.plans.length === 0) {
        TP.selectedPlanId = null;
        renderPlanContent();
        return;
    }

    const keepId = TP.selectedPlanId && TP.plans.find(p => p.id === TP.selectedPlanId)
        ? TP.selectedPlanId
        : TP.plans[0].id;

    await selectPlan(keepId);
}

function renderPlanSelector() {
    const strip = byId("planStrip");
    if (!strip) return;

    let html = TP.plans.map(plan => {
        const isActive = plan.id === TP.selectedPlanId;
        return `
            <button type="button" class="tp-plan-pill ${isActive ? "is-active" : ""}"
                    data-plan-id="${plan.id}">
                <i data-lucide="calendar-days"></i>
                <span>${escHtml(plan.name)}</span>
                ${isActive ? `
                    <span class="tp-plan-pill-actions" aria-label="Plan actions">
                        <button type="button" class="tp-plan-pill-action"
                                data-action="rename-plan" data-plan-id="${plan.id}"
                                title="Rename plan">
                            <i data-lucide="pencil-line"></i>
                        </button>
                        <button type="button" class="tp-plan-pill-action"
                                data-action="delete-plan" data-plan-id="${plan.id}"
                                title="Delete plan">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </span>
                ` : ""}
            </button>`;
    }).join("");

    html += `
        <button type="button" class="tp-add-plan-btn" id="addPlanBtn">
            <i data-lucide="plus"></i> Add Plan
        </button>`;

    strip.innerHTML = html;
    setIcons();

    // Pill click → select plan
    strip.querySelectorAll(".tp-plan-pill").forEach(pill => {
        pill.addEventListener("click", async e => {
            if (e.target.closest("[data-action]")) return;
            const id = pill.dataset.planId;
            if (id !== TP.selectedPlanId) await selectPlan(id);
        });
    });

    // Rename plan
    strip.querySelectorAll("[data-action='rename-plan']").forEach(btn => {
        btn.addEventListener("click", async e => {
            e.stopPropagation();
            const plan = TP.plans.find(p => p.id === btn.dataset.planId);
            await handleRenamePlan(btn.dataset.planId, plan?.name || "");
        });
    });

    // Delete plan
    strip.querySelectorAll("[data-action='delete-plan']").forEach(btn => {
        btn.addEventListener("click", async e => {
            e.stopPropagation();
            const plan = TP.plans.find(p => p.id === btn.dataset.planId);
            await handleDeletePlan(btn.dataset.planId, plan?.name || "this plan");
        });
    });

    byId("addPlanBtn")?.addEventListener("click", handleCreatePlan);
}

/* ═══════════════════════════════════════
   RENDER: PLAN CONTENT
═══════════════════════════════════════ */
function renderPlanContent() {
    const el = byId("planContent");
    if (!el) return;

    if (!TP.selectedPlanId || TP.plans.length === 0) {
        el.innerHTML = `
            <div class="tp-empty-state">
                <div class="tp-empty-icon"><i data-lucide="dumbbell"></i></div>
                <h4>No training plan yet</h4>
                <p>Create your first workout routine.</p>
                <button type="button" class="tp-btn tp-btn-primary" id="emptyCreatePlanBtn">
                    <i data-lucide="plus"></i> Create Plan
                </button>
            </div>`;
        setIcons();
        byId("emptyCreatePlanBtn")?.addEventListener("click", handleCreatePlan);
        return;
    }

    el.innerHTML = `
        <div class="tp-days-header">
            <h4>Training Days</h4>
            <button type="button" class="tp-btn tp-btn-primary tp-btn-sm" id="addDayBtn">
                <i data-lucide="plus"></i> Add Day
            </button>
        </div>
        <div class="tp-days-grid" id="daysGrid"></div>`;

    setIcons();
    byId("addDayBtn")?.addEventListener("click", handleCreateDay);
    renderDays();
}

/* ═══════════════════════════════════════
   RENDER: DAYS
═══════════════════════════════════════ */
function renderDays() {
    const grid = byId("daysGrid");
    if (!grid) return;

    if (TP.days.length === 0) {
        grid.innerHTML = `
            <div class="tp-empty-state" style="padding:36px 24px;">
                <div class="tp-empty-icon" style="background:#fff3ea;color:#f57c2a;">
                    <i data-lucide="calendar-x"></i>
                </div>
                <h4>No training days yet</h4>
                <p>Add Push Day, Pull Day, Legs or any custom day.</p>
            </div>`;
        setIcons();
        return;
    }

    grid.innerHTML = TP.days.map(day => buildDayCard(day)).join("");
    setIcons();
    bindDayCardEvents(grid);
}

function buildDayCard(day) {
    const exercises = TP.exercises[day.id] || [];
    const isOpen = TP.openDayIds.has(day.id);

    return `
        <div class="tp-day-card" data-day-id="${day.id}">
            <div class="tp-day-card-header" data-toggle-day="${day.id}">
                <div class="tp-day-card-header-left">
                    <span class="tp-day-badge"><i data-lucide="calendar"></i></span>
                    <div>
                        <p class="tp-day-card-title">${escHtml(day.name)}</p>
                        <p class="tp-day-card-sub">${exercises.length} exercise${exercises.length !== 1 ? "s" : ""}</p>
                    </div>
                </div>
                <div class="tp-day-card-actions">
                    <button type="button" class="tp-icon-action"
                            data-action="rename-day" data-day-id="${day.id}" title="Rename">
                        <i data-lucide="pencil-line"></i>
                    </button>
                    <button type="button" class="tp-icon-action tp-danger"
                            data-action="delete-day" data-day-id="${day.id}" title="Delete">
                        <i data-lucide="trash-2"></i>
                    </button>
                    <button type="button" class="tp-icon-action"
                            data-action="toggle-day" data-day-id="${day.id}"
                            title="${isOpen ? "Collapse" : "Expand"}">
                        <i data-lucide="${isOpen ? "chevron-up" : "chevron-down"}"></i>
                    </button>
                </div>
            </div>
            ${isOpen ? `
                <div class="tp-day-card-body">
                    ${buildExerciseList(day.id)}
                    <div class="tp-add-exercise-row">
                        <button type="button" class="tp-add-exercise-btn"
                                data-action="add-exercise" data-day-id="${day.id}">
                            <i data-lucide="plus"></i> Add Exercise
                        </button>
                    </div>
                </div>
            ` : ""}
        </div>`;
}

function buildExerciseList(dayId) {
    const exercises = TP.exercises[dayId] || [];
    if (exercises.length === 0) {
        return `
            <div class="tp-empty-state" style="padding:18px 0 14px;gap:8px;">
                <div class="tp-empty-icon" style="width:44px;height:44px;border-radius:12px;">
                    <i data-lucide="activity"></i>
                </div>
                <p style="font-size:13px;color:#8c95a9;margin:0;">No exercises yet. Tap "Add Exercise" below.</p>
            </div>`;
    }

    return `
        <div class="tp-exercise-list">
            ${exercises.map(ex => buildExerciseCard(ex)).join("")}
        </div>`;
}

function buildExerciseCard(ex) {
    const icon = getExerciseIcon(ex.body_part);
    const prescription = `${ex.sets || 3}×${ex.reps || "8-12"}`;
    const meta = [ex.body_part, ex.equipment].filter(Boolean).join(" · ");
    return `
        <div class="tp-exercise-card"
             data-exercise-id="${ex.id}"
             data-catalog-id="${ex.exercise_catalog_id || ""}">
            <div class="tp-exercise-icon"><i data-lucide="${icon}"></i></div>
            <div class="tp-exercise-info">
                <p class="tp-exercise-name">${escHtml(ex.exercise_name)}</p>
                <p class="tp-exercise-meta">${escHtml(meta)}</p>
            </div>
            <span class="tp-prescription-badge">${escHtml(prescription)}</span>
            <div class="tp-exercise-actions">
                <button type="button" class="tp-icon-action"
                        data-action="edit-exercise" data-exercise-id="${ex.id}"
                        title="Edit sets/reps">
                    <i data-lucide="sliders-horizontal"></i>
                </button>
                <button type="button" class="tp-icon-action tp-danger"
                        data-action="remove-exercise" data-exercise-id="${ex.id}"
                        title="Remove">
                    <i data-lucide="x"></i>
                </button>
            </div>
        </div>`;
}

function bindDayCardEvents(container) {
    // Collapse/expand via header click
    container.querySelectorAll("[data-toggle-day]").forEach(header => {
        header.addEventListener("click", e => {
            if (e.target.closest("[data-action]")) return;
            toggleDayOpen(header.dataset.toggleDay);
        });
    });

    // Collapse/expand via chevron button
    container.querySelectorAll("[data-action='toggle-day']").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            toggleDayOpen(btn.dataset.dayId);
        });
    });

    // Rename day
    container.querySelectorAll("[data-action='rename-day']").forEach(btn => {
        btn.addEventListener("click", async e => {
            e.stopPropagation();
            const day = TP.days.find(d => d.id === btn.dataset.dayId);
            await handleRenameDay(btn.dataset.dayId, day?.name || "");
        });
    });

    // Delete day
    container.querySelectorAll("[data-action='delete-day']").forEach(btn => {
        btn.addEventListener("click", async e => {
            e.stopPropagation();
            const day = TP.days.find(d => d.id === btn.dataset.dayId);
            await handleDeleteDay(btn.dataset.dayId, day?.name || "this day");
        });
    });

    // Add exercise
    container.querySelectorAll("[data-action='add-exercise']").forEach(btn => {
        btn.addEventListener("click", async () => {
            TP.selectedDayId = btn.dataset.dayId;
            await openCatalogModal();
        });
    });

    // Edit exercise
    container.querySelectorAll("[data-action='edit-exercise']").forEach(btn => {
        btn.addEventListener("click", e => {
            e.stopPropagation();
            openEditExercise(btn.dataset.exerciseId);
        });
    });

    // Remove exercise
    container.querySelectorAll("[data-action='remove-exercise']").forEach(btn => {
        btn.addEventListener("click", async e => {
            e.stopPropagation();
            await handleRemoveExercise(btn.dataset.exerciseId);
        });
    });

    // Tap card body → exercise detail
    container.querySelectorAll(".tp-exercise-card").forEach(card => {
        card.addEventListener("click", e => {
            if (e.target.closest("[data-action]")) return;
            const catalogId = card.dataset.catalogId;
            if (catalogId) openExerciseDetail(catalogId);
        });
    });
}

function toggleDayOpen(dayId) {
    if (TP.openDayIds.has(dayId)) {
        TP.openDayIds.delete(dayId);
    } else {
        TP.openDayIds.add(dayId);
        // Lazy-load exercises if not yet fetched
        if (!TP.exercises[dayId]) {
            TP.exercises[dayId] = [];
            dbFetchExercisesForDay(dayId).then(exs => {
                TP.exercises[dayId] = exs;
                renderDays();
            }).catch(console.error);
        }
    }
    renderDays();
}

/* ═══════════════════════════════════════
   SELECT PLAN
═══════════════════════════════════════ */
async function selectPlan(planId) {
    TP.selectedPlanId = planId;
    TP.days = [];
    TP.exercises = {};
    TP.openDayIds.clear();

    renderPlanSelector();
    renderPlanContent();

    const grid = byId("daysGrid");
    if (grid) {
        grid.innerHTML = `<div class="tp-spinner"><i data-lucide="loader-circle"></i> Loading days…</div>`;
        setIcons();
    }

    try {
        TP.days = await dbFetchDays(planId);

        // Auto-expand the first day
        if (TP.days.length > 0) {
            TP.openDayIds.add(TP.days[0].id);
            TP.exercises[TP.days[0].id] = await dbFetchExercisesForDay(TP.days[0].id);
        }

        renderDays();
    } catch (err) {
        console.error(err);
        if (grid) grid.innerHTML = `<p style="text-align:center;padding:24px;color:#ef4444;">Failed to load days.</p>`;
    }
}

/* ═══════════════════════════════════════
   PLAN CRUD HANDLERS
═══════════════════════════════════════ */
async function handleCreatePlan() {
    const name = await promptInput({
        title: "Create Plan",
        label: "Plan name",
        placeholder: "e.g. Strength Program",
        confirmLabel: "Create",
    });
    if (!name) return;
    try {
        const plan = await dbCreatePlan(name.trim());
        await fetchAndRenderPlans();
        await selectPlan(plan.id);
        showToast(`Plan "${plan.name}" created.`);
    } catch (err) {
        console.error(err);
        showToast("Error creating plan.");
    }
}

async function handleRenamePlan(id, currentName) {
    const name = await promptInput({
        title: "Rename Plan",
        label: "Plan name",
        placeholder: "e.g. My Plan",
        confirmLabel: "Save",
        defaultValue: currentName,
    });
    if (!name || name.trim() === currentName) return;
    try {
        await dbRenamePlan(id, name.trim());
        const plan = TP.plans.find(p => p.id === id);
        if (plan) plan.name = name.trim();
        renderPlanSelector();
        showToast("Plan renamed.");
    } catch (err) {
        console.error(err);
        showToast("Error renaming plan.");
    }
}

async function handleDeletePlan(id, name) {
    const ok = await promptConfirm(`Delete "${name}"? All training days and exercises will be removed.`);
    if (!ok) return;
    try {
        await dbDeletePlan(id);
        if (TP.selectedPlanId === id) TP.selectedPlanId = null;
        await fetchAndRenderPlans();
        showToast("Plan deleted.");
    } catch (err) {
        console.error(err);
        showToast("Error deleting plan.");
    }
}

/* ═══════════════════════════════════════
   DAY CRUD HANDLERS
═══════════════════════════════════════ */
async function handleCreateDay() {
    if (TP.days.length >= 7) {
        showToast("Maximum 7 training days per plan.");
        return;
    }
    const name = await promptInput({
        title: "Add Training Day",
        label: "Day name",
        placeholder: "e.g. Push Day, Pull Day, Legs",
        confirmLabel: "Add",
    });
    if (!name) return;
    try {
        const day = await dbCreateDay(TP.selectedPlanId, name.trim());
        TP.days.push(day);
        TP.exercises[day.id] = [];
        TP.openDayIds.add(day.id);
        renderDays();
        showToast(`"${day.name}" added.`);
    } catch (err) {
        console.error(err);
        showToast("Error adding day.");
    }
}

async function handleRenameDay(id, currentName) {
    const name = await promptInput({
        title: "Rename Day",
        label: "Day name",
        placeholder: "e.g. Push Day",
        confirmLabel: "Save",
        defaultValue: currentName,
    });
    if (!name || name.trim() === currentName) return;
    try {
        await dbRenameDay(id, name.trim());
        const day = TP.days.find(d => d.id === id);
        if (day) day.name = name.trim();
        renderDays();
        showToast("Day renamed.");
    } catch (err) {
        console.error(err);
        showToast("Error renaming day.");
    }
}

async function handleDeleteDay(id, name) {
    const ok = await promptConfirm(`Delete "${name}"? All exercises in this day will be removed.`);
    if (!ok) return;
    try {
        await dbDeleteDay(id);
        TP.days = TP.days.filter(d => d.id !== id);
        delete TP.exercises[id];
        TP.openDayIds.delete(id);
        renderDays();
        showToast("Day deleted.");
    } catch (err) {
        console.error(err);
        showToast("Error deleting day.");
    }
}

async function handleRemoveExercise(exerciseId) {
    const ok = await promptConfirm("Remove this exercise from the day?");
    if (!ok) return;
    try {
        await dbRemoveExercise(exerciseId);
        for (const dayId of Object.keys(TP.exercises)) {
            TP.exercises[dayId] = TP.exercises[dayId].filter(e => e.id !== exerciseId);
        }
        renderDays();
        showToast("Exercise removed.");
    } catch (err) {
        console.error(err);
        showToast("Error removing exercise.");
    }
}

/* ═══════════════════════════════════════
   EXERCISE CATALOG MODAL
═══════════════════════════════════════ */
async function openCatalogModal() {
    TP.selectedCatalogIds.clear();
    updateAddSelectedBtn();

    const overlay = byId("catalogModalOverlay");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Reset search
    const searchInput = byId("catalogSearchInput");
    if (searchInput) searchInput.value = "";
    TP.catalogFilter.search = "";
    TP.catalogFilter.bodyPart = "All";

    renderCatalogFilters();

    const catalogList = byId("catalogList");
    catalogList.innerHTML = `<div class="tp-spinner"><i data-lucide="loader-circle"></i> Loading catalog…</div>`;
    setIcons();

    try {
        if (TP.catalog.length === 0) {
            TP.catalog = await dbFetchCatalog();
        }
        renderCatalogList();
    } catch (err) {
        console.error(err);
        catalogList.innerHTML = `<p style="text-align:center;color:#ef4444;padding:24px;">Failed to load catalog.</p>`;
    }
}

function closeCatalogModal() {
    const overlay = byId("catalogModalOverlay");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    TP.selectedCatalogIds.clear();
    updateAddSelectedBtn();
}

function renderCatalogFilters() {
    const container = byId("catalogBodyPartFilters");
    if (!container) return;
    container.innerHTML = BODY_PARTS.map(bp => `
        <button type="button" class="tp-filter-chip ${TP.catalogFilter.bodyPart === bp ? "is-active" : ""}"
                data-body-part="${bp}">${bp}</button>
    `).join("");

    container.querySelectorAll(".tp-filter-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            TP.catalogFilter.bodyPart = chip.dataset.bodyPart;
            container.querySelectorAll(".tp-filter-chip").forEach(c =>
                c.classList.toggle("is-active", c.dataset.bodyPart === TP.catalogFilter.bodyPart)
            );
            renderCatalogList();
        });
    });
}

function getFilteredCatalog() {
    const { bodyPart, search } = TP.catalogFilter;
    const term = search.toLowerCase().trim();
    return TP.catalog.filter(ex => {
        const matchBp = bodyPart === "All" || (ex.body_part || "").toLowerCase() === bodyPart.toLowerCase();
        const matchSearch = !term || (ex.name || "").toLowerCase().includes(term);
        return matchBp && matchSearch;
    });
}

function renderCatalogList() {
    const container = byId("catalogList");
    if (!container) return;
    const filtered = getFilteredCatalog();

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="tp-empty-state">
                <div class="tp-empty-icon"><i data-lucide="search-x"></i></div>
                <h4>No exercises found</h4>
                <p>Try a different search or body part filter.</p>
            </div>`;
        setIcons();
        return;
    }

    container.innerHTML = filtered.map(ex => {
        const icon = getExerciseIcon(ex.body_part);
        const isSelected = TP.selectedCatalogIds.has(ex.id);
        const meta = [ex.body_part, ex.equipment].filter(Boolean).join(" · ");
        return `
            <div class="tp-catalog-card ${isSelected ? "is-selected" : ""}"
                 data-catalog-id="${ex.id}">
                <div class="tp-catalog-card-icon"><i data-lucide="${icon}"></i></div>
                <div class="tp-catalog-card-info">
                    <p class="tp-catalog-card-name">${escHtml(ex.name)}</p>
                    <p class="tp-catalog-card-meta">${escHtml(meta)}</p>
                </div>
                <span class="tp-catalog-card-check"><i data-lucide="check"></i></span>
            </div>`;
    }).join("");

    setIcons();

    container.querySelectorAll(".tp-catalog-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = card.dataset.catalogId;
            if (TP.selectedCatalogIds.has(id)) {
                TP.selectedCatalogIds.delete(id);
            } else {
                TP.selectedCatalogIds.add(id);
            }
            card.classList.toggle("is-selected", TP.selectedCatalogIds.has(id));
            updateAddSelectedBtn();
        });
    });
}

function updateAddSelectedBtn() {
    const btn = byId("catalogAddSelectedBtn");
    const label = byId("catalogAddBtnLabel");
    if (!btn || !label) return;
    const count = TP.selectedCatalogIds.size;
    label.textContent = count > 0 ? `Add ${count} Exercise${count > 1 ? "s" : ""}` : "Add Selected";
    btn.disabled = count === 0;
}

async function handleAddSelected() {
    if (TP.selectedCatalogIds.size === 0 || !TP.selectedDayId) return;
    const selected = TP.catalog.filter(ex => TP.selectedCatalogIds.has(ex.id));
    try {
        const added = await dbAddExercisesToDay(TP.selectedDayId, selected);
        if (!TP.exercises[TP.selectedDayId]) TP.exercises[TP.selectedDayId] = [];
        TP.exercises[TP.selectedDayId].push(...added);
        TP.openDayIds.add(TP.selectedDayId);
        closeCatalogModal();
        renderDays();
        showToast(`${added.length} exercise${added.length > 1 ? "s" : ""} added.`);
    } catch (err) {
        console.error(err);
        showToast("Error adding exercises.");
    }
}

/* ═══════════════════════════════════════
   EXERCISE DETAIL MODAL
═══════════════════════════════════════ */
async function openExerciseDetail(catalogId) {
    const overlay = byId("exerciseDetailOverlay");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Try local catalog cache first
    let ex = TP.catalog.find(e => e.id === catalogId || String(e.id) === String(catalogId));
    if (!ex) {
        try { ex = await dbFetchCatalogItem(catalogId); } catch (e) { console.error(e); }
    }
    renderExerciseDetailContent(ex);
}

function renderExerciseDetailContent(ex) {
    if (!ex) return;
    const title = byId("exerciseDetailTitle");
    const subtitle = byId("exerciseDetailSubtitle");
    const body = byId("exerciseDetailBody");
    if (title) title.textContent = ex.name || "Exercise";
    if (subtitle) subtitle.textContent = [ex.equipment, ex.body_part].filter(Boolean).join(" · ") || "Exercise detail";

    const imageHtml = ex.image_url
        ? `<img src="${escHtml(ex.image_url)}" alt="${escHtml(ex.name)}">`
        : `<div class="tp-detail-placeholder-icon"><i data-lucide="dumbbell"></i></div>`;

    body.innerHTML = `
        <div class="tp-detail-image-wrap">${imageHtml}</div>
        <div class="tp-detail-chips">
            ${ex.body_part ? `<span class="tp-detail-chip tp-chip-body"><i data-lucide="target"></i>${escHtml(ex.body_part)}</span>` : ""}
            ${ex.equipment ? `<span class="tp-detail-chip tp-chip-equipment"><i data-lucide="wrench"></i>${escHtml(ex.equipment)}</span>` : ""}
            ${ex.primary_muscles ? `<span class="tp-detail-chip tp-chip-muscle"><i data-lucide="activity"></i>${escHtml(ex.primary_muscles)}</span>` : ""}
        </div>
        ${ex.description ? `<p class="tp-detail-section-title">Description</p><p class="tp-detail-description">${escHtml(ex.description)}</p>` : ""}
        ${ex.instructions ? `<p class="tp-detail-section-title">Instructions</p><p class="tp-detail-description">${escHtml(ex.instructions)}</p>` : ""}`;

    setIcons();
}

function closeExerciseDetail() {
    byId("exerciseDetailOverlay").hidden = true;
    byId("exerciseDetailOverlay").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

/* ═══════════════════════════════════════
   EDIT EXERCISE PRESCRIPTION MODAL
═══════════════════════════════════════ */
function openEditExercise(exerciseId) {
    TP.editingExerciseId = exerciseId;

    let ex = null;
    for (const dayId of Object.keys(TP.exercises)) {
        ex = TP.exercises[dayId].find(e => e.id === exerciseId || String(e.id) === String(exerciseId));
        if (ex) break;
    }
    if (!ex) return;

    const title = byId("editExerciseTitle");
    const subtitle = byId("editExerciseSubtitle");
    if (title) title.textContent = ex.exercise_name || "Edit Exercise";
    if (subtitle) subtitle.textContent = [ex.body_part, ex.equipment].filter(Boolean).join(" · ") || "Sets · Reps · Rest";

    byId("editSets").value = ex.sets || 3;
    byId("editReps").value = ex.reps || "8-12";
    byId("editRest").value = ex.rest_seconds || 90;
    byId("editWeight").value = ex.weight || "";
    byId("editNotes").value = ex.notes || "";

    const overlay = byId("editExerciseOverlay");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeEditExercise() {
    const overlay = byId("editExerciseOverlay");
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    TP.editingExerciseId = null;
}

async function handleSaveEditExercise() {
    const id = TP.editingExerciseId;
    if (!id) return;
    const updates = {
        sets: parseInt(byId("editSets").value, 10) || 3,
        reps: byId("editReps").value.trim() || "8-12",
        rest_seconds: parseInt(byId("editRest").value, 10) || 90,
        weight: parseFloat(byId("editWeight").value) || null,
        notes: byId("editNotes").value.trim() || null,
    };
    try {
        await dbUpdateExercise(id, updates);
        for (const dayId of Object.keys(TP.exercises)) {
            const ex = TP.exercises[dayId].find(e => e.id === id || String(e.id) === String(id));
            if (ex) Object.assign(ex, updates);
        }
        closeEditExercise();
        renderDays();
        showToast("Exercise updated.");
    } catch (err) {
        console.error(err);
        showToast("Error saving changes.");
    }
}

/* ═══════════════════════════════════════
   INPUT / CONFIRM DIALOGS
═══════════════════════════════════════ */
function promptInput({ title, label, placeholder, confirmLabel, defaultValue = "" }) {
    return new Promise(resolve => {
        byId("inputDialogTitle").textContent = title;
        byId("inputDialogLabel").textContent = label;
        byId("inputDialogConfirmLabel").textContent = confirmLabel || "Confirm";
        const field = byId("inputDialogField");
        field.placeholder = placeholder || "";
        field.value = defaultValue;

        const overlay = byId("inputDialogOverlay");
        overlay.hidden = false;
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        TP.inputDialogResolve = resolve;
        setTimeout(() => field.focus(), 60);
    });
}

function resolveInputDialog(value) {
    byId("inputDialogOverlay").hidden = true;
    byId("inputDialogOverlay").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (TP.inputDialogResolve) { TP.inputDialogResolve(value); TP.inputDialogResolve = null; }
}

function promptConfirm(message) {
    return new Promise(resolve => {
        byId("confirmDialogMsg").textContent = message;
        const overlay = byId("confirmDialogOverlay");
        overlay.hidden = false;
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        TP.confirmDialogResolve = resolve;
    });
}

function resolveConfirmDialog(value) {
    byId("confirmDialogOverlay").hidden = true;
    byId("confirmDialogOverlay").setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (TP.confirmDialogResolve) { TP.confirmDialogResolve(value); TP.confirmDialogResolve = null; }
}

/* ═══════════════════════════════════════
   SHELL INTERACTIONS
═══════════════════════════════════════ */
function bindShell() {
    // Mobile drawer
    const mobileMenuBtn       = byId("mobileMenuBtn");
    const mobileDrawerClose   = byId("mobileDrawerClose");
    const mobileDrawerBackdrop= byId("mobileDrawerBackdrop");
    const sidebarCollapseBtn  = byId("sidebarCollapseBtn");

    function openDrawer() {
        const d = byId("mobileDrawer");
        if (!d) return;
        d.classList.add("is-open");
        d.setAttribute("aria-hidden", "false");
        if (mobileDrawerBackdrop) mobileDrawerBackdrop.hidden = false;
    }

    function closeDrawer() {
        const d = byId("mobileDrawer");
        if (!d) return;
        d.classList.remove("is-open");
        d.setAttribute("aria-hidden", "true");
        if (mobileDrawerBackdrop) mobileDrawerBackdrop.hidden = true;
    }

    mobileMenuBtn?.addEventListener("click", openDrawer);
    mobileDrawerClose?.addEventListener("click", closeDrawer);
    mobileDrawerBackdrop?.addEventListener("click", closeDrawer);
    sidebarCollapseBtn?.addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));

    // Catalog modal
    byId("catalogModalClose")?.addEventListener("click", closeCatalogModal);
    byId("catalogCancelBtn")?.addEventListener("click", closeCatalogModal);
    byId("catalogAddSelectedBtn")?.addEventListener("click", handleAddSelected);
    byId("catalogSearchInput")?.addEventListener("input", e => {
        TP.catalogFilter.search = e.target.value;
        renderCatalogList();
    });

    // Exercise detail modal
    byId("exerciseDetailClose")?.addEventListener("click", closeExerciseDetail);

    // Edit exercise modal
    byId("editExerciseClose")?.addEventListener("click", closeEditExercise);
    byId("editExerciseCancelBtn")?.addEventListener("click", closeEditExercise);
    byId("editExerciseSaveBtn")?.addEventListener("click", handleSaveEditExercise);

    // Input dialog
    byId("inputDialogClose")?.addEventListener("click", () => resolveInputDialog(null));
    byId("inputDialogCancelBtn")?.addEventListener("click", () => resolveInputDialog(null));
    byId("inputDialogConfirmBtn")?.addEventListener("click", () => {
        const val = byId("inputDialogField")?.value?.trim();
        resolveInputDialog(val || null);
    });
    byId("inputDialogField")?.addEventListener("keydown", e => {
        if (e.key === "Enter") { const v = byId("inputDialogField")?.value?.trim(); resolveInputDialog(v || null); }
        if (e.key === "Escape") resolveInputDialog(null);
    });

    // Confirm dialog
    byId("confirmDialogCancelBtn")?.addEventListener("click", () => resolveConfirmDialog(false));
    byId("confirmDialogOkBtn")?.addEventListener("click", () => resolveConfirmDialog(true));

    // Close modals on backdrop click
    byId("catalogModalOverlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeCatalogModal(); });
    byId("exerciseDetailOverlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeExerciseDetail(); });
    byId("editExerciseOverlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) closeEditExercise(); });
    byId("inputDialogOverlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) resolveInputDialog(null); });
    byId("confirmDialogOverlay")?.addEventListener("click", e => { if (e.target === e.currentTarget) resolveConfirmDialog(false); });

    // Desktop account dropdown
    const accountWrap = byId("desktopAccountWrap");
    const accountMenu = byId("desktopAccountMenu");
    if (accountWrap && accountMenu) {
        accountWrap.addEventListener("mouseenter", () => {
            accountMenu.classList.add("is-open");
            accountMenu.setAttribute("aria-hidden", "false");
        });
        accountWrap.addEventListener("mouseleave", () => {
            accountMenu.classList.remove("is-open");
            accountMenu.setAttribute("aria-hidden", "true");
        });
    }

    // Logout
    document.querySelectorAll("[data-action='logout']").forEach(btn => {
        btn.addEventListener("click", async () => {
            await window.supabaseClient.auth.signOut();
            window.location.href = "login.html";
        });
    });

    // Escape key
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        if (!byId("editExerciseOverlay")?.hidden)   { closeEditExercise(); return; }
        if (!byId("exerciseDetailOverlay")?.hidden)  { closeExerciseDetail(); return; }
        if (!byId("catalogModalOverlay")?.hidden)    { closeCatalogModal(); return; }
        if (!byId("inputDialogOverlay")?.hidden)     { resolveInputDialog(null); return; }
        if (!byId("confirmDialogOverlay")?.hidden)   { resolveConfirmDialog(false); return; }
    });
}

/* ═══════════════════════════════════════
   BOOTSTRAP
═══════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
    setIcons();
    init();
});
