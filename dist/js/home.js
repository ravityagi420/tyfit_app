const homeData = {
    name: "",
    fullName: "",
    profileImage: "assets/avatars/avatar-1.svg",
    motivationTitle: "Small habits.\nBig transformation.",
    motivationText: "Stay consistent today,\nthank yourself tomorrow.",
    notifications: [],
    tools: [
        { title: "Diet Chart", subtitle: "Track nutrition", href: "portal/diet_chart.html", icon: "salad", colorClass: "icon-diet" },
        { title: "Training Plan", subtitle: "Custom workouts", href: "training_plan.html", icon: "dumbbell", colorClass: "icon-training" },
        { title: "Daily Check-in", subtitle: "Log your day", href: "daily_checkin.html", icon: "clipboard-check", colorClass: "icon-food" },
        { title: "BMR Calculator", subtitle: "Know your BMR", href: "#", icon: "calculator", colorClass: "icon-bmr", calculator: "bmr" },
        { title: "Macro Calculator", subtitle: "Plan macros", href: "#", icon: "pie-chart", colorClass: "icon-macro", comingSoon: true, hideComingSoonBadge: true },
        { title: "Goal Calculator", subtitle: "Set your goal", href: "#", icon: "target", colorClass: "icon-reminder", comingSoon: true, hideComingSoonBadge: true }
    ]
};

const disabledCalculators = new Set(["macro", "goal"]);

