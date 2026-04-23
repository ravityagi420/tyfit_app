// -------------------------------------------------------
// TYFIT Home Page Logic
// Handles: auth gate, profile fetch, completion widget,
//          hero render, stats render, tools grid render
// -------------------------------------------------------

const HOME_TOOLS = [
    { label: "Diet Tool", icon: "fa-apple-alt", href: "portal/diet_chart.html" },
    { label: "Training Tool", icon: "fa-dumbbell", href: "portal/exercise_chart.html" },
    { label: "BMR Calculator", icon: "fa-calculator", href: "#" },
    { label: "Body Fat Calculator", icon: "fa-tint", href: "#" },
    { label: "Goal Calculator", icon: "fa-bullseye", href: "#" },
    { label: "Macro Calculator", icon: "fa-chart-pie", href: "#" },
    { label: "Calorie Calculator", icon: "fa-fire", href: "#" },
    { label: "1 RM Calculator", icon: "fa-weight", href: "#" },
    { label: "Reminder", icon: "fa-bell", href: "#" }
];

function getEl(id) {
    return document.getElementById(id);
}

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function getProfileEditHref() {
    return "profile_edit.html";
}

function renderHomeHero(profile, userAbout, avatarUrl) {
    const fullName = window.tyfitProfile.getDisplayName(profile, null);
    const profileHref = getProfileEditHref();

    const avatarEl = getEl("homeAvatar");
    if (avatarEl) {
        avatarEl.src = avatarUrl || "";
        avatarEl.alt = fullName;
    }

    const nameEl = getEl("homeFullName");
    if (nameEl) {
        nameEl.textContent = fullName;
    }

    const seeProfileLink = getEl("homeSeeProfileLink");
    if (seeProfileLink) {
        seeProfileLink.href = profileHref;
    }

    const viewProfileBtn = getEl("homeViewProfileBtn");
    if (viewProfileBtn) {
        viewProfileBtn.href = profileHref;
    }

    const age = calculateAge(profile?.date_of_birth);
    const ageEl = getEl("homeAge");
    if (ageEl) {
        ageEl.textContent = age != null ? String(age) : "--";
    }

    const weight = userAbout?.weight;
    const weightEl = getEl("homeWeight");
    if (weightEl) {
        weightEl.textContent = weight != null ? String(weight) : "--";
    }
}

function renderToolsGrid() {
    const grid = getEl("homeToolsGrid");
    if (!grid) return;

    grid.innerHTML = HOME_TOOLS.map((tool) => `
        <a href="${tool.href}" class="tyfit-tool-item">
            <div class="tyfit-tool-icon-wrap">
                <i class="fa ${tool.icon}"></i>
            </div>
            <span class="tyfit-tool-label">${tool.label}</span>
        </a>
    `).join("");
}

function renderProfileCompletionCard(profile, userAbout) {
    const card = getEl("homeProfileCompletionCard");
    const title = getEl("homeCompletionTitle");
    const pill = getEl("homeCompletionPill");
    const head = getEl("homeCompletionHead");
    const copy = getEl("homeCompletionCopy");
    const cta = getEl("homeViewProfileBtn");
    if (!card || !title || !pill || !head || !copy || !cta) {
        return;
    }

    const completion = window.tyfitProfile.calculateProfileCompletion(profile, userAbout);
    const complete = window.tyfitProfile.isProfileComplete(profile, userAbout);

    title.textContent = `Profile ${completion.percent}% completed`;
    pill.textContent = `${completion.percent}%`;

    if (complete) {
        head.style.display = "none";
        copy.style.display = "none";
        copy.textContent = "";
        card.classList.add("is-complete");
        cta.textContent = "Edit Profile";
    } else {
        head.style.display = "flex";
        copy.style.display = "block";
        copy.textContent = "Complete your profile to personalize your plans and calculations.";
        card.classList.remove("is-complete");
        cta.textContent = "Complete Profile";
    }

    card.style.display = "block";
}

async function loadHomeProfile() {
    const user = await window.tyfitProfile.getCurrentUser();
    if (!user) return;

    const skeleton = getEl("homeSkeleton");
    const main = getEl("homeMain");
    if (skeleton) skeleton.style.display = "block";
    if (main) main.style.display = "none";

    try {
        const [profile, userAbout] = await Promise.all([
            window.tyfitProfile.fetchProfile(user.id),
            window.tyfitProfile.fetchUserAbout(user.id)
        ]);

        const hydratedAbout = await window.tyfitProfile.ensureAvatarAssignment(user.id, userAbout);
        const avatarUrl = window.tyfitProfile.resolveProfileImage(profile, hydratedAbout);

        renderHomeHero(profile, hydratedAbout, avatarUrl);
        renderProfileCompletionCard(profile, hydratedAbout);
        renderToolsGrid();

        if (skeleton) skeleton.style.display = "none";
        if (main) main.style.display = "block";
    } catch (err) {
        console.error("loadHomeProfile error:", err);
        if (skeleton) skeleton.style.display = "none";
        if (main) {
            main.style.display = "block";
            renderToolsGrid();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    let homeLoaded = false;

    async function runHome() {
        if (homeLoaded) return;
        homeLoaded = true;
        await loadHomeProfile();
    }

    document.addEventListener("component-loaded", (event) => {
        if (event.detail?.componentName === "navbar") {
            runHome();
        }
    });

    setTimeout(runHome, 800);
});
