const DIET_STATE = {
    users: [],
    foodCatalog: [],
    selectedUserId: "",
    selectedChartId: "",
    addFoodTargetRow: null,
    mealCounter: 0,
    activeAdminId: "",
    currentUserId: "",
    isAdmin: false,
    isEditMode: false,
    hasUnsavedChanges: false,
    isSyncingView: false,
    swipeHandlersBound: false,
    reopenCatalogModalAfterCreateFood: false,
    viewMealMenuOutsideBound: false,
    skipChartMetaUpdate: false,
    currentChartData: null,
    chartInstance: null,
    selectedUserMeta: {
        bmr: null,
        tdee: null
    }
};

function setDietDirty(isDirty) {
    DIET_STATE.hasUnsavedChanges = Boolean(isDirty);

    const saveBar = getEl("dietViewSaveBar");
    if (saveBar) {
        saveBar.style.display = DIET_STATE.hasUnsavedChanges ? "flex" : "none";
    }
}

function setViewSaveLoading(isLoading) {
    DIET_STATE.isSyncingView = Boolean(isLoading);

    const saveBtn = getEl("dietViewSaveBtn");
    if (!saveBtn) {
        return;
    }

    saveBtn.disabled = DIET_STATE.isSyncingView;
    saveBtn.innerHTML = DIET_STATE.isSyncingView
        ? '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...'
        : '<i class="fa fa-save mr-1"></i> Save';
}

function getEl(id) {
    return document.getElementById(id);
}

function getCatalogCustomOwnerId() {
    if (DIET_STATE.isAdmin) {
        return DIET_STATE.selectedUserId || DIET_STATE.currentChartData?.chart?.user_id || "";
    }
    return DIET_STATE.currentUserId || "";
}

function updateCustomFoodScopeUi() {
    const scopeSwitch = getEl("cfScopeGlobalSwitch");
    if (!scopeSwitch) {
        return;
    }
}

function showDietAlert(message, options = {}) {
    return window.tyfitDialog.alert({
        message,
        ...options
    });
}

function showDietConfirm(message, options = {}) {
    return window.tyfitDialog.confirm({
        message,
        ...options
    });
}

function toNumber(value, defaultValue = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function formatMacro(value) {
    return toNumber(value, 0).toFixed(1).replace(/\.0$/, "");
}

function showPageStatus(message, type = "info") {
    const statusEl = getEl("dietChartPageStatus");
    if (!statusEl) {
        return;
    }

    statusEl.className = `alert alert-${type}`;
    statusEl.textContent = message;
    statusEl.style.display = "block";
}

function hidePageStatus() {
    const statusEl = getEl("dietChartPageStatus");
    if (!statusEl) {
        return;
    }

    statusEl.style.display = "none";
    statusEl.textContent = "";
    statusEl.className = "alert";
}

function showLoadingSpinner() {
    const spinnerEl = getEl("dietChartLoadingSpinner");
    if (spinnerEl) {
        spinnerEl.style.display = "flex";
    }
}

function hideLoadingSpinner() {
    const spinnerEl = getEl("dietChartLoadingSpinner");
    if (spinnerEl) {
        spinnerEl.style.display = "none";
    }
}

function setEditorVisibility(showEditor) {
    const editorEl = getEl("dietChartEditor");
    const viewEl = getEl("dietChartView");
    const emptyStateEl = getEl("dietChartEmptyState");
    const viewBtn = getEl("dietViewModeBtn");
    const editBtn = getEl("dietEditModeBtn");

    if (viewBtn) {
        viewBtn.style.display = showEditor ? "inline-flex" : "none";
        viewBtn.classList.toggle("active", !DIET_STATE.isEditMode);
    }

    if (editBtn) {
        editBtn.style.display = showEditor ? "inline-flex" : "none";
        editBtn.classList.toggle("active", DIET_STATE.isEditMode);
    }

    if (!showEditor) {
        if (editorEl) {
            editorEl.style.display = "none";
        }

        if (viewEl) {
            viewEl.style.display = "none";
        }

        if (emptyStateEl) {
            emptyStateEl.style.display = "block";
        }

        const deleteBtnHidden = getEl("deleteDietChartBtn");
        if (deleteBtnHidden) {
            deleteBtnHidden.style.display = "none";
        }

        setDietDirty(false);

        return;
    }

    if (editorEl) {
        editorEl.style.display = DIET_STATE.isEditMode ? "block" : "none";
    }

    if (viewEl) {
        viewEl.style.display = DIET_STATE.isEditMode ? "none" : "block";
    }

    if (emptyStateEl) {
        emptyStateEl.style.display = "none";
    }

    const deleteBtn = getEl("deleteDietChartBtn");
    if (deleteBtn) {
        deleteBtn.style.display = DIET_STATE.isEditMode && DIET_STATE.selectedChartId ? "inline-flex" : "none";
    }
}

function setDietMode(isEditMode) {
    DIET_STATE.isEditMode = Boolean(isEditMode);

    const hasChart = Boolean(DIET_STATE.selectedChartId) || (DIET_STATE.currentChartData && DIET_STATE.selectedUserId);
    setEditorVisibility(Boolean(hasChart));
}

function getComputedFromItem(item) {
    const quantity = toNumber(item?.quantity, 0);
    const referenceQuantity = toNumber(item?.reference_quantity, 0);
    const factor = referenceQuantity > 0 ? quantity / referenceQuantity : 0;

    const carbs = toNumber(item?.reference_carbs, 0) * factor;
    const protein = toNumber(item?.reference_protein, 0) * factor;
    const fats = toNumber(item?.reference_fat, 0) * factor;
    const fibre = toNumber(item?.reference_fibre, 0) * factor;
    const calories = (carbs * 4) + (protein * 4) + (fats * 9);

    return { carbs, protein, fats, fibre, calories };
}

function hasFibreValue(item) {
    return item?.reference_fibre !== null && item?.reference_fibre !== undefined && item?.reference_fibre !== "";
}

async function loadSelectedUserMeta(userId) {
    if (!userId) {
        DIET_STATE.selectedUserMeta = { bmr: null, tdee: null };
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("bmr, tdee")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("loadSelectedUserMeta error:", error);
        DIET_STATE.selectedUserMeta = { bmr: null, tdee: null };
        return;
    }

    DIET_STATE.selectedUserMeta = {
        bmr: data?.bmr ?? null,
        tdee: data?.tdee ?? null
    };
}

function renderDietChartView(chartData) {
        const viewEl = getEl("dietChartView");
        if (!viewEl) {
            return;
        }

        DIET_STATE.currentChartData = chartData;

        const meals = chartData?.meals || [];
        let overall = { carbs: 0, protein: 0, fats: 0, calories: 0 };

        const mealsHtml = meals.map((meal, mealIndex) => {
            let mealTotals = { carbs: 0, protein: 0, fats: 0, calories: 0 };

            const itemCards = (meal.items || []).map((item, itemIndex) => {
                const computed = getComputedFromItem(item);
                mealTotals.carbs += computed.carbs;
                mealTotals.protein += computed.protein;
                mealTotals.fats += computed.fats;
                mealTotals.calories += computed.calories;

                return `
                    <div class="diet-view-item">
                        <div class="diet-view-item-card">
                            <div class="diet-view-item-top">
                                <div class="diet-view-item-title">
                                    <span class="diet-item-dot"></span>
                                    <span class="diet-view-item-name">${escapeHtml(item.food_name || "-")}</span>
                                </div>
                                <div class="diet-view-item-calories">${formatMacro(computed.calories)} kcal</div>
                            </div>
                            <div class="diet-view-item-qty">
                                <span class="diet-item-quantity">${formatMacro(item.quantity)}</span>
                                <span class="diet-item-unit">${escapeHtml(item.quantity_unit || item.reference_unit || "")}</span>
                            </div>
                            <div class="diet-view-item-macros">
                                <span class="diet-view-macro carbs"><i class="fa fa-bolt"></i> C:${formatMacro(computed.carbs)} g</span>
                                <span class="diet-view-macro protein"><i class="fa fa-dumbbell"></i> P:${formatMacro(computed.protein)} g</span>
                                <span class="diet-view-macro fats"><i class="fa fa-tint"></i> F:${formatMacro(computed.fats)} g</span>
                                <div class="diet-view-item-actions">
                                    <button type="button" class="diet-item-delete-btn" data-meal-index="${mealIndex}" data-item-index="${itemIndex}" aria-label="Delete food item">
                                        <i class="fa fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="diet-swipe-overlay">
                                <i class="fa fa-trash-alt"></i>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");

            overall.carbs += mealTotals.carbs;
            overall.protein += mealTotals.protein;
            overall.fats += mealTotals.fats;
            overall.calories += mealTotals.calories;

            return `
                <div class="diet-view-meal-block">
                    <div class="diet-view-meal-header">
                        <div class="diet-view-meal-label-wrap">
                            <span class="diet-view-meal-label js-meal-name-label" data-meal-index="${mealIndex}">${escapeHtml(meal.meal_name || `Meal ${mealIndex + 1}`)}</span>
                            <div class="diet-meal-name-edit-wrap" style="display: none;">
                                <input type="text" class="form-control form-control-sm diet-meal-name-inline-input" data-meal-index="${mealIndex}" value="${escapeHtml(meal.meal_name || `Meal ${mealIndex + 1}`)}">
                                <button type="button" class="diet-meal-name-save-btn" data-meal-index="${mealIndex}" aria-label="Save meal name" title="Save meal name">
                                    <i class="fa fa-check"></i>
                                </button>
                            </div>
                        </div>
                        <div class="diet-view-meal-header-actions">
                            <button type="button" class="diet-meal-add-btn" data-meal-index="${mealIndex}" aria-label="Add food item">
                                <i class="fa fa-plus"></i>
                            </button>
                            <div class="diet-meal-menu-wrap" data-meal-index="${mealIndex}">
                                <button type="button" class="diet-meal-menu-btn" data-meal-index="${mealIndex}" aria-label="Meal actions" aria-expanded="false">
                                    <i class="fa fa-ellipsis-v"></i>
                                </button>
                                <div class="diet-meal-menu" data-meal-index="${mealIndex}">
                                    <button type="button" class="diet-meal-menu-item js-meal-action-edit" data-meal-index="${mealIndex}">
                                        <i class="fa fa-pencil-alt"></i> Edit meal
                                    </button>
                                    <button type="button" class="diet-meal-menu-item danger js-meal-action-delete" data-meal-index="${mealIndex}">
                                        <i class="fa fa-trash-alt"></i> Delete meal
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="diet-view-meal-content">
                        ${itemCards || '<div class="text-center text-muted" style="padding: 20px;">No items</div>'}
                    </div>
                    <div class="diet-view-meal-totals">
                        <span class="diet-view-meal-total-chip protein"><i class="fa fa-dumbbell"></i> Total Protein: ${formatMacro(mealTotals.protein)} g</span>
                        <span class="diet-view-meal-total-chip calories"><i class="fa fa-fire"></i> Total Calories: ${formatMacro(mealTotals.calories)} kcal</span>
                    </div>
                </div>
            `;
        }).join("");

        viewEl.innerHTML = `
            <div class="diet-view-container">
                <div class="diet-view-chart-card">
                    <div class="diet-view-chart-title mb-3">Macros Distribution</div>
                    <div class="diet-view-chart-container">
                        <div class="diet-chart-wrapper">
                            <canvas id="dietMacroChart"></canvas>
                        </div>
                        <div class="diet-view-chart-stats">
                            <div class="chart-stat-row carbs">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Carbs</span>
                                <span class="chart-stat-value carbs">${formatMacro(overall.carbs)} gms</span>
                            </div>
                            <div class="chart-stat-row protein">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Protein</span>
                                <span class="chart-stat-value protein">${formatMacro(overall.protein)} gms</span>
                            </div>
                            <div class="chart-stat-row fats">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Fats</span>
                                <span class="chart-stat-value fats">${formatMacro(overall.fats)} gms</span>
                            </div>
                            <div class="chart-stat-row calories total">
                                <span class="chart-stat-color"></span>
                                <span class="chart-stat-label">Total Calories</span>
                                <span class="chart-stat-value calories">${formatMacro(overall.calories)} kcal</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="diet-view-meals">
                    ${mealsHtml || '<p class="text-muted mb-0">No meals in this diet chart.</p>'}
                </div>
                <div class="diet-view-add-meal-row">
                    <button type="button" id="dietViewAddMealBtn" class="diet-view-add-meal-btn">
                        <i class="fa fa-plus mr-2"></i> Add New Meal
                    </button>
                </div>
            </div>
        `;

        setTimeout(() => {
            renderMacroPieChart(overall);
        }, 100);

        setTimeout(() => {
            setupViewModeEventHandlers();
        }, 100);
    }

    function setupViewModeEventHandlers() {
        document.querySelectorAll('.diet-meal-menu-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = event.currentTarget.getAttribute('data-meal-index');
                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);

                document.querySelectorAll('.diet-meal-menu').forEach((m) => {
                    if (m !== menu) {
                        m.classList.remove('open');
                    }
                });

                if (menu) {
                    const opened = menu.classList.toggle('open');
                    event.currentTarget.setAttribute('aria-expanded', opened ? 'true' : 'false');
                }
            });
        });

        if (!DIET_STATE.viewMealMenuOutsideBound) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.diet-meal-menu').forEach((menu) => menu.classList.remove('open'));
                document.querySelectorAll('.diet-meal-menu-btn').forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
            });
            DIET_STATE.viewMealMenuOutsideBound = true;
        }

        document.querySelectorAll('.js-meal-action-edit').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const label = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"]`);
                const input = document.querySelector(`.diet-meal-name-inline-input[data-meal-index="${mealIndex}"]`);
                const editWrap = input ? input.closest('.diet-meal-name-edit-wrap') : null;
                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);

                if (!label || !input) {
                    return;
                }

                if (menu) {
                    menu.classList.remove('open');
                }

                label.style.display = 'none';
                if (editWrap) {
                    editWrap.style.display = 'inline-flex';
                }
                input.focus();
                input.select();
            });
        });

        document.querySelectorAll('.js-meal-action-delete').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const menu = document.querySelector(`.diet-meal-menu[data-meal-index="${mealIndex}"]`);
                if (menu) {
                    menu.classList.remove('open');
                }
                showDeleteMealConfirmationModal(mealIndex);
            });
        });

        document.querySelectorAll('.diet-meal-name-inline-input').forEach((input) => {
            const submit = async () => {
                const mealIndex = parseInt(input.getAttribute('data-meal-index'), 10);
                const label = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"]`);
                const editWrap = input.closest('.diet-meal-name-edit-wrap');
                const newName = (input.value || '').trim();

                if (!newName) {
                    input.value = label ? label.textContent : `Meal ${mealIndex + 1}`;
                }

                if (label) {
                    label.style.display = 'inline-block';
                }
                if (editWrap) {
                    editWrap.style.display = 'none';
                }

                if (newName) {
                    await renameMealInViewChart(mealIndex, newName);
                }
            };

            input.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    await submit();
                }
                if (event.key === 'Escape') {
                    const mealIndex = parseInt(input.getAttribute('data-meal-index'), 10);
                    const label = document.querySelector(`.js-meal-name-label[data-meal-index="${mealIndex}"]`);
                    const editWrap = input.closest('.diet-meal-name-edit-wrap');
                    input.value = label ? label.textContent : '';
                    if (editWrap) {
                        editWrap.style.display = 'none';
                    }
                    if (label) {
                        label.style.display = 'inline-block';
                    }
                }
            });

            input.addEventListener('blur', async () => {
                const editWrap = input.closest('.diet-meal-name-edit-wrap');
                if (editWrap && editWrap.style.display !== 'none') {
                    await submit();
                }
            });
        });

        document.querySelectorAll('.diet-meal-name-save-btn').forEach((saveBtn) => {
            saveBtn.addEventListener('mousedown', (event) => {
                event.preventDefault();
            });
            saveBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const mealIndex = parseInt(saveBtn.getAttribute('data-meal-index'), 10);
                const input = document.querySelector(`.diet-meal-name-inline-input[data-meal-index="${mealIndex}"]`);
                if (input) {
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                }
            });
        });

        document.querySelectorAll('.diet-meal-add-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                openFoodCatalogModalForMeal(mealIndex);
            });
        });

        const addMealBtn = document.getElementById('dietViewAddMealBtn');
        if (addMealBtn) {
            addMealBtn.addEventListener('click', () => {
                addMealToViewChart();
            });
        }

        document.querySelectorAll('.diet-item-delete-btn').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const mealIndex = parseInt(event.currentTarget.getAttribute('data-meal-index'), 10);
                const itemIndex = parseInt(event.currentTarget.getAttribute('data-item-index'), 10);
                showDeleteConfirmationModal(mealIndex, itemIndex);
            });
        });

        if ('ontouchstart' in window && window.matchMedia('(max-width: 991px)').matches) {
            addSwipeFunctionality();
        }
    }

    function addSwipeFunctionality() {
        if (DIET_STATE.swipeHandlersBound) {
            return;
        }

        DIET_STATE.swipeHandlersBound = true;

        let startX, startY, currentX, currentY;
        let isSwiping = false;
        let swipeElement = null;
        let swipeDirection = null;
        let swipeOverlay = null;

        document.addEventListener('touchstart', (e) => {
            if (!window.matchMedia('(max-width: 991px)').matches) {
                return;
            }

            if (e.target.closest('.diet-view-item-card')) {
                swipeElement = e.target.closest('.diet-view-item-card');
                swipeOverlay = swipeElement.querySelector('.diet-swipe-overlay');
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                isSwiping = false;
                swipeDirection = null;

                swipeElement.style.transform = '';
                if (swipeOverlay) {
                    swipeOverlay.style.width = '0';
                }
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (!window.matchMedia('(max-width: 991px)').matches) {
                return;
            }

            if (!swipeElement) {
                return;
            }

            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;

            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
                isSwiping = true;
                swipeDirection = deltaX > 0 ? 'right' : 'left';

                if (swipeDirection === 'left' && swipeOverlay) {
                    const swipeDistance = Math.abs(deltaX);
                    const maxWidth = swipeElement.offsetWidth * 0.8;
                    const overlayWidth = Math.min(swipeDistance, maxWidth);
                    swipeOverlay.style.width = `${overlayWidth}px`;
                } else {
                    const translateX = Math.min(Math.max(deltaX, -100), 100);
                    swipeElement.style.transform = `translateX(${translateX}px)`;
                }

                e.preventDefault();
            }
        });

        document.addEventListener('touchend', () => {
            if (!window.matchMedia('(max-width: 991px)').matches) {
                swipeElement = null;
                isSwiping = false;
                return;
            }

            if (!swipeElement || !isSwiping) {
                if (swipeElement) {
                    swipeElement.style.transform = '';
                    if (swipeOverlay) {
                        swipeOverlay.style.width = '0';
                    }
                }
                swipeElement = null;
                return;
            }

            const deltaX = currentX - startX;
            const mealIndex = parseInt(swipeElement.querySelector('.diet-item-delete-btn')?.getAttribute('data-meal-index'), 10);
            const itemIndex = parseInt(swipeElement.querySelector('.diet-item-delete-btn')?.getAttribute('data-item-index'), 10);

            if (Math.abs(deltaX) > 80) {
                if (swipeDirection === 'left') {
                    showDeleteConfirmationModal(mealIndex, itemIndex);
                } else if (swipeDirection === 'right') {
                    editFoodItem(mealIndex, itemIndex);
                }
            }

            swipeElement.style.transform = '';
            if (swipeOverlay) {
                swipeOverlay.style.width = '0';
            }
            swipeElement = null;
            isSwiping = false;
        });
    }

