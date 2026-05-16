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
  dayMenuOutsideBound: false,
  daySwipeBound: false,
  dayDetailMenuOutsideBound: false,
  exerciseMenuOutsideBound: false,
  planActionMenuOutsideBound: false,
  exerciseSwipeBound: false,
  exerciseSwipeSuppressUntil: 0,
  historyBound: false,
};

const BODY_PARTS = ["All", "Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Full Body"];
const MAX_TRAINING_PLANS = 3;
const TP_HISTORY_MARKER = "training-plan";
const TRAINING_PLAN_ICONS = ["sport-shoe", "square-activity", "biceps-flexed"];
const EXERCISE_ICON_BASE_PATH = "assets/exercise-icons";
const EXERCISE_ICON_FALLBACK_PATH = `${EXERCISE_ICON_BASE_PATH}/push-ups.svg`;
const EXERCISE_CARD_ACCENTS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#14b8a6", "#ec4899"];
const CATALOG_THEME_MAP = {
  all: { icon: "sparkles", color: "#64748b" },
  chest: { icon: "heart", color: "#3b82f6" },
  back: { icon: "mountain", color: "#0ea5e9" },
  shoulders: { icon: "dumbbell", color: "#8b5cf6" },
  arms: { icon: "dumbbell", color: "#f97316" },
  legs: { icon: "footprints", color: "#22c55e" },
  core: { icon: "circle-dot", color: "#16a34a" },
  "full body": { icon: "person-standing", color: "#e11d48" },
  bodyweight: { icon: "person-standing", color: "#14b8a6" },
  barbell: { icon: "dumbbell", color: "#f59e0b" },
  dumbbell: { icon: "dumbbell", color: "#3b82f6" },
  kettlebell: { icon: "disc-3", color: "#6366f1" },
  cable: { icon: "link", color: "#10b981" },
  machine: { icon: "cpu", color: "#ef4444" },
  bands: { icon: "waveform", color: "#14b8a6" },
  band: { icon: "waveform", color: "#14b8a6" },
  cardio: { icon: "heart-pulse", color: "#f43f5e" },
};

function byId(id) { return document.getElementById(id); }
function setIcons() {
  if (typeof window.tyfitRefreshIcons === "function") {
    window.tyfitRefreshIcons();
    return;
  }
  if (window.lucide?.createIcons) window.lucide.createIcons();
}
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
function toTitleCaseWords(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}
function titleOfPlan(plan) { return toTitleCaseWords(plan?.title ?? plan?.name) || "Training Plan"; }
function nameOfDay(day) { return toTitleCaseWords(day?.day_name ?? day?.name) || "Training Day"; }
function capitalize(v) { return String(v || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function compact(v) { return v ? String(v).trim() : ""; }
function firstLine(v) {
  if (Array.isArray(v)) return v[0] || "";
  return v || "";
}
function instructionArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;

  const value = String(v).trim();
  if (!value) return [];

  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item ?? "").trim())
          .filter(Boolean);
      }
    } catch (_error) {
      // Fallback below handles non-JSON instruction strings.
    }
  }

  return value
    .split(/\n+|\s*\|\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}
