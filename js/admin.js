let allUsers = [];
let filteredUsers = [];
let selectedUserId = null;
let selectedCoachingPlanId = null;

// ------------------------------
// Helpers
// ------------------------------
function getEl(id) {
  return document.getElementById(id);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setInputValue(id, value) {
  const el = getEl(id);
  if (el) el.value = value ?? "";
}

function getInputValue(id) {
  const el = getEl(id);
  return el ? el.value.trim() : "";
}

function parseNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function showStatusMessage(message, type = "success") {
  const el = getEl("statusMessage");
  if (!el) return;

  el.textContent = message;
  el.className = `alert alert-${type} mt-3`;
  el.style.display = "block";
}

function hideStatusMessage() {
  const el = getEl("statusMessage");
  if (!el) return;

  el.style.display = "none";
  el.textContent = "";
  el.className = "";
}

function showAlert(message) {
  alert(message);
}

function showPlaceholder() {
  const placeholder = getEl("formPlaceholder");
  const form = getEl("profileForm");

  if (placeholder) placeholder.style.display = "block";
  if (form) form.style.display = "none";
}

function showForm() {
  const placeholder = getEl("formPlaceholder");
  const form = getEl("profileForm");

  if (placeholder) placeholder.style.display = "none";
  if (form) form.style.display = "block";
}

function clearForm() {
  setInputValue("full_name", "");
  setInputValue("date_of_birth", "");
  setInputValue("gender", "");
  setInputValue("weight", "");
  setInputValue("height", "");
  setInputValue("bmr", "");
  setInputValue("tdee", "");
  setInputValue("goal", "");
  setInputValue("activity_level", "");
  setInputValue("start_date", "");
  setInputValue("end_date", "");
}

function highlightSelectedUser(userId) {
  document.querySelectorAll("#userList .list-group-item").forEach(item => {
    item.classList.remove("active");
  });

  const activeItem = document.querySelector(`#userList .list-group-item[data-user-id="${userId}"]`);
  if (activeItem) activeItem.classList.add("active");
}

// ------------------------------
// BMR / TDEE Calculation
// ------------------------------
function calculateAgeFromDOB(dateOfBirth) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();

  const monthDiff = today.getMonth() - dob.getMonth();
  const dayDiff = today.getDate() - dob.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age >= 0 ? age : null;
}

function getActivityMultiplier(activityLevel) {
  const map = {
    "Sedentary": 1.2,
    "Light": 1.375,
    "Moderate": 1.55,
    "Active": 1.725,
    "Very Active": 1.9,
    "Extra Active": 2.0
  };

  return map[activityLevel] || null;
}

function calculateBmr(weight, height, age, gender) {
  if (
    weight === null ||
    height === null ||
    age === null ||
    !gender
  ) {
    return null;
  }

  const normalizedGender = gender.toLowerCase();

  if (normalizedGender === "male") {
    return Math.round((10 * weight) + (6.25 * height) - (5 * age) + 5);
  }

  if (normalizedGender === "female") {
    return Math.round((10 * weight) + (6.25 * height) - (5 * age) - 161);
  }

  return null;
}

function calculateBmrAndTdee() {
  const dateOfBirth = getInputValue("date_of_birth");
  const gender = getInputValue("gender");
  const weight = parseNumberOrNull(getInputValue("weight"));
  const height = parseNumberOrNull(getInputValue("height"));
  const activityLevel = getInputValue("activity_level");

  const age = calculateAgeFromDOB(dateOfBirth);
  const activityMultiplier = getActivityMultiplier(activityLevel);
  const bmr = calculateBmr(weight, height, age, gender);

  if (
    age === null ||
    gender === null ||
    gender === "" ||
    weight === null ||
    height === null ||
    !activityLevel ||
    activityMultiplier === null ||
    bmr === null
  ) {
    return {
      age,
      bmr: null,
      tdee: null
    };
  }

  const tdee = Math.round(bmr * activityMultiplier);

  return {
    age,
    bmr,
    tdee
  };
}

