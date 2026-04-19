const FOOD_IMAGE_BUCKET = "food-images";
const FOOD_UNITS = ["g", "ml", "piece", "slice"];

const foodCatalogState = {
    editingFoodId: null,
    items: [],
    customItems: [],
    globalItems: [],
    suggestionNames: [],
    currentUserId: "",
    currentImagePath: "",
    currentPreviewUrl: "",
    sortBy: "date_desc",
    searchTerm: "",
    menuOutsideBound: false,
    swipeHandlersBound: false,
    isAdmin: false
};

function getEl(id) {
    return document.getElementById(id);
}

function showDialogAlert(message, options = {}) {
    return window.tyfitDialog.alert({
        message,
        ...options
    });
}

function showDialogConfirm(message, options = {}) {
    return window.tyfitDialog.confirm({
        message,
        ...options
    });
}

function setInputValue(id, value) {
    const el = getEl(id);
    if (el) el.value = value ?? "";
}

function getInputValue(id) {
    const el = getEl(id);
    return el ? el.value.trim() : "";
}

function parseOptionalNumber(value) {
    if (value === "" || value === null || value === undefined) {
        return null;
    }

    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
}

function formatNumber(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? "-" : numberValue.toFixed(2).replace(/\.00$/, "");
}

function calculateTotalCalories(item) {
    const carbs = Number(item?.carbs) || 0;
    const protein = Number(item?.protein) || 0;
    const fats = Number(item?.fats) || 0;

    return (carbs * 4) + (protein * 4) + (fats * 9);
}

function renderMacroBars(item) {
    const carbs = Number(item?.carbs) || 0;
    const protein = Number(item?.protein) || 0;
    const fats = Number(item?.fats) || 0;
    const fibre = item?.fibre === null || item?.fibre === undefined || item?.fibre === ""
        ? null
        : Number(item.fibre);

    const fibreHtml = fibre !== null && !Number.isNaN(fibre)
        ? `
            <span class="diet-view-macro fibre">
                <i class="fa fa-seedling" aria-hidden="true"></i> Fi:${formatNumber(fibre)} g
            </span>
        `
        : "";

    return `
        <div class="food-macro-bars">
            <span class="diet-view-macro carbs">
                <i class="fa fa-bolt" aria-hidden="true"></i> C:${formatNumber(carbs)} g
            </span>
            <span class="diet-view-macro protein">
                <i class="fa fa-dumbbell" aria-hidden="true"></i> P:${formatNumber(protein)} g
            </span>
            <span class="diet-view-macro fats">
                <i class="fa fa-tint" aria-hidden="true"></i> F:${formatNumber(fats)} g
            </span>
            ${fibreHtml}
        </div>
    `;
}

function updateSearchSuggestions(items) {
    const suggestionEl = getEl("foodSearchSuggestions");
    if (!suggestionEl) {
        return;
    }

    foodCatalogState.suggestionNames = [...new Set((items || [])
        .map((item) => (item.food_name || "").trim())
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));

    suggestionEl.innerHTML = "";
    suggestionEl.style.display = "none";
}