function byId(id) {
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

function isInternalHomeLink(link) {
    if (!link || !link.getAttribute) return false;
    if (link.target && link.target !== "_self") return false;
    if (link.hasAttribute("download")) return false;
    const href = (link.getAttribute("href") || "").trim();
    if (!href || href === "#" || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.href !== window.location.href;
}

function refreshIcons() {
    if (typeof window.tyfitRefreshIcons === "function") {
        window.tyfitRefreshIcons();
        return;
    }
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

function mountHomeLoader() {
    if (byId("tyfitPageLoader")) return;
    const loader = document.createElement("div");
    loader.id = "tyfitPageLoader";
    loader.className = "tyfit-page-loader";
    loader.innerHTML = [
        '<div class="tyfit-page-loader__shell" aria-hidden="true">',
        '  <span class="tyfit-page-loader__bar tyfit-page-loader__bar--sm"></span>',
        '  <span class="tyfit-page-loader__hero"></span>',
        '  <span class="tyfit-page-loader__row"></span>',
        '  <span class="tyfit-page-loader__row tyfit-page-loader__row--short"></span>',
        '  <div class="tyfit-page-loader__grid">',
        '    <span></span><span></span><span></span>',
        '  </div>',
        '</div>'
    ].join("");
    document.body.appendChild(loader);
    requestAnimationFrame(() => loader.classList.add("is-visible"));
    mountHomeLoader._ts = Date.now();
}

function unmountHomeLoader() {
    const loader = byId("tyfitPageLoader");
    if (!loader) return;
    const elapsed = Date.now() - (mountHomeLoader._ts || Date.now());
    const delay = Math.max(0, 260 - elapsed);
    setTimeout(() => {
        loader.classList.remove("is-visible");
        loader.classList.add("is-leaving");
        setTimeout(() => loader.remove(), 220);
    }, delay);
}

function unmountHomeLoaderWhenReady() {
    let isDone = false;
    const finish = () => {
        if (isDone) return;
        isDone = true;
        refreshIcons();
        unmountHomeLoader();
    };

    if (document.readyState !== "loading") {
        finish();
        return;
    }

    document.addEventListener("DOMContentLoaded", finish, { once: true });
    window.addEventListener("load", finish, { once: true });
    setTimeout(finish, 1200);
}

if (document.body) {
    mountHomeLoader();
} else {
    document.addEventListener("readystatechange", () => {
        if (document.readyState !== "loading") mountHomeLoader();
    }, { once: true });
}

let quickAccessExpanded = false;
let isHomeUserLoggedIn = false;

function showToast(message) {
    const toast = byId("appToast");
    if (!toast) {
        return;
    }
    toast.textContent = message;
    toast.classList.add("is-show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.classList.remove("is-show");
    }, 2200);
}

function setHeroTitle(el, value) {
    if (!el) return;
    const raw = String(value || "").trim();
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || "Small habits.";
    const secondLine = lines[1] || "Big transformation.";

    el.textContent = "";
    el.append(document.createTextNode(firstLine));
    el.append(document.createElement("br"));
    const accent = document.createElement("span");
    accent.textContent = secondLine;
    el.append(accent);
}

function setHeroSubtitle(el, value) {
    if (!el) return;
    const raw = String(value || "").trim();
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || "Stay consistent today,";
    const secondLine = lines[1] || "thank yourself tomorrow.";

    el.textContent = "";
    el.append(document.createTextNode(firstLine));
    el.append(document.createElement("br"));
    el.append(document.createTextNode(secondLine));
}

function renderHome(data) {
    const greeting = byId("homeGreeting");
    const subtitle = byId("homeSubtitle");
    const heroTitle = byId("heroTitle");
    const heroText = byId("heroText");

    if (greeting) greeting.textContent = `Hello${data.name ? `, ${data.name}` : ""} 👋`;
    if (subtitle) subtitle.textContent = "Let’s build consistency today";
    setHeroTitle(heroTitle, data.motivationTitle);
    setHeroSubtitle(heroText, data.motivationText);

    const desktopName = byId("desktopProfileName");
    const desktopAvatar = byId("desktopProfileAvatar");
    if (desktopName) desktopName.textContent = data.fullName || data.name || "Account";
    if (desktopAvatar) desktopAvatar.src = data.profileImage || "assets/avatars/avatar-1.svg";

    const grid = byId("homeToolsGrid");
    if (grid) {
        const today = new Date().toISOString().slice(0, 10);
        grid.innerHTML = data.tools.map((tool) => {
            const isComingSoon = Boolean(tool.comingSoon);
            const href = isComingSoon ? "#" : (tool.appendToday ? `${tool.href}?date=${today}` : tool.href);
            const dataAttrs = isComingSoon
                ? ' data-coming-soon="true"'
                : (tool.calculator ? ` data-calculator="${tool.calculator}" data-calculator-title="${tool.title}"` : (href === "#" ? ` data-calculator="${tool.title}"` : ""));
            const cardClass = isComingSoon ? "tyfit-tool-card tyfit-tool-card--coming-soon" : "tyfit-tool-card";
            const badge = (isComingSoon && !tool.hideComingSoonBadge) ? '<span class="tyfit-coming-soon-label">Coming Soon</span>' : "";
            return `
                <a class="${cardClass}" href="${href}" data-title="${tool.title}"${dataAttrs}>
                    ${badge}
                    <span class="tyfit-tool-icon ${tool.colorClass}">
                        <i data-lucide="${tool.icon}"></i>
                    </span>
                    <h5 class="tool-card-title">${tool.title}</h5>
                </a>
            `;
        }).join("");

        const quickAccessToggle = byId("quickAccessToggle");
        if (quickAccessToggle) {
            quickAccessToggle.style.display = "none";
        }

        refreshIcons();
    }
}

function renderJourneyOnboarding() {
    const hero = byId("homeJourneyHero");
    if (!hero) return;
    hero.className = "tyfit-hero-card tyfit-journey-home-card is-onboarding";
    hero.innerHTML = `
        <div class="tyfit-journey-home-copy">
            <span class="tyfit-hero-badge"><i data-lucide="sparkles"></i>Today's Focus</span>
            <h4 class="tyfit-journey-home-title">Small Habits<span>Big Transformation.</span></h4>
            <div class="tyfit-hero-chips" aria-label="Today's focus goals">
                <span class="tyfit-hero-chip"><img src="assets/tyfit_img/custom_icons/nutrition-leaf.svg" alt="" aria-hidden="true">Nutrition</span>
                <span class="tyfit-hero-chip"><img src="assets/tyfit_img/custom_icons/training-dumbbell.svg" alt="" aria-hidden="true">Training</span>
                <span class="tyfit-hero-chip"><img src="assets/tyfit_img/custom_icons/recovery-moon.svg" alt="" aria-hidden="true">Recovery</span>
            </div>
            <div class="tyfit-journey-home-actions">
                <a class="tyfit-hero-cta" href="daily_checkin.html">Log My Day <i data-lucide="arrow-right" aria-hidden="true"></i></a>
            </div>
        </div>
    `;
    refreshIcons();
}

function renderJourneyStatus({ journey, todayCheckin, todayEvent }) {
    const hero = byId("homeJourneyHero");
    if (!hero || !window.tyfitJourney) return;

    const progress = window.tyfitJourney.progressForXp(journey?.total_xp || 0);
    const checkedToday = Boolean(todayCheckin?.id);
    const streak = Number(journey?.current_streak) || 0;
    const currentStage = progress.current;
    const nextLabel = progress.next ? `${progress.remainingXp} XP to ${progress.next.name}` : "Summit reached";
    const editHref = `daily_checkin.html?date=${window.tyfitJourney.todayISO()}`;

    hero.className = `tyfit-hero-card tyfit-journey-home-card ${checkedToday ? "is-complete" : "is-pending"}`;
    hero.innerHTML = `
        <div class="tyfit-journey-home-copy">
            <span class="tyfit-hero-badge">
                <i data-lucide="${checkedToday ? "check-circle-2" : "mountain"}"></i>
                ${checkedToday ? "Check-in complete" : "Conquer Everest"}
            </span>
            <h4 class="tyfit-journey-home-title">${streak || 1} Day Streak</h4>
            <p class="tyfit-journey-home-text">${checkedToday ? "Great job showing up today." : "Keep it going! You're doing great."}</p>

            <div class="tyfit-journey-status-box">
                <strong>${checkedToday ? "Checked in today" : "Not checked in today"}</strong>
                <span>${checkedToday ? `${Number(todayEvent?.xp_awarded || 0) ? `+${todayEvent.xp_awarded} XP earned today.` : "Today is counted."}` : "Complete your check-in to keep your streak alive."}</span>
            </div>

            <div class="tyfit-journey-home-actions">
                <a class="tyfit-hero-cta" href="${checkedToday ? "journey.html" : "daily_checkin.html"}">${checkedToday ? "View Journey" : "Complete Check-in"}</a>
                ${checkedToday ? `<a class="tyfit-journey-secondary-link" href="${editHref}">Edit Today's Check-in</a>` : ""}
            </div>
        </div>

        <div class="tyfit-journey-home-progress">
            <img src="${escapeHtml(currentStage.asset)}" alt="" class="tyfit-journey-stage-img" aria-hidden="true">
            <div class="tyfit-journey-stage-row">
                <div>
                    <span>Stage ${currentStage.stage}</span>
                    <strong>${escapeHtml(currentStage.name)}</strong>
                </div>
                <em>${escapeHtml(journey?.current_title || currentStage.title)}</em>
            </div>
            <div class="tyfit-journey-progress-track" aria-label="Journey progress">
                <span style="width:${progress.percent}%"></span>
            </div>
            <div class="tyfit-journey-meta-grid">
                <span><strong>${Number(journey?.total_xp) || 0}</strong>Total XP</span>
                <span><strong>${Number(journey?.longest_streak) || 0}</strong>Longest</span>
                <span><strong>${escapeHtml(nextLabel)}</strong>Next</span>
            </div>
        </div>
    `;
    refreshIcons();
}

async function renderJourneyHero(userId) {
    if (!userId || !window.tyfitJourney) {
        renderJourneyOnboarding();
        return;
    }

    try {
        const today = window.tyfitJourney.todayISO();
        const [journey, todayCheckin, todayEvent] = await Promise.all([
            window.tyfitJourney.fetchJourney(userId),
            window.tyfitJourney.hasCheckedIn(userId, today),
            window.tyfitJourney.fetchJourneyEvent(userId, today)
        ]);

        if (!journey && !todayCheckin) {
            renderJourneyOnboarding();
            return;
        }

        renderJourneyStatus({
            journey: journey || {
                total_xp: 0,
                current_streak: 0,
                longest_streak: 0,
                current_title: "Starter"
            },
            todayCheckin,
            todayEvent
        });
    } catch (error) {
        console.warn("renderJourneyHero warning:", error?.message || error);
        renderJourneyOnboarding();
    }
}

function applySidebarTooltipData() {
    document.querySelectorAll(".tyfit-sidebar .sidebar-nav-item").forEach((item) => {
        const label = item.querySelector("span")?.textContent?.trim();
        if (!label) return;
        item.setAttribute("data-tooltip", label);
        item.setAttribute("data-tool-tip", label);
        item.setAttribute("title", label);
        item.setAttribute("aria-label", label);
    });
}

const homeCalculatorState = {
    active: "bmr",
    resultView: "",
    returnTo: "",
    macroDiet: "balanced",
    macroValues: {
        calories: "2300",
        protein: "30",
        carbs: "40",
        fats: "30"
    },
    goalValues: {
        currentWeight: "61",
        targetWeight: "55",
        weeks: "12",
        tdee: "2346",
        gender: "male"
    }
};

function calculatorTitle(type) {
    if (type === "macro") return "Macro Calculator";
    if (type === "goal") return "Goal Calculator";
    return "BMR Calculator";
}

function setCalculatorError(field, message) {
    const row = document.querySelector(`#calculatorModal [data-field="${field}"]`);
    if (!row) return;
    const error = row.querySelector(".calc-error");
    row.classList.toggle("is-invalid", Boolean(message));
    if (error) error.textContent = message || "";
}

function clearCalculatorErrors(fields) {
    fields.forEach((field) => setCalculatorError(field, ""));
}

function openCalculatorModal(type, options = {}) {
    const modal = byId("calculatorModal");
    const title = byId("calculatorModalTitle");
    const backBtn = byId("calculatorBackBtn");
    if (!modal || !window.TyfitCalculators) return;
    homeCalculatorState.active = type || "bmr";
    homeCalculatorState.resultView = "";
    homeCalculatorState.returnTo = options.returnTo || "";
    if (title) title.textContent = calculatorTitle(homeCalculatorState.active);
    if (backBtn) {
        backBtn.hidden = !window.matchMedia("(max-width: 767px)").matches;
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tyfit-calc-modal-open");
    renderCalculatorModal();
}

function closeCalculatorModal() {
    const modal = byId("calculatorModal");
    const backBtn = byId("calculatorBackBtn");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tyfit-calc-modal-open");
    if (backBtn) backBtn.hidden = true;
    homeCalculatorState.resultView = "";
    homeCalculatorState.returnTo = "";
}

function calculatorField({ field, icon, label, hint, control }) {
    return `
        <label class="calc-field-row" data-field="${field}">
            <span class="calc-icon-tile"><i data-lucide="${icon}"></i></span>
            <span class="calc-field-label"><strong>${label}</strong></span>
            ${control}
            <small class="calc-error"></small>
        </label>
    `;
}

function bmrMarkup() {
    return `
        <form id="homeBmrForm" novalidate>
            <section class="calc-card calc-input-card">
                ${calculatorField({ field: "activity", icon: "activity", label: "Activity Level", hint: "Training frequency", control: '<select name="activity"><option value="1.2">Sedentary</option><option value="1.375">Light Exercise</option><option value="1.55" selected>Moderate Exercise</option><option value="1.725">Heavy Exercise</option><option value="1.9">Athlete / Very Active</option></select>' })}
                ${calculatorField({ field: "gender", icon: "user", label: "Gender", hint: "Formula adjustment", control: '<select name="gender"><option value="male" selected>Male</option><option value="female">Female</option></select>' })}
                ${calculatorField({ field: "age", icon: "calendar-days", label: "Age", hint: "10–100 years", control: '<span class="calc-control"><input name="age" type="number" inputmode="numeric" min="10" max="100" value="34"><em class="calc-control-unit">years</em></span>' })}
                ${calculatorField({ field: "weight", icon: "scale", label: "Weight", hint: "Kilograms", control: '<span class="calc-control"><input name="weight" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="61"><em class="calc-control-unit">kg</em></span>' })}
                ${calculatorField({ field: "height", icon: "ruler", label: "Height", hint: "Centimeters", control: '<span class="calc-control"><input name="height" type="number" inputmode="decimal" min="90" max="250" step="0.1" value="167"><em class="calc-control-unit">cm</em></span>' })}
                ${calculatorField({ field: "bodyFat", icon: "percent", label: "Body Fat Percentage", hint: "Optional", control: '<input name="bodyFat" type="number" inputmode="decimal" min="3" max="70" step="0.1" placeholder="Optional">' })}
            </section>
        </form>
        <div class="tyfit-calc-modal-actions"><button class="calc-primary-btn" type="button" id="homeCalculateBmrBtn">Calculate <i data-lucide="arrow-right"></i></button></div>
    `;
}

function bmrValues() {
    const data = new FormData(byId("homeBmrForm"));
    const bodyFatRaw = String(data.get("bodyFat") || "").trim();
    return {
        activityMultiplier: Number(data.get("activity")),
        gender: String(data.get("gender") || "male"),
        age: Number(data.get("age")),
        weightKg: Number(data.get("weight")),
        heightCm: Number(data.get("height")),
        bodyFatPercent: bodyFatRaw === "" ? "" : Number(bodyFatRaw)
    };
}

function validateBmrInput(input) {
    let valid = true;
    clearCalculatorErrors(["age", "weight", "height", "bodyFat"]);
    const calc = window.TyfitCalculators;
    if (!calc.inRange(input.age, 10, 100)) {
        setCalculatorError("age", "Age must be between 10 and 100.");
        valid = false;
    }
    if (!calc.inRange(input.weightKg, 25, 300)) {
        setCalculatorError("weight", "Weight must be between 25 and 300 kg.");
        valid = false;
    }
    if (!calc.inRange(input.heightCm, 90, 250)) {
        setCalculatorError("height", "Height must be between 90 and 250 cm.");
        valid = false;
    }
    if (input.bodyFatPercent !== "" && !calc.inRange(input.bodyFatPercent, 3, 70)) {
        setCalculatorError("bodyFat", "Body fat must be between 3% and 70%.");
        valid = false;
    }
    return valid;
}

function calculateHomeBmr() {
    const calc = window.TyfitCalculators;
    const input = bmrValues();
    if (!validateBmrInput(input)) return;
    const bmr = calc.calculateBmr(input);
    const tdee = calc.calculateTdee(bmr, input.activityMultiplier);

    if (homeCalculatorState.returnTo === "macro") {
        homeCalculatorState.macroValues.calories = String(tdee);
        homeCalculatorState.returnTo = "";
        openCalculatorModal("macro");
        showToast("TDEE imported from BMR");
        return;
    }
    if (homeCalculatorState.returnTo === "goal") {
        homeCalculatorState.goalValues.tdee = String(tdee);
        homeCalculatorState.returnTo = "";
        openCalculatorModal("goal");
        showToast("TDEE imported from BMR");
        return;
    }

    homeCalculatorState.resultView = "bmr";
    byId("calculatorModalBody").innerHTML = `
        <div class="calc-result-hero"><img src="assets/calculator/tyfit-bmr-calculator-icon-transparent.svg" alt="BMR result icon"></div>
        <div class="calc-result-grid calc-result-grid--single">
            <article class="calc-result-card"><span>Basal Metabolic Rate (BMR)</span><strong>${bmr}</strong><span class="calc-result-unit">Calories per day</span></article>
            <article class="calc-result-card"><span>Total Daily Energy Expenditure</span><strong>${tdee}</strong><span class="calc-result-unit">Calories per day</span></article>
        </div>
        <div class="calc-action-grid">
            <button class="calc-primary-btn calc-ok-btn" type="button" id="homeBmrResultOkBtn">Okay</button>
        </div>
    `;
    byId("calculatorModalTitle").textContent = "BMR Result";
    const closeBtn = byId("calculatorModalClose");
    const backBtn = byId("calculatorBackBtn");
    if (closeBtn) closeBtn.hidden = true;
    if (backBtn) backBtn.hidden = false;
    byId("homeBmrResultOkBtn")?.addEventListener("click", () => openCalculatorModal("bmr"));
    window.TyfitCalculators.refreshIcons();
}

function macroMarkup() {
    return `
        <section class="calc-card macro-ring-card">
            <div class="macro-ring" id="homeMacroRing"><div class="macro-ring-center"><div><strong id="homeMacroCaloriesValue">${homeCalculatorState.macroValues.calories}</strong><span>kcal<br>Total Calories</span></div></div></div>
        </section>
        <form id="homeMacroForm" novalidate>
            <section class="calc-card" style="padding:16px;">
                <div class="macro-input-row" data-field="calories">
                    <label for="homeMacroCalories">Calories</label>
                    <input id="homeMacroCalories" name="calories" type="number" inputmode="numeric" min="800" max="6000" value="${homeCalculatorState.macroValues.calories}">
                    <small class="calc-error"></small>
                    <button class="calc-inline-link" type="button" id="homeUnknownCaloriesBtn">Don’t know your total calories?</button>
                </div>
                <div class="diet-grid" id="homeDietGrid"></div>
                <div class="custom-ratio-grid" id="homeCustomRatioGrid" hidden>
                    <label>Protein %<input name="protein" type="number" inputmode="numeric" value="${homeCalculatorState.macroValues.protein}"></label>
                    <label>Carbs %<input name="carbs" type="number" inputmode="numeric" value="${homeCalculatorState.macroValues.carbs}"></label>
                    <label>Fats %<input name="fats" type="number" inputmode="numeric" value="${homeCalculatorState.macroValues.fats}"></label>
                </div>
            </section>
        </form>
        <section class="macro-card-grid" id="homeMacroCards"></section>
        <div class="tyfit-calc-modal-actions"><button class="calc-primary-btn" type="button" id="homeApplyMacrosBtn">Apply &amp; See Results</button></div>
    `;
}

function macroRatio() {
    const calc = window.TyfitCalculators;
    if (homeCalculatorState.macroDiet !== "custom") return calc.DIET_TYPES[homeCalculatorState.macroDiet];
    const data = new FormData(byId("homeMacroForm"));
    return {
        label: "Custom",
        protein: Number(data.get("protein")),
        carbs: Number(data.get("carbs")),
        fats: Number(data.get("fats"))
    };
}

function macroCard(label, grams, percent, kcal, color) {
    return `<article class="macro-card"><div class="macro-card-head"><span>${label}</span><strong>${grams}g</strong></div><span>${percent}% · ${kcal} kcal</span><div class="macro-progress"><i style="width:${percent}%;background:${color};"></i></div></article>`;
}

function renderHomeDietOptions() {
    const calc = window.TyfitCalculators;
    byId("homeDietGrid").innerHTML = Object.entries(calc.DIET_TYPES).map(([key, item]) => `
        <button class="diet-option ${key === homeCalculatorState.macroDiet ? "is-active" : ""}" type="button" data-diet="${key}">
            <strong>${item.label}</strong>
            <span>${item.protein}:${item.carbs}:${item.fats} Protein:Carbs:Fats</span>
        </button>
    `).join("");
    byId("homeCustomRatioGrid").hidden = homeCalculatorState.macroDiet !== "custom";
}

function updateMacroState() {
    const form = byId("homeMacroForm");
    if (!form) return;
    const data = new FormData(form);
    homeCalculatorState.macroValues.calories = String(data.get("calories") || "");
    homeCalculatorState.macroValues.protein = String(data.get("protein") || "30");
    homeCalculatorState.macroValues.carbs = String(data.get("carbs") || "40");
    homeCalculatorState.macroValues.fats = String(data.get("fats") || "30");
}

function renderHomeMacros() {
    updateMacroState();
    const calc = window.TyfitCalculators;
    const total = Number(homeCalculatorState.macroValues.calories);
    const ratio = macroRatio();
    const macro = calc.calculateMacros(calc.inRange(total, 800, 6000) ? total : 0, ratio);
    const p = macro.ratio.protein;
    const c = macro.ratio.carbs;
    const f = macro.ratio.fats;
    byId("homeMacroCaloriesValue").textContent = calc.inRange(total, 800, 6000) ? String(Math.round(total)) : "0";
    byId("homeMacroRing").style.background = calc.inRange(total, 800, 6000)
        ? `conic-gradient(#F85F7A 0 ${p}%, #22C55E ${p}% ${p + c}%, #F59E0B ${p + c}% ${p + c + f}%, #E9EAF2 ${p + c + f}% 100%)`
        : "conic-gradient(#E9EAF2 0 100%)";
    byId("homeMacroCards").innerHTML = [
        macroCard("Protein", macro.proteinGrams, p, macro.proteinCalories, "#F85F7A"),
        macroCard("Carbs", macro.carbGrams, c, macro.carbCalories, "#22C55E"),
        macroCard("Fats", macro.fatGrams, f, macro.fatCalories, "#F59E0B")
    ].join("");
}

function validateHomeMacros() {
    const calc = window.TyfitCalculators;
    const row = document.querySelector("#calculatorModal [data-field='calories']");
    const error = row?.querySelector(".calc-error");
    row?.classList.remove("is-invalid");
    if (error) error.textContent = "";
    const total = Number(homeCalculatorState.macroValues.calories);
    const ratio = macroRatio();
    if (!calc.inRange(total, 800, 6000)) {
        row?.classList.add("is-invalid");
        if (error) error.textContent = "Calories must be between 800 and 6000.";
        return false;
    }
    if (homeCalculatorState.macroDiet === "custom" && Math.round(ratio.protein + ratio.carbs + ratio.fats) !== 100) {
        row?.classList.add("is-invalid");
        if (error) error.textContent = "Custom protein, carbs, and fats must total 100%.";
        return false;
    }
    return true;
}

function goalMarkup() {
    return `
        <form id="homeGoalForm" novalidate>
            <section class="calc-card calc-input-card">
                ${calculatorField({ field: "currentWeight", icon: "scale", label: "Current Body Weight", hint: "Kilograms", control: `<input name="currentWeight" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="${homeCalculatorState.goalValues.currentWeight}">` })}
                ${calculatorField({ field: "targetWeight", icon: "target", label: "Target Body Weight", hint: "Kilograms", control: `<input name="targetWeight" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="${homeCalculatorState.goalValues.targetWeight}">` })}
                ${calculatorField({ field: "weeks", icon: "calendar-range", label: "Time to Reach Goal", hint: "Weeks", control: `<input name="weeks" type="number" inputmode="numeric" min="1" max="104" value="${homeCalculatorState.goalValues.weeks}">` })}
                ${calculatorField({ field: "tdee", icon: "flame", label: "TDEE", hint: "kcal/day", control: `<input name="tdee" type="number" inputmode="numeric" min="800" max="6000" value="${homeCalculatorState.goalValues.tdee}">` })}
                ${calculatorField({ field: "gender", icon: "user", label: "Gender", hint: "Low-calorie warning", control: `<select name="gender"><option value="male" ${homeCalculatorState.goalValues.gender === "male" ? "selected" : ""}>Male</option><option value="female" ${homeCalculatorState.goalValues.gender === "female" ? "selected" : ""}>Female</option></select>` })}
            </section>
        </form>
        <section class="calc-helper-card"><p>Don’t know your TDEE?</p><button type="button" class="calc-link-btn" id="homeUnknownTdeeBtn">Calculate BMR</button></section>
        <div class="tyfit-calc-modal-actions"><button class="calc-primary-btn" type="button" id="homeCalculateGoalBtn">Calculate My Goal <i data-lucide="arrow-right"></i></button></div>
    `;
}

function goalValues() {
    const data = new FormData(byId("homeGoalForm"));
    return {
        currentWeight: Number(data.get("currentWeight")),
        targetWeight: Number(data.get("targetWeight")),
        weeks: Number(data.get("weeks")),
        tdee: Number(data.get("tdee")),
        gender: String(data.get("gender") || "male")
    };
}

function updateGoalState() {
    const values = goalValues();
    Object.assign(homeCalculatorState.goalValues, {
        currentWeight: String(values.currentWeight || ""),
        targetWeight: String(values.targetWeight || ""),
        weeks: String(values.weeks || ""),
        tdee: String(values.tdee || ""),
        gender: values.gender
    });
}

function validateHomeGoal(values) {
    const calc = window.TyfitCalculators;
    let valid = true;
    clearCalculatorErrors(["currentWeight", "targetWeight", "weeks", "tdee"]);
    if (!calc.inRange(values.currentWeight, 25, 300)) {
        setCalculatorError("currentWeight", "Current weight must be between 25 and 300 kg.");
        valid = false;
    }
    if (!calc.inRange(values.targetWeight, 25, 300)) {
        setCalculatorError("targetWeight", "Target weight must be between 25 and 300 kg.");
        valid = false;
    }
    if (values.targetWeight === values.currentWeight) {
        setCalculatorError("targetWeight", "Target weight should be different.");
        valid = false;
    }
    if (!calc.inRange(values.weeks, 1, 104)) {
        setCalculatorError("weeks", "Timeline must be between 1 and 104 weeks.");
        valid = false;
    }
    if (!calc.inRange(values.tdee, 800, 6000)) {
        setCalculatorError("tdee", "TDEE must be between 800 and 6000 kcal.");
        valid = false;
    }
    return valid;
}

function renderGoalResult() {
    updateGoalState();
    const calc = window.TyfitCalculators;
    const input = goalValues();
    if (!validateHomeGoal(input)) return;
    const result = calc.calculateGoal(input);
    byId("calculatorModalTitle").textContent = "Goal Result";
    byId("calculatorModalBody").innerHTML = `
        <div class="calc-result-card" style="background:linear-gradient(135deg,#6C63FF,#8B7CFF);color:#fff;border:0;">
            <span style="color:rgba(255,255,255,.78);">Your Target Calories</span>
            <strong style="color:#fff;font-size:38px;">${result.targetCalories}</strong>
            <span style="color:rgba(255,255,255,.78);">kcal per day</span>
        </div>
        <p class="goal-pill">${result.dailyChange} kcal ${result.type}</p>
        <section class="safety-meter"><div class="safety-track"><i class="safety-pointer" style="left:${Math.min(100, (result.dailyChange / 1000) * 100)}%;"></i></div><div class="safety-labels"><span>0</span><span>250</span><span>500</span><span>750</span><span>1000</span></div></section>
        <article class="calc-helper-card" style="align-items:flex-start;display:grid;"><p>${result.status}</p><span style="color:#667085;font-size:13px;line-height:1.45;">${result.message}</span></article>
        <section class="goal-timeline"><span><strong>${input.currentWeight}kg</strong>Now</span><span><strong>${result.halfwayWeight}kg</strong>Week ${Math.round(input.weeks / 2)}</span><span><strong>${input.targetWeight}kg</strong>Week ${input.weeks} · Goal</span></section>
        ${result.dailyChange > 1000 ? '<div class="calc-warning">This is too aggressive. Consider increasing your timeline.</div>' : ""}
        ${result.veryLow ? '<div class="calc-warning">Calories are very low. Consider a longer timeline or consult a professional.</div>' : ""}
        <div class="calc-action-grid"><a class="calc-primary-btn" href="portal/diet_chart.html">View My Plan</a><button class="calc-secondary-btn" type="button" data-open-calculator="goal">Recalculate</button></div>
    `;
}

function renderCalculatorModal() {
    const body = byId("calculatorModalBody");
    const title = byId("calculatorModalTitle");
    const backBtn = byId("calculatorBackBtn");
    const closeBtn = byId("calculatorModalClose");
    if (!body || !title || !window.TyfitCalculators) return;
    homeCalculatorState.resultView = "";
    title.textContent = calculatorTitle(homeCalculatorState.active);
    body.innerHTML = homeCalculatorState.active === "macro" ? macroMarkup() : homeCalculatorState.active === "goal" ? goalMarkup() : bmrMarkup();
    bindCalculatorModal();
    window.TyfitCalculators.refreshIcons();
    if (closeBtn) closeBtn.hidden = false;
    if (backBtn) {
        backBtn.hidden = !window.matchMedia("(max-width: 767px)").matches;
    }
}

function bindCalculatorModal() {
    if (homeCalculatorState.active === "bmr") {
        byId("homeCalculateBmrBtn")?.addEventListener("click", calculateHomeBmr);
        return;
    }
    if (homeCalculatorState.active === "macro") {
        renderHomeDietOptions();
        renderHomeMacros();
        byId("homeMacroForm")?.addEventListener("input", renderHomeMacros);
        byId("homeMacroForm")?.addEventListener("change", renderHomeMacros);
        byId("homeDietGrid")?.addEventListener("click", (event) => {
            const option = event.target.closest("[data-diet]");
            if (!option) return;
            homeCalculatorState.macroDiet = option.dataset.diet;
            renderHomeDietOptions();
            renderHomeMacros();
        });
        byId("homeUnknownCaloriesBtn")?.addEventListener("click", () => {
            updateMacroState();
            openCalculatorModal("bmr", { returnTo: "macro" });
        });
        byId("homeApplyMacrosBtn")?.addEventListener("click", () => {
            updateMacroState();
            if (!validateHomeMacros()) return;
            showToast("Macros calculated.");
        });
        return;
    }
    byId("homeGoalForm")?.addEventListener("input", updateGoalState);
    byId("homeGoalForm")?.addEventListener("change", updateGoalState);
    byId("homeUnknownTdeeBtn")?.addEventListener("click", () => {
        updateGoalState();
        openCalculatorModal("bmr", { returnTo: "goal" });
    });
    byId("homeCalculateGoalBtn")?.addEventListener("click", renderGoalResult);
}

function applyGuestHomeIntro(isLoggedIn) {
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;

    const greeting = byId("homeGreeting");
    const subtitle = byId("homeSubtitle");
    if (!greeting || !subtitle) return;

    if (isLoggedIn) {
        if (subtitle.querySelector("#homeSubtitleLoginLink")) {
            subtitle.textContent = "Let’s build consistency today";
        }
        return;
    }

    greeting.textContent = "Guest";
    subtitle.innerHTML = '<a href="#" id="homeSubtitleLoginLink" class="tyfit-home-login-link">Log in</a>. Stay consistent.';
}

function syncDesktopAccountButton(isLoggedIn) {
    isHomeUserLoggedIn = Boolean(isLoggedIn);
    const desktopAccountBtn = byId("desktopAccountBtn");
    const desktopAccountMenu = byId("desktopAccountMenu");
    const desktopNotifBtn = byId("desktopNotifBtn");
    const mobileNotifBtn = byId("mobileNotifBtn");
    const avatar = byId("desktopProfileAvatar");
    const nameEl = byId("desktopProfileName");

    if (desktopNotifBtn) desktopNotifBtn.style.display = isHomeUserLoggedIn ? "" : "none";
    if (mobileNotifBtn) mobileNotifBtn.style.display = isHomeUserLoggedIn ? "" : "none";

    if (!desktopAccountBtn) return;

    if (!isHomeUserLoggedIn) {
        desktopAccountBtn.classList.add("tyfit-account-btn--guest");
        desktopAccountBtn.setAttribute("aria-label", "Login");
        if (avatar) avatar.style.display = "none";
        const chevron = desktopAccountBtn.querySelector("[data-lucide='chevron-down'], svg");
        if (chevron) chevron.style.display = "none";
        if (nameEl) nameEl.textContent = "Login";
        if (desktopAccountMenu) {
            desktopAccountMenu.classList.remove("is-open");
            desktopAccountMenu.setAttribute("aria-hidden", "true");
            desktopAccountMenu.style.display = "none";
        }
        applyGuestHomeIntro(false);
        return;
    }

    desktopAccountBtn.classList.remove("tyfit-account-btn--guest");
    desktopAccountBtn.setAttribute("aria-label", "Account menu");
    if (avatar) avatar.style.display = "";
    const chevron = desktopAccountBtn.querySelector("[data-lucide='chevron-down'], svg");
    if (chevron) chevron.style.display = "";
    if (desktopAccountMenu) desktopAccountMenu.style.display = "";
    applyGuestHomeIntro(true);
}

async function refreshHomeAuthState() {
    try {
        if (typeof window.getAccessState === "function") {
            const accessState = await window.getAccessState();
            syncDesktopAccountButton(Boolean(accessState?.isLoggedIn));
            return;
        }
    } catch (error) {
        console.warn("Auth state refresh warning:", error?.message || error);
    }
    syncDesktopAccountButton(false);
}

async function performLogout() {
    try {
        if (window.supabaseClient?.auth) {
            await window.supabaseClient.auth.signOut();
        }
    } catch (error) {
        console.warn("Logout warning:", error?.message || error);
    }
    window.location.href = "login.html";
}

function bindShellInteractions() {
    const layout = byId("tyfitLayout");
    const sidebarCollapseBtn = byId("sidebarCollapseBtn");
    const mobileMenuBtn = byId("mobileMenuBtn");
    const mobileDrawer = byId("mobileDrawer");
    const mobileDrawerClose = byId("mobileDrawerClose");
    const mobileDrawerBackdrop = byId("mobileDrawerBackdrop");
    const mobileNotifBtn = byId("mobileNotifBtn");
    const mobileNotifMenu = byId("mobileNotifMenu");
    const desktopNotifBtn = byId("desktopNotifBtn");
    const desktopNotifMenu = byId("desktopNotifMenu");
    const desktopAccountBtn = byId("desktopAccountBtn");
    const desktopAccountMenu = byId("desktopAccountMenu");
    const desktopAccountWrap = desktopAccountBtn?.closest(".tyfit-dropdown-wrap");
    const desktopNotifDot = byId("desktopNotifDot");
    const mobileNotifDot = byId("mobileNotifDot");
    const quickAddBtn = byId("quickAddBtn");
    const quickAccessToggle = byId("quickAccessToggle");
    const sheet = byId("quickSheet");
    const sheetBackdrop = byId("quickSheetBackdrop");
    const sheetClose = byId("quickSheetClose");

    function toggleSidebar() {
        if (layout) layout.classList.toggle("sidebar-collapsed");
        document.body.classList.toggle("sidebar-collapsed");
    }

    function openMobileDrawer() {
        if (!mobileDrawer || !mobileDrawerBackdrop) return;
        mobileDrawer.classList.add("is-open");
        mobileDrawer.setAttribute("aria-hidden", "false");
        mobileDrawerBackdrop.hidden = false;
    }

    function closeMobileDrawer() {
        if (!mobileDrawer || !mobileDrawerBackdrop) return;
        mobileDrawer.classList.remove("is-open");
        mobileDrawer.setAttribute("aria-hidden", "true");
        mobileDrawerBackdrop.hidden = true;
    }

    function toggleMenu(menuEl) {
        if (!menuEl) return;
        const openMenus = document.querySelectorAll(".tyfit-popover-menu.is-open");
        openMenus.forEach((menu) => {
            if (menu !== menuEl) {
                menu.classList.remove("is-open");
                menu.setAttribute("aria-hidden", "true");
            }
        });
        const shouldOpen = !menuEl.classList.contains("is-open");
        menuEl.classList.toggle("is-open", shouldOpen);
        menuEl.setAttribute("aria-hidden", String(!shouldOpen));
    }

    function openSheet() {
        if (!sheet || !sheetBackdrop) return;
        sheet.classList.add("is-open");
        sheet.setAttribute("aria-hidden", "false");
        sheetBackdrop.hidden = false;
    }

    function closeSheet() {
        if (!sheet || !sheetBackdrop) return;
        sheet.classList.remove("is-open");
        sheet.setAttribute("aria-hidden", "true");
        sheetBackdrop.hidden = true;
    }

    document.querySelectorAll('[data-calculator="macro"], [data-calculator="goal"]').forEach((item) => {
        item.classList.add("is-disabled-calc");
        item.setAttribute("aria-disabled", "true");
    });

    document.addEventListener("click", (event) => {
        const subtitleLogin = event.target.closest("#homeSubtitleLoginLink");
        if (subtitleLogin) {
            event.preventDefault();
            if (typeof window.openAuthModal === "function") {
                window.openAuthModal({ locked: false });
            }
            return;
        }

        const comingSoonTrigger = event.target.closest("[data-coming-soon]");
        if (comingSoonTrigger) {
            event.preventDefault();
            showToast("Coming Soon");
            return;
        }

        const calcTrigger = event.target.closest("[data-calculator]");
        if (calcTrigger) {
            event.preventDefault();
            const calcType = String(calcTrigger.dataset.calculator || "").toLowerCase();
            if (disabledCalculators.has(calcType)) {
                showToast("Coming Soon");
                return;
            }
            openCalculatorModal(calcTrigger.dataset.calculator || "bmr");
            return;
        }

        const link = event.target.closest("a[href]");
        if (!link || isHomeUserLoggedIn) return;

        if (window.matchMedia("(max-width: 1023px)").matches) {
            return;
        }

        const href = (link.getAttribute("href") || "").trim();
        if (!href || href === "#" || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        if (href === "index.html" || href === "/" || href.endsWith("/index.html")) return;

        event.preventDefault();
        if (typeof window.openAuthModal === "function") {
            window.openAuthModal({ locked: false });
        }
    });

    document.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (!isHomeUserLoggedIn) return;
        if (event.target.closest("[data-calculator], [data-coming-soon], button")) return;
        const link = event.target.closest("a[href]");
        if (!isInternalHomeLink(link)) return;

        event.preventDefault();
        mountHomeLoader();
        requestAnimationFrame(() => {
            setTimeout(() => {
                window.location.href = new URL(link.getAttribute("href"), window.location.href).href;
            }, 70);
        });
    });

    if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener("click", toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileDrawer);
    if (mobileDrawerClose) mobileDrawerClose.addEventListener("click", closeMobileDrawer);
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);
    if (quickAddBtn) quickAddBtn.addEventListener("click", openSheet);
    if (sheetClose) sheetClose.addEventListener("click", closeSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener("click", closeSheet);
    byId("calculatorBackBtn")?.addEventListener("click", () => {
        if (homeCalculatorState.resultView === "bmr") {
            openCalculatorModal("bmr");
            return;
        }
        closeCalculatorModal();
    });
    byId("calculatorModalClose")?.addEventListener("click", closeCalculatorModal);
    byId("calculatorModal")?.addEventListener("click", (event) => {
        if (event.target.matches("[data-calculator-close]")) {
            closeCalculatorModal();
            return;
        }
        const open = event.target.closest("[data-open-calculator]");
        if (open) {
            event.preventDefault();
            openCalculatorModal(open.dataset.openCalculator || "bmr");
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeCalculatorModal();
    });

    if (desktopNotifBtn) desktopNotifBtn.addEventListener("click", () => toggleMenu(desktopNotifMenu));
    if (mobileNotifBtn) mobileNotifBtn.addEventListener("click", () => toggleMenu(mobileNotifMenu));
    if (desktopAccountBtn) {
        desktopAccountBtn.addEventListener("click", (event) => {
            if (!isHomeUserLoggedIn) {
                event.preventDefault();
                if (typeof window.openAuthModal === "function") {
                    window.openAuthModal({ locked: false });
                }
                return;
            }
            toggleMenu(desktopAccountMenu);
        });
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

    const unreadCount = homeData.notifications.filter((item) => !item.read).length;
    if (desktopNotifDot) desktopNotifDot.hidden = unreadCount < 1;
    if (mobileNotifDot) mobileNotifDot.hidden = unreadCount < 1;

    if (desktopNotifMenu) {
        desktopNotifMenu.innerHTML = homeData.notifications.length
            ? homeData.notifications.map((note) => `<a href="#" class="tyfit-popover-item">${note.text}</a>`).join("")
            : '<p class="tyfit-popover-empty">No new notification</p>';
    }
    if (mobileNotifMenu) {
        mobileNotifMenu.innerHTML = homeData.notifications.length
            ? homeData.notifications.map((note) => `<a href="#" class="tyfit-popover-item">${note.text}</a>`).join("")
            : '<p class="tyfit-popover-empty">No new notification</p>';
    }

    document.querySelectorAll(".tyfit-sheet-action").forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = String(btn.dataset.action || "").toLowerCase();
            if (action === "checkin" || action === "meal") {
                closeSheet();
                window.location.href = "daily_checkin.html";
                return;
            }

            if (action === "weight" && typeof window.tyfitOpenWeightModal === "function") {
                closeSheet();
                window.tyfitOpenWeightModal();
                return;
            }

            closeSheet();
        });
    });

    const notifyMeBtn = byId("notifyMeBtn");
    const motivationCard = byId("motivationCard");

    if (notifyMeBtn) notifyMeBtn.addEventListener("click", () => showToast("You will be notified when Daily Summary is live."));
    if (motivationCard) motivationCard.addEventListener("click", () => showToast("New quote unlocked soon."));

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
                await performLogout();
            }
        });
    }

    document.querySelectorAll("[data-action='logout'], .sidebar-logout, #logoutAction, #logoutBtn").forEach((btn) => {
        if (btn.dataset.logoutBound === "true") return;
        btn.dataset.logoutBound = "true";
        btn.addEventListener("click", async (event) => {
            event.preventDefault();
            await performLogout();
        });
    });

    document.addEventListener("click", (event) => {
        const withinDropdown = event.target.closest(".tyfit-dropdown-wrap");
        if (!withinDropdown) {
            document.querySelectorAll(".tyfit-popover-menu.is-open").forEach((menu) => {
                menu.classList.remove("is-open");
                menu.setAttribute("aria-hidden", "true");
            });
        }
    });

}