function updateCalculatedFieldsInForm() {
  const { bmr, tdee } = calculateBmrAndTdee();

  setInputValue("bmr", bmr ?? "");
  setInputValue("tdee", tdee ?? "");

  return { bmr, tdee };
}

// ------------------------------
// Session / Auth
// ------------------------------
async function waitForStableSession(timeoutMs = 4000, intervalMs = 250) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { data, error } = await window.supabaseClient.auth.getSession();

    if (error) {
      console.error("Session check error:", error);
      return { session: null, error };
    }

    if (data?.session) {
      return { session: data.session, error: null };
    }

    await sleep(intervalMs);
  }

  return { session: null, error: null };
}

async function requireLoginOrRedirect() {
  const { session, error } = await waitForStableSession();

  console.log("Admin session:", session);
  console.log("Admin origin:", window.location.origin);
  console.log("Admin path:", window.location.pathname);

  if (error) {
    showAlert("Session error: " + error.message);
    window.location.href = "../login.html?returnTo=/admin/index.html";
    return null;
  }

  if (!session) {
    showAlert("No active session found. Please log in again.");
    window.location.href = "../login.html?returnTo=/admin/index.html";
    return null;
  }

  return session.user;
}

// ------------------------------
// Data Fetching
// ------------------------------
async function fetchUsers() {
  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("id, email, full_name")
    .order("email", { ascending: true });

  if (error) {
    console.error("fetchUsers error:", error);
    showAlert("Failed to fetch users: " + error.message);
    return [];
  }

  return data || [];
}

async function fetchProfile(userId) {
  const { data, error } = await window.supabaseClient
    .from("profiles")
    .select("id, email, full_name, date_of_birth, gender, weight, height, goal, activity_level")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("fetchProfile error:", error);
    throw error;
  }

  return data;
}

