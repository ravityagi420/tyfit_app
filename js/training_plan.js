/* ══════════════════════════════════════
   TYFIT Training Plan — Redesigned flow
   Drop this file at js/training_plan.js
═══════════════════════════════════════ */

const TP = {
  currentUserId: null,
  plans: [],
  selectedPlanId: null,
  selectedDayId: null,
  days: [],
  exercisesByDay: {},
  catalog: [],
  selectedCatalogIds: new Set(),
  catalogFilter: { bodyPart: "All", search: "" },
  inputDialogResolve: null,
  confirmDialogResolve: null,
  editingExerciseId: null,
};

const BODY_PARTS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Full Body"];

function byId(id) { return document.getElementById(id); }
function setIcons() { if (window.lucide?.createIcons) window.lucide.createIcons(); }
function escHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function showToast(msg) {
  const el = byId("appToast");
  if (!el) { console.log(msg); return; }
  el.textContent = msg;
  el.classList.add("is-show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("is-show"), 2600);
}
function titleOfPlan(plan) { return plan?.title ?? plan?.name ?? "Training Plan"; }
function nameOfDay(day) { return day?.day_name ?? day?.name ?? "Training Day"; }
function capitalize(v) { return String(v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function compact(v) { return v ? String(v).trim() : ""; }
function firstLine(v) {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}
function instructionArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(/\n+/).filter(Boolean);
}
function dayIcon(dayName) {
  const n = String(dayName || "").toLowerCase();
  if (n.includes("push") || n.includes("chest")) return "dumbbell";
  if (n.includes("pull") || n.includes("back")) return "activity";
  if (n.includes("leg")) return "footprints";
  if (n.includes("shoulder")) return "arrow-up-right";
  if (n.includes("arm")) return "dumbbell";
  if (n.includes("core") || n.includes("abs")) return "circle-dot";
  if (n.includes("rest")) return "moon";
  return "calendar-days";
}
function exerciseIcon(bodyPart) {
  const bp = String(bodyPart || "").toLowerCase();
  if (bp.includes("chest")) return "dumbbell";
  if (bp.includes("back")) return "activity";
  if (bp.includes("shoulder")) return "arrow-up-right";
  if (bp.includes("arm") || bp.includes("bicep") || bp.includes("tricep")) return "dumbbell";
  if (bp.includes("leg") || bp.includes("glute")) return "footprints";
  if (bp.includes("core")) return "circle-dot";
  return "dumbbell";
}

/* ── Auth / init ───────────────────── */
async function init() {
  try {
    let user = null;

    if (typeof window.requireLoginWithModal === "function") {
      user = await window.requireLoginWithModal();
    } else {
      const { data: { session }, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      user = session?.user || null;
    }

    if (!user) {
      return;
    }

    TP.currentUserId = user.id;
    await hydrateDesktopHeader(user);
    bindShell();
    bindStaticTrainingUI();
    await fetchAndRenderPlans();
  } catch (err) {
    console.error(err);
    showToast("Failed to load training plan.");
  }
}

async function hydrateDesktopHeader(user) {
  const nameEl = byId("desktopProfileName");
  const avatar = byId("desktopProfileAvatar");
  let profile = null;
  let about = null;

  try {
    if (window.tyfitProfile?.fetchProfile) profile = await window.tyfitProfile.fetchProfile(user.id);
    if (window.tyfitProfile?.fetchUserAbout) about = await window.tyfitProfile.fetchUserAbout(user.id);
  } catch (error) {
    console.warn("Profile header warning:", error?.message || error);
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
    || profile?.full_name
    || user.user_metadata?.full_name
    || user.user_metadata?.name
    || user.email?.split("@")[0]
    || "User";

  if (nameEl) nameEl.textContent = fullName;

  if (avatar && window.tyfitProfile?.resolveProfileImage) {
    const src = window.tyfitProfile.resolveProfileImage(profile, about);
    if (src) avatar.src = src;
  }
}

/* ── DB helpers with title/day_name first and fallback to name ───────── */
async function dbFetchPlans() {
  const { data, error } = await window.supabaseClient
    .from("training_plans")
    .select("*")
    .eq("user_id", TP.currentUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function dbCreatePlan(title) {
  let res = await window.supabaseClient
    .from("training_plans")
    .insert({ user_id: TP.currentUserId, title })
    .select()
    .single();
  if (res.error && /title/i.test(res.error.message || "")) {
    res = await window.supabaseClient.from("training_plans").insert({ user_id: TP.currentUserId, name: title }).select().single();
  }
  if (res.error) throw res.error;
  return res.data;
}
async function dbRenamePlan(id, title) {
  let res = await window.supabaseClient.from("training_plans").update({ title }).eq("id", id).eq("user_id", TP.currentUserId);
  if (res.error && /title/i.test(res.error.message || "")) {
    res = await window.supabaseClient.from("training_plans").update({ name: title }).eq("id", id).eq("user_id", TP.currentUserId);
  }
  if (res.error) throw res.error;
}
async function dbDeletePlan(id) {
  const { error } = await window.supabaseClient.from("training_plans").delete().eq("id", id).eq("user_id", TP.currentUserId);
  if (error) throw error;
}
async function dbFetchDays(planId) {
  const { data, error } = await window.supabaseClient
    .from("training_plan_days")
    .select("*")
    .eq("training_plan_id", planId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbCreateDay(planId, dayName) {
  const sortOrder = TP.days.length;
  const dayNumber = Math.min(sortOrder + 1, 7);
  let res = await window.supabaseClient
    .from("training_plan_days")
    .insert({ training_plan_id: planId, day_name: dayName, day_number: dayNumber, sort_order: sortOrder })
    .select()
    .single();
  if (res.error && /day_name/i.test(res.error.message || "")) {
    res = await window.supabaseClient.from("training_plan_days").insert({ training_plan_id: planId, name: dayName, sort_order: sortOrder }).select().single();
  }
  if (res.error) throw res.error;
  return res.data;
}
async function dbRenameDay(id, dayName) {
  let res = await window.supabaseClient.from("training_plan_days").update({ day_name: dayName }).eq("id", id);
  if (res.error && /day_name/i.test(res.error.message || "")) {
    res = await window.supabaseClient.from("training_plan_days").update({ name: dayName }).eq("id", id);
  }
  if (res.error) throw res.error;
}
async function dbDeleteDay(id) {
  const { error } = await window.supabaseClient.from("training_plan_days").delete().eq("id", id);
  if (error) throw error;
}
async function dbFetchExercisesForDay(dayId) {
  const { data, error } = await window.supabaseClient
    .from("training_day_exercises")
    .select("*")
    .eq("training_plan_day_id", dayId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbAddExercisesToDay(dayId, catalogItems) {
  const existingCount = (TP.exercisesByDay[dayId] || []).length;
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
  const { data, error } = await window.supabaseClient.from("training_day_exercises").insert(rows).select();
  if (error) throw error;
  return data || [];
}
async function dbUpdateExercise(id, updates) {
  const { error } = await window.supabaseClient.from("training_day_exercises").update(updates).eq("id", id);
  if (error) throw error;
}
async function dbRemoveExercise(id) {
  const { error } = await window.supabaseClient.from("training_day_exercises").delete().eq("id", id);
  if (error) throw error;
}
async function dbFetchCatalog() {
  const { data, error } = await window.supabaseClient.from("exercise_catalog").select("*").eq("is_active", true).order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function dbFetchCatalogItem(id) {
  const { data, error } = await window.supabaseClient.from("exercise_catalog").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

/* ── Render plan selector/main ─────── */
async function fetchAndRenderPlans() {
  TP.plans = await dbFetchPlans();
  if (TP.plans.length === 0) {
    TP.selectedPlanId = null;
    TP.days = [];
    renderPlanSelector();
    renderMainContent();
    return;
  }
  const keep = TP.selectedPlanId && TP.plans.some(p => p.id === TP.selectedPlanId) ? TP.selectedPlanId : TP.plans[0].id;
  await selectPlan(keep);
}
function renderPlanSelector() {
  const strip = byId("planStrip");
  if (!strip) return;
  const html = TP.plans.map((plan, idx) => {
    const active = plan.id === TP.selectedPlanId;
    const days = plan.day_count ?? "";
    const label = active ? "Current" : days ? `${days} days` : idx === 0 ? "Current" : "Plan";
    return `<button type="button" class="tp-plan-card ${active ? "is-active" : ""}" data-plan-id="${plan.id}">
      <i data-lucide="calendar-days"></i>
      <strong>${escHtml(titleOfPlan(plan))}</strong>
      <span>${escHtml(label)}</span>
    </button>`;
  }).join("");
  strip.innerHTML = html + `<button type="button" class="tp-plan-card tp-plan-create" id="addPlanBtn"><i data-lucide="plus"></i><strong>New Plan</strong></button>`;
  setIcons();
  strip.querySelectorAll(".tp-plan-card[data-plan-id]").forEach(card => card.addEventListener("click", () => selectPlan(card.dataset.planId)));
  byId("addPlanBtn")?.addEventListener("click", handleCreatePlan);
}
async function selectPlan(planId) {
  TP.selectedPlanId = planId;
  TP.selectedDayId = null;
  TP.days = [];
  TP.exercisesByDay = {};
  renderPlanSelector();
  renderMainContent(true);
  TP.days = await dbFetchDays(planId);
  await Promise.all(TP.days.map(async d => { TP.exercisesByDay[d.id] = await dbFetchExercisesForDay(d.id); }));
  renderPlanSelector();
  renderMainContent(false);
}
function renderMainContent(loading = false) {
  showMainScreen();
  const el = byId("planContent");
  if (!el) return;
  if (loading) { el.innerHTML = `<div class="tp-spinner"><i data-lucide="loader-circle"></i> Loading days…</div>`; setIcons(); return; }
  if (!TP.selectedPlanId || TP.plans.length === 0) {
    el.innerHTML = `<div class="tp-empty-state"><div class="tp-empty-icon"><i data-lucide="dumbbell"></i></div><h4>No training plan yet</h4><p>Create your first workout routine and add up to seven training days.</p><button class="tp-btn tp-btn-primary" id="emptyCreatePlanBtn"><i data-lucide="plus"></i>Create Plan</button></div>`;
    setIcons(); byId("emptyCreatePlanBtn")?.addEventListener("click", handleCreatePlan); return;
  }
  el.innerHTML = `<div class="tp-section-row"><h3>Your Days</h3><span>${TP.days.length}/7 Days</span></div><div class="tp-days-grid" id="daysGrid"></div><button type="button" class="tp-add-day-card" id="addDayBtn"><i data-lucide="plus"></i>Add Day</button>`;
  renderDaysList();
  byId("addDayBtn")?.addEventListener("click", handleCreateDay);
  if (TP.days.length >= 7) byId("addDayBtn")?.setAttribute("disabled", "disabled");
}
function renderDaysList() {
  const grid = byId("daysGrid");
  if (!grid) return;
  if (TP.days.length === 0) {
    grid.innerHTML = `<div class="tp-empty-state"><div class="tp-empty-icon"><i data-lucide="calendar-plus"></i></div><h4>No training days yet</h4><p>Add Push Day, Pull Day, Legs or any custom training day.</p></div>`;
    setIcons(); return;
  }
  grid.innerHTML = TP.days.map(day => {
    const count = (TP.exercisesByDay[day.id] || []).length;
    return `<article class="tp-day-row" data-day-id="${day.id}">
      <div class="tp-day-icon"><i data-lucide="${dayIcon(nameOfDay(day))}"></i></div>
      <div class="tp-day-row-main" data-action="open-day" data-day-id="${day.id}">
        <p class="tp-day-title">${escHtml(nameOfDay(day))}</p>
        <p class="tp-day-sub">${count} exercise${count === 1 ? "" : "s"}</p>
      </div>
      <div class="tp-day-menu">
        <button class="tp-icon-action" data-action="rename-day" data-day-id="${day.id}" aria-label="Rename day"><i data-lucide="pencil-line"></i></button>
        <button class="tp-icon-action tp-danger" data-action="delete-day" data-day-id="${day.id}" aria-label="Delete day"><i data-lucide="trash-2"></i></button>
      </div>
      <i data-lucide="chevron-right" class="tp-day-chevron"></i>
    </article>`;
  }).join("");
  setIcons();
  grid.querySelectorAll("[data-action='open-day']").forEach(x => x.addEventListener("click", () => openDayDetail(x.dataset.dayId)));
  grid.querySelectorAll("[data-action='rename-day']").forEach(x => x.addEventListener("click", e => { e.stopPropagation(); handleRenameDay(x.dataset.dayId); }));
  grid.querySelectorAll("[data-action='delete-day']").forEach(x => x.addEventListener("click", e => { e.stopPropagation(); handleDeleteDay(x.dataset.dayId); }));
}

/* ── Day detail ────────────────────── */
function showMainScreen() { byId("trainingMainScreen")?.removeAttribute("hidden"); byId("trainingMainScreen")?.classList.add("is-active"); byId("trainingDayScreen")?.setAttribute("hidden", "hidden"); }
function showDayScreen() { byId("trainingMainScreen")?.setAttribute("hidden", "hidden"); byId("trainingDayScreen")?.removeAttribute("hidden"); byId("trainingDayScreen")?.classList.add("is-active"); }
function openDayDetail(dayId) { TP.selectedDayId = dayId; showDayScreen(); renderDayDetail(); window.scrollTo({ top: 0, behavior: "smooth" }); }
function currentDay() { return TP.days.find(d => d.id === TP.selectedDayId); }
function renderDayDetail() {
  const day = currentDay(); if (!day) return showMainScreen();
  const dayName = nameOfDay(day); const exercises = TP.exercisesByDay[day.id] || [];
  byId("dayDetailTopTitle").textContent = dayName;
  byId("dayExerciseCount").textContent = `${exercises.length} Exercise${exercises.length === 1 ? "" : "s"}`;
  byId("daySummaryCard").innerHTML = `<div class="tp-day-icon"><i data-lucide="${dayIcon(dayName)}"></i></div><div><h3>${escHtml(dayName)}</h3><p>${escHtml(day.notes || `Focus on your ${dayName.toLowerCase()} routine.`)}</p></div><button type="button" class="tp-edit-day-btn" id="summaryEditDayBtn">Edit Day</button>`;
  renderDayExercises();
  setIcons();
  byId("summaryEditDayBtn")?.addEventListener("click", () => handleRenameDay(day.id));
}
function renderDayExercises() {
  const list = byId("dayExerciseList"); const day = currentDay(); if (!list || !day) return;
  const exercises = TP.exercisesByDay[day.id] || [];
  if (!exercises.length) {
    list.innerHTML = `<div class="tp-empty-state"><div class="tp-empty-icon"><i data-lucide="activity"></i></div><h4>No exercises added</h4><p>Add exercises from your catalog to build this day.</p></div>`;
    setIcons(); return;
  }
  list.innerHTML = exercises.map(ex => {
    const meta = `${ex.sets || 3} sets • ${escHtml(ex.reps || "8-12")} reps • ${ex.rest_seconds || 90}s rest`;
    return `<article class="tp-exercise-row" data-exercise-id="${ex.id}" data-catalog-id="${ex.exercise_catalog_id || ""}">
      <div>
        <p class="tp-exercise-name">${escHtml(ex.exercise_name)}</p>
        <p class="tp-exercise-meta">${meta}</p>
        <div class="tp-exercise-subactions">
          <button class="tp-text-action" data-action="edit-exercise" data-exercise-id="${ex.id}"><i data-lucide="pencil-line"></i>Edit</button>
          <button class="tp-text-action tp-danger" data-action="remove-exercise" data-exercise-id="${ex.id}"><i data-lucide="trash-2"></i>Delete</button>
        </div>
      </div>
      <div class="tp-exercise-actions"><span class="tp-prescription-chip">${escHtml(ex.body_part || "Exercise")}</span><div class="tp-exercise-menu"><button class="tp-icon-action" data-action="exercise-detail" data-catalog-id="${ex.exercise_catalog_id || ""}"><i data-lucide="ellipsis-vertical"></i></button></div></div>
    </article>`;
  }).join("");
  setIcons();
  list.querySelectorAll("[data-action='edit-exercise']").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); openEditExercise(b.dataset.exerciseId); }));
  list.querySelectorAll("[data-action='remove-exercise']").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); handleRemoveExercise(b.dataset.exerciseId); }));
  list.querySelectorAll(".tp-exercise-row").forEach(card => card.addEventListener("click", e => { if (e.target.closest("[data-action]")) return; if (card.dataset.catalogId) openExerciseDetail(card.dataset.catalogId); }));
  list.querySelectorAll("[data-action='exercise-detail']").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); if (b.dataset.catalogId) openExerciseDetail(b.dataset.catalogId); }));
}

