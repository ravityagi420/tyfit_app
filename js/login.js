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

function getPostLoginRedirect() {
  return "/index.html";
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

  el.innerText = "Welcome " + getDisplayName(session);
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

function ensureAuthModal() {
  if (document.getElementById("tyfitAuthModal")) {
    return;
  }

  if (!document.body) {
    return;
  }

  const modalMarkup = `
    <div class="modal fade" id="tyfitAuthModal" tabindex="-1" role="dialog" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content tyfit-auth-modal-content border-0 shadow">
          <div class="modal-header tyfit-auth-modal-header">
            <button type="button" class="close tyfit-auth-close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
            <img src="${getBlackLogoHref()}" alt="Tyfit" class="tyfit-auth-logo" id="tyfitAuthLogo">
          </div>
          <div class="modal-body tyfit-auth-modal-body">
            <h5 class="tyfit-auth-title">Login to TYFIT</h5>
            <p class="tyfit-auth-copy">Use your Google account to continue to the portal.</p>
            <button type="button" class="btn tyfit-auth-google-btn btn-block" id="tyfitAuthGoogleBtn">
              <i class="fab fa-google mr-2"></i> Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalMarkup);

  const googleBtn = document.getElementById("tyfitAuthGoogleBtn");
  if (googleBtn) {
    googleBtn.addEventListener("click", googleLogin);
  }
}

function openAuthModal(options = {}) {
  ensureAuthModal();

  const modalEl = document.getElementById("tyfitAuthModal");
  const closeBtn = modalEl?.querySelector(".tyfit-auth-close");
  const logoEl = document.getElementById("tyfitAuthLogo");
  const locked = options.locked !== false;

  if (!modalEl || !window.jQuery || !window.jQuery.fn.modal) {
    return;
  }

  if (logoEl) {
    logoEl.src = getBlackLogoHref();
  }

  if (closeBtn) {
    closeBtn.style.display = locked ? "none" : "block";
  }

  if (locked) {
    document.body.classList.add("tyfit-auth-locked");
  }

  window.jQuery(modalEl).modal({
    backdrop: locked ? "static" : true,
    keyboard: !locked,
    show: true
  });
}

function closeAuthModal() {
  const modalEl = document.getElementById("tyfitAuthModal");
  document.body.classList.remove("tyfit-auth-locked");
  if (modalEl && window.jQuery && window.jQuery.fn.modal) {
    window.jQuery(modalEl).modal("hide");
  }
}

async function requireLoginWithModal() {
  const session = await getCurrentSession();
  if (!session) {
    openAuthModal({ locked: true });
    return null;
  }

  closeAuthModal();
  return session.user;
}

function bindAuthUi() {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileSettingsBtn = document.getElementById("mobileSettingsBtn");
  const mobileSettingsMenu = document.getElementById("mobileSettingsMenu");
  const mobileSettingsAction = document.getElementById("mobileSettingsAction");

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
    document.addEventListener("click", (event) => {
      if (!mobileSettingsMenu || !mobileSettingsBtn) {
        return;
      }
      if (event.target.closest("#mobileSettingsBtn") || event.target.closest("#mobileSettingsMenu")) {
        return;
      }
      mobileSettingsMenu.classList.remove("open");
      mobileSettingsBtn.setAttribute("aria-expanded", "false");
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

  return session;
}

async function maybeRedirectAfterLogin(session) {
  const redirectPath = sessionStorage.getItem("postLoginRedirect");

  if (!session || !redirectPath) {
    return;
  }

  const currentPath = window.location.pathname;
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
      redirectTo: window.location.origin + "/index.html"
    }
  });

  if (error) {
    await window.tyfitDialog.alert({
      title: "Login Error",
      message: "Google login error: " + error.message
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
    await window.tyfitDialog.alert({
      title: "Logout Error",
      message: error.message
    });
    console.error(error);
    return;
  }

  window.tyfitAccessState = null;
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
    // Lock any protected page (portal pages AND home page)
    const pathname = window.location.pathname;
    const isProtectedPage = pathname.includes("/portal/") ||
      pathname === "/index.html" || pathname === "/" || pathname.endsWith("/index.html");
    if (isProtectedPage) {
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
    const session = callbackSession || await getCurrentSession();

    if (session) {
      await ensureProfile(session);
    }

    await syncAuthUi(session);
    await maybeRedirectAfterLogin(session);
  } catch (err) {
    console.error("Unhandled auth init error:", err);
    await window.tyfitDialog.alert({
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