function renderSearchSuggestions(query) {
    const suggestionEl = getEl("foodSearchSuggestions");
    if (!suggestionEl) {
        return;
    }

    const normalizedQuery = (query || "").trim().toLowerCase();
    if (!normalizedQuery || normalizedQuery.length < 1) {
        suggestionEl.innerHTML = "";
        suggestionEl.style.display = "none";
        return;
    }

    const matchedNames = foodCatalogState.suggestionNames
        .filter((name) => name.toLowerCase().includes(normalizedQuery))
        .slice(0, 7);

    if (matchedNames.length === 0) {
        suggestionEl.innerHTML = "";
        suggestionEl.style.display = "none";
        return;
    }

    suggestionEl.innerHTML = matchedNames.map((name) => {
        const escapedName = escapeHtml(name);
        return `<button type="button" class="food-search-suggestion-item" data-name="${escapedName}">${escapedName}</button>`;
    }).join("");

    suggestionEl.querySelectorAll(".food-search-suggestion-item").forEach((itemBtn) => {
        itemBtn.addEventListener("mousedown", (event) => {
            event.preventDefault();
            const value = itemBtn.dataset.name || "";
            const inputEl = getEl("foodSearchInput");
            if (inputEl) {
                inputEl.value = value;
            }
            foodCatalogState.searchTerm = value;
            suggestionEl.style.display = "none";
            renderFoodCatalogTable(foodCatalogState.items);
        });
    });

    suggestionEl.style.display = "block";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showStatusMessage(message, type = "success") {
    const el = getEl("foodCatalogStatus");
    if (!el) return;

    el.textContent = message;
    el.className = `food-form-status alert alert-${type} mt-3`;
    el.style.display = "block";
}

function hideStatusMessage() {
    const el = getEl("foodCatalogStatus");
    if (!el) return;

    el.style.display = "none";
    el.textContent = "";
    el.className = "food-form-status";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    if (typeof window.requireLoginWithModal === "function") {
        return window.requireLoginWithModal();
    }

    const { session, error } = await waitForStableSession();

    if (error) {
        await showDialogAlert("Session error: " + error.message, { title: "Session Error" });
        return null;
    }

    if (!session) {
        if (typeof window.openAuthModal === "function") {
            window.openAuthModal({ locked: true });
        }
        return null;
    }

    return session.user;
}

async function requireAdminOrRedirect(user) {
    if (typeof window.getAccessState === "function") {
        const accessState = await window.getAccessState({ user });
        if (accessState?.isAdmin) {
            return true;
        }
    }

    if (typeof window.isAdminUser === "function" && window.isAdminUser(user)) {
        return true;
    }

    await showDialogAlert("You do not have access to the admin portal.", { title: "Access Restricted" });
    window.location.href = "../index.html";
    return false;
}

function setSaveButtonState(isSaving) {
    const saveBtn = getEl("foodSaveBtn");
    const refreshBtn = getEl("foodRefreshBtn");

    if (saveBtn) {
        saveBtn.disabled = isSaving;
        saveBtn.innerHTML = isSaving
            ? '<i class="fa fa-spinner fa-spin"></i> Saving...'
            : `<i class="fa fa-save"></i> ${foodCatalogState.editingFoodId ? "Update Food Item" : "Save Food Item"}`;
    }

    if (refreshBtn) {
        refreshBtn.disabled = isSaving;
    }
}

function openFoodFormModal() {
    const titleEl = getEl("foodFormModalTitle");
    if (titleEl) {
        if (foodCatalogState.editingFoodId) {
            titleEl.innerHTML = '<i class="fa fa-pen mr-2"></i>Edit Food Item';
        } else {
            titleEl.innerHTML = foodCatalogState.isAdmin
                ? '<i class="fa fa-utensils mr-2"></i>Add New Food Item'
                : '<i class="fa fa-plus-circle mr-2"></i>Add Custom Food';
        }
    }

    if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery("#foodFormModal").modal("show");
    }
}

function closeFoodFormModal() {
    if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery("#foodFormModal").modal("hide");
    }
}

