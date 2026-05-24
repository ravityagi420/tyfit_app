const DIET_STATE = {
    users: [],
    dietCharts: [],
    foodCatalog: [],
    selectedUserId: "",
    selectedChartId: "",
    addFoodTargetRow: null,
    mealCounter: 0,
    activeAdminId: "",
    currentUserId: "",
    isAdmin: false,
    canManageReplacements: false,
    isEditMode: false,
    hasUnsavedChanges: false,
    isSyncingView: false,
    swipeHandlersBound: false,
    reopenCatalogModalAfterCreateFood: false,
    viewMealMenuOutsideBound: false,
    skipChartMetaUpdate: false,
    currentChartData: null,
    chartInstance: null,
    pageStatusTimer: null,
    chartActionMenuOutsideBound: false,
    chartCreatorAdminMap: {},
    activeChartIsLocked: false,
    activeMealReplacementContext: null,
    catalogSearchSuggestionIndex: -1,
    selectedUserMeta: {
        bmr: null,
        tdee: null
    }
};

function refreshIcons() {
    if (typeof window.tyfitRefreshIcons === "function") {
        window.tyfitRefreshIcons();
        return;
    }
    refreshIcons();
}

function setDietDirty(isDirty) {
    DIET_STATE.hasUnsavedChanges = Boolean(isDirty);

    const saveBar = getEl("dietViewSaveBar");
    if (saveBar) {
        saveBar.style.display = DIET_STATE.hasUnsavedChanges ? "flex" : "none";
    }
}

function setViewSaveLoading(isLoading) {
    DIET_STATE.isSyncingView = Boolean(isLoading);

    const saveBtn = getEl("dietViewSaveBtn");
    if (!saveBtn) {
        return;
    }

    saveBtn.disabled = DIET_STATE.isSyncingView;
    saveBtn.innerHTML = DIET_STATE.isSyncingView
        ? '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...'
        : '<i class="fa fa-save mr-1"></i> Save';
}

function getEl(id) {
    return document.getElementById(id);
}

function getCatalogCustomOwnerId() {
    if (DIET_STATE.isAdmin) {
        return DIET_STATE.selectedUserId || DIET_STATE.currentChartData?.chart?.user_id || "";
    }
    return DIET_STATE.currentUserId || "";
}

function updateCustomFoodScopeUi() {
    const scopeSwitch = getEl("cfScopeGlobalSwitch");
    if (!scopeSwitch) {
        return;
    }
}

function showDietAlert(message, options = {}) {
    if (window.tyfitDialog?.alert) {
        return window.tyfitDialog.alert({
            message,
            ...options
        });
    }

    window.alert(message);
    return Promise.resolve(true);
}

function showDietConfirm(message, options = {}) {
    if (window.tyfitDialog?.confirm) {
        return window.tyfitDialog.confirm({
            message,
            ...options
        });
    }

    return Promise.resolve(window.confirm(message));
}

function toTitleCaseWords(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function hashText(value) {
    const text = String(value || "");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function resolveMealIcon(mealName, mealIndex, totalMeals) {
    const normalizedName = String(mealName || "").trim().toLowerCase();

    if (normalizedName.includes("breakfast")) return "sun";
    if (normalizedName.includes("lunch")) return "cooking-pot";
    if (normalizedName.includes("dinner")) return "moon-star";
    if (normalizedName.includes("snack")) return "donut";

    if (mealIndex === 0) return "sun";
    if (mealIndex === totalMeals - 1) return "moon-star";

    const randomPool = ["sandwich", "donut", "hamburger", "salad", "leafy-green"];
    const seed = `${normalizedName}:${mealIndex}:${totalMeals}`;
    return randomPool[hashText(seed) % randomPool.length];
}

function getViewMealLabelText(labelEl) {
    if (!labelEl) return "";
    const textEl = labelEl.querySelector(".diet-view-meal-label-text");
    if (textEl) return (textEl.textContent || "").trim();
    return (labelEl.textContent || "").trim();
}

function renderEditorMealIcons() {
    const mealCards = Array.from(document.querySelectorAll("#dietMealsContainer .meal-card"));
    const total = mealCards.length;

    mealCards.forEach((mealCard, index) => {
        const mealName = mealCard.querySelector(".diet-meal-name")?.value || `Meal ${index + 1}`;
        const iconName = resolveMealIcon(mealName, index, total);
        const iconWrap = mealCard.querySelector(".diet-meal-name-icon");
        if (!iconWrap) return;

        iconWrap.setAttribute("data-meal-icon", iconName);
        iconWrap.innerHTML = `<i data-lucide="${iconName}"></i>`;
    });

    refreshIcons();
}

function normalizeDietChartName(value) {
    return toTitleCaseWords(value);
}

function formatDietChartDisplayName(name) {
    const normalized = normalizeDietChartName(name);
    if (normalized.length <= 12) {
        return normalized;
    }
    return `${normalized.slice(0, 11)}...`;
}

function hexToRgba(hexColor, alpha = 1) {
    const hex = String(hexColor || "").replace("#", "").trim();
    if (!hex || (hex.length !== 6 && hex.length !== 3)) {
        return `rgba(15, 23, 42, ${alpha})`;
    }

    const normalized = hex.length === 3
        ? hex.split("").map((part) => `${part}${part}`).join("")
        : hex;

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDietPlanAccent(index) {
    const accents = ["#22c55e", "#f59e0b", "#3b82f6"];
    return accents[index % accents.length];
}

function formatChartCreatedLabel(createdAt) {
    if (!createdAt) {
        return "";
    }

    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) {
        return "";
    }

    const now = new Date();
    const isToday = createdDate.getFullYear() === now.getFullYear()
        && createdDate.getMonth() === now.getMonth()
        && createdDate.getDate() === now.getDate();

    if (isToday) {
        return "Today";
    }

    return createdDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getCurrentActorId() {
    return String(DIET_STATE.currentUserId || DIET_STATE.activeAdminId || "").trim();
}

function isCreatedByAdminOtherThanCurrent(chart) {
    const createdBy = String(chart?.created_by || "").trim();
    if (!createdBy) {
        return false;
    }

    if (createdBy === getCurrentActorId()) {
        return false;
    }

    if (Object.prototype.hasOwnProperty.call(DIET_STATE.chartCreatorAdminMap, createdBy)) {
        return Boolean(DIET_STATE.chartCreatorAdminMap[createdBy]);
    }

    // Fallback for strict RLS setups where role lookup is not visible to clients.
    if (!DIET_STATE.isAdmin) {
        return true;
    }

    return false;
}

function sortDietChartsForDisplay(charts) {
    const list = Array.isArray(charts) ? [...charts] : [];

    list.sort((left, right) => {
        const leftPinned = isCreatedByAdminOtherThanCurrent(left) ? 1 : 0;
        const rightPinned = isCreatedByAdminOtherThanCurrent(right) ? 1 : 0;

        if (leftPinned !== rightPinned) {
            return rightPinned - leftPinned;
        }

        const leftTime = new Date(left?.created_at || 0).getTime();
        const rightTime = new Date(right?.created_at || 0).getTime();
        return rightTime - leftTime;
    });

    return list;
}

function setActiveChartLockState(chart) {
    DIET_STATE.activeChartIsLocked = isCreatedByAdminOtherThanCurrent(chart);
}

function isActiveChartReadOnly() {
    return Boolean(DIET_STATE.activeChartIsLocked);
}

function guardActiveChartEditable(actionLabel = "modify this diet chart") {
    if (!isActiveChartReadOnly()) {
        return true;
    }

    showPageStatus(`This diet chart is pinned by admin and read-only. You cannot ${actionLabel}.`, "warning");
    return false;
}

function getChartById(chartId) {
    return (DIET_STATE.dietCharts || []).find((chart) => String(chart.id) === String(chartId)) || null;
}

function openDietChartInputModal(options = {}) {
    const overlay = getEl("dietChartInputOverlay");
    const titleEl = getEl("dietChartInputTitle");
    const labelEl = getEl("dietChartInputLabel");
    const inputEl = getEl("dietChartInputField");
    const confirmBtn = getEl("dietChartInputConfirmBtn");
    const confirmLabelEl = getEl("dietChartInputConfirmLabel");
    const closeBtn = getEl("dietChartInputClose");
    const cancelBtn = getEl("dietChartInputCancelBtn");
    const helperEl = getEl("dietChartInputHelper");
    const errorEl = getEl("dietChartInputError");

    if (!overlay || !titleEl || !labelEl || !inputEl || !confirmBtn || !confirmLabelEl || !closeBtn || !cancelBtn || !helperEl || !errorEl) {
        return Promise.resolve(null);
    }

    const maxLength = 12;
    titleEl.textContent = options.title || "Diet Chart";
    labelEl.textContent = options.label || "Diet chart name";
    confirmLabelEl.textContent = options.confirmLabel || "Save";
    inputEl.placeholder = options.placeholder || "Enter diet chart name";
    inputEl.value = normalizeDietChartName(options.defaultValue || "");
    inputEl.maxLength = 60;
    helperEl.textContent = "Maximum 12 characters";
    errorEl.hidden = true;
    errorEl.textContent = "";

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
        inputEl.focus();
        inputEl.select();
    });

    return new Promise((resolve) => {
        let done = false;

        const cleanup = () => {
            closeBtn.removeEventListener("click", onCancel);
            cancelBtn.removeEventListener("click", onCancel);
            confirmBtn.removeEventListener("click", onConfirm);
            overlay.removeEventListener("click", onBackdropClick);
            inputEl.removeEventListener("keydown", onKeydown);
            inputEl.removeEventListener("input", onInput);
        };

        const finish = (value) => {
            if (done) {
                return;
            }
            done = true;
            cleanup();
            overlay.hidden = true;
            overlay.setAttribute("aria-hidden", "true");
            resolve(value);
        };

        const showError = (message) => {
            errorEl.textContent = message;
            errorEl.hidden = false;
        };

        const onCancel = () => finish(null);

        const onConfirm = () => {
            const normalized = normalizeDietChartName(inputEl.value);
            if (!normalized) {
                showError("Diet chart name is required.");
                return;
            }

            if (normalized.length > maxLength) {
                showError("Max 12 characters allowed.");
                return;
            }

            finish(normalized);
        };

        const onInput = () => {
            const normalized = normalizeDietChartName(inputEl.value);
            if (normalized.length > maxLength) {
                showError("Max 12 characters allowed.");
                return;
            }

            errorEl.hidden = true;
            errorEl.textContent = "";
        };

        const onBackdropClick = (event) => {
            if (event.target === overlay) {
                onCancel();
            }
        };

        const onKeydown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
            }

            if (event.key === "Enter") {
                event.preventDefault();
                onConfirm();
            }
        };

        closeBtn.addEventListener("click", onCancel);
        cancelBtn.addEventListener("click", onCancel);
        confirmBtn.addEventListener("click", onConfirm);
        overlay.addEventListener("click", onBackdropClick);
        inputEl.addEventListener("keydown", onKeydown);
        inputEl.addEventListener("input", onInput);
    });
}

async function promptDietChartName(defaultValue = "", options = {}) {
    const value = await openDietChartInputModal({
        title: options.title || "New Diet Chart",
        label: "Diet chart name",
        placeholder: "Enter diet chart name",
        confirmLabel: options.confirmLabel || "Save",
        defaultValue
    });

    if (value === null) {
        return null;
    }

    return normalizeDietChartName(value);
}

function toNumber(value, defaultValue = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatMacro(value) {
    return toNumber(value, 0).toFixed(1).replace(/\.0$/, "");
}

function hideCatalogSearchSuggestions() {
    const suggestionEl = getEl("catalogSearchSuggestions");
    if (!suggestionEl) {
        return;
    }

    DIET_STATE.catalogSearchSuggestionIndex = -1;
    suggestionEl.innerHTML = "";
    suggestionEl.style.display = "none";
}

function highlightCatalogSearchSuggestion(index) {
    const suggestionEl = getEl("catalogSearchSuggestions");
    if (!suggestionEl) {
        return;
    }

    const buttons = Array.from(suggestionEl.querySelectorAll(".food-search-suggestion-item"));
    if (!buttons.length) {
        DIET_STATE.catalogSearchSuggestionIndex = -1;
        return;
    }

    const nextIndex = Math.max(0, Math.min(index, buttons.length - 1));
    buttons.forEach((button, idx) => {
        button.classList.toggle("is-active", idx === nextIndex);
    });

    DIET_STATE.catalogSearchSuggestionIndex = nextIndex;
}

function getCatalogSearchSuggestionNames(query) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) {
        return [];
    }

    const uniqueNames = [];
    const seen = new Set();

    DIET_STATE.foodCatalog.forEach((food) => {
        const foodName = String(food?.food_name || "").trim();
        if (!foodName) {
            return;
        }

        const key = foodName.toLowerCase();
        if (seen.has(key)) {
            return;
        }

        seen.add(key);
        uniqueNames.push(foodName);
    });

    return uniqueNames
        .filter((name) => name.toLowerCase().includes(normalizedQuery))
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))
        .slice(0, 8);
}

