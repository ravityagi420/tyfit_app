const supabaseStorage = {
  getItem(key) {
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
  }
};

window.supabaseClient = supabase.createClient(
  "https://miqghbmmnmmqyegctnzy.supabase.co",
  "sb_publishable_g_9cULdcHU2dic-CwoinGg_kKXHmqVw",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "tyfit-auth",
      storage: supabaseStorage,
      expiresIn: 30 * 24 * 60 * 60 // 30 days in seconds
    }
  }
);

// Session keep-alive mechanism - refresh token every 20 minutes to maintain 30-day sessions
let sessionRefreshInterval = null;

async function startSessionKeepAlive() {
  if (sessionRefreshInterval) {
    clearInterval(sessionRefreshInterval);
  }

  // Refresh session every 20 minutes (1200000 ms) to keep it alive
  sessionRefreshInterval = setInterval(async () => {
    try {
      const { data: { session }, error } = await window.supabaseClient.auth.refreshSession();
      
      if (session) {
        console.log('[Tyfit Auth] Session refreshed successfully at', new Date().toISOString());
      } else if (error) {
        console.warn('[Tyfit Auth] Session refresh warning:', error.message);
      }
    } catch (err) {
      console.error('[Tyfit Auth] Session refresh error:', err);
    }
  }, 20 * 60 * 1000); // 20 minutes
}

function stopSessionKeepAlive() {
  if (sessionRefreshInterval) {
    clearInterval(sessionRefreshInterval);
    sessionRefreshInterval = null;
  }
}

// Initialize session listeners
window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    startSessionKeepAlive();
  } else if (event === 'SIGNED_OUT') {
    stopSessionKeepAlive();
  }
});