function getStoragePublicUrl(path) {
    if (!path) {
        return "";
    }

    const { data } = window.supabaseClient.storage.from(FOOD_IMAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
}

function revokePreviewUrlIfNeeded() {
    if (foodCatalogState.currentPreviewUrl && foodCatalogState.currentPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(foodCatalogState.currentPreviewUrl);
    }
    foodCatalogState.currentPreviewUrl = "";
}

function updateImagePreview(imagePath = "", previewUrl = "") {
    const previewWrapper = getEl("foodImagePreview");
    const previewImg = getEl("foodImagePreviewImg");
    const previewPath = getEl("foodImagePreviewPath");

    if (!previewWrapper || !previewImg || !previewPath) {
        return;
    }

    revokePreviewUrlIfNeeded();

    const resolvedUrl = previewUrl || getStoragePublicUrl(imagePath);
    if (!resolvedUrl) {
        previewWrapper.classList.remove("is-visible");
        previewImg.src = "";
        previewPath.textContent = "";
        return;
    }

    foodCatalogState.currentPreviewUrl = previewUrl || "";
    previewImg.src = resolvedUrl;
    previewPath.textContent = imagePath || "Selected new image";
    previewWrapper.classList.add("is-visible");
}

function updateImageFileName(name) {
    const fileNameEl = getEl("foodImageFileName");
    if (!fileNameEl) {
        return;
    }

    fileNameEl.textContent = name || "No file chosen";
}

function getFoodFormValues() {
    return {
        food_name: getInputValue("foodName"),
        quantity: parseOptionalNumber(getInputValue("foodQuantity")),
        unit_of_quantity: getInputValue("foodUnit"),
        carbs: parseOptionalNumber(getInputValue("foodCarbs")),
        protein: parseOptionalNumber(getInputValue("foodProtein")),
        fats: parseOptionalNumber(getInputValue("foodFats")),
        fibre: parseOptionalNumber(getInputValue("foodFibre"))
    };
}

function validateFoodForm(values) {
    if (!values.food_name) {
        return "Food name is required.";
    }

    if (values.quantity === null || values.quantity <= 0) {
        return "Quantity must be greater than 0.";
    }

    if (!FOOD_UNITS.includes(values.unit_of_quantity)) {
        return "Please select a valid quantity unit.";
    }

    if (values.carbs === null || values.carbs < 0) {
        return "Carbs must be 0 or greater.";
    }

    if (values.protein === null || values.protein < 0) {
        return "Protein must be 0 or greater.";
    }

    if (values.fats === null || values.fats < 0) {
        return "Fats must be 0 or greater.";
    }

    if (values.fibre !== null && values.fibre < 0) {
        return "Fibre must be empty or 0 or greater.";
    }

    return "";
}

async function uploadFoodImage(file) {
    if (!file) {
        return "";
    }

    if (!file.type || !file.type.startsWith("image/")) {
        throw new Error("Please select a valid image file.");
    }

    const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
    const baseName = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
    const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
    const fileName = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const storagePath = `catalog/${fileName}-${safeName}.${extension}`;

    const { error } = await window.supabaseClient.storage
        .from(FOOD_IMAGE_BUCKET)
        .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false
        });

    if (error) {
        console.error("uploadFoodImage error:", error);
        throw new Error("Image upload failed. " + error.message);
    }

    return storagePath;
}

async function loadFoodCatalog() {
    const userId = foodCatalogState.currentUserId;

    const [globalResult, customResult] = await Promise.all([
        window.supabaseClient
            .from("food_catalog")
            .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, image_path, created_at, updated_at, is_custom, created_by_user_id")
            .or("is_custom.is.null,is_custom.eq.false")
            .order("created_at", { ascending: false }),
        userId
            ? window.supabaseClient
                .from("food_catalog")
                .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, image_path, created_at, updated_at, is_custom, created_by_user_id")
                .eq("is_custom", true)
                .eq("created_by_user_id", userId)
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null })
    ]);

    if (globalResult.error) {
        console.error("loadFoodCatalog global error:", globalResult.error);
        throw new Error("Failed to load food catalog. " + globalResult.error.message);
    }
    if (customResult.error) {
        console.error("loadFoodCatalog custom error:", customResult.error);
        throw new Error("Failed to load custom foods. " + customResult.error.message);
    }

    foodCatalogState.globalItems = globalResult.data || [];
    foodCatalogState.customItems = customResult.data || [];
    foodCatalogState.items = [...foodCatalogState.customItems, ...foodCatalogState.globalItems];
    updateSearchSuggestions(foodCatalogState.items);
    renderFoodCatalogTable(foodCatalogState.items);
    return foodCatalogState.items;
}