function showDeleteConfirmationModal(mealIndex, itemIndex) {
    // Store the indices for when user confirms
    const modal = document.getElementById('deleteFoodModal');
    if (modal) {
        modal.setAttribute('data-meal-index', mealIndex);
        modal.setAttribute('data-item-index', itemIndex);
        $('#deleteFoodModal').modal('show');
    }
}

function confirmDeleteFoodItem() {
    const modal = document.getElementById('deleteFoodModal');
    if (modal) {
        const mealIndex = parseInt(modal.getAttribute('data-meal-index'));
        const itemIndex = parseInt(modal.getAttribute('data-item-index'));
        if (!isNaN(mealIndex) && !isNaN(itemIndex)) {
            deleteFoodItem(mealIndex, itemIndex);
        }
        $('#deleteFoodModal').modal('hide');
    }
}

async function openFoodCatalogModalForMeal(mealIndex) {
    const modal = getEl("selectFoodModal");
    if (!modal || Number.isNaN(mealIndex)) {
        return;
    }

    modal.setAttribute("data-meal-index", String(mealIndex));
    const searchInput = getEl("foodSearchInput");
    if (searchInput) {
        searchInput.value = "";
    }

    await renderFoodCatalogModalList("");

    if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery("#selectFoodModal").modal("show");
    }
}

async function renderFoodCatalogModalList(searchTerm = "") {
    const listEl = getEl("foodCatalogList");
    if (!listEl) {
        return;
    }

    try {
        const foods = await loadFoodCatalogOptions(searchTerm);

        if (!foods || foods.length === 0) {
            listEl.innerHTML = '<div class="food-catalog-empty text-center text-muted py-4">No foods found.</div>';
            return;
        }

        const userId = getCatalogCustomOwnerId();
        const customFoods = foods.filter((f) => f.is_custom && f.created_by_user_id === userId);
        const globalFoods = foods.filter((f) => !f.is_custom);

        const renderCard = (food) => {
            const foodId = escapeHtml(food.food_id);
            const unit = escapeHtml(food.unit_of_quantity || "");
            const referenceQty = toNumber(food.quantity, 0);
            const initialQty = referenceQty > 0 ? referenceQty : 1;
            const carbs = toNumber(food.carbs, 0);
            const protein = toNumber(food.protein, 0);
            const fats = toNumber(food.fats, 0);
            const calories = (carbs * 4) + (protein * 4) + (fats * 9);

            return `
                <div class="diet-catalog-pick-card" data-food-id="${foodId}">
                    <div class="diet-catalog-pick-top">
                        <div class="diet-catalog-pick-title">
                            <span class="diet-item-dot"></span>
                            <span class="diet-catalog-pick-name">${escapeHtml(food.food_name || "Unnamed Food")}</span>
                            <span class="diet-catalog-ref-qty">${formatMacro(initialQty)}&thinsp;${unit}</span>
                        </div>
                        <div class="diet-catalog-pick-calories">${formatMacro(calories)} kcal</div>
                    </div>
                    <div class="diet-catalog-pick-macros">
                        <span class="diet-view-macro carbs"><i class="fa fa-bolt"></i> C:${formatMacro(carbs)} gms</span>
                        <span class="diet-view-macro protein"><i class="fa fa-dumbbell"></i> P:${formatMacro(protein)} gms</span>
                        <span class="diet-view-macro fats"><i class="fa fa-tint"></i> F:${formatMacro(fats)} gms</span>
                    </div>
                    <div class="diet-catalog-pick-footer">
                        <div class="diet-catalog-qty-row">
                            <button type="button" class="diet-catalog-qty-btn js-catalog-qty-minus" data-food-id="${foodId}" aria-label="Decrease quantity">
                                <i class="fa fa-minus"></i>
                            </button>
                            <input type="number" class="food-catalog-qty-input" value="${formatMacro(initialQty)}" min="0.01" step="0.01" data-food-id="${foodId}" aria-label="Quantity">
                            <span class="diet-catalog-unit-pill">${unit}</span>
                            <button type="button" class="diet-catalog-qty-btn js-catalog-qty-plus" data-food-id="${foodId}" aria-label="Increase quantity">
                                <i class="fa fa-plus"></i>
                            </button>
                        </div>
                        <button type="button" class="diet-catalog-add-btn js-add-food-catalog-item" data-food-id="${foodId}">
                            <i class="fa fa-plus mr-1"></i> Add
                        </button>
                    </div>
                </div>
            `;
        };

        let html = "";

        if (customFoods.length > 0) {
            html += `<div class="catalog-section-label">${DIET_STATE.isAdmin ? "Selected User Custom Foods" : "Your Custom Foods"}</div>`;
            html += customFoods.map(renderCard).join("");
        }

        if (globalFoods.length > 0) {
            html += `<div class="catalog-section-label${customFoods.length > 0 ? " mt-3" : ""}">Food Catalog</div>`;
            html += globalFoods.map(renderCard).join("");
        }

        if (!html) {
            html = '<div class="food-catalog-empty text-center text-muted py-4">No foods found.</div>';
        }

        listEl.innerHTML = html;
    } catch (error) {
        console.error("renderFoodCatalogModalList error:", error);
        listEl.innerHTML = '<div class="food-catalog-empty text-center text-danger py-4">Failed to load food catalog.</div>';
    }
}

