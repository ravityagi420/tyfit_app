async function googleLogin() {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo") || "/index.html";

  sessionStorage.setItem("postLoginRedirect", returnTo);

  const { error } = await window.supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/index.html"
    }
  });

  if (error) {
    alert("Google login error: " + error.message);
    console.error(error);
  }
}

async function signup() {
  const name = document.getElementById("name")?.value?.trim();
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;

  const { error } = await window.supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      }
    }
  });

  if (error) {
    alert(error.message);
    console.error(error);
  } else {
    alert("Signup successful. Please login.");
  }
}

async function login() {
  const email = document.getElementById("email")?.value?.trim();
  const password = document.getElementById("password")?.value;

  const { error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    console.error(error);
  } else {
    window.location.href = "index.html";
  }
}

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

async function showUser() {
  const {
    data: { session }
  } = await window.supabaseClient.auth.getSession();

  const el = document.getElementById("welcomeText");
  if (!el) return;

  if (session && session.user) {
    const user = session.user;
    const meta = user.user_metadata || {};
    const name =
      meta.full_name ||
      meta.name ||
      user.email?.split("@")[0] ||
      "User";

    el.innerText = "Welcome " + name;
  } else {
    el.innerText = "Welcome Guest";
  }
}

async function logout() {
  const { error } = await window.supabaseClient.auth.signOut();

  if (error) {
    alert(error.message);
    console.error(error);
    return;
  }

  window.location.href = "login.html";
}

function toggleAuthButtons(isLoggedIn) {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (loginBtn) loginBtn.style.display = isLoggedIn ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-block" : "none";
}

window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log("Auth event:", event, session);

  if (event === "SIGNED_IN" && session) {
    await ensureProfile(session);
    await showUser();
    toggleAuthButtons(true);
  }

  if (event === "SIGNED_OUT") {
    toggleAuthButtons(false);
    const el = document.getElementById("welcomeText");
    if (el) el.innerText = "Welcome Guest";
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    console.log("Path:", window.location.pathname);
    console.log("Search:", window.location.search);
    console.log("Code present:", !!code);

    // 1) Explicitly exchange PKCE code for a session
    if (code) {
      const { data, error } = await window.supabaseClient.auth.exchangeCodeForSession(code);
      console.log("exchangeCodeForSession:", data);

      if (error) {
        console.error("Code exchange failed:", error);
        alert("Code exchange failed: " + error.message);
        return;
      }

      // 2) Remove ?code=... from URL after success
      url.searchParams.delete("code");
      window.history.replaceState({}, document.title, url.pathname);
    }

    // 3) Now read session
    const {
      data: { session },
      error
    } = await window.supabaseClient.auth.getSession();

    console.log("Session after exchange:", session);

    if (error) {
      console.error("Session error:", error);
      alert("Session error: " + error.message);
      return;
    }

    if (!session) {
      toggleAuthButtons(false);
      await showUser();
      return;
    }

    await ensureProfile(session);
    await showUser();
    toggleAuthButtons(true);

    const redirectPath = sessionStorage.getItem("postLoginRedirect");
    if (
      redirectPath &&
      redirectPath !== window.location.pathname &&
      window.location.pathname === "/index.html"
    ) {
      sessionStorage.removeItem("postLoginRedirect");
      window.location.href = redirectPath;
      return;
    }
  } catch (err) {
    console.error("Unhandled auth init error:", err);
    alert("Unexpected auth init error: " + err.message);
  }
});