function sortFoodCatalogItems(items) {
    const sortedItems = [...(items || [])];

    sortedItems.sort((left, right) => {
        if (foodCatalogState.sortBy === "name_asc") {
            return (left.food_name || "").localeCompare(right.food_name || "", undefined, { sensitivity: "base" });
        }

        if (foodCatalogState.sortBy === "name_desc") {
            return (right.food_name || "").localeCompare(left.food_name || "", undefined, { sensitivity: "base" });
        }

        if (foodCatalogState.sortBy === "calories_asc") {
            return calculateTotalCalories(left) - calculateTotalCalories(right);
        }

        if (foodCatalogState.sortBy === "calories_desc") {
            return calculateTotalCalories(right) - calculateTotalCalories(left);
        }

        const leftDate = new Date(left.created_at || left.updated_at || 0).getTime();
        const rightDate = new Date(right.created_at || right.updated_at || 0).getTime();
        return rightDate - leftDate;
    });

    return sortedItems;
}

function getVisibleFoodCatalogItems(items) {
    const normalizedSearchTerm = foodCatalogState.searchTerm.trim().toLowerCase();
    const filteredItems = normalizedSearchTerm
        ? (items || []).filter((item) => (item.food_name || "").toLowerCase().includes(normalizedSearchTerm))
        : [...(items || [])];

    return sortFoodCatalogItems(filteredItems);
}

function populateFoodForm(item) {
    if (!item) {
        return;
    }

    foodCatalogState.editingFoodId = item.food_id;
    foodCatalogState.currentImagePath = item.image_path || "";

    setInputValue("foodId", item.food_id);
    setInputValue("foodName", item.food_name);
    setInputValue("foodQuantity", item.quantity);
    setInputValue("foodUnit", item.unit_of_quantity || "g");
    setInputValue("foodCarbs", item.carbs);
    setInputValue("foodProtein", item.protein);
    setInputValue("foodFats", item.fats);
    setInputValue("foodFibre", item.fibre ?? "");
    setInputValue("foodImage", "");
    updateImageFileName("No file chosen");

    updateImagePreview(item.image_path || "");

    setSaveButtonState(false);
    hideStatusMessage();
}

function resetFoodForm() {
    const form = getEl("foodCatalogForm");
    if (form) {
        form.reset();
    }

    foodCatalogState.editingFoodId = null;
    foodCatalogState.currentImagePath = "";

    setInputValue("foodId", "");
    setInputValue("foodUnit", "g");
    setInputValue("foodFibre", "");
    updateImageFileName("No file chosen");

    hideStatusMessage();
    updateImagePreview();
    setSaveButtonState(false);
}

function createFoodImageCell(item) {
    if (!item.image_path) {
        return '<span class="text-muted">No image</span>';
    }

    const publicUrl = getStoragePublicUrl(item.image_path);
    if (!publicUrl) {
        return '<span class="text-muted">Unavailable</span>';
    }

    return `<img src="${escapeHtml(publicUrl)}" alt="${escapeHtml(item.food_name)}" class="food-catalog-thumbnail">`;
}

async function deleteFoodItem(foodId) {
    const item = foodCatalogState.items.find((entry) => entry.food_id === foodId);
    if (!item) {
        await showDialogAlert("Food item not found.", { title: "Not Found" });
        return;
    }

    if (!canEditFoodItem(item)) {
        await showDialogAlert("You don't have permission to delete this food item.", { title: "Access Denied" });
        return;
    }

    const isConfirmed = await showDialogConfirm(`Delete ${item.food_name}? This action cannot be undone.`, {
        title: "Delete Food Item",
        confirmText: "Delete",
        confirmClass: "btn-danger"
    });
    if (!isConfirmed) {
        return;
    }

    hideStatusMessage();

    try {
        const { error } = await window.supabaseClient
            .from("food_catalog")
            .delete()
            .eq("food_id", foodId);

        if (error) {
            throw new Error(error.message);
        }

        if (item.image_path) {
            const { error: storageError } = await window.supabaseClient.storage
                .from(FOOD_IMAGE_BUCKET)
                .remove([item.image_path]);

            if (storageError) {
                console.warn("deleteFoodItem storage cleanup warning:", storageError);
            }
        }

        if (foodCatalogState.editingFoodId === foodId) {
            resetFoodForm();
        }

        await loadFoodCatalog();
        await showDialogAlert("Food item deleted successfully.", { title: "Deleted" });
    } catch (error) {
        console.error("deleteFoodItem error:", error);
        await showDialogAlert(error.message || "Failed to delete food item.", { title: "Delete Failed" });
    }
}