/* ── CRUD handlers ─────────────────── */
async function handleCreatePlan() {
  const title = await promptInput({ title: "Create Plan", label: "Plan name", placeholder: "e.g. Strength Plan", confirmLabel: "Create" });
  if (!compact(title)) return;
  try { const p = await dbCreatePlan(compact(title)); await fetchAndRenderPlans(); await selectPlan(p.id); showToast("Plan created."); } catch (e) { console.error(e); showToast("Error creating plan."); }
}
async function handleRenamePlan() {
  const plan = TP.plans.find(p => p.id === TP.selectedPlanId); if (!plan) return;
  const title = await promptInput({ title: "Rename Plan", label: "Plan name", defaultValue: titleOfPlan(plan), confirmLabel: "Save" });
  if (!compact(title)) return;
  try { await dbRenamePlan(plan.id, compact(title)); await fetchAndRenderPlans(); showToast("Plan renamed."); } catch(e) { console.error(e); showToast("Error renaming plan."); }
}
async function handleDeletePlan() {
  const plan = TP.plans.find(p => p.id === TP.selectedPlanId); if (!plan) return;
  const ok = await promptConfirm(`Delete "${titleOfPlan(plan)}"? All days and exercises will be removed.`, "Delete Plan");
  if (!ok) return;
  try { await dbDeletePlan(plan.id); TP.selectedPlanId = null; await fetchAndRenderPlans(); showToast("Plan deleted."); } catch(e) { console.error(e); showToast("Error deleting plan."); }
}
async function handleCreateDay() {
  if (!TP.selectedPlanId) return handleCreatePlan();
  if (TP.days.length >= 7) return showToast("Maximum 7 days per plan.");
  const name = await promptInput({ title: "Add Training Day", label: "Day name", placeholder: "e.g. Push Day", confirmLabel: "Add" });
  if (!compact(name)) return;
  try { const d = await dbCreateDay(TP.selectedPlanId, compact(name)); TP.days.push(d); TP.exercisesByDay[d.id] = []; renderMainContent(); showToast("Training day added."); } catch(e) { console.error(e); showToast("Error adding day."); }
}
async function handleRenameDay(dayId = TP.selectedDayId) {
  const day = TP.days.find(d => d.id === dayId); if (!day) return;
  const name = await promptInput({ title: "Rename Day", label: "Day name", defaultValue: nameOfDay(day), confirmLabel: "Save" });
  if (!compact(name)) return;
  try { await dbRenameDay(day.id, compact(name)); if (day.day_name !== undefined) day.day_name = compact(name); else day.name = compact(name); renderMainContent(); if (TP.selectedDayId === day.id) renderDayDetail(); showToast("Day renamed."); } catch(e) { console.error(e); showToast("Error renaming day."); }
}
async function handleDeleteDay(dayId = TP.selectedDayId) {
  const day = TP.days.find(d => d.id === dayId); if (!day) return;
  const ok = await promptConfirm(`Delete "${nameOfDay(day)}"? Exercises in this day will be removed.`, "Delete Day");
  if (!ok) return;
  try { await dbDeleteDay(day.id); TP.days = TP.days.filter(d => d.id !== day.id); delete TP.exercisesByDay[day.id]; if (TP.selectedDayId === day.id) showMainScreen(); renderMainContent(); showToast("Day deleted."); } catch(e) { console.error(e); showToast("Error deleting day."); }
}
async function handleRemoveExercise(id) {
  const ok = await promptConfirm("Remove this exercise from the day?", "Remove Exercise"); if (!ok) return;
  try { await dbRemoveExercise(id); const dayId = TP.selectedDayId; TP.exercisesByDay[dayId] = (TP.exercisesByDay[dayId] || []).filter(e => e.id !== id); renderDayDetail(); showToast("Exercise removed."); } catch(e) { console.error(e); showToast("Error removing exercise."); }
}

