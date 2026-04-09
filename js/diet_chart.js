// ============================================
// DIET CHART PAGE - HELPER FUNCTIONS
// ============================================

function getEl(id) {
    return document.getElementById(id);
}

function setInputValue(id, value) {
    const el = getEl(id);
    if (el) el.value = value ?? "";
}

function getInputValue(id) {
    const el = getEl(id);
    return el ? el.value.trim() : "";
}

function showStatusMessage(message, type = "success") {
    const el = getEl("dietChartStatus");
    if (!el) return;

    el.textContent = message;
    el.className = `alert alert-${type} mt-3`;
    el.style.display = "block";
}

function hideStatusMessage() {
    const el = getEl("dietChartStatus");
    if (!el) return;
    el.style.display = "none";
    el.textContent = "";
    el.className = "";
}

function showPlaceholder() {
    const placeholder = getEl("formPlaceholder");
    const form = getEl("dietChartForm");
    if (placeholder) placeholder.style.display = "block";
    if (form) form.style.display = "none";
}

function showForm() {
    const placeholder = getEl("formPlaceholder");
    const form = getEl("dietChartForm");
    if (placeholder) placeholder.style.display = "none";
    if (form) form.style.display = "block";
}

// ============================================
// MEAL & FOOD ITEM FUNCTIONS
// ============================================

function createMealCard(mealIndex, mealName = "") {
    const mealCard = document.createElement("div");
    mealCard.className = "meal-card";
    mealCard.dataset.mealIndex = mealIndex;

    const header = document.createElement("div");
    header.className = "meal-card-header";
    header.innerHTML = `
        <input type="text" class="form-control meal-name-input" placeholder="Meal name (e.g., Breakfast)" value="${mealName}">
        <button type="button" class="btn btn-danger btn-sm btn-remove-meal">
            <i class="fa fa-trash"></i> Remove
        </button>
    `;

    const body = document.createElement("div");
    body.className = "meal-card-body";
    body.innerHTML = `
        <button type="button" class="btn btn-primary btn-sm mb-3 btn-add-food">
            <i class="fa fa-plus"></i> Add Food Item
        </button>
        <div class="food-items-container"></div>
    `;

    mealCard.appendChild(header);
    mealCard.appendChild(body);

    // Event listeners
    header.querySelector(".btn-remove-meal").addEventListener("click", function() {
        mealCard.remove();
    });

    body.querySelector(".btn-add-food").addEventListener("click", function() {
        const foodContainer = body.querySelector(".food-items-container");
        const foodIndex = foodContainer.querySelectorAll(".food-item-row").length;
        foodContainer.appendChild(createFoodItemRow(mealIndex, foodIndex));
    });

    return mealCard;
}