function buildCatalogMacroPreview(food, quantity) {
    const referenceQty = toNumber(food.quantity, 0);
    const factor = referenceQty > 0 ? quantity / referenceQty : 0;
    const carbs = toNumber(food.carbs, 0) * factor;
    const protein = toNumber(food.protein, 0) * factor;
    const fats = toNumber(food.fats, 0) * factor;
    const calories = (carbs * 4) + (protein * 4) + (fats * 9);
    const unit = food.unit_of_quantity || "";

    return `${formatMacro(quantity)} ${unit} | C ${formatMacro(carbs)}g | P ${formatMacro(protein)}g | F ${formatMacro(fats)}g | ${formatMacro(calories)} kcal`;
}

async function addFoodFromCatalogToMeal(foodId, mealIndex, selectedQuantity) {
    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }

    const meal = DIET_STATE.currentChartData.meals[mealIndex];
    if (!meal) {
        return;
    }

    const selectedFood = DIET_STATE.foodCatalog.find((food) => String(food.food_id) === String(foodId));
    if (!selectedFood) {
        return;
    }

    if (!Array.isArray(meal.items)) {
        meal.items = [];
    }

    const quantity = toNumber(selectedQuantity, 0);
    if (quantity <= 0) {
        return;
    }

    const existingItem = meal.items.find((item) =>
        String(item.food_name || "").trim().toLowerCase() === String(selectedFood.food_name || "").trim().toLowerCase()
    );

    if (existingItem) {
        existingItem.quantity = toNumber(existingItem.quantity, 0) + quantity;
        existingItem.quantity_unit = selectedFood.unit_of_quantity || existingItem.quantity_unit || "g";
        existingItem.reference_quantity = toNumber(selectedFood.quantity, 0);
        existingItem.reference_unit = selectedFood.unit_of_quantity || "g";
        existingItem.reference_carbs = toNumber(selectedFood.carbs, 0);
        existingItem.reference_protein = toNumber(selectedFood.protein, 0);
        existingItem.reference_fat = toNumber(selectedFood.fats, 0);
        existingItem.reference_fibre = toNumber(selectedFood.fibre, 0);
    } else {
        meal.items.push({
            food_name: selectedFood.food_name,
            quantity,
            quantity_unit: selectedFood.unit_of_quantity || "g",
            reference_quantity: toNumber(selectedFood.quantity, 0),
            reference_unit: selectedFood.unit_of_quantity || "g",
            reference_carbs: toNumber(selectedFood.carbs, 0),
            reference_protein: toNumber(selectedFood.protein, 0),
            reference_fat: toNumber(selectedFood.fats, 0),
            reference_fibre: toNumber(selectedFood.fibre, 0)
        });
    }

    if (window.jQuery && window.jQuery.fn.modal) {
        window.jQuery("#selectFoodModal").modal("hide");
    }

    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