function hashText(value) {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
function slugifyExerciseName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function getExerciseIconPath(exerciseName) {
  const slug = slugifyExerciseName(exerciseName);
  if (!slug) return EXERCISE_ICON_FALLBACK_PATH;
  return `${EXERCISE_ICON_BASE_PATH}/${slug}.svg`;
}
function getExerciseAccent(exerciseName, index = 0) {
  const mixedSeed = `${exerciseName || "exercise"}:${index}`;
  const paletteIndex = hashText(mixedSeed) % EXERCISE_CARD_ACCENTS.length;
  return EXERCISE_CARD_ACCENTS[paletteIndex];
}
function normalizeCatalogTag(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function getCatalogTagTheme(value) {
  const normalized = normalizeCatalogTag(value);
  if (CATALOG_THEME_MAP[normalized]) return CATALOG_THEME_MAP[normalized];

  const tokens = normalized.split(" ").filter(Boolean);
  for (const token of tokens) {
    if (CATALOG_THEME_MAP[token]) return CATALOG_THEME_MAP[token];
  }

  const fallbackPalette = ["#0ea5e9", "#22c55e", "#f97316", "#8b5cf6", "#e11d48", "#14b8a6"];
  return {
    icon: "tag",
    color: fallbackPalette[hashText(normalized || "tag") % fallbackPalette.length],
  };
}
function renderCatalogMetaPills(exercise) {
  const labels = [capitalize(exercise.body_part), capitalize(exercise.equipment)].filter(Boolean);
  if (!labels.length) return "";

  return labels.map((label) => {
    const theme = getCatalogTagTheme(label);
    const soft = hexToRgba(theme.color, 0.14);
    const line = hexToRgba(theme.color, 0.28);
    return `<span class="tp-catalog-meta-pill" style="--tp-pill-accent:${theme.color};--tp-pill-soft:${soft};--tp-pill-line:${line};"><i data-lucide="${theme.icon}"></i>${escHtml(label)}</span>`;
  }).join("");
}
function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").replace("#", "");
  if (![3, 6].includes(normalized.length)) return `rgba(59, 130, 246, ${alpha})`;
  const full = normalized.length === 3
    ? normalized.split("").map((x) => `${x}${x}`).join("")
    : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function getTrainingPlanAccent(index) {
  const accents = ["#22c55e", "#f59e0b", "#3b82f6"];
  return accents[index % accents.length];
}
function getTrainingDayAccent(index) {
  const accents = ["#22c55e", "#f59e0b", "#3b82f6", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444"];
  return accents[index % accents.length];
}
function formatPlanCreatedLabel(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
  if (isToday) return "Today";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function getAddDayCardMarkup() {
  if (TP.days.length >= 7) return "";
  const variant = TP.days.length === 0
    ? "is-empty-state"
    : "is-center-row";

  return `<button type="button" class="tp-add-day-card ${variant}" id="addDayBtn"><i data-lucide="plus"></i>Add Day</button>`;
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
    bindTrainingHistory();
    applyHistoryState();
  } catch (err) {
    console.error(err);
    showToast("Failed to load training plan.");
  }
}

function ensureHistoryMainState() {
  const current = window.history.state || {};
  if (current.tpPage === TP_HISTORY_MARKER && current.tpScreen === "main") return;
  window.history.replaceState({ ...current, tpPage: TP_HISTORY_MARKER, tpScreen: "main", dayId: null }, "");
}

function pushHistoryDayState(dayId) {
  const current = window.history.state || {};
  if (current.tpPage === TP_HISTORY_MARKER && current.tpScreen === "day" && String(current.dayId) === String(dayId)) return;
  window.history.pushState({ ...current, tpPage: TP_HISTORY_MARKER, tpScreen: "day", dayId: String(dayId) }, "");
}

function applyHistoryState() {
  const state = window.history.state || {};
  if (state.tpPage === TP_HISTORY_MARKER && state.tpScreen === "day" && state.dayId) {
    const exists = TP.days.some((day) => String(day.id) === String(state.dayId));
    if (exists) {
      openDayDetail(state.dayId, { pushHistory: false, scroll: false });
      return;
    }
  }
  TP.selectedDayId = null;
  showMainScreen();
}

function bindTrainingHistory() {
  if (TP.historyBound) return;
  TP.historyBound = true;
  ensureHistoryMainState();

  window.addEventListener("popstate", () => {
    const state = window.history.state || {};
    if (state.tpPage === TP_HISTORY_MARKER && state.tpScreen === "day" && state.dayId) {
      const exists = TP.days.some((day) => String(day.id) === String(state.dayId));
      if (exists) {
        openDayDetail(state.dayId, { pushHistory: false, scroll: false });
        return;
      }
    }

    TP.selectedDayId = null;
    showMainScreen();
    renderMainContent();
    ensureHistoryMainState();
  });
}

function goBackToTrainingMain() {
  if (!TP.selectedDayId) return;

  const current = window.history.state || {};
  if (current.tpPage === TP_HISTORY_MARKER && current.tpScreen === "day") {
    window.history.back();
    return;
  }

  TP.selectedDayId = null;
  showMainScreen();
  renderMainContent();
  ensureHistoryMainState();
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
    const createdLabel = formatPlanCreatedLabel(plan.created_at);
    const iconName = TRAINING_PLAN_ICONS[idx % TRAINING_PLAN_ICONS.length];
    const accent = getTrainingPlanAccent(idx);
    const accentSoft = hexToRgba(accent, 0.1);
    const accentLine = hexToRgba(accent, 0.24);

    return `<div class="tp-plan-card-wrap"><button type="button" class="tp-plan-card ${active ? "is-active" : ""}" data-plan-id="${plan.id}" style="--diet-accent:${accent};--diet-accent-soft:${accentSoft};--diet-accent-line:${accentLine};">
      <span class="diet-plan-icon" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
      <strong title="${escHtml(titleOfPlan(plan))}">${escHtml(titleOfPlan(plan))}</strong>
      <span class="diet-plan-meta">${createdLabel ? `<small class="diet-plan-date"><i data-lucide="calendar-days" class="diet-plan-date-icon"></i>${escHtml(createdLabel)}</small>` : ""}</span>
    </button>
    <button type="button" class="tp-plan-card-menu-btn js-plan-card-menu-btn" data-plan-id="${plan.id}" aria-label="Plan options">
      <i data-lucide="ellipsis-vertical"></i>
    </button>
    <div class="tp-plan-card-menu" hidden data-menu-plan-id="${plan.id}">
      <button type="button" class="tp-plan-card-menu-item" data-card-action="rename-plan" data-plan-id="${plan.id}">
        <i data-lucide="pencil-line"></i> Rename
      </button>
      <button type="button" class="tp-plan-card-menu-item danger" data-card-action="delete-plan" data-plan-id="${plan.id}">
        <i data-lucide="trash-2"></i> Delete
      </button>
    </div></div>`;
  }).join("");

  const showCreateButton = TP.plans.length < MAX_TRAINING_PLANS;
  const createAccent = getTrainingPlanAccent(TP.plans.length);
  const createAccentSoft = hexToRgba(createAccent, 0.1);
  const createAccentLine = hexToRgba(createAccent, 0.24);
  const createButton = showCreateButton
    ? `<button type="button" class="tp-plan-card tp-plan-create" id="addPlanBtn" style="--diet-accent:${createAccent};--diet-accent-soft:${createAccentSoft};--diet-accent-line:${createAccentLine};"><span class="diet-plan-icon" aria-hidden="true"><i data-lucide="plus"></i></span><strong>New Plan</strong></button>`
    : "";

  strip.innerHTML = html + createButton;
  setIcons();
  const closePlanMenus = () => {
    strip.querySelectorAll(".tp-plan-card-menu").forEach((menu) => {
      menu.classList.remove("is-open");
      menu.hidden = true;
    });
  };

  strip.querySelectorAll(".tp-plan-card[data-plan-id]").forEach(card => card.addEventListener("click", () => selectPlan(card.dataset.planId)));
  strip.querySelectorAll(".js-plan-card-menu-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const planId = btn.dataset.planId;
      if (!planId) return;

      if (isTrainingPlanMobileMenuMode()) {
        openTrainingPlanActionSheet(planId);
        return;
      }

      const menu = strip.querySelector(`.tp-plan-card-menu[data-menu-plan-id="${planId}"]`);
      strip.querySelectorAll(".tp-plan-card-menu").forEach((item) => {
        if (item !== menu) {
          item.classList.remove("is-open");
          item.hidden = true;
        }
      });
      if (!menu) return;

      const shouldOpen = menu.hidden || !menu.classList.contains("is-open");
      if (!shouldOpen) {
        menu.classList.remove("is-open");
        menu.hidden = true;
      } else {
        menu.hidden = false;
        requestAnimationFrame(() => {
          menu.classList.add("is-open");
        });
      }
    });
  });
  strip.querySelectorAll("[data-card-action]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = btn.dataset.cardAction;
      const planId = btn.dataset.planId;
      closePlanMenus();
      if (!planId) return;
      if (action === "rename-plan") {
        await handleRenamePlan(planId);
      } else if (action === "delete-plan") {
        await handleDeletePlan(planId);
      }
    });
  });

  if (!TP.planActionMenuOutsideBound) {
    document.addEventListener("click", () => {
      const currentStrip = byId("planStrip");
      if (!currentStrip) return;
      currentStrip.querySelectorAll(".tp-plan-card-menu").forEach((menu) => {
        menu.classList.remove("is-open");
        menu.hidden = true;
      });
    });
    TP.planActionMenuOutsideBound = true;
  }

  if (showCreateButton) {
    byId("addPlanBtn")?.addEventListener("click", handleCreatePlan);
  }
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
  const state = window.history.state || {};
  if (!(state.tpPage === TP_HISTORY_MARKER && state.tpScreen === "day")) {
    ensureHistoryMainState();
  }
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
  el.innerHTML = `<div class="tp-section-row"><h3>Your Days</h3><span>${TP.days.length}/7 Days</span></div><div class="tp-days-grid" id="daysGrid"></div>`;
  renderDaysList();
}
function renderDaysList() {
  const grid = byId("daysGrid");
  if (!grid) return;
  const addDayMarkup = getAddDayCardMarkup();
  if (TP.days.length === 0) {
    grid.innerHTML = addDayMarkup;
    setIcons();
    byId("addDayBtn")?.addEventListener("click", handleCreateDay);
    return;
  }
  grid.innerHTML = TP.days.map((day, idx) => {
    const count = (TP.exercisesByDay[day.id] || []).length;
    const accent = getTrainingDayAccent(idx);
    const accentSoft = hexToRgba(accent, 0.1);
    const accentLine = hexToRgba(accent, 0.25);

    return `<article class="tp-day-row" data-day-id="${day.id}" style="--tp-day-accent:${accent};--tp-day-accent-soft:${accentSoft};--tp-day-accent-line:${accentLine};">
      <div class="tp-day-icon"><i data-lucide="${dayIcon(nameOfDay(day))}"></i></div>
      <div class="tp-day-row-main" data-action="open-day" data-day-id="${day.id}">
        <p class="tp-day-title">${escHtml(nameOfDay(day))}</p>
        <p class="tp-day-sub">${count} exercise${count === 1 ? "" : "s"}</p>
      </div>
      <div class="tp-day-menu-wrap" data-day-id="${day.id}">
        <button class="tp-day-menu-btn" data-action="toggle-day-menu" data-day-id="${day.id}" aria-label="Day actions" aria-expanded="false">
          <i data-lucide="ellipsis-vertical"></i>
        </button>
        <div class="tp-day-menu-dropdown" data-day-id="${day.id}">
          <button class="tp-day-menu-item" data-action="rename-day" data-day-id="${day.id}"><i data-lucide="pencil-line"></i> Rename</button>
          <button class="tp-day-menu-item danger" data-action="delete-day" data-day-id="${day.id}"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      </div>
      <div class="tp-day-swipe-overlay"><i data-lucide="trash-2"></i></div>
    </article>`;
  }).join("") + addDayMarkup;
  setIcons();
  byId("addDayBtn")?.addEventListener("click", handleCreateDay);
  grid.querySelectorAll("[data-action='open-day']").forEach(x => x.addEventListener("click", () => openDayDetail(x.dataset.dayId)));

  const closeAllDayMenus = () => {
    grid.querySelectorAll(".tp-day-menu-dropdown").forEach((menu) => menu.classList.remove("open"));
    grid.querySelectorAll(".tp-day-menu-btn").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  };

  grid.querySelectorAll("[data-action='toggle-day-menu']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const dayId = btn.dataset.dayId;

      if (isTrainingPlanMobileMenuMode()) {
        closeAllDayMenus();
        openTrainingDayActionSheet(dayId);
        return;
      }

      const menu = grid.querySelector(`.tp-day-menu-dropdown[data-day-id="${dayId}"]`);
      if (!menu) return;

      const willOpen = !menu.classList.contains("open");
      closeAllDayMenus();
      if (willOpen) {
        menu.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  grid.querySelectorAll("[data-action='rename-day']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllDayMenus();
      handleRenameDay(btn.dataset.dayId);
    });
  });

  grid.querySelectorAll("[data-action='delete-day']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllDayMenus();
      handleDeleteDay(btn.dataset.dayId);
    });
  });

  if (!TP.dayMenuOutsideBound) {
    document.addEventListener("click", () => {
      const currentGrid = byId("daysGrid");
      if (!currentGrid) return;
      currentGrid.querySelectorAll(".tp-day-menu-dropdown").forEach((menu) => menu.classList.remove("open"));
      currentGrid.querySelectorAll(".tp-day-menu-btn").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
    });
    TP.dayMenuOutsideBound = true;
  }

  bindDayRowSwipeDelete();
}