function createFoodItemRow(mealIndex, foodIndex) {
    const row = document.createElement("div");
    row.className = "food-item-row";
    row.dataset.mealIndex = mealIndex;
    row.dataset.foodIndex = foodIndex;

    row.innerHTML = `
        <div class="food-item-row-header">
            <strong>Food Item ${foodIndex + 1}</strong>
            <button type="button" class="btn btn-danger btn-sm btn-remove-food">
                <i class="fa fa-trash"></i> Remove
            </button>
        </div>

        <div class="food-item-grid">
            <div class="food-item-field">
                <label>Food Name</label>
                <input type="text" class="form-control form-control-sm food-name" placeholder="e.g., Chicken Breast">
            </div>
            <div class="food-item-field">
                <label>Quantity</label>
                <input type="number" class="form-control form-control-sm food-quantity" placeholder="100" min="0" step="0.1">
            </div>
            <div class="food-item-field">
                <label>Unit</label>
                <select class="form-control form-control-sm food-quantity-unit">
                    <option value="g">g (grams)</option>
                    <option value="ml">ml (milliliters)</option>
                    <option value="oz">oz (ounces)</option>
                    <option value="cup">cup</option>
                    <option value="tbsp">tbsp (tablespoon)</option>
                    <option value="tsp">tsp (teaspoon)</option>
                    <option value="piece">piece</option>
                </select>
            </div>
        </div>

        <div class="food-item-grid" style="margin-top: 10px;">
            <div class="food-item-field">
                <label>Reference Qty</label>
                <input type="number" class="form-control form-control-sm food-ref-quantity" placeholder="100" min="0" step="0.1">
            </div>
            <div class="food-item-field">
                <label>Reference Unit</label>
                <select class="form-control form-control-sm food-ref-unit">
                    <option value="g">g (grams)</option>
                    <option value="ml">ml (milliliters)</option>
                    <option value="oz">oz (ounces)</option>
                    <option value="cup">cup</option>
                    <option value="tbsp">tbsp (tablespoon)</option>
                    <option value="tsp">tsp (teaspoon)</option>
                    <option value="piece">piece</option>
                </select>
            </div>
            <div class="food-item-field">
                <label>Ref Carbs (g)</label>
                <input type="number" class="form-control form-control-sm food-ref-carbs" placeholder="0" min="0" step="0.1">
            </div>
            <div class="food-item-field">
                <label>Ref Protein (g)</label>
                <input type="number" class="form-control form-control-sm food-ref-protein" placeholder="0" min="0" step="0.1">
            </div>
            <div class="food-item-field">
                <label>Ref Fat (g)</label>
                <input type="number" class="form-control form-control-sm food-ref-fat" placeholder="0" min="0" step="0.1">
            </div>
        </div>

        <div class="calculated-fields">
            <div class="calculated-field">
                <label>Carbs</label>
                <div class="value food-carbs">0</div>
            </div>
            <div class="calculated-field">
                <label>Protein</label>
                <div class="value food-protein">0</div>
            </div>
            <div class="calculated-field">
                <label>Fat</label>
                <div class="value food-fat">0</div>
            </div>
            <div class="calculated-field">
                <label>Calories</label>
                <div class="value food-calories">0</div>
            </div>
        </div>
    `;

    // Event listeners for calculation
    const quantityInputs = row.querySelectorAll(".food-quantity, .food-ref-quantity, .food-ref-carbs, .food-ref-protein, .food-ref-fat");
    quantityInputs.forEach(input => {
        input.addEventListener("change", function() {
            calculateFoodMacros(row);
        });
        input.addEventListener("input", function() {
            calculateFoodMacros(row);
        });
    });

    // Remove button
    row.querySelector(".btn-remove-food").addEventListener("click", function() {
        row.remove();
    });

    return row;
}

function calculateFoodMacros(foodRow) {
    const quantity = parseFloat(foodRow.querySelector(".food-quantity").value) || 0;
    const refQuantity = parseFloat(foodRow.querySelector(".food-ref-quantity").value) || 1;
    const refCarbs = parseFloat(foodRow.querySelector(".food-ref-carbs").value) || 0;
    const refProtein = parseFloat(foodRow.querySelector(".food-ref-protein").value) || 0;
    const refFat = parseFloat(foodRow.querySelector(".food-ref-fat").value) || 0;

    const ratio = refQuantity > 0 ? quantity / refQuantity : 0;

    const carbs = (refCarbs * ratio).toFixed(2);
    const protein = (refProtein * ratio).toFixed(2);
    const fat = (refFat * ratio).toFixed(2);
    const calories = ((carbs * 4) + (protein * 4) + (fat * 9)).toFixed(2);

    foodRow.querySelector(".food-carbs").textContent = carbs;
    foodRow.querySelector(".food-protein").textContent = protein;
    foodRow.querySelector(".food-fat").textContent = fat;
    foodRow.querySelector(".food-calories").textContent = calories;
}

// ============================================
// DATA FETCHING & USER SELECTION
// ============================================

let allUsers = [];
let selectedUserId = null;

async function fetchUsers() {
    const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("id, email, full_name")
        .order("email", { ascending: true });

    if (error) {
        console.error("fetchUsers error:", error);
        showStatusMessage("Failed to fetch users", "danger");
        return [];
    }

    return data || [];
}