function showItemOptionsMenu(button, mealIndex, itemIndex) {
    // Create a simple dropdown menu for edit/delete options
    const existingMenu = document.querySelector('.item-options-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'item-options-menu';
    menu.innerHTML = `
        <button class="item-option-btn edit-btn" data-action="edit" data-meal="${mealIndex}" data-item="${itemIndex}">
            <i class="fa fa-edit"></i> Edit
        </button>
        <button class="item-option-btn delete-btn" data-action="delete" data-meal="${mealIndex}" data-item="${itemIndex}">
            <i class="fa fa-trash"></i> Delete
        </button>
    `;

    // Position the menu - try to position to the right first, fallback to left if not enough space
    const rect = button.getBoundingClientRect();
    const menuWidth = 120; // Approximate menu width
    const viewportWidth = window.innerWidth;
    
    let leftPos;
    if (rect.left + menuWidth + 10 < viewportWidth) {
        // Position to the right
        leftPos = rect.left;
    } else {
        // Position to the left
        leftPos = rect.left - menuWidth + rect.width;
    }
    
    menu.style.position = 'fixed'; // Use fixed positioning for better mobile support
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${leftPos}px`;
    menu.style.zIndex = '1000';

    document.body.appendChild(menu);

    // Handle menu option clicks
    menu.addEventListener('click', (event) => {
        const action = event.target.closest('.item-option-btn')?.getAttribute('data-action');
        const mealIdx = parseInt(event.target.closest('.item-option-btn')?.getAttribute('data-meal'));
        const itemIdx = parseInt(event.target.closest('.item-option-btn')?.getAttribute('data-item'));

        if (action === 'edit') {
            editFoodItem(mealIdx, itemIdx);
        } else if (action === 'delete') {
            deleteFoodItem(mealIdx, itemIdx);
        }

        menu.remove();
    });

    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== button) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

function editFoodItem(mealIndex, itemIndex) {
    // Switch to edit mode and focus on the specific item
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) {
        editModeBtn.click();
        // Could add logic here to scroll to and highlight the specific item
    }
}

async function deleteFoodItem(mealIndex, itemIndex) {
    if (DIET_STATE.currentChartData && DIET_STATE.currentChartData.meals) {
        DIET_STATE.currentChartData.meals[mealIndex].items.splice(itemIndex, 1);
        setDietDirty(true);
        renderDietChartView(DIET_STATE.currentChartData);
        await syncViewChartToSupabase();
    }
}

function addMealToViewChart() {
    if (!DIET_STATE.currentChartData) {
        return;
    }
    if (!Array.isArray(DIET_STATE.currentChartData.meals)) {
        DIET_STATE.currentChartData.meals = [];
    }
    const nextNum = DIET_STATE.currentChartData.meals.length + 1;
    DIET_STATE.currentChartData.meals.push({ meal_name: `Meal ${nextNum}`, sort_order: nextNum, items: [] });
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    syncViewChartToSupabase();
}

function showDeleteMealConfirmationModal(mealIndex) {
    const modal = document.getElementById('deleteMealModal');
    if (modal) {
        modal.setAttribute('data-meal-index', mealIndex);
        $('#deleteMealModal').modal('show');
    } else {
        // Fallback: delete directly without modal
        deleteMealFromViewChart(mealIndex);
    }
}

async function deleteMealFromViewChart(mealIndex) {
    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }
    DIET_STATE.currentChartData.meals.splice(mealIndex, 1);
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

async function renameMealInViewChart(mealIndex, newName) {
    if (!DIET_STATE.currentChartData || !Array.isArray(DIET_STATE.currentChartData.meals)) {
        return;
    }

    const meal = DIET_STATE.currentChartData.meals[mealIndex];
    if (!meal) {
        return;
    }

    const normalized = (newName || '').trim();
    if (!normalized) {
        return;
    }

    meal.meal_name = normalized;
    setDietDirty(true);
    renderDietChartView(DIET_STATE.currentChartData);
    await syncViewChartToSupabase();
}

async function ensureViewChartId() {
    if (DIET_STATE.selectedChartId) {
        return DIET_STATE.selectedChartId;
    }

    const userId = DIET_STATE.selectedUserId || DIET_STATE.currentChartData?.chart?.user_id;
    if (!userId) {
        throw new Error("No selected user for saving diet chart.");
    }

    const createdBy = DIET_STATE.activeAdminId || null;
    const { data, error } = await window.supabaseClient
        .from("diet_charts")
        .insert({
            user_id: userId,
            title: DIET_STATE.currentChartData?.chart?.title || "Diet Chart",
            notes: DIET_STATE.currentChartData?.chart?.notes || null,
            created_by: createdBy,
            updated_at: new Date().toISOString()
        })
        .select("id")
        .single();

    if (error) {
        throw new Error("Create failed: " + error.message);
    }

    DIET_STATE.selectedChartId = data.id;
    if (!DIET_STATE.currentChartData.chart) {
        DIET_STATE.currentChartData.chart = {};
    }
    DIET_STATE.currentChartData.chart.id = data.id;
    DIET_STATE.currentChartData.chart.user_id = userId;
    return data.id;
}

async function syncViewChartToSupabase() {
    const chartData = DIET_STATE.currentChartData;

    if (!chartData || !Array.isArray(chartData.meals)) {
        return false;
    }

    if (DIET_STATE.isSyncingView) {
        return false;
    }

    setViewSaveLoading(true);
    try {
        const chartId = await ensureViewChartId();

        if (!DIET_STATE.skipChartMetaUpdate) {
            const { error: chartUpdateError } = await window.supabaseClient
                .from("diet_charts")
                .update({
                    title: chartData?.chart?.title || "",
                    notes: chartData?.chart?.notes || null
                })
                .eq("id", chartId);

            if (chartUpdateError) {
                const chartErrorMsg = String(chartUpdateError.message || "").toLowerCase();
                const isStackDepthError = chartErrorMsg.includes("stack depth") && chartErrorMsg.includes("limit exceeded");

                if (isStackDepthError) {
                    DIET_STATE.skipChartMetaUpdate = true;
                    console.warn("Skipping diet_charts metadata update due to stack depth DB trigger.", chartUpdateError);
                } else {
                    throw new Error("Chart update failed: " + chartUpdateError.message);
                }
            }
        }

        const { data: existingMeals, error: fetchMealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .select("id")
            .eq("diet_chart_id", chartId);

        if (fetchMealsError) {
            throw new Error("Failed to fetch existing meals: " + fetchMealsError.message);
        }

        const existingMealIds = (existingMeals || []).map((meal) => meal.id);
        if (existingMealIds.length > 0) {
            const { error: deleteItemsError } = await window.supabaseClient
                .from("diet_chart_items")
                .delete()
                .in("meal_id", existingMealIds);

            if (deleteItemsError) {
                throw new Error("Failed to clear existing items: " + deleteItemsError.message);
            }
        }

        const { error: deleteMealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .delete()
            .eq("diet_chart_id", chartId);

        if (deleteMealsError) {
            throw new Error("Failed to clear existing meals: " + deleteMealsError.message);
        }

        for (let mealIndex = 0; mealIndex < chartData.meals.length; mealIndex += 1) {
            const mealPayload = chartData.meals[mealIndex];
            const { data: insertedMeal, error: mealInsertError } = await window.supabaseClient
                .from("diet_chart_meals")
                .insert({
                    diet_chart_id: chartId,
                    meal_name: mealPayload.meal_name || `Meal ${mealIndex + 1}`,
                    sort_order: mealIndex + 1
                })
                .select("id")
                .single();

            if (mealInsertError || !insertedMeal) {
                const mealErrMsg = String(mealInsertError?.message || "").toLowerCase();
                if (mealErrMsg.includes("stack depth") && mealErrMsg.includes("limit exceeded")) {
                    console.warn("Ignoring stack depth error on diet_chart_meals insert, skipping items for this meal.", mealInsertError);
                    continue;
                } else {
                    throw new Error("Meal save failed: " + (mealInsertError?.message || "no meal ID returned"));
                }
            }

            const mealItems = Array.isArray(mealPayload.items) ? mealPayload.items : [];
            if (mealItems.length > 0) {
                const itemsPayload = mealItems.map((item, itemIndex) => ({
                    meal_id: insertedMeal.id,
                    food_name: item.food_name || "",
                    quantity: toNumber(item.quantity, 0),
                    quantity_unit: item.quantity_unit || item.reference_unit || "",
                    reference_quantity: toNumber(item.reference_quantity, 0),
                    reference_unit: item.reference_unit || "",
                    reference_carbs: toNumber(item.reference_carbs, 0),
                    reference_protein: toNumber(item.reference_protein, 0),
                    reference_fat: toNumber(item.reference_fat, 0),
                    reference_fibre: toNumber(item.reference_fibre, 0),
                    sort_order: itemIndex + 1
                }));

                const { error: itemInsertError } = await window.supabaseClient
                    .from("diet_chart_items")
                    .insert(itemsPayload);

                if (itemInsertError) {
                    const itemErrMsg = String(itemInsertError.message || "").toLowerCase();
                    if (itemErrMsg.includes("stack depth") && itemErrMsg.includes("limit exceeded")) {
                        console.warn("Ignoring stack depth error on diet_chart_items insert.", itemInsertError);
                    } else {
                        throw new Error("Item save failed: " + itemInsertError.message);
                    }
                }
            }
        }

        setDietDirty(false);
        return true;
    } catch (error) {
        console.error("syncViewChartToSupabase error:", error);
        await showDietAlert(error.message || "Failed to sync diet chart changes.", { title: "Sync Failed" });

        if (DIET_STATE.selectedChartId) {
            try {
                const reloadedChart = await loadDietChart(DIET_STATE.selectedChartId);
                DIET_STATE.currentChartData = reloadedChart;
                renderDietChartView(reloadedChart);
                setDietDirty(true);
            } catch (reloadError) {
                console.error("sync reload error:", reloadError);
            }
        }

        return false;
    } finally {
        setViewSaveLoading(false);
    }
}

function renderMacroPieChart(macros) {
    const canvasEl = document.getElementById("dietMacroChart");
    if (!canvasEl) {
        return;
    }

    if (DIET_STATE.chartInstance) {
        DIET_STATE.chartInstance.destroy();
    }

    const colors = {
        carbs: "#c56a17",
        protein: "#1f8f57",
        fats: "#1f6db2"
    };

    const baseColors = [colors.carbs, colors.protein, colors.fats];
    const fadedColors = [
        "rgba(197,106,23,0.25)",
        "rgba(31,143,87,0.25)",
        "rgba(31,109,178,0.25)"
    ];

    DIET_STATE.chartInstance = new Chart(canvasEl, {
        type: "doughnut",
        data: {
            labels: ["Carbs", "Protein", "Fats"],
            datasets: [{
                data: [
                    toNumber(macros.carbs, 0),
                    toNumber(macros.protein, 0),
                    toNumber(macros.fats, 0)
                ],
                backgroundColor: baseColors,
                borderColor: ["transparent", "transparent", "transparent"],
                borderWidth: 0,
                hoverOffset: 14
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 700,
                easing: "easeOutQuart"
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.label + ": " + formatMacro(context.parsed) + " gms";
                        }
                    }
                }
            },
            cutout: "50%",
            onHover: function (event, activeElements) {
                const dataset = DIET_STATE.chartInstance.data.datasets[0];
                if (activeElements.length > 0) {
                    const activeIndex = activeElements[0].index;
                    dataset.backgroundColor = baseColors.map((color, index) => index === activeIndex ? color : fadedColors[index]);
                    canvasEl.style.cursor = "pointer";
                } else {
                    dataset.backgroundColor = baseColors;
                    canvasEl.style.cursor = "default";
                }

                DIET_STATE.chartInstance.update("none");
            }
        }
    });
}

function setSaveLoading(isLoading) {
    const saveBtn = getEl("saveDietChartBtn");
    if (!saveBtn) {
        return;
    }

    saveBtn.disabled = isLoading;
    saveBtn.innerHTML = isLoading
        ? '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...'
        : '<i class="fa fa-save mr-1"></i> Save Diet Chart';
}

function buildFoodOptionsHtml(selectedFoodId = "") {
    const options = ['<option value="">Select Food</option>'];

    DIET_STATE.foodCatalog.forEach((food) => {
        const selected = food.food_id === selectedFoodId ? "selected" : "";
        options.push(`<option value="${food.food_id}" ${selected}>${food.food_name}</option>`);
    });

    options.push('<option value="__add_new__">+ Add New Food</option>');
    return options.join("");
}

async function waitForStableSession(timeoutMs = 4000, intervalMs = 250) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        const { data, error } = await window.supabaseClient.auth.getSession();

        if (error) {
            return { session: null, error };
        }

        if (data?.session) {
            return { session: data.session, error: null };
        }

        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    return { session: null, error: null };
}

async function requireLoginOrRedirect() {
    if (typeof window.requireLoginWithModal === "function") {
        return window.requireLoginWithModal();
    }

    const { session, error } = await waitForStableSession();

    if (error) {
        await showDietAlert("Session error: " + error.message, { title: "Session Error" });
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

    await showDietAlert("You do not have access to the admin portal.", { title: "Access Restricted" });
    window.location.href = "../index.html";
    return false;
}

async function loadUsersList() {
    const selectEl = getEl("dietUserSelect");
    if (!selectEl) {
        return;
    }

    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, email, full_name, role")
        .order("email", { ascending: true });

    if (error) {
        console.error("loadUsersList error:", error);
        throw new Error("Failed to load users: " + error.message);
    }

    DIET_STATE.users = data || [];

    selectEl.innerHTML = '<option value="">Select user...</option>';
    DIET_STATE.users.forEach((user) => {
        const fullName = (user.full_name || "Unnamed User").trim();
        const roleText = user.role ? user.role.replace(/[_-]/g, " ") : "user";
        const roleLabel = roleText.charAt(0).toUpperCase() + roleText.slice(1);
        const label = `${fullName} - ${roleLabel}`;
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = label;
        selectEl.appendChild(option);
    });
}

async function loadFoodCatalogOptions(searchTerm = "") {
    // Always force a fresh load so newly created custom foods appear immediately
    await loadVisibleFoodCatalogItems();

    if (!searchTerm) {
        return DIET_STATE.foodCatalog;
    }

    const query = searchTerm.toLowerCase();
    return DIET_STATE.foodCatalog.filter((food) =>
        (food.food_name || "").toLowerCase().includes(query)
    );
}

async function loadVisibleFoodCatalogItems() {
    const userId = getCatalogCustomOwnerId();

    // Fetch global foods
    const { data: globalFoods, error: globalError } = await window.supabaseClient
        .from("food_catalog")
        .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
        .eq("is_custom", false)
        .order("food_name", { ascending: true });

    if (globalError) {
        console.error("loadVisibleFoodCatalogItems global error:", globalError);
        throw new Error("Failed to load food catalog: " + globalError.message);
    }

    let customFoods = [];
    if (userId) {
        const { data: myFoods, error: customError } = await window.supabaseClient
            .from("food_catalog")
            .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
            .eq("is_custom", true)
            .eq("created_by_user_id", userId)
            .order("food_name", { ascending: true });

        if (customError) {
            console.error("loadVisibleFoodCatalogItems custom error:", customError);
        } else {
            customFoods = myFoods || [];
        }
    }

    // Own custom foods first, then global
    DIET_STATE.foodCatalog = [...customFoods, ...(globalFoods || [])];
}

async function checkExistingDietChart(userId) {
    if (!userId) {
        return null;
    }

    const { data, error } = await window.supabaseClient
        .from("diet_charts")
        .select("id, user_id, title, notes, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("checkExistingDietChart error:", error);
        throw new Error("Failed to check diet chart: " + error.message);
    }

    return data && data.length > 0 ? data[0] : null;
}

async function loadDietChart(chartId) {
    const { data: chart, error: chartError } = await window.supabaseClient
        .from("diet_charts")
        .select("id, user_id, title, notes, created_at, updated_at")
        .eq("id", chartId)
        .single();

    if (chartError) {
        console.error("loadDietChart chart error:", chartError);
        throw new Error("Failed to load diet chart: " + chartError.message);
    }

    const { data: meals, error: mealsError } = await window.supabaseClient
        .from("diet_chart_meals")
        .select("id, diet_chart_id, meal_name, sort_order")
        .eq("diet_chart_id", chartId)
        .order("sort_order", { ascending: true });

    if (mealsError) {
        console.error("loadDietChart meals error:", mealsError);
        throw new Error("Failed to load meals: " + mealsError.message);
    }

    const mealIds = (meals || []).map((meal) => meal.id);
    let items = [];

    if (mealIds.length > 0) {
        const { data: itemData, error: itemsError } = await window.supabaseClient
            .from("diet_chart_items")
            .select("id, meal_id, food_name, quantity, quantity_unit, reference_quantity, reference_unit, reference_carbs, reference_protein, reference_fat, reference_fibre, sort_order")
            .in("meal_id", mealIds)
            .order("sort_order", { ascending: true });

        if (itemsError) {
            console.error("loadDietChart items error:", itemsError);
            throw new Error("Failed to load meal items: " + itemsError.message);
        }

        items = itemData || [];
    }

    const mealsWithItems = (meals || []).map((meal) => ({
        ...meal,
        items: items.filter((item) => item.meal_id === meal.id)
    }));

    return {
        chart,
        meals: mealsWithItems
    };
}

function renderDietChartEditor(chartData) {
    const titleEl = getEl("dietChartTitle");
    const notesEl = getEl("dietChartNotes");
    const mealsContainer = getEl("dietMealsContainer");

    if (!titleEl || !notesEl || !mealsContainer) {
        return;
    }

    DIET_STATE.selectedChartId = chartData?.chart?.id || "";
    DIET_STATE.currentChartData = chartData || null;
    DIET_STATE.mealCounter = 0;

    titleEl.value = chartData?.chart?.title || "";
    notesEl.value = chartData?.chart?.notes || "";
    mealsContainer.innerHTML = "";

    const meals = chartData?.meals || [];
    if (meals.length === 0) {
        addMeal({ meal_name: "Meal 1", sort_order: 1, items: [] });
    } else {
        meals.forEach((mealData) => addMeal(mealData));
    }

    setEditorVisibility(true);
    recalculateDietChartTotals();
}

function createEmptyDietChart(userId) {
    DIET_STATE.selectedUserId = userId;
    DIET_STATE.selectedChartId = "";
    DIET_STATE.isEditMode = false;
    DIET_STATE.swipeHandlersBound = false;
    DIET_STATE.hasUnsavedChanges = false;

    const emptyChart = {
        chart: { user_id: userId, title: "", notes: "" },
        meals: [{ meal_name: "Meal 1", sort_order: 1, items: [] }]
    };

    DIET_STATE.currentChartData = emptyChart;

    const emptyStateEl = getEl("dietChartEmptyState");
    if (emptyStateEl) emptyStateEl.style.display = "none";

    const viewEl = getEl("dietChartView");
    if (viewEl) viewEl.style.display = "block";

    renderDietChartView(emptyChart);
    showPageStatus("New diet chart started. Add meals and foods — changes are saved automatically.", "info");
}

function addMeal(mealData = {}) {
    const mealsContainer = getEl("dietMealsContainer");
    if (!mealsContainer) {
        return null;
    }

    DIET_STATE.mealCounter += 1;
    const mealSort = mealData.sort_order || DIET_STATE.mealCounter;

    const mealEl = document.createElement("div");
    mealEl.className = "meal-card diet-meal-card";
    mealEl.dataset.mealId = mealData.id || "";
    mealEl.dataset.sortOrder = String(mealSort);

    mealEl.innerHTML = `
        <div class="meal-card-header diet-meal-header">
            <input type="text" class="form-control diet-meal-name" value="${escapeHtml(mealData.meal_name || `Meal ${mealSort}`)}" placeholder="Meal name">
            <div class="diet-meal-header-actions">
                <button type="button" class="btn btn-outline-primary btn-sm js-add-food-row">
                    <i class="fa fa-plus"></i> Add Food
                </button>
                <button type="button" class="btn btn-outline-danger btn-sm js-delete-meal">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        </div>
        <div class="meal-card-body">
            <div class="diet-food-rows"></div>
            <div class="diet-meal-footer mt-3">
                <div class="diet-total-chips diet-meal-totals">
                    <span class="diet-total-chip carbs" data-total="carbs"><i class="fa fa-bolt"></i> Carbs 0 gms</span>
                    <span class="diet-total-chip protein" data-total="protein"><i class="fa fa-dumbbell"></i> Protein 0 gms</span>
                    <span class="diet-total-chip fats" data-total="fat"><i class="fa fa-tint"></i> Fats 0 gms</span>
                    <span class="diet-total-chip calories" data-total="calories"><i class="fa fa-fire"></i> Calories 0 kcal</span>
                </div>
            </div>
        </div>
    `;

    mealsContainer.appendChild(mealEl);

    const items = mealData.items || [];
    if (items.length === 0) {
        addFoodRow(mealEl, null);
    } else {
        items.forEach((rowData) => addFoodRow(mealEl, rowData));
    }

    recalculateMealTotals(mealEl);
    return mealEl;
}

function deleteMeal(mealElement) {
    if (!mealElement) {
        return;
    }

    mealElement.remove();
    recalculateDietChartTotals();
}

function addFoodRow(mealElement, rowData = null) {
    const rowsContainer = mealElement.querySelector(".diet-food-rows");
    if (!rowsContainer) {
        return null;
    }

    const rowEl = document.createElement("div");
    rowEl.className = "diet-food-row";
    rowEl.dataset.rowId = rowData?.id || "";

    rowEl.innerHTML = `
        <div class="diet-food-row-main">
            <select class="form-control form-control-sm diet-food-select">
                ${buildFoodOptionsHtml()}
            </select>
            <input type="number" class="form-control form-control-sm diet-food-quantity" min="0.01" step="0.01" value="${rowData?.quantity ?? ""}" placeholder="Qty">
            <input type="text" class="form-control form-control-sm diet-food-unit" value="${escapeHtml(rowData?.quantity_unit || "")}" readonly placeholder="Unit">
            <button type="button" class="btn btn-outline-secondary btn-sm js-add-food-inline" title="Add new food">
                <i class="fa fa-plus"></i>
            </button>
            <button type="button" class="btn btn-outline-danger btn-sm js-delete-food-row" title="Delete row">
                <i class="fa fa-trash"></i>
            </button>
        </div>
        <div class="diet-food-ref-text text-muted small">Reference data not set</div>
        <div class="diet-row-total-chips">
            <span class="diet-mini-chip carbs" data-value="carbs"><i class="fa fa-bolt"></i> 0 gms</span>
            <span class="diet-mini-chip protein" data-value="protein"><i class="fa fa-dumbbell"></i> 0 gms</span>
            <span class="diet-mini-chip fats" data-value="fat"><i class="fa fa-tint"></i> 0 gms</span>
            <span class="diet-mini-chip calories" data-value="calories"><i class="fa fa-fire"></i> 0 kcal</span>
        </div>
    `;

    rowEl.dataset.foodName = rowData?.food_name || "";
    rowEl.dataset.referenceQuantity = String(rowData?.reference_quantity ?? "");
    rowEl.dataset.referenceUnit = rowData?.reference_unit || "";
    rowEl.dataset.referenceCarbs = String(rowData?.reference_carbs ?? "0");
    rowEl.dataset.referenceProtein = String(rowData?.reference_protein ?? "0");
    rowEl.dataset.referenceFat = String(rowData?.reference_fat ?? "0");
    rowEl.dataset.referenceFibre = String(rowData?.reference_fibre ?? "0");

    rowsContainer.appendChild(rowEl);

    const foodSelect = rowEl.querySelector(".diet-food-select");
    if (foodSelect && rowData?.food_name) {
        const matchingFood = DIET_STATE.foodCatalog.find(
            (food) => (food.food_name || "").toLowerCase() === rowData.food_name.toLowerCase()
        );

        if (matchingFood) {
            foodSelect.value = matchingFood.food_id;
            populateFoodRowFromCatalog(rowEl, matchingFood);
            const qtyInput = rowEl.querySelector(".diet-food-quantity");
            if (qtyInput && rowData.quantity !== null && rowData.quantity !== undefined) {
                qtyInput.value = rowData.quantity;
            }
        } else {
            const customOption = document.createElement("option");
            customOption.value = `__custom__${rowData.food_name}`;
            customOption.textContent = `${rowData.food_name} (Custom)`;
            customOption.selected = true;
            foodSelect.insertBefore(customOption, foodSelect.lastElementChild);

            const unitInput = rowEl.querySelector(".diet-food-unit");
            if (unitInput) {
                unitInput.value = rowData.quantity_unit || rowData.reference_unit || "";
            }

            const refText = rowEl.querySelector(".diet-food-ref-text");
            if (refText) {
                refText.textContent = `Ref: ${formatMacro(rowData.reference_quantity)} ${rowData.reference_unit} | C ${formatMacro(rowData.reference_carbs)} | P ${formatMacro(rowData.reference_protein)} | F ${formatMacro(rowData.reference_fat)} | Fibre ${formatMacro(rowData.reference_fibre)}`;
            }
        }
    }

    recalculateFoodRow(rowEl);
    return rowEl;
}

function deleteFoodRow(rowElement) {
    if (!rowElement) {
        return;
    }

    const mealEl = rowElement.closest(".meal-card");
    rowElement.remove();

    if (mealEl) {
        recalculateMealTotals(mealEl);
    }
}

function populateFoodRowFromCatalog(rowElement, food) {
    if (!rowElement || !food) {
        return;
    }

    rowElement.dataset.foodName = food.food_name || "";
    rowElement.dataset.referenceQuantity = String(food.quantity ?? "");
    rowElement.dataset.referenceUnit = food.unit_of_quantity || "";
    rowElement.dataset.referenceCarbs = String(food.carbs ?? "0");
    rowElement.dataset.referenceProtein = String(food.protein ?? "0");
    rowElement.dataset.referenceFat = String(food.fats ?? "0");
    rowElement.dataset.referenceFibre = String(food.fibre ?? "0");

    const qtyInput = rowElement.querySelector(".diet-food-quantity");
    if (qtyInput && (!qtyInput.value || toNumber(qtyInput.value, 0) <= 0)) {
        qtyInput.value = String(food.quantity || "");
    }

    const unitInput = rowElement.querySelector(".diet-food-unit");
    if (unitInput) {
        unitInput.value = food.unit_of_quantity || "";
    }

    const refText = rowElement.querySelector(".diet-food-ref-text");
    if (refText) {
        refText.textContent = `Ref: ${formatMacro(food.quantity)} ${food.unit_of_quantity} | C ${formatMacro(food.carbs)} | P ${formatMacro(food.protein)} | F ${formatMacro(food.fats)} | Fibre ${formatMacro(food.fibre)}`;
    }

    recalculateFoodRow(rowElement);
}

function recalculateFoodRow(rowElement) {
    if (!rowElement) {
        return;
    }

    const quantity = toNumber(rowElement.querySelector(".diet-food-quantity")?.value, 0);
    const referenceQuantity = toNumber(rowElement.dataset.referenceQuantity, 0);
    const referenceCarbs = toNumber(rowElement.dataset.referenceCarbs, 0);
    const referenceProtein = toNumber(rowElement.dataset.referenceProtein, 0);
    const referenceFat = toNumber(rowElement.dataset.referenceFat, 0);
    const referenceFibre = toNumber(rowElement.dataset.referenceFibre, 0);

    const factor = referenceQuantity > 0 ? quantity / referenceQuantity : 0;

    const calculatedCarbs = referenceCarbs * factor;
    const calculatedProtein = referenceProtein * factor;
    const calculatedFat = referenceFat * factor;
    const calculatedFibre = referenceFibre * factor;
    const calculatedCalories = (calculatedCarbs * 4) + (calculatedProtein * 4) + (calculatedFat * 9);

    rowElement.dataset.calculatedCarbs = String(calculatedCarbs);
    rowElement.dataset.calculatedProtein = String(calculatedProtein);
    rowElement.dataset.calculatedFat = String(calculatedFat);
    rowElement.dataset.calculatedFibre = String(calculatedFibre);
    rowElement.dataset.calculatedCalories = String(calculatedCalories);

    const setChipValue = (key, value, suffix) => {
        const chip = rowElement.querySelector(`.diet-mini-chip[data-value="${key}"]`);
        if (!chip) {
            return;
        }

        const iconEl = chip.querySelector("i");
        chip.innerHTML = `${iconEl ? iconEl.outerHTML : ""} ${formatMacro(value)} ${suffix}`;
    };

    setChipValue("carbs", calculatedCarbs, "gms");
    setChipValue("protein", calculatedProtein, "gms");
    setChipValue("fat", calculatedFat, "gms");
    setChipValue("fibre", calculatedFibre, "gms");
    setChipValue("calories", calculatedCalories, "kcal");

    const mealEl = rowElement.closest(".meal-card");
    if (mealEl) {
        recalculateMealTotals(mealEl);
    }
}

function recalculateMealTotals(mealElement) {
    if (!mealElement) {
        return;
    }

    const rows = Array.from(mealElement.querySelectorAll(".diet-food-row"));

    const totals = rows.reduce((acc, row) => {
        acc.carbs += toNumber(row.dataset.calculatedCarbs, 0);
        acc.protein += toNumber(row.dataset.calculatedProtein, 0);
        acc.fat += toNumber(row.dataset.calculatedFat, 0);
        acc.fibre += toNumber(row.dataset.calculatedFibre, 0);
        acc.calories += toNumber(row.dataset.calculatedCalories, 0);
        return acc;
    }, { carbs: 0, protein: 0, fat: 0, fibre: 0, calories: 0 });

    const setTotal = (key, label, suffix) => {
        const chip = mealElement.querySelector(`.diet-meal-totals .diet-total-chip[data-total="${key}"]`);
        if (!chip) {
            return;
        }

        const iconEl = chip.querySelector("i");
        chip.innerHTML = `${iconEl ? iconEl.outerHTML : ""} ${label} ${formatMacro(totals[key])} ${suffix}`;
    };

    setTotal("carbs", "Carbs", "gms");
    setTotal("protein", "Protein", "gms");
    setTotal("fat", "Fats", "gms");
    setTotal("fibre", "Fibre", "gms");
    setTotal("calories", "Calories", "kcal");

    recalculateDietChartTotals();
}

function recalculateDietChartTotals() {
    const rows = Array.from(document.querySelectorAll("#dietMealsContainer .diet-food-row"));

    const totals = rows.reduce((acc, row) => {
        acc.carbs += toNumber(row.dataset.calculatedCarbs, 0);
        acc.protein += toNumber(row.dataset.calculatedProtein, 0);
        acc.fat += toNumber(row.dataset.calculatedFat, 0);
        acc.fibre += toNumber(row.dataset.calculatedFibre, 0);
        acc.calories += toNumber(row.dataset.calculatedCalories, 0);
        return acc;
    }, { carbs: 0, protein: 0, fat: 0, fibre: 0, calories: 0 });

    const totalsEl = getEl("dietChartTotals");
    if (!totalsEl) {
        return;
    }

    const setDietTotal = (cls, label, value, suffix) => {
        const chip = totalsEl.querySelector(`.diet-total-chip.${cls}`);
        if (!chip) {
            return;
        }

        const iconEl = chip.querySelector("i");
        chip.innerHTML = `${iconEl ? iconEl.outerHTML : ""} ${label} ${formatMacro(value)} ${suffix}`;
    };

    setDietTotal("carbs", "Carbs", totals.carbs, "gms");
    setDietTotal("protein", "Protein", totals.protein, "gms");
    setDietTotal("fats", "Fats", totals.fat, "gms");
    setDietTotal("fibre", "Fibre", totals.fibre, "gms");
    setDietTotal("calories", "Calories", totals.calories, "kcal");
}

function openAddFoodModal(targetRow) {
    openAddCustomFoodModal({ targetRow: targetRow || null, reopenCatalog: false, hideCatalog: false });
}

async function createFoodCatalogItem(payload) {
    const { data, error } = await window.supabaseClient
        .from("food_catalog")
        .insert(payload)
        .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre")
        .single();

    if (error) {
        console.error("createFoodCatalogItem error:", error);
        throw new Error("Failed to create food item: " + error.message);
    }

    return data;
}

function openAddCustomFoodModal(options = {}) {
    DIET_STATE.addFoodTargetRow = options.targetRow || null;
    DIET_STATE.reopenCatalogModalAfterCreateFood = Boolean(options.reopenCatalog);

    const form = getEl("customFoodForm");
    if (form) {
        form.reset();
    }
    const statusEl = getEl("customFoodStatus");
    if (statusEl) {
        statusEl.style.display = "none";
        statusEl.textContent = "";
    }

    const scopeWrap = getEl("customFoodScopeWrap");
    const scopeSwitch = getEl("cfScopeGlobalSwitch");
    if (DIET_STATE.isAdmin) {
        if (scopeWrap) {
            scopeWrap.style.display = "block";
        }
        if (scopeSwitch) {
            scopeSwitch.checked = false;
        }
    } else {
        if (scopeWrap) {
            scopeWrap.style.display = "none";
        }
    }
    updateCustomFoodScopeUi();

    if (window.jQuery && window.jQuery.fn.modal) {
        if (options.hideCatalog !== false) {
            window.jQuery("#selectFoodModal").modal("hide");
        }
        window.jQuery("#customFoodModal").modal("show");
    }
}

async function saveCustomFoodItem() {
    const statusEl = getEl("customFoodStatus");

    const foodName = (getEl("cfFoodName")?.value || "").trim();
    const quantity = toNumber(getEl("cfQuantity")?.value, 0);
    const unit = getEl("cfUnit")?.value || "g";
    const carbs = toNumber(getEl("cfCarbs")?.value, -1);
    const protein = toNumber(getEl("cfProtein")?.value, -1);
    const fats = toNumber(getEl("cfFats")?.value, -1);
    const fibreRaw = (getEl("cfFibre")?.value || "").trim();
    const fibre = fibreRaw === "" ? null : toNumber(fibreRaw, -1);

    if (!foodName) {
        showCustomFoodStatus("Food name is required.", "warning");
        return;
    }
    if (quantity <= 0) {
        showCustomFoodStatus("Quantity must be greater than 0.", "warning");
        return;
    }
    if (carbs < 0 || protein < 0 || fats < 0) {
        showCustomFoodStatus("Carbs, protein and fats cannot be negative.", "warning");
        return;
    }
    if (fibre !== null && fibre < 0) {
        showCustomFoodStatus("Fibre cannot be negative.", "warning");
        return;
    }

    const saveBtn = getEl("customFoodSaveBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin mr-1"></i> Saving...';
    }

    try {
        const ownerUserId = getCatalogCustomOwnerId() || null;
        const isGlobal = Boolean(DIET_STATE.isAdmin && getEl("cfScopeGlobalSwitch")?.checked);
        if (!isGlobal && !ownerUserId) {
            throw new Error("Please select a user before saving a custom food.");
        }

        const payload = {
            food_name: foodName,
            quantity,
            unit_of_quantity: unit,
            carbs,
            protein,
            fats,
            fibre: fibre,
            is_custom: !isGlobal,
            created_by_user_id: isGlobal ? null : ownerUserId,
            updated_at: new Date().toISOString()
        };

        let savedItem = null;
        const { data, error } = await window.supabaseClient
            .from("food_catalog")
            .insert(payload)
            .select("food_id, food_name, quantity, unit_of_quantity, carbs, protein, fats, fibre, is_custom, created_by_user_id")
            .single();

        if (error) {
            const errMsg = String(error.message || "").toLowerCase();
            if (errMsg.includes("stack depth") && errMsg.includes("limit exceeded")) {
                // Recursive DB trigger on food_catalog fired. The INSERT may still have succeeded.
                // Reload catalog — if the item exists treat as success, otherwise surface a clear message.
                DIET_STATE.foodCatalog = [];
                await loadFoodCatalogOptions();
                const saved = DIET_STATE.foodCatalog.find((f) => {
                    if (f.food_name !== foodName) {
                        return false;
                    }
                    if (isGlobal) {
                        return !f.is_custom;
                    }
                    return f.is_custom && f.created_by_user_id === ownerUserId;
                });
                if (!saved) {
                    throw new Error("Could not save custom food due to a database configuration issue. Please contact your admin.");
                }
                savedItem = saved;
                // Item was saved — fall through to success UI
            } else {
                throw new Error(error.message);
            }
        } else {
            // Normal success path — reload catalog with fresh data
            savedItem = data;
            DIET_STATE.foodCatalog = [];
            await loadFoodCatalogOptions();
        }

        if (DIET_STATE.addFoodTargetRow && savedItem?.food_id) {
            const selectEl = DIET_STATE.addFoodTargetRow.querySelector(".diet-food-select");
            if (selectEl) {
                selectEl.innerHTML = buildFoodOptionsHtml(savedItem.food_id);
                selectEl.value = savedItem.food_id;
                populateFoodRowFromCatalog(DIET_STATE.addFoodTargetRow, savedItem);
            }
        }

        if (window.jQuery && window.jQuery.fn.modal) {
            window.jQuery("#customFoodModal").modal("hide");
        }

        if (DIET_STATE.reopenCatalogModalAfterCreateFood) {
            await renderFoodCatalogModalList("");
            if (window.jQuery && window.jQuery.fn.modal) {
                window.jQuery("#selectFoodModal").modal("show");
            }
        }

        // Briefly flash the new card
        if (DIET_STATE.reopenCatalogModalAfterCreateFood) {
            setTimeout(() => {
                const newCard = document.querySelector(`[data-food-id="${savedItem?.food_id}"]`);
                if (newCard) {
                    newCard.classList.add("catalog-card-highlight");
                    setTimeout(() => newCard.classList.remove("catalog-card-highlight"), 1200);
                    newCard.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 200);
        }

        DIET_STATE.reopenCatalogModalAfterCreateFood = false;
        DIET_STATE.addFoodTargetRow = null;
    } catch (err) {
        console.error("saveCustomFoodItem error:", err);
        showCustomFoodStatus(err.message || "Failed to save custom food.", "danger");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa fa-save mr-1"></i> Save';
        }
    }
}

function showCustomFoodStatus(message, type = "danger") {
    const el = getEl("customFoodStatus");
    if (!el) return;
    el.className = `alert alert-${type} mt-3 mb-0`;
    el.textContent = message;
    el.style.display = "block";
}

function collectDietChartFormData() {
    if (!DIET_STATE.selectedUserId) {
        throw new Error("Please select a user first.");
    }

    const title = (getEl("dietChartTitle")?.value || "").trim();
    const notes = (getEl("dietChartNotes")?.value || "").trim();

    if (!title) {
        throw new Error("Diet chart title is required.");
    }

    const mealElements = Array.from(document.querySelectorAll("#dietMealsContainer .meal-card"));
    if (mealElements.length === 0) {
        throw new Error("Add at least one meal before saving.");
    }

    const meals = mealElements.map((mealEl, mealIndex) => {
        const mealName = (mealEl.querySelector(".diet-meal-name")?.value || "").trim();
        if (!mealName) {
            throw new Error(`Meal ${mealIndex + 1} name is required.`);
        }

        const rowElements = Array.from(mealEl.querySelectorAll(".diet-food-row"));
        if (rowElements.length === 0) {
            throw new Error(`Add at least one food row in ${mealName}.`);
        }

        const items = rowElements.map((rowEl, rowIndex) => {
            const foodSelect = rowEl.querySelector(".diet-food-select");
            const selectedValue = foodSelect ? foodSelect.value : "";
            const quantity = toNumber(rowEl.querySelector(".diet-food-quantity")?.value, 0);
            const quantityUnit = (rowEl.querySelector(".diet-food-unit")?.value || "").trim();
            const foodName = (rowEl.dataset.foodName || "").trim();

            if (!selectedValue || selectedValue === "__add_new__") {
                throw new Error(`Select food for row ${rowIndex + 1} in ${mealName}.`);
            }

            if (!foodName) {
                throw new Error(`Food name missing for row ${rowIndex + 1} in ${mealName}.`);
            }

            if (quantity <= 0) {
                throw new Error(`Quantity must be greater than 0 for ${foodName}.`);
            }

            const referenceQuantity = toNumber(rowEl.dataset.referenceQuantity, 0);
            if (referenceQuantity <= 0) {
                throw new Error(`Reference quantity missing for ${foodName}.`);
            }

            return {
                food_name: foodName,
                quantity: quantity,
                quantity_unit: quantityUnit || rowEl.dataset.referenceUnit || "",
                reference_quantity: referenceQuantity,
                reference_unit: rowEl.dataset.referenceUnit || "",
                reference_carbs: toNumber(rowEl.dataset.referenceCarbs, 0),
                reference_protein: toNumber(rowEl.dataset.referenceProtein, 0),
                reference_fat: toNumber(rowEl.dataset.referenceFat, 0),
                reference_fibre: toNumber(rowEl.dataset.referenceFibre, 0),
                sort_order: rowIndex + 1,
                updated_at: new Date().toISOString()
            };
        });

        return {
            meal_name: mealName,
            sort_order: mealIndex + 1,
            items
        };
    });

    return {
        user_id: DIET_STATE.selectedUserId,
        title,
        notes,
        meals
    };
}

async function saveDietChart() {
    const payload = collectDietChartFormData();
    setSaveLoading(true);
    hidePageStatus();
    showLoadingSpinner();

    try {
        const createdBy = DIET_STATE.activeAdminId || null;
        let chartId = DIET_STATE.selectedChartId;

        if (!chartId) {
            const { data, error } = await window.supabaseClient
                .from("diet_charts")
                .insert({
                    user_id: payload.user_id,
                    title: payload.title,
                    notes: payload.notes || null,
                    created_by: createdBy,
                    updated_at: new Date().toISOString()
                })
                .select("id")
                .single();

            if (error) {
                throw new Error("Create failed: " + error.message);
            }

            chartId = data.id;
            DIET_STATE.selectedChartId = chartId;
        } else {
            const { error: updateError } = await window.supabaseClient
                .from("diet_charts")
                .update({
                    title: payload.title,
                    notes: payload.notes || null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", chartId);

            if (updateError) {
                throw new Error("Update failed: " + updateError.message);
            }

            const { data: existingMeals, error: fetchMealsError } = await window.supabaseClient
                .from("diet_chart_meals")
                .select("id")
                .eq("diet_chart_id", chartId);

            if (fetchMealsError) {
                throw new Error("Failed to fetch existing meals: " + fetchMealsError.message);
            }

            const existingMealIds = (existingMeals || []).map((meal) => meal.id);
            if (existingMealIds.length > 0) {
                const { error: deleteItemsError } = await window.supabaseClient
                    .from("diet_chart_items")
                    .delete()
                    .in("meal_id", existingMealIds);

                if (deleteItemsError) {
                    throw new Error("Failed to clear existing items: " + deleteItemsError.message);
                }
            }

            const { error: deleteMealsError } = await window.supabaseClient
                .from("diet_chart_meals")
                .delete()
                .eq("diet_chart_id", chartId);

            if (deleteMealsError) {
                throw new Error("Failed to clear existing meals: " + deleteMealsError.message);
            }
        }

        for (const mealPayload of payload.meals) {
            const { data: insertedMeal, error: mealInsertError } = await window.supabaseClient
                .from("diet_chart_meals")
                .insert({
                    diet_chart_id: chartId,
                    meal_name: mealPayload.meal_name,
                    sort_order: mealPayload.sort_order
                })
                .select("id")
                .single();

            if (mealInsertError || !insertedMeal) {
                const mealErrMsg = String(mealInsertError?.message || "").toLowerCase();
                if (mealErrMsg.includes("stack depth") && mealErrMsg.includes("limit exceeded")) {
                    console.warn("Ignoring stack depth error on diet_chart_meals insert, skipping items for this meal.", mealInsertError);
                    continue;
                } else {
                    throw new Error("Meal save failed: " + (mealInsertError?.message || "no meal ID returned"));
                }
            }

            if (mealPayload.items.length > 0) {
                const itemsPayload = mealPayload.items.map((item) => ({
                    meal_id: insertedMeal.id,
                    food_name: item.food_name,
                    quantity: item.quantity,
                    quantity_unit: item.quantity_unit,
                    reference_quantity: item.reference_quantity,
                    reference_unit: item.reference_unit,
                    reference_carbs: item.reference_carbs,
                    reference_protein: item.reference_protein,
                    reference_fat: item.reference_fat,
                    reference_fibre: item.reference_fibre,
                    sort_order: item.sort_order
                }));

                const { error: itemInsertError } = await window.supabaseClient
                    .from("diet_chart_items")
                    .insert(itemsPayload);

                if (itemInsertError) {
                    const itemErrMsg = String(itemInsertError.message || "").toLowerCase();
                    if (itemErrMsg.includes("stack depth") && itemErrMsg.includes("limit exceeded")) {
                        console.warn("Ignoring stack depth error on diet_chart_items insert.", itemInsertError);
                    } else {
                        throw new Error("Item save failed: " + itemInsertError.message);
                    }
                }
            }
        }

        const loadedChart = await loadDietChart(chartId);
        DIET_STATE.currentChartData = loadedChart;
        DIET_STATE.isEditMode = false;
        renderDietChartEditor(loadedChart);
        renderDietChartView(loadedChart);
        setEditorVisibility(true);
        setDietDirty(false);
        hideLoadingSpinner();
    } catch (error) {
        console.error("saveDietChart error:", error);
        showPageStatus(error.message || "Failed to save diet chart.", "danger");
        hideLoadingSpinner();
        throw error;
    } finally {
        setSaveLoading(false);
    }
}

async function deleteDietChart(chartId) {
    if (!chartId) {
        return;
    }

    const confirmed = await showDietConfirm("Delete this diet chart and all related meals/items?", {
        title: "Delete Diet Chart",
        confirmText: "Delete",
        confirmClass: "btn-danger"
    });

    if (!confirmed) {
        return;
    }

    try {
        const { data: meals, error: mealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .select("id")
            .eq("diet_chart_id", chartId);

        if (mealsError) {
            throw new Error(mealsError.message);
        }

        const mealIds = (meals || []).map((meal) => meal.id);
        if (mealIds.length > 0) {
            const { error: deleteItemsError } = await window.supabaseClient
                .from("diet_chart_items")
                .delete()
                .in("meal_id", mealIds);

            if (deleteItemsError) {
                throw new Error(deleteItemsError.message);
            }
        }

        const { error: deleteMealsError } = await window.supabaseClient
            .from("diet_chart_meals")
            .delete()
            .eq("diet_chart_id", chartId);

        if (deleteMealsError) {
            throw new Error(deleteMealsError.message);
        }

        const { error: deleteChartError } = await window.supabaseClient
            .from("diet_charts")
            .delete()
            .eq("id", chartId);

        if (deleteChartError) {
            throw new Error(deleteChartError.message);
        }

        DIET_STATE.selectedChartId = "";
        setEditorVisibility(false);
        showPageStatus("Diet chart deleted.", "success");
    } catch (error) {
        console.error("deleteDietChart error:", error);
        showPageStatus(error.message || "Failed to delete diet chart.", "danger");
    }
}

function resetDietChartPage() {
    DIET_STATE.selectedChartId = "";
    DIET_STATE.selectedUserId = "";
    DIET_STATE.mealCounter = 0;
    DIET_STATE.isEditMode = false;
    DIET_STATE.hasUnsavedChanges = false;
    DIET_STATE.currentChartData = null;

    const userSelect = getEl("dietUserSelect");
    if (userSelect) {
        userSelect.value = "";
    }

    const titleEl = getEl("dietChartTitle");
    const notesEl = getEl("dietChartNotes");
    const mealsContainer = getEl("dietMealsContainer");
    const viewEl = getEl("dietChartView");

    if (titleEl) {
        titleEl.value = "";
    }

    if (notesEl) {
        notesEl.value = "";
    }

    if (mealsContainer) {
        mealsContainer.innerHTML = "";
    }

    if (viewEl) {
        viewEl.innerHTML = "";
    }

    hidePageStatus();
    setDietDirty(false);
    setEditorVisibility(false);
    recalculateDietChartTotals();
}

async function handleUserSelection(userId) {
    hidePageStatus();
    showLoadingSpinner();

    DIET_STATE.selectedUserId = userId || "";
    DIET_STATE.selectedChartId = "";

    if (!userId) {
        hideLoadingSpinner();
        setEditorVisibility(false);
        return;
    }

    try {
        await loadSelectedUserMeta(userId);

        const existingChart = await checkExistingDietChart(userId);
        if (!existingChart) {
            hideLoadingSpinner();
            setEditorVisibility(false);
            showPageStatus("No existing diet chart for this user.", "warning");
            return;
        }

        const chartData = await loadDietChart(existingChart.id);
        DIET_STATE.currentChartData = chartData;
        DIET_STATE.isEditMode = false;
        setDietDirty(false);
        renderDietChartEditor(chartData);
        renderDietChartView(chartData);
        setEditorVisibility(true);
        hideLoadingSpinner();
    } catch (error) {
        console.error("handleUserSelection error:", error);
        hideLoadingSpinner();
        showPageStatus(error.message || "Failed to load diet chart.", "danger");
    }
}

function bindDietChartEvents() {
    const userSelect = getEl("dietUserSelect");
    const createBtn = getEl("createDietChartBtn");
    const addMealBtn = getEl("addMealBtn");
    const saveBtn = getEl("saveDietChartBtn");
    const deleteBtn = getEl("deleteDietChartBtn");
    const resetBtn = getEl("dietResetPageBtn");
    const mealsContainer = getEl("dietMealsContainer");
    const viewModeBtn = getEl("dietViewModeBtn");
    const editModeBtn = getEl("dietEditModeBtn");

    if (userSelect) {
        userSelect.addEventListener("change", async (event) => {
            await handleUserSelection(event.target.value);
        });
    }

    if (createBtn) {
        createBtn.addEventListener("click", () => {
            if (!DIET_STATE.selectedUserId) {
                showPageStatus("Select a user first.", "warning");
                return;
            }

            createEmptyDietChart(DIET_STATE.selectedUserId);
        });
    }

    if (addMealBtn) {
        addMealBtn.addEventListener("click", () => {
            addMeal({ meal_name: `Meal ${DIET_STATE.mealCounter + 1}` });
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            try {
                await saveDietChart();
            } catch (error) {
                console.error(error);
            }
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            await deleteDietChart(DIET_STATE.selectedChartId);
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetDietChartPage();
        });
    }

    if (viewModeBtn) {
        viewModeBtn.addEventListener("click", () => {
            if (!DIET_STATE.currentChartData && !DIET_STATE.selectedChartId) {
                return;
            }

            DIET_STATE.isEditMode = false;
            if (DIET_STATE.currentChartData) {
                renderDietChartView(DIET_STATE.currentChartData);
            }
            setEditorVisibility(true);
        });
    }

    if (editModeBtn) {
        editModeBtn.addEventListener("click", () => {
            if (!DIET_STATE.selectedUserId) {
                showPageStatus("Select a user first.", "warning");
                return;
            }

            DIET_STATE.isEditMode = true;
            setEditorVisibility(true);
        });
    }

    if (mealsContainer) {
        mealsContainer.addEventListener("click", (event) => {
            const target = event.target.closest("button");
            if (!target) {
                return;
            }

            if (target.classList.contains("js-add-food-row")) {
                const mealEl = target.closest(".meal-card");
                if (mealEl) {
                    addFoodRow(mealEl, null);
                    recalculateMealTotals(mealEl);
                }
                return;
            }

            if (target.classList.contains("js-delete-meal")) {
                const mealEl = target.closest(".meal-card");
                if (mealEl) {
                    deleteMeal(mealEl);
                }
                return;
            }

            if (target.classList.contains("js-delete-food-row")) {
                const rowEl = target.closest(".diet-food-row");
                if (rowEl) {
                    deleteFoodRow(rowEl);
                }
                return;
            }

            if (target.classList.contains("js-add-food-inline")) {
                const rowEl = target.closest(".diet-food-row");
                openAddFoodModal(rowEl);
            }
        });

        mealsContainer.addEventListener("change", (event) => {
            const target = event.target;

            if (target.classList.contains("diet-food-select")) {
                const rowEl = target.closest(".diet-food-row");
                if (!rowEl) {
                    return;
                }

                if (target.value === "__add_new__") {
                    openAddFoodModal(rowEl);
                    return;
                }

                const selectedFood = DIET_STATE.foodCatalog.find((food) => food.food_id === target.value);
                if (selectedFood) {
                    populateFoodRowFromCatalog(rowEl, selectedFood);
                }
            }

            if (target.classList.contains("diet-food-quantity")) {
                const rowEl = target.closest(".diet-food-row");
                recalculateFoodRow(rowEl);
            }
        });

        mealsContainer.addEventListener("input", (event) => {
            if (event.target.classList.contains("diet-food-quantity")) {
                const rowEl = event.target.closest(".diet-food-row");
                recalculateFoodRow(rowEl);
            }
        });
    }

    const addFoodForm = getEl("addFoodForm");

    if (addFoodForm) {
        addFoodForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const payload = {
                food_name: (getEl("newFoodName")?.value || "").trim(),
                quantity: toNumber(getEl("newFoodQuantity")?.value, 0),
                unit_of_quantity: getEl("newFoodUnit")?.value || "g",
                carbs: toNumber(getEl("newFoodCarbs")?.value, 0),
                protein: toNumber(getEl("newFoodProtein")?.value, 0),
                fats: toNumber(getEl("newFoodFats")?.value, 0),
                fibre: (() => {
                    const raw = getEl("newFoodFibre")?.value;
                    return raw === "" || raw === null || raw === undefined ? null : toNumber(raw, 0);
                })(),
                updated_at: new Date().toISOString()
            };

            if (!payload.food_name) {
                await showDietAlert("Food name is required.", { title: "Validation" });
                return;
            }

            if (payload.quantity <= 0) {
                await showDietAlert("Quantity must be greater than 0.", { title: "Validation" });
                return;
            }

            if (payload.carbs < 0 || payload.protein < 0 || payload.fats < 0 || (payload.fibre !== null && payload.fibre < 0)) {
                await showDietAlert("Macros cannot be negative.", { title: "Validation" });
                return;
            }

            try {
                const createdFood = await createFoodCatalogItem(payload);
                DIET_STATE.foodCatalog = [];
                await loadFoodCatalogOptions();

                if (DIET_STATE.addFoodTargetRow) {
                    const selectEl = DIET_STATE.addFoodTargetRow.querySelector(".diet-food-select");
                    if (selectEl) {
                        selectEl.innerHTML = buildFoodOptionsHtml(createdFood.food_id);
                        selectEl.value = createdFood.food_id;
                        populateFoodRowFromCatalog(DIET_STATE.addFoodTargetRow, createdFood);
                    }
                }

                if (window.jQuery && window.jQuery.fn.modal) {
                    window.jQuery("#addFoodModal").modal("hide");
                }

                if (DIET_STATE.reopenCatalogModalAfterCreateFood) {
                    DIET_STATE.reopenCatalogModalAfterCreateFood = false;
                    await renderFoodCatalogModalList("");
                    if (window.jQuery && window.jQuery.fn.modal) {
                        window.jQuery("#selectFoodModal").modal("show");
                    }
                }

                await showDietAlert("Food created and selected successfully.", { title: "Food Added" });
            } catch (error) {
                console.error("add food modal submit error:", error);
                await showDietAlert(error.message || "Failed to create food.", { title: "Create Failed" });
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireLoginOrRedirect();
    if (!user) {
        return;
    }

    // Determine role — admins get full user-selector; clients load own chart only
    const accessState = await window.getAccessState({ user });
    const isAdmin = Boolean(accessState?.isAdmin);

    DIET_STATE.activeAdminId = user.id;
    DIET_STATE.currentUserId = user.id;
    DIET_STATE.isAdmin = isAdmin;

    if (!isAdmin) {
        // Client: hide the user selector section
        const userToolbar = document.querySelector('.diet-user-toolbar');
        if (userToolbar) userToolbar.style.display = 'none';

        // Remove admin-oriented management wording for client view.
        const pageTitle = document.querySelector('.diet-page-title');
        if (pageTitle) pageTitle.textContent = 'Diet Chart';

        // Use one add-food action in catalog modal footer
        const addNewFoodBtn = getEl('openAddFoodFromCatalogModalBtn');
        if (addNewFoodBtn) {
            addNewFoodBtn.style.display = '';
            addNewFoodBtn.innerHTML = '<i class="fa fa-plus mr-1"></i> Add Custom Food Item';
        }

        // Update page subtitle
        const subtitle = document.querySelector('.diet-page-subtitle');
        if (subtitle) subtitle.textContent = 'My Diet Chart';
        const copy = document.querySelector('.diet-page-copy');
        if (copy) copy.textContent = 'View and manage your personal meal plan.';

        try {
            await loadFoodCatalogOptions();
            // Auto-load the current user's own diet chart
            DIET_STATE.selectedUserId = user.id;
            await loadSelectedUserMeta(user.id);
            showLoadingSpinner();
            const existingChart = await checkExistingDietChart(user.id);
            if (existingChart) {
                DIET_STATE.selectedChartId = existingChart.id;
                const chartData = await loadDietChart(existingChart.id);
                DIET_STATE.currentChartData = chartData;
                DIET_STATE.isEditMode = false;
                setDietDirty(false);
                renderDietChartView(chartData);
                setEditorVisibility(true);
            } else {
                // No chart yet — start a blank one so client can create
                createEmptyDietChart(user.id);
            }
            hideLoadingSpinner();
        } catch (error) {
            hideLoadingSpinner();
            console.error("diet chart client init error:", error);
            await showDietAlert(error.message || "Failed to load your diet chart.", { title: "Initialization Error" });
        }
    } else {
        // Admin: existing behavior
        try {
            await loadFoodCatalogOptions();
            await loadUsersList();
        } catch (error) {
            console.error("diet chart admin init error:", error);
            await showDietAlert(error.message || "Failed to initialize page.", { title: "Initialization Error" });
        }
    }

    bindDietChartEvents();
    if (isAdmin) {
        resetDietChartPage();
    }

    // Add event listener for delete confirmation modal
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteFoodItem);
    }

    // Add event listener for delete meal confirmation modal
    const confirmDeleteMealBtn = document.getElementById('confirmDeleteMealBtn');
    if (confirmDeleteMealBtn) {
        confirmDeleteMealBtn.addEventListener('click', () => {
            const modal = document.getElementById('deleteMealModal');
            if (modal) {
                const mealIndex = parseInt(modal.getAttribute('data-meal-index'));
                if (!isNaN(mealIndex)) {
                    deleteMealFromViewChart(mealIndex);
                }
                $('#deleteMealModal').modal('hide');
            }
        });
    }

    const viewSaveBtn = getEl("dietViewSaveBtn");
    if (viewSaveBtn) {
        viewSaveBtn.addEventListener("click", async () => {
            await syncViewChartToSupabase();
        });
    }

    const openAddFoodFromCatalogModalBtn = getEl("openAddFoodFromCatalogModalBtn");
    if (openAddFoodFromCatalogModalBtn) {
        openAddFoodFromCatalogModalBtn.addEventListener("click", () => {
            openAddCustomFoodModal({ targetRow: null, reopenCatalog: true, hideCatalog: true });
        });
    }

    const customFoodForm = getEl("customFoodForm");
    if (customFoodForm) {
        customFoodForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await saveCustomFoodItem();
        });
    }

    const customFoodCancelBtn = getEl("customFoodCancelBtn");
    if (customFoodCancelBtn) {
        customFoodCancelBtn.addEventListener("click", () => {
            if (window.jQuery && window.jQuery.fn.modal) {
                window.jQuery("#customFoodModal").modal("hide");
                window.jQuery("#selectFoodModal").modal("show");
            }
        });
    }

    const cfScopeGlobalSwitch = getEl("cfScopeGlobalSwitch");
    if (cfScopeGlobalSwitch) {
        cfScopeGlobalSwitch.addEventListener("change", () => {
            updateCustomFoodScopeUi();
        });
    }

    const foodSearchInput = getEl("foodSearchInput");
    if (foodSearchInput) {
        foodSearchInput.addEventListener("input", (event) => {
            renderFoodCatalogModalList(event.target.value || "");
        });
    }

    const foodCatalogList = getEl("foodCatalogList");
    if (foodCatalogList) {
        foodCatalogList.addEventListener("input", (event) => {
            const qtyInput = event.target.closest(".food-catalog-qty-input");
            if (!qtyInput) {
                return;
            }

            const card = qtyInput.closest(".diet-catalog-pick-card");
            if (!card) {
                return;
            }
        });

        foodCatalogList.addEventListener("click", async (event) => {
            // Handle +/- qty buttons
            const minusBtn = event.target.closest(".js-catalog-qty-minus");
            const plusBtn = event.target.closest(".js-catalog-qty-plus");
            if (minusBtn || plusBtn) {
                const card = (minusBtn || plusBtn).closest(".diet-catalog-pick-card");
                const qtyInput = card ? card.querySelector(".food-catalog-qty-input") : null;
                if (qtyInput) {
                    const step = parseFloat(qtyInput.step) || 1;
                    let val = toNumber(qtyInput.value, step);
                    val = minusBtn ? Math.max(step, parseFloat((val - step).toFixed(2))) : parseFloat((val + step).toFixed(2));
                    qtyInput.value = formatMacro(val);
                }
                return;
            }

            const pickButton = event.target.closest(".js-add-food-catalog-item");
            if (!pickButton) {
                return;
            }

            const modal = getEl("selectFoodModal");
            const mealIndex = modal ? parseInt(modal.getAttribute("data-meal-index"), 10) : NaN;
            const foodId = pickButton.getAttribute("data-food-id");
            const row = pickButton.closest(".diet-catalog-pick-card");
            const qtyInput = row ? row.querySelector(".food-catalog-qty-input") : null;
            const selectedQuantity = qtyInput ? toNumber(qtyInput.value, 0) : 0;

            if (selectedQuantity <= 0) {
                showDietAlert("Quantity must be greater than 0.", { title: "Validation" });
                return;
            }

            if (foodId && !Number.isNaN(mealIndex)) {
                await addFoodFromCatalogToMeal(foodId, mealIndex, selectedQuantity);
            }
        });
    }
});

window.loadUsersList = loadUsersList;
window.handleUserSelection = handleUserSelection;
window.checkExistingDietChart = checkExistingDietChart;
window.loadDietChart = loadDietChart;
window.renderDietChartEditor = renderDietChartEditor;
window.createEmptyDietChart = createEmptyDietChart;
window.addMeal = addMeal;
window.deleteMeal = deleteMeal;
window.addMealToViewChart = addMealToViewChart;
window.deleteMealFromViewChart = deleteMealFromViewChart;
window.addFoodRow = addFoodRow;
window.deleteFoodRow = deleteFoodRow;
window.loadFoodCatalogOptions = loadFoodCatalogOptions;
window.loadVisibleFoodCatalogItems = loadVisibleFoodCatalogItems;
window.openAddCustomFoodModal = openAddCustomFoodModal;
window.saveCustomFoodItem = saveCustomFoodItem;
window.populateFoodRowFromCatalog = populateFoodRowFromCatalog;
window.recalculateFoodRow = recalculateFoodRow;
window.recalculateMealTotals = recalculateMealTotals;
window.recalculateDietChartTotals = recalculateDietChartTotals;
window.openAddFoodModal = openAddFoodModal;
window.openFoodCatalogModalForMeal = openFoodCatalogModalForMeal;
window.createFoodCatalogItem = createFoodCatalogItem;
window.collectDietChartFormData = collectDietChartFormData;
window.saveDietChart = saveDietChart;
window.deleteDietChart = deleteDietChart;
window.resetDietChartPage = resetDietChartPage;