function canEditFoodItem(item) {
    if (foodCatalogState.isAdmin) return true;
    return Boolean(item.is_custom && item.created_by_user_id === foodCatalogState.currentUserId);
}

function renderFoodCatalogTable(items) {
    const container = getEl("foodCatalogTableContainer");
    if (!container) {
        return;
    }

    const allVisible = getVisibleFoodCatalogItems(items);

    if (!allVisible || allVisible.length === 0) {
        container.innerHTML = foodCatalogState.searchTerm
            ? '<div class="food-catalog-empty">No food items match your search.</div>'
            : '<div class="food-catalog-empty">No food catalog items found.</div>';
        return;
    }

    const customVisible = allVisible.filter((item) => item.is_custom && item.created_by_user_id === foodCatalogState.currentUserId);
    const globalVisible = allVisible.filter((item) => !item.is_custom);

    function buildRows(sectionItems) {
        return sectionItems.map((item) => {
        const totalCalories = calculateTotalCalories(item);
        const macroChart = renderMacroBars(item);
        const foodId = escapeHtml(item.food_id);
        const foodName = escapeHtml(item.food_name);
        const foodUnit = escapeHtml(item.unit_of_quantity || "");
        const canEdit = canEditFoodItem(item);
        const actionButtons = canEdit ? `
                            <div class="food-row-actions food-row-actions-desktop">
                                <button type="button" class="food-action-btn food-action-btn-edit js-edit-food" data-food-id="${foodId}" aria-label="Edit ${foodName}" title="Edit">
                                    <i class="fa fa-pen"></i>
                                </button>
                                <button type="button" class="food-action-btn food-action-btn-delete js-delete-food" data-food-id="${foodId}" aria-label="Delete ${foodName}" title="Delete">
                                    <i class="fa fa-trash"></i>
                                </button>
                            </div>
                            <div class="food-row-actions-mobile">
                                <div class="food-item-menu-wrap" data-food-id="${foodId}">
                                    <button type="button" class="food-item-menu-btn" data-food-id="${foodId}" aria-label="Food actions" aria-expanded="false">
                                        <i class="fa fa-ellipsis-v"></i>
                                    </button>
                                    <div class="food-item-menu" data-food-id="${foodId}">
                                        <button type="button" class="food-item-menu-item js-food-action-edit" data-food-id="${foodId}">
                                            <i class="fa fa-pen"></i> Edit item
                                        </button>
                                        <button type="button" class="food-item-menu-item danger js-food-action-delete" data-food-id="${foodId}">
                                            <i class="fa fa-trash"></i> Delete item
                                        </button>
                                    </div>
                                </div>
                            </div>` : "";
        return `
            <div class="food-catalog-entry">
                <div class="diet-view-item-card food-catalog-entry-card" data-food-id="${foodId}">
                    <div class="diet-view-item-top">
                        <div class="diet-view-item-title">
                            <span class="diet-item-dot"></span>
                            <span class="diet-view-item-name">${foodName}</span>
                        </div>
                        <div class="food-catalog-entry-top-right">
                            <div class="diet-view-item-calories">${formatNumber(totalCalories)} kcal</div>
                            ${actionButtons}
                        </div>
                    </div>
                    <div class="diet-view-item-qty">
                        <span class="diet-item-quantity">${formatNumber(item.quantity)}</span>
                        <span class="diet-item-unit">${foodUnit}</span>
                    </div>
                    <div class="diet-view-item-macros">
                        ${macroChart}
                    </div>
                    ${canEdit ? '<div class="food-catalog-swipe-overlay diet-swipe-overlay"><i class="fa fa-trash-alt"></i></div>' : ""}
                </div>
            </div>
        `;
        }).join("");
    }

    let html = '<div class="food-catalog-list">';
    if (customVisible.length > 0) {
        html += `<div class="catalog-section-label px-1 pt-2">Your Custom Foods</div>`;
        html += buildRows(customVisible);
    }
    if (globalVisible.length > 0) {
        if (customVisible.length > 0) {
            html += `<div class="catalog-section-label px-1 pt-3">Food Catalog</div>`;
        }
        html += buildRows(globalVisible);
    }
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll(".js-edit-food").forEach((button) => {
        button.addEventListener("click", () => {
            const item = foodCatalogState.items.find((entry) => entry.food_id === button.dataset.foodId);
            populateFoodForm(item);
            openFoodFormModal();
        });
    });

    container.querySelectorAll(".js-delete-food").forEach((button) => {
        button.addEventListener("click", async () => {
            await deleteFoodItem(button.dataset.foodId);
        });
    });

    setupFoodCatalogMobileInteractions(container);
}