/* ── Profile Completion Card ────────────────────────────────── */
function isFilled(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
}

function calculateProfileCompletion(profile, userAbout) {
    // Keep completion logic aligned with shared profile-utils to avoid mismatch bugs.
    if (window.tyfitProfile?.calculateProfileCompletion) {
        const result = window.tyfitProfile.calculateProfileCompletion(profile, userAbout);
        const percent = Number(result?.percent);
        if (Number.isFinite(percent)) {
            return Math.max(0, Math.min(100, Math.round(percent)));
        }
    }

    const fields = [
        profile?.first_name,
        profile?.last_name,
        profile?.email,
        profile?.date_of_birth,
        profile?.profile_picture_url,
        profile?.phone_country_code,
        profile?.phone_number,
        profile?.country,
        userAbout?.gender,
        userAbout?.height,
        userAbout?.weight,
        userAbout?.goal,
        userAbout?.activity_level,
    ];
    const filled = fields.filter(isFilled).length;
    return Math.round((filled / fields.length) * 100);
}

async function renderProfileCompletionCard(userId) {
    const card = document.getElementById("profileCompletionCard");
    const ring = document.getElementById("profileCompletionRingProgress");
    const percent = document.getElementById("profileCompletionPercent");
    if (!card || !ring || !percent) return;

    card.onclick = () => { window.location.href = "profile_edit.html"; };

    try {
        const [profile, userAbout] = await Promise.all([
            window.tyfitProfile?.fetchProfile
                ? window.tyfitProfile.fetchProfile(userId)
                : window.supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle().then((r) => r.data || null),
            window.tyfitProfile?.fetchUserAbout
                ? window.tyfitProfile.fetchUserAbout(userId)
                : window.supabaseClient.from("user_about").select("*").eq("user_id", userId).maybeSingle().then((r) => r.data || null)
        ]);

        if (!profile && !userAbout) {
            card.hidden = true;
            card.style.display = "none";
            return;
        }

        const completion = calculateProfileCompletion(profile, userAbout);
        const clamped = Math.max(0, Math.min(100, Number.isFinite(completion) ? completion : 0));

        if (clamped >= 100) {
            percent.textContent = "100%";
            card.hidden = true;
            card.style.display = "none";
            return;
        }

        card.hidden = false;
        card.style.removeProperty("display");
        card.classList.remove("is-danger", "is-warning");
        if (clamped <= 40) card.classList.add("is-danger");
        else if (clamped <= 70) card.classList.add("is-warning");
        const circumference = 2 * Math.PI * 22;
        ring.style.strokeDasharray = `${circumference}`;
        ring.style.strokeDashoffset = `${circumference * (1 - clamped / 100)}`;
        percent.textContent = `${clamped}%`;
        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.warn("renderProfileCompletionCard error:", err?.message || err);
        card.hidden = true;
        card.style.display = "none";
    }
}