/* ── Catalog modal ─────────────────── */
async function openCatalogModal() {
  if (!TP.selectedDayId) return showToast("Select a training day first.");
  TP.selectedCatalogIds.clear();
  TP.catalogFilter = { bodyPart: "All", search: "" };
  byId("catalogSearchInput").value = "";
  openModal("catalogModalOverlay");
  renderCatalogFilters();
  byId("catalogList").innerHTML = `<div class="tp-spinner"><i data-lucide="loader-circle"></i> Loading exercises…</div>`;
  setIcons();
  try { if (TP.catalog.length === 0) TP.catalog = await dbFetchCatalog(); renderCatalogList(); } catch(e) { console.error(e); byId("catalogList").innerHTML = `<div class="tp-empty-state"><h4>Could not load catalog</h4><p>Please try again.</p></div>`; }
}
function closeCatalogModal() { closeModal("catalogModalOverlay"); TP.selectedCatalogIds.clear(); updateAddSelectedBtn(); }
function renderCatalogFilters() {
  const el = byId("catalogBodyPartFilters"); if (!el) return;
  el.innerHTML = BODY_PARTS.map(bp => `<button class="tp-filter-chip ${TP.catalogFilter.bodyPart === bp ? "is-active" : ""}" data-bp="${bp}">${bp}</button>`).join("");
  el.querySelectorAll(".tp-filter-chip").forEach(ch => ch.addEventListener("click", () => { TP.catalogFilter.bodyPart = ch.dataset.bp; renderCatalogFilters(); renderCatalogList(); }));
}
function normalizedBodyPart(bp) { const v = String(bp || "").toLowerCase(); if (["biceps","triceps","forearms"].includes(v)) return "arms"; if (["glutes"].includes(v)) return "legs"; return v; }
function getFilteredCatalog() {
  const term = TP.catalogFilter.search.trim().toLowerCase();
  return TP.catalog.filter(ex => {
    const matchSearch = !term || String(ex.name || "").toLowerCase().includes(term);
    const selected = TP.catalogFilter.bodyPart.toLowerCase();
    const matchBp = selected === "all" || normalizedBodyPart(ex.body_part) === selected || String(ex.target_muscle || "").toLowerCase() === selected;
    return matchSearch && matchBp;
  });
}
function renderCatalogList() {
  const el = byId("catalogList"); if (!el) return;
  const rows = getFilteredCatalog();
  if (rows.length === 0) { el.innerHTML = `<div class="tp-empty-state"><div class="tp-empty-icon"><i data-lucide="search-x"></i></div><h4>No exercises found</h4><p>Try another search or filter.</p></div>`; setIcons(); return; }
  el.innerHTML = `<div class="tp-catalog-list-head"><strong>Exercises (${rows.length})</strong><button class="tp-catalog-clear" id="catalogClearBtn">Clear</button></div>` + rows.slice(0, 250).map(ex => {
    const selected = TP.selectedCatalogIds.has(ex.id);
    const meta = [capitalize(ex.body_part), ex.equipment].filter(Boolean).join(" • ");
    return `<div class="tp-catalog-card ${selected ? "is-selected" : ""}" data-id="${ex.id}">
      <div class="tp-catalog-card-icon"><i data-lucide="${exerciseIcon(ex.body_part)}"></i></div>
      <div class="tp-catalog-card-info"><p class="tp-catalog-card-name">${escHtml(ex.name)}</p><p class="tp-catalog-card-meta">${escHtml(meta)}</p></div>
      <span class="tp-catalog-card-check"><i data-lucide="check"></i></span>
    </div>`;
  }).join("");
  setIcons();
  byId("catalogClearBtn")?.addEventListener("click", () => { TP.selectedCatalogIds.clear(); renderCatalogList(); updateAddSelectedBtn(); });
  el.querySelectorAll(".tp-catalog-card").forEach(card => card.addEventListener("click", () => { const id = card.dataset.id; TP.selectedCatalogIds.has(id) ? TP.selectedCatalogIds.delete(id) : TP.selectedCatalogIds.add(id); card.classList.toggle("is-selected", TP.selectedCatalogIds.has(id)); updateAddSelectedBtn(); }));
  updateAddSelectedBtn();
}
function updateAddSelectedBtn() {
  const count = TP.selectedCatalogIds.size;
  const btn = byId("catalogAddSelectedBtn"); const label = byId("catalogAddBtnLabel");
  if (!btn || !label) return;
  btn.disabled = count === 0;
  label.textContent = count ? `Add Selected (${count})` : "Add Selected";
}
async function handleAddSelected() {
  if (!TP.selectedDayId || TP.selectedCatalogIds.size === 0) return;
  const selected = TP.catalog.filter(ex => TP.selectedCatalogIds.has(ex.id));
  try { const added = await dbAddExercisesToDay(TP.selectedDayId, selected); TP.exercisesByDay[TP.selectedDayId] = [...(TP.exercisesByDay[TP.selectedDayId] || []), ...added]; closeCatalogModal(); renderDayDetail(); showToast(`${added.length} exercise${added.length === 1 ? "" : "s"} added.`); } catch(e) { console.error(e); showToast("Error adding exercises."); }
}

