(function () {
    const STATE = {
        access: null,
        targetUserId: "",
        goals: [],
        editingGoalId: null,
        users: []
    };

    function el(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") {
            window.tyfitRefreshIcons();
            return;
        }
        if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
        }
    }

    function showToast(message) {
        const toast = el("appToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("is-show");
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove("is-show"), 2200);
    }

    function buildUserLabel(profile) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.full_name || "";
        return fullName || profile.email || "User";
    }

    function targetText(goal) {
        if (goal.target_value !== null && goal.target_value !== undefined && String(goal.target_value).trim() !== "") {
            const value = Number(goal.target_value);
            const clean = Number.isFinite(value) ? (Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "")) : String(goal.target_value);
            return `${clean}${goal.target_unit ? ` ${goal.target_unit}` : ""}`.trim();
        }
        return "Not set";
    }

    function categoryClass(category) {
        const key = String(category || "").toLowerCase();
        if (key.includes("diet")) return "checkin-tag--diet";
        if (key.includes("supplement")) return "checkin-tag--supplement";
        if (key.includes("activity")) return "checkin-tag--activity";
        return "checkin-tag--lifestyle";
    }

    function normalizeGoal(row) {
        return {
            id: row.id,
            user_id: row.user_id,
            goal_name: row.goal_name || row.name || "Untitled Goal",
            goal_category: row.goal_category || row.category || "Lifestyle",
            target_value: row.target_value ?? null,
            target_unit: row.target_unit || ""
        };
    }

    function renderGoals() {
        const tableBody = el("goalTableBody");
        const cardList = el("goalCardList");
        const panel = el("goalPanel");

        if (!tableBody || !cardList || !panel) return;

        if (!STATE.goals.length) {
            tableBody.innerHTML = "";
            cardList.innerHTML = "";
            panel.classList.add("checkin-hidden");
            return;
        }

        panel.classList.remove("checkin-hidden");

        tableBody.innerHTML = STATE.goals.map((goal) => {
            return `<tr>
                <td><strong>${escapeHtml(goal.goal_name)}</strong></td>
                <td><span class="checkin-tag ${categoryClass(goal.goal_category)}">${escapeHtml(goal.goal_category)}</span></td>
                <td>${escapeHtml(targetText(goal))}</td>
                <td>
                    <div class="checkin-goal-actions">
                        <button type="button" class="checkin-icon-btn" data-action="edit" data-goal-id="${goal.id}" aria-label="Edit goal"><i data-lucide="pencil"></i></button>
                        <button type="button" class="checkin-icon-btn danger" data-action="delete" data-goal-id="${goal.id}" aria-label="Delete goal"><i data-lucide="trash2"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join("");

        cardList.innerHTML = STATE.goals.map((goal) => {
            return `<article class="checkin-goal-card">
                <div class="checkin-goal-meta">
                    <span class="checkin-tag ${categoryClass(goal.goal_category)}">${escapeHtml(goal.goal_category)}</span>
                    <div class="checkin-goal-actions">
                        <button type="button" class="checkin-icon-btn" data-action="edit" data-goal-id="${goal.id}" aria-label="Edit goal"><i data-lucide="pencil"></i></button>
                        <button type="button" class="checkin-icon-btn danger" data-action="delete" data-goal-id="${goal.id}" aria-label="Delete goal"><i data-lucide="trash2"></i></button>
                    </div>
                </div>
                <h4>${escapeHtml(goal.goal_name)}</h4>
                <p>${escapeHtml(goal.goal_category)} • ${escapeHtml(targetText(goal))}</p>
            </article>`;
        }).join("");

        refreshIcons();
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function clearGoalForm() {
        el("goalNameInput").value = "";
        el("goalCategoryInput").value = "Diet";
        if (el("goalTypeInput")) el("goalTypeInput").value = "binary";
        el("goalTargetValueInput").value = "";
        el("goalTargetUnitInput").value = "";
        if (el("goalTargetTextInput")) el("goalTargetTextInput").value = "";
        if (el("goalGreenRuleInput")) el("goalGreenRuleInput").value = "";
        if (el("goalYellowRuleInput")) el("goalYellowRuleInput").value = "";
        if (el("goalRedRuleInput")) el("goalRedRuleInput").value = "";
        applyGoalCategoryRules("Diet");
    }

    function shouldHideTargetFields(category) {
        void category;
        return false;
    }

    function applyGoalCategoryRules(category) {
        const targetValueField = el("goalTargetValueField");
        const targetUnitField = el("goalTargetUnitField");
        const hideTargets = shouldHideTargetFields(category);

        if (targetValueField) {
            targetValueField.classList.toggle("checkin-hidden", hideTargets);
        }
        if (targetUnitField) {
            targetUnitField.classList.toggle("checkin-hidden", hideTargets);
        }

        if (hideTargets) {
            const targetValueInput = el("goalTargetValueInput");
            const targetUnitInput = el("goalTargetUnitInput");
            if (targetValueInput) {
                targetValueInput.value = "";
            }
            if (targetUnitInput) {
                targetUnitInput.value = "";
            }
        }
    }

    function openGoalModal(goal) {
        STATE.editingGoalId = goal ? goal.id : null;
        const modal = el("goalModalOverlay");
        if (!modal) return;

        if (goal) {
            el("goalModalTitle").textContent = "Edit Goal";
            el("goalNameInput").value = goal.goal_name || "";
            el("goalCategoryInput").value = goal.goal_category || "Lifestyle";
            if (el("goalTypeInput")) el("goalTypeInput").value = "numeric";
            el("goalTargetValueInput").value = goal.target_value ?? "";
            el("goalTargetUnitInput").value = goal.target_unit || "";
            if (el("goalTargetTextInput")) el("goalTargetTextInput").value = "";
            if (el("goalGreenRuleInput")) el("goalGreenRuleInput").value = "";
            if (el("goalYellowRuleInput")) el("goalYellowRuleInput").value = "";
            if (el("goalRedRuleInput")) el("goalRedRuleInput").value = "";
            applyGoalCategoryRules(el("goalCategoryInput").value);
        } else {
            el("goalModalTitle").textContent = "Add Goal";
            clearGoalForm();
        }

        modal.classList.remove("checkin-hidden");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeGoalModal() {
        const modal = el("goalModalOverlay");
        if (!modal) return;
        modal.classList.add("checkin-hidden");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    async function loadGoalUsersForAdmin() {
        const toolbar = el("goalUserToolbar");
        const select = el("goalUserSelect");
        if (!toolbar || !select || !STATE.access?.isAdmin) return;

        const { data, error } = await window.supabaseClient
            .from("profiles")
            .select("id, first_name, last_name, full_name, email, role, is_admin")
            .order("full_name", { ascending: true });

        if (error) {
            console.warn("Goal user list warning:", error.message || error);
            return;
        }

        const users = (data || []).filter((item) => {
            if (!item?.id) return false;
            if (item.id === STATE.access.user.id) return true;
            if (item.is_admin === true) return false;
            const role = String(item.role || "").toLowerCase();
            return role !== "admin";
        });

        STATE.users = users;
        select.innerHTML = users.map((user) => {
            return `<option value="${user.id}">${escapeHtml(buildUserLabel(user))}</option>`;
        }).join("");

        STATE.targetUserId = select.value || STATE.access.user.id;
        toolbar.classList.remove("checkin-hidden");
        refreshIcons();
    }

    async function loadGoals() {
        if (!STATE.targetUserId) return;

        const { data, error } = await window.supabaseClient
            .from("checkin_goals")
            .select("*")
            .eq("user_id", STATE.targetUserId)
            .order("created_at", { ascending: false });

        if (error) {
            showToast("Could not load goals.");
            console.error("loadGoals error:", error);
            return;
        }

        STATE.goals = (data || []).map(normalizeGoal);
        renderGoals();
    }

    function readGoalFormPayload() {
        const goalCategory = String(el("goalCategoryInput").value || "Lifestyle").trim();
        const hideTargets = shouldHideTargetFields(goalCategory);
        return {
            goal_name: String(el("goalNameInput").value || "").trim(),
            goal_category: goalCategory,
            target_value: hideTargets ? null : (el("goalTargetValueInput").value === "" ? null : Number(el("goalTargetValueInput").value)),
            target_unit: hideTargets ? "" : String(el("goalTargetUnitInput").value || "").trim()
        };
    }

    async function saveGoal() {
        const payload = readGoalFormPayload();

        if (!payload.goal_name) {
            showToast("Goal name is required.");
            return;
        }

        const basePayload = {
            user_id: STATE.targetUserId,
            goal_name: payload.goal_name,
            goal_category: payload.goal_category,
            target_value: payload.target_value,
            target_unit: payload.target_unit,
            updated_at: new Date().toISOString()
        };

        if (STATE.editingGoalId) {
            const { error } = await window.supabaseClient
                .from("checkin_goals")
                .update(basePayload)
                .eq("id", STATE.editingGoalId);

            if (error) {
                showToast(`Could not update goal: ${error.message || "unknown error"}`);
                console.error("update goal error:", error);
                return;
            }

            showToast("Goal updated.");
        } else {
            const { error } = await window.supabaseClient
                .from("checkin_goals")
                .insert({
                    ...basePayload,
                    created_by: STATE.access.user.id
                });

            if (error) {
                showToast(`Could not add goal: ${error.message || "unknown error"}`);
                console.error("insert goal error:", error);
                return;
            }

            showToast("Goal added.");
        }

        closeGoalModal();
        await loadGoals();
    }

    async function deleteGoal(goalId) {
        if (!goalId) return;
        const ok = window.confirm("Delete this goal?");
        if (!ok) return;

        const { error } = await window.supabaseClient
            .from("checkin_goals")
            .delete()
            .eq("id", goalId);

        if (error) {
            showToast("Could not delete goal.");
            console.error("delete goal error:", error);
            return;
        }

        showToast("Goal deleted.");
        await loadGoals();
    }

    function bindEvents() {
        ["addGoalBtn", "mobileAddGoalBtn"].forEach((id) => {
            const node = el(id);
            if (node) node.addEventListener("click", () => openGoalModal(null));
        });

        ["goalModalClose", "goalModalCancelBtn"].forEach((id) => {
            const node = el(id);
            if (node) node.addEventListener("click", closeGoalModal);
        });

        const overlay = el("goalModalOverlay");
        if (overlay) {
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) closeGoalModal();
            });
        }

        const saveBtn = el("goalModalSaveBtn");
        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                await saveGoal();
            });
        }

        const goalUserSelect = el("goalUserSelect");
        if (goalUserSelect) {
            goalUserSelect.addEventListener("change", async () => {
                STATE.targetUserId = goalUserSelect.value;
                await loadGoals();
            });
        }

        const goalCategoryInput = el("goalCategoryInput");
        if (goalCategoryInput) {
            goalCategoryInput.addEventListener("change", () => {
                applyGoalCategoryRules(goalCategoryInput.value);
            });
        }

        document.addEventListener("click", async (event) => {
            const btn = event.target.closest("[data-goal-id][data-action]");
            if (!btn) return;
            const goalId = btn.getAttribute("data-goal-id");
            const action = btn.getAttribute("data-action");
            const goal = STATE.goals.find((item) => String(item.id) === String(goalId));
            if (!goal) return;

            if (action === "edit") {
                openGoalModal(goal);
                return;
            }

            if (action === "delete") {
                await deleteGoal(goal.id);
            }
        });
    }

    async function init() {
        bindEvents();

        if (typeof window.getAccessState !== "function") {
            showToast("Auth state is not ready yet.");
            return;
        }

        STATE.access = await window.getAccessState();
        if (!STATE.access?.isLoggedIn || !STATE.access?.user?.id) {
            showToast("Please log in first.");
            return;
        }

        STATE.targetUserId = STATE.access.user.id;

        if (STATE.access.isAdmin) {
            await loadGoalUsersForAdmin();
        }

        await loadGoals();
        refreshIcons();
    }

    window.addEventListener("DOMContentLoaded", () => {
        init().catch((error) => {
            console.error("checkin_goals init error:", error);
            showToast("Could not load Daily Goals.");
        });
    });
}());