function setupFoodCatalogMobileInteractions(container) {
    container.querySelectorAll('.food-item-menu-btn').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const foodId = event.currentTarget.getAttribute('data-food-id');
            const menu = container.querySelector(`.food-item-menu[data-food-id="${foodId}"]`);

            container.querySelectorAll('.food-item-menu').forEach((m) => {
                if (m !== menu) {
                    m.classList.remove('open');
                }
            });

            if (menu) {
                const opened = menu.classList.toggle('open');
                event.currentTarget.setAttribute('aria-expanded', opened ? 'true' : 'false');
                
                if (opened) {
                    // Calculate position for fixed positioning
                    const rect = event.currentTarget.getBoundingClientRect();
                    const menuWidth = 148;
                    const offset = 6;
                    
                    // Position below button, align right edge with button right edge
                    let top = rect.bottom + offset;
                    let left = rect.right - menuWidth;
                    
                    // Adjust if menu goes off-screen on the left
                    if (left < 10) {
                        left = 10;
                    }
                    
                    // Adjust if menu goes off-screen on the right
                    if (left + menuWidth > window.innerWidth - 10) {
                        left = window.innerWidth - menuWidth - 10;
                    }
                    
                    menu.style.top = top + 'px';
                    menu.style.left = left + 'px';
                }
            }
        });
    });

    if (!foodCatalogState.menuOutsideBound) {
        document.addEventListener('click', () => {
            document.querySelectorAll('.food-item-menu').forEach((menu) => menu.classList.remove('open'));
            document.querySelectorAll('.food-item-menu-btn').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
        });
        foodCatalogState.menuOutsideBound = true;
    }

    container.querySelectorAll('.js-food-action-edit').forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const foodId = event.currentTarget.getAttribute('data-food-id');
            const item = foodCatalogState.items.find((entry) => entry.food_id === foodId);
            if (item) {
                populateFoodForm(item);
                openFoodFormModal();
            }
        });
    });

    container.querySelectorAll('.js-food-action-delete').forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const foodId = event.currentTarget.getAttribute('data-food-id');
            await deleteFoodItem(foodId);
        });
    });

    // Add swipe delete on touch devices up to 991px (mobile + tablet) — admin only
    if ('ontouchstart' in window) {
        addFoodCatalogSwipeDelete();
    }
}

