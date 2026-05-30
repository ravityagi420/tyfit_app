(function () {
    "use strict";

    const ACTIVITY_LEVELS = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        heavy: 1.725,
        athlete: 1.9
    };

    const DIET_TYPES = {
        balanced: { label: "Balanced", protein: 30, carbs: 40, fats: 30 },
        high_protein: { label: "High Protein", protein: 40, carbs: 30, fats: 30 },
        low_carb: { label: "Low Carb", protein: 35, carbs: 25, fats: 40 },
        keto: { label: "Keto", protein: 25, carbs: 5, fats: 70 },
        custom: { label: "Custom", protein: 30, carbs: 40, fats: 30 }
    };

    function byId(id) {
        return document.getElementById(id);
    }

    function numberValue(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }

    function inRange(value, min, max) {
        return Number.isFinite(value) && value >= min && value <= max;
    }

    function round(value) {
        return Math.round(Number(value) || 0);
    }

    function calculateBmr({ gender, age, weightKg, heightCm, bodyFatPercent }) {
        const hasBodyFat = bodyFatPercent !== "" && bodyFatPercent !== null && bodyFatPercent !== undefined;
        const bodyFat = numberValue(bodyFatPercent);
        if (hasBodyFat && Number.isFinite(bodyFat)) {
            const leanBodyMass = weightKg * (1 - (bodyFat / 100));
            return round(370 + (21.6 * leanBodyMass));
        }

        const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
        return round(String(gender).toLowerCase() === "female" ? base - 161 : base + 5);
    }

    function calculateTdee(bmr, activityMultiplier) {
        return round(bmr * activityMultiplier);
    }

    function calculateMacros(totalCalories, ratio) {
        const proteinCalories = totalCalories * (ratio.protein / 100);
        const carbCalories = totalCalories * (ratio.carbs / 100);
        const fatCalories = totalCalories * (ratio.fats / 100);
        return {
            proteinGrams: round(proteinCalories / 4),
            carbGrams: round(carbCalories / 4),
            fatGrams: round(fatCalories / 9),
            proteinCalories: round(proteinCalories),
            carbCalories: round(carbCalories),
            fatCalories: round(fatCalories),
            ratio: {
                protein: round(ratio.protein),
                carbs: round(ratio.carbs),
                fats: round(ratio.fats)
            }
        };
    }

    function calculateGoal({ currentWeight, targetWeight, weeks, tdee, gender }) {
        const weightDifferenceKg = currentWeight - targetWeight;
        if (weightDifferenceKg === 0) {
            return null;
        }

        const totalCalories = Math.abs(weightDifferenceKg) * 7700;
        const dailyChange = round(totalCalories / (weeks * 7));
        const isLoss = weightDifferenceKg > 0;
        const targetCalories = round(isLoss ? tdee - dailyChange : tdee + dailyChange);
        const halfwayWeight = isLoss
            ? currentWeight - (Math.abs(weightDifferenceKg) / 2)
            : currentWeight + (Math.abs(weightDifferenceKg) / 2);

        let status = "";
        let message = "";
        if (isLoss) {
            if (dailyChange <= 250) {
                status = "Slow / low risk";
                message = "Gentle pace with a low-risk deficit.";
            } else if (dailyChange <= 500) {
                status = "Sustainable & Safe";
                message = "A practical deficit for steady fat loss.";
            } else if (dailyChange <= 750) {
                status = "Aggressive";
                message = "This is aggressive. Monitor energy and recovery.";
            } else {
                status = "Too aggressive";
                message = "This is too aggressive. Consider increasing your timeline.";
            }
        } else if (dailyChange <= 250) {
            status = "Lean gain";
            message = "A controlled surplus for lean progress.";
        } else if (dailyChange <= 500) {
            status = "Moderate gain";
            message = "A stronger surplus with manageable fat-gain risk.";
        } else {
            status = "Aggressive gain";
            message = "Higher fat gain risk. Consider a smaller surplus.";
        }

        const veryLow = isLoss && ((String(gender).toLowerCase() === "female" && targetCalories < 1200) || (String(gender).toLowerCase() !== "female" && targetCalories < 1500));

        return {
            type: isLoss ? "deficit" : "surplus",
            weightDifferenceKg,
            totalCalories: round(totalCalories),
            dailyChange,
            targetCalories,
            halfwayWeight: Number(halfwayWeight.toFixed(1)),
            status,
            message,
            veryLow
        };
    }

    function showToast(message) {
        const toast = byId("calcToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("is-show");
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => toast.classList.remove("is-show"), 2400);
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") {
            window.tyfitRefreshIcons();
        } else if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    function openSheet(id) {
        const sheet = byId(id);
        if (!sheet) return;
        sheet.hidden = false;
        sheet.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        refreshIcons();
    }

    function closeSheet(id) {
        const sheet = byId(id);
        if (!sheet) return;
        sheet.hidden = true;
        sheet.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function bindSheetClosers() {
        document.addEventListener("click", (event) => {
            const close = event.target.closest("[data-calc-sheet-close]");
            if (!close) return;
            const sheet = close.closest(".calc-sheet");
            if (sheet?.id) closeSheet(sheet.id);
        });
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            document.querySelectorAll(".calc-sheet:not([hidden])").forEach((sheet) => closeSheet(sheet.id));
        });
    }

    function setError(fieldName, message) {
        const row = document.querySelector(`[data-field="${fieldName}"]`);
        if (!row) return;
        const error = row.querySelector(".calc-error");
        row.classList.toggle("is-invalid", Boolean(message));
        if (error) error.textContent = message || "";
    }

    function clearErrors(fields) {
        fields.forEach((field) => setError(field, ""));
    }

    function saveReturnState(key, form) {
        if (!form) return;
        const state = {};
        new FormData(form).forEach((value, field) => {
            state[field] = value;
        });
        sessionStorage.setItem(key, JSON.stringify(state));
    }

    function restoreState(key, form) {
        if (!form) return {};
        let state = {};
        try {
            state = JSON.parse(sessionStorage.getItem(key) || "{}") || {};
        } catch (error) {
            state = {};
        }
        Object.entries(state).forEach(([field, value]) => {
            const input = form.elements[field];
            if (input) input.value = value;
        });
        return state;
    }

    function setCalculatedTdee(value) {
        sessionStorage.setItem("calculatedTdee", String(round(value)));
    }

    function consumeCalculatedTdee() {
        const value = sessionStorage.getItem("calculatedTdee");
        if (!value) return null;
        sessionStorage.removeItem("calculatedTdee");
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function getReturnTo() {
        return new URLSearchParams(window.location.search).get("returnTo") || sessionStorage.getItem("calculatorReturnTo") || "";
    }

    function goBack(fallback) {
        if (window.history.length > 1) {
            window.history.back();
            return;
        }
        window.location.href = fallback || "index.html";
    }

    window.TyfitCalculators = {
        ACTIVITY_LEVELS,
        DIET_TYPES,
        byId,
        numberValue,
        inRange,
        round,
        calculateBmr,
        calculateTdee,
        calculateMacros,
        calculateGoal,
        showToast,
        refreshIcons,
        openSheet,
        closeSheet,
        bindSheetClosers,
        setError,
        clearErrors,
        saveReturnState,
        restoreState,
        setCalculatedTdee,
        consumeCalculatedTdee,
        getReturnTo,
        goBack
    };

    document.addEventListener("DOMContentLoaded", bindSheetClosers);
}());
