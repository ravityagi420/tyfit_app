const homeData = {
    name: "Ravikant",
    fullName: "Ravikant Tyagi",
    profileImage: "assets/avatars/avatar-1.svg",
    motivationTitle: "Let's Stay Consistent",
    motivationText: "Small Steps Every Day Build Real Results.",
    notifications: [],
    tools: [
        { title: "Diet Chart", subtitle: "View your diet and nutrition", href: "portal/diet_chart.html", icon: "salad", colorClass: "icon-diet" },
        { title: "Training Plan", subtitle: "Your workout made simple", href: "#", icon: "dumbbell", colorClass: "icon-training" },
        { title: "Food Catalog", subtitle: "Explore foods, calories and nutrition details.", href: "portal/food_catalog.html", icon: "book-open", colorClass: "icon-food" },
        { title: "Reminders", subtitle: "Set and manage your fitness reminders", href: "#", icon: "bell", colorClass: "icon-reminder" },
        { title: "BMR Calculator", subtitle: "Calculate your daily BMR", href: "#", icon: "calculator", colorClass: "icon-bmr" },
        { title: "Body Fat Calculator", subtitle: "Track your body fat percentage", href: "#", icon: "percent", colorClass: "icon-bodyfat" },
        { title: "Macro Calculator", subtitle: "Calculate your macros", href: "#", icon: "pie-chart", colorClass: "icon-macro" },
        { title: "Calorie Calculator", subtitle: "Know your daily calorie needs", href: "#", icon: "flame", colorClass: "icon-calorie" },
        { title: "1RM Calculator", subtitle: "Find your one rep max", href: "#", icon: "gauge", colorClass: "icon-1rm" }
    ]
};

function byId(id) {
    return document.getElementById(id);
}

let quickAccessExpanded = false;

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

    if (greeting) greeting.textContent = `Hello, ${data.name} 👋`;
    if (subtitle) subtitle.textContent = "Let’s build consistency today";
    if (heroTitle) heroTitle.textContent = data.motivationTitle;
    if (heroText) heroText.textContent = data.motivationText;

    const desktopName = byId("desktopProfileName");
    const desktopAvatar = byId("desktopProfileAvatar");
    if (desktopName) desktopName.textContent = data.fullName || data.name;
    if (desktopAvatar) desktopAvatar.src = data.profileImage || "assets/avatars/avatar-1.svg";

    const grid = byId("homeToolsGrid");
    if (grid) {
        grid.innerHTML = data.tools.map((tool, index) => `
            <a class="tyfit-tool-card tool-card${index >= 6 ? " tyfit-tool-card--extra" : ""}" href="${tool.href}" data-title="${tool.title}">
                <span class="tyfit-tool-icon tool-icon-box ${tool.colorClass}">
                    <i data-lucide="${tool.icon}"></i>
                </span>
                <div class="tyfit-tool-info">
                    <h5 class="tool-card-title">${tool.title}</h5>
                    <p class="tool-card-subtitle">${tool.subtitle}</p>
                </div>
                <i data-lucide="chevron-right" aria-hidden="true"></i>
            </a>
        `).join("");

        grid.classList.toggle("is-expanded", quickAccessExpanded);

        const quickAccessToggle = byId("quickAccessToggle");
        if (quickAccessToggle) {
            quickAccessToggle.style.display = data.tools.length > 6 ? "inline-flex" : "none";
            quickAccessToggle.textContent = quickAccessExpanded ? "Show less" : "View all";
            quickAccessToggle.setAttribute("aria-expanded", String(quickAccessExpanded));
        }

        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }
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

    if (layout) {
        layout.addEventListener("click", (event) => {
            const card = event.target.closest(".tyfit-tool-card");
            if (card && card.getAttribute("href") === "#") {
                event.preventDefault();
                showToast(`${card.dataset.title} will be connected soon.`);
            }
        });
    }

    if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener("click", toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileDrawer);
    if (mobileDrawerClose) mobileDrawerClose.addEventListener("click", closeMobileDrawer);
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);
    if (quickAddBtn) quickAddBtn.addEventListener("click", openSheet);
    if (sheetClose) sheetClose.addEventListener("click", closeSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener("click", closeSheet);

    if (quickAccessToggle) {
        quickAccessToggle.addEventListener("click", () => {
            quickAccessExpanded = !quickAccessExpanded;
            const grid = byId("homeToolsGrid");
            if (grid) {
                grid.classList.toggle("is-expanded", quickAccessExpanded);
            }
            quickAccessToggle.textContent = quickAccessExpanded ? "Show less" : "View all";
            quickAccessToggle.setAttribute("aria-expanded", String(quickAccessExpanded));
        });
    }

    if (desktopNotifBtn) desktopNotifBtn.addEventListener("click", () => toggleMenu(desktopNotifMenu));
    if (mobileNotifBtn) mobileNotifBtn.addEventListener("click", () => toggleMenu(mobileNotifMenu));
    if (desktopAccountBtn) desktopAccountBtn.addEventListener("click", () => toggleMenu(desktopAccountMenu));

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
                try {
                    if (window.supabaseClient?.auth) {
                        await window.supabaseClient.auth.signOut();
                    }
                } catch (error) {
                    console.warn("Logout warning:", error?.message || error);
                }
                window.location.href = "login.html";
            }
        });
    }

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
        const firstName = profile?.first_name || user?.user_metadata?.given_name || user?.user_metadata?.name || homeData.name;
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
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
});
