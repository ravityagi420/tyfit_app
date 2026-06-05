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
  const pathname = window.location.pathname.toLowerCase();
  const isHome = pathname === "/" || pathname === "/index.html" || pathname.endsWith("/index.html");
  return !isLoginPage() && !isHome;
}

function ensureAuthBootstrapShield() {
  if (isLoginPage()) {
    return;
  }

  if (document.getElementById("tyfitAuthBootstrapStyles")) {
    return;
  }

  const styleEl = document.createElement("style");
  styleEl.id = "tyfitAuthBootstrapStyles";
  styleEl.textContent = `
    #tyfitAuthBootstrapShield {
      position: fixed;
      inset: 0;
      z-index: 20000;
      background: linear-gradient(180deg, #f9fcff 0%, #f2f7ff 100%);
      pointer-events: all;
    }
  `;

  const mountShield = () => {
    if (document.getElementById("tyfitAuthBootstrapShield")) {
      return;
    }

    const shieldEl = document.createElement("div");
    shieldEl.id = "tyfitAuthBootstrapShield";
    shieldEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(shieldEl);
  };

  document.head.appendChild(styleEl);

  if (document.body) {
    mountShield();
  } else {
    document.addEventListener("DOMContentLoaded", mountShield, { once: true });
  }
}

function removeAuthBootstrapShield() {
  const shieldEl = document.getElementById("tyfitAuthBootstrapShield");
  if (shieldEl) {
    shieldEl.remove();
  }
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

function getLoginIllustrationHref() {
  return window.location.pathname.includes("/portal/")
    ? "../assets/tyfit_img/login_window_image.png"
    : "assets/tyfit_img/login_window_image.png";
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

function setConsentValidationState(consentWrap, errorEl, isValid) {
  if (consentWrap) {
    consentWrap.classList.toggle("is-invalid", !isValid);
  }

  if (errorEl) {
    errorEl.style.display = isValid ? "none" : "block";
  }
}

function resolveConsentContext(triggerEl) {
  const modalEl = document.getElementById("tyfitAuthModal");
  const triggerInsideModal = Boolean(triggerEl?.closest?.("#tyfitAuthModal"));
  const modalVisible = Boolean(modalEl && !modalEl.hidden);
  const preferModal = triggerInsideModal || (!triggerEl && modalVisible);

  if (preferModal) {
    return {
      checkbox: document.getElementById("tyfitAuthConsentCheckbox"),
      consentWrap: document.getElementById("tyfitAuthConsentWrap"),
      errorEl: document.getElementById("tyfitAuthConsentError")
    };
  }

  return {
    checkbox: document.getElementById("loginConsentCheckbox") || document.getElementById("tyfitAuthConsentCheckbox"),
    consentWrap: document.getElementById("loginConsentWrap") || document.getElementById("tyfitAuthConsentWrap"),
    errorEl: document.getElementById("loginConsentError") || document.getElementById("tyfitAuthConsentError")
  };
}

function bindConsentValidationHandlers() {
  const consentMappings = [
    {
      checkboxId: "loginConsentCheckbox",
      consentWrapId: "loginConsentWrap",
      errorId: "loginConsentError"
    },
    {
      checkboxId: "tyfitAuthConsentCheckbox",
      consentWrapId: "tyfitAuthConsentWrap",
      errorId: "tyfitAuthConsentError"
    }
  ];

  consentMappings.forEach((mapping) => {
    const checkbox = document.getElementById(mapping.checkboxId);

    if (!checkbox || checkbox.dataset.consentBound === "true") {
      return;
    }

    checkbox.dataset.consentBound = "true";
    checkbox.addEventListener("change", () => {
      const consentWrap = document.getElementById(mapping.consentWrapId);
      const errorEl = document.getElementById(mapping.errorId);
      setConsentValidationState(consentWrap, errorEl, checkbox.checked);
    });
  });
}

function ensureLegalModalStyles() {
  if (document.getElementById("tyfitLegalModalStyles")) {
    return;
  }

  const styleEl = document.createElement("style");
  styleEl.id = "tyfitLegalModalStyles";
  styleEl.textContent = `
    #tyfitLegalModal {
      position: fixed;
      inset: 0;
      z-index: 14000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    }

    #tyfitLegalModal[hidden] {
      display: none;
    }

    #tyfitLegalModal .tyfit-legal-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.62);
      border: 0;
      margin: 0;
      padding: 0;
      cursor: pointer;
    }

    #tyfitLegalModal .tyfit-legal-modal-dialog {
      position: relative;
      width: min(96vw, 980px);
      height: min(88vh, 860px);
      border-radius: 20px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 30px 100px rgba(15, 23, 42, 0.38);
      display: flex;
      flex-direction: column;
      z-index: 1;
    }

    #tyfitLegalModal .tyfit-legal-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid #e4e7ec;
      background: #ffffff;
      flex: 0 0 auto;
    }

    #tyfitLegalModal .tyfit-legal-modal-title {
      margin: 0;
      font-size: 18px;
      line-height: 1.3;
      color: #101828;
      font-weight: 700;
    }

    #tyfitLegalModal .tyfit-legal-modal-close {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      border: 1px solid #d0d5dd;
      background: #ffffff;
      color: #344054;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
      flex: 0 0 auto;
    }

    #tyfitLegalModal .tyfit-legal-modal-body {
      flex: 1 1 auto;
      min-height: 0;
      background: #f8fafc;
      overflow: auto;
      padding: 20px;
    }

    #tyfitLegalModal .tyfit-legal-modal-content {
      width: min(100%, 860px);
      margin: 0 auto;
      color: #1f2937;
      font-family: "Manrope", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.65;
    }

    #tyfitLegalModal .tyfit-legal-doc {
      display: grid;
      gap: 16px;
    }

    #tyfitLegalModal .tyfit-legal-doc article,
    #tyfitLegalModal .tyfit-legal-doc section {
      background: #ffffff;
      border: 1px solid #e4e7ec;
      border-radius: 16px;
      padding: 18px 16px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    }

    #tyfitLegalModal .tyfit-legal-doc h1,
    #tyfitLegalModal .tyfit-legal-doc h2,
    #tyfitLegalModal .tyfit-legal-doc h3,
    #tyfitLegalModal .tyfit-legal-doc h4 {
      color: #101828;
      margin: 0 0 10px;
      line-height: 1.3;
    }

    #tyfitLegalModal .tyfit-legal-doc p {
      margin: 0 0 10px;
      color: #475467;
    }

    #tyfitLegalModal .tyfit-legal-doc p:last-child {
      margin-bottom: 0;
    }

    #tyfitLegalModal .tyfit-legal-loading,
    #tyfitLegalModal .tyfit-legal-error {
      background: #ffffff;
      border: 1px solid #e4e7ec;
      border-radius: 14px;
      padding: 18px;
      color: #475467;
      font-size: 15px;
    }

    #tyfitLegalModal .tyfit-legal-error a {
      color: #1d4ed8;
      font-weight: 600;
      text-decoration: underline;
    }

    body.tyfit-legal-modal-open {
      overflow: hidden;
    }

    @media (max-width: 767px) {
      #tyfitLegalModal {
        padding: 0;
      }

      #tyfitLegalModal .tyfit-legal-modal-dialog {
        width: 100vw;
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 0;
      }

      #tyfitLegalModal .tyfit-legal-modal-header {
        padding: 12px 14px;
      }

      #tyfitLegalModal .tyfit-legal-modal-title {
        font-size: 16px;
      }

      #tyfitLegalModal .tyfit-legal-modal-body {
        padding: 14px 12px calc(14px + env(safe-area-inset-bottom));
      }

      #tyfitLegalModal .tyfit-legal-doc article,
      #tyfitLegalModal .tyfit-legal-doc section {
        border-radius: 12px;
        padding: 14px 12px;
      }
    }
  `;

  document.head.appendChild(styleEl);
}

function ensureLegalModal() {
  if (document.getElementById("tyfitLegalModal")) {
    return;
  }

  if (!document.body) {
    return;
  }

  ensureLegalModalStyles();

  const modalMarkup = `
    <div id="tyfitLegalModal" tabindex="-1" aria-hidden="true" hidden>
      <button type="button" class="tyfit-legal-modal-backdrop" data-legal-close aria-label="Close legal document"></button>
      <section class="tyfit-legal-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="tyfitLegalModalTitle">
        <header class="tyfit-legal-modal-header">
          <h2 class="tyfit-legal-modal-title" id="tyfitLegalModalTitle">Legal</h2>
          <button type="button" class="tyfit-legal-modal-close" data-legal-close aria-label="Close legal document">&times;</button>
        </header>
        <div class="tyfit-legal-modal-body">
          <div class="tyfit-legal-modal-content" id="tyfitLegalModalContent" aria-live="polite"></div>
        </div>
      </section>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalMarkup);

  const modalEl = document.getElementById("tyfitLegalModal");
  const closers = modalEl?.querySelectorAll("[data-legal-close]") || [];

  closers.forEach((closeEl) => {
    closeEl.addEventListener("click", closeLegalModal);
  });
}

function getLegalContentCache() {
  if (!window.tyfitLegalContentCache) {
    window.tyfitLegalContentCache = new Map();
  }

  return window.tyfitLegalContentCache;
}

function extractLegalBodyHtml(doc) {
  const root = doc.querySelector(".tyfit-main-inner") || doc.querySelector("main") || doc.body;

  if (!root) {
    return "";
  }

  const preferredBlocks = Array.from(root.querySelectorAll("article.tyfit-privacy-hero, section.tyfit-privacy-page-card"));
  const selectedBlocks = preferredBlocks.length > 0 ? preferredBlocks : Array.from(root.children).slice(0, 8);
  const container = document.createElement("div");

  selectedBlocks.forEach((node) => {
    container.appendChild(node.cloneNode(true));
  });

  container.querySelectorAll("script, style, nav, header, footer, .tyfit-mobile-bottom-nav, .tyfit-sidebar, .tyfit-desktop-topbar, .tyfit-mobile-topbar, .tyfit-toast, .back-to-top").forEach((el) => {
    el.remove();
  });

  return container.innerHTML.trim();
}

async function renderLegalContent(url) {
  const contentEl = document.getElementById("tyfitLegalModalContent");

  if (!contentEl) {
    return;
  }

  const cache = getLegalContentCache();
  contentEl.innerHTML = `<div class="tyfit-legal-loading">Loading legal content...</div>`;

  try {
    if (!cache.has(url)) {
      const response = await fetch(url, { credentials: "same-origin" });

      if (!response.ok) {
        throw new Error(`Could not load ${url}`);
      }

      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const legalHtml = extractLegalBodyHtml(parsed);

      if (!legalHtml) {
        throw new Error("No legal content found");
      }

      cache.set(url, legalHtml);
    }

    contentEl.innerHTML = `<div class="tyfit-legal-doc">${cache.get(url)}</div>`;
    const bodyEl = contentEl.closest(".tyfit-legal-modal-body");
    if (bodyEl) {
      bodyEl.scrollTop = 0;
    }
  } catch (error) {
    console.error("Legal modal load error:", error);
    contentEl.innerHTML = `<div class="tyfit-legal-error">We could not load this legal document inside the modal right now. <a href="${url}" target="_blank" rel="noopener noreferrer">Open it in a new page</a>.</div>`;
  }
}

function openLegalModal({ url, title }) {
  if (!url) {
    return;
  }

  ensureLegalModal();

  const modalEl = document.getElementById("tyfitLegalModal");
  const titleEl = document.getElementById("tyfitLegalModalTitle");
  const contentEl = document.getElementById("tyfitLegalModalContent");

  if (!modalEl || !contentEl) {
    window.location.href = url;
    return;
  }

  if (titleEl) {
    titleEl.textContent = title || "Legal";
  }

  modalEl.hidden = false;
  modalEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("tyfit-legal-modal-open");

  const authModal = document.getElementById("tyfitAuthModal");
  if (authModal) {
    authModal.dataset.legalOpen = "true";
  }

  void renderLegalContent(url);
}

function closeLegalModal() {
  const modalEl = document.getElementById("tyfitLegalModal");
  const contentEl = document.getElementById("tyfitLegalModalContent");
  const authModal = document.getElementById("tyfitAuthModal");

  document.body.classList.remove("tyfit-legal-modal-open");

  if (!modalEl) {
    return;
  }

  modalEl.hidden = true;
  modalEl.setAttribute("aria-hidden", "true");

  if (contentEl) {
    contentEl.innerHTML = "";
  }

  if (authModal) {
    authModal.dataset.legalOpen = "false";
  }
}

function bindLegalModalTriggers() {
  if (document.body?.dataset.legalModalBound === "true") {
    return;
  }

  if (document.body) {
    document.body.dataset.legalModalBound = "true";
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-legal-modal]");

    if (!link) {
      return;
    }

    event.preventDefault();
    const url = link.getAttribute("data-legal-modal") || link.getAttribute("href") || "";
    const title = link.getAttribute("data-legal-title") || link.textContent?.trim() || "Legal";
    openLegalModal({ url, title });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const modalEl = document.getElementById("tyfitLegalModal");
    if (!modalEl || modalEl.hidden) {
      return;
    }

    event.preventDefault();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    } else {
      event.stopPropagation();
    }

    closeLegalModal();
  });
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

function resolveMobileProfileAvatar(accessState) {
  const defaultAvatar = "/assets/avatars/avatar-1.svg";
  const desktopAvatar = document.getElementById("desktopProfileAvatar");

  if (accessState?.isLoggedIn) {
    const profilePicture = accessState?.profile?.profile_picture_url;
    if (profilePicture && /^https?:\/\//i.test(profilePicture)) {
      return profilePicture;
    }

    if (window.tyfitProfile?.resolveProfileImage && accessState?.profile) {
      const resolved = window.tyfitProfile.resolveProfileImage(accessState.profile);
      if (resolved) {
        return resolved;
      }
    }
  }

  if (desktopAvatar?.src) {
    return desktopAvatar.src;
  }

  return defaultAvatar;
}

function updateMobileBottomNav(accessState) {
  const nav = document.querySelector(".tyfit-mobile-bottom-nav");
  if (!nav) {
    return;
  }

  const links = Array.from(nav.querySelectorAll("a"));
  links.forEach((link) => {
    const label = link.querySelector("span")?.textContent?.trim().toLowerCase();
    const iconEl = link.querySelector("i[data-lucide], svg[data-lucide], [data-lucide]");

    if (label === "diet chart" && iconEl) {
      iconEl.setAttribute("data-lucide", "salad");
    }

    if (label === "training" && iconEl) {
      iconEl.setAttribute("data-lucide", "dumbbell");
    }

    if (label === "profile") {
      link.classList.add("tyfit-mobile-profile-link");

      const existingIcon = link.querySelector("i[data-lucide], svg, [data-lucide]");
      if (existingIcon) {
        existingIcon.remove();
      }

      let avatarImg = link.querySelector("img.tyfit-mobile-profile-avatar");
      if (!avatarImg) {
        avatarImg = document.createElement("img");
        avatarImg.className = "tyfit-mobile-profile-avatar";
        avatarImg.alt = "Profile";
        avatarImg.loading = "lazy";
        link.prepend(avatarImg);
      }

      avatarImg.src = resolveMobileProfileAvatar(accessState);
    }
  });

  if (typeof window.tyfitRefreshIcons === "function") {
    window.tyfitRefreshIcons();
  } else if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function ensureMobileDrawerLogout(accessState) {
  const drawerEl = document.getElementById("mobileDrawer");
  const sidebarInnerEl = drawerEl?.querySelector(".sidebar-inner");

  if (!sidebarInnerEl) {
    return;
  }

  const existingFooter = sidebarInnerEl.querySelector(".tyfit-mobile-drawer-logout-wrap");

  if (!accessState?.isLoggedIn) {
    if (existingFooter) {
      existingFooter.remove();
    }
    return;
  }

  if (existingFooter) {
    return;
  }

  const footerEl = document.createElement("div");
  footerEl.className = "sidebar-footer tyfit-mobile-drawer-logout-wrap";
  footerEl.innerHTML = `
    <button type="button" class="sidebar-logout tyfit-mobile-drawer-logout" data-action="logout" aria-label="Logout">
      <i data-lucide="log-out"></i>
      <span>Logout</span>
    </button>
  `;

  sidebarInnerEl.appendChild(footerEl);
}

function applyCollapsedSidebarTooltips() {
  document.querySelectorAll(".tyfit-sidebar .sidebar-nav-item").forEach((item) => {
    const label = item.querySelector("span")?.textContent?.trim();
    if (!label) {
      return;
    }

    item.setAttribute("data-tooltip", label);
    item.setAttribute("data-tool-tip", label);
    item.setAttribute("title", label);
    item.setAttribute("aria-label", label);
  });
}

function updateTopbarGuestState(accessState) {
  const isLoggedIn = Boolean(accessState?.isLoggedIn);
  const desktopNotifBtn = document.getElementById("desktopNotifBtn");
  const mobileNotifBtn = document.getElementById("mobileNotifBtn");
  const desktopAccountBtn = document.getElementById("desktopAccountBtn");
  const desktopAccountMenu = document.getElementById("desktopAccountMenu");
  const desktopAvatar = document.getElementById("desktopProfileAvatar");
  const desktopName = document.getElementById("desktopProfileName");

  if (desktopNotifBtn) {
    desktopNotifBtn.style.display = isLoggedIn ? "" : "none";
  }

  if (mobileNotifBtn) {
    mobileNotifBtn.style.display = isLoggedIn ? "" : "none";
  }

  if (!desktopAccountBtn) {
    return;
  }

  desktopAccountBtn.classList.toggle("tyfit-account-btn--guest", !isLoggedIn);

  if (!isLoggedIn) {
    if (desktopAvatar) {
      desktopAvatar.style.display = "none";
    }

    const chevronIcon = desktopAccountBtn.querySelector("svg");
    if (chevronIcon) {
      chevronIcon.style.display = "none";
    }

    if (desktopName) {
      desktopName.textContent = "Login";
    }

    desktopAccountBtn.setAttribute("aria-label", "Login");

    if (desktopAccountMenu) {
      desktopAccountMenu.classList.remove("is-open");
      desktopAccountMenu.setAttribute("aria-hidden", "true");
      desktopAccountMenu.style.display = "none";
    }

    return;
  }

  if (desktopAvatar) {
    desktopAvatar.style.display = "";
  }

  const chevronIcon = desktopAccountBtn.querySelector("svg");
  if (chevronIcon) {
    chevronIcon.style.display = "";
  }

  desktopAccountBtn.setAttribute("aria-label", "Account menu");

  if (desktopAccountMenu) {
    desktopAccountMenu.style.display = "";
  }
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
      padding: 0;
    }

    #tyfitAuthModal .tyfit-auth-modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.38);
      backdrop-filter: blur(10px);
    }

    #tyfitAuthModal .tyfit-auth-modal-dialog {
      position: relative;
      z-index: 1;
      width: min(100%, 520px);
    }

    #tyfitAuthModal .tyfit-auth-modal-content {
      background: transparent;
      border-radius: 0;
      overflow: hidden;
      box-shadow: none;
    }

    #tyfitAuthModal .tyfit-auth-modal-header {
      display: none;
    }

    #tyfitAuthModal .tyfit-auth-modal-body {
      padding: 0;
    }

    #tyfitAuthModal .tyfit-login-screen {
      width: 100%;
      min-height: 100dvh;
      background:
        radial-gradient(circle at 50% 35%, rgba(108, 99, 255, 0.13), transparent 50%),
        radial-gradient(circle at 18% 82%, rgba(91, 155, 255, 0.11), transparent 46%),
        linear-gradient(180deg, #f7fbff 0%, #edf4ff 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 22px calc(28px + env(safe-area-inset-bottom));
      box-sizing: border-box;
      overflow-y: auto;
    }

    #tyfitAuthModal .tyfit-login-content {
      width: 100%;
      max-width: 430px;
      margin: 0 auto;
      text-align: center;
      color: #101828;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    #tyfitAuthModal .tyfit-login-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      margin-bottom: 34px;
    }

    #tyfitAuthModal .tyfit-login-logo-icon {
      width: 86px;
      height: auto;
      object-fit: contain;
    }

    #tyfitAuthModal .tyfit-login-wordmark {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0.34em;
      color: #111111;
      margin-left: 0.34em;
    }

    #tyfitAuthModal .tyfit-login-copy h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.12;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: #101828;
    }

    #tyfitAuthModal .tyfit-login-copy p {
      margin: 16px 0 0;
      font-size: 20px;
      line-height: 1.45;
      color: #667085;
      font-weight: 450;
      max-width: 360px;
    }

    #tyfitAuthModal .tyfit-login-visual-wrap {
      margin: 34px auto 28px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    #tyfitAuthModal .tyfit-login-visual {
      width: min(330px, 86vw);
      height: auto;
      display: block;
      object-fit: contain;
    }

    #tyfitAuthModal .tyfit-google-login-btn {
      width: 100%;
      height: 78px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      padding: 0 22px;
      border: 0;
      border-radius: 16px;
      background: linear-gradient(135deg, #111827 0%, #020617 100%);
      color: #ffffff;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.02em;
      cursor: pointer;
      box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
    }

    #tyfitAuthModal .tyfit-google-icon-wrap {
      width: 46px;
      height: 46px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      flex: 0 0 auto;
    }

    #tyfitAuthModal .tyfit-google-icon-wrap svg {
      width: 26px;
      height: 26px;
    }

    #tyfitAuthModal .tyfit-login-consent {
      margin-top: 16px;
      text-align: left;
    }

    #tyfitAuthModal .tyfit-login-consent-label {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #475467;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
      cursor: pointer;
    }

    #tyfitAuthModal .tyfit-login-consent-checkbox {
      margin-top: 3px;
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
    }

    #tyfitAuthModal .tyfit-login-consent-link {
      color: #1d4ed8;
      font-weight: 600;
      text-decoration: underline;
    }

    #tyfitAuthModal .tyfit-consent-error {
      margin: 8px 0 0;
      color: #b42318;
      font-size: 13px;
      line-height: 1.4;
      display: none;
    }

    #tyfitAuthModal .tyfit-login-consent.is-invalid .tyfit-consent-error {
      display: block;
    }

    #tyfitAuthModal .tyfit-login-trust {
      margin-top: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: #667085;
      font-size: 16px;
      font-weight: 500;
    }

    #tyfitAuthModal .tyfit-login-trust svg {
      width: 20px;
      height: 20px;
      color: #6c63ff;
      stroke-width: 2.2;
      flex: 0 0 auto;
    }

    body.tyfit-auth-modal-open,
    body.tyfit-auth-locked {
      overflow: hidden;
    }

    body.tyfit-auth-locked > *:not(#tyfitAuthModal):not(#tyfitLegalModal) {
      pointer-events: none;
      user-select: none;
    }

    body.tyfit-auth-locked #tyfitAuthModal,
    body.tyfit-auth-locked #tyfitAuthModal *,
    body.tyfit-auth-locked #tyfitLegalModal,
    body.tyfit-auth-locked #tyfitLegalModal * {
      pointer-events: auto;
      user-select: auto;
    }

    @media (max-width: 430px) {
      #tyfitAuthModal .tyfit-login-screen {
        padding: 26px 26px calc(28px + env(safe-area-inset-bottom));
      }

      #tyfitAuthModal .tyfit-login-brand {
        margin-bottom: 30px;
      }

      #tyfitAuthModal .tyfit-login-logo-icon {
        width: 78px;
      }

      #tyfitAuthModal .tyfit-login-wordmark {
        font-size: 25px;
      }

      #tyfitAuthModal .tyfit-login-copy h1 {
        font-size: 25px;
      }

      #tyfitAuthModal .tyfit-login-copy p {
        font-size: 15px;
      }

      #tyfitAuthModal .tyfit-login-visual-wrap {
        margin: 30px auto 24px;
      }

      #tyfitAuthModal .tyfit-login-visual {
        width: min(250px, 84vw);
      }

      #tyfitAuthModal .tyfit-google-login-btn {
        height: 70px;
        font-size: 21px;
        border-radius: 15px;
      }

      #tyfitAuthModal .tyfit-google-icon-wrap {
        width: 42px;
        height: 42px;
      }

      #tyfitAuthModal .tyfit-login-consent-label {
        font-size: 13px;
      }

    }

    @media (max-height: 760px) {
      #tyfitAuthModal .tyfit-login-brand {
        margin-bottom: 22px;
      }

      #tyfitAuthModal .tyfit-login-visual-wrap {
        margin: 22px auto 18px;
      }

      #tyfitAuthModal .tyfit-login-visual {
        width: min(280px, 78vw);
      }
    }

    @media (min-width: 768px) {
      #tyfitAuthModal {
        padding: 24px;
        align-items: center;
        justify-content: center;
      }

      #tyfitAuthModal .tyfit-auth-modal-dialog {
        width: min(100%, 440px);
      }

      #tyfitAuthModal .tyfit-auth-modal-content {
        border-radius: 28px;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);
      }

      #tyfitAuthModal .tyfit-login-screen {
        min-height: auto;
        border-radius: 28px;
        padding: 36px 32px 32px;
        background:
          radial-gradient(circle at 52% 28%, rgba(108, 99, 255, 0.12), transparent 54%),
          radial-gradient(circle at 14% 86%, rgba(91, 155, 255, 0.09), transparent 44%),
          linear-gradient(180deg, #f8fcff 0%, #eff5ff 100%);
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.24);
      }

      #tyfitAuthModal .tyfit-login-content {
        max-width: 360px;
      }

      #tyfitAuthModal .tyfit-login-brand {
        gap: 10px;
        margin-bottom: 20px;
      }

      #tyfitAuthModal .tyfit-login-logo-icon {
        width: 64px;
      }

      #tyfitAuthModal .tyfit-login-wordmark {
        font-size: 20px;
        letter-spacing: 0.22em;
        margin-left: 0.22em;
      }

      #tyfitAuthModal .tyfit-login-copy h1 {
        font-size: 28px;
      }

      #tyfitAuthModal .tyfit-login-copy p {
        margin-top: 12px;
        font-size: 16px;
      }

      #tyfitAuthModal .tyfit-login-visual-wrap,
      #tyfitAuthModal .tyfit-login-trust,
      #tyfitAuthModal .tyfit-login-copy p {
        display: none;
      }

      #tyfitAuthModal .tyfit-google-login-btn {
        margin-top: 24px;
        height: 56px;
        font-size: 16px;
        gap: 12px;
        border-radius: 16px;
        box-shadow: none;
      }

      #tyfitAuthModal .tyfit-google-icon-wrap {
        width: 34px;
        height: 34px;
      }

      #tyfitAuthModal .tyfit-google-icon-wrap svg {
        width: 20px;
        height: 20px;
      }

      #tyfitAuthModal .tyfit-login-consent {
        margin-top: 12px;
      }

      #tyfitAuthModal .tyfit-login-consent-label {
        font-size: 12px;
      }
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
          </div>
          <div class="modal-body tyfit-auth-modal-body">
            <div class="tyfit-login-screen">
              <div class="tyfit-login-content">
                <div class="tyfit-login-brand">
                  <img src="${getBlackLogoHref()}" alt="TYFIT" class="tyfit-login-logo-icon" id="tyfitAuthLogo">
                  <div class="tyfit-login-wordmark">TYFIT</div>
                </div>
                <div class="tyfit-login-copy">
                  <h1 id="tyfitAuthTitle">Welcome back!</h1>
                  <p>Sign in to continue your fitness journey</p>
                </div>
                <div class="tyfit-login-visual-wrap">
                  <img src="${getLoginIllustrationHref()}" alt="" class="tyfit-login-visual">
                </div>
                <button type="button" class="tyfit-google-login-btn" id="tyfitAuthGoogleBtn">
                  <span class="tyfit-google-icon-wrap" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.805 12.23c0-.68-.06-1.333-.173-1.96H12v3.708h5.498a4.706 4.706 0 0 1-2.04 3.087v2.564h3.305c1.935-1.782 3.042-4.407 3.042-7.399Z" fill="#4285F4"/>
                      <path d="M12 22c2.76 0 5.077-.915 6.77-2.47l-3.305-2.564c-.916.614-2.087.977-3.465.977-2.654 0-4.903-1.792-5.707-4.202H2.877v2.645A9.998 9.998 0 0 0 12 22Z" fill="#34A853"/>
                      <path d="M6.293 13.741A5.997 5.997 0 0 1 5.974 12c0-.605.109-1.193.319-1.741V7.614H2.877A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.07 4.386l3.223-2.645Z" fill="#FBBC04"/>
                      <path d="M12 6.057c1.5 0 2.848.516 3.91 1.529l2.932-2.932C17.072 2.997 14.755 2 12 2a9.998 9.998 0 0 0-9.123 5.614l3.416 2.645C7.097 7.849 9.346 6.057 12 6.057Z" fill="#EA4335"/>
                    </svg>
                  </span>
                  <span>Continue with Google</span>
                </button>
                <div class="tyfit-login-consent" data-auth-consent-scope="modal" id="tyfitAuthConsentWrap">
                  <label class="tyfit-login-consent-label" for="tyfitAuthConsentCheckbox">
                    <input type="checkbox" class="tyfit-login-consent-checkbox" id="tyfitAuthConsentCheckbox" data-auth-consent-checkbox>
                    <span>I agree to Tyfit's <a href="terms.html" class="tyfit-login-consent-link" data-legal-modal="terms.html" data-legal-title="Terms of Use">Terms of Use</a> and <a href="privacy-policy.html" class="tyfit-login-consent-link" data-legal-modal="privacy-policy.html" data-legal-title="Privacy Policy">Privacy Policy</a>.</span>
                  </label>
                  <p class="tyfit-consent-error" id="tyfitAuthConsentError" role="alert" aria-live="polite">Please accept the Terms and Privacy Policy to continue.</p>
                </div>
                <div class="tyfit-login-trust">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span>Secure, private and easy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalMarkup);

  const googleBtn = document.getElementById("tyfitAuthGoogleBtn");
  const modalEl = document.getElementById("tyfitAuthModal");
  const backdrop = modalEl?.querySelector(".tyfit-auth-modal-backdrop");

  if (googleBtn) {
    googleBtn.addEventListener("click", googleLogin);
  }

  bindConsentValidationHandlers();

  const requestClose = () => {
    if (modalEl?.dataset.locked === "true" || modalEl?.dataset.legalOpen === "true") {
      return;
    }
    closeAuthModal();
  };

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
      if (!activeModal || activeModal.hidden || activeModal.dataset.locked === "true" || activeModal.dataset.legalOpen === "true") {
        return;
      }

      closeAuthModal();
    });
  }
}

function openAuthModal(options = {}) {
  ensureAuthModal();

  const modalEl = document.getElementById("tyfitAuthModal");
  const logoEl = document.getElementById("tyfitAuthLogo");
  const locked = options.locked !== false;

  if (!modalEl) {
    return;
  }

  if (logoEl) {
    logoEl.src = getBlackLogoHref();
  }

  // Ensure no close button ever exists in the auth modal
  const existingClose = modalEl.querySelector(".tyfit-auth-close");
  if (existingClose) {
    existingClose.remove();
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
  const desktopAccountBtn = document.getElementById("desktopAccountBtn");

  bindGlobalLogoutActions();
  bindConsentValidationHandlers();
  bindLegalModalTriggers();

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

  if (desktopAccountBtn && desktopAccountBtn.dataset.authBound !== "true") {
    desktopAccountBtn.dataset.authBound = "true";
    desktopAccountBtn.addEventListener("click", async (event) => {
      const accessState = await getAccessState();
      if (accessState?.isLoggedIn) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
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
  ensureMobileDrawerLogout(accessState);
  updateMobileBottomNav(accessState);
  applyCollapsedSidebarTooltips();
  updateTopbarGuestState(accessState);
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

  const triggerEl = event?.currentTarget instanceof Element ? event.currentTarget : null;
  const { checkbox, consentWrap, errorEl } = resolveConsentContext(triggerEl);

  if (checkbox && !checkbox.checked) {
    setConsentValidationState(consentWrap, errorEl, false);
    checkbox.focus();
    return;
  }

  setConsentValidationState(consentWrap, errorEl, true);

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

  // Stop session keep-alive when user logs out
  if (typeof stopSessionKeepAlive === 'function') {
    stopSessionKeepAlive();
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
  openAuthModal({ locked: true });

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

ensureAuthBootstrapShield();

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
    if (!session && shouldRequireAuthOnCurrentPage()) {
      openAuthModal({ locked: true });
    }
    removeAuthBootstrapShield();
  } catch (err) {
    console.error("Unhandled auth init error:", err);
    await safeDialogAlert({
      title: "Authentication Error",
      message: "Unexpected auth init error: " + err.message
    });
    removeAuthBootstrapShield();
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