/* ── Exercise detail ───────────────── */
async function openExerciseDetail(catalogId) {
  openModal("exerciseDetailOverlay");
  let ex = TP.catalog.find(x => String(x.id) === String(catalogId));
  if (!ex) { try { ex = await dbFetchCatalogItem(catalogId); } catch(e) { console.error(e); } }
  renderExerciseDetailContent(ex);
}
function renderExerciseDetailContent(ex) {
  if (!ex) return;
  byId("exerciseDetailTitle").textContent = ex.name || "Exercise";
  byId("exerciseDetailSubtitle").textContent = [capitalize(ex.body_part), ex.equipment].filter(Boolean).join(" · ") || "Exercise detail";
  const instructions = instructionArray(ex.instructions);
  const imageHtml = ex.image_url ? `<img src="${escHtml(ex.image_url)}" alt="${escHtml(ex.name)}">` : `<div class="tp-detail-placeholder-icon"><i data-lucide="dumbbell"></i></div>`;
  byId("exerciseDetailBody").innerHTML = `<div class="tp-detail-image-wrap">${imageHtml}</div><div class="tp-detail-facts"><div class="tp-detail-fact"><i data-lucide="target"></i><div><span>Primary Muscle</span><strong>${escHtml(capitalize(ex.target_muscle || ex.body_part || "Exercise"))}</strong></div></div><div class="tp-detail-fact"><i data-lucide="dumbbell"></i><div><span>Equipment</span><strong>${escHtml(ex.equipment || "Any")}</strong></div></div><div class="tp-detail-fact"><i data-lucide="activity"></i><div><span>Body Part</span><strong>${escHtml(capitalize(ex.body_part || "Full Body"))}</strong></div></div></div><h3 class="tp-detail-section-title">Instructions</h3><div class="tp-instruction-list">${instructions.length ? instructions.map((s,i) => `<div class="tp-instruction-step"><span class="tp-instruction-num">${i+1}</span><p>${escHtml(s)}</p></div>`).join("") : `<p style="margin:0;color:#667085;">No instructions available yet.</p>`}</div>`;
  setIcons();
}
function closeExerciseDetail() { closeModal("exerciseDetailOverlay"); }

