// -------------------------------------------------------
// TYFIT Home Page Logic
// Handles: auth gate, profile fetch, user_about fetch,
//          hero render, stats render, tools grid render
// -------------------------------------------------------

const HOME_TOOLS = [
    { label: "Diet Tool",           icon: "fa-apple-alt",      href: "portal/diet_chart.html" },
    { label: "Training Tool",       icon: "fa-dumbbell",       href: "portal/exercise_chart.html" },
    { label: "BMR Calculator",      icon: "fa-calculator",     href: "#" },
    { label: "Body Fat Calculator", icon: "fa-tint",           href: "#" },
    { label: "Goal Calculator",     icon: "fa-bullseye",       href: "#" },
    { label: "Macro Calculator",    icon: "fa-chart-pie",      href: "#" },
    { label: "Calorie Calculator",  icon: "fa-fire",           href: "#" },
    { label: "1 RM Calculator",     icon: "fa-weight",         href: "#" },
    { label: "Reminder",            icon: "fa-bell",           href: "#" }
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

function getProfileImageUrl(path) {
    if (!path) return "";
    const { data } = window.supabaseClient.storage.from("profile-pictures").getPublicUrl(path);
    return data?.publicUrl || "";
}

function getFallbackAvatar(fullName) {
    const initials = (fullName || "U")
        .split(" ")
        .map(w => w[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
    const colours = ["#6c63ff","#00b4d8","#f77f00","#2ec4b6","#e71d36","#4CAF50"];
    const idx = (initials.charCodeAt(0) || 0) % colours.length;
    const bg = colours[idx];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
        <circle cx='60' cy='60' r='60' fill='${bg}'/>
        <text x='50%' y='50%' dominant-baseline='central' text-anchor='middle'
              font-family='Manrope,sans-serif' font-size='42' font-weight='700' fill='#fff'>${initials}</text>
    </svg>`;
    return "data:image/svg+xml;base64," + btoa(svg);
}

async function fetchProfileData(userId) {
    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, first_name, last_name, full_name, role")
        .eq("id", userId)
        .maybeSingle();
    if (error) { console.error("fetchProfileData error:", error); return null; }
    return data;
}

async function fetchUserAbout(userId) {
    const { data, error } = await window.supabaseClient
        .from("user_about")
        .select("user_id, date_of_birth, weight, profile_picture_path")
        .eq("user_id", userId)
        .maybeSingle();
    if (error) { console.warn("fetchUserAbout error (table may not exist yet):", error.message); return null; }
    return data;
}

function isAdminProfile(profile) {
    if (!profile) return false;
    if (profile.is_admin === true) return true;
    const role = (profile.role || "").toLowerCase();
    return role === "admin";
}

function getProfileHref(profile) {
    return isAdminProfile(profile) ? "portal/index.html" : "portal/index.html";
}

function renderHomeHero(profile, userAbout) {
    const fullName = profile
        ? ((profile.first_name || "") + " " + (profile.last_name || "")).trim() || profile.full_name || "User"
        : "User";

    const imgPath = userAbout?.profile_picture_path || "";
    const imgUrl = imgPath ? getProfileImageUrl(imgPath) : "";
    const avatarSrc = imgUrl || getFallbackAvatar(fullName);

    const profileHref = getProfileHref(profile);

    const avatarEl = getEl("homeAvatar");
    if (avatarEl) {
        avatarEl.src = avatarSrc;
        avatarEl.alt = fullName;
        if (imgUrl) {
            avatarEl.onerror = () => { avatarEl.src = getFallbackAvatar(fullName); };
        }
    }

    const nameEl = getEl("homeFullName");
    if (nameEl) nameEl.textContent = fullName;

    const seeProfileLink = getEl("homeSeeProfileLink");
    if (seeProfileLink) seeProfileLink.href = profileHref;

    const viewProfileBtn = getEl("homeViewProfileBtn");
    if (viewProfileBtn) viewProfileBtn.href = profileHref;

    // Stats
    const age = calculateAge(userAbout?.date_of_birth);
    const ageEl = getEl("homeAge");
    if (ageEl) ageEl.textContent = age != null ? String(age) : "--";

    const weight = userAbout?.weight;
    const weightEl = getEl("homeWeight");
    if (weightEl) weightEl.textContent = weight != null ? String(weight) : "--";
}

function renderToolsGrid() {
    const grid = getEl("homeToolsGrid");
    if (!grid) return;

    grid.innerHTML = HOME_TOOLS.map(tool => `
        <a href="${tool.href}" class="tyfit-tool-item">
            <div class="tyfit-tool-icon-wrap">
                <i class="fa ${tool.icon}"></i>
            </div>
            <span class="tyfit-tool-label">${tool.label}</span>
        </a>
    `).join("");
}

async function loadHomeProfile() {
    // 1. Require login — opens locked modal if not signed in
    const user = await window.requireLoginWithModal();
    if (!user) return;

    // 2. Show skeleton, hide main
    const skeleton = getEl("homeSkeleton");
    const main = getEl("homeMain");
    if (skeleton) skeleton.style.display = "block";
    if (main) main.style.display = "none";

    try {
        const [profile, userAbout] = await Promise.all([
            fetchProfileData(user.id),
            fetchUserAbout(user.id)
        ]);

        renderHomeHero(profile, userAbout);
        renderToolsGrid();

        // Hide skeleton, show main
        if (skeleton) skeleton.style.display = "none";
        if (main) main.style.display = "block";
    } catch (err) {
        console.error("loadHomeProfile error:", err);
        if (skeleton) skeleton.style.display = "none";
        if (main) {
            main.style.display = "block";
            // Still render tools grid even if profile fails
            renderToolsGrid();
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // home.js boots after login.js; login.js DOMContentLoaded runs first
    // We hook into component-loaded to run after navbar is ready,
    // but also run immediately in case navbar is already loaded.
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

    // Fallback: if component-loaded fires before this listener, run anyway after short delay
    setTimeout(runHome, 800);
});
