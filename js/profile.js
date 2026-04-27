const profileData = {
    name: "",
    email: "",
    profileImage: "",
    memberSince: "May 2024",
    dietPlanStatus: "Active",
    goal: "Fat Loss",
    sections: {
        personalInformation: "complete",
        contactInformation: "incomplete",
        bodyInformation: "needs_input",
        fitnessGoal: "needs_input",
        preferences: "complete"
    }
};

function byId(id) {
    return document.getElementById(id);
}

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

function bindShellInteractions() {
    const desktopMenuBtn = byId("desktopMenuBtn");
    const sidebarCollapseBtn = byId("sidebarCollapseBtn");
    const mobileMenuBtn = byId("mobileMenuBtn");
    const mobileDrawerClose = byId("mobileDrawerClose");
    const mobileDrawerBackdrop = byId("mobileDrawerBackdrop");
    const quickAddBtn = byId("quickAddBtn");
    const sheet = byId("quickSheet");
    const sheetBackdrop = byId("quickSheetBackdrop");
    const sheetClose = byId("quickSheetClose");
    const desktopNotifBtn = byId("desktopNotifBtn");
    const desktopNotifMenu = byId("desktopNotifMenu");
    const desktopAccountBtn = byId("desktopAccountBtn");
    const desktopAccountMenu = byId("desktopAccountMenu");

    function toggleSidebar() {
        document.body.classList.toggle("sidebar-collapsed");
    }

    function openMobileDrawer() {
        const drawer = byId("mobileDrawer");
        if (!drawer || !mobileDrawerBackdrop) return;
        drawer.classList.add("is-open");
        drawer.setAttribute("aria-hidden", "false");
        mobileDrawerBackdrop.hidden = false;
    }

    function closeMobileDrawer() {
        const drawer = byId("mobileDrawer");
        if (!drawer || !mobileDrawerBackdrop) return;
        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
        mobileDrawerBackdrop.hidden = true;
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

    function togglePopover(menuEl) {
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
    }

    if (desktopMenuBtn) desktopMenuBtn.addEventListener("click", toggleSidebar);
    if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener("click", toggleSidebar);
    if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", openMobileDrawer);
    if (mobileDrawerClose) mobileDrawerClose.addEventListener("click", closeMobileDrawer);
    if (mobileDrawerBackdrop) mobileDrawerBackdrop.addEventListener("click", closeMobileDrawer);
    if (quickAddBtn) quickAddBtn.addEventListener("click", openSheet);
    if (sheetClose) sheetClose.addEventListener("click", closeSheet);
    if (sheetBackdrop) sheetBackdrop.addEventListener("click", closeSheet);
    if (desktopNotifBtn) desktopNotifBtn.addEventListener("click", () => togglePopover(desktopNotifMenu));
    if (desktopAccountBtn) desktopAccountBtn.addEventListener("click", () => togglePopover(desktopAccountMenu));

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

    document.querySelectorAll(".tyfit-sheet-action").forEach((btn) => {
        btn.addEventListener("click", () => {
            const action = btn.dataset.action === "meal" ? "Add Meal" : "Log Weight";
            showToast(`${action} clicked.`);
            closeSheet();
        });
    });

    const mobileSettingsBtn = byId("mobileSettingsBtn");
    const upgradeNowBtn = byId("upgradeNowBtn");
    if (mobileSettingsBtn) mobileSettingsBtn.addEventListener("click", () => showToast("Settings screen coming soon."));
    if (upgradeNowBtn) upgradeNowBtn.addEventListener("click", () => showToast("Premium flow will be connected soon."));

    document.addEventListener("click", (event) => {
        const withinDropdown = event.target.closest(".tyfit-dropdown-wrap");
        if (withinDropdown) return;
        document.querySelectorAll(".tyfit-popover-menu.is-open").forEach((menu) => {
            menu.classList.remove("is-open");
            menu.setAttribute("aria-hidden", "true");
        });
    });
}

function getStatusIcon(status) {
    if (status === "complete") {
        return { className: "completed", icon: "circle-check" };
    }
    if (status === "incomplete") {
        return { className: "incomplete", icon: "circle-x" };
    }
    return { className: "needs_input", icon: "circle-alert" };
}

function renderProfileOverview(data) {
    const nameEl = byId("profileName");
    const emailEl = byId("profileEmail");
    const avatarEl = byId("profileAvatar");
    const chipNameEl = byId("desktopChipName");
    const metaRow = byId("profileMetaRow");
    const sectionsList = byId("profileSectionsList");

    if (nameEl) nameEl.textContent = data.name || "Profile";
    if (emailEl) emailEl.textContent = data.email;
    if (chipNameEl) chipNameEl.textContent = (data.name.split(" ")[0] || "Profile");

    if (avatarEl) {
        // Default TYFIT profile avatar fallback
        avatarEl.src = data.profileImage || "assets/avatars/avatar-1.svg";
        avatarEl.alt = `${data.name || "Profile"} profile avatar`;
    }

    if (metaRow) {
        const summary = [
            { label: "Member Since", value: data.memberSince, icon: "calendar-days", colorClass: "tyfit-meta-icon--calendar" },
            { label: "Diet Plan", value: data.dietPlanStatus, icon: "utensils-crossed", colorClass: "tyfit-meta-icon--diet" },
            { label: "Goal", value: data.goal, icon: "trophy", colorClass: "tyfit-meta-icon--goal" }
        ];

        metaRow.innerHTML = summary.map((item) => `
            <div class="tyfit-meta-item">
                <span class="tyfit-meta-icon ${item.colorClass}"><i data-lucide="${item.icon}"></i></span>
                <div>
                    <span>${item.label}</span>
                    <strong>${item.value}</strong>
                </div>
            </div>
        `).join("");
    }

    if (sectionsList) {
        const rows = [
            {
                key: "personalInformation",
                title: "Personal Information",
                subtitle: "Name, date of birth, gender",
                icon: "user"
            },
            {
                key: "contactInformation",
                title: "Contact Information",
                subtitle: "Email, phone number, address",
                icon: "mail"
            },
            {
                key: "bodyInformation",
                title: "Body Information",
                subtitle: "Height, weight, activity level",
                icon: "activity"
            },
            {
                key: "fitnessGoal",
                title: "Fitness Goal",
                subtitle: "Your goals and target progress",
                icon: "target"
            },
            {
                key: "preferences",
                title: "Preferences",
                subtitle: "Units, reminders, notifications",
                icon: "bell"
            }
        ];

        sectionsList.innerHTML = rows.map((row) => {
            const status = data.sections[row.key] || "needs_input";
            const statusUi = getStatusIcon(status);
            return `
                <button type="button" class="tyfit-section-row" data-section="${row.key}">
                    <span class="tyfit-section-icon"><i data-lucide="${row.icon}"></i></span>
                    <span class="tyfit-section-copy">
                        <strong>${row.title}</strong>
                        <span>${row.subtitle}</span>
                    </span>
                    <span class="tyfit-status-icon ${statusUi.className}"><i data-lucide="${statusUi.icon}"></i></span>
                    <i data-lucide="chevron-right" class="tyfit-chevron"></i>
                </button>
            `;
        }).join("");
    }

    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

function bindProfileInteractions() {
    const editAction = byId("profileEditAction");
    const logoutAction = byId("logoutAction");
    const sectionsList = byId("profileSectionsList");

    if (editAction) {
        editAction.addEventListener("click", () => {
            showToast("Open profile edit page.");
            window.location.href = "profile_edit.html";
        });
    }

    if (logoutAction) {
        logoutAction.addEventListener("click", async () => {
            try {
                if (window.supabaseClient?.auth) {
                    await window.supabaseClient.auth.signOut();
                }
            } catch (error) {
                console.warn("Logout warning:", error?.message || error);
            }
            window.location.href = "login.html";
        });
    }

    document.querySelectorAll("[data-action='logout'], .sidebar-logout, #logoutBtn").forEach((btn) => {
        if (btn.dataset.logoutBound === "true") return;
        btn.dataset.logoutBound = "true";
        btn.addEventListener("click", async (event) => {
            event.preventDefault();
            try {
                if (window.supabaseClient?.auth) {
                    await window.supabaseClient.auth.signOut();
                }
            } catch (error) {
                console.warn("Logout warning:", error?.message || error);
            }
            window.location.href = "login.html";
        });
    });

    if (sectionsList) {
        sectionsList.addEventListener("click", (event) => {
            const row = event.target.closest(".tyfit-section-row");
            if (!row) {
                return;
            }
            showToast(`${row.dataset.section} clicked.`);
        });
    }
}

function formatMemberSince(value) {
    if (!value) {
        return profileData.memberSince;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return profileData.memberSince;
    }
    return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric"
    });
}

async function hydrateProfile() {
    try {
        if (!window.tyfitProfile?.getCurrentUser) {
            return profileData;
        }

        const user = await window.tyfitProfile.getCurrentUser();
        if (!user?.id) {
            return profileData;
        }

        const [profile, userAbout] = await Promise.all([
            window.tyfitProfile.fetchProfile(user.id),
            window.tyfitProfile.fetchUserAbout(user.id)
        ]);

        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
            || profile?.full_name
            || user?.user_metadata?.full_name
            || user?.email?.split("@")[0]
            || "Profile";

        const email = profile?.email || user?.email || profileData.email;

        const profileImage = window.tyfitProfile.resolveProfileImage(profile, userAbout);

        return {
            ...profileData,
            name: fullName,
            email,
            profileImage,
            memberSince: formatMemberSince(profile?.created_at)
        };
    } catch (error) {
        console.warn("hydrateProfile warning:", error?.message || error);
        return profileData;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    bindShellInteractions();
    const hydrated = await hydrateProfile();
    renderProfileOverview(hydrated);
    bindProfileInteractions();
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
});