/* ── Edit exercise ─────────────────── */
function openEditExercise(id) {
  const ex = Object.values(TP.exercisesByDay).flat().find(e => e.id === id); if (!ex) return;
  TP.editingExerciseId = id;
  byId("editExerciseTitle").textContent = ex.exercise_name || "Edit Exercise";
  byId("editExerciseSubtitle").textContent = "Sets · Reps · Rest";
  byId("editExerciseId").value = id;
  byId("editSets").value = ex.sets || 3;
  byId("editReps").value = ex.reps || "8-12";
  byId("editRest").value = ex.rest_seconds || 90;
  byId("editWeight").value = ex.weight || "";
  byId("editNotes").value = ex.notes || "";
  openModal("editExerciseOverlay");
}
function closeEditExercise() { closeModal("editExerciseOverlay"); TP.editingExerciseId = null; }
async function saveExerciseEdit() {
  const id = TP.editingExerciseId; if (!id) return;
  const updates = { sets: Number(byId("editSets").value || 3), reps: byId("editReps").value || "8-12", rest_seconds: Number(byId("editRest").value || 90), weight: byId("editWeight").value ? Number(byId("editWeight").value) : null, notes: byId("editNotes").value || null };
  try { await dbUpdateExercise(id, updates); const list = TP.exercisesByDay[TP.selectedDayId] || []; const item = list.find(e => e.id === id); if (item) Object.assign(item, updates); closeEditExercise(); renderDayDetail(); showToast("Exercise updated."); } catch(e) { console.error(e); showToast("Error saving exercise."); }
}