function renderCatalogSearchSuggestions(query) {
    const suggestionEl = getEl("catalogSearchSuggestions");
    if (!suggestionEl) {
        return;
    }

    const names = getCatalogSearchSuggestionNames(query);
    if (!names.length) {
        hideCatalogSearchSuggestions();
        return;
    }

    suggestionEl.innerHTML = names
        .map((name) => `<button type="button" class="food-search-suggestion-item" data-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
        .join("");
    suggestionEl.style.display = "block";
    DIET_STATE.catalogSearchSuggestionIndex = -1;
}

async function applyCatalogSearchSuggestion(name) {
    const foodSearchInput = getEl("foodSearchInput");
    if (!foodSearchInput) {
        return;
    }

    foodSearchInput.value = name;
    hideCatalogSearchSuggestions();
    await renderFoodCatalogModalList(name);
}

function showPageStatus(message, type = "info") {
    const statusEl = getEl("dietChartPageStatus");
    if (!statusEl) {
        return;
    }

    if (type === "info") {
        hidePageStatus();
        return;
    }

    if (DIET_STATE.pageStatusTimer) {
        window.clearTimeout(DIET_STATE.pageStatusTimer);
        DIET_STATE.pageStatusTimer = null;
    }

    statusEl.className = `alert alert-${type}`;
    statusEl.textContent = message;
    statusEl.style.display = "block";

    DIET_STATE.pageStatusTimer = window.setTimeout(() => {
        hidePageStatus();
    }, 10000);
}

function hidePageStatus() {
    const statusEl = getEl("dietChartPageStatus");
    if (!statusEl) {
        return;
    }

    if (DIET_STATE.pageStatusTimer) {
        window.clearTimeout(DIET_STATE.pageStatusTimer);
        DIET_STATE.pageStatusTimer = null;
    }

    statusEl.style.display = "none";
    statusEl.textContent = "";
    statusEl.className = "alert";
}

function showLoadingSpinner() {
    const spinnerEl = getEl("dietChartLoadingSpinner");
    if (spinnerEl) {
        spinnerEl.style.display = "flex";
    }
}

function hideLoadingSpinner() {
    const spinnerEl = getEl("dietChartLoadingSpinner");
    if (spinnerEl) {
        spinnerEl.style.display = "none";
    }
}

function setDietPagePending(isPending) {
    document.body.classList.remove("diet-auth-pending");
    window.requestAnimationFrame(() => {
        document.body.classList.add("diet-page-ready");
    });
}

function setDietUserToolbarVisible(isVisible) {
    const toolbar = getEl("dietUserToolbar");
    if (!toolbar) {
        return;
    }

    toolbar.hidden = !isVisible;
}

function getDietChartName(chart, index = 0) {
    const title = normalizeDietChartName(chart?.title || "");
    if (title) {
        return title;
    }

    return `Diet Chart ${index + 1}`;
}

function setSelectedDietChartName(name) {
    const titleEl = getEl("dietChartCurrentTitle");
    if (titleEl) {
        titleEl.textContent = normalizeDietChartName(name) || "Diet Chart";
    }
}

function renderDietChartSelector() {
    const wrap = getEl("dietChartSwitcher");
    const strip = getEl("dietChartStrip");

    if (!wrap || !strip) {
        return;
    }

    const hasUser = Boolean(DIET_STATE.selectedUserId);
    const charts = sortDietChartsForDisplay(DIET_STATE.dietCharts || []);

    wrap.hidden = !hasUser;

    if (!hasUser) {
        strip.innerHTML = "";
        setSelectedDietChartName("Diet Chart");
        return;
    }

    const planIcons = ["cookie", "utensils-crossed", "cooking-pot"];

    strip.innerHTML = charts.length > 0
        ? charts.map((chart, index) => {
            const active = String(chart.id) === String(DIET_STATE.selectedChartId) ? "is-active" : "";
            const createdLabel = formatChartCreatedLabel(chart.created_at);
            const iconName = planIcons[index % planIcons.length];
            const fullName = getDietChartName(chart, index);
            const accent = getDietPlanAccent(index);
            const accentSoft = hexToRgba(accent, 0.1);
            const accentLine = hexToRgba(accent, 0.24);
            const isPinnedReadOnly = isCreatedByAdminOtherThanCurrent(chart);
            return `<div class="tp-plan-card-wrap">
                <button type="button" class="tp-plan-card ${active}" data-chart-id="${chart.id}" title="${escapeHtml(fullName)}" style="--diet-accent:${accent};--diet-accent-soft:${accentSoft};--diet-accent-line:${accentLine};">
                    <span class="diet-plan-icon" aria-hidden="true"><i data-lucide="${iconName}"></i></span>
                    <strong>${escapeHtml(formatDietChartDisplayName(fullName))}</strong>
                    <span class="diet-plan-meta">
                        ${createdLabel ? `<small class="diet-plan-date"><i data-lucide="calendar-days" class="diet-plan-date-icon"></i>${escapeHtml(createdLabel)}</small>` : ""}
                    </span>
                </button>
                ${isPinnedReadOnly
                    ? `<button type="button" class="tp-plan-card-menu-btn is-pinned" data-chart-id="${chart.id}" aria-label="Pinned by admin" title="Pinned by admin" disabled style="--diet-accent:${accent};--diet-accent-soft:${accentSoft};--diet-accent-line:${accentLine};">
                        <i data-lucide="pin"></i>
                    </button>`
                    : `<button type="button" class="tp-plan-card-menu-btn js-card-menu-btn" data-chart-id="${chart.id}" aria-label="Chart options">
                        <i data-lucide="ellipsis-vertical"></i>
                    </button>
                    <div class="tp-plan-card-menu tyfit-popover-menu" hidden data-menu-chart-id="${chart.id}">
                        <button type="button" class="diet-chart-actions-item tyfit-menu-action" data-card-action="rename-chart" data-chart-id="${chart.id}">
                            <i data-lucide="pencil-line"></i> Rename
                        </button>
                        <button type="button" class="diet-chart-actions-item tyfit-menu-action danger" data-card-action="delete-chart" data-chart-id="${chart.id}">
                            <i data-lucide="trash-2"></i> Delete
                        </button>
                    </div>`
                }
            </div>`;
        }).join("")
        : '<div class="diet-chart-strip-empty">No diet charts yet</div>';

    if (charts.length < 3) {
        const createAccent = getDietPlanAccent(charts.length);
        const createAccentSoft = hexToRgba(createAccent, 0.16);
        const createAccentLine = hexToRgba(createAccent, 0.24);
        strip.innerHTML += `<button type="button" class="tp-plan-card tp-plan-create js-diet-chart-create" style="--diet-accent:${createAccent};--diet-accent-soft:${createAccentSoft};--diet-accent-line:${createAccentLine};"><span class="diet-plan-icon" aria-hidden="true"><i data-lucide="plus"></i></span><strong>New Plan</strong></button>`;
    }

    const selectedChart = charts.find((chart) => String(chart.id) === String(DIET_STATE.selectedChartId));
    if (selectedChart) {
        setSelectedDietChartName(getDietChartName(selectedChart));
    } else if (charts.length > 0) {
        setSelectedDietChartName(getDietChartName(charts[0]));
    } else {
        setSelectedDietChartName("No chart selected");
    }

    refreshIcons();
}

function closeDietChartActionsMenu() {
    const strip = getEl("dietChartStrip");
    if (strip) {
        strip.querySelectorAll(".tp-plan-card-menu").forEach((menu) => {
            menu.classList.remove("is-open");
            menu.hidden = true;
        });
    }

    closeDietChartCardActionSheet();
}

function isDietChartMobileMenuMode() {
    return window.matchMedia("(max-width: 767px)").matches;
}

function ensureDietChartCardActionSheet() {
    if (getEl("dietChartCardActionSheet")) {
        return;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <div class="tp-plan-card-sheet" id="dietChartCardActionSheet" hidden aria-hidden="true" data-chart-id="">
            <button type="button" class="tp-plan-card-sheet-backdrop" data-sheet-close aria-label="Close chart actions"></button>
            <section class="tp-plan-card-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="dietChartCardSheetTitle">
                <div class="tp-plan-card-sheet-head">
                    <p class="tp-plan-card-sheet-title" id="dietChartCardSheetTitle">Chart options</p>
                    <button type="button" class="tp-plan-card-sheet-close" data-sheet-close aria-label="Close"><i data-lucide="x"></i></button>
                </div>
                <div class="tp-plan-card-sheet-actions">
                    <button type="button" class="tp-plan-card-sheet-btn" data-sheet-action="rename"><i data-lucide="pencil-line"></i> Rename</button>
                    <button type="button" class="tp-plan-card-sheet-btn tp-plan-card-sheet-btn--danger" data-sheet-action="delete"><i data-lucide="trash-2"></i> Delete</button>
                </div>
            </section>
        </div>
    `);

    const sheet = getEl("dietChartCardActionSheet");
    if (!sheet) {
        return;
    }

    sheet.addEventListener("click", async (event) => {
        const closeTrigger = event.target.closest("[data-sheet-close]");
        if (closeTrigger) {
            closeDietChartCardActionSheet();
            return;
        }

        const actionBtn = event.target.closest("[data-sheet-action]");
        if (!actionBtn) {
            return;
        }

        const chartId = sheet.getAttribute("data-chart-id");
        if (!chartId) {
            closeDietChartCardActionSheet();
            return;
        }

        DIET_STATE.selectedChartId = chartId;
        closeDietChartCardActionSheet();

        if (actionBtn.getAttribute("data-sheet-action") === "rename") {
            await renameSelectedDietChart();
            return;
        }

        if (actionBtn.getAttribute("data-sheet-action") === "delete") {
            await deleteDietChart(chartId);
        }
    });

    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

function openDietChartCardActionSheet(chartId) {
    if (!chartId) {
        return;
    }

    ensureDietChartCardActionSheet();
    const sheet = getEl("dietChartCardActionSheet");
    if (!sheet) {
        return;
    }

    const chart = (DIET_STATE.dietCharts || []).find((item) => String(item.id) === String(chartId));
    const titleEl = getEl("dietChartCardSheetTitle");
    if (titleEl) {
        titleEl.textContent = chart ? `${getDietChartName(chart)} options` : "Chart options";
    }

    sheet.setAttribute("data-chart-id", String(chartId));
    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeDietChartCardActionSheet() {
    const sheet = getEl("dietChartCardActionSheet");
    if (!sheet) {
        return;
    }

    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    sheet.setAttribute("data-chart-id", "");
    document.body.style.overflow = "";
}

function isDietQtySheetMode() {
    return window.matchMedia("(max-width: 991px)").matches;
}

function ensureDietQtyActionSheet() {
    if (getEl("dietQtyActionSheet")) {
        return;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <div class="diet-qty-sheet" id="dietQtyActionSheet" hidden aria-hidden="true" data-meal-index="" data-item-index="">
            <button type="button" class="diet-qty-sheet-backdrop" data-qty-sheet-close aria-label="Close quantity editor"></button>
            <section class="diet-qty-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="dietQtySheetTitle">
                <div class="diet-qty-sheet-head">
                    <p class="diet-qty-sheet-title" id="dietQtySheetTitle">Edit quantity</p>
                    <button type="button" class="diet-qty-sheet-close" data-qty-sheet-close aria-label="Close">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <div class="diet-qty-sheet-body">
                    <label class="diet-qty-sheet-label" for="dietQtySheetInput">Quantity</label>
                    <div class="diet-qty-sheet-input-row">
                        <input type="number" id="dietQtySheetInput" class="diet-qty-sheet-input" min="0.01" step="0.01" inputmode="decimal" />
                        <span class="diet-qty-sheet-unit" id="dietQtySheetUnit"></span>
                    </div>
                </div>
                <div class="diet-qty-sheet-actions">
                    <button type="button" class="diet-qty-sheet-btn diet-qty-sheet-btn--ghost" data-qty-sheet-close>Cancel</button>
                    <button type="button" class="diet-qty-sheet-btn diet-qty-sheet-btn--primary" data-qty-sheet-save>Save</button>
                </div>
            </section>
        </div>
    `);

    const sheet = getEl("dietQtyActionSheet");
    const inputEl = getEl("dietQtySheetInput");
    if (!sheet || !inputEl) {
        return;
    }

    sheet.addEventListener("click", async (event) => {
        const closeTrigger = event.target.closest("[data-qty-sheet-close]");
        if (closeTrigger) {
            closeDietQtyActionSheet();
            return;
        }

        const saveTrigger = event.target.closest("[data-qty-sheet-save]");
        if (!saveTrigger) {
            return;
        }

        await saveDietQtyActionSheet();
    });

    inputEl.addEventListener("keydown", async (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeDietQtyActionSheet();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            await saveDietQtyActionSheet();
        }
    });
}

function openDietQtyActionSheet(details = {}) {
    ensureDietQtyActionSheet();

    const sheet = getEl("dietQtyActionSheet");
    const titleEl = getEl("dietQtySheetTitle");
    const inputEl = getEl("dietQtySheetInput");
    const unitEl = getEl("dietQtySheetUnit");
    if (!sheet || !titleEl || !inputEl || !unitEl) {
        return;
    }

    const mealIndex = Number(details.mealIndex);
    const itemIndex = Number(details.itemIndex);
    if (!Number.isFinite(mealIndex) || !Number.isFinite(itemIndex)) {
        return;
    }

    const foodName = String(details.foodName || "").trim();
    const qty = toNumber(details.currentQuantity, 0);
    const unit = String(details.unit || "").trim();

    sheet.setAttribute("data-meal-index", String(mealIndex));
    sheet.setAttribute("data-item-index", String(itemIndex));
    titleEl.textContent = foodName ? `Edit quantity - ${foodName}` : "Edit quantity";
    inputEl.value = qty > 0 ? formatMacro(qty) : "";
    unitEl.textContent = unit;
    unitEl.style.display = unit ? "inline-flex" : "none";

    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 30);
}

function closeDietQtyActionSheet() {
    const sheet = getEl("dietQtyActionSheet");
    if (!sheet) {
        return;
    }

    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    sheet.setAttribute("data-meal-index", "");
    sheet.setAttribute("data-item-index", "");
    document.body.style.overflow = "";
}

async function saveDietQtyActionSheet() {
    const sheet = getEl("dietQtyActionSheet");
    const inputEl = getEl("dietQtySheetInput");
    if (!sheet || !inputEl) {
        return;
    }

    const mealIndex = parseInt(sheet.getAttribute("data-meal-index") || "", 10);
    const itemIndex = parseInt(sheet.getAttribute("data-item-index") || "", 10);
    const nextQty = toNumber(inputEl.value, 0);

    if (!Number.isFinite(mealIndex) || !Number.isFinite(itemIndex)) {
        return;
    }

    if (nextQty <= 0) {
        await showDietAlert("Quantity must be greater than 0.", { title: "Invalid Quantity" });
        inputEl.focus();
        inputEl.select();
        return;
    }

    await updateFoodItemQuantity(mealIndex, itemIndex, nextQty);
    closeDietQtyActionSheet();
}

function isCatalogQtySheetMode() {
    return window.matchMedia("(max-width: 991px)").matches;
}

function ensureCatalogQtyActionSheet() {
    if (getEl("catalogQtyActionSheet")) {
        return;
    }

    const sheetHost = getEl("selectFoodModal") || document.body;

    sheetHost.insertAdjacentHTML("beforeend", `
        <div class="diet-catalog-qty-sheet" id="catalogQtyActionSheet" hidden aria-hidden="true" data-food-id="">
            <button type="button" class="diet-catalog-qty-sheet-backdrop" data-catalog-qty-sheet-close aria-label="Close quantity editor"></button>
            <section class="diet-catalog-qty-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="catalogQtySheetTitle">
                <div class="diet-catalog-qty-sheet-head">
                    <p class="diet-catalog-qty-sheet-title" id="catalogQtySheetTitle">Set quantity</p>
                    <button type="button" class="diet-catalog-qty-sheet-close" data-catalog-qty-sheet-close aria-label="Close">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <div class="diet-catalog-qty-sheet-body">
                    <label class="diet-catalog-qty-sheet-label" for="catalogQtySheetInput">Quantity</label>
                    <div class="diet-catalog-qty-sheet-input-row">
                        <input type="number" id="catalogQtySheetInput" class="diet-catalog-qty-sheet-input" min="0.01" step="0.01" inputmode="decimal" />
                        <span class="diet-catalog-qty-sheet-unit" id="catalogQtySheetUnit"></span>
                    </div>
                </div>
                <div class="diet-catalog-qty-sheet-actions">
                    <button type="button" class="diet-catalog-qty-sheet-btn diet-catalog-qty-sheet-btn--ghost" data-catalog-qty-sheet-close>Cancel</button>
                    <button type="button" class="diet-catalog-qty-sheet-btn diet-catalog-qty-sheet-btn--primary" data-catalog-qty-sheet-save>Save</button>
                </div>
            </section>
        </div>
    `);

    const sheet = getEl("catalogQtyActionSheet");
    const inputEl = getEl("catalogQtySheetInput");
    if (!sheet || !inputEl) {
        return;
    }

    sheet.addEventListener("click", async (event) => {
        const closeTrigger = event.target.closest("[data-catalog-qty-sheet-close]");
        if (closeTrigger) {
            closeCatalogQtyActionSheet();
            return;
        }

        const saveTrigger = event.target.closest("[data-catalog-qty-sheet-save]");
        if (!saveTrigger) {
            return;
        }

        await saveCatalogQtyActionSheet();
    });

    inputEl.addEventListener("keydown", async (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeCatalogQtyActionSheet();
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            await saveCatalogQtyActionSheet();
        }
    });
}

function openCatalogQtyActionSheet(details = {}) {
    ensureCatalogQtyActionSheet();

    const sheet = getEl("catalogQtyActionSheet");
    const titleEl = getEl("catalogQtySheetTitle");
    const inputEl = getEl("catalogQtySheetInput");
    const unitEl = getEl("catalogQtySheetUnit");
    if (!sheet || !titleEl || !inputEl || !unitEl) {
        return;
    }

    const foodId = String(details.foodId || "").trim();
    if (!foodId) {
        return;
    }

    const foodName = String(details.foodName || "").trim();
    const qty = toNumber(details.currentQuantity, 0);
    const unit = String(details.unit || "").trim();

    sheet.setAttribute("data-food-id", foodId);
    titleEl.textContent = foodName ? `Set quantity - ${foodName}` : "Set quantity";
    inputEl.value = qty > 0 ? formatMacro(qty) : "";
    unitEl.textContent = unit;
    unitEl.style.display = unit ? "inline-flex" : "none";

    sheet.hidden = false;
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    window.setTimeout(() => {
        inputEl.focus();
        inputEl.select();
    }, 30);
}

function closeCatalogQtyActionSheet() {
    const sheet = getEl("catalogQtyActionSheet");
    if (!sheet) {
        return;
    }

    sheet.hidden = true;
    sheet.setAttribute("aria-hidden", "true");
    sheet.setAttribute("data-food-id", "");
    document.body.style.overflow = "";
}

async function saveCatalogQtyActionSheet() {
    const sheet = getEl("catalogQtyActionSheet");
    const inputEl = getEl("catalogQtySheetInput");
    if (!sheet || !inputEl) {
        return;
    }

    const foodId = sheet.getAttribute("data-food-id") || "";
    const nextQty = toNumber(inputEl.value, 0);

    if (!foodId) {
        return;
    }

    if (nextQty <= 0) {
        await showDietAlert("Quantity must be greater than 0.", { title: "Invalid Quantity" });
        inputEl.focus();
        inputEl.select();
        return;
    }

    const rowInput = document.querySelector(`.food-catalog-qty-input[data-food-id="${foodId}"]`);
    if (rowInput) {
        rowInput.value = formatMacro(nextQty);
    }

    closeCatalogQtyActionSheet();
}

async function resolveActorUserId() {
    if (DIET_STATE.activeAdminId) {
        return DIET_STATE.activeAdminId;
    }

    if (DIET_STATE.currentUserId) {
        return DIET_STATE.currentUserId;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.getUser();
        if (error) {
            return "";
        }

        return data?.user?.id || "";
    } catch (error) {
        console.warn("resolveActorUserId warning:", error?.message || error);
        return "";
    }
}

function setEditorVisibility(showEditor) {
    const editorEl = getEl("dietChartEditor");
    const viewEl = getEl("dietChartView");
    const emptyStateEl = getEl("dietChartEmptyState");
    const viewBtn = getEl("dietViewModeBtn");
    const editBtn = getEl("dietEditModeBtn");
    const chartReadOnly = isActiveChartReadOnly();

    if (chartReadOnly) {
        DIET_STATE.isEditMode = false;
    }

    if (viewBtn) {
        viewBtn.style.display = showEditor ? "inline-flex" : "none";
        viewBtn.classList.toggle("active", !DIET_STATE.isEditMode);
    }

    if (editBtn) {
        editBtn.style.display = showEditor && !chartReadOnly ? "inline-flex" : "none";
        editBtn.classList.toggle("active", DIET_STATE.isEditMode);
    }

    if (!showEditor) {
        if (editorEl) {
            editorEl.style.display = "none";
        }

        if (viewEl) {
            viewEl.style.display = "none";
        }

        if (emptyStateEl) {
            emptyStateEl.style.display = "block";
        }

        const deleteBtnHidden = getEl("deleteDietChartBtn");
        if (deleteBtnHidden) {
            deleteBtnHidden.style.display = "none";
        }

        setDietDirty(false);

        return;
    }

    if (editorEl) {
        editorEl.style.display = DIET_STATE.isEditMode ? "block" : "none";
    }

    if (viewEl) {
        viewEl.style.display = DIET_STATE.isEditMode ? "none" : "block";
    }

    if (emptyStateEl) {
        emptyStateEl.style.display = "none";
    }

    const deleteBtn = getEl("deleteDietChartBtn");
    if (deleteBtn) {
        deleteBtn.style.display = DIET_STATE.isEditMode && DIET_STATE.selectedChartId && !chartReadOnly ? "inline-flex" : "none";
    }
}

function setDietMode(isEditMode) {
    DIET_STATE.isEditMode = Boolean(isEditMode) && !isActiveChartReadOnly();

    const hasChart = Boolean(DIET_STATE.selectedChartId) || (DIET_STATE.currentChartData && DIET_STATE.selectedUserId);
    setEditorVisibility(Boolean(hasChart));
}

function getComputedFromItem(item) {
    const quantity = toNumber(item?.quantity, 0);
    const referenceQuantity = toNumber(item?.reference_quantity, 0);
    const factor = referenceQuantity > 0 ? quantity / referenceQuantity : 0;

    const carbs = toNumber(item?.reference_carbs, 0) * factor;
    const protein = toNumber(item?.reference_protein, 0) * factor;
    const fats = toNumber(item?.reference_fat, 0) * factor;
    const fibre = toNumber(item?.reference_fibre, 0) * factor;
    const calories = (carbs * 4) + (protein * 4) + (fats * 9);

    return { carbs, protein, fats, fibre, calories };
}

function hasFibreValue(item) {
    return item?.reference_fibre !== null && item?.reference_fibre !== undefined && item?.reference_fibre !== "";
}

function canManageMealReplacements() {
    return Boolean(DIET_STATE.isAdmin);
}

function getMealReplacementBundle(chartData, mealId) {
    if (!mealId) {
        return { replacement: null, items: [] };
    }

    const byMealId = chartData?.replacementsByMealId || {};
    return byMealId[mealId] || byMealId[String(mealId)] || { replacement: null, items: [] };
}

function normalizeReplacementItem(item, index = 0) {
    return {
        id: item?.id || "",
        meal_id: item?.meal_id || item?.diet_chart_meal_id || "",
        name: item?.name || item?.replacement_name || item?.title || item?.food_name || "Replacement",
        total_calories: toNumber(item?.total_calories ?? item?.calories ?? item?.reference_calories, 0),
        total_protein: toNumber(item?.total_protein ?? item?.protein ?? item?.reference_protein, 0),
        details: item?.details || item?.description || item?.notes || item?.text || "",
        sort_order: toNumber(item?.sort_order, index + 1)
    };
}

const REPLACEMENT_THEME_KEYS = ["green", "red", "blue", "yellow", "purple"];
const REPLACEMENT_FOOD_ICONS = ["sandwich", "soup", "salad", "cooking-pot", "wheat", "apple"];

function getReplacementThemeKey(index = 0) {
    return REPLACEMENT_THEME_KEYS[index % REPLACEMENT_THEME_KEYS.length];
}

function getReplacementFoodIcon(index = 0) {
    return REPLACEMENT_FOOD_ICONS[index % REPLACEMENT_FOOD_ICONS.length];
}

function buildReplacementIngredientsHtml(details = "") {
    const lines = String(details)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const items = (lines.length ? lines : [details || "-"])
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");

    return `<ul class="diet-replacement-ingredients-list">${items}</ul>`;
}

function buildMealReplacementRowHtml(rowData = {}, rowIndex = 0) {
    const theme = getReplacementThemeKey(rowIndex);
    const foodIcon = getReplacementFoodIcon(rowIndex);

    return `
        <div class="diet-replacement-row diet-replacement-theme-${theme}" data-replacement-row>
            <div class="diet-replacement-row-head">
                <div class="diet-replacement-row-icon" aria-hidden="true"><i data-lucide="${foodIcon}"></i></div>
                <div class="diet-replacement-row-name-wrap">
                    <input type="text" class="form-control form-control-sm js-replacement-name" value="${escapeHtml(rowData.name || "")}" placeholder="Replacement name">
                </div>
                <button type="button" class="diet-replacement-row-delete" aria-label="Delete replacement" title="Delete replacement">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="diet-replacement-metrics-grid">
                <div class="diet-replacement-metric-card">
                    <div class="diet-replacement-metric-label"><i data-lucide="flame"></i> Total Calories</div>
                    <div class="diet-replacement-input-wrapper">
                        <input type="number" class="form-control form-control-sm js-replacement-calories" min="0" step="0.1" value="${formatMacro(rowData.total_calories || 0)}" placeholder="0">
                        <span class="diet-replacement-input-label">kCal</span>
                    </div>
                </div>
                <div class="diet-replacement-metric-card">
                    <div class="diet-replacement-metric-label"><i data-lucide="leaf"></i> Total Protein</div>
                    <div class="diet-replacement-input-wrapper">
                        <input type="number" class="form-control form-control-sm js-replacement-protein" min="0" step="0.1" value="${formatMacro(rowData.total_protein || 0)}" placeholder="0">
                        <span class="diet-replacement-input-label">g</span>
                    </div>
                </div>
            </div>
            <div class="diet-replacement-text-wrap">
                <textarea class="form-control js-replacement-text" rows="4" placeholder="Add one ingredient per line">${escapeHtml(rowData.details || "")}</textarea>
            </div>
        </div>
    `;
}

function buildMealReplacementViewCardHtml(rowData = {}, rowIndex = 0) {
    const theme = getReplacementThemeKey(rowIndex);
    const foodIcon = getReplacementFoodIcon(rowIndex);
    const ingredientsHtml = buildReplacementIngredientsHtml(rowData.details || "");

    return `
        <article class="diet-replacement-card diet-replacement-theme-${theme}">
            <div class="diet-replacement-card-head">
                <div class="diet-replacement-card-icon" aria-hidden="true"><i data-lucide="${foodIcon}"></i></div>
                <div class="diet-replacement-card-title-wrap">
                    <div class="diet-replacement-card-title">${escapeHtml(rowData.name || "Replacement")}</div>
                </div>
            </div>
            <div class="diet-replacement-card-grid">
                <div class="diet-replacement-card-stat">
                    <div class="diet-replacement-card-stat-label"><i data-lucide="flame"></i> Total Calories</div>
                    <div class="diet-replacement-card-stat-value">${formatMacro(rowData.total_calories || 0)} kCal</div>
                </div>
                <div class="diet-replacement-card-stat">
                    <div class="diet-replacement-card-stat-label"><i data-lucide="leaf"></i> Total Protein</div>
                    <div class="diet-replacement-card-stat-value">${formatMacro(rowData.total_protein || 0)} g</div>
                </div>
            </div>
            <div class="diet-replacement-card-ingredients">
                <div class="diet-replacement-card-ingredients-label">INGREDIENTS</div>
                ${ingredientsHtml}
            </div>
        </article>
    `;
}

function buildMealReplacementEmptyHtml(message) {
    return `<div class="diet-replacement-empty">${escapeHtml(message)}</div>`;
}

function getMealReplacementFormRows() {
    return Array.from(document.querySelectorAll("#dietMealReplacementRows .diet-replacement-row"));
}

function getMealReplacementRowPayload(row) {
    const nameInput = row.querySelector(".js-replacement-name");
    const caloriesInput = row.querySelector(".js-replacement-calories");
    const proteinInput = row.querySelector(".js-replacement-protein");
    const textInput = row.querySelector(".js-replacement-text");

    return {
        name: nameInput?.value.trim() || "",
        totalCalories: toNumber(caloriesInput?.value, 0),
        totalProtein: toNumber(proteinInput?.value, 0),
        details: textInput?.value.trim() || ""
    };
}

function createReplacementRowHtml(rowData = {}) {
    const list = getEl("dietMealReplacementRows");
    const index = list?.querySelectorAll(".diet-replacement-row").length || 0;
    return buildMealReplacementRowHtml(rowData, index);
}

function ensureDietMealReplacementModal() {
    if (getEl("dietMealReplacementOverlay")) {
        return;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <div class="diet-meal-replacement-overlay tp-modal-overlay" id="dietMealReplacementOverlay" hidden aria-hidden="true">
            <button type="button" class="diet-meal-replacement-backdrop" data-replacement-close aria-label="Close replacement dialog"></button>
            <section class="diet-meal-replacement-modal tp-modal" role="dialog" aria-modal="true" aria-labelledby="dietMealReplacementTitle">
                <header class="diet-meal-replacement-header tp-modal-header">
                    <div class="diet-meal-replacement-title-wrap tp-modal-header-main">
                        <p class="diet-meal-replacement-badge-title tp-modal-badge"><i data-lucide="repeat-2"></i> Replacements</p>
                        <h3 id="dietMealReplacementTitle">Meal Replacements</h3>
                        <p class="diet-meal-replacement-subtitle" id="dietMealReplacementSubtitle" hidden></p>
                    </div>
                    <button type="button" class="diet-meal-replacement-close tp-modal-close" data-replacement-close aria-label="Close">
                        <i data-lucide="x"></i>
                    </button>
                </header>
                <div class="diet-meal-replacement-body tp-modal-body" id="dietMealReplacementBody"></div>
            </section>
        </div>
    `);

    const overlay = getEl("dietMealReplacementOverlay");
    if (!overlay) {
        return;
    }

    overlay.addEventListener("click", async (event) => {
        const closeBtn = event.target.closest("[data-replacement-close]");
        if (closeBtn) {
            closeDietMealReplacementModal();
            return;
        }

        if (event.target.closest("#dietMealReplacementAddRow")) {
            const list = getEl("dietMealReplacementRows");
            if (list) {
                list.insertAdjacentHTML("beforeend", createReplacementRowHtml());
            }
            return;
        }

        const rowDeleteBtn = event.target.closest(".diet-replacement-row-delete");
        if (rowDeleteBtn) {
            rowDeleteBtn.closest(".diet-replacement-row")?.remove();
            return;
        }

        if (event.target.closest("#dietMealReplacementSaveBtn")) {
            await saveMealReplacementFromModal();
            return;
        }

        if (event.target.closest("#dietMealReplacementDeleteBtn")) {
            await deleteMealReplacementFromModal();
        }
    });

    refreshIcons();
}

function openDietMealReplacementModal({ mealIndex, mode = "view" }) {
    const chartData = DIET_STATE.currentChartData;
    const meal = chartData?.meals?.[mealIndex] || null;
    const mealId = meal?.id || "";

    if (!mealId) {
        showDietAlert("Meal replacement is unavailable for this meal.", { title: "Unavailable" });
        return;
    }

    ensureDietMealReplacementModal();

    const overlay = getEl("dietMealReplacementOverlay");
    const titleEl = getEl("dietMealReplacementTitle");
    const subtitleEl = getEl("dietMealReplacementSubtitle");
    const bodyEl = getEl("dietMealReplacementBody");

    if (!overlay || !titleEl || !bodyEl || !subtitleEl) {
        return;
    }

    const bundle = getMealReplacementBundle(chartData, mealId);
    const items = (bundle.items || []).map((item, index) => normalizeReplacementItem(item, index));
    const mealName = meal?.meal_name || `Meal ${mealIndex + 1}`;

    DIET_STATE.activeMealReplacementContext = {
        mealIndex,
        mealId,
        mode
    };

    titleEl.textContent = `${mealName} Replacements`;

    if (mode === "manage") {
        subtitleEl.hidden = false;
        subtitleEl.textContent = "Manage meal replacements";
        bodyEl.innerHTML = `
                <button type="button" class="diet-replacement-add-row" id="dietMealReplacementAddRow">+ Add</button>
                <div id="dietMealReplacementRows" class="diet-replacement-rows">
                    ${(items.length ? items : [{}]).map((item, index) => buildMealReplacementRowHtml(item, index)).join("")}
                </div>
                <div class="diet-replacement-actions">
                    <button type="button" class="tp-btn tp-btn-primary" id="dietMealReplacementSaveBtn">Save Replacements</button>
                </div>
        `;
    } else {
        subtitleEl.hidden = true;
        subtitleEl.textContent = "";
        if (!items.length) {
            bodyEl.innerHTML = buildMealReplacementEmptyHtml("No replacements have been added for this meal yet.");
        } else {
            bodyEl.innerHTML = `
                <div class="diet-replacement-view-grid">
                    ${items.map((item, index) => buildMealReplacementViewCardHtml(item, index)).join("")}
                </div>
                <p class="diet-replacement-view-note">These are healthy alternatives for your convenience.</p>
            `;
        }
    }

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    refreshIcons();
}

function closeDietMealReplacementModal() {
    const overlay = getEl("dietMealReplacementOverlay");
    if (!overlay) {
        return;
    }

    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    DIET_STATE.activeMealReplacementContext = null;
    document.body.style.overflow = "";
}

async function reloadCurrentDietChartView() {
    if (!DIET_STATE.selectedChartId) {
        return;
    }

    const reloadedChart = await loadDietChart(DIET_STATE.selectedChartId);
    DIET_STATE.currentChartData = reloadedChart;
    renderDietChartView(reloadedChart);
}

async function saveMealReplacementFromModal() {
    const context = DIET_STATE.activeMealReplacementContext;
    if (!context?.mealId) {
        return;
    }

    const rows = getMealReplacementFormRows();
    if (!rows.length) {
        await showDietAlert("Add at least one replacement card.", { title: "Validation" });
        return;
    }

    const payloadRows = [];

    for (let index = 0; index < rows.length; index += 1) {
        const payload = getMealReplacementRowPayload(rows[index]);

        if (!payload.name) {
            await showDietAlert("Please enter a replacement name for every card.", { title: "Validation" });
            return;
        }

        if (payload.totalCalories <= 0) {
            await showDietAlert("Total calories must be greater than 0 for every card.", { title: "Validation" });
            return;
        }

        if (payload.totalProtein < 0) {
            await showDietAlert("Total protein cannot be negative.", { title: "Validation" });
            return;
        }

        if (!payload.details) {
            await showDietAlert("Please add supporting text for every replacement card.", { title: "Validation" });
            return;
        }

        payloadRows.push({
            diet_chart_meal_id: context.mealId,
            title: payload.name,
            name: payload.name,
            total_calories: payload.totalCalories,
            total_protein: payload.totalProtein,
            details: payload.details,
            sort_order: index + 1,
            updated_at: new Date().toISOString()
        });
    }

    const saveBtn = getEl("dietMealReplacementSaveBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...';
    }

    try {
        const { error: deleteExistingError } = await window.supabaseClient
            .from("meal_replacements")
            .delete()
            .eq("diet_chart_meal_id", context.mealId);

        if (deleteExistingError) {
            throw new Error(deleteExistingError.message || "Failed to clear existing replacements.");
        }

        const { error: insertReplacementError } = await window.supabaseClient
            .from("meal_replacements")
            .insert(payloadRows);

        if (insertReplacementError) {
            throw new Error(insertReplacementError.message || "Failed to save replacement cards.");
        }

        await reloadCurrentDietChartView();
        closeDietMealReplacementModal();
        showPageStatus("Meal replacements saved successfully.", "success");
    } catch (error) {
        console.error("saveMealReplacementFromModal error:", error);
        await showDietAlert(error.message || "Failed to save meal replacements.", { title: "Save Failed" });
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = "Save Replacements";
        }
    }
}

async function deleteMealReplacementFromModal() {
    const context = DIET_STATE.activeMealReplacementContext;
    if (!context?.mealId) {
        return;
    }

    const confirmed = await showDietConfirm("Delete all replacements for this meal?", {
        title: "Delete Replacements",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        danger: true
    });

    if (!confirmed) {
        return;
    }

    try {
        const { error: deleteReplacementError } = await window.supabaseClient
            .from("meal_replacements")
            .delete()
            .eq("diet_chart_meal_id", context.mealId);

        if (deleteReplacementError) {
            throw new Error(deleteReplacementError.message || "Failed to delete replacements.");
        }

        await reloadCurrentDietChartView();
        closeDietMealReplacementModal();
        showPageStatus("Meal replacements deleted.", "success");
    } catch (error) {
        console.error("deleteMealReplacementFromModal error:", error);
        await showDietAlert(error.message || "Failed to delete meal replacements.", { title: "Delete Failed" });
    }
}

async function loadMealReplacementsByMealIds(mealIds) {
    const emptyResult = {};
    if (!Array.isArray(mealIds) || mealIds.length === 0) {
        return emptyResult;
    }

    const { data: replacements, error: replacementsError } = await window.supabaseClient
        .from("meal_replacements")
        .select("*")
        .in("diet_chart_meal_id", mealIds);

    if (replacementsError) {
        console.error("loadMealReplacementsByMealIds replacements error:", replacementsError);
        return emptyResult;
    }

    if (!Array.isArray(replacements) || replacements.length === 0) {
        return emptyResult;
    }

    const sortedReplacements = [...replacements].sort((left, right) => {
        const leftOrder = toNumber(left?.sort_order, 0);
        const rightOrder = toNumber(right?.sort_order, 0);

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        const leftTime = new Date(left?.updated_at || left?.created_at || 0).getTime();
        const rightTime = new Date(right?.updated_at || right?.created_at || 0).getTime();
        return leftTime - rightTime;
    });

    sortedReplacements.forEach((replacement) => {
        const mealId = replacement.diet_chart_meal_id;
        if (!mealId) {
            return;
        }

        const normalizedReplacement = normalizeReplacementItem(replacement, 0);
        const currentItems = emptyResult[mealId]?.items || [];

        emptyResult[mealId] = {
            replacement,
            items: [...currentItems, normalizedReplacement]
        };
    });

    return emptyResult;
}

async function loadSelectedUserMeta(userId) {
    if (!userId) {
        DIET_STATE.selectedUserMeta = { bmr: null, tdee: null };
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("bmr, tdee")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("loadSelectedUserMeta error:", error);
        DIET_STATE.selectedUserMeta = { bmr: null, tdee: null };
        return;
    }

    DIET_STATE.selectedUserMeta = {
        bmr: data?.bmr ?? null,
        tdee: data?.tdee ?? null
    };
}

function renderDietChartView(chartData) {
        const viewEl = getEl("dietChartView");
        if (!viewEl) {
            return;
        }

        DIET_STATE.currentChartData = chartData;
        const chartTitle = getDietChartName(chartData?.chart) || "Diet Chart";
        const chartHeading = `Diet Chart - ${chartTitle}`;
    setSelectedDietChartName(chartTitle);

        const meals = chartData?.meals || [];
        const chartReadOnly = isActiveChartReadOnly();
        const canEditChart = !chartReadOnly;
        const hasFoodItems = meals.some((meal) => Array.isArray(meal?.items) && meal.items.length > 0);
        let overall = { carbs: 0, protein: 0, fats: 0, calories: 0 };

        const totalMeals = meals.length;
        const mealsHtml = meals.map((meal, mealIndex) => {
            let mealTotals = { carbs: 0, protein: 0, fats: 0, calories: 0 };
            const mealLabel = toTitleCaseWords(meal.meal_name || `Meal ${mealIndex + 1}`) || `Meal ${mealIndex + 1}`;
            const mealIcon = resolveMealIcon(mealLabel, mealIndex, totalMeals);
            const mealReplacements = getMealReplacementBundle(chartData, meal.id);
            const hasMealReplacements = (mealReplacements.items || []).length > 0;
            const replacementActionLabel = canManageMealReplacements()
                ? (hasMealReplacements ? "Edit Replacements" : "Add Replacements")
                : "View Replacements";
            const replacementActionLabelSafe = canEditChart ? replacementActionLabel : "View Replacements";

            const itemCards = (meal.items || []).map((item, itemIndex) => {
                const computed = getComputedFromItem(item);
                mealTotals.carbs += computed.carbs;
                mealTotals.protein += computed.protein;
                mealTotals.fats += computed.fats;
                mealTotals.calories += computed.calories;

                return `
                    <div class="diet-view-item">
                        <div class="diet-view-item-card">
                            <div class="diet-view-item-top">
                                <div class="diet-view-item-title">
                                    <span class="diet-item-dot"></span>
                                    <span class="diet-view-item-name">${escapeHtml(item.food_name || "-")}</span>
                                </div>
                                <div class="diet-view-item-calories">${formatMacro(computed.calories)} kcal</div>
                            </div>
                            <div class="diet-view-item-qty" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" data-current-quantity="${formatMacro(item.quantity)}">
                                <div class="diet-item-qty-display">
                                    <span class="diet-item-quantity">${formatMacro(item.quantity)}</span>
                                    <span class="diet-item-unit">${escapeHtml(item.quantity_unit || item.reference_unit || "")}</span>
                                    ${canEditChart
                                        ? `<button type="button" class="diet-item-qty-edit-btn" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" aria-label="Edit quantity" title="Edit quantity">
                                            <i class="fa fa-pen"></i>
                                        </button>`
                                        : ""
                                    }
                                </div>
                                <div class="diet-item-qty-editor">
                                    <input type="number" class="diet-item-qty-input" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" value="${formatMacro(item.quantity)}" min="0.01" step="0.01" aria-label="Quantity">
                                    <span class="diet-item-unit">${escapeHtml(item.quantity_unit || item.reference_unit || "")}</span>
                                    <button type="button" class="diet-item-qty-save-btn" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" aria-label="Save quantity" title="Save quantity">
                                        <i class="fa fa-check"></i>
                                    </button>
                                    <button type="button" class="diet-item-qty-cancel-btn" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" aria-label="Cancel quantity edit" title="Cancel">
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="diet-view-item-macros">
                                <span class="diet-view-macro carbs"><i class="fa fa-bolt"></i> C:${formatMacro(computed.carbs)} g</span>
                                <span class="diet-view-macro protein"><i class="fa fa-dumbbell"></i> P:${formatMacro(computed.protein)} g</span>
                                <span class="diet-view-macro fats"><i class="fa fa-tint"></i> F:${formatMacro(computed.fats)} g</span>
                                ${canEditChart
                                    ? `<div class="diet-view-item-actions">
                                        <button type="button" class="diet-item-delete-btn" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" aria-label="Delete food item">
                                            <i class="fa fa-trash-alt"></i>
                                        </button>
                                    </div>`
                                    : ""
                                }
                            </div>
                            ${canEditChart
                                ? `<div class="diet-swipe-overlay">
                                    <i class="fa fa-trash-alt"></i>
                                </div>`
                                : ""
                            }
                        </div>
                    </div>
                `;
            }).join("");

            overall.carbs += mealTotals.carbs;
            overall.protein += mealTotals.protein;
            overall.fats += mealTotals.fats;
            overall.calories += mealTotals.calories;

            return `
                <div class="diet-view-meal-block">
                    <div class="diet-view-meal-header">
                        <div class="diet-view-meal-label-wrap">
                            <span class="diet-view-meal-label js-meal-name-label" data-meal-index="${mealIndex}"><i data-lucide="${mealIcon}" class="diet-view-meal-icon" aria-hidden="true"></i><span class="diet-view-meal-label-text">${escapeHtml(mealLabel)}</span></span>
                            ${hasMealReplacements
                                ? `<button type="button" class="diet-meal-replacement-badge js-meal-replacements-open" data-meal-index="${mealIndex}" aria-label="View meal alternatives" title="View meal alternatives"><i data-lucide="repeat-2"></i><span>${mealReplacements.items.length}</span></button>`
                                : ""
                            }
                            <div class="diet-meal-name-edit-wrap" style="display: none;">
                                <input type="text" class="form-control form-control-sm diet-meal-name-inline-input" data-meal-index="${mealIndex}" value="${escapeHtml(mealLabel)}">
                                <button type="button" class="diet-meal-name-save-btn" data-meal-index="${mealIndex}" aria-label="Save meal name" title="Save meal name">
                                    <i class="fa fa-check"></i>
                                </button>
                            </div>
                        </div>
                        <div class="diet-view-meal-header-actions">
                            ${canEditChart
                                ? `<button type="button" class="diet-meal-add-btn" data-meal-index="${mealIndex}" aria-label="Add food item">
                                    <i class="fa fa-plus"></i>
                                </button>
                                <div class="diet-meal-menu-wrap" data-meal-index="${mealIndex}">
                                    <button type="button" class="diet-meal-menu-btn" data-meal-index="${mealIndex}" aria-label="Meal actions" aria-expanded="false">
                                        <i class="fa fa-ellipsis-v"></i>
                                    </button>
                                    <div class="diet-meal-menu" data-meal-index="${mealIndex}">
                                        <button type="button" class="diet-meal-menu-item js-meal-action-replacements" data-meal-index="${mealIndex}">
                                            <i class="fa fa-random"></i> ${replacementActionLabelSafe}
                                        </button>
                                        <button type="button" class="diet-meal-menu-item js-meal-action-edit" data-meal-index="${mealIndex}">
                                            <i class="fa fa-pencil-alt"></i> Rename
                                        </button>
                                        <button type="button" class="diet-meal-menu-item danger js-meal-action-delete" data-meal-index="${mealIndex}">
                                            <i class="fa fa-trash-alt"></i> Delete
                                        </button>
                                    </div>
                                </div>`
                                : ""
                            }
                        </div>
                    </div>
                    <div class="diet-view-meal-content">
                        ${itemCards || '<div class="text-center text-muted" style="padding: 20px;">No items</div>'}
                    </div>
                    <div class="diet-view-meal-totals">
                        <span class="diet-view-meal-total-chip protein"><i class="fa fa-dumbbell"></i> Total Protein: ${formatMacro(mealTotals.protein)} g</span>
                        <span class="diet-view-meal-total-chip calories"><i class="fa fa-fire"></i> Total Calories: ${formatMacro(mealTotals.calories)} kcal</span>
                    </div>
                </div>
            `;
        }).join("");

        const chartSummarySection = `
            <div class="diet-view-chart-card">
                <div class="diet-view-chart-title-wrap mb-3">
                    <div class="diet-view-chart-title">${escapeHtml(chartHeading)}</div>
                </div>
                ${hasFoodItems
                    ? `<div class="diet-view-chart-container">
                        <div class="diet-chart-wrapper">
                            <canvas id="dietMacroChart"></canvas>
                        </div>
                        <div class="diet-view-chart-stats">
                            <div class="chart-stat-row carbs">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Carbs</span>
                                <span class="chart-stat-value carbs">${formatMacro(overall.carbs)} gms</span>
                            </div>
                            <div class="chart-stat-row protein">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Protein</span>
                                <span class="chart-stat-value protein">${formatMacro(overall.protein)} gms</span>
                            </div>
                            <div class="chart-stat-row fats">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Fats</span>
                                <span class="chart-stat-value fats">${formatMacro(overall.fats)} gms</span>
                            </div>
                            <div class="chart-stat-row calories total">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Total Calories</span>
                                <span class="chart-stat-value calories">${formatMacro(overall.calories)} kcal</span>
                            </div>
                        </div>
                    </div>`
                    : ""}
            </div>
        `;

        viewEl.innerHTML = `
            <div class="diet-view-container">
                ${chartSummarySection}
                <div class="diet-view-meals">
                    ${mealsHtml}
                </div>
                ${canEditChart
                    ? `<div class="diet-view-add-meal-row">
                        <button type="button" id="dietViewAddMealBtn" class="diet-view-add-meal-btn">
                            <i class="fa fa-plus mr-2"></i> Add New Meal
                        </button>
                    </div>`
                    : ""
                }
            </div>
        `;

        refreshIcons();

        if (hasFoodItems) {
            setTimeout(() => {
                renderMacroPieChart(overall);
            }, 100);
        }

        setTimeout(() => {
            setupViewModeEventHandlers();
        }, 100);
    }

    function isDietMealMobileMenuMode() {
        return window.matchMedia("(max-width: 767px)").matches;
    }

    function startViewMealInlineRename(mealIndex) {
        const label = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"]`);
        const input = document.querySelector(`.diet-meal-name-inline-input[data-meal-index="${mealIndex}"]`);
        const editWrap = input ? input.closest('.diet-meal-name-edit-wrap') : null;

        if (!label || !input) {
            return;
        }

        document.querySelectorAll('.diet-meal-menu').forEach((menuEl) => menuEl.classList.remove('open'));
        document.querySelectorAll('.diet-meal-menu-btn').forEach((menuBtn) => menuBtn.setAttribute('aria-expanded', 'false'));

        label.style.display = 'none';
        if (editWrap) {
            editWrap.style.display = 'inline-flex';
        }
        input.focus();
        input.select();
    }

    function ensureDietMealActionSheet() {
        if (getEl("dietMealActionSheet")) {
            return;
        }

        document.body.insertAdjacentHTML("beforeend", `
            <div class="tp-plan-card-sheet" id="dietMealActionSheet" hidden aria-hidden="true" data-meal-index="">
                <button type="button" class="tp-plan-card-sheet-backdrop" data-meal-sheet-close aria-label="Close meal actions"></button>
                <section class="tp-plan-card-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="dietMealActionSheetTitle">
                    <div class="tp-plan-card-sheet-head">
                        <p class="tp-plan-card-sheet-title" id="dietMealActionSheetTitle">Meal options</p>
                        <button type="button" class="tp-plan-card-sheet-close" data-meal-sheet-close aria-label="Close"><i data-lucide="x"></i></button>
                    </div>
                    <div class="tp-plan-card-sheet-actions">
                        <button type="button" class="tp-plan-card-sheet-btn" data-meal-sheet-action="replacement"><i class="fa fa-random"></i> Replacement</button>
                        <button type="button" class="tp-plan-card-sheet-btn" data-meal-sheet-action="rename"><i class="fa fa-pencil-alt"></i> Rename</button>
                        <button type="button" class="tp-plan-card-sheet-btn tp-plan-card-sheet-btn--danger" data-meal-sheet-action="delete"><i class="fa fa-trash-alt"></i> Delete</button>
                    </div>
                </section>
            </div>
        `);

        const sheet = getEl("dietMealActionSheet");
        if (!sheet) {
            return;
        }

        sheet.addEventListener("click", (event) => {
            const closeTrigger = event.target.closest("[data-meal-sheet-close]");
            if (closeTrigger) {
                closeDietMealActionSheet();
                return;
            }

            const actionBtn = event.target.closest("[data-meal-sheet-action]");
            if (!actionBtn) {
                return;
            }

            const mealIndexRaw = sheet.getAttribute("data-meal-index");
            const mealIndex = Number.parseInt(mealIndexRaw, 10);
            closeDietMealActionSheet();

            if (Number.isNaN(mealIndex)) {
                return;
            }

            if (actionBtn.getAttribute("data-meal-sheet-action") === "rename") {
                startViewMealInlineRename(mealIndex);
                return;
            }

            if (actionBtn.getAttribute("data-meal-sheet-action") === "replacement") {
                const mode = (canManageMealReplacements() && !isActiveChartReadOnly()) ? "manage" : "view";
                openDietMealReplacementModal({ mealIndex, mode });
                return;
            }

            if (actionBtn.getAttribute("data-meal-sheet-action") === "delete") {
                showDeleteMealConfirmationModal(mealIndex);
            }
        });

        refreshIcons();
    }

    function openDietMealActionSheet(mealIndex) {
        ensureDietMealActionSheet();
        const sheet = getEl("dietMealActionSheet");
        if (!sheet) {
            return;
        }

        const titleEl = getEl("dietMealActionSheetTitle");
        const labelEl = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"] .diet-view-meal-label-text`);
        if (titleEl) {
            titleEl.textContent = labelEl?.textContent ? `${labelEl.textContent.trim()} options` : "Meal options";
        }

        const replacementActionBtn = sheet.querySelector('[data-meal-sheet-action="replacement"]');
        if (replacementActionBtn) {
            const meal = DIET_STATE.currentChartData?.meals?.[mealIndex];
            const replacementBundle = getMealReplacementBundle(DIET_STATE.currentChartData, meal?.id);
            const hasItems = (replacementBundle.items || []).length > 0;
            const actionLabel = (canManageMealReplacements() && !isActiveChartReadOnly())
                ? (hasItems ? "Edit Replacements" : "Add Replacements")
                : "View Replacements";
            replacementActionBtn.innerHTML = `<i class="fa fa-random"></i> ${actionLabel}`;
        }

        sheet.setAttribute("data-meal-index", String(mealIndex));
        sheet.hidden = false;
        sheet.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        refreshIcons();
    }

    function closeDietMealActionSheet() {
        const sheet = getEl("dietMealActionSheet");
        if (!sheet) {
            return;
        }

        sheet.removeAttribute("data-meal-index");
        sheet.hidden = true;
        sheet.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function setupViewModeEventHandlers() {
        document.querySelectorAll('.diet-meal-menu-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = event.currentTarget.getAttribute('data-meal-index');

                if (isDietMealMobileMenuMode()) {
                    openDietMealActionSheet(mealIndex);
                    return;
                }

                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);

                document.querySelectorAll('.diet-meal-menu').forEach((m) => {
                    if (m !== menu) {
                        m.classList.remove('open');
                    }
                });

                if (menu) {
                    const opened = menu.classList.toggle('open');
                    event.currentTarget.setAttribute('aria-expanded', opened ? 'true' : 'false');
                }
            });
        });

        if (!DIET_STATE.viewMealMenuOutsideBound) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.diet-meal-menu').forEach((menu) => menu.classList.remove('open'));
                document.querySelectorAll('.diet-meal-menu-btn').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
            });
            DIET_STATE.viewMealMenuOutsideBound = true;
        }

        document.querySelectorAll('.js-meal-action-edit').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);

                if (menu) {
                    menu.classList.remove('open');
                }
                startViewMealInlineRename(mealIndex);
            });
        });

        document.querySelectorAll('.js-meal-action-delete').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);
                if (menu) {
                    menu.classList.remove('open');
                }
                showDeleteMealConfirmationModal(mealIndex);
            });
        });

        document.querySelectorAll('.js-meal-action-replacements').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);
                if (menu) {
                    menu.classList.remove('open');
                }
                const mode = (canManageMealReplacements() && !isActiveChartReadOnly()) ? 'manage' : 'view';
                openDietMealReplacementModal({ mealIndex, mode });
            });
        });

        document.querySelectorAll('.js-meal-replacements-open').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                openDietMealReplacementModal({ mealIndex, mode: 'view' });
            });
        });

        document.querySelectorAll('.diet-meal-name-inline-input').forEach((input) => {
            const submit = async () => {
                const mealIndex = parseInt(input.getAttribute('data-meal-index'), 10);
                const label = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"]`);
                const editWrap = input.closest('.diet-meal-name-edit-wrap');
                const newName = (input.value || '').trim();

                if (!newName) {
                    input.value = label ? getViewMealLabelText(label) : `Meal ${mealIndex + 1}`;
                }

                if (label) {
                    label.style.display = 'inline-block';
                }
                if (editWrap) {
                    editWrap.style.display = 'none';
                }

                if (newName) {
                    await renameMealInViewChart(mealIndex, newName);
                }
            };

            input.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await submit();
                }
                if (event.key === 'Escape') {
                    const mealIndex = parseInt(input.getAttribute('data-meal-index'), 10);
                    const label = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"]`);
                    const editWrap = input.closest('.diet-meal-name-edit-wrap');
                    input.value = label ? getViewMealLabelText(label) : '';
                    if (editWrap) {
                        editWrap.style.display = 'none';
                    }
                    if (label) {
                        label.style.display = 'inline-block';
                    }
                }
            });

            input.addEventListener('blur', async () => {
                const editWrap = input.closest('.diet-meal-name-edit-wrap');
                if (editWrap && editWrap.style.display !== 'none') {
                    await submit();
                }
            });
        });

        document.querySelectorAll('.diet-meal-name-save-btn').forEach((saveBtn) => {
            saveBtn.addEventListener('mousedown', (event) => {
                event.preventDefault();
            });
            saveBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const mealIndex = parseInt(saveBtn.getAttribute('data-meal-index'), 10);
                const input = document.querySelector(`.diet-meal-name-inline-input[data-meal-index="${mealIndex}"]`);
                if (input) {
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
            });
        });

        document.querySelectorAll('.diet-meal-add-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                openFoodCatalogModalForMeal(mealIndex);
            });
        });

        const addMealBtn = document.getElementById('dietViewAddMealBtn');
        if (addMealBtn) {
            addMealBtn.addEventListener('click', () => {
                addMealToViewChart();
            });
        }

        document.querySelectorAll('.diet-item-delete-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const itemIndex = parseInt(event.currentTarget.getAttribute('data-item-index'), 10);
                showDeleteConfirmationModal(mealIndex, itemIndex);
            });
        });

        const closeAllQtyEditors = () => {
            document.querySelectorAll('.diet-view-item-qty.is-editing').forEach((wrap) => {
                const input = wrap.querySelector('.diet-item-qty-input');
                if (input) {
                    const currentQty = wrap.getAttribute('data-current-quantity') || input.value;
                    input.value = currentQty;
                }
                wrap.classList.remove('is-editing');
            });
        };

        document.querySelectorAll('.diet-item-qty-edit-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                const wrap = event.currentTarget.closest('.diet-view-item-qty');
                if (isDietQtySheetMode()) {
                    if (!wrap) {
                        return;
                    }

                    const mealIndex = parseInt(wrap.getAttribute('data-meal-index') || '', 10);
                    const itemIndex = parseInt(wrap.getAttribute('data-item-index') || '', 10);
                    const currentQuantity = wrap.getAttribute('data-current-quantity') || '0';
                    const unit = wrap.querySelector('.diet-item-qty-display .diet-item-unit')?.textContent || '';
                    const foodName = wrap.closest('.diet-view-item-card')?.querySelector('.diet-view-item-name')?.textContent || '';

                    openDietQtyActionSheet({
                        mealIndex,
                        itemIndex,
                        currentQuantity,
                        unit,
                        foodName
                    });
                    return;
                }

                closeAllQtyEditors();

                const input = wrap?.querySelector('.diet-item-qty-input');
                if (!wrap || !input) {
                    return;
                }

                wrap.classList.add('is-editing');
                input.focus();
                input.select();
            });
        });

        document.querySelectorAll('.diet-item-qty-cancel-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                const wrap = event.currentTarget.closest('.diet-view-item-qty');
                const input = wrap?.querySelector('.diet-item-qty-input');
                if (!wrap || !input) {
                    return;
                }

                input.value = wrap.getAttribute('data-current-quantity') || input.value;
                wrap.classList.remove('is-editing');
            });
        });

        const saveQuantityFromEditor = async (triggerEl) => {
            const wrap = triggerEl.closest('.diet-view-item-qty');
            const input = wrap?.querySelector('.diet-item-qty-input');
            if (!wrap || !input) {
                return;
            }

            const mealIndex = parseInt(wrap.getAttribute('data-meal-index'), 10);
            const itemIndex = parseInt(wrap.getAttribute('data-item-index'), 10);
            const nextQty = toNumber(input.value, 0);

            if (Number.isNaN(mealIndex) || Number.isNaN(itemIndex)) {
                return;
            }

            if (nextQty <= 0) {
                await showDietAlert('Quantity must be greater than 0.', { title: 'Invalid Quantity' });
                input.focus();
                input.select();
                return;
            }

            await updateFoodItemQuantity(mealIndex, itemIndex, nextQty);
        };

        document.querySelectorAll('.diet-item-qty-save-btn').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await saveQuantityFromEditor(event.currentTarget);
            });
        });

        document.querySelectorAll('.diet-item-qty-input').forEach((input) => {
            input.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await saveQuantityFromEditor(event.currentTarget);
                }

                if (event.key === 'Escape') {
                    const wrap = event.currentTarget.closest('.diet-view-item-qty');
                    if (!wrap) {
                        return;
                    }

                    event.currentTarget.value = wrap.getAttribute('data-current-quantity') || event.currentTarget.value;
                    wrap.classList.remove('is-editing');
                }
            });
        });

        if ('ontouchstart' in window && window.matchMedia('(max-width: 991px)').matches) {
            addSwipeFunctionality();
        }
    }

    function addSwipeFunctionality() {
        if (DIET_STATE.swipeHandlersBound) {
            return;
        }

        DIET_STATE.swipeHandlersBound = true;

        let startX, startY, currentX, currentY;
        let isSwiping = false;
        let swipeElement = null;
        let swipeDirection = null;
        let swipeOverlay = null;

        document.addEventListener('touchstart', (e) => {
            if (!window.matchMedia('(max-width: 991px)').matches) {
                return;
            }

            if (isActiveChartReadOnly()) {
                return;
            }

            if (e.target.closest('.diet-view-item-card')) {
                swipeElement = e.target.closest('.diet-view-item-card');
                swipeOverlay = swipeElement.querySelector('.diet-swipe-overlay');
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isSwiping = false;
                swipeDirection = null;

                swipeElement.style.transform = '';
                if (swipeOverlay) {
                    swipeOverlay.style.width = '0';
                }
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!window.matchMedia('(max-width: 991px)').matches) {
                return;
            }

            if (isActiveChartReadOnly()) {
                return;
            }

            if (!swipeElement) {
                return;
            }

            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
                isSwiping = true;
                swipeDirection = deltaX > 0 ? 'right' : 'left';

                if (swipeDirection === 'left' && swipeOverlay) {
                    const swipeDistance = Math.abs(deltaX);
                    const maxWidth = swipeElement.offsetWidth * 0.8;
                    const overlayWidth = Math.min(swipeDistance, maxWidth);
                    swipeOverlay.style.width = `${overlayWidth}px`;
                } else {
                    const translateX = Math.min(Math.max(deltaX, -100), 100);
                    swipeElement.style.transform = `translateX(${translateX}px)`;
                }

                e.preventDefault();
            }
        });

        document.addEventListener('touchend', () => {
            if (!window.matchMedia('(max-width: 991px)').matches) {
                swipeElement = null;
                isSwiping = false;
                return;
            }

            if (isActiveChartReadOnly()) {
                if (swipeElement) {
                    swipeElement.style.transform = '';
                    if (swipeOverlay) {
                        swipeOverlay.style.width = '0';
                    }
                }
                swipeElement = null;
                isSwiping = false;
                return;
            }

            if (!swipeElement || !isSwiping) {
                if (swipeElement) {
                    swipeElement.style.transform = '';
                    if (swipeOverlay) {
                        swipeOverlay.style.width = '0';
                    }
                }
                swipeElement = null;
                return;
            }

            const deltaX = currentX - startX;
            const mealIndex = parseInt(swipeElement.querySelector('.diet-item-delete-btn')?.getAttribute('data-meal-index'), 10);
            const itemIndex = parseInt(swipeElement.querySelector('.diet-item-delete-btn')?.getAttribute('data-item-index'), 10);

            if (Math.abs(deltaX) > 80) {
                if (swipeDirection === 'left') {
                    showDeleteConfirmationModal(mealIndex, itemIndex);
                } else if (swipeDirection === 'right') {
                    editFoodItem(mealIndex, itemIndex);
                }
            }

            swipeElement.style.transform = '';
            if (swipeOverlay) {
                swipeOverlay.style.width = '0';
            }
            swipeElement = null;
            isSwiping = false;
        });
    }