function bindDayRowSwipeDelete() {
  if (TP.daySwipeBound) return;
  TP.daySwipeBound = true;

  let swipeRow = null;
  let swipeOverlay = null;
  let startX = 0;
  let startY = 0;
  let swiping = false;

  document.addEventListener("touchstart", (event) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const row = event.target.closest(".tp-day-row");
    if (!row || event.target.closest(".tp-day-menu-wrap")) return;

    swipeRow = row;
    swipeOverlay = row.querySelector(".tp-day-swipe-overlay");
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    swiping = false;

    swipeRow.classList.remove("is-swipe-ready");
    if (swipeOverlay) swipeOverlay.style.width = "0";
  });

  document.addEventListener("touchmove", (event) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    if (!swipeRow) return;

    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -24) {
      swiping = true;
      const maxWidth = swipeRow.offsetWidth * 0.78;
      const width = Math.min(Math.abs(deltaX), maxWidth);

      if (swipeOverlay) swipeOverlay.style.width = `${width}px`;
      swipeRow.classList.toggle("is-swipe-ready", width > (swipeRow.offsetWidth * 0.45));
      event.preventDefault();
    }
  });

  document.addEventListener("touchend", () => {
    if (!window.matchMedia("(max-width: 767px)").matches) {
      swipeRow = null;
      return;
    }

    if (!swipeRow) return;

    const shouldDelete = swiping && swipeRow.classList.contains("is-swipe-ready");
    const dayId = swipeRow.dataset.dayId;

    if (swipeOverlay) swipeOverlay.style.width = "0";
    swipeRow.classList.remove("is-swipe-ready");

    if (shouldDelete && dayId) {
      handleDeleteDay(dayId);
    }

    swipeRow = null;
    swipeOverlay = null;
    swiping = false;
  });
}

