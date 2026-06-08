(function () {
    const STATE = {
        access: null,
        targetUserId: "",
        goals: [],
        editingGoalId: null,
        pendingDeleteGoalId: null,
        users: [],
        swipeHandlersBound: false,
        suppressCardClickUntil: 0
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
        if (String(goal.goal_category || "").toLowerCase().includes("diet")) {
            return "Target: Diet plan";
        }
        return "Not set";
    }

    function categoryClass(category) {
        const key = String(category || "").toLowerCase();
        if (key.includes("diet")) return "goal-label--diet";
        return "goal-label--lifestyle";
    }

    function normalizeGoalCategory(category) {
        const key = String(category || "").trim().toLowerCase();
        return key === "diet" ? "Diet" : "Lifestyle";
    }

    const DIET_COLOR_CLASSES = [
        "goal-icon--diet-1",
        "goal-icon--diet-2",
        "goal-icon--diet-3",
        "goal-icon--diet-4",
        "goal-icon--diet-5",
        "goal-icon--diet-6",
        "goal-icon--diet-7",
        "goal-icon--diet-8"
    ];

    const LIFESTYLE_COLOR_CLASSES = [
        "goal-icon--life-1",
        "goal-icon--life-2",
        "goal-icon--life-3",
        "goal-icon--life-4",
        "goal-icon--life-5",
        "goal-icon--life-6",
        "goal-icon--life-7",
        "goal-icon--life-8"
    ];

    function hashText(text) {
        const value = String(text || "");
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = ((hash << 5) - hash) + value.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function pickByHash(text, palette) {
        if (!Array.isArray(palette) || !palette.length) return "goal-icon--purple";
        const index = hashText(text) % palette.length;
        return palette[index];
    }

    function getGoalIcon(goal) {
        const name = String(goal.goal_name || "").toLowerCase();
        const category = String(goal.goal_category || "").toLowerCase();

        // Always honor these mappings first, regardless of category.
        if (name.includes("water") || name.includes("hydrat")) return "droplet";
        if (name.includes("supplement") || name.includes("supplements") || name.includes("pill") || name.includes("vitamin")) return "pill-bottle";

        // Diet goal icons
        if (category.includes("diet")) {
            if (name.includes("protein")) return "cup-soda";

            if (name.includes("snack")) return "cookie";
            if (name.includes("dinner")) return "cooking-pot";
            if (name.includes("lunch")) return "sandwich";
            if (name.includes("breakfast")) return "croissant";
            if (name.includes("salad") || name.includes("vegetable") || name.includes("veggie")) return "salad";
            if (name.includes("pizza")) return "pizza";
            if (name.includes("soup")) return "soup";

            return "utensils";
        }

        // Lifestyle goal icons
        if (category.includes("lifestyle")) {
            if (name.includes("step") || name.includes("walk")) return "footprints";
            if (name.includes("sleep")) return "heart-plus";
            if (name.includes("meditat")) return "heart";
            if (name.includes("yoga")) return "flower";
            if (name.includes("workout") || name.includes("exercise") || name.includes("train")) return "activity";
            return "target";
        }

        return "target";
    }

    function getGoalIconColor(goal) {
        const category = String(goal.goal_category || "").toLowerCase();
        const key = `${goal.goal_name || ""}|${goal.id || ""}`;

        // Diet and Lifestyle both use fixed multi-color palettes.
        if (category.includes("diet")) {
            return pickByHash(key, DIET_COLOR_CLASSES);
        }

        return pickByHash(key, LIFESTYLE_COLOR_CLASSES);
    }

    function normalizeGoal(row) {
        return {
            id: row.id,
            user_id: row.user_id,
            goal_name: row.goal_name || row.name || "Untitled Goal",
            goal_category: normalizeGoalCategory(row.goal_category || row.category || "Lifestyle"),
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

        const groups = [
            {
                title: "Diet Goals",
                goals: STATE.goals.filter((goal) => normalizeGoalCategory(goal.goal_category) === "Diet")
            },
            {
                title: "Lifestyle Goals",
                goals: STATE.goals.filter((goal) => normalizeGoalCategory(goal.goal_category) !== "Diet")
            }
        ].filter((group) => group.goals.length);

        const renderGoalCard = (goal) => {
            const iconName = getGoalIcon(goal);
            const iconColorClass = getGoalIconColor(goal);
            return `<div class="goal-card-row" data-goal-id="${goal.id}">
                <div class="goal-card-swipe-delete" aria-hidden="true">
                    <i data-lucide="trash-2"></i>
                    <span>Delete</span>
                </div>
                <article class="goal-card" data-goal-id="${goal.id}">
                    <div class="goal-card-icon ${iconColorClass}">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <div class="goal-card-content">
                        <span class="goal-label ${categoryClass(goal.goal_category)}">${escapeHtml(goal.goal_category)}</span>
                        <h4>${escapeHtml(goal.goal_name)}</h4>
                        <p>${escapeHtml(goalCardSubtitle(goal))}</p>
                    </div>
                    <div class="goal-card-action">
                        <i data-lucide="chevron-right"></i>
                    </div>
                </article>
            </div>`;
        };

        // Desktop table
        tableBody.innerHTML = groups.map((group) => {
            const rows = group.goals.map((goal) => `<tr>
                <td><strong>${escapeHtml(goal.goal_name)}</strong></td>
                <td><span class="goal-label ${categoryClass(goal.goal_category)}">${escapeHtml(goal.goal_category)}</span></td>
                <td>${escapeHtml(targetText(goal))}</td>
                <td>
                    <div class="goal-actions">
                        <button type="button" class="goal-icon-btn" data-action="edit" data-goal-id="${goal.id}" aria-label="Edit goal"><i data-lucide="pencil"></i></button>
                        <button type="button" class="goal-icon-btn goal-icon-btn--danger" data-action="delete" data-goal-id="${goal.id}" aria-label="Delete goal"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            </tr>`).join("");
            return `<tr class="goal-table-group-row"><td colspan="4">${escapeHtml(group.title)}</td></tr>${rows}`;
        }).join("");

        // Mobile cards
        cardList.innerHTML = groups.map((group) => {
            return `<section class="goal-card-group">
                <div class="goal-card-group-head">
                    <h3>${escapeHtml(group.title)}</h3>
                    <span>${group.goals.length} ${group.goals.length === 1 ? "goal" : "goals"}</span>
                </div>
                <div class="goal-card-group-list">
                    ${group.goals.map(renderGoalCard).join("")}
                </div>
            </section>`;
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
        applyGoalCategoryRules("Diet");
    }

    function shouldHideTargetFields(category) {
        // If Diet, hide all fields except Goal Name
        return String(category || "").toLowerCase() === "diet";
    }

    function applyGoalCategoryRules(category) {
        const isDiet = String(category || "").toLowerCase() === "diet";
        const goalTypeField = el("goalTypeField");
        const targetValueField = el("goalTargetValueField");
        const targetUnitField = el("goalTargetUnitField");

        // Toggle visibility based on category
        if (goalTypeField) {
            goalTypeField.classList.toggle("checkin-hidden", isDiet);
        }
        if (targetValueField) {
            targetValueField.classList.toggle("checkin-hidden", isDiet);
        }
        if (targetUnitField) {
            targetUnitField.classList.toggle("checkin-hidden", isDiet);
        }

        // If Diet, clear the fields
        if (isDiet) {
            if (el("goalTypeInput")) el("goalTypeInput").value = "binary";
            el("goalTargetValueInput").value = "";
            el("goalTargetUnitInput").value = "";
        } else {
            // For Lifestyle, apply Goal Type rules
            applyGoalTypeRules();
        }
    }

    function applyGoalTypeRules() {
        const goalTypeInput = el("goalTypeInput");
        const targetValueField = el("goalTargetValueField");
        const targetUnitField = el("goalTargetUnitField");

        if (!goalTypeInput) return;

        const isNumeric = goalTypeInput.value === "numeric";

        // Show Target Value and Unit only for Numeric type
        if (targetValueField) {
            targetValueField.classList.toggle("checkin-hidden", !isNumeric);
        }
        if (targetUnitField) {
            targetUnitField.classList.toggle("checkin-hidden", !isNumeric);
        }

        // Clear values if hiding
        if (!isNumeric) {
            el("goalTargetValueInput").value = "";
            el("goalTargetUnitInput").value = "";
        }
    }

    function inferLifestyleGoalType(goal) {
        const hasTargetValue = goal.target_value !== null && goal.target_value !== undefined && String(goal.target_value).trim() !== "";
        const hasTargetUnit = String(goal.target_unit || "").trim() !== "";
        return hasTargetValue || hasTargetUnit ? "numeric" : "binary";
    }

    function goalCardSubtitle(goal) {
        const category = normalizeGoalCategory(goal.goal_category);
        if (category === "Diet") {
            return "Diet Plan";
        }
        if (inferLifestyleGoalType(goal) === "binary") {
            return "Yes/No";
        }
        return targetText(goal);
    }

    function openGoalModal(goal) {
        STATE.editingGoalId = goal ? goal.id : null;
        const modal = el("goalModalOverlay");
        if (!modal) return;

        if (goal) {
            el("goalModalTitle").textContent = "Edit Goal";
            el("goalNameInput").value = goal.goal_name || "";
            const normalizedCategory = normalizeGoalCategory(goal.goal_category);
            el("goalCategoryInput").value = normalizedCategory;
            if (el("goalTypeInput")) {
                el("goalTypeInput").value = normalizedCategory === "Lifestyle" ? inferLifestyleGoalType(goal) : "binary";
            }
            el("goalTargetValueInput").value = goal.target_value ?? "";
            el("goalTargetUnitInput").value = goal.target_unit || "";
            applyGoalCategoryRules(el("goalCategoryInput").value);
        } else {
            el("goalModalTitle").textContent = "Add Goal";
            clearGoalForm();
        }

        if (window.tyfitStandardModal?.open) {
            window.tyfitStandardModal.open(modal);
        } else {
            modal.classList.remove("checkin-hidden");
            modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        }
    }

    function closeGoalModal() {
        const modal = el("goalModalOverlay");
        if (!modal) return;
        if (window.tyfitStandardModal?.close) {
            window.tyfitStandardModal.close(modal);
        } else {
            modal.classList.add("checkin-hidden");
            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";
        }
    }

    function openDeleteGoalModal(goalId) {
        const overlay = el("goalDeleteModalOverlay");
        if (!overlay || !goalId) return;
        STATE.pendingDeleteGoalId = goalId;
        overlay.classList.remove("checkin-hidden");
        overlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeDeleteGoalModal() {
        const overlay = el("goalDeleteModalOverlay");
        if (!overlay) return;
        overlay.classList.add("checkin-hidden");
        overlay.setAttribute("aria-hidden", "true");
        STATE.pendingDeleteGoalId = null;
        document.body.style.overflow = "";
    }

    async function loadGoalUsersForAdmin() {
        const toolbar = el("goalUserToolbar");
        const select = el("goalUserSelect");
        if (!toolbar || !select || !STATE.access?.isAdmin) return;

        // Try with role/is_admin columns first; fall back to basic columns if those don't exist
        let data = null;
        let usedExtendedCols = false;
        const extendedResult = await window.supabaseClient
            .from("profiles")
            .select("id, first_name, last_name, full_name, email, role, is_admin")
            .order("full_name", { ascending: true });

        if (!extendedResult.error) {
            data = extendedResult.data;
            usedExtendedCols = true;
        } else {
            const basicResult = await window.supabaseClient
                .from("profiles")
                .select("id, first_name, last_name, full_name, email")
                .order("full_name", { ascending: true });

            if (basicResult.error) {
                console.warn("Goal user list warning:", basicResult.error.message || basicResult.error);
                return;
            }
            data = basicResult.data;
        }

        const users = (data || []).filter((item) => {
            if (!item?.id) return false;
            if (item.id === STATE.access.user.id) return true;
            if (usedExtendedCols) {
                if (item.is_admin === true) return false;
                const role = String(item.role || "").toLowerCase();
                if (role === "admin") return false;
            }
            return true;
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
        const isDiet = goalCategory.toLowerCase() === "diet";
        
        return {
            goal_name: String(el("goalNameInput").value || "").trim(),
            goal_category: goalCategory,
            target_value: isDiet ? null : (el("goalTargetValueInput").value === "" ? null : Number(el("goalTargetValueInput").value)),
            target_unit: isDiet ? "" : String(el("goalTargetUnitInput").value || "").trim()
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

    async function confirmDeleteGoal() {
        if (!STATE.pendingDeleteGoalId) {
            closeDeleteGoalModal();
            return;
        }
        const goalId = STATE.pendingDeleteGoalId;
        closeDeleteGoalModal();
        await deleteGoal(goalId);
    }

    function setupGoalCardSwipeDelete() {
        if (STATE.swipeHandlersBound) return;
        if (!("ontouchstart" in window)) return;

        STATE.swipeHandlersBound = true;

        let activeCard = null;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isSwiping = false;

        function resetCard(card) {
            if (!card) return;
            card.style.transform = "";
            const row = card.closest(".goal-card-row");
            if (row) {
                row.classList.remove("is-swiping");
                row.classList.remove("is-swipe-ready");
            }
        }

        document.addEventListener("touchstart", (event) => {
            if (!window.matchMedia("(max-width: 991px)").matches) return;

            const card = event.target.closest(".goal-card");
            if (!card) return;

            activeCard = card;
            startX = event.touches[0].clientX;
            startY = event.touches[0].clientY;
            currentX = startX;
            isSwiping = false;
            resetCard(activeCard);
        }, { passive: true });

        document.addEventListener("touchmove", (event) => {
            if (!window.matchMedia("(max-width: 991px)").matches) return;
            if (!activeCard) return;

            currentX = event.touches[0].clientX;
            const currentY = event.touches[0].clientY;
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < 18) {
                return;
            }

            isSwiping = true;
            const row = activeCard.closest(".goal-card-row");
            if (!row) return;

            const leftSwipe = Math.min(0, deltaX);
            const clamped = Math.max(leftSwipe, -136);
            activeCard.style.transform = `translateX(${clamped}px)`;
            row.classList.add("is-swiping");
            row.classList.toggle("is-swipe-ready", clamped <= -96);
            event.preventDefault();
        }, { passive: false });

        document.addEventListener("touchend", async () => {
            if (!window.matchMedia("(max-width: 991px)").matches) {
                activeCard = null;
                isSwiping = false;
                return;
            }

            if (!activeCard) return;

            const card = activeCard;
            const row = card.closest(".goal-card-row");
            const deltaX = currentX - startX;
            const shouldDelete = isSwiping && deltaX <= -96 && row;

            resetCard(card);
            activeCard = null;

            if (!shouldDelete || !row) {
                isSwiping = false;
                return;
            }

            STATE.suppressCardClickUntil = Date.now() + 260;
            const goalId = row.getAttribute("data-goal-id");
            const goal = STATE.goals.find((item) => String(item.id) === String(goalId));
            if (goal) {
                openDeleteGoalModal(goal.id);
            }

            isSwiping = false;
        });
    }

    function bindEvents() {
        // Handle all add goal buttons
        ["heroAddGoalBtn", "addGoalBtn", "mobileAddGoalBtn"].forEach((id) => {
            const node = el(id);
            if (node) node.addEventListener("click", () => openGoalModal(null));
        });

        // Handle modal close
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

        ["goalDeleteModalClose", "goalDeleteModalCancelBtn"].forEach((id) => {
            const node = el(id);
            if (node) node.addEventListener("click", closeDeleteGoalModal);
        });

        const deleteOverlay = el("goalDeleteModalOverlay");
        if (deleteOverlay) {
            deleteOverlay.addEventListener("click", (event) => {
                if (event.target === deleteOverlay) closeDeleteGoalModal();
            });
        }

        const confirmDeleteBtn = el("goalDeleteModalConfirmBtn");
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener("click", async () => {
                await confirmDeleteGoal();
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

        const goalTypeInput = el("goalTypeInput");
        if (goalTypeInput) {
            goalTypeInput.addEventListener("change", applyGoalTypeRules);
        }

        // Handle goal card clicks for mobile and edit/delete buttons
        document.addEventListener("click", async (event) => {
            // Edit/delete buttons
            const btn = event.target.closest("[data-goal-id][data-action]");
            if (btn) {
                const goalId = btn.getAttribute("data-goal-id");
                const action = btn.getAttribute("data-action");
                const goal = STATE.goals.find((item) => String(item.id) === String(goalId));
                if (!goal) return;

                if (action === "edit") {
                    openGoalModal(goal);
                    return;
                }

                if (action === "delete") {
                    openDeleteGoalModal(goal.id);
                }
            }

            // Goal card click (mobile) - open edit modal
            const card = event.target.closest(".goal-card");
            if (card && !event.target.closest("[data-action]")) {
                if (Date.now() < STATE.suppressCardClickUntil) {
                    return;
                }
                const goalId = card.getAttribute("data-goal-id");
                const goal = STATE.goals.find((item) => String(item.id) === String(goalId));
                if (goal) {
                    openGoalModal(goal);
                }
            }
        });

        setupGoalCardSwipeDelete();
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