function showDeleteConfirmationModal(mealIndex, itemIndex) {
    if (!guardActiveChartEditable("delete food items")) {
        return;
    }

    // Store the indices for when user confirms
    const modal = document.getElementById('deleteFoodModal');
    if (modal) {
        modal.setAttribute('data-meal-index', mealIndex);
        modal.setAttribute('data-item-index', itemIndex);
        $('#deleteFoodModal').modal('show');
    }
}

function confirmDeleteFoodItem() {
    const modal = document.getElementById('deleteFoodModal');
    if (modal) {
        const mealIndex = parseInt(modal.getAttribute('data-meal-index'));
        const itemIndex = parseInt(modal.getAttribute('data-item-index'));
        if (!isNaN(mealIndex) && !isNaN(itemIndex)) {
            deleteFoodItem(mealIndex, itemIndex);
        }
        $('#deleteFoodModal').modal('hide');
    }
}

async function openFoodCatalogModalForMeal(mealIndex) {
    if (!guardActiveChartEditable("add food items")) {
        return;
    }

    const modal = getEl("selectFoodModal");
    if (!modal || Number.isNaN(mealIndex)) {
        return;
    }

    modal.setAttribute("data-meal-index", String(mealIndex));
    const searchInput = getEl("foodSearchInput");
    if (searchInput) {
        searchInput.value = "";
    }

    hideCatalogSearchSuggestions();

    await renderFoodCatalogModalList("");

    if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery("#selectFoodModal").modal("show");
    }
}