/* ── Day detail ────────────────────── */
function showMainScreen() { byId("trainingMainScreen")?.removeAttribute("hidden"); byId("trainingMainScreen")?.classList.add("is-active"); byId("trainingDayScreen")?.setAttribute("hidden", "hidden"); }
function showDayScreen() { byId("trainingMainScreen")?.setAttribute("hidden", "hidden"); byId("trainingDayScreen")?.removeAttribute("hidden"); byId("trainingDayScreen")?.classList.add("is-active"); }
function openDayDetail(dayId, options = {}) {
  const { pushHistory = true, scroll = true } = options;
  TP.selectedDayId = dayId;
  showDayScreen();
  renderDayDetail();
  if (pushHistory) pushHistoryDayState(dayId);
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}
function currentDay() { return TP.days.find(d => d.id === TP.selectedDayId); }
function renderDayDetail() {
  const day = currentDay(); if (!day) return showMainScreen();
  const dayName = nameOfDay(day); const exercises = TP.exercisesByDay[day.id] || [];
  const dayIndex = Math.max(0, TP.days.findIndex((d) => d.id === day.id));
  const accent = getTrainingDayAccent(dayIndex);
  const accentSoft = hexToRgba(accent, 0.12);
  const accentLine = hexToRgba(accent, 0.3);
  const exerciseLabel = `${exercises.length} Exercise${exercises.length === 1 ? "" : "s"}`;

  byId("daySummaryCard").innerHTML = `<div class="tp-day-icon"><i data-lucide="${dayIcon(dayName)}"></i></div><div><h3>${escHtml(dayName)}</h3><p>${escHtml(exerciseLabel)}</p></div>`;
  byId("daySummaryCard").style.setProperty("--tp-day-accent", accent);
  byId("daySummaryCard").style.setProperty("--tp-day-accent-soft", accentSoft);
  byId("daySummaryCard").style.setProperty("--tp-day-accent-line", accentLine);

  renderDayExercises();
  setIcons();

  const menuBtn = byId("dayDetailMenuBtn");
  const menu = byId("dayDetailMenuDropdown");
  const closeMenu = () => {
    if (!menu || !menuBtn) return;
    menu.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  };

  menuBtn.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isTrainingPlanMobileMenuMode()) {
      openTrainingDayActionSheet(day.id);
      return;
    }

    if (!menu || !menuBtn) return;
    const willOpen = !menu.classList.contains("open");
    closeMenu();
    if (willOpen) {
      menu.classList.add("open");
      menuBtn.setAttribute("aria-expanded", "true");
    }
  };

  const renameBtn = menu?.querySelector('[data-action="rename-day-detail"]');
  if (renameBtn) {
    renameBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      handleRenameDay(day.id);
    };
  }

  const deleteBtn = menu?.querySelector('[data-action="delete-day-detail"]');
  if (deleteBtn) {
    deleteBtn.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      handleDeleteDay(day.id);
    };
  }

  if (!TP.dayDetailMenuOutsideBound) {
    document.addEventListener("click", () => {
      byId("dayDetailMenuDropdown")?.classList.remove("open");
      byId("dayDetailMenuBtn")?.setAttribute("aria-expanded", "false");
    });
    TP.dayDetailMenuOutsideBound = true;
  }
}
function renderDayExercises() {
  const list = byId("dayExerciseList"); const day = currentDay(); if (!list || !day) return;
  const exercises = TP.exercisesByDay[day.id] || [];
  const sectionAddBtn = byId("dayHeaderAddExerciseBtn");
  const wideAddBtn = byId("detailAddExerciseBtn");

  if (sectionAddBtn) sectionAddBtn.hidden = exercises.length === 0;
  if (wideAddBtn) wideAddBtn.hidden = exercises.length > 0;

  if (!exercises.length) {
    list.innerHTML = `<div class="tp-empty-state"><div class="tp-empty-icon"><i data-lucide="activity"></i></div><h4>No exercises added</h4><p>Add exercises from your catalog to build this day.</p></div>`;
    setIcons(); return;
  }
  list.innerHTML = exercises.map((ex, index) => {
    const accent = getExerciseAccent(ex.exercise_name, index);
    const accentSoft = hexToRgba(accent, 0.14);
    const accentLine = hexToRgba(accent, 0.3);
    const iconPath = getExerciseIconPath(ex.exercise_name);
    return `<article class="tp-exercise-row" data-exercise-id="${ex.id}" data-catalog-id="${ex.exercise_catalog_id || ""}" style="--tp-ex-accent:${accent};--tp-ex-accent-soft:${accentSoft};--tp-ex-accent-line:${accentLine};">
      <div class="tp-exercise-swipe-action tp-exercise-swipe-edit" aria-hidden="true"><i data-lucide="pencil-line"></i></div>
      <div class="tp-exercise-swipe-action tp-exercise-swipe-delete" aria-hidden="true"><i data-lucide="trash-2"></i></div>
      <div class="tp-exercise-icon">
        <img src="${escHtml(iconPath)}" alt="${escHtml(ex.exercise_name || "Exercise icon")}" loading="lazy" onerror="this.closest('.tp-exercise-icon')?.classList.add('is-fallback'); this.onerror=null; this.src='${EXERCISE_ICON_FALLBACK_PATH}';">
        <span class="tp-exercise-icon-fallback"><i data-lucide="dumbbell"></i></span>
      </div>
      <div class="tp-exercise-main">
        <div class="tp-exercise-head">
          <p class="tp-exercise-name">${escHtml(ex.exercise_name)}</p>
          <div class="tp-exercise-menu-wrap" data-exercise-id="${ex.id}">
            <button type="button" class="tp-day-summary-menu-btn tp-exercise-menu-btn" data-action="toggle-exercise-menu" data-exercise-id="${ex.id}" aria-label="Exercise options" aria-expanded="false">
              <i data-lucide="ellipsis-vertical"></i>
            </button>
            <div class="tp-day-summary-menu-dropdown tp-exercise-menu-dropdown" data-exercise-id="${ex.id}">
              <button type="button" class="tp-day-summary-menu-item" data-action="edit-exercise" data-exercise-id="${ex.id}"><i data-lucide="pencil-line"></i> Edit</button>
              <button type="button" class="tp-day-summary-menu-item danger" data-action="remove-exercise" data-exercise-id="${ex.id}"><i data-lucide="trash-2"></i> Delete</button>
            </div>
          </div>
        </div>
        <div class="tp-exercise-stat-chips">
          <span class="tp-exercise-stat-chip"><i data-lucide="layers-3"></i>${ex.sets || 3} sets</span>
          <span class="tp-exercise-stat-chip"><i data-lucide="repeat-2"></i>${escHtml(ex.reps || "8-12")} reps</span>
          <span class="tp-exercise-stat-chip"><i data-lucide="timer"></i>${ex.rest_seconds || 90}s rest</span>
        </div>
      </div>
      <div class="tp-exercise-actions"></div>
    </article>`;
  }).join("");
  setIcons();

  const closeAllExerciseMenus = () => {
    list.querySelectorAll(".tp-exercise-menu-dropdown").forEach((menu) => menu.classList.remove("open"));
    list.querySelectorAll(".tp-exercise-menu-btn").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
  };

  list.querySelectorAll("[data-action='toggle-exercise-menu']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const exerciseId = btn.dataset.exerciseId;

      if (isTrainingPlanMobileMenuMode()) {
        closeAllExerciseMenus();
        openTrainingExerciseActionSheet(exerciseId);
        return;
      }

      const menu = list.querySelector(`.tp-exercise-menu-dropdown[data-exercise-id="${exerciseId}"]`);
      if (!menu) return;

      const willOpen = !menu.classList.contains("open");
      closeAllExerciseMenus();
      if (willOpen) {
        menu.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  list.querySelectorAll("[data-action='edit-exercise']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllExerciseMenus();
      openEditExercise(btn.dataset.exerciseId);
    });
  });

  list.querySelectorAll("[data-action='remove-exercise']").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeAllExerciseMenus();
      handleRemoveExercise(btn.dataset.exerciseId);
    });
  });

  list.querySelectorAll(".tp-exercise-row").forEach(card => card.addEventListener("click", e => {
    if (Date.now() < (TP.exerciseSwipeSuppressUntil || 0)) return;
    if (e.target.closest("[data-action]")) return;
    if (card.dataset.catalogId || card.dataset.exerciseId) openExerciseDetail(card.dataset.catalogId, card.dataset.exerciseId);
  }));

  if (!TP.exerciseMenuOutsideBound) {
    document.addEventListener("click", () => {
      const currentList = byId("dayExerciseList");
      if (!currentList) return;
      currentList.querySelectorAll(".tp-exercise-menu-dropdown").forEach((menu) => menu.classList.remove("open"));
      currentList.querySelectorAll(".tp-exercise-menu-btn").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
    });
    TP.exerciseMenuOutsideBound = true;
  }

  bindExerciseRowSwipeActions();
}