/* ── Generic modals/input/confirm ───── */
function openModal(id) { const o = byId(id); if (!o) return; o.hidden = false; o.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; setIcons(); }
function closeModal(id) { const o = byId(id); if (!o) return; o.hidden = true; o.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
function promptInput({ title, label, placeholder = "", defaultValue = "", confirmLabel = "Save" }) {
  return new Promise(resolve => {
    TP.inputDialogResolve = resolve;
    byId("inputDialogTitle").textContent = title;
    byId("inputDialogLabel").textContent = label;
    byId("inputDialogField").placeholder = placeholder;
    byId("inputDialogField").value = defaultValue;
    byId("inputDialogConfirmLabel").textContent = confirmLabel;
    openModal("inputDialogOverlay");
    setTimeout(() => byId("inputDialogField")?.focus(), 80);
  });
}
function closeInputDialog(value = null) { closeModal("inputDialogOverlay"); const r = TP.inputDialogResolve; TP.inputDialogResolve = null; if (r) r(value); }
function promptConfirm(message, title = "Confirm") {
  return new Promise(resolve => { TP.confirmDialogResolve = resolve; byId("confirmDialogTitle").textContent = title; byId("confirmDialogMsg").textContent = message; openModal("confirmDialogOverlay"); });
}
function closeConfirmDialog(value = false) { closeModal("confirmDialogOverlay"); const r = TP.confirmDialogResolve; TP.confirmDialogResolve = null; if (r) r(value); }

/* ── Shell + events ────────────────── */
function bindStaticTrainingUI() {
  byId("backToPlansBtn")?.addEventListener("click", () => { TP.selectedDayId = null; showMainScreen(); renderMainContent(); });
  byId("detailAddExerciseBtn")?.addEventListener("click", openCatalogModal);
  byId("mainMoreBtn")?.addEventListener("click", async () => { if (!TP.selectedPlanId) return handleCreatePlan(); const action = await promptInput({ title: "Plan Options", label: "Type rename or delete", placeholder: "rename", confirmLabel: "Continue" }); if (String(action).toLowerCase().startsWith("del")) await handleDeletePlan(); else if (action) await handleRenamePlan(); });
  byId("dayDetailMenuBtn")?.addEventListener("click", async () => { const action = await promptInput({ title: "Day Options", label: "Type rename or delete", placeholder: "rename", confirmLabel: "Continue" }); if (String(action).toLowerCase().startsWith("del")) await handleDeleteDay(); else if (action) await handleRenameDay(); });
  byId("catalogModalClose")?.addEventListener("click", closeCatalogModal);
  byId("catalogCancelBtn")?.addEventListener("click", closeCatalogModal);
  byId("catalogAddSelectedBtn")?.addEventListener("click", handleAddSelected);
  byId("catalogSearchInput")?.addEventListener("input", e => { TP.catalogFilter.search = e.target.value; renderCatalogList(); });
  byId("exerciseDetailClose")?.addEventListener("click", closeExerciseDetail);
  byId("editExerciseClose")?.addEventListener("click", closeEditExercise);
  byId("editExerciseCancelBtn")?.addEventListener("click", closeEditExercise);
  byId("editExerciseSaveBtn")?.addEventListener("click", saveExerciseEdit);
  byId("inputDialogClose")?.addEventListener("click", () => closeInputDialog(null));
  byId("inputDialogCancelBtn")?.addEventListener("click", () => closeInputDialog(null));
  byId("inputDialogConfirmBtn")?.addEventListener("click", () => closeInputDialog(compact(byId("inputDialogField")?.value)));
  byId("inputDialogField")?.addEventListener("keydown", e => { if (e.key === "Enter") closeInputDialog(compact(e.target.value)); });
  byId("confirmDialogCancelBtn")?.addEventListener("click", () => closeConfirmDialog(false));
  byId("confirmDialogOkBtn")?.addEventListener("click", () => closeConfirmDialog(true));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { ["catalogModalOverlay", "exerciseDetailOverlay", "editExerciseOverlay", "inputDialogOverlay", "confirmDialogOverlay"].forEach(closeModal); } });
}
function bindShell() {
  byId("mobileMenuBtn")?.addEventListener("click", () => { byId("mobileDrawer")?.classList.add("is-open"); byId("mobileDrawer")?.setAttribute("aria-hidden", "false"); const b = byId("mobileDrawerBackdrop"); if (b) b.hidden = false; document.body.style.overflow = "hidden"; });
  const closeDrawer = () => { byId("mobileDrawer")?.classList.remove("is-open"); byId("mobileDrawer")?.setAttribute("aria-hidden", "true"); const b = byId("mobileDrawerBackdrop"); if (b) b.hidden = true; document.body.style.overflow = ""; };
  byId("mobileDrawerClose")?.addEventListener("click", closeDrawer);
  byId("mobileDrawerBackdrop")?.addEventListener("click", closeDrawer);
  byId("sidebarCollapseBtn")?.addEventListener("click", () => byId("tyfitLayout")?.classList.toggle("sidebar-collapsed"));
  setIcons();
}

document.addEventListener("DOMContentLoaded", init);
