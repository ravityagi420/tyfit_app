async function ensureProfile(session) {
  if (!session || !session.user) return;

  const user = session.user;
  const meta = user.user_metadata || {};

  const fullName = meta.full_name || meta.name || "";
  let firstName = meta.given_name || "";
  let lastName = meta.family_name || "";

  if (!firstName && !lastName && fullName) {
    const parts = fullName.trim().split(" ");
    firstName = parts[0] || "";
    lastName = parts.slice(1).join(" ") || "";
  }

  const profilePayload = {
    id: user.id,
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName || [firstName, lastName].filter(Boolean).join(" "),
    auth_provider: user.app_metadata?.provider || "email",
    updated_at: new Date().toISOString()
  };

  const { error } = await window.supabaseClient
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });

  if (error) {
    console.error("Profile upsert failed:", error.message);
  }
}

function getSanitizedCurrentPath() {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

function isLoginPage() {
  const pathname = window.location.pathname.toLowerCase();
  return pathname === "/login.html" || pathname.endsWith("/login.html");
}

function shouldRequireAuthOnCurrentPage() {
  return !isLoginPage();
}

function getPostLoginRedirect() {
  return isLoginPage() ? "/index.html" : getSanitizedCurrentPath();
}

function getOAuthRedirectUrl() {
  const isProdAppHost = window.location.hostname === "app.tyfit.de";
  const origin = isProdAppHost ? "https://app.tyfit.de" : window.location.origin;
  return `${origin}/index.html`;
}

function getPublicHomeHref() {
  return window.location.pathname.includes("/portal/") ? "../index.html" : "index.html";
}

function getAdminHomeHref() {
  return window.location.pathname.includes("/portal/") ? "index.html" : "portal/index.html";
}

function getBlackLogoHref() {
  return window.location.pathname.includes("/portal/")
    ? "../assets/tyfit_img/black_icon_logo.png"
    : "assets/tyfit_img/black_icon_logo.png";
}

function getDisplayName(session) {
  const user = session?.user;

  if (!user) {
    return "Guest";
  }

  const meta = user.user_metadata || {};

  return meta.full_name || meta.name || user.email?.split("@")[0] || "User";
}

function getProfileDisplayName(profile, user) {
  const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return profileName || profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
}

function safeDialogAlert(options) {
  if (window.tyfitDialog?.alert) return window.tyfitDialog.alert(options);
  const message = typeof options === "string" ? options : (options?.message || "Something went wrong.");
  window.alert(message);
  return Promise.resolve(true);
}

async function waitForStableSession({ attempts = 8, intervalMs = 150 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const session = await getCurrentSession();
    if (session?.user) return session;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

function getUserRole(source) {
  const user = source?.user ? source.user : source;

  if (!user) {
    return "";
  }

  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  const appRoles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  const userRoles = Array.isArray(user.user_metadata?.roles) ? user.user_metadata.roles : [];
  const resolvedRole = appRole || userRole || appRoles[0] || userRoles[0] || "";

  return typeof resolvedRole === "string" ? resolvedRole.toLowerCase() : "";
}

function isAdminUser(source) {
  return getUserRole(source) === "admin";
}

function getProfileRole(profile) {
  if (!profile) {
    return "";
  }

  if (profile.is_admin === true) {
    return "admin";
  }

  const resolvedRole = profile.role || profile.user_role || profile.user_type || profile.access_level || "";

  return typeof resolvedRole === "string" ? resolvedRole.toLowerCase() : "";
}

async function fetchCurrentProfile(source) {
  const user = source?.user ? source.user : source;

  if (!user?.id) {
    return null;
  }

  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup failed:", error.message);
    return null;
  }

  return data || null;
}

async function getAccessState(sessionArg) {
  const session = typeof sessionArg === "undefined" ? await getCurrentSession() : sessionArg;
  const user = session?.user || null;

  if (!user) {
    const loggedOutState = {
      session: null,
      user: null,
      profile: null,
      isLoggedIn: false,
      isAdmin: false
    };

    window.tyfitAccessState = loggedOutState;
    return loggedOutState;
  }

  const cachedState = window.tyfitAccessState;
  if (cachedState?.user?.id === user.id && cachedState.profileLoaded) {
    return cachedState;
  }

  const profile = await fetchCurrentProfile(user);
  const isAdmin = isAdminUser(user) || getProfileRole(profile) === "admin";
  const accessState = {
    session,
    user,
    profile,
    isLoggedIn: true,
    isAdmin,
    profileLoaded: true
  };

  window.tyfitAccessState = accessState;
  return accessState;
}

async function getCurrentSession() {
  const {
    data: { session },
    error
  } = await window.supabaseClient.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

async function showUser(sessionArg) {
  const session = typeof sessionArg === "undefined" ? await getCurrentSession() : sessionArg;
  const el = document.getElementById("welcomeText");
  if (!el) return;

  if (!session?.user) {
    el.innerText = "Welcome Guest";
    return;
  }

  const accessState = await getAccessState(session);
  el.innerText = "Welcome " + getProfileDisplayName(accessState.profile, session.user);
}

function updateLoginPageState(session) {
  const guestState = document.getElementById("loginPageGuestState");
  const userState = document.getElementById("loginPageUserState");
  const userEmail = document.getElementById("loginPageUserEmail");

  if (!guestState || !userState || !userEmail) {
    return;
  }

  const isLoggedIn = Boolean(session?.user);

  guestState.style.display = isLoggedIn ? "none" : "block";
  userState.style.display = isLoggedIn ? "block" : "none";
  userEmail.textContent = session?.user?.email || "";
}

function updateAdminLinkState(accessState) {
  const adminLink = document.getElementById("adminLink");

  if (!adminLink) {
    return;
  }

  const canAccessAdmin = Boolean(accessState?.isAdmin);

  adminLink.style.display = canAccessAdmin ? "inline-block" : "none";
  adminLink.setAttribute("aria-hidden", String(!canAccessAdmin));
  adminLink.tabIndex = canAccessAdmin ? 0 : -1;
}

function updateAuthButtons(isLoggedIn) {
  const loginDropdown = document.getElementById("loginDropdown");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginDropdown) {
    loginDropdown.style.display = isLoggedIn ? "none" : "block";
  }

  if (logoutBtn) {
    logoutBtn.style.display = isLoggedIn ? "inline-block" : "none";
  }
}

function updatePrimaryNavLinks(accessState) {
  const targetHref = accessState?.isAdmin ? getAdminHomeHref() : getPublicHomeHref();
  ["mobileLogoLink", "desktopLogoLink", "dnav-home", "bnav-home"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute("href", targetHref);
    }
  });
}

