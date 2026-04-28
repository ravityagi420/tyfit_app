const homeData = {
    name: "",
    fullName: "",
    profileImage: "assets/avatars/avatar-1.svg",
    motivationTitle: "Progress starts with a plan.",
    motivationText: "Small steps today, stronger tomorrow.",
    notifications: [],
    tools: [
        { title: "Diet Chart", subtitle: "View your diet and nutrition", href: "portal/diet_chart.html", icon: "salad", colorClass: "icon-diet" },
        { title: "Training Plan", subtitle: "Your workout made simple", href: "training_plan.html", icon: "dumbbell", colorClass: "icon-training" },
        { title: "Food Catalog", subtitle: "Explore foods and nutrition", href: "portal/food_catalog.html", icon: "book-open", colorClass: "icon-food" },
        { title: "BMR Calculator", subtitle: "Calculate your daily BMR", href: "#", icon: "calculator", colorClass: "icon-bmr" },
        { title: "Macro Calculator", subtitle: "Track your macros easily", href: "#", icon: "pie-chart", colorClass: "icon-macro" },
        { title: "Calorie Calculator", subtitle: "Count your calories", href: "#", icon: "flame", colorClass: "icon-calorie" }
    ]
};

function byId(id) {
    return document.getElementById(id);
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

function renderHome(data) {
    const greeting = byId("homeGreeting");
    const subtitle = byId("homeSubtitle");
    const heroTitle = byId("heroTitle");
    const heroText = byId("heroText");

    if (greeting) greeting.textContent = `Hello${data.name ? `, ${data.name}` : ""} 👋`;
    if (subtitle) subtitle.textContent = "Let’s build consistency today";
    if (heroTitle) heroTitle.textContent = data.motivationTitle;
    if (heroText) heroText.textContent = data.motivationText;

    const desktopName = byId("desktopProfileName");
    const desktopAvatar = byId("desktopProfileAvatar");
    if (desktopName) desktopName.textContent = data.fullName || data.name || "Account";
    if (desktopAvatar) desktopAvatar.src = data.profileImage || "assets/avatars/avatar-1.svg";

    const grid = byId("homeToolsGrid");
    if (grid) {
        grid.innerHTML = data.tools.map((tool) => `
            <a class="tyfit-tool-card" href="${tool.href}" data-title="${tool.title}"${tool.href === "#" ? ` data-calculator="${tool.title}"` : ""}>
                <span class="tyfit-tool-icon ${tool.colorClass}">
                    <i data-lucide="${tool.icon}"></i>
                </span>
                <h5 class="tool-card-title">${tool.title}</h5>
            </a>
        `).join("");

        const quickAccessToggle = byId("quickAccessToggle");
        if (quickAccessToggle) {
            quickAccessToggle.style.display = "none";
        }

        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
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
    setTimeout(() => {
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }, 0);
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
            const action = btn.dataset.action === "meal" ? "Add Meal" : "Log Weight";
            showToast(`${action} clicked.`);
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

async function hydrateNameFromProfile() {
    try {
        if (!window.tyfitProfile?.getCurrentUser) {
            renderHome(homeData);
            return;
        }

        const user = await window.tyfitProfile.getCurrentUser();
        if (!user?.id) {
            renderHome(homeData);
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
    } catch (error) {
        console.warn("hydrateNameFromProfile warning:", error?.message || error);
        renderHome(homeData);
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

    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
});