async function renderFoodCatalogModalList(searchTerm = "") {
    const listEl = getEl("foodCatalogList");
    if (!listEl) {
        return;
    }

    try {
        const foods = await loadFoodCatalogOptions(searchTerm);

        if (!foods || foods.length === 0) {
            listEl.innerHTML = '<div class="food-catalog-empty text-center text-muted py-4">No foods found.</div>';
            return;
        }

        const userId = getCatalogCustomOwnerId();
        const customFoods = foods.filter((f) => f.is_custom && f.created_by_user_id === userId);
        const globalFoods = foods.filter((f) => !f.is_custom);

        const getFoodIconMeta = (foodName) => {
            const name = String(foodName || "").toLowerCase();
            const keywordMeta = [
                { className: "food-oil", iconClass: "fa-tint", keywords: ["oil", "ghee", "butter", "fat", "rapsol", "rapeseed"] },
                { className: "food-egg", iconClass: "fa-egg", keywords: ["egg", "yolk", "omelette", "omelet"] },
                { className: "food-grain", iconClass: "fa-seedling", keywords: ["lentil", "dal", "legume", "bean", "roti", "wheat", "bread", "oats"] },
                { className: "food-rice", iconClass: "fa-utensils", keywords: ["rice", "biryani", "pulao"] },
                { className: "food-veg", iconClass: "fa-carrot", keywords: ["salad", "vegetable", "veggie", "carrot", "spinach", "broccoli"] },
                { className: "food-fruit", iconClass: "fa-apple-alt", keywords: ["fruit", "apple", "banana", "orange", "mango", "berries"] },
                { className: "food-protein", iconClass: "fa-drumstick-bite", keywords: ["chicken", "fish", "meat", "paneer", "tofu"] }
            ];

            const matched = keywordMeta.find((entry) => entry.keywords.some((keyword) => name.includes(keyword)));
            if (matched) {
                return matched;
            }

            const fallback = [
                { className: "food-default", iconClass: "fa-utensils" },
                { className: "food-plate", iconClass: "fa-utensils" },
                { className: "food-rice", iconClass: "fa-utensils" },
                { className: "food-veg", iconClass: "fa-leaf" }
            ];

            let hash = 0;
            for (let i = 0; i < name.length; i += 1) {
                hash = ((hash << 5) - hash) + name.charCodeAt(i);
                hash |= 0;
            }

            return fallback[Math.abs(hash) % fallback.length];
        };

        const renderCard = (food) => {
            const foodId = escapeHtml(food.food_id);
            const unit = escapeHtml(food.unit_of_quantity || "");
            const referenceQty = toNumber(food.quantity, 0);
            const initialQty = referenceQty > 0 ? referenceQty : 1;
            const carbs = toNumber(food.carbs, 0);
            const protein = toNumber(food.protein, 0);
            const fats = toNumber(food.fats, 0);
            const calories = (carbs * 4) + (protein * 4) + (fats * 9);
            const iconMeta = getFoodIconMeta(food.food_name);

            return `
                <div class="diet-catalog-pick-card" data-food-id="${foodId}">
                    <div class="diet-catalog-pick-main">
                        <div class="food-icon ${iconMeta.className}">
                            <i class="fa ${iconMeta.iconClass}" aria-hidden="true"></i>
                        </div>
                        <div class="diet-catalog-pick-body">
                            <div class="diet-catalog-pick-title">
                                <span class="diet-catalog-pick-name">${escapeHtml(food.food_name || "Unnamed Food")}</span>
                                <span class="diet-catalog-ref-qty">${formatMacro(initialQty)}&thinsp;${unit}</span>
                            </div>
                            <div class="diet-catalog-pick-macros">
                                <span class="diet-view-macro carbs"><i class="fa fa-bolt"></i> C: ${formatMacro(carbs)} g</span>
                                <span class="diet-view-macro protein"><i class="fa fa-dumbbell"></i> P: ${formatMacro(protein)} g</span>
                                <span class="diet-view-macro fats"><i class="fa fa-tint"></i> F: ${formatMacro(fats)} g</span>
                            </div>
                        </div>
                        <div class="diet-catalog-pick-aside">
                            <div class="diet-catalog-pick-calories">${formatMacro(calories)} kcal</div>
                        </div>
                    </div>
                    <div class="diet-catalog-pick-footer">
                        <div class="diet-catalog-qty-row">
                            <div class="diet-catalog-qty-control">
                                <input type="number" class="food-catalog-qty-input" value="${formatMacro(initialQty)}" min="0.01" step="0.01" data-food-id="${foodId}" aria-label="Quantity">
                                <div class="diet-catalog-qty-stepper" aria-hidden="true">
                                    <button type="button" class="diet-catalog-qty-step-btn js-catalog-qty-up" data-food-id="${foodId}" tabindex="-1" aria-label="Increase quantity">
                                        <i class="fa fa-chevron-up"></i>
                                    </button>
                                    <button type="button" class="diet-catalog-qty-step-btn js-catalog-qty-down" data-food-id="${foodId}" tabindex="-1" aria-label="Decrease quantity">
                                        <i class="fa fa-chevron-down"></i>
                                    </button>
                                </div>
                            </div>
                            <span class="diet-catalog-unit-pill">${unit}</span>
                        </div>
                        <button type="button" class="diet-catalog-add-btn js-add-food-catalog-item" data-food-id="${foodId}">
                            <i class="fa fa-plus mr-1"></i> Add
                        </button>
                    </div>
                </div>
            `;
        };

        let html = "";

        if (customFoods.length > 0) {
            html += `<div class="catalog-section-label">${DIET_STATE.isAdmin ? "Selected User Custom Foods" : "Your Custom Foods"}</div>`;
            html += customFoods.map(renderCard).join("");
        }

        if (globalFoods.length > 0) {
            html += `<div class="catalog-section-label${customFoods.length > 0 ? " mt-3" : ""}">Food Catalog</div>`;
            html += globalFoods.map(renderCard).join("");
        }

        if (!html) {
            html = '<div class="food-catalog-empty text-center text-muted py-4">No foods found.</div>';
        }

        listEl.innerHTML = html;
    } catch (error) {
        console.error("renderFoodCatalogModalList error:", error);
        listEl.innerHTML = '<div class="food-catalog-empty text-center text-danger py-4">Failed to load food catalog.</div>';
    }
}

