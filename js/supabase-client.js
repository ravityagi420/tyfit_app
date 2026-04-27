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
      storage: supabaseStorage
    }
  }
);