function updateMobileSettingsAction(accessState) {
  const actionBtn = document.getElementById("mobileSettingsAction");
  if (!actionBtn) {
    return;
  }

  actionBtn.innerHTML = accessState?.isLoggedIn
    ? '<i class="fa fa-sign-out-alt"></i><span>Logout</span>'
    : '<i class="fa fa-sign-in-alt"></i><span>Login</span>';
}

function ensureAuthModalStyles() {
  if (document.getElementById("tyfitAuthModalStyles")) {
    return;
  }

  const styleEl = document.createElement("style");
  styleEl.id = "tyfitAuthModalStyles";
  styleEl.textContent = `
    #tyfitAuthModal[hidden] {
      display: none !important;
    }

    #tyfitAuthModal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    #tyfitAuthModal .tyfit-auth-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.62);
      backdrop-filter: blur(10px);
    }

    #tyfitAuthModal .tyfit-auth-modal-dialog {
      position: relative;
      z-index: 1;
      width: min(100%, 420px);
    }

    #tyfitAuthModal .tyfit-auth-modal-content {
      background: #ffffff;
      border-radius: 28px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);
    }

    #tyfitAuthModal .tyfit-auth-modal-header {
      display: flex;
      justify-content: flex-end;
      padding: 18px 18px 0;
    }

    #tyfitAuthModal .tyfit-auth-close {
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.06);
      color: #0f172a;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }

    #tyfitAuthModal .tyfit-auth-modal-body {
      padding: 8px 32px 32px;
      text-align: center;
    }

    #tyfitAuthModal .tyfit-auth-logo {
      width: 64px;
      height: 64px;
      margin: 0 auto 18px;
      display: block;
      object-fit: contain;
    }

    #tyfitAuthModal .tyfit-auth-title {
      margin: 0 0 12px;
      color: #0f172a;
      font-size: 1.5rem;
      font-weight: 700;
    }

    #tyfitAuthModal .tyfit-auth-copy {
      margin: 0 0 22px;
      color: #475569;
      font-size: 0.98rem;
      line-height: 1.5;
    }

    #tyfitAuthModal .tyfit-auth-google-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 18px;
      border: 0;
      border-radius: 16px;
      background: #111827;
      color: #ffffff;
      font-size: 0.98rem;
      font-weight: 600;
      cursor: pointer;
    }

    #tyfitAuthModal .tyfit-auth-google-mark {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      color: #111827;
      font-weight: 700;
      font-size: 0.92rem;
      flex: 0 0 auto;
    }

    body.tyfit-auth-modal-open,
    body.tyfit-auth-locked {
      overflow: hidden;
    }

    body.tyfit-auth-locked > *:not(#tyfitAuthModal) {
      pointer-events: none;
      user-select: none;
    }

    body.tyfit-auth-locked #tyfitAuthModal,
    body.tyfit-auth-locked #tyfitAuthModal * {
      pointer-events: auto;
      user-select: auto;
    }
  `;

  document.head.appendChild(styleEl);
}

