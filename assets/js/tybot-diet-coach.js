(function () {
    const QUICK_ACTIONS = [
        { label: "Create a diet plan", icon: "sparkles", action: "create_plan", prompt: "Create a diet plan for me." },
        { label: "Suggest replacements", icon: "repeat-2", action: "suggest_replacement", prompt: "Suggest replacements for my current diet chart." },
        { label: "Improve my current diet", icon: "wand-sparkles", action: "improve_plan", prompt: "Improve my current diet chart." },
        { label: "Analyze my nutrition", icon: "scan-heart", action: "analyze_plan", prompt: "Analyze my current diet chart." }
    ];

    const state = {
        isOpen: false,
        isSending: false,
        conversation: [],
        lastUserMessage: ""
    };

    function $(id) {
        return document.getElementById(id);
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") {
            window.tyfitRefreshIcons();
        } else if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    function getClassNames(element) {
        return String(element?.getAttribute?.("class") || element?.className || "").split(/\s+/).filter(Boolean);
    }

    function setClassNames(element, names) {
        if (!element) return;
        const value = Array.from(new Set(names.filter(Boolean))).join(" ");
        if (typeof element.setAttribute === "function") {
            element.setAttribute("class", value);
            return;
        }
        try {
            element.className = value;
        } catch (_error) {
            // Some test wrappers expose className as read-only. Real browsers support one of these paths.
        }
    }

    function addClass(element, name) {
        if (!element || !name) return;
        if (element.classList && typeof element.classList.add === "function") {
            element.classList.add(name);
            return;
        }
        const names = getClassNames(element);
        if (!names.includes(name)) names.push(name);
        setClassNames(element, names);
    }

    function removeClass(element, name) {
        if (!element || !name) return;
        if (element.classList && typeof element.classList.remove === "function") {
            element.classList.remove(name);
            return;
        }
        setClassNames(element, getClassNames(element).filter((item) => item !== name));
    }

    function hasClass(element, name) {
        if (!element || !name) return false;
        if (element.classList && typeof element.classList.contains === "function") {
            return element.classList.contains(name);
        }
        return getClassNames(element).includes(name);
    }

    function setAttr(element, name, value) {
        if (!element) return;
        if (typeof element.setAttribute === "function") {
            element.setAttribute(name, value);
            return;
        }
        try {
            element[name] = value;
        } catch (_error) {
            // Real DOM elements support setAttribute; this fallback is for nonstandard test wrappers.
        }
    }

    function setHidden(element, hidden) {
        if (!element) return;
        try {
            element.hidden = Boolean(hidden);
        } catch (_error) {
            setAttr(element, "hidden", hidden ? "" : null);
        }
    }

    function appendText(parent, text) {
        parent.appendChild(document.createTextNode(String(text || "")));
    }

    function showToast(message, type = "success") {
        if (window.tyfitDietChartAI?.showToast) {
            window.tyfitDietChartAI.showToast(message, type);
            return;
        }

        const toast = $("appToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add("show");
        window.setTimeout(() => toast.classList.remove("show"), 3500);
    }

    function scrollMessages() {
        const messages = $("tybotMessages");
        if (messages) {
            messages.scrollTop = messages.scrollHeight;
        }
    }

    function createMessage(role, text) {
        const message = document.createElement("div");
        message.className = `tybot-message tybot-message--${role === "user" ? "user" : "bot"}`;
        appendText(message, text);
        return message;
    }

    function addMessage(role, text) {
        const messages = $("tybotMessages");
        if (!messages) return null;
        const node = createMessage(role, text);
        messages.appendChild(node);
        scrollMessages();
        return node;
    }

    function addTyping() {
        const messages = $("tybotMessages");
        if (!messages) return null;
        const node = document.createElement("div");
        node.className = "tybot-message tybot-message--bot";
        node.setAttribute("data-tybot-typing", "true");
        const dots = document.createElement("span");
        dots.className = "tybot-typing";
        dots.innerHTML = "<span></span><span></span><span></span>";
        node.appendChild(dots);
        messages.appendChild(node);
        scrollMessages();
        return node;
    }

    function removeTyping(node) {
        if (node?.parentNode) {
            node.parentNode.removeChild(node);
        }
    }

    function renderQuickActions() {
        const messages = $("tybotMessages");
        if (!messages) return;

        const intro = createMessage("bot", "Hi, I’m TyBot. I can help create diet plans, suggest smarter swaps, and review your current chart.");
        messages.appendChild(intro);

        const wrap = document.createElement("div");
        wrap.className = "tybot-card-list tybot-quick-actions";

        QUICK_ACTIONS.forEach((item) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "tybot-quick-action";
            button.dataset.action = item.action;
            button.dataset.prompt = item.prompt;
            button.innerHTML = `<i data-lucide="${item.icon}"></i><span></span>`;
            button.querySelector("span").textContent = item.label;
            wrap.appendChild(button);
        });

        messages.appendChild(wrap);
        refreshIcons();
        scrollMessages();
    }

    function getDietContext() {
        return window.tyfitDietChartAI?.getContext ? window.tyfitDietChartAI.getContext() : {};
    }

    function getInvokePayload(action, message) {
        const pageContext = getDietContext();
        return {
            action: action || "chat",
            message,
            targetUserId: pageContext.selectedUserId || pageContext.currentUserId || undefined,
            dietChartId: pageContext.selectedChartId || undefined,
            conversation: state.conversation.slice(-10),
            context: {
                source: "diet_chart",
                selectedUserMeta: pageContext.selectedUserMeta || {},
                currentChart: pageContext.chart || null,
                meals: pageContext.meals || [],
                foodCatalog: pageContext.foodCatalog || []
            }
        };
    }

    async function invokeTybot(action, message) {
        if (!window.supabaseClient?.functions?.invoke) {
            throw new Error("Supabase functions are not available on this page.");
        }

        const { data, error } = await window.supabaseClient.functions.invoke("tybot-diet-coach", {
            body: getInvokePayload(action, message)
        });

        if (error) {
            throw new Error(error.message || "TyBot is having trouble right now.");
        }

        if (!data?.success) {
            throw new Error(data?.reply || data?.error || "TyBot is having trouble right now.");
        }

        return data;
    }

    function formatMacroValue(value, suffix) {
        const number = Number(value);
        if (!Number.isFinite(number)) return `0 ${suffix}`;
        return `${Math.round(number)} ${suffix}`;
    }

    function renderQuestions(questions) {
        if (!Array.isArray(questions) || !questions.length) return;
        const messages = $("tybotMessages");
        if (!messages) return;

        const wrap = document.createElement("div");
        wrap.className = "tybot-card-list";
        questions.forEach((question) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "tybot-quick-action";
            button.dataset.action = "chat";
            button.dataset.prompt = question;
            button.innerHTML = '<i data-lucide="message-circle"></i><span></span>';
            button.querySelector("span").textContent = question;
            wrap.appendChild(button);
        });
        messages.appendChild(wrap);
        refreshIcons();
    }

    function renderPlanPreview(plan) {
        if (!plan || typeof plan !== "object") return;
        const messages = $("tybotMessages");
        if (!messages) return;

        const card = document.createElement("article");
        card.className = "tybot-plan-card";

        const title = document.createElement("h4");
        title.textContent = plan.title || plan.chartTitle || "TyBot Plan";
        card.appendChild(title);

        const macros = document.createElement("div");
        macros.className = "tybot-plan-macros";
        [
            ["Calories", formatMacroValue(plan.dailyCalories || plan.calories, "kcal")],
            ["Protein", formatMacroValue(plan.protein, "g")],
            ["Carbs", formatMacroValue(plan.carbs, "g")],
            ["Fats", formatMacroValue(plan.fats || plan.fat, "g")]
        ].forEach(([label, value]) => {
            const pill = document.createElement("span");
            pill.textContent = `${label}: ${value}`;
            macros.appendChild(pill);
        });
        card.appendChild(macros);

        const mealPreview = document.createElement("div");
        mealPreview.className = "tybot-meal-preview";
        (Array.isArray(plan.meals) ? plan.meals.slice(0, 5) : []).forEach((meal) => {
            const strong = document.createElement("strong");
            strong.textContent = meal.meal_name || meal.mealName || meal.name || "Meal";
            const detail = document.createElement("p");
            const items = Array.isArray(meal.items) ? meal.items : Array.isArray(meal.foods) ? meal.foods : [];
            detail.textContent = items.map((item) => item.food_name || item.foodName || item.name).filter(Boolean).join(", ") || "Foods suggested by TyBot";
            mealPreview.appendChild(strong);
            mealPreview.appendChild(detail);
        });
        card.appendChild(mealPreview);

        const actions = document.createElement("div");
        actions.className = "tybot-card-actions";
        const save = document.createElement("button");
        save.type = "button";
        save.className = "tybot-action-btn tybot-action-btn--primary";
        save.textContent = "Save Plan";
        save.addEventListener("click", async () => {
            save.disabled = true;
            save.textContent = "Saving...";
            try {
                await window.tyfitDietChartAI.savePreviewPlan(plan);
                showToast("TyBot plan saved successfully.", "success");
            } catch (error) {
                console.error("save TyBot plan error:", error);
                showToast(error.message || "Could not save TyBot plan.", "error");
            } finally {
                save.disabled = false;
                save.textContent = "Save Plan";
            }
        });

        const regenerate = document.createElement("button");
        regenerate.type = "button";
        regenerate.className = "tybot-action-btn tybot-action-btn--ghost";
        regenerate.textContent = "Regenerate";
        regenerate.addEventListener("click", () => sendMessage(state.lastUserMessage || "Regenerate this diet plan.", "create_plan"));

        actions.appendChild(save);
        actions.appendChild(regenerate);
        card.appendChild(actions);
        messages.appendChild(card);
    }

    function renderReplacementOptions(options) {
        if (!Array.isArray(options) || !options.length) return;
        const messages = $("tybotMessages");
        if (!messages) return;

        const wrap = document.createElement("div");
        wrap.className = "tybot-card-list";

        options.forEach((option) => {
            const card = document.createElement("article");
            card.className = "tybot-replacement-card";

            const title = document.createElement("h4");
            title.textContent = option.food_name || option.foodName || option.name || "Replacement";
            card.appendChild(title);

            const why = document.createElement("p");
            why.textContent = option.why || option.reason || "A balanced option based on your current diet chart.";
            card.appendChild(why);

            const macros = document.createElement("div");
            macros.className = "tybot-replacement-macros";
            [
                ["Qty", `${option.quantity || 100}${option.quantity_unit || option.unit || "g"}`],
                ["Protein", formatMacroValue(option.protein || option.reference_protein || option.referenceProtein, "g")],
                ["Carbs", formatMacroValue(option.carbs || option.reference_carbs || option.referenceCarbs, "g")],
                ["Fats", formatMacroValue(option.fats || option.fat || option.reference_fat || option.referenceFat, "g")]
            ].forEach(([label, value]) => {
                const pill = document.createElement("span");
                pill.textContent = `${label}: ${value}`;
                macros.appendChild(pill);
            });
            card.appendChild(macros);

            const actions = document.createElement("div");
            actions.className = "tybot-card-actions";
            const use = document.createElement("button");
            use.type = "button";
            use.className = "tybot-action-btn tybot-action-btn--primary";
            use.textContent = "Use this";
            use.disabled = !option.dietItemId && !option.diet_item_id && !option.itemId;
            use.addEventListener("click", async () => {
                use.disabled = true;
                use.textContent = "Applying...";
                try {
                    await window.tyfitDietChartAI.applyReplacement(option);
                    showToast("Replacement applied.", "success");
                } catch (error) {
                    console.error("apply TyBot replacement error:", error);
                    showToast(error.message || "Could not apply replacement.", "error");
                } finally {
                    use.disabled = false;
                    use.textContent = "Use this";
                }
            });
            actions.appendChild(use);
            card.appendChild(actions);
            wrap.appendChild(card);
        });

        messages.appendChild(wrap);
    }

    function renderStructuredResponse(data) {
        if (data.reply) {
            addMessage("bot", data.reply);
        }
        renderQuestions(data.questions);
        renderPlanPreview(data.previewPlan);
        renderReplacementOptions(data.replacementOptions);
        refreshIcons();
        scrollMessages();
    }

    async function sendMessage(message, action = "chat") {
        const text = String(message || "").trim();
        if (!text || state.isSending) return;

        state.isSending = true;
        state.lastUserMessage = text;
        addMessage("user", text);
        state.conversation.push({ role: "user", content: text });

        const input = $("tybotInput");
        const typing = addTyping();
        if (input) input.value = "";

        try {
            const data = await invokeTybot(action, text);
            removeTyping(typing);
            renderStructuredResponse(data);
            if (data.reply) {
                state.conversation.push({ role: "assistant", content: data.reply });
            }
        } catch (error) {
            removeTyping(typing);
            console.error("TyBot invoke error:", error);
            addMessage("bot", error.message || "TyBot is having trouble right now. Please try again.");
        } finally {
            state.isSending = false;
        }
    }

    function openTybot() {
        const sheet = $("tybotSheet");
        const backdrop = $("tybotBackdrop");
        if (!sheet || !backdrop) return;

        setHidden(backdrop, false);
        setAttr(sheet, "aria-hidden", "false");
        addClass(document.body, "tybot-open");
        window.requestAnimationFrame(() => {
            addClass(backdrop, "is-open");
            addClass(sheet, "is-open");
        });

        if (!state.isOpen) {
            const messages = $("tybotMessages");
            if (messages && !messages.childElementCount) {
                renderQuickActions();
            }
        }

        state.isOpen = true;
        window.setTimeout(() => $("tybotInput")?.focus(), 220);
    }

    function closeTybot() {
        const sheet = $("tybotSheet");
        const backdrop = $("tybotBackdrop");
        if (!sheet || !backdrop) return;

        removeClass(sheet, "is-open");
        removeClass(backdrop, "is-open");
        setAttr(sheet, "aria-hidden", "true");
        removeClass(document.body, "tybot-open");
        window.setTimeout(() => {
            if (!hasClass(sheet, "is-open")) {
                setHidden(backdrop, true);
            }
        }, 200);
    }

    function bindEvents() {
        $("tybotOpenBtn")?.addEventListener("click", openTybot);
        $("tybotCloseBtn")?.addEventListener("click", closeTybot);
        $("tybotBackdrop")?.addEventListener("click", closeTybot);

        $("tybotComposer")?.addEventListener("submit", (event) => {
            event.preventDefault();
            sendMessage($("tybotInput")?.value || "", "chat");
        });

        $("tybotMessages")?.addEventListener("click", (event) => {
            const quickAction = event.target.closest(".tybot-quick-action");
            if (!quickAction) return;
            sendMessage(quickAction.dataset.prompt || quickAction.textContent || "", quickAction.dataset.action || "chat");
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && hasClass($("tybotSheet"), "is-open")) {
                closeTybot();
            }
        });
    }

    function initTybotDietCoach() {
        bindEvents();
        refreshIcons();
    }

    window.tybotDietCoach = {
        open: openTybot,
        close: closeTybot,
        send: sendMessage
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTybotDietCoach, { once: true });
    } else {
        initTybotDietCoach();
    }
})();