async function hydrateNameFromProfile() {
    try {
        if (!window.tyfitProfile?.getCurrentUser) {
            renderHome(homeData);
            renderJourneyHero(null);
            return;
        }

        const user = await window.tyfitProfile.getCurrentUser();
        if (!user?.id) {
            renderHome(homeData);
            renderJourneyHero(null);
            return;
        }

        const [profile, userAbout] = await Promise.all([
            window.tyfitProfile.fetchProfile(user.id),
            window.tyfitProfile.fetchUserAbout(user.id)
        ]);
        const firstName = profile?.first_name || user?.user_metadata?.given_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";
        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.full_name || firstName;
        const profileImage = window.tyfitProfile.resolveProfileImage(profile, userAbout) || homeData.profileImage;
        renderHome({
            ...homeData,
            name: firstName,
            fullName,
            profileImage
        });

        renderProfileCompletionCard(user.id);
        renderJourneyHero(user.id);
    } catch (error) {
        console.warn("hydrateNameFromProfile warning:", error?.message || error);
        renderHome(homeData);
        renderJourneyHero(null);
    }
}

async function renderHeroCheckinRing(userId) {
    const ring = document.getElementById("heroCheckinRingProgress");
    const percentNode = document.getElementById("heroCheckinPercent");
    if (!ring || !percentNode) return;

    const circumference = 2 * Math.PI * 40;
    ring.style.strokeDasharray = `0 ${circumference}`;
    percentNode.textContent = "0%";

    try {
        const today = new Date().toISOString().slice(0, 10);

        // Fetch today's checkin
        const { data: checkin } = await window.supabaseClient
            .from("daily_checkins")
            .select("id")
            .eq("user_id", userId)
            .eq("checkin_date", today)
            .maybeSingle();

        if (!checkin?.id) return; // No checkin logged today — ring stays empty

        // Fetch all goals for denominator (no is_active filter — matches daily_checkin.js)
        const { data: goals } = await window.supabaseClient
            .from("checkin_goals")
            .select("id")
            .eq("user_id", userId);

        const total = goals?.length || 0;
        if (!total) return;

        // Fetch entries — try both FK column names (DB schema may differ)
        const [byCheckinId, byDailyCheckinId] = await Promise.all([
            window.supabaseClient.from("daily_checkin_entries").select("status").eq("checkin_id", checkin.id),
            window.supabaseClient.from("daily_checkin_entries").select("status").eq("daily_checkin_id", checkin.id)
        ]);

        const isMissingCol = (err) => {
            const msg = String(err?.message || "").toLowerCase();
            return (msg.includes("column") && msg.includes("does not exist")) || msg.includes("schema cache");
        };

        const allEntries = [
            ...((byCheckinId.error && isMissingCol(byCheckinId.error)) ? [] : (byCheckinId.data || [])),
            ...((byDailyCheckinId.error && isMissingCol(byDailyCheckinId.error)) ? [] : (byDailyCheckinId.data || []))
        ];

        let done = 0, partial = 0;
        allEntries.forEach(e => {
            if (e.status === "done") done++;
            else if (e.status === "partial") partial++;
        });

        const adherence = Math.round(((done + partial * 0.5) / total) * 100);
        const clamped = Math.max(0, Math.min(100, adherence));
        const progress = circumference * (clamped / 100);

        ring.style.strokeDasharray = `${progress} ${circumference}`;

        // Colour tiers: red 0-40, amber 41-70, purple 71+
        if (clamped <= 40) ring.style.stroke = "#EF4444";
        else if (clamped <= 70) ring.style.stroke = "#B45309";
        else ring.style.stroke = "url(#heroCheckinRingGrad)";

        percentNode.textContent = `${adherence}%`;
    } catch (err) {
        console.warn("renderHeroCheckinRing error:", err?.message || err);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    bindShellInteractions();
    const requestedCalculator = new URLSearchParams(window.location.search).get("calculator");
    if (requestedCalculator && ["bmr", "macro", "goal"].includes(requestedCalculator)) {
        setTimeout(() => openCalculatorModal(requestedCalculator), 120);
    }
    await hydrateNameFromProfile();
    await refreshHomeAuthState();
    applySidebarTooltipData();

    if (window.supabaseClient?.auth) {
        window.supabaseClient.auth.onAuthStateChange((_event, session) => {
            syncDesktopAccountButton(Boolean(session?.user));
        });
    }

    refreshIcons();
    unmountHomeLoaderWhenReady();
});