function bindExerciseRowSwipeActions() {
  if (TP.exerciseSwipeBound) return;
  TP.exerciseSwipeBound = true;

  let swipeRow = null;
  let swipeEditOverlay = null;
  let swipeDeleteOverlay = null;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let swiping = false;

  document.addEventListener("touchstart", (event) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;

    const row = event.target.closest(".tp-exercise-row");
    if (!row || event.target.closest(".tp-exercise-menu-wrap")) return;

    swipeRow = row;
    swipeEditOverlay = row.querySelector(".tp-exercise-swipe-edit");
    swipeDeleteOverlay = row.querySelector(".tp-exercise-swipe-delete");
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    deltaX = 0;
    swiping = false;

    swipeRow.classList.remove("is-swiping", "is-swipe-left", "is-swipe-right");
    if (swipeEditOverlay) swipeEditOverlay.style.width = "0";
    if (swipeDeleteOverlay) swipeDeleteOverlay.style.width = "0";
  });

  document.addEventListener("touchmove", (event) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    if (!swipeRow) return;

    const currentX = event.touches[0].clientX;
    const currentY = event.touches[0].clientY;
    const moveX = currentX - startX;
    const moveY = currentY - startY;

    if (Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > 14) {
      swiping = true;
      deltaX = moveX;
      const boundedX = Math.max(-88, Math.min(88, moveX));
      const revealWidth = `${Math.abs(boundedX)}px`;

      swipeRow.classList.add("is-swiping");
      swipeRow.classList.toggle("is-swipe-left", boundedX < 0);
      swipeRow.classList.toggle("is-swipe-right", boundedX > 0);
      if (boundedX > 0) {
        if (swipeEditOverlay) swipeEditOverlay.style.width = revealWidth;
        if (swipeDeleteOverlay) swipeDeleteOverlay.style.width = "0";
      } else {
        if (swipeDeleteOverlay) swipeDeleteOverlay.style.width = revealWidth;
        if (swipeEditOverlay) swipeEditOverlay.style.width = "0";
      }
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("touchend", () => {
    if (!window.matchMedia("(max-width: 767px)").matches) {
      swipeRow = null;
      return;
    }
    if (!swipeRow) return;

    const exerciseId = swipeRow.dataset.exerciseId;
    const shouldTrigger = swiping && Math.abs(deltaX) >= 72 && exerciseId;
    const isRightSwipe = deltaX > 0;

    swipeRow.classList.remove("is-swiping", "is-swipe-left", "is-swipe-right");
    if (swipeEditOverlay) swipeEditOverlay.style.width = "0";
    if (swipeDeleteOverlay) swipeDeleteOverlay.style.width = "0";

    if (shouldTrigger) {
      TP.exerciseSwipeSuppressUntil = Date.now() + 350;
      if (isRightSwipe) {
        openEditExercise(exerciseId);
      } else {
        handleRemoveExercise(exerciseId);
      }
    }

    swipeRow = null;
    swipeEditOverlay = null;
    swipeDeleteOverlay = null;
    deltaX = 0;
    swiping = false;
  });
}

/* ── CRUD handlers ─────────────────── */
async function handleCreatePlan() {
  if (TP.plans.length >= MAX_TRAINING_PLANS) {
    showToast("Maximum 3 training plans allowed.");
    return;
  }
  const title = await promptInput({ title: "Create Plan", label: "Plan name", placeholder: "e.g. Strength Plan", confirmLabel: "Create" });
  const normalizedTitle = toTitleCaseWords(title);
  if (!normalizedTitle) return;
  try { const p = await dbCreatePlan(normalizedTitle); await fetchAndRenderPlans(); await selectPlan(p.id); showToast("Plan created."); } catch (e) { console.error(e); showToast("Error creating plan."); }
}
async function handleRenamePlan(planId = TP.selectedPlanId) {
  const plan = TP.plans.find((p) => String(p.id) === String(planId)); if (!plan) return;
  const title = await promptInput({ title: "Rename", label: "Plan name", defaultValue: titleOfPlan(plan), confirmLabel: "Save" });
  const normalizedTitle = toTitleCaseWords(title);
  if (!normalizedTitle) return;
  try {
    await dbRenamePlan(plan.id, normalizedTitle);
    if (String(TP.selectedPlanId) !== String(plan.id)) {
      TP.selectedPlanId = plan.id;
    }
    await fetchAndRenderPlans();
    showToast("Plan renamed.");
  } catch(e) { console.error(e); showToast("Error renaming plan."); }
}
async function handleDeletePlan(planId = TP.selectedPlanId) {
  const plan = TP.plans.find((p) => String(p.id) === String(planId)); if (!plan) return;
  const ok = await promptConfirm(`Delete "${titleOfPlan(plan)}"? All days and exercises will be removed.`, "Delete");
  if (!ok) return;
  try {
    await dbDeletePlan(plan.id);
    if (String(TP.selectedPlanId) === String(plan.id)) {
      TP.selectedPlanId = null;
    }
    await fetchAndRenderPlans();
    showToast("Plan deleted.");
  } catch(e) { console.error(e); showToast("Error deleting plan."); }
}
async function handleCreateDay() {
  if (!TP.selectedPlanId) return handleCreatePlan();
  if (TP.days.length >= 7) return showToast("Maximum 7 days per plan.");
  const name = await promptInput({ title: "Add Training Day", label: "Day name", placeholder: "e.g. Push Day", confirmLabel: "Add" });
  const normalizedName = toTitleCaseWords(name);
  if (!normalizedName) return;
  try { const d = await dbCreateDay(TP.selectedPlanId, normalizedName); TP.days.push(d); TP.exercisesByDay[d.id] = []; renderMainContent(); showToast("Training day added."); } catch(e) { console.error(e); showToast("Error adding day."); }
}
async function handleRenameDay(dayId = TP.selectedDayId) {
  const day = TP.days.find(d => d.id === dayId); if (!day) return;
  const name = await promptInput({ title: "Rename", label: "Day name", defaultValue: nameOfDay(day), confirmLabel: "Save" });
  const normalizedName = toTitleCaseWords(name);
  if (!normalizedName) return;
  try { await dbRenameDay(day.id, normalizedName); if (day.day_name !== undefined) day.day_name = normalizedName; else day.name = normalizedName; renderMainContent(); if (TP.selectedDayId === day.id) renderDayDetail(); showToast("Day renamed."); } catch(e) { console.error(e); showToast("Error renaming day."); }
}
async function handleDeleteDay(dayId = TP.selectedDayId) {
  const day = TP.days.find(d => d.id === dayId); if (!day) return;
  const ok = await promptConfirm(`Delete "${nameOfDay(day)}"? Exercises in this day will be removed.`, "Delete");
  if (!ok) return;
  try {
    await dbDeleteDay(day.id);
    TP.days = TP.days.filter(d => d.id !== day.id);
    delete TP.exercisesByDay[day.id];
    if (TP.selectedDayId === day.id) {
      TP.selectedDayId = null;
      showMainScreen();
      ensureHistoryMainState();
    }
    renderMainContent();
    showToast("Day deleted.");
  } catch(e) { console.error(e); showToast("Error deleting day."); }
}
async function handleRemoveExercise(id) {
  const ok = await promptConfirm("Delete this exercise from the day?", "Delete"); if (!ok) return;
  try { await dbRemoveExercise(id); const dayId = TP.selectedDayId; TP.exercisesByDay[dayId] = (TP.exercisesByDay[dayId] || []).filter(e => e.id !== id); renderDayDetail(); showToast("Exercise removed."); } catch(e) { console.error(e); showToast("Error removing exercise."); }
}

async function handleRenameExercise(id) {
  const dayId = TP.selectedDayId;
  const list = TP.exercisesByDay[dayId] || [];
  const ex = list.find((item) => String(item.id) === String(id));
  if (!ex) return;

  const nextName = await promptInput({
    title: "Rename",
    label: "Exercise name",
    defaultValue: ex.exercise_name || "",
    confirmLabel: "Save",
  });
  const normalizedName = toTitleCaseWords(nextName);
  if (!normalizedName || normalizedName === ex.exercise_name) return;

  try {
    await dbUpdateExercise(id, { exercise_name: normalizedName });
    ex.exercise_name = normalizedName;
    renderDayDetail();
    showToast("Exercise renamed.");
  } catch (e) {
    console.error(e);
    showToast("Error renaming exercise.");
  }
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
  el.innerHTML = BODY_PARTS.map((bp) => {
    const theme = getCatalogTagTheme(bp);
    const soft = hexToRgba(theme.color, 0.14);
    const line = hexToRgba(theme.color, 0.3);
    return `<button class="tp-filter-chip ${TP.catalogFilter.bodyPart === bp ? "is-active" : ""}" style="--tp-chip-accent:${theme.color};--tp-chip-soft:${soft};--tp-chip-line:${line};" data-bp="${bp}"><i data-lucide="${theme.icon}"></i><span>${escHtml(bp)}</span></button>`;
  }).join("");
  el.querySelectorAll(".tp-filter-chip").forEach(ch => ch.addEventListener("click", () => { TP.catalogFilter.bodyPart = ch.dataset.bp; renderCatalogFilters(); renderCatalogList(); }));
  setIcons();
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
    const metaPills = renderCatalogMetaPills(ex);
    const iconPath = getExerciseIconPath(ex.name || ex.exercise_name || "");
    const iconTheme = getCatalogTagTheme(ex.body_part || ex.target_muscle || "all");
    const iconSoft = hexToRgba(iconTheme.color, 0.14);
    const iconLine = hexToRgba(iconTheme.color, 0.26);
    return `<div class="tp-catalog-card ${selected ? "is-selected" : ""}" data-id="${ex.id}">
      <div class="tp-catalog-card-icon" style="--tp-cat-icon-accent:${iconTheme.color};--tp-cat-icon-soft:${iconSoft};--tp-cat-icon-line:${iconLine};">
        <img src="${escHtml(iconPath)}" alt="${escHtml((ex.name || "Exercise") + " icon")}" loading="lazy" onerror="this.closest('.tp-catalog-card-icon')?.classList.add('is-fallback'); this.onerror=null; this.src='${EXERCISE_ICON_FALLBACK_PATH}';">
        <span class="tp-catalog-card-icon-fallback"><i data-lucide="dumbbell"></i></span>
      </div>
      <div class="tp-catalog-card-info"><p class="tp-catalog-card-name">${escHtml(ex.name)}</p><div class="tp-catalog-card-meta">${metaPills}</div></div>
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
async function openExerciseDetail(catalogId, dayExerciseId = null) {
  const dayExercises = TP.exercisesByDay[TP.selectedDayId] || [];
  const selectedDayExercise = dayExercises.find((item) => String(item.id) === String(dayExerciseId));
  const dayExerciseIndex = selectedDayExercise
    ? Math.max(0, dayExercises.findIndex((item) => String(item.id) === String(dayExerciseId)))
    : 0;

  openModal("exerciseDetailOverlay");
  let ex = TP.catalog.find(x => String(x.id) === String(catalogId));
  if (!ex && catalogId) { try { ex = await dbFetchCatalogItem(catalogId); } catch(e) { console.error(e); } }
  const mergedExercise = {
    ...(ex || {}),
    name: ex?.name || selectedDayExercise?.exercise_name || "Exercise",
    body_part: ex?.body_part || selectedDayExercise?.body_part || "full body",
    equipment: ex?.equipment || selectedDayExercise?.equipment || "Any",
  };
  renderExerciseDetailContent(mergedExercise, dayExerciseIndex);
}
function renderExerciseDetailContent(ex, dayExerciseIndex = 0) {
  if (!ex) return;
  const exerciseName = ex.name || ex.exercise_name || "Exercise";
  const accent = getExerciseAccent(exerciseName, dayExerciseIndex);
  const accentSoft = hexToRgba(accent, 0.14);
  const accentLine = hexToRgba(accent, 0.35);
  const iconPath = getExerciseIconPath(exerciseName);

  byId("exerciseDetailTitle").textContent = exerciseName;
  byId("exerciseDetailSubtitle").textContent = [capitalize(ex.body_part), ex.equipment].filter(Boolean).join(" · ") || "Exercise detail";
  const instructions = instructionArray(ex.instructions);
  const imageHtml = `<div class="tp-detail-exercise-icon" style="--tp-detail-accent:${accent};--tp-detail-accent-soft:${accentSoft};--tp-detail-accent-line:${accentLine};"><img src="${escHtml(iconPath)}" alt="${escHtml(exerciseName)}" loading="lazy" onerror="this.closest('.tp-detail-exercise-icon')?.classList.add('is-fallback'); this.onerror=null; this.src='${EXERCISE_ICON_FALLBACK_PATH}';"><span class="tp-detail-placeholder-icon"><i data-lucide="dumbbell"></i></span></div>`;
  byId("exerciseDetailBody").innerHTML = `<div class="tp-detail-image-wrap" style="--tp-detail-accent:${accent};--tp-detail-accent-soft:${accentSoft};--tp-detail-accent-line:${accentLine};">${imageHtml}</div><div class="tp-detail-facts"><div class="tp-detail-fact"><i data-lucide="target"></i><div><span>Primary Muscle</span><strong>${escHtml(capitalize(ex.target_muscle || ex.body_part || "Exercise"))}</strong></div></div><div class="tp-detail-fact"><i data-lucide="dumbbell"></i><div><span>Equipment</span><strong>${escHtml(ex.equipment || "Any")}</strong></div></div><div class="tp-detail-fact"><i data-lucide="activity"></i><div><span>Body Part</span><strong>${escHtml(capitalize(ex.body_part || "Full Body"))}</strong></div></div></div><h3 class="tp-detail-section-title">Instructions</h3><div class="tp-instruction-list">${instructions.length ? instructions.map((s,i) => `<div class="tp-instruction-step"><span class="tp-instruction-num">${i+1}</span><p>${escHtml(s)}</p></div>`).join("") : `<p style="margin:0;color:#667085;">No instructions available yet.</p>`}</div>`;
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

function isTrainingPlanMobileMenuMode() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function ensureTrainingDayActionSheet() {
  if (byId("trainingDayActionSheet")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="tp-plan-card-sheet" id="trainingDayActionSheet" hidden aria-hidden="true" data-day-id="">
      <button type="button" class="tp-plan-card-sheet-backdrop" data-day-sheet-close aria-label="Close day actions"></button>
      <section class="tp-plan-card-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="trainingDayActionSheetTitle">
        <div class="tp-plan-card-sheet-head">
          <p class="tp-plan-card-sheet-title" id="trainingDayActionSheetTitle">Day options</p>
          <button type="button" class="tp-plan-card-sheet-close" data-day-sheet-close aria-label="Close"><i data-lucide="x"></i></button>
        </div>
        <div class="tp-plan-card-sheet-actions">
          <button type="button" class="tp-plan-card-sheet-btn" data-day-sheet-action="rename"><i data-lucide="pencil-line"></i> Rename</button>
          <button type="button" class="tp-plan-card-sheet-btn tp-plan-card-sheet-btn--danger" data-day-sheet-action="delete"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      </section>
    </div>
  `);

  const sheet = byId("trainingDayActionSheet");
  if (!sheet) return;

  sheet.addEventListener("click", async (event) => {
    const closeTrigger = event.target.closest("[data-day-sheet-close]");
    if (closeTrigger) {
      closeTrainingDayActionSheet();
      return;
    }

    const actionBtn = event.target.closest("[data-day-sheet-action]");
    if (!actionBtn) return;

    const dayId = sheet.getAttribute("data-day-id");
    if (!dayId) {
      closeTrainingDayActionSheet();
      return;
    }

    closeTrainingDayActionSheet();

    if (actionBtn.getAttribute("data-day-sheet-action") === "rename") {
      await handleRenameDay(dayId);
      return;
    }

    if (actionBtn.getAttribute("data-day-sheet-action") === "delete") {
      await handleDeleteDay(dayId);
    }
  });

  setIcons();
}