function buildCatalogMacroPreview(food, quantity) {
    const referenceQty = toNumber(food.quantity, 0);
    const factor = referenceQty > 0 ? quantity / referenceQty : 0;
    const carbs = toNumber(food.carbs, 0) * factor;
    const protein = toNumber(food.protein, 0) * factor;
    const fats = toNumber(food.fats, 0) * factor;
    const calories = (carbs * 4) + (protein * 4) + (fats * 9);
    const unit = food.unit_of_quantity || "";

    return `${formatMacro(quantity)} ${unit} | C ${formatMacro(carbs)}g | P ${formatMacro(protein)}g | F ${formatMacro(fats)}g | ${formatMacro(calories)} kcal`;
}

async function addFoodFromCatalogToMeal(foodId, mealIndex, selectedQuantity) {
    if (!guardActiveChartEditable("add food items")) {
        return;
    }

    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }

    const meal = DIET_STATE.currentChartData.meals[mealIndex];
    if (!meal) {
        return;
    }

    const selectedFood = DIET_STATE.foodCatalog.find((food) => String(food.food_id) === String(foodId));
    if (!selectedFood) {
        return;
    }

    if (!Array.isArray(meal.items)) {
        meal.items = [];
    }

    const quantity = toNumber(selectedQuantity, 0);
    if (quantity <= 0) {
        return;
    }

    const existingItem = meal.items.find((item) =>
        String(item.food_name || "").trim().toLowerCase() === String(selectedFood.food_name || "").trim().toLowerCase()
    );

    if (existingItem) {
        existingItem.quantity = toNumber(existingItem.quantity, 0) + quantity;
        existingItem.quantity_unit = selectedFood.unit_of_quantity || existingItem.quantity_unit || "g";
        existingItem.reference_quantity = toNumber(selectedFood.quantity, 0);
        existingItem.reference_unit = selectedFood.unit_of_quantity || "g";
        existingItem.reference_carbs = toNumber(selectedFood.carbs, 0);
        existingItem.reference_protein = toNumber(selectedFood.protein, 0);
        existingItem.reference_fat = toNumber(selectedFood.fats, 0);
        existingItem.reference_fibre = toNumber(selectedFood.fibre, 0);
    } else {
        meal.items.push({
            food_name: selectedFood.food_name,
            quantity,
            quantity_unit: selectedFood.unit_of_quantity || "g",
            reference_quantity: toNumber(selectedFood.quantity, 0),
            reference_unit: selectedFood.unit_of_quantity || "g",
            reference_carbs: toNumber(selectedFood.carbs, 0),
            reference_protein: toNumber(selectedFood.protein, 0),
            reference_fat: toNumber(selectedFood.fats, 0),
            reference_fibre: toNumber(selectedFood.fibre, 0)
        });
    }

    if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery("#selectFoodModal").modal("hide");
    }

    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