function ensureAuthModal() {
  if (document.getElementById("tyfitAuthModal")) {
    return;
  }

  if (!document.body) {
    return;
  }

  ensureAuthModalStyles();

  const modalMarkup = `
    <div id="tyfitAuthModal" tabindex="-1" aria-hidden="true" hidden>
      <div class="tyfit-auth-modal-backdrop"></div>
      <div class="tyfit-auth-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="tyfitAuthTitle">
        <div class="tyfit-auth-modal-content">
          <div class="modal-header tyfit-auth-modal-header">
            <button type="button" class="tyfit-auth-close" data-auth-close aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body tyfit-auth-modal-body">
            <img src="${getBlackLogoHref()}" alt="Tyfit" class="tyfit-auth-logo" id="tyfitAuthLogo">
            <h5 class="tyfit-auth-title" id="tyfitAuthTitle">Login to TYFIT</h5>
            <p class="tyfit-auth-copy">Use your Google account to continue to the portal.</p>
            <button type="button" class="tyfit-auth-google-btn" id="tyfitAuthGoogleBtn">
              <span class="tyfit-auth-google-mark" aria-hidden="true">G</span>
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalMarkup);

  const googleBtn = document.getElementById("tyfitAuthGoogleBtn");
  const modalEl = document.getElementById("tyfitAuthModal");
  const closeBtn = modalEl?.querySelector("[data-auth-close]");
  const backdrop = modalEl?.querySelector(".tyfit-auth-modal-backdrop");

  if (googleBtn) {
    googleBtn.addEventListener("click", googleLogin);
  }

  const requestClose = () => {
    if (modalEl?.dataset.locked === "true") {
      return;
    }
    closeAuthModal();
  };

  if (closeBtn) {
    closeBtn.addEventListener("click", requestClose);
  }

  if (backdrop) {
    backdrop.addEventListener("click", requestClose);
  }

  if (document.body && document.body.dataset.authModalKeyBound !== "true") {
    document.body.dataset.authModalKeyBound = "true";
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") {
        return;
      }

      const activeModal = document.getElementById("tyfitAuthModal");
      if (!activeModal || activeModal.hidden || activeModal.dataset.locked === "true") {
        return;
      }

      closeAuthModal();
    });
  }
}

function openAuthModal(options = {}) {
  ensureAuthModal();

  const modalEl = document.getElementById("tyfitAuthModal");
  const closeBtn = modalEl?.querySelector(".tyfit-auth-close");
  const logoEl = document.getElementById("tyfitAuthLogo");
  const locked = options.locked !== false;

  if (!modalEl) {
    return;
  }

  if (logoEl) {
    logoEl.src = getBlackLogoHref();
  }

  if (closeBtn) {
    closeBtn.style.display = locked ? "none" : "block";
  }

  modalEl.dataset.locked = String(locked);
  modalEl.hidden = false;
  modalEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("tyfit-auth-modal-open");
  document.body.classList.toggle("tyfit-auth-locked", locked);
}

function closeAuthModal() {
  const modalEl = document.getElementById("tyfitAuthModal");
  document.body.classList.remove("tyfit-auth-locked");
  document.body.classList.remove("tyfit-auth-modal-open");
  if (modalEl) {
    modalEl.hidden = true;
    modalEl.setAttribute("aria-hidden", "true");
    modalEl.dataset.locked = "false";
  }
}

async function requireLoginWithModal() {
  const session = await waitForStableSession();
  if (!session?.user) {
    openAuthModal({ locked: true });
    return null;
  }

  closeAuthModal();
  return session.user;
}

function bindGlobalLogoutActions() {
  if (document.body && document.body.dataset.globalLogoutBound === "true") {
    return;
  }

  if (document.body) {
    document.body.dataset.globalLogoutBound = "true";
  }

  document.addEventListener("click", async (event) => {
    const logoutTrigger = event.target.closest('.tyfit-menu-action[data-action="logout"], [data-action="logout"], .sidebar-logout, #logoutAction, #logoutBtn');

    if (!logoutTrigger) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    await logout();
  }, true);
}

function bindAuthUi() {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
  const mobileSettingsMenu = document.getElementById("mobileSettingsMenu");
  const mobileSettingsAction = document.getElementById("mobileSettingsAction");

  bindGlobalLogoutActions();

  if (loginBtn && loginBtn.dataset.authBound !== "true") {
    loginBtn.dataset.authBound = "true";
    loginBtn.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthModal({ locked: false });
    });
  }

  if (logoutBtn && logoutBtn.dataset.authBound !== "true") {
    logoutBtn.dataset.authBound = "true";
    logoutBtn.addEventListener("click", logout);
  }

  if (mobileSettingsBtn && mobileSettingsBtn.dataset.authBound !== "true") {
    mobileSettingsBtn.dataset.authBound = "true";
    mobileSettingsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!mobileSettingsMenu) {
        return;
      }
      const opened = mobileSettingsMenu.classList.toggle("open");
      mobileSettingsBtn.setAttribute("aria-expanded", String(opened));
    });
  }

  if (mobileSettingsAction && mobileSettingsAction.dataset.authBound !== "true") {
    mobileSettingsAction.dataset.authBound = "true";
    mobileSettingsAction.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const accessState = await getAccessState();
      if (mobileSettingsMenu) {
        mobileSettingsMenu.classList.remove("open");
      }
      if (mobileSettingsBtn) {
        mobileSettingsBtn.setAttribute("aria-expanded", "false");
      }

      if (accessState?.isLoggedIn) {
        await logout(event);
        return;
      }

      openAuthModal({ locked: false });
    });
  }

  if (document.body && document.body.dataset.mobileSettingsBound !== "true") {
    document.body.dataset.mobileSettingsBound = "true";
    const closeMobileSettingsOnOutsideInteraction = (event) => {
      const activeMobileSettingsBtn = document.getElementById("mobileSettingsBtn");
      const activeMobileSettingsMenu = document.getElementById("mobileSettingsMenu");
      if (!activeMobileSettingsMenu || !activeMobileSettingsBtn) {
        return;
      }
      if (event.target.closest("#mobileSettingsBtn") || event.target.closest("#mobileSettingsMenu")) {
        return;
      }
      activeMobileSettingsMenu.classList.remove("open");
      activeMobileSettingsBtn.setAttribute("aria-expanded", "false");
    };

    // Capture phase ensures this still runs even when inner handlers stop propagation on mobile.
    document.addEventListener("pointerdown", closeMobileSettingsOnOutsideInteraction, true);
    document.addEventListener("click", closeMobileSettingsOnOutsideInteraction, true);

    document.addEventListener("click", (event) => {
      if (event.target.closest(".auth-dropdown")) {
        return;
      }
      document.querySelectorAll(".auth-dropdown.show").forEach((dropdown) => {
        dropdown.classList.remove("show");
      });
      document.querySelectorAll(".auth-dropdown-menu.show").forEach((menu) => {
        menu.classList.remove("show");
      });
    });
  }
}

async function syncAuthUi(sessionArg) {
  const accessState = await getAccessState(sessionArg);
  const session = accessState.session;

  bindAuthUi();
  updateAuthButtons(accessState.isLoggedIn);
  updateAdminLinkState(accessState);
  updatePrimaryNavLinks(accessState);
  updateMobileSettingsAction(accessState);
  await showUser(session);
  updateLoginPageState(session);

  const displayName = accessState.isLoggedIn ? getProfileDisplayName(accessState.profile, accessState.user) : "";
  const email = accessState.profile?.email || accessState.user?.email || "";
  const firstName = displayName ? (displayName.split(" ")[0] || displayName) : "";

  ["desktopProfileName", "desktopChipName"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = id === "desktopChipName" ? (firstName || "Profile") : (displayName || "Account");
  });
  const profileNameEl = document.getElementById("profileName");
  const profileEmailEl = document.getElementById("profileEmail");
  if (profileNameEl) profileNameEl.textContent = displayName || "Profile";
  if (profileEmailEl) profileEmailEl.textContent = email;

  return session;
}

async function maybeRedirectAfterLogin(session) {
  const redirectPath = sessionStorage.getItem("postLoginRedirect");

  if (!session || !redirectPath) {
    return;
  }

  const currentPath = getSanitizedCurrentPath();
  const isOnAuthReturnPage = currentPath === "/index.html" || currentPath === "/";

  if (!isOnAuthReturnPage) {
    return;
  }

  if (redirectPath === currentPath) {
    sessionStorage.removeItem("postLoginRedirect");
    return;
  }

  sessionStorage.removeItem("postLoginRedirect");
  window.location.href = redirectPath;
}

async function googleLogin(event) {
  if (event) {
    event.preventDefault();
  }

  sessionStorage.setItem("postLoginRedirect", getPostLoginRedirect());

  const { error } = await window.supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getOAuthRedirectUrl()
    }
  });

  if (error) {
    await safeDialogAlert({
      title: "Login Error",
      message: "Google login could not be started. Please try again."
    });
    console.error(error);
  }
}

async function logout(event) {
  if (event) {
    event.preventDefault();
  }

  const { error } = await window.supabaseClient.auth.signOut();

  if (error) {
    await safeDialogAlert({
      title: "Logout Error",
      message: error.message
    });
    console.error(error);
    return;
  }

  window.tyfitAccessState = null;
  updateAuthButtons(false);

  const mobileSettingsMenu = document.getElementById("mobileSettingsMenu");
  const mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
  if (mobileSettingsMenu) {
    mobileSettingsMenu.classList.remove("open");
  }
  if (mobileSettingsBtn) {
    mobileSettingsBtn.setAttribute("aria-expanded", "false");
  }
}

async function processOAuthCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (!code) {
    return null;
  }

  const existingSession = await getCurrentSession();

  if (existingSession) {
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, document.title, url.pathname + url.hash);
    return existingSession;
  }

  const { data, error } = await window.supabaseClient.auth.exchangeCodeForSession(code);

  if (error) {
    throw error;
  }

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, document.title, url.pathname + url.hash);

  return data?.session || null;
}

async function handleAuthStateChange(event, session) {
  if (event === "SIGNED_IN" && session) {
    await ensureProfile(session);
    closeAuthModal();
    await syncAuthUi(session);
    await maybeRedirectAfterLogin(session);
    return;
  }

  if (event === "SIGNED_OUT") {
    await syncAuthUi(null);
    if (shouldRequireAuthOnCurrentPage()) {
      openAuthModal({ locked: true });
    }
    return;
  }

  await syncAuthUi(session);
}

window.supabaseClient.auth.onAuthStateChange((event, session) => {
  window.setTimeout(() => {
    handleAuthStateChange(event, session).catch((error) => {
      console.error("Auth state handling failed:", error);
    });
  }, 0);
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    ensureAuthModal();
    bindAuthUi();
    const callbackSession = await processOAuthCallback();
    const stableSession = callbackSession || await waitForStableSession({ attempts: 20, intervalMs: 150 });
    const session = stableSession || await getCurrentSession();

    if (session) {
      await ensureProfile(session);
    }

    await syncAuthUi(session);
    await maybeRedirectAfterLogin(session);
    if (!session && shouldRequireAuthOnCurrentPage()) {
      openAuthModal({ locked: true });
    }
  } catch (err) {
    console.error("Unhandled auth init error:", err);
    await safeDialogAlert({
      title: "Authentication Error",
      message: "Unexpected auth init error: " + err.message
    });
  }
});

document.addEventListener("component-loaded", async (event) => {
  if (event.detail?.componentName !== "navbar") {
    return;
  }

  try {
    await syncAuthUi();
  } catch (error) {
    console.error("Navbar auth refresh failed:", error);
  }
});

window.googleLogin = googleLogin;
window.logout = logout;
window.showUser = showUser;
window.getUserRole = getUserRole;
window.isAdminUser = isAdminUser;
window.getProfileRole = getProfileRole;
window.getAccessState = getAccessState;
window.refreshAuthUi = syncAuthUi;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.requireLoginWithModal = requireLoginWithModal;