function openTrainingDayActionSheet(dayId) {
  if (!dayId) return;

  ensureTrainingDayActionSheet();
  const sheet = byId("trainingDayActionSheet");
  if (!sheet) return;

  const day = TP.days.find((item) => String(item.id) === String(dayId));
  const titleEl = byId("trainingDayActionSheetTitle");
  if (titleEl) {
    titleEl.textContent = day ? `${nameOfDay(day)} options` : "Day options";
  }

  sheet.setAttribute("data-day-id", String(dayId));
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setIcons();
}

function closeTrainingDayActionSheet() {
  const sheet = byId("trainingDayActionSheet");
  if (!sheet) return;
  sheet.removeAttribute("data-day-id");
  sheet.hidden = true;
  sheet.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function ensureTrainingExerciseActionSheet() {
  if (byId("trainingExerciseActionSheet")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div class="tp-plan-card-sheet" id="trainingExerciseActionSheet" hidden aria-hidden="true" data-exercise-id="">
      <button type="button" class="tp-plan-card-sheet-backdrop" data-exercise-sheet-close aria-label="Close exercise actions"></button>
      <section class="tp-plan-card-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="trainingExerciseActionSheetTitle">
        <div class="tp-plan-card-sheet-head">
          <p class="tp-plan-card-sheet-title" id="trainingExerciseActionSheetTitle">Exercise options</p>
          <button type="button" class="tp-plan-card-sheet-close" data-exercise-sheet-close aria-label="Close"><i data-lucide="x"></i></button>
        </div>
        <div class="tp-plan-card-sheet-actions">
          <button type="button" class="tp-plan-card-sheet-btn" data-exercise-sheet-action="edit"><i data-lucide="pencil-line"></i> Edit</button>
          <button type="button" class="tp-plan-card-sheet-btn tp-plan-card-sheet-btn--danger" data-exercise-sheet-action="delete"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      </section>
    </div>
  `);

  const sheet = byId("trainingExerciseActionSheet");
  if (!sheet) return;

  sheet.addEventListener("click", async (event) => {
    const closeTrigger = event.target.closest("[data-exercise-sheet-close]");
    if (closeTrigger) {
      closeTrainingExerciseActionSheet();
      return;
    }

    const actionBtn = event.target.closest("[data-exercise-sheet-action]");
    if (!actionBtn) return;

    const exerciseId = sheet.getAttribute("data-exercise-id");
    if (!exerciseId) {
      closeTrainingExerciseActionSheet();
      return;
    }

    closeTrainingExerciseActionSheet();

    if (actionBtn.getAttribute("data-exercise-sheet-action") === "edit") {
      openEditExercise(exerciseId);
      return;
    }

    if (actionBtn.getAttribute("data-exercise-sheet-action") === "delete") {
      await handleRemoveExercise(exerciseId);
    }
  });

  setIcons();
}

function openTrainingExerciseActionSheet(exerciseId) {
  if (!exerciseId) return;

  ensureTrainingExerciseActionSheet();
  const sheet = byId("trainingExerciseActionSheet");
  if (!sheet) return;

  const dayExercises = TP.exercisesByDay[TP.selectedDayId] || [];
  const exercise = dayExercises.find((item) => String(item.id) === String(exerciseId));
  const titleEl = byId("trainingExerciseActionSheetTitle");
  if (titleEl) {
    titleEl.textContent = exercise?.exercise_name ? `${exercise.exercise_name} options` : "Exercise options";
  }

  sheet.setAttribute("data-exercise-id", String(exerciseId));
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setIcons();
}

function closeTrainingExerciseActionSheet() {
  const sheet = byId("trainingExerciseActionSheet");
  if (!sheet) return;
  sheet.removeAttribute("data-exercise-id");
  sheet.hidden = true;
  sheet.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function openTrainingPlanActionSheet(planId) {
  const sheet = byId("trainingPlanActionSheet");
  if (!sheet) return;
  const targetPlan = TP.plans.find((plan) => String(plan.id) === String(planId));
  if (!targetPlan) return;
  const titleEl = byId("trainingPlanActionSheetTitle");
  if (titleEl) {
    titleEl.textContent = `${titleOfPlan(targetPlan)} options`;
  }
  sheet.setAttribute("data-plan-id", String(planId));
  sheet.hidden = false;
  sheet.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  setIcons();
}

function closeTrainingPlanActionSheet() {
  const sheet = byId("trainingPlanActionSheet");
  if (!sheet) return;
  sheet.removeAttribute("data-plan-id");
  sheet.hidden = true;
  sheet.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* ── Shell + events ────────────────── */
function bindStaticTrainingUI() {
  byId("backToPlansBtn")?.addEventListener("click", goBackToTrainingMain);
  byId("detailAddExerciseBtn")?.addEventListener("click", openCatalogModal);
  byId("dayHeaderAddExerciseBtn")?.addEventListener("click", openCatalogModal);

  byId("trainingPlanActionSheetClose")?.addEventListener("click", closeTrainingPlanActionSheet);
  byId("trainingPlanActionSheetBackdrop")?.addEventListener("click", closeTrainingPlanActionSheet);
  byId("trainingPlanRenameBtn")?.addEventListener("click", async () => {
    const planId = byId("trainingPlanActionSheet")?.getAttribute("data-plan-id");
    closeTrainingPlanActionSheet();
    if (planId) await handleRenamePlan(planId);
  });
  byId("trainingPlanDeleteBtn")?.addEventListener("click", async () => {
    const planId = byId("trainingPlanActionSheet")?.getAttribute("data-plan-id");
    closeTrainingPlanActionSheet();
    if (planId) await handleDeletePlan(planId);
  });

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
  document.querySelectorAll(".tyfit-sidebar .sidebar-nav-item").forEach((item) => {
    const label = item.querySelector("span")?.textContent?.trim();
    if (!label) return;
    item.setAttribute("data-tooltip", label);
    item.setAttribute("aria-label", label);
  });

  byId("mobileMenuBtn")?.addEventListener("click", () => { byId("mobileDrawer")?.classList.add("is-open"); byId("mobileDrawer")?.setAttribute("aria-hidden", "false"); const b = byId("mobileDrawerBackdrop"); if (b) b.hidden = false; document.body.style.overflow = "hidden"; });
  const closeDrawer = () => { byId("mobileDrawer")?.classList.remove("is-open"); byId("mobileDrawer")?.setAttribute("aria-hidden", "true"); const b = byId("mobileDrawerBackdrop"); if (b) b.hidden = true; document.body.style.overflow = ""; };
  byId("mobileDrawerClose")?.addEventListener("click", closeDrawer);
  byId("mobileDrawerBackdrop")?.addEventListener("click", closeDrawer);
  byId("sidebarCollapseBtn")?.addEventListener("click", () => {
    byId("tyfitLayout")?.classList.toggle("sidebar-collapsed");
    document.body.classList.toggle("sidebar-collapsed");
  });

  const togglePopover = (menuEl) => {
    if (!menuEl) return;
    document.querySelectorAll(".tyfit-popover-menu.is-open").forEach((menu) => {
      if (menu !== menuEl) {
        menu.classList.remove("is-open");
        menu.setAttribute("aria-hidden", "true");
      }
    });
    const shouldOpen = !menuEl.classList.contains("is-open");
    menuEl.classList.toggle("is-open", shouldOpen);
    menuEl.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  };

  const desktopAccountBtn = byId("desktopAccountBtn");
  const desktopAccountMenu = byId("desktopAccountMenu");
  const desktopAccountWrap = byId("desktopAccountWrap") || desktopAccountBtn?.closest(".tyfit-dropdown-wrap");
  if (desktopAccountBtn) {
    desktopAccountBtn.addEventListener("click", () => togglePopover(desktopAccountMenu));
  }
  if (desktopAccountWrap && desktopAccountMenu) {
    desktopAccountWrap.addEventListener("mouseenter", () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        desktopAccountMenu.classList.add("is-open");
        desktopAccountMenu.setAttribute("aria-hidden", "false");
      }
    });
    desktopAccountWrap.addEventListener("mouseleave", () => {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        desktopAccountMenu.classList.remove("is-open");
        desktopAccountMenu.setAttribute("aria-hidden", "true");
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest(".tyfit-dropdown-wrap")) return;
    document.querySelectorAll(".tyfit-popover-menu.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
      menu.setAttribute("aria-hidden", "true");
    });
  });

  if (desktopAccountMenu) {
    desktopAccountMenu.addEventListener("click", async (event) => {
      const actionBtn = event.target.closest(".tyfit-menu-action");
      if (!actionBtn) return;
      const action = actionBtn.dataset.action;
      if (action === "account") {
        window.location.href = "profile.html";
        return;
      }
      if (action === "logout") {
        try {
          if (window.supabaseClient?.auth) await window.supabaseClient.auth.signOut();
        } catch (error) {
          console.warn("Logout warning:", error?.message || error);
        }
        window.location.href = "login.html";
      }
    });
  }

  setIcons();
}

document.addEventListener("DOMContentLoaded", init);