function addFoodCatalogSwipeDelete() {
    if (foodCatalogState.swipeHandlersBound) {
        return;
    }

    foodCatalogState.swipeHandlersBound = true;

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;
    let swipeElement = null;
    let swipeOverlay = null;

    document.addEventListener('touchstart', (event) => {
        if (!window.matchMedia('(max-width: 991px)').matches) {
            return;
        }

        const card = event.target.closest('.food-catalog-entry-card');
        if (!card) {
            return;
        }

        swipeElement = card;
        swipeOverlay = swipeElement.querySelector('.food-catalog-swipe-overlay');
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        currentX = startX;
        isSwiping = false;

        swipeElement.style.transform = '';
        if (swipeOverlay) {
            swipeOverlay.style.width = '0';
        }
    });

    document.addEventListener('touchmove', (event) => {
        if (!window.matchMedia('(max-width: 991px)').matches || !swipeElement) {
            return;
        }

        currentX = event.touches[0].clientX;
        const currentY = event.touches[0].clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            isSwiping = true;

            if (deltaX < 0 && swipeOverlay) {
                const swipeDistance = Math.abs(deltaX);
                const maxWidth = swipeElement.offsetWidth * 0.8;
                swipeOverlay.style.width = `${Math.min(swipeDistance, maxWidth)}px`;
            }

            event.preventDefault();
        }
    });

    document.addEventListener('touchend', async () => {
        if (!window.matchMedia('(max-width: 991px)').matches) {
            swipeElement = null;
            isSwiping = false;
            return;
        }

        if (!swipeElement || !isSwiping) {
            if (swipeElement && swipeOverlay) {
                swipeOverlay.style.width = '0';
            }
            swipeElement = null;
            return;
        }

        const deltaX = currentX - startX;
        const foodId = swipeElement.getAttribute('data-food-id');

        if (deltaX < -80 && foodId) {
            await deleteFoodItem(foodId);
        }

        if (swipeOverlay) {
            swipeOverlay.style.width = '0';
        }
        swipeElement = null;
        isSwiping = false;
    });
}

async function saveFoodItem() {
    hideStatusMessage();

    const values = getFoodFormValues();
    const validationMessage = validateFoodForm(values);
    if (validationMessage) {
        showStatusMessage(validationMessage, "warning");
        return;
    }

    const imageFile = getEl("foodImage")?.files?.[0] || null;

    setSaveButtonState(true);

    try {
        let imagePath = foodCatalogState.currentImagePath || "";
        const successMessage = foodCatalogState.editingFoodId
            ? "Food item updated successfully."
            : "Food item added successfully.";

        // Only upload when the admin selects a new image. The table stores the storage path, not a public URL.
        if (imageFile) {
            imagePath = await uploadFoodImage(imageFile);
        }

        const payload = {
            food_name: values.food_name,
            quantity: values.quantity,
            unit_of_quantity: values.unit_of_quantity,
            carbs: values.carbs,
            protein: values.protein,
            fats: values.fats,
            fibre: values.fibre,
            image_path: imagePath || null,
            updated_at: new Date().toISOString()
        };

        if (foodCatalogState.editingFoodId) {
            const { error } = await window.supabaseClient
                .from("food_catalog")
                .update(payload)
                .eq("food_id", foodCatalogState.editingFoodId);

            if (error) {
                throw new Error(error.message);
            }
        } else {
            payload.is_custom = !foodCatalogState.isAdmin;
            payload.created_by_user_id = payload.is_custom ? foodCatalogState.currentUserId : null;

            const { error } = await window.supabaseClient
                .from("food_catalog")
                .insert(payload);

            if (error) {
                throw new Error(error.message);
            }
        }

        await loadFoodCatalog();
        resetFoodForm();
        closeFoodFormModal();
        await showDialogAlert(successMessage, { title: "Success" });
    } catch (error) {
        console.error("saveFoodItem error:", error);
        showStatusMessage(error.message || "Failed to save food item.", "danger");
    } finally {
        setSaveButtonState(false);
    }
}