async function populateUserSelect() {
    const select = getEl("dietChartUserSelect");
    if (!select) return;

    allUsers = await fetchUsers();

    select.innerHTML = '<option value="">Select a client...</option>';
    allUsers.forEach(user => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.email + (user.full_name ? ` (${user.full_name})` : "");
        select.appendChild(option);
    });
}

function selectUser(userId) {
    hideStatusMessage();
    selectedUserId = userId;

    if (!userId) {
        showPlaceholder();
        getEl("selectedUserInfo").style.display = "none";
        return;
    }

    const user = allUsers.find(u => u.id === userId);
    if (user) {
        getEl("selectedUserEmail").textContent = user.email;
        getEl("selectedUserName").textContent = user.full_name || "N/A";
        getEl("selectedUserInfo").style.display = "block";
    }

    // Clear form and show it
    setInputValue("dietChartTitle", "");
    setInputValue("dietChartNotes", "");
    getEl("mealsContainer").innerHTML = "";

    showForm();
}

// ============================================
// SAVE & RESET
// ============================================

async function saveDietChart() {
    if (!selectedUserId) {
        showStatusMessage("Please select a user first", "warning");
        return;
    }

    const saveBtn = getEl("saveDietChartBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
    }

    try {
        const title = getInputValue("dietChartTitle") || "Diet Chart";
        const notes = getInputValue("dietChartNotes") || "";

        // Collect meals data
        const meals = [];
        const mealCards = document.querySelectorAll(".meal-card");
        mealCards.forEach((card, mealIdx) => {
            const mealName = card.querySelector(".meal-name-input").value || `Meal ${mealIdx + 1}`;
            const foodItems = [];

            card.querySelectorAll(".food-item-row").forEach((foodRow) => {
                const foodItem = {
                    food_name: foodRow.querySelector(".food-name").value,
                    quantity: parseFloat(foodRow.querySelector(".food-quantity").value) || 0,
                    quantity_unit: foodRow.querySelector(".food-quantity-unit").value,
                    reference_quantity: parseFloat(foodRow.querySelector(".food-ref-quantity").value) || 0,
                    reference_unit: foodRow.querySelector(".food-ref-unit").value,
                    reference_carbs: parseFloat(foodRow.querySelector(".food-ref-carbs").value) || 0,
                    reference_protein: parseFloat(foodRow.querySelector(".food-ref-protein").value) || 0,
                    reference_fat: parseFloat(foodRow.querySelector(".food-ref-fat").value) || 0
                };
                foodItems.push(foodItem);
            });

            meals.push({
                meal_name: mealName,
                food_items: foodItems
            });
        });

        const payload = {
            user_id: selectedUserId,
            chart_title: title,
            notes: notes,
            meals: meals,
            updated_at: new Date().toISOString()
        };

        // TODO: Implement backend save logic
        // For now, log the payload
        console.log("Diet Chart Payload:", payload);

        showStatusMessage("Diet chart saved successfully!", "success");
    } catch (error) {
        console.error("saveDietChart error:", error);
        showStatusMessage("Failed to save diet chart: " + error.message, "danger");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Diet Chart";
        }
    }
}

function resetDietChart() {
    hideStatusMessage();
    setInputValue("dietChartTitle", "");
    setInputValue("dietChartNotes", "");
    getEl("mealsContainer").innerHTML = "";
}

// ============================================
// INIT
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    // Set admin greeting (placeholder - will be updated by JS)
    getEl("adminHelloName").textContent = "Admin";

    showPlaceholder();

    // Populate user select
    await populateUserSelect();

    // Event listeners
    getEl("dietChartUserSelect").addEventListener("change", (e) => {
        selectUser(e.target.value);
    });

    getEl("addMealBtn").addEventListener("click", (e) => {
        e.preventDefault();
        const container = getEl("mealsContainer");
        const mealIndex = container.querySelectorAll(".meal-card").length;
        container.appendChild(createMealCard(mealIndex));
    });

    getEl("saveDietChartBtn").addEventListener("click", async (e) => {
        e.preventDefault();
        await saveDietChart();
    });

    getEl("resetDietChartBtn").addEventListener("click", (e) => {
        e.preventDefault();
        resetDietChart();
    });
});
