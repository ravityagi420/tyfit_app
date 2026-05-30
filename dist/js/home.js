const homeData = {
    name: "",
    fullName: "",
    profileImage: "assets/avatars/avatar-1.svg",
    motivationTitle: "Small habits.\nBig transformation.",
    motivationText: "Stay consistent today,\nthank yourself tomorrow.",
    notifications: [],
    tools: [
        { title: "Diet Chart", subtitle: "View your diet and nutrition", href: "portal/diet_chart.html", icon: "salad", colorClass: "icon-diet" },
        { title: "Training Plan", subtitle: "Your workout made simple", href: "training_plan.html", icon: "dumbbell", colorClass: "icon-training" },
        { title: "Journey", subtitle: "View your mountain progress", href: "journey.html", icon: "mountain", colorClass: "icon-food" },
        { title: "BMR Calculator", subtitle: "Calculate your daily BMR", href: "#", icon: "calculator", colorClass: "icon-bmr", comingSoon: true },
        { title: "Macro Calculator", subtitle: "Track your macros easily", href: "#", icon: "pie-chart", colorClass: "icon-macro", comingSoon: true },
        { title: "Calorie Calculator", subtitle: "Count your calories", href: "#", icon: "flame", colorClass: "icon-calorie", comingSoon: true }
    ]
};

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
    loader.innerHTML = '<div class="tyfit-page-loader__panel"><div class="tyfit-page-loader__spinner" aria-hidden="true"></div><p>Loading TYFIT...</p></div>';
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
    if (document.readyState === "complete") {
        refreshIcons();
        unmountHomeLoader();
        return;
    }

    window.addEventListener("load", () => {
        refreshIcons();
        unmountHomeLoader();
    }, { once: true });
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
let activeCalculatorName = "BMR Calculator";

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
                : (href === "#" ? ` data-calculator="${tool.title}"` : "");
            const cardClass = isComingSoon ? "tyfit-tool-card tyfit-tool-card--coming-soon" : "tyfit-tool-card";
            const badge = isComingSoon ? '<span class="tyfit-coming-soon-label">Coming Soon</span>' : "";
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
            <h4 class="tyfit-journey-home-title">Small habits.<span>Big transformation.</span></h4>
            <div class="tyfit-hero-chips" aria-label="Today's focus goals">
                <span class="tyfit-hero-chip"><img src="assets/tyfit_img/custom_icons/nutrition-leaf.svg" alt="" aria-hidden="true">Nutrition</span>
                <span class="tyfit-hero-chip"><img src="assets/tyfit_img/custom_icons/training-dumbbell.svg" alt="" aria-hidden="true">Training</span>
                <span class="tyfit-hero-chip"><img src="assets/tyfit_img/custom_icons/recovery-moon.svg" alt="" aria-hidden="true">Recovery</span>
            </div>
            <div class="tyfit-journey-home-actions">
                <a class="tyfit-hero-cta" href="daily_checkin.html">Log My Day <i data-lucide="arrow-right" aria-hidden="true"></i></a>
                <span class="tyfit-journey-reassurance"><i data-lucide="clock-3" aria-hidden="true"></i>It only takes 1 minute</span>
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

function openCalculatorComingSoon(name) {
    const modal = byId("calculatorComingSoonModal");
    const textEl = byId("calculatorComingSoonText");
    const titleEl = byId("calculatorComingSoonTitle");
    if (!modal) return;

    activeCalculatorName = name || "Calculator";
    if (textEl) textEl.textContent = activeCalculatorName;
    if (titleEl) titleEl.textContent = activeCalculatorName;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("tyfit-calc-modal-open");
    setTimeout(refreshIcons, 0);
}

function closeCalculatorComingSoon() {
    const modal = byId("calculatorComingSoonModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tyfit-calc-modal-open");
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
            return;
        }

        const calcTrigger = event.target.closest("[data-calculator]");
        if (calcTrigger) {
            event.preventDefault();
            openCalculatorComingSoon(calcTrigger.dataset.calculator || calcTrigger.dataset.title || "Calculator");
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

    if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener("click", toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileDrawer);
    if (mobileDrawerClose) mobileDrawerClose.addEventListener("click", closeMobileDrawer);
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);
    if (quickAddBtn) quickAddBtn.addEventListener("click", openSheet);
    if (sheetClose) sheetClose.addEventListener("click", closeSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener("click", closeSheet);

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

            showToast("Log Weight clicked.");
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

    byId("calculatorComingSoonClose")?.addEventListener("click", closeCalculatorComingSoon);
    byId("calculatorComingSoonModal")?.addEventListener("click", (event) => {
        if (event.target.matches("[data-calc-close]")) closeCalculatorComingSoon();
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeCalculatorComingSoon();
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