function bindFoodCatalogEvents() {
    const form = getEl("foodCatalogForm");
    const cancelBtn = getEl("foodCancelBtn");
    const refreshBtn = getEl("foodRefreshBtn");
    const addNewBtn = getEl("foodAddNewBtn");
    const imageInput = getEl("foodImage");
    const imageSelectBtn = getEl("foodImageSelectBtn");
    const sortMenu = getEl("foodSortMenu");
    const searchInput = getEl("foodSearchInput");
    const modalEl = getEl("foodFormModal");

    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            await saveFoodItem();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            closeFoodFormModal();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            hideStatusMessage();
            try {
                await loadFoodCatalog();
            } catch (error) {
                console.error("refresh food catalog error:", error);
                await showDialogAlert(error.message || "Failed to refresh food catalog.", { title: "Refresh Failed" });
            }
        });
    }

    if (addNewBtn) {
        addNewBtn.addEventListener("click", () => {
            resetFoodForm();
            openFoodFormModal();
        });
    }

    if (imageInput) {
        imageInput.addEventListener("change", () => {
            const file = imageInput.files && imageInput.files[0];
            if (!file) {
                updateImageFileName("No file chosen");
                updateImagePreview(foodCatalogState.currentImagePath || "");
                return;
            }

            updateImageFileName(file.name);
            const previewUrl = URL.createObjectURL(file);
            updateImagePreview("", previewUrl);
        });
    }

    if (imageSelectBtn && imageInput) {
        imageSelectBtn.addEventListener("click", () => {
            imageInput.click();
        });
    }

    if (sortMenu) {
        sortMenu.querySelectorAll(".js-sort-option").forEach((sortBtn) => {
            sortBtn.addEventListener("click", () => {
                foodCatalogState.sortBy = sortBtn.dataset.sort || "date_desc";
                renderFoodCatalogTable(foodCatalogState.items);
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            foodCatalogState.searchTerm = searchInput.value;
            renderSearchSuggestions(searchInput.value);
            renderFoodCatalogTable(foodCatalogState.items);
        });

        searchInput.addEventListener("focus", () => {
            renderSearchSuggestions(searchInput.value);
        });

        searchInput.addEventListener("blur", () => {
            const suggestionEl = getEl("foodSearchSuggestions");
            window.setTimeout(() => {
                if (suggestionEl) {
                    suggestionEl.style.display = "none";
                }
            }, 120);
        });
    }

    if (modalEl && window.jQuery && window.jQuery.fn.modal) {
        window.jQuery(modalEl).on("hidden.bs.modal", () => {
            resetFoodForm();
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireLoginOrRedirect();
    if (!user) return;

    // Determine role — admins can create/edit/delete; clients view only
    const accessState = await window.getAccessState({ user });
    foodCatalogState.isAdmin = Boolean(accessState?.isAdmin);
    foodCatalogState.currentUserId = user.id || "";

    // Keep add action available for all users; non-admin saves create custom foods.
    const addNewBtn = getEl("foodAddNewBtn");
    if (addNewBtn && !foodCatalogState.isAdmin) {
        addNewBtn.innerHTML = '<i class="fa fa-plus"></i> Add Custom Food';
    }

    if (!foodCatalogState.isAdmin) {
        const pageTitle = document.querySelector(".diet-page-title");
        if (pageTitle) {
            pageTitle.textContent = "Food Catalog";
        }

        document.querySelectorAll(".food-catalog-admin-only").forEach((el) => {
            if (el !== addNewBtn) {
                el.style.display = "none";
            }
        });
    }

    bindFoodCatalogEvents();
    resetFoodForm();

    try {
        await loadFoodCatalog();
    } catch (error) {
        console.error("initial loadFoodCatalog error:", error);
        await showDialogAlert(error.message || "Failed to load food catalog.", { title: "Load Failed" });
    }
});

window.loadFoodCatalog = loadFoodCatalog;
window.populateFoodForm = populateFoodForm;
window.resetFoodForm = resetFoodForm;
window.uploadFoodImage = uploadFoodImage;
window.saveFoodItem = saveFoodItem;
window.renderFoodCatalogTable = renderFoodCatalogTable;
window.deleteFoodItem = deleteFoodItem;