function showItemOptionsMenu(button, mealIndex, itemIndex) {
    // Create a simple dropdown menu for edit/delete options
    const existingMenu = document.querySelector('.item-options-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'item-options-menu';
    menu.innerHTML = `
        <button class="item-option-btn edit-btn" data-action="edit" data-meal="${mealIndex}" data-item="${itemIndex}">
            <i class="fa fa-edit"></i> Edit
        </button>
        <button class="item-option-btn delete-btn" data-action="delete" data-meal="${mealIndex}" data-item="${itemIndex}">
            <i class="fa fa-trash"></i> Delete
        </button>
    `;

    // Position the menu - try to position to the right first, fallback to left if not enough space
    const rect = button.getBoundingClientRect();
    const menuWidth = 120; // Approximate menu width
    const viewportWidth = window.innerWidth;
    
    let leftPos;
    if (rect.left + menuWidth + 10 < viewportWidth) {
        // Position to the right
        leftPos = rect.left;
    } else {
        // Position to the left
        leftPos = rect.left - menuWidth + rect.width;
    }
    
    menu.style.position = 'fixed'; // Use fixed positioning for better mobile support
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${leftPos}px`;
    menu.style.zIndex = '1000';

    document.body.appendChild(menu);

    // Handle menu option clicks
    menu.addEventListener('click', (event) => {
        const action = event.target.closest('.item-option-btn')?.getAttribute('data-action');
        const mealIdx = parseInt(event.target.closest('.item-option-btn')?.getAttribute('data-meal'));
        const itemIdx = parseInt(event.target.closest('.item-option-btn')?.getAttribute('data-item'));

        if (action === 'edit') {
            editFoodItem(mealIdx, itemIdx);
        } else if (action === 'delete') {
            deleteFoodItem(mealIdx, itemIdx);
        }

        menu.remove();
    });

    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== button) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

function editFoodItem(mealIndex, itemIndex) {
    if (!guardActiveChartEditable("edit food items")) {
        return;
    }

    const qtyWrap = document.querySelector(`.diet-view-item-qty[data-meal-index="${mealIndex}"][data-item-index="${itemIndex}"]`);
    const qtyInput = qtyWrap?.querySelector('.diet-item-qty-input');

    if (qtyWrap && qtyInput) {
        document.querySelectorAll('.diet-view-item-qty.is-editing').forEach((wrap) => {
            wrap.classList.remove('is-editing');
        });

        qtyWrap.classList.add('is-editing');
        qtyInput.focus();
        qtyInput.select();
        return;
    }

    // Fallback for legacy edit mode flow
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) {
        editModeBtn.click();
    }
}

async function updateFoodItemQuantity(mealIndex, itemIndex, quantity) {
    if (!guardActiveChartEditable("edit food quantities")) {
        return;
    }

    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }

    const meal = DIET_STATE.currentChartData.meals[mealIndex];
    const item = meal?.items?.[itemIndex];
    const safeQuantity = toNumber(quantity, 0);

    if (!meal || !item || safeQuantity <= 0) {
        return;
    }

    item.quantity = safeQuantity;
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

async function deleteFoodItem(mealIndex, itemIndex) {
    if (!guardActiveChartEditable("delete food items")) {
        return;
    }

    if (DIET_STATE.currentChartData && DIET_STATE.currentChartData.meals) {
        DIET_STATE.currentChartData.meals[mealIndex].items.splice(itemIndex, 1);
        setDietDirty(true);
        renderDietChartView(DIET_STATE.currentChartData);
        await syncViewChartToSupabase();
    }
}

function addMealToViewChart() {
    if (!guardActiveChartEditable("add meals")) {
        return;
    }

    if (!DIET_STATE.currentChartData) {
        return;
    }
    if (!Array.isArray(DIET_STATE.currentChartData.meals)) {
        DIET_STATE.currentChartData.meals = [];
    }
    const nextNum = DIET_STATE.currentChartData.meals.length + 1;
    DIET_STATE.currentChartData.meals.push({ meal_name: toTitleCaseWords(`Meal ${nextNum}`), sort_order: nextNum, items: [] });
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    syncViewChartToSupabase();
}

function showDeleteMealConfirmationModal(mealIndex) {
    if (!guardActiveChartEditable("delete meals")) {
        return;
    }

    const modal = document.getElementById('deleteMealModal');
    if (modal) {
        modal.setAttribute('data-meal-index', mealIndex);
        $('#deleteMealModal').modal('show');
    } else {
        // Fallback: delete directly without modal
        deleteMealFromViewChart(mealIndex);
    }
}

async function deleteMealFromViewChart(mealIndex) {
    if (!guardActiveChartEditable("delete meals")) {
        return;
    }

    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }
    DIET_STATE.currentChartData.meals.splice(mealIndex, 1);
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

async function renameMealInViewChart(mealIndex, newName) {
    if (!guardActiveChartEditable("rename meals")) {
        return;
    }

    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }

    const meal = DIET_STATE.currentChartData.meals[mealIndex];
    if (!meal) {
        return;
    }

    const normalized = toTitleCaseWords(newName || '');
    if (!normalized) {
        return;
    }

    meal.meal_name = normalized;
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

async function ensureViewChartId() {
    if (DIET_STATE.selectedChartId) {
        return DIET_STATE.selectedChartId;
    }

    const userId = DIET_STATE.selectedUserId || DIET_STATE.currentChartData?.chart?.user_id;
    if (!userId) {
        throw new Error("No selected user for saving diet chart.");
    }

    const chartTitle = String(DIET_STATE.currentChartData?.chart?.title || "").trim();
    if (!chartTitle) {
        throw new Error("Diet chart name is required.");
    }

    const createdBy = DIET_STATE.activeAdminId || DIET_STATE.currentUserId || DIET_STATE.selectedUserId || null;
    const { data, error } = await window.supabaseClient
        .from("diet_charts")
        .insert({
            user_id: userId,
            title: chartTitle,
            notes: DIET_STATE.currentChartData?.chart?.notes || null,
            created_by: createdBy,
            updated_at: new Date().toISOString()
        })
        .select("id")
        .single();

    if (error) {
        throw new Error("Create failed: " + error.message);
    }

    DIET_STATE.selectedChartId = data.id;
    if (!DIET_STATE.currentChartData.chart) {
        DIET_STATE.currentChartData.chart = {};
    }
    DIET_STATE.currentChartData.chart.id = data.id;
    DIET_STATE.currentChartData.chart.user_id = userId;
    return data.id;
}

async function syncViewChartToSupabase() {
    const chartData = DIET_STATE.currentChartData;

    if (!chartData || !Array.isArray(chartData.meals)) {
        return false;
    }

    if (!guardActiveChartEditable("save changes")) {
        return false;
    }

    if (DIET_STATE.isSyncingView) {
        return false;
    }

    setViewSaveLoading(true);
    try {
        const chartTitle = String(chartData?.chart?.title || "").trim();
        if (!chartTitle) {
            throw new Error("Diet chart name is required.");
        }

        const chartId = await ensureViewChartId();

        if (!DIET_STATE.skipChartMetaUpdate) {
            const { error: chartUpdateError } = await window.supabaseClient
                .from("diet_charts")
                .update({
                    title: chartTitle,
                    notes: chartData?.chart?.notes || null
                })
                .eq("id", chartId);

            if (chartUpdateError) {
                const chartErrorMsg = String(chartUpdateError.message || "").toLowerCase();
                const isStackDepthError = chartErrorMsg.includes("stack depth") && chartErrorMsg.includes("limit exceeded");

                if (isStackDepthError) {
                    DIET_STATE.skipChartMetaUpdate = true;
                    console.warn("Skipping diet_charts metadata update due to stack depth DB trigger.", chartUpdateError);
                } else {
                    throw new Error("Chart update failed: " + chartUpdateError.message);
                }
            }
        }

        const { data: existingMeals, error: fetchMealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .select("id")
            .eq("diet_chart_id", chartId);

        if (fetchMealsError) {
            throw new Error("Failed to fetch existing meals: " + fetchMealsError.message);
        }

        const existingMealIds = (existingMeals || []).map((meal) => meal.id);
        if (existingMealIds.length > 0) {
            const { error: deleteItemsError } = await window.supabaseClient
                .from("diet_chart_items")
                .delete()
                .in("meal_id", existingMealIds);

            if (deleteItemsError) {
                throw new Error("Failed to clear existing items: " + deleteItemsError.message);
            }
        }

        const { error: deleteMealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .delete()
            .eq("diet_chart_id", chartId);

        if (deleteMealsError) {
            throw new Error("Failed to clear existing meals: " + deleteMealsError.message);
        }

        for (let mealIndex = 0; mealIndex < chartData.meals.length; mealIndex += 1) {
            const mealPayload = chartData.meals[mealIndex];
            const { data: insertedMeal, error: mealInsertError } = await window.supabaseClient
                .from("diet_chart_meals")
                .insert({
                    diet_chart_id: chartId,
                    meal_name: mealPayload.meal_name || `Meal ${mealIndex + 1}`,
                    sort_order: mealIndex + 1
                })
                .select("id")
                .single();

            if (mealInsertError || !insertedMeal) {
                const mealErrMsg = String(mealInsertError?.message || "").toLowerCase();
                if (mealErrMsg.includes("stack depth") && mealErrMsg.includes("limit exceeded")) {
                    console.warn("Ignoring stack depth error on diet_chart_meals insert, skipping items for this meal.", mealInsertError);
                    continue;
                } else {
                    throw new Error("Meal save failed: " + (mealInsertError?.message || "no meal ID returned"));
                }
            }

            const mealItems = Array.isArray(mealPayload.items) ? mealPayload.items : [];
            if (mealItems.length > 0) {
                const itemsPayload = mealItems.map((item, itemIndex) => ({
                    meal_id: insertedMeal.id,
                    food_name: item.food_name || "",
                    quantity: toNumber(item.quantity, 0),
                    quantity_unit: item.quantity_unit || item.reference_unit || "",
                    reference_quantity: toNumber(item.reference_quantity, 0),
                    reference_unit: item.reference_unit || "",
                    reference_carbs: toNumber(item.reference_carbs, 0),
                    reference_protein: toNumber(item.reference_protein, 0),
                    reference_fat: toNumber(item.reference_fat, 0),
                    reference_fibre: toNumber(item.reference_fibre, 0),
                    sort_order: itemIndex + 1
                }));

                const { error: itemInsertError } = await window.supabaseClient
                    .from("diet_chart_items")
                    .insert(itemsPayload);

                if (itemInsertError) {
                    const itemErrMsg = String(itemInsertError.message || "").toLowerCase();
                    if (itemErrMsg.includes("stack depth") && itemErrMsg.includes("limit exceeded")) {
                        console.warn("Ignoring stack depth error on diet_chart_items insert.", itemInsertError);
                    } else {
                        throw new Error("Item save failed: " + itemInsertError.message);
                    }
                }
            }
        }

        await loadDietChartsForUser(DIET_STATE.selectedUserId || chartData?.chart?.user_id || "");
        renderDietChartSelector();
        setDietDirty(false);
        return true;
    } catch (error) {
        console.error("syncViewChartToSupabase error:", error);
        await showDietAlert(error.message || "Failed to sync diet chart changes.", { title: "Sync Failed" });

        if (DIET_STATE.selectedChartId) {
            try {
                const reloadedChart = await loadDietChart(DIET_STATE.selectedChartId);
                DIET_STATE.currentChartData = reloadedChart;
                renderDietChartView(reloadedChart);
                setDietDirty(true);
            } catch (reloadError) {
                console.error("sync reload error:", reloadError);
            }
        }

        return false;
    } finally {
        setViewSaveLoading(false);
    }
}

function renderMacroPieChart(macros) {
    const canvasEl = document.getElementById("dietMacroChart");
    if (!canvasEl) {
        return;
    }

    if (DIET_STATE.chartInstance) {
        DIET_STATE.chartInstance.destroy();
    }

    const colors = {
        carbs: "#d97706",
        protein: "#16a34a",
        fats: "#2563eb"
    };

    const baseColors = [colors.carbs, colors.protein, colors.fats];

    DIET_STATE.chartInstance = new Chart(canvasEl, {
        type: "doughnut",
        data: {
            labels: ["Carbs", "Protein", "Fats"],
            datasets: [{
                data: [
                    toNumber(macros.carbs, 0),
                    toNumber(macros.protein, 0),
                    toNumber(macros.fats, 0)
                ],
                backgroundColor: baseColors,
                borderColor: ["transparent", "transparent", "transparent"],
                borderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 700,
                easing: "easeOutQuart"
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.label + ": " + formatMacro(context.parsed) + " gms";
                        }
                    }
                }
            },
            cutout: "50%"
        }
    });
}

function setSaveLoading(isLoading) {
    const saveBtn = getEl("saveDietChartBtn");
    if (!saveBtn) {
        return;
    }

    saveBtn.disabled = isLoading;
    saveBtn.innerHTML = isLoading
        ? '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...'
        : '<i class="fa fa-save mr-1"></i> Save Diet Chart';
}

function buildFoodOptionsHtml(selectedFoodId = "") {
    const options = ['<option value="">Select Food</option>'];

    DIET_STATE.foodCatalog.forEach((food) => {
        const selected = food.food_id === selectedFoodId ? "selected" : "";
        options.push(`<option value="${food.food_id}" ${selected}>${food.food_name}</option>`);
    });

    options.push('<option value="__add_new__">+ Add New Food</option>');
    return options.join("");
}

async function waitForStableSession(timeoutMs = 4000, intervalMs = 250) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        const { data, error } = await window.supabaseClient.auth.getSession();

        if (error) {
            return { session: null, error };
        }

        if (data?.session) {
            return { session: data.session, error: null };
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return { session: null, error: null };
}

async function requireLoginOrRedirect() {
    const { session, error } = await waitForStableSession(8000, 250);

    if (error) {
        await showDietAlert("Session error: " + error.message, { title: "Session Error" });
        return null;
    }

    if (!session) {
        if (typeof window.requireLoginWithModal === "function") {
            return window.requireLoginWithModal();
        }

        if (typeof window.openAuthModal === "function") {
            window.openAuthModal({ locked: true });
        }
        return null;
    }

    if (typeof window.closeAuthModal === "function") {
        window.closeAuthModal();
    }

    return session.user;
}

async function requireAdminOrRedirect(user) {
    if (typeof window.getAccessState === "function") {
        try {
            const accessState = await window.getAccessState();
            if (accessState?.isAdmin) {
                return true;
            }
        } catch (error) {
            console.warn("getAccessState() admin check warning:", error?.message || error);
        }

        try {
            const fallbackAccessState = await window.getAccessState({ user });
            if (fallbackAccessState?.isAdmin) {
                return true;
            }
        } catch (error) {
            console.warn("getAccessState({ user }) admin check warning:", error?.message || error);
        }
    }

    if (typeof window.isAdminUser === "function" && window.isAdminUser(user)) {
        return true;
    }

    await showDietAlert("You do not have access to the admin portal.", { title: "Access Restricted" });
    window.location.replace("../index.html");
    return false;
}

async function loadUsersList() {
    const selectEl = getEl("dietUserSelect");
    if (!selectEl) {
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, email, full_name, role")
        .order("email", { ascending: true });

    if (error) {
        console.error("loadUsersList error:", error);
        throw new Error("Failed to load users: " + error.message);
    }

    DIET_STATE.users = data || [];

    if (DIET_STATE.isAdmin && DIET_STATE.users.length <= 1) {
        console.warn("Admin can currently see only one profile row. Check Supabase RLS policy on profiles SELECT for admin role.");
    }

    selectEl.innerHTML = '<option value="">Select user...</option>';
    DIET_STATE.users.forEach((user) => {
        const fullName = (user.full_name || "Unnamed User").trim();
        const roleText = user.role ? user.role.replace(/[_-]/g, " ") : "user";
        const roleLabel = roleText.charAt(0).toUpperCase() + roleText.slice(1);
        const label = `${fullName} - ${roleLabel}`;
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = label;
        selectEl.appendChild(option);
    });
}

async function loadFoodCatalogOptions(searchTerm = "") {
    // Always force a fresh load so newly created custom foods appear immediately
    await loadVisibleFoodCatalogItems();

    if (!searchTerm) {
        return DIET_STATE.foodCatalog;
    }

    const query = searchTerm.toLowerCase();
    return DIET_STATE.foodCatalog.filter((food) =>
        (food.food_name || "").toLowerCase().includes(query)
    );
}

async function loadVisibleFoodCatalogItems() {
    const userId = getCatalogCustomOwnerId();

    // Fetch global foods
    const { data: globalFoods, error: globalError } = await window.supabaseClient
        .from("food_catalog")
        .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
        .eq("is_custom", false)
        .order("food_name", { ascending: true });

    if (globalError) {
        console.error("loadVisibleFoodCatalogItems global error:", globalError);
        throw new Error("Failed to load food catalog: " + globalError.message);
    }

    let customFoods = [];
    if (userId) {
        const { data: myFoods, error: customError } = await window.supabaseClient
            .from("food_catalog")
            .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
            .eq("is_custom", true)
            .eq("created_by_user_id", userId)
            .order("food_name", { ascending: true });

        if (customError) {
            console.error("loadVisibleFoodCatalogItems custom error:", customError);
        } else {
            customFoods = myFoods || [];
        }
    }

    // Own custom foods first, then global
    DIET_STATE.foodCatalog = [...customFoods, ...(globalFoods || [])];
}

async function checkExistingDietChart(userId) {
    if (!userId) {
        return null;
    }

    const { data, error } = await window.supabaseClient
        .from("diet_charts")
        .select("id, user_id, title, notes, created_at, updated_at, created_by")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("checkExistingDietChart error:", error);
        throw new Error("Failed to check diet chart: " + error.message);
    }

    return data && data.length > 0 ? data[0] : null;
}

async function loadChartCreatorAdminMap(charts) {
    DIET_STATE.chartCreatorAdminMap = {};

    const creatorIds = Array.from(new Set(
        (Array.isArray(charts) ? charts : [])
            .map((chart) => String(chart?.created_by || "").trim())
            .filter(Boolean)
    ));

    if (!creatorIds.length) {
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, role, is_admin")
        .in("id", creatorIds);

    if (error) {
        console.warn("loadChartCreatorAdminMap warning:", error.message || error);
        return;
    }

    (data || []).forEach((profile) => {
        const id = String(profile?.id || "").trim();
        if (!id) {
            return;
        }

        const role = String(profile?.role || "").toLowerCase();
        DIET_STATE.chartCreatorAdminMap[id] = Boolean(profile?.is_admin === true || role === "admin");
    });
}

async function loadDietChartsForUser(userId) {
    if (!userId) {
        DIET_STATE.dietCharts = [];
        renderDietChartSelector();
        return [];
    }

    const { data, error } = await window.supabaseClient
        .from("diet_charts")
        .select("id, user_id, title, notes, created_at, updated_at, created_by")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("loadDietChartsForUser error:", error);
        throw new Error("Failed to load diet charts: " + error.message);
    }

    await loadChartCreatorAdminMap(data || []);
    DIET_STATE.dietCharts = sortDietChartsForDisplay(data || []);
    renderDietChartSelector();
    return DIET_STATE.dietCharts;
}

async function loadDietChart(chartId) {
    const { data: chart, error: chartError } = await window.supabaseClient
        .from("diet_charts")
        .select("id, user_id, title, notes, created_at, updated_at, created_by")
        .eq("id", chartId)
        .single();

    if (chartError) {
        console.error("loadDietChart chart error:", chartError);
        throw new Error("Failed to load diet chart: " + chartError.message);
    }

    const { data: meals, error: mealsError } = await window.supabaseClient
        .from("diet_chart_meals")
        .select("id, diet_chart_id, meal_name, sort_order")
        .eq("diet_chart_id", chartId)
        .order("sort_order", { ascending: true });

    if (mealsError) {
        console.error("loadDietChart meals error:", mealsError);
        throw new Error("Failed to load meals: " + mealsError.message);
    }

    const mealIds = (meals || []).map((meal) => meal.id);
    let items = [];

    if (mealIds.length > 0) {
        const { data: itemData, error: itemsError } = await window.supabaseClient
            .from("diet_chart_items")
            .select("id, meal_id, food_name, quantity, quantity_unit, reference_quantity, reference_unit, reference_carbs, reference_protein, reference_fat, reference_fibre, sort_order")
            .in("meal_id", mealIds)
            .order("sort_order", { ascending: true });

        if (itemsError) {
            console.error("loadDietChart items error:", itemsError);
            throw new Error("Failed to load meal items: " + itemsError.message);
        }

        items = itemData || [];
    }

    const mealsWithItems = (meals || []).map((meal) => ({
        ...meal,
        items: items.filter((item) => item.meal_id === meal.id)
    }));

    const replacementsByMealId = await loadMealReplacementsByMealIds(mealIds);

    return {
        chart,
        meals: mealsWithItems,
        replacementsByMealId
    };
}

async function loadAndRenderDietChart(chartId) {
    if (!chartId) {
        DIET_STATE.selectedChartId = "";
        setEditorVisibility(false);
        return;
    }

    const chartData = await loadDietChart(chartId);
    DIET_STATE.selectedChartId = chartId;
    DIET_STATE.currentChartData = chartData;
    setActiveChartLockState(chartData?.chart || getChartById(chartId));
    DIET_STATE.isEditMode = false;
    setDietDirty(false);

    renderDietChartView(chartData);
    setEditorVisibility(true);
    renderDietChartSelector();
}

function renderDietChartEditor(chartData) {
    const titleEl = getEl("dietChartTitle");
    const notesEl = getEl("dietChartNotes");
    const mealsContainer = getEl("dietMealsContainer");

    if (!titleEl || !notesEl || !mealsContainer) {
        return;
    }

    DIET_STATE.selectedChartId = chartData?.chart?.id || "";
    DIET_STATE.currentChartData = chartData || null;
    DIET_STATE.mealCounter = 0;

    titleEl.value = chartData?.chart?.title || "";
    notesEl.value = chartData?.chart?.notes || "";
    mealsContainer.innerHTML = "";

    const meals = chartData?.meals || [];
    if (meals.length === 0) {
        addMeal({ meal_name: "Meal 1", sort_order: 1, items: [] });
    } else {
        meals.forEach((mealData) => addMeal(mealData));
    }

    setEditorVisibility(true);
    recalculateDietChartTotals();
}

function createEmptyDietChart(userId, chartTitle, chartId = "") {
    const normalizedTitle = String(chartTitle || "").trim();
    if (!normalizedTitle) {
        throw new Error("Diet chart name is required.");
    }

    DIET_STATE.selectedUserId = userId;
    DIET_STATE.selectedChartId = chartId || "";
    DIET_STATE.isEditMode = false;
    DIET_STATE.activeChartIsLocked = false;
    DIET_STATE.swipeHandlersBound = false;
    DIET_STATE.hasUnsavedChanges = false;

    const emptyChart = {
        chart: { id: chartId || undefined, user_id: userId, title: normalizedTitle, notes: "" },
        meals: [{ meal_name: "Meal 1", sort_order: 1, items: [] }]
    };

    DIET_STATE.currentChartData = emptyChart;

    const emptyStateEl = getEl("dietChartEmptyState");
    if (emptyStateEl) emptyStateEl.style.display = "none";

    const viewEl = getEl("dietChartView");
    if (viewEl) viewEl.style.display = "block";

    renderDietChartView(emptyChart);
    renderDietChartSelector();
    showPageStatus(`Diet chart \"${normalizedTitle}\" is ready. Add meals and foods — changes are saved automatically.`, "info");
}

function addMeal(mealData = {}) {
    const mealsContainer = getEl("dietMealsContainer");
    if (!mealsContainer) {
        return null;
    }

    DIET_STATE.mealCounter += 1;
    const mealSort = mealData.sort_order || DIET_STATE.mealCounter;

    const mealEl = document.createElement("div");
    mealEl.className = "meal-card diet-meal-card";
    mealEl.dataset.mealId = mealData.id || "";
    mealEl.dataset.sortOrder = String(mealSort);

    mealEl.innerHTML = `
        <div class="meal-card-header diet-meal-header">
            <div class="diet-meal-name-input-wrap">
                <span class="diet-meal-name-icon" aria-hidden="true"></span>
                <input type="text" class="form-control diet-meal-name" value="${escapeHtml(mealData.meal_name || `Meal ${mealSort}`)}" placeholder="Meal name">
            </div>
            <div class="diet-meal-header-actions">
                <button type="button" class="btn btn-outline-primary btn-sm js-add-food-row">
                    <i class="fa fa-plus"></i> Add Food
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm js-delete-meal">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="meal-card-body">
            <div class="diet-food-rows"></div>
            <div class="diet-meal-footer mt-3">
                <div class="diet-total-chips diet-meal-totals">
                    <span class="diet-total-chip carbs" data-total="carbs"><i class="fa fa-bolt"></i> Carbs 0 gms</span>
                    <span class="diet-total-chip protein" data-total="protein"><i class="fa fa-dumbbell"></i> Protein 0 gms</span>
                    <span class="diet-total-chip fats" data-total="fat"><i class="fa fa-tint"></i> Fats 0 gms</span>
                    <span class="diet-total-chip calories" data-total="calories"><i class="fa fa-fire"></i> Calories 0 kcal</span>
                </div>
            </div>
        </div>
    `;

    mealsContainer.appendChild(mealEl);

    const items = mealData.items || [];
    if (items.length === 0) {
        addFoodRow(mealEl, null);
    } else {
        items.forEach((rowData) => addFoodRow(mealEl, rowData));
    }

    recalculateMealTotals(mealEl);
    renderEditorMealIcons();
    return mealEl;
}

function deleteMeal(mealElement) {
    if (!mealElement) {
        return;
    }

    mealElement.remove();
    recalculateDietChartTotals();
    renderEditorMealIcons();
}

function addFoodRow(mealElement, rowData = null) {
    const rowsContainer = mealElement.querySelector(".diet-food-rows");
    if (!rowsContainer) {
        return null;
    }

    const rowEl = document.createElement("div");
    rowEl.className = "diet-food-row";
    rowEl.dataset.rowId = rowData?.id || "";

    rowEl.innerHTML = `
        <div class="diet-food-row-main">
            <select class="form-control form-control-sm diet-food-select">
                ${buildFoodOptionsHtml()}
            </select>
            <input type="number" class="form-control form-control-sm diet-food-quantity" min="0.01" step="0.01" value="${rowData?.quantity ?? ""}" placeholder="Qty">
            <input type="text" class="form-control form-control-sm diet-food-unit" value="${escapeHtml(rowData?.quantity_unit || "")}" readonly placeholder="Unit">
            <button type="button" class="btn btn-outline-secondary btn-sm js-add-food-inline" title="Add new food">
                <i class="fa fa-plus"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm js-delete-food-row" title="Delete row">
                <i class="fa fa-trash"></i>
            </button>
        </div>
        <div class="diet-food-ref-text text-muted small">Reference data not set</div>
        <div class="diet-row-total-chips">
            <span class="diet-mini-chip carbs" data-value="carbs"><i class="fa fa-bolt"></i> 0 gms</span>
            <span class="diet-mini-chip protein" data-value="protein"><i class="fa fa-dumbbell"></i> 0 gms</span>
            <span class="diet-mini-chip fats" data-value="fat"><i class="fa fa-tint"></i> 0 gms</span>
            <span class="diet-mini-chip calories" data-value="calories"><i class="fa fa-fire"></i> 0 kcal</span>
        </div>
    `;

    rowEl.dataset.foodName = rowData?.food_name || "";
    rowEl.dataset.referenceQuantity = String(rowData?.reference_quantity ?? "");
    rowEl.dataset.referenceUnit = rowData?.reference_unit || "";
    rowEl.dataset.referenceCarbs = String(rowData?.reference_carbs ?? "0");
    rowEl.dataset.referenceProtein = String(rowData?.reference_protein ?? "0");
    rowEl.dataset.referenceFat = String(rowData?.reference_fat ?? "0");
    rowEl.dataset.referenceFibre = String(rowData?.reference_fibre ?? "0");

    rowsContainer.appendChild(rowEl);

    const foodSelect = rowEl.querySelector(".diet-food-select");
    if (foodSelect && rowData?.food_name) {
        const matchingFood = DIET_STATE.foodCatalog.find(
            (food) => (food.food_name || "").toLowerCase() === rowData.food_name.toLowerCase()
        );

        if (matchingFood) {
            foodSelect.value = matchingFood.food_id;
            populateFoodRowFromCatalog(rowEl, matchingFood);
            const qtyInput = rowEl.querySelector(".diet-food-quantity");
            if (qtyInput && rowData.quantity !== null && rowData.quantity !== undefined) {
                qtyInput.value = rowData.quantity;
            }
        } else {
            const customOption = document.createElement("option");
            customOption.value = `__custom__${rowData.food_name}`;
            customOption.textContent = `${rowData.food_name} (Custom)`;
            customOption.selected = true;
            foodSelect.insertBefore(customOption, foodSelect.lastElementChild);

            const unitInput = rowEl.querySelector(".diet-food-unit");
            if (unitInput) {
                unitInput.value = rowData.quantity_unit || rowData.reference_unit || "";
            }

            const refText = rowEl.querySelector(".diet-food-ref-text");
            if (refText) {
                refText.textContent = `Ref: ${formatMacro(rowData.reference_quantity)} ${rowData.reference_unit} | C ${formatMacro(rowData.reference_carbs)} | P ${formatMacro(rowData.reference_protein)} | F ${formatMacro(rowData.reference_fat)} | Fibre ${formatMacro(rowData.reference_fibre)}`;
            }
        }
    }

    recalculateFoodRow(rowEl);
    return rowEl;
}

function deleteFoodRow(rowElement) {
    if (!rowElement) {
        return;
    }

    const mealEl = rowElement.closest(".meal-card");
    rowElement.remove();

    if (mealEl) {
        recalculateMealTotals(mealEl);
    }
}

function populateFoodRowFromCatalog(rowElement, food) {
    if (!rowElement || !food) {
        return;
    }

    rowElement.dataset.foodName = food.food_name || "";
    rowElement.dataset.referenceQuantity = String(food.quantity ?? "");
    rowElement.dataset.referenceUnit = food.unit_of_quantity || "";
    rowElement.dataset.referenceCarbs = String(food.carbs ?? "0");
    rowElement.dataset.referenceProtein = String(food.protein ?? "0");
    rowElement.dataset.referenceFat = String(food.fats ?? "0");
    rowElement.dataset.referenceFibre = String(food.fibre ?? "0");

    const qtyInput = rowElement.querySelector(".diet-food-quantity");
    if (qtyInput && (!qtyInput.value || toNumber(qtyInput.value, 0) <= 0)) {
        qtyInput.value = String(food.quantity || "");
    }

    const unitInput = rowElement.querySelector(".diet-food-unit");
    if (unitInput) {
        unitInput.value = food.unit_of_quantity || "";
    }

    const refText = rowElement.querySelector(".diet-food-ref-text");
    if (refText) {
        refText.textContent = `Ref: ${formatMacro(food.quantity)} ${food.unit_of_quantity} | C ${formatMacro(food.carbs)} | P ${formatMacro(food.protein)} | F ${formatMacro(food.fats)} | Fibre ${formatMacro(food.fibre)}`;
    }

    recalculateFoodRow(rowElement);
}

function recalculateFoodRow(rowElement) {
    if (!rowElement) {
        return;
    }

    const quantity = toNumber(rowElement.querySelector(".diet-food-quantity")?.value, 0);
    const referenceQuantity = toNumber(rowElement.dataset.referenceQuantity, 0);
    const referenceCarbs = toNumber(rowElement.dataset.referenceCarbs, 0);
    const referenceProtein = toNumber(rowElement.dataset.referenceProtein, 0);
    const referenceFat = toNumber(rowElement.dataset.referenceFat, 0);
    const referenceFibre = toNumber(rowElement.dataset.referenceFibre, 0);

    const factor = referenceQuantity > 0 ? quantity / referenceQuantity : 0;

    const calculatedCarbs = referenceCarbs * factor;
    const calculatedProtein = referenceProtein * factor;
    const calculatedFat = referenceFat * factor;
    const calculatedFibre = referenceFibre * factor;
    const calculatedCalories = (calculatedCarbs * 4) + (calculatedProtein * 4) + (calculatedFat * 9);

    rowElement.dataset.calculatedCarbs = String(calculatedCarbs);
    rowElement.dataset.calculatedProtein = String(calculatedProtein);
    rowElement.dataset.calculatedFat = String(calculatedFat);
    rowElement.dataset.calculatedFibre = String(calculatedFibre);
    rowElement.dataset.calculatedCalories = String(calculatedCalories);

    const setChipValue = (key, value, suffix) => {
        const chip = rowElement.querySelector(`.diet-mini-chip[data-value="${key}"]`);
        if (!chip) {
            return;
        }

        const iconEl = chip.querySelector("i");
        chip.innerHTML = `${iconEl ? iconEl.outerHTML : ""} ${formatMacro(value)} ${suffix}`;
    };

    setChipValue("carbs", calculatedCarbs, "gms");
    setChipValue("protein", calculatedProtein, "gms");
    setChipValue("fat", calculatedFat, "gms");
    setChipValue("fibre", calculatedFibre, "gms");
    setChipValue("calories", calculatedCalories, "kcal");

    const mealEl = rowElement.closest(".meal-card");
    if (mealEl) {
        recalculateMealTotals(mealEl);
    }
}

function recalculateMealTotals(mealElement) {
    if (!mealElement) {
        return;
    }

    const rows = Array.from(mealElement.querySelectorAll(".diet-food-row"));

    const totals = rows.reduce((acc, row) => {
        acc.carbs += toNumber(row.dataset.calculatedCarbs, 0);
        acc.protein += toNumber(row.dataset.calculatedProtein, 0);
        acc.fat += toNumber(row.dataset.calculatedFat, 0);
        acc.fibre += toNumber(row.dataset.calculatedFibre, 0);
        acc.calories += toNumber(row.dataset.calculatedCalories, 0);
        return acc;
    }, { carbs: 0, protein: 0, fat: 0, fibre: 0, calories: 0 });

    const setTotal = (key, label, suffix) => {
        const chip = mealElement.querySelector(`.diet-meal-totals .diet-total-chip[data-total="${key}"]`);
        if (!chip) {
            return;
        }

        const iconEl = chip.querySelector("i");
        chip.innerHTML = `${iconEl ? iconEl.outerHTML : ""} ${label} ${formatMacro(totals[key])} ${suffix}`;
    };

    setTotal("carbs", "Carbs", "gms");
    setTotal("protein", "Protein", "gms");
    setTotal("fat", "Fats", "gms");
    setTotal("fibre", "Fibre", "gms");
    setTotal("calories", "Calories", "kcal");

    recalculateDietChartTotals();
}

function recalculateDietChartTotals() {
    const rows = Array.from(document.querySelectorAll("#dietMealsContainer .diet-food-row"));

    const totals = rows.reduce((acc, row) => {
        acc.carbs += toNumber(row.dataset.calculatedCarbs, 0);
        acc.protein += toNumber(row.dataset.calculatedProtein, 0);
        acc.fat += toNumber(row.dataset.calculatedFat, 0);
        acc.fibre += toNumber(row.dataset.calculatedFibre, 0);
        acc.calories += toNumber(row.dataset.calculatedCalories, 0);
        return acc;
    }, { carbs: 0, protein: 0, fat: 0, fibre: 0, calories: 0 });

    const totalsEl = getEl("dietChartTotals");
    if (!totalsEl) {
        return;
    }

    const setDietTotal = (cls, label, value, suffix) => {
        const chip = totalsEl.querySelector(`.diet-total-chip.${cls}`);
        if (!chip) {
            return;
        }

        const iconEl = chip.querySelector("i");
        chip.innerHTML = `${iconEl ? iconEl.outerHTML : ""} ${label} ${formatMacro(value)} ${suffix}`;
    };

    setDietTotal("carbs", "Carbs", totals.carbs, "gms");
    setDietTotal("protein", "Protein", totals.protein, "gms");
    setDietTotal("fats", "Fats", totals.fat, "gms");
    setDietTotal("fibre", "Fibre", totals.fibre, "gms");
    setDietTotal("calories", "Calories", totals.calories, "kcal");
}

function openAddFoodModal(targetRow) {
    openAddCustomFoodModal({ targetRow: targetRow || null, reopenCatalog: false, hideCatalog: false });
}

async function createFoodCatalogItem(payload) {
    const { data, error } = await window.supabaseClient
        .from("food_catalog")
        .insert(payload)
        .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre")
        .single();

    if (error) {
        console.error("createFoodCatalogItem error:", error);
        throw new Error("Failed to create food item: " + error.message);
    }

    return data;
}

function openAddCustomFoodModal(options = {}) {
    DIET_STATE.addFoodTargetRow = options.targetRow || null;
    DIET_STATE.reopenCatalogModalAfterCreateFood = Boolean(options.reopenCatalog);

    const form = getEl("customFoodForm");
    if (form) {
        form.reset();
    }
    const statusEl = getEl("customFoodStatus");
    if (statusEl) {
        statusEl.style.display = "none";
        statusEl.textContent = "";
    }

    const scopeWrap = getEl("customFoodScopeWrap");
    const scopeSwitch = getEl("cfScopeGlobalSwitch");
    if (DIET_STATE.isAdmin) {
        if (scopeWrap) {
            scopeWrap.style.display = "block";
        }
        if (scopeSwitch) {
            scopeSwitch.checked = false;
        }
    } else {
        if (scopeWrap) {
            scopeWrap.style.display = "none";
        }
    }
    updateCustomFoodScopeUi();

    if (window.jQuery && window.jQuery.fn.modal) {
        if (options.hideCatalog !== false) {
            window.jQuery("#selectFoodModal").modal("hide");
        }
        window.jQuery("#customFoodModal").modal("show");
    }
}

async function saveCustomFoodItem() {
    const statusEl = getEl("customFoodStatus");

    const foodName = (getEl("cfFoodName")?.value || "").trim();
    const quantity = toNumber(getEl("cfQuantity")?.value, 0);
    const unit = getEl("cfUnit")?.value || "g";
    const carbs = toNumber(getEl("cfCarbs")?.value, -1);
    const protein = toNumber(getEl("cfProtein")?.value, -1);
    const fats = toNumber(getEl("cfFats")?.value, -1);
    const fibreRaw = (getEl("cfFibre")?.value || "").trim();
    const fibre = fibreRaw === "" ? null : toNumber(fibreRaw, -1);

    if (!foodName) {
        showCustomFoodStatus("Food name is required.", "warning");
        return;
    }
    if (quantity <= 0) {
        showCustomFoodStatus("Quantity must be greater than 0.", "warning");
        return;
    }
    if (carbs < 0 || protein < 0 || fats < 0) {
        showCustomFoodStatus("Carbs, protein and fats cannot be negative.", "warning");
        return;
    }
    if (fibre !== null && fibre < 0) {
        showCustomFoodStatus("Fibre cannot be negative.", "warning");
        return;
    }

    const saveBtn = getEl("customFoodSaveBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...';
    }

    try {
        const ownerUserId = getCatalogCustomOwnerId() || null;
        const isGlobal = Boolean(DIET_STATE.isAdmin && getEl("cfScopeGlobalSwitch")?.checked);
        if (!isGlobal && !ownerUserId) {
            throw new Error("Please select a user before saving a custom food.");
        }

        const payload = {
            food_name: foodName,
            quantity,
            unit_of_quantity: unit,
            carbs,
            protein,
            fats,
            fibre: fibre,
            is_custom: !isGlobal,
            created_by_user_id: isGlobal ? null : ownerUserId,
            updated_at: new Date().toISOString()
        };

        let savedItem = null;
        const { data, error } = await window.supabaseClient
            .from("food_catalog")
            .insert(payload)
            .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
            .single();

        if (error) {
            const errMsg = String(error.message || "").toLowerCase();
            if (errMsg.includes("stack depth") && errMsg.includes("limit exceeded")) {
                // Recursive DB trigger on food_catalog fired. The INSERT may still have succeeded.
                // Reload catalog — if the item exists treat as success, otherwise surface a clear message.
                DIET_STATE.foodCatalog = [];
                await loadFoodCatalogOptions();
                const saved = DIET_STATE.foodCatalog.find((f) => {
                    if (f.food_name !== foodName) {
                        return false;
                    }
                    if (isGlobal) {
                        return !f.is_custom;
                    }
                    return f.is_custom && f.created_by_user_id === ownerUserId;
                });
                if (!saved) {
                    throw new Error("Could not save custom food due to a database configuration issue. Please contact your admin.");
                }
                savedItem = saved;
                // Item was saved — fall through to success UI
            } else {
                throw new Error(error.message);
            }
        } else {
            // Normal success path — reload catalog with fresh data
            savedItem = data;
            DIET_STATE.foodCatalog = [];
            await loadFoodCatalogOptions();
        }

        if (DIET_STATE.addFoodTargetRow && savedItem?.food_id) {
            const selectEl = DIET_STATE.addFoodTargetRow.querySelector(".diet-food-select");
            if (selectEl) {
                selectEl.innerHTML = buildFoodOptionsHtml(savedItem.food_id);
                selectEl.value = savedItem.food_id;
                populateFoodRowFromCatalog(DIET_STATE.addFoodTargetRow, savedItem);
            }
        }

        if (window.jQuery && window.jQuery.fn.modal) {
            window.jQuery("#customFoodModal").modal("hide");
        }

        if (DIET_STATE.reopenCatalogModalAfterCreateFood) {
            await renderFoodCatalogModalList("");
            if (window.jQuery && window.jQuery.fn.modal) {
                window.jQuery("#selectFoodModal").modal("show");
            }
        }

        // Briefly flash the new card
        if (DIET_STATE.reopenCatalogModalAfterCreateFood) {
            setTimeout(() => {
                const newCard = document.querySelector(`[data-food-id="${savedItem?.food_id}"]`);
                if (newCard) {
                    newCard.classList.add("catalog-card-highlight");
                    setTimeout(() => newCard.classList.remove("catalog-card-highlight"), 1200);
                    newCard.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 200);
        }

        DIET_STATE.reopenCatalogModalAfterCreateFood = false;
        DIET_STATE.addFoodTargetRow = null;
    } catch (err) {
        console.error("saveCustomFoodItem error:", err);
        showCustomFoodStatus(err.message || "Failed to save custom food.", "danger");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa fa-save mr-1"></i> Save';
        }
    }
}

function showCustomFoodStatus(message, type = "danger") {
    const el = getEl("customFoodStatus");
    if (!el) return;

    if (type === "info") {
        el.style.display = "none";
        el.textContent = "";
        el.className = "alert";
        return;
    }

    el.className = `alert alert-${type} mt-3 mb-0`;
    el.textContent = message;
    el.style.display = "block";
}

function collectDietChartFormData() {
    if (!DIET_STATE.selectedUserId) {
        throw new Error("Please select a user first.");
    }

    const title = normalizeDietChartName(getEl("dietChartTitle")?.value || "");
    const notes = (getEl("dietChartNotes")?.value || "").trim();

    if (!title) {
        throw new Error("Diet chart title is required.");
    }

    const mealElements = Array.from(document.querySelectorAll("#dietMealsContainer .meal-card"));
    if (mealElements.length === 0) {
        throw new Error("Add at least one meal before saving.");
    }

    const meals = mealElements.map((mealEl, mealIndex) => {
        const mealName = toTitleCaseWords(mealEl.querySelector(".diet-meal-name")?.value || "");
        if (!mealName) {
            throw new Error(`Meal ${mealIndex + 1} name is required.`);
        }

        const rowElements = Array.from(mealEl.querySelectorAll(".diet-food-row"));
        if (rowElements.length === 0) {
            throw new Error(`Add at least one food row in ${mealName}.`);
        }

        const items = rowElements.map((rowEl, rowIndex) => {
            const foodSelect = rowEl.querySelector(".diet-food-select");
            const selectedValue = foodSelect ? foodSelect.value : "";
            const quantity = toNumber(rowEl.querySelector(".diet-food-quantity")?.value, 0);
            const quantityUnit = (rowEl.querySelector(".diet-food-unit")?.value || "").trim();
            const foodName = (rowEl.dataset.foodName || "").trim();

            if (!selectedValue || selectedValue === "__add_new__") {
                throw new Error(`Select food for row ${rowIndex + 1} in ${mealName}.`);
            }

            if (!foodName) {
                throw new Error(`Food name missing for row ${rowIndex + 1} in ${mealName}.`);
            }

            if (quantity <= 0) {
                throw new Error(`Quantity must be greater than 0 for ${foodName}.`);
            }

            const referenceQuantity = toNumber(rowEl.dataset.referenceQuantity, 0);
            if (referenceQuantity <= 0) {
                throw new Error(`Reference quantity missing for ${foodName}.`);
            }

            return {
                food_name: foodName,
                quantity: quantity,
                quantity_unit: quantityUnit || rowEl.dataset.referenceUnit || "",
                reference_quantity: referenceQuantity,
                reference_unit: rowEl.dataset.referenceUnit || "",
                reference_carbs: toNumber(rowEl.dataset.referenceCarbs, 0),
                reference_protein: toNumber(rowEl.dataset.referenceProtein, 0),
                reference_fat: toNumber(rowEl.dataset.referenceFat, 0),
                reference_fibre: toNumber(rowEl.dataset.referenceFibre, 0),
                sort_order: rowIndex + 1,
                updated_at: new Date().toISOString()
            };
        });

        return {
            meal_name: mealName,
            sort_order: mealIndex + 1,
            items
        };
    });

    return {
        user_id: DIET_STATE.selectedUserId,
        title,
        notes,
        meals
    };
}

async function saveDietChart() {
    const payload = collectDietChartFormData();
    setSaveLoading(true);
    hidePageStatus();
    showLoadingSpinner();

    try {
        const createdBy = DIET_STATE.activeAdminId || DIET_STATE.currentUserId || DIET_STATE.selectedUserId || null;
        let chartId = DIET_STATE.selectedChartId;

        if (!chartId) {
            const { data, error } = await window.supabaseClient
                .from("diet_charts")
                .insert({
                    user_id: payload.user_id,
                    title: payload.title,
                    notes: payload.notes || null,
                    created_by: createdBy,
                    updated_at: new Date().toISOString()
                })
                .select("id")
                .single();

            if (error) {
                throw new Error("Create failed: " + error.message);
            }

            chartId = data.id;
            DIET_STATE.selectedChartId = chartId;
        } else {
            const { error: updateError } = await window.supabaseClient
                .from("diet_charts")
                .update({
                    title: payload.title,
                    notes: payload.notes || null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", chartId);

            if (updateError) {
                throw new Error("Update failed: " + updateError.message);
            }

            const { data: existingMeals, error: fetchMealsError } = await window.supabaseClient
                .from("diet_chart_meals")
                .select("id")
                .eq("diet_chart_id", chartId);

            if (fetchMealsError) {
                throw new Error("Failed to fetch existing meals: " + fetchMealsError.message);
            }

            const existingMealIds = (existingMeals || []).map((meal) => meal.id);
            if (existingMealIds.length > 0) {
                const { error: deleteItemsError } = await window.supabaseClient
                    .from("diet_chart_items")
                    .delete()
                    .in("meal_id", existingMealIds);

                if (deleteItemsError) {
                    throw new Error("Failed to clear existing items: " + deleteItemsError.message);
                }
            }

            const { error: deleteMealsError } = await window.supabaseClient
                .from("diet_chart_meals")
                .delete()
                .eq("diet_chart_id", chartId);

            if (deleteMealsError) {
                throw new Error("Failed to clear existing meals: " + deleteMealsError.message);
            }
        }

        for (const mealPayload of payload.meals) {
            const { data: insertedMeal, error: mealInsertError } = await window.supabaseClient
                .from("diet_chart_meals")
                .insert({
                    diet_chart_id: chartId,
                    meal_name: mealPayload.meal_name,
                    sort_order: mealPayload.sort_order
                })
                .select("id")
                .single();

            if (mealInsertError || !insertedMeal) {
                const mealErrMsg = String(mealInsertError?.message || "").toLowerCase();
                if (mealErrMsg.includes("stack depth") && mealErrMsg.includes("limit exceeded")) {
                    console.warn("Ignoring stack depth error on diet_chart_meals insert, skipping items for this meal.", mealInsertError);
                    continue;
                } else {
                    throw new Error("Meal save failed: " + (mealInsertError?.message || "no meal ID returned"));
                }
            }

            if (mealPayload.items.length > 0) {
                const itemsPayload = mealPayload.items.map((item) => ({
                    meal_id: insertedMeal.id,
                    food_name: item.food_name,
                    quantity: item.quantity,
                    quantity_unit: item.quantity_unit,
                    reference_quantity: item.reference_quantity,
                    reference_unit: item.reference_unit,
                    reference_carbs: item.reference_carbs,
                    reference_protein: item.reference_protein,
                    reference_fat: item.reference_fat,
                    reference_fibre: item.reference_fibre,
                    sort_order: item.sort_order
                }));

                const { error: itemInsertError } = await window.supabaseClient
                    .from("diet_chart_items")
                    .insert(itemsPayload);

                if (itemInsertError) {
                    const itemErrMsg = String(itemInsertError.message || "").toLowerCase();
                    if (itemErrMsg.includes("stack depth") && itemErrMsg.includes("limit exceeded")) {
                        console.warn("Ignoring stack depth error on diet_chart_items insert.", itemInsertError);
                    } else {
                        throw new Error("Item save failed: " + itemInsertError.message);
                    }
                }
            }
        }

        const loadedChart = await loadDietChart(chartId);
        DIET_STATE.currentChartData = loadedChart;
        DIET_STATE.isEditMode = false;
        renderDietChartEditor(loadedChart);
        renderDietChartView(loadedChart);
        await loadDietChartsForUser(DIET_STATE.selectedUserId);
        renderDietChartSelector();
        setEditorVisibility(true);
        setDietDirty(false);
        hideLoadingSpinner();
    } catch (error) {
        console.error("saveDietChart error:", error);
        showPageStatus(error.message || "Failed to save diet chart.", "danger");
        hideLoadingSpinner();
        throw error;
    } finally {
        setSaveLoading(false);
    }
}

async function deleteDietChart(chartId) {
    if (!chartId) {
        return;
    }

    if (isCreatedByAdminOtherThanCurrent(getChartById(chartId))) {
        showPageStatus("This diet chart is pinned by admin and cannot be deleted.", "warning");
        return;
    }

    const confirmed = await showDietConfirm("Delete this diet chart and all related meals/items?", {
        title: "Delete",
        confirmText: "Delete",
        confirmClass: "btn-danger"
    });

    if (!confirmed) {
        return;
    }

    try {
        const { data: meals, error: mealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .select("id")
            .eq("diet_chart_id", chartId);

        if (mealsError) {
            throw new Error(mealsError.message);
        }

        const mealIds = (meals || []).map((meal) => meal.id);
        if (mealIds.length > 0) {
            const { error: deleteItemsError } = await window.supabaseClient
                .from("diet_chart_items")
                .delete()
                .in("meal_id", mealIds);

            if (deleteItemsError) {
                throw new Error(deleteItemsError.message);
            }
        }

        const { error: deleteMealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .delete()
            .eq("diet_chart_id", chartId);

        if (deleteMealsError) {
            throw new Error(deleteMealsError.message);
        }

        const { data: deletedCharts, error: deleteChartError } = await window.supabaseClient
            .from("diet_charts")
            .delete()
            .eq("id", chartId)
            .select("id");

        if (deleteChartError) {
            throw new Error(deleteChartError.message);
        }

        if (!Array.isArray(deletedCharts) || deletedCharts.length === 0) {
            throw new Error("Delete was blocked by permissions (RLS). Please check Supabase policy for diet_charts delete.");
        }

        DIET_STATE.selectedChartId = "";
        DIET_STATE.currentChartData = null;

        const charts = await loadDietChartsForUser(DIET_STATE.selectedUserId);
        if (charts.length > 0) {
            await loadAndRenderDietChart(charts[0].id);
        } else {
            setEditorVisibility(false);
            setSelectedDietChartName("No chart selected");
        }

        showPageStatus("Diet chart deleted.", "success");
    } catch (error) {
        console.error("deleteDietChart error:", error);
        showPageStatus(error.message || "Failed to delete diet chart.", "danger");
    }
}

function resetDietChartPage() {
    DIET_STATE.dietCharts = [];
    DIET_STATE.selectedChartId = "";
    DIET_STATE.selectedUserId = "";
    DIET_STATE.mealCounter = 0;
    DIET_STATE.isEditMode = false;
    DIET_STATE.hasUnsavedChanges = false;
    DIET_STATE.currentChartData = null;
    DIET_STATE.activeChartIsLocked = false;

    const userSelect = getEl("dietUserSelect");
    if (userSelect) {
        userSelect.value = "";
    }

    const titleEl = getEl("dietChartTitle");
    const notesEl = getEl("dietChartNotes");
    const mealsContainer = getEl("dietMealsContainer");
    const viewEl = getEl("dietChartView");

    if (titleEl) {
        titleEl.value = "";
    }

    if (notesEl) {
        notesEl.value = "";
    }

    if (mealsContainer) {
        mealsContainer.innerHTML = "";
    }

    if (viewEl) {
        viewEl.innerHTML = "";
    }

    hidePageStatus();
    renderDietChartSelector();
    setSelectedDietChartName("Diet Chart");
    setDietDirty(false);
    setEditorVisibility(false);
    recalculateDietChartTotals();
}

async function createDietChartFromPrompt() {
    if (!DIET_STATE.selectedUserId) {
        showPageStatus("Select a user first.", "warning");
        return;
    }

    if (Array.isArray(DIET_STATE.dietCharts) && DIET_STATE.dietCharts.length >= 3) {
        await showDietAlert("You can create up to 3 diet charts only.", { title: "Limit Reached" });
        return;
    }

    const chartName = await promptDietChartName("", {
        title: "New Diet Chart",
        confirmLabel: "Save"
    });
    if (!chartName) {
        return;
    }

    if (chartName.length > 12) {
        await showDietAlert("Diet chart name must be 12 characters or less.", { title: "Validation" });
        return;
    }

    showLoadingSpinner();
    hidePageStatus();

    try {
        const createdBy = await resolveActorUserId();
        if (!createdBy) {
            throw new Error("Please login again and retry.");
        }
        const { data, error } = await window.supabaseClient
            .from("diet_charts")
            .insert({
                user_id: DIET_STATE.selectedUserId,
                title: chartName,
                notes: null,
                created_by: createdBy,
                updated_at: new Date().toISOString()
            })
            .select("id")
            .single();

        if (error || !data?.id) {
            throw new Error(error?.message || "Failed to create diet chart.");
        }

        createEmptyDietChart(DIET_STATE.selectedUserId, chartName, data.id);
        await loadDietChartsForUser(DIET_STATE.selectedUserId);
        DIET_STATE.selectedChartId = data.id;
        renderDietChartSelector();
    } catch (error) {
        console.error("createDietChartFromPrompt error:", error);
        showPageStatus(error.message || "Failed to create diet chart.", "danger");
    } finally {
        hideLoadingSpinner();
    }
}

async function renameSelectedDietChart() {
    if (!DIET_STATE.selectedChartId) {
        return;
    }

    const selectedChart = (DIET_STATE.dietCharts || []).find((chart) => String(chart.id) === String(DIET_STATE.selectedChartId));
    if (isCreatedByAdminOtherThanCurrent(selectedChart)) {
        showPageStatus("This diet chart is pinned by admin and cannot be renamed.", "warning");
        return;
    }

    const currentName = getDietChartName(selectedChart);
    const nextName = await promptDietChartName(currentName, {
        title: "Rename",
        confirmLabel: "Save"
    });
    if (!nextName || nextName === currentName) {
        return;
    }

    if (nextName.length > 12) {
        await showDietAlert("Diet chart name must be 12 characters or less.", { title: "Validation" });
        return;
    }

    hidePageStatus();
    showLoadingSpinner();
    try {
        const { data: updatedChart, error } = await window.supabaseClient
            .from("diet_charts")
            .update({
                title: nextName,
                updated_at: new Date().toISOString()
            })
            .eq("id", DIET_STATE.selectedChartId)
            .select("id")
            .maybeSingle();

        if (error) {
            throw new Error(error.message || "Failed to rename diet chart.");
        }

        if (!updatedChart?.id) {
            throw new Error("Rename was blocked by permissions (RLS). Please check Supabase policy for diet_charts update.");
        }

        if (DIET_STATE.currentChartData?.chart) {
            DIET_STATE.currentChartData.chart.title = nextName;
            renderDietChartView(DIET_STATE.currentChartData);
        }

        await loadDietChartsForUser(DIET_STATE.selectedUserId);
        renderDietChartSelector();
        showPageStatus("Diet chart renamed successfully.", "success");
    } catch (error) {
        console.error("renameSelectedDietChart error:", error);
        showPageStatus(error.message || "Failed to rename diet chart.", "danger");
    } finally {
        hideLoadingSpinner();
    }
}

async function handleUserSelection(userId) {
    hidePageStatus();
    showLoadingSpinner();

    DIET_STATE.selectedUserId = userId || "";
    DIET_STATE.selectedChartId = "";
    DIET_STATE.dietCharts = [];
    renderDietChartSelector();

    if (!userId) {
        DIET_STATE.activeChartIsLocked = false;
        hideLoadingSpinner();
        setEditorVisibility(false);
        return;
    }

    try {
        await loadSelectedUserMeta(userId);

        const charts = await loadDietChartsForUser(userId);
        if (!charts.length) {
            DIET_STATE.activeChartIsLocked = false;
            hideLoadingSpinner();
            setEditorVisibility(false);
            return;
        }

        await loadAndRenderDietChart(charts[0].id);
        hideLoadingSpinner();
    } catch (error) {
        console.error("handleUserSelection error:", error);
        hideLoadingSpinner();
        showPageStatus(error.message || "Failed to load diet chart.", "danger");
    }
}

function bindDietChartEvents() {
    const userSelect = getEl("dietUserSelect");
    const chartStrip = getEl("dietChartStrip");
    const createBtn = getEl("createDietChartBtn");
    const addMealBtn = getEl("addMealBtn");
    const saveBtn = getEl("saveDietChartBtn");
    const deleteBtn = getEl("deleteDietChartBtn");
    const resetBtn = getEl("dietResetPageBtn");
    const mealsContainer = getEl("dietMealsContainer");
    const viewModeBtn = getEl("dietViewModeBtn");
    const editModeBtn = getEl("dietEditModeBtn");

    if (userSelect) {
        userSelect.addEventListener("change", async (event) => {
            await handleUserSelection(event.target.value);
        });
    }

    if (chartStrip) {
        // Outside-click closes any open per-card menu
        if (!DIET_STATE.chartActionMenuOutsideBound) {
            document.addEventListener("click", () => {
                closeDietChartActionsMenu();
            });
            DIET_STATE.chartActionMenuOutsideBound = true;
        }

        chartStrip.addEventListener("click", async (event) => {
            // Create new chart card
            const createCard = event.target.closest(".js-diet-chart-create");
            if (createCard) {
                await createDietChartFromPrompt();
                return;
            }

            // Per-card 3-dot menu button
            const menuBtn = event.target.closest(".js-card-menu-btn");
            if (menuBtn) {
                event.preventDefault();
                event.stopPropagation();
                const chartId = menuBtn.getAttribute("data-chart-id");

                if (isDietChartMobileMenuMode()) {
                    openDietChartCardActionSheet(chartId);
                    return;
                }

                const menu = chartStrip.querySelector(`.tp-plan-card-menu[data-menu-chart-id="${chartId}"]`);
                chartStrip.querySelectorAll(".tp-plan-card-menu").forEach((m) => {
                    if (m !== menu) {
                        m.classList.remove("is-open");
                        m.hidden = true;
                    }
                });
                if (menu) {
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
                }
                return;
            }

            // Per-card menu action items (rename / delete)
            const cardAction = event.target.closest("[data-card-action]");
            if (cardAction) {
                event.stopPropagation();
                const action = cardAction.getAttribute("data-card-action");
                const chartId = cardAction.getAttribute("data-chart-id");
                const targetChart = getChartById(chartId);

                if (isCreatedByAdminOtherThanCurrent(targetChart)) {
                    showPageStatus("This diet chart is pinned by admin and read-only.", "warning");
                    closeDietChartActionsMenu();
                    return;
                }

                DIET_STATE.selectedChartId = chartId;
                closeDietChartActionsMenu();
                if (action === "rename-chart") {
                    await renameSelectedDietChart();
                } else if (action === "delete-chart") {
                    await deleteDietChart(chartId);
                }
                return;
            }

            // Chart card selection
            const chartCard = event.target.closest(".tp-plan-card[data-chart-id]");
            if (!chartCard) {
                return;
            }

            const nextChartId = chartCard.getAttribute("data-chart-id");
            if (!nextChartId || String(nextChartId) === String(DIET_STATE.selectedChartId)) {
                return;
            }

            // Immediately reflect selection for snappier UI, then load chart data.
            DIET_STATE.selectedChartId = nextChartId;
            renderDietChartSelector();
            closeDietChartActionsMenu();
            hidePageStatus();
            showLoadingSpinner();
            try {
                await loadAndRenderDietChart(nextChartId);
            } catch (error) {
                console.error("chart switch error:", error);
                showPageStatus(error.message || "Failed to load selected diet chart.", "danger");
            } finally {
                hideLoadingSpinner();
            }
        });

        // Long-press on mobile/tablet → show per-card edit/delete menu
        let longPressTimer = null;

        chartStrip.addEventListener("touchstart", (event) => {
            const chartCard = event.target.closest(".tp-plan-card[data-chart-id]");
            if (!chartCard || event.target.closest(".js-card-menu-btn")) {
                return;
            }

            if (!isDietChartMobileMenuMode()) {
                return;
            }

            longPressTimer = setTimeout(() => {
                longPressTimer = null;
                const chartId = chartCard.getAttribute("data-chart-id");
                closeDietChartActionsMenu();
                openDietChartCardActionSheet(chartId);
            }, 500);
        }, { passive: true });

        const cancelLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        chartStrip.addEventListener("touchend", cancelLongPress, { passive: true });
        chartStrip.addEventListener("touchmove", cancelLongPress, { passive: true });
        chartStrip.addEventListener("touchcancel", cancelLongPress, { passive: true });
    }

    if (createBtn) {
        createBtn.addEventListener("click", async () => {
            await createDietChartFromPrompt();
        });
    }

    if (addMealBtn) {
        addMealBtn.addEventListener("click", () => {
            addMeal({ meal_name: `Meal ${DIET_STATE.mealCounter + 1}` });
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            try {
                await saveDietChart();
            } catch (error) {
                console.error(error);
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            await deleteDietChart(DIET_STATE.selectedChartId);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetDietChartPage();
        });
    }

    if (viewModeBtn) {
        viewModeBtn.addEventListener("click", () => {
            if (!DIET_STATE.currentChartData && !DIET_STATE.selectedChartId) {
                return;
            }

            DIET_STATE.isEditMode = false;
            if (DIET_STATE.currentChartData) {
                renderDietChartView(DIET_STATE.currentChartData);
            }
            setEditorVisibility(true);
        });
    }

    if (editModeBtn) {
        editModeBtn.addEventListener("click", () => {
            if (!DIET_STATE.selectedUserId) {
                showPageStatus("Select a user first.", "warning");
                return;
            }

            if (isActiveChartReadOnly()) {
                showPageStatus("This diet chart is pinned by admin and read-only.", "warning");
                DIET_STATE.isEditMode = false;
                setEditorVisibility(true);
                return;
            }

            DIET_STATE.isEditMode = true;
            setEditorVisibility(true);
        });
    }

    if (mealsContainer) {
        mealsContainer.addEventListener("click", (event) => {
            const target = event.target.closest("button");
            if (!target) {
                return;
            }

            if (target.classList.contains("js-add-food-row")) {
                const mealEl = target.closest(".meal-card");
                if (mealEl) {
                    addFoodRow(mealEl, null);
                    recalculateMealTotals(mealEl);
                }
                return;
            }

            if (target.classList.contains("js-delete-meal")) {
                const mealEl = target.closest(".meal-card");
                if (mealEl) {
                    deleteMeal(mealEl);
                }
                return;
            }

            if (target.classList.contains("js-delete-food-row")) {
                const rowEl = target.closest(".diet-food-row");
                if (rowEl) {
                    deleteFoodRow(rowEl);
                }
                return;
            }

            if (target.classList.contains("js-add-food-inline")) {
                const rowEl = target.closest(".diet-food-row");
                openAddFoodModal(rowEl);
            }
        });

        mealsContainer.addEventListener("change", (event) => {
            const target = event.target;

            if (target.classList.contains("diet-food-select")) {
                const rowEl = target.closest(".diet-food-row");
                if (!rowEl) {
                    return;
                }

                if (target.value === "__add_new__") {
                    openAddFoodModal(rowEl);
                    return;
                }

                const selectedFood = DIET_STATE.foodCatalog.find((food) => food.food_id === target.value);
                if (selectedFood) {
                    populateFoodRowFromCatalog(rowEl, selectedFood);
                }
            }

            if (target.classList.contains("diet-food-quantity")) {
                const rowEl = target.closest(".diet-food-row");
                recalculateFoodRow(rowEl);
            }
        });

        mealsContainer.addEventListener("input", (event) => {
            if (event.target.classList.contains("diet-food-quantity")) {
                const rowEl = event.target.closest(".diet-food-row");
                recalculateFoodRow(rowEl);
                return;
            }

            if (event.target.classList.contains("diet-meal-name")) {
                renderEditorMealIcons();
            }
        });
    }

    const addFoodForm = getEl("addFoodForm");

    if (addFoodForm) {
        addFoodForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const payload = {
                food_name: (getEl("newFoodName")?.value || "").trim(),
                quantity: toNumber(getEl("newFoodQuantity")?.value, 0),
                unit_of_quantity: getEl("newFoodUnit")?.value || "g",
                carbs: toNumber(getEl("newFoodCarbs")?.value, 0),
                protein: toNumber(getEl("newFoodProtein")?.value, 0),
                fats: toNumber(getEl("newFoodFats")?.value, 0),
                fibre: (() => {
                    const raw = getEl("newFoodFibre")?.value;
                    return raw === "" || raw === null || raw === undefined ? null : toNumber(raw, 0);
                })(),
                updated_at: new Date().toISOString()
            };

            if (!payload.food_name) {
                await showDietAlert("Food name is required.", { title: "Validation" });
                return;
            }

            if (payload.quantity <= 0) {
                await showDietAlert("Quantity must be greater than 0.", { title: "Validation" });
                return;
            }

            if (payload.carbs < 0 || payload.protein < 0 || payload.fats < 0 || (payload.fibre !== null && payload.fibre < 0)) {
                await showDietAlert("Macros cannot be negative.", { title: "Validation" });
                return;
            }

            try {
                const createdFood = await createFoodCatalogItem(payload);
                DIET_STATE.foodCatalog = [];
                await loadFoodCatalogOptions();

                if (DIET_STATE.addFoodTargetRow) {
                    const selectEl = DIET_STATE.addFoodTargetRow.querySelector(".diet-food-select");
                    if (selectEl) {
                        selectEl.innerHTML = buildFoodOptionsHtml(createdFood.food_id);
                        selectEl.value = createdFood.food_id;
                        populateFoodRowFromCatalog(DIET_STATE.addFoodTargetRow, createdFood);
                    }
                }

                if (window.jQuery && window.jQuery.fn.modal) {
                    window.jQuery("#addFoodModal").modal("hide");
                }

                if (DIET_STATE.reopenCatalogModalAfterCreateFood) {
                    DIET_STATE.reopenCatalogModalAfterCreateFood = false;
                    await renderFoodCatalogModalList("");
                    if (window.jQuery && window.jQuery.fn.modal) {
                        window.jQuery("#selectFoodModal").modal("show");
                    }
                }

                await showDietAlert("Food created and selected successfully.", { title: "Food Added" });
            } catch (error) {
                console.error("add food modal submit error:", error);
                await showDietAlert(error.message || "Failed to create food.", { title: "Create Failed" });
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const user = await requireLoginOrRedirect();
        if (!user) {
            setDietPagePending(false);
            return;
        }

        let accessState = null;
        if (typeof window.getAccessState === "function") {
            try {
                accessState = await window.getAccessState();
            } catch (error) {
                console.warn("diet access state lookup warning:", error?.message || error);
            }

            if (!accessState) {
                try {
                    accessState = await window.getAccessState({ user });
                } catch (error) {
                    console.warn("diet access state fallback warning:", error?.message || error);
                }
            }
        }

        const isAdmin = Boolean(accessState?.isAdmin || (typeof window.isAdminUser === "function" && window.isAdminUser(user)));
        const roleFromAccess = String(accessState?.role || accessState?.profile?.role || "").toLowerCase();
        const canManageReplacements = Boolean(isAdmin || roleFromAccess === "coach");

        DIET_STATE.activeAdminId = user.id;
        DIET_STATE.currentUserId = user.id;
        DIET_STATE.isAdmin = isAdmin;
        DIET_STATE.canManageReplacements = canManageReplacements;

        bindDietChartEvents();

        if (isAdmin) {
            try {
                await loadFoodCatalogOptions();
                await loadUsersList();
                setDietUserToolbarVisible(true);
                resetDietChartPage();
            } catch (error) {
                console.error("diet chart admin init error:", error);
                await showDietAlert(error.message || "Failed to initialize page.", { title: "Initialization Error" });
            }
        } else {
            setDietUserToolbarVisible(false);

            const pageTitle = document.querySelector('.diet-page-title');
            if (pageTitle) pageTitle.textContent = 'Diet Chart';

            const subtitle = document.querySelector('.diet-page-subtitle');
            if (subtitle) subtitle.textContent = 'My Diet Charts';

            try {
                await loadFoodCatalogOptions();
                DIET_STATE.selectedUserId = user.id;
                await loadSelectedUserMeta(user.id);
                showLoadingSpinner();

                const charts = await loadDietChartsForUser(user.id);
                if (charts.length > 0) {
                    await loadAndRenderDietChart(charts[0].id);
                } else {
                    setEditorVisibility(false);
                    setSelectedDietChartName("No chart selected");
                }

                hideLoadingSpinner();
            } catch (error) {
                hideLoadingSpinner();
                console.error("diet chart client init error:", error);
                await showDietAlert(error.message || "Failed to load your diet chart.", { title: "Initialization Error" });
            }
        }

        setDietPagePending(false);
    } catch (error) {
        console.error("diet chart bootstrap error:", error);
        setDietPagePending(false);
        await showDietAlert(error.message || "Failed to initialize page.", { title: "Initialization Error" });
        return;
    }

    // Add event listener for delete confirmation modal
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteFoodItem);
    }

    // Add event listener for delete meal confirmation modal
    const confirmDeleteMealBtn = document.getElementById('confirmDeleteMealBtn');
    if (confirmDeleteMealBtn) {
        confirmDeleteMealBtn.addEventListener('click', () => {
            const modal = document.getElementById('deleteMealModal');
            if (modal) {
                const mealIndex = parseInt(modal.getAttribute('data-meal-index'));
                if (!isNaN(mealIndex)) {
                    deleteMealFromViewChart(mealIndex);
                }
                $('#deleteMealModal').modal('hide');
            }
        });
    }

    const viewSaveBtn = getEl("dietViewSaveBtn");
    if (viewSaveBtn) {
        viewSaveBtn.addEventListener("click", async () => {
            await syncViewChartToSupabase();
        });
    }

    const openAddFoodFromCatalogModalBtn = getEl("openAddFoodFromCatalogModalBtn");
    if (openAddFoodFromCatalogModalBtn) {
        openAddFoodFromCatalogModalBtn.addEventListener("click", () => {
            openAddCustomFoodModal({ targetRow: null, reopenCatalog: true, hideCatalog: true });
        });
    }

    const customFoodForm = getEl("customFoodForm");
    if (customFoodForm) {
        customFoodForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await saveCustomFoodItem();
        });
    }

    const customFoodCancelBtn = getEl("customFoodCancelBtn");
    if (customFoodCancelBtn) {
        customFoodCancelBtn.addEventListener("click", () => {
            if (window.jQuery && window.jQuery.fn.modal) {
                window.jQuery("#customFoodModal").modal("hide");
                window.jQuery("#selectFoodModal").modal("show");
            }
        });
    }

    const cfScopeGlobalSwitch = getEl("cfScopeGlobalSwitch");
    if (cfScopeGlobalSwitch) {
        cfScopeGlobalSwitch.addEventListener("change", () => {
            updateCustomFoodScopeUi();
        });
    }

    const foodSearchInput = getEl("foodSearchInput");
    if (foodSearchInput) {
        foodSearchInput.addEventListener("input", async (event) => {
            const query = event.target.value || "";
            renderCatalogSearchSuggestions(query);
            await renderFoodCatalogModalList(query);
        });

        foodSearchInput.addEventListener("keydown", async (event) => {
            const suggestionEl = getEl("catalogSearchSuggestions");
            const suggestionButtons = suggestionEl
                ? Array.from(suggestionEl.querySelectorAll(".food-search-suggestion-item"))
                : [];
            const hasSuggestions = suggestionButtons.length > 0 && suggestionEl.style.display !== "none";

            if (event.key === "ArrowDown" && hasSuggestions) {
                event.preventDefault();
                const nextIndex = DIET_STATE.catalogSearchSuggestionIndex + 1 >= suggestionButtons.length
                    ? 0
                    : DIET_STATE.catalogSearchSuggestionIndex + 1;
                highlightCatalogSearchSuggestion(nextIndex);
                return;
            }

            if (event.key === "ArrowUp" && hasSuggestions) {
                event.preventDefault();
                const nextIndex = DIET_STATE.catalogSearchSuggestionIndex - 1 < 0
                    ? suggestionButtons.length - 1
                    : DIET_STATE.catalogSearchSuggestionIndex - 1;
                highlightCatalogSearchSuggestion(nextIndex);
                return;
            }

            if (event.key === "Enter" && hasSuggestions && DIET_STATE.catalogSearchSuggestionIndex >= 0) {
                event.preventDefault();
                const activeButton = suggestionButtons[DIET_STATE.catalogSearchSuggestionIndex];
                if (activeButton) {
                    await applyCatalogSearchSuggestion(activeButton.getAttribute("data-name") || "");
                }
                return;
            }

            if (event.key === "Escape") {
                hideCatalogSearchSuggestions();
            }
        });

        foodSearchInput.addEventListener("blur", () => {
            window.setTimeout(() => {
                hideCatalogSearchSuggestions();
            }, 120);
        });
    }

    const catalogQuickSuggestions = getEl("catalogQuickSuggestions");
    if (catalogQuickSuggestions && foodSearchInput) {
        catalogQuickSuggestions.addEventListener("click", (event) => {
            const chip = event.target.closest("[data-search-chip]");
            if (!chip) {
                return;
            }
            const term = chip.getAttribute("data-search-chip") || "";
            foodSearchInput.value = term;
            hideCatalogSearchSuggestions();
            renderFoodCatalogModalList(term);
        });
    }

    const catalogSearchSuggestions = getEl("catalogSearchSuggestions");
    if (catalogSearchSuggestions && foodSearchInput) {
        catalogSearchSuggestions.addEventListener("mousedown", async (event) => {
            const suggestionBtn = event.target.closest(".food-search-suggestion-item");
            if (!suggestionBtn) {
                return;
            }

            event.preventDefault();
            await applyCatalogSearchSuggestion(suggestionBtn.getAttribute("data-name") || "");
        });
    }

    const foodCatalogList = getEl("foodCatalogList");
    if (foodCatalogList) {
        foodCatalogList.addEventListener("input", (event) => {
            const qtyInput = event.target.closest(".food-catalog-qty-input");
            if (!qtyInput) {
                return;
            }

            const card = qtyInput.closest(".diet-catalog-pick-card");
            if (!card) {
                return;
            }
        });

        foodCatalogList.addEventListener("click", async (event) => {
            const qtyInputClick = event.target.closest(".food-catalog-qty-input");
            const qtyUpBtn = event.target.closest(".js-catalog-qty-up");
            const qtyDownBtn = event.target.closest(".js-catalog-qty-down");

            if (isCatalogQtySheetMode() && (qtyInputClick || qtyUpBtn || qtyDownBtn)) {
                event.preventDefault();
                const card = (qtyInputClick || qtyUpBtn || qtyDownBtn).closest(".diet-catalog-pick-card");
                const qtyInput = card ? card.querySelector(".food-catalog-qty-input") : null;
                const foodId = qtyInput ? String(qtyInput.getAttribute("data-food-id") || "") : "";
                const foodName = card ? card.querySelector(".diet-catalog-pick-name")?.textContent || "" : "";
                const unit = card ? card.querySelector(".diet-catalog-unit-pill")?.textContent || "" : "";
                const currentQuantity = qtyInput ? qtyInput.value : "";

                openCatalogQtyActionSheet({
                    foodId,
                    foodName,
                    unit,
                    currentQuantity
                });
                return;
            }

            if (qtyUpBtn || qtyDownBtn) {
                const card = (qtyUpBtn || qtyDownBtn).closest(".diet-catalog-pick-card");
                const qtyInput = card ? card.querySelector(".food-catalog-qty-input") : null;
                if (qtyInput) {
                    const step = parseFloat(qtyInput.step) || 0.01;
                    const min = parseFloat(qtyInput.min) || step;
                    let val = toNumber(qtyInput.value, min);
                    val = qtyDownBtn
                        ? Math.max(min, parseFloat((val - step).toFixed(2)))
                        : parseFloat((val + step).toFixed(2));
                    qtyInput.value = formatMacro(val);
                }
                return;
            }

            const pickButton = event.target.closest(".js-add-food-catalog-item");
            if (!pickButton) {
                return;
            }

            const modal = getEl("selectFoodModal");
            const mealIndex = modal ? parseInt(modal.getAttribute("data-meal-index"), 10) : NaN;
            const foodId = pickButton.getAttribute("data-food-id");
            const row = pickButton.closest(".diet-catalog-pick-card");
            const qtyInput = row ? row.querySelector(".food-catalog-qty-input") : null;
            const selectedQuantity = qtyInput ? toNumber(qtyInput.value, 0) : 0;

            if (selectedQuantity <= 0) {
                showDietAlert("Quantity must be greater than 0.", { title: "Validation" });
                return;
            }

            if (foodId && !Number.isNaN(mealIndex)) {
                await addFoodFromCatalogToMeal(foodId, mealIndex, selectedQuantity);
            }
        });
    }
});

window.loadUsersList = loadUsersList;
window.handleUserSelection = handleUserSelection;
window.checkExistingDietChart = checkExistingDietChart;
window.loadDietChartsForUser = loadDietChartsForUser;
window.loadAndRenderDietChart = loadAndRenderDietChart;
window.loadDietChart = loadDietChart;
window.renderDietChartEditor = renderDietChartEditor;
window.createEmptyDietChart = createEmptyDietChart;
window.addMeal = addMeal;
window.deleteMeal = deleteMeal;
window.addMealToViewChart = addMealToViewChart;
window.deleteMealFromViewChart = deleteMealFromViewChart;
window.addFoodRow = addFoodRow;
window.deleteFoodRow = deleteFoodRow;
window.loadFoodCatalogOptions = loadFoodCatalogOptions;
window.loadVisibleFoodCatalogItems = loadVisibleFoodCatalogItems;
window.openAddCustomFoodModal = openAddCustomFoodModal;
window.saveCustomFoodItem = saveCustomFoodItem;
window.populateFoodRowFromCatalog = populateFoodRowFromCatalog;
window.recalculateFoodRow = recalculateFoodRow;
window.recalculateMealTotals = recalculateMealTotals;
window.recalculateDietChartTotals = recalculateDietChartTotals;
window.openAddFoodModal = openAddFoodModal;
window.openFoodCatalogModalForMeal = openFoodCatalogModalForMeal;
window.createFoodCatalogItem = createFoodCatalogItem;
window.collectDietChartFormData = collectDietChartFormData;
window.saveDietChart = saveDietChart;
window.deleteDietChart = deleteDietChart;
window.resetDietChartPage = resetDietChartPage;