async function fetchLatestCoachingPlan(userId) {
  const { data, error } = await window.supabaseClient
    .from("coaching_plans")
    .select("id, user_id, bmr, tdee, start_date, end_date, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("fetchLatestCoachingPlan error:", error);
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}

// ------------------------------
// Rendering
// ------------------------------
function renderUserList(users) {
  const userList = getEl("userList");
  const emptyState = getEl("emptyState");

  if (!userList) return;

  userList.innerHTML = "";

  if (!users || users.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  users.forEach(user => {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "list-group-item list-group-item-action";
    item.dataset.userId = user.id;
    item.textContent = user.email + (user.full_name ? ` (${user.full_name})` : "");

    item.addEventListener("click", async (e) => {
      e.preventDefault();
      await selectUser(user.id);
    });

    userList.appendChild(item);
  });
}

function filterUsers(query) {
  const q = query.toLowerCase().trim();

  filteredUsers = allUsers.filter(user => {
    const email = (user.email || "").toLowerCase();
    const fullName = (user.full_name || "").toLowerCase();
    return email.includes(q) || fullName.includes(q);
  });

  renderUserList(filteredUsers);

  if (selectedUserId) {
    highlightSelectedUser(selectedUserId);
  }
}

// ------------------------------
// User Selection
// ------------------------------
async function selectUser(userId) {
  hideStatusMessage();
  selectedUserId = userId;
  selectedCoachingPlanId = null;

  try {
    const profile = await fetchProfile(userId);
    const coachingPlan = await fetchLatestCoachingPlan(userId);

    setInputValue("full_name", profile?.full_name || "");
    setInputValue("date_of_birth", profile?.date_of_birth || "");
    setInputValue("gender", profile?.gender || "Male");
    setInputValue("weight", profile?.weight ?? "");
    setInputValue("height", profile?.height ?? "");
    setInputValue("goal", profile?.goal || "");
    setInputValue("activity_level", profile?.activity_level || "");

    setInputValue("bmr", coachingPlan?.bmr ?? "");
    setInputValue("tdee", coachingPlan?.tdee ?? "");
    setInputValue("start_date", coachingPlan?.start_date || "");
    setInputValue("end_date", coachingPlan?.end_date || "");

    selectedCoachingPlanId = coachingPlan?.id || null;

    highlightSelectedUser(userId);
    showForm();
  } catch (error) {
    console.error("selectUser error:", error);
    showStatusMessage("Failed to load user details.", "danger");
    showAlert("Failed to load user details: " + error.message);
  }
}

// ------------------------------
// Save
// ------------------------------
async function saveProfileAndPlan() {
  hideStatusMessage();

  if (!selectedUserId) {
    showStatusMessage("Please select a user first.", "warning");
    showAlert("Please select a user first.");
    return;
  }

  const saveBtn = getEl("saveProfileBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    // Calculate BMR/TDEE from current form inputs
    const { bmr, tdee } = updateCalculatedFieldsInForm();

    const profilePayload = {
      full_name: getInputValue("full_name") || null,
      date_of_birth: getInputValue("date_of_birth") || null,
      gender: getInputValue("gender") || null,
      weight: parseNumberOrNull(getInputValue("weight")),
      height: parseNumberOrNull(getInputValue("height")),
      goal: getInputValue("goal") || null,
      activity_level: getInputValue("activity_level") || null,
      updated_at: new Date().toISOString()
    };

    const { error: profileError } = await window.supabaseClient
      .from("profiles")
      .update(profilePayload)
      .eq("id", selectedUserId);

    if (profileError) {
      console.error("profile update error:", profileError);
      throw new Error("Profile save failed: " + profileError.message);
    }

    const coachingPayload = {
      user_id: selectedUserId,
      bmr: bmr,
      tdee: tdee,
      start_date: getInputValue("start_date") || null,
      end_date: getInputValue("end_date") || null,
      updated_at: new Date().toISOString()
    };

    if (selectedCoachingPlanId) {
      const { error: planError } = await window.supabaseClient
        .from("coaching_plans")
        .update(coachingPayload)
        .eq("id", selectedCoachingPlanId);

      if (planError) {
        console.error("coaching plan update error:", planError);
        throw new Error("Coaching plan update failed: " + planError.message);
      }
    } else {
      const { data: insertedPlan, error: insertError } = await window.supabaseClient
        .from("coaching_plans")
        .insert({
          ...coachingPayload,
          created_at: new Date().toISOString()
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("coaching plan insert error:", insertError);
        throw new Error("Coaching plan insert failed: " + insertError.message);
      }

      selectedCoachingPlanId = insertedPlan?.id || null;
    }

    allUsers = await fetchUsers();
    filteredUsers = [...allUsers];
    renderUserList(filteredUsers);
    highlightSelectedUser(selectedUserId);

    showStatusMessage("Profile saved successfully.", "success");
  } catch (error) {
    console.error("saveProfileAndPlan error:", error);
    showStatusMessage(error.message || "Save failed.", "danger");
    showAlert(error.message || "Save failed.");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
    }
  }
}

// ------------------------------
// Reset
// ------------------------------
function resetSelectedForm() {
  hideStatusMessage();
  selectedUserId = null;
  selectedCoachingPlanId = null;

  clearForm();

  document.querySelectorAll("#userList .list-group-item").forEach(item => {
    item.classList.remove("active");
  });

  showPlaceholder();
}

// ------------------------------
// Init
// ------------------------------
async function initAdminPage() {
  hideStatusMessage();
  showPlaceholder();

  const userSearch = getEl("userSearch");
  const saveBtn = getEl("saveProfileBtn");
  const resetBtn = getEl("resetProfileBtn");

  allUsers = await fetchUsers();
  filteredUsers = [...allUsers];
  renderUserList(filteredUsers);

  if (userSearch) {
    userSearch.addEventListener("input", (e) => {
      filterUsers(e.target.value);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await saveProfileAndPlan();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", (e) => {
      e.preventDefault();
      resetSelectedForm();
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireLoginOrRedirect();
  if (!user) return;

  console.log("Admin user:", user.email);

  await initAdminPage();
});