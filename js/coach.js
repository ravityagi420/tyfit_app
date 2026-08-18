(function () {
    "use strict";

    const BUCKET = "coach-assets";
    const DEFAULT_PROFILE_IMAGE = "assets/coach/coach-avatar-premium.svg";
    const PLAN_MOUNTAIN_IMAGE = "assets/coach/coach-plan-mountain.svg";
    const DEFAULT_BEFORE_IMAGE = "assets/coach/transformation-before.svg";
    const DEFAULT_AFTER_IMAGE = "assets/coach/transformation-after.svg";
    const TESTIMONIAL_FALLBACK_FACES = [
        "assets/coach/testimonial-fallbacks/client-1.png",
        "assets/coach/testimonial-fallbacks/client-2.png",
        "assets/coach/testimonial-fallbacks/client-3.png"
    ];
    const DEFAULT_PLANS = [
        {
            title: "12 Week Transformation",
            subtitle: "Perfect to kickstart your fitness journey.",
            price_amount: 175,
            currency: "EUR",
            price_label: "One-time",
            duration_weeks: 12,
            best_for: "Clients who want structure, accountability and a clear first transformation phase.",
            feature_chips: ["Nutrition", "Training", "Check-ins", "Support"],
            included_features: ["Personalized nutrition plan", "Training plan guidance", "Weekly check-ins", "Coach support"],
            icon_key: "sparkles",
            is_active: true,
            is_published: true,
            sort_order: 1
        },
        {
            title: "24 Week Transformation",
            subtitle: "For long-term results and complete lifestyle change.",
            price_amount: 299,
            currency: "EUR",
            price_label: "One-time",
            duration_weeks: 24,
            best_for: "Clients who want deeper habit change and long-term support.",
            feature_chips: ["Advanced Nutrition", "Training", "Reviews", "Priority"],
            included_features: ["Everything in 12 Week Plan", "Advanced nutrition & training plans", "Bi-weekly progress reviews", "Habit coaching & mindset support", "Priority coach support"],
            icon_key: "badge-check",
            is_active: true,
            is_published: true,
            sort_order: 2
        },
        {
            title: "Couple Transformation",
            subtitle: "Transform together and stay accountable as a couple.",
            price_amount: 299,
            currency: "EUR",
            price_label: "One-time",
            duration_weeks: 12,
            best_for: "Couples who want shared accountability and a practical transformation plan.",
            feature_chips: ["2 People", "Training", "Progress", "Support"],
            included_features: ["Plans for two people", "Nutrition and training structure", "Progress tracking", "Shared accountability support"],
            icon_key: "heart-handshake",
            is_active: true,
            is_published: true,
            sort_order: 3
        }
    ];

    const state = {
        user: null,
        profile: null,
        coachProfile: null,
        socialLinks: [],
        contacts: [],
        expertise: [],
        plans: [],
        testimonials: [],
        transformations: [],
        publicTestimonialIndex: 0,
        publicTestimonialTimer: null
    };
    const editorState = {
        editingPlanId: null,
        editingTestimonialId: null
    };
    let floatingCtaVisibilityBound = false;
    let floatingCtaVisibilityTicking = false;
    const editedImageFiles = new Map();

    function el(id) {
        return document.getElementById(id);
    }

    function page() {
        return document.body?.dataset?.page || "";
    }

    function refreshIcons() {
        if (typeof window.tyfitRefreshIcons === "function") {
            window.tyfitRefreshIcons();
            return;
        }
        window.lucide?.createIcons?.();
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char]));
    }

    function truncateText(value, max = 128) {
        const text = String(value || "").replace(/\s+/g, " ").trim();
        if (text.length <= max) return text;
        return `${text.slice(0, max - 1).trim()}…`;
    }

    function setStatus(message, type = "info") {
        showToast(message, type);
        const box = el("coachPageStatus");
        if (!box) return;
        box.textContent = message || "";
        box.className = `coach-page-status is-show${type === "error" ? " is-error" : ""}`;
        if (message) {
            clearTimeout(setStatus._timer);
            setStatus._timer = setTimeout(() => {
                box.classList.remove("is-show", "is-error");
            }, 3600);
        }
    }

    function showToast(message, type = "info") {
        if (!message) return;
        const toast = el("appToast");
        if (!toast) return;
        toast.textContent = message;
        toast.classList.toggle("is-error", type === "error");
        toast.classList.add("is-show");
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(() => {
            toast.classList.remove("is-show", "is-error");
        }, 2400);
    }

    function slugify(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 60) || "coach";
    }

    function splitList(value) {
        return String(value || "")
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function joinList(value) {
        return Array.isArray(value) ? value.join("\n") : "";
    }

    function money(amount, currency = "EUR") {
        const value = Number(amount || 0);
        try {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
                maximumFractionDigits: Number.isInteger(value) ? 0 : 2
            }).format(value);
        } catch {
            return `${currency} ${value}`;
        }
    }

    function getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || "";
    }

    function publicUrl(path) {
        if (!path) return "";
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith("assets/")) return path;
        if (/^avatar-[1-6]\.svg$/i.test(path)) return `assets/avatars/${path}`;
        const { data } = window.supabaseClient.storage.from(BUCKET).getPublicUrl(path);
        return data?.publicUrl || "";
    }

    function displayUrl(path) {
        return publicUrl(path) || DEFAULT_PROFILE_IMAGE;
    }

    async function uploadCoachImage(file, folder) {
        if (!file || !state.user?.id) return "";
        const cleanName = String(file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${state.user.id}/${folder}/${Date.now()}-${cleanName}`;
        const { error } = await window.supabaseClient.storage.from(BUCKET).upload(path, file, {
            cacheControl: "3600",
            upsert: false
        });
        if (error) throw new Error(error.message || "Image upload failed.");
        return path;
    }

    function imageFileFor(inputId) {
        return editedImageFiles.get(inputId) || el(inputId)?.files?.[0] || null;
    }

    function editImage(file, aspectRatio = 1) {
        const modal = el("coachImageEditor");
        const canvas = el("coachImageEditorCanvas");
        const zoomInput = el("coachImageEditorZoom");
        const applyButton = el("coachImageEditorApply");
        if (!modal || !canvas || !zoomInput || !applyButton || !file) return Promise.resolve(file || null);

        return new Promise((resolve) => {
            const context = canvas.getContext("2d");
            const image = new Image();
            const objectUrl = URL.createObjectURL(file);
            const outputWidth = 1000;
            const outputHeight = Math.round(outputWidth / aspectRatio);
            let zoom = 1;
            let centerX = 0;
            let centerY = 0;
            let dragStart = null;
            const activePointers = new Map();
            let pinchStart = null;
            let settled = false;

            canvas.width = outputWidth;
            canvas.height = outputHeight;
            canvas.style.aspectRatio = String(aspectRatio);
            zoomInput.value = "1";

            function cropSize() {
                const baseWidth = Math.min(image.naturalWidth, image.naturalHeight * aspectRatio);
                return { width: baseWidth / zoom, height: (baseWidth / aspectRatio) / zoom };
            }

            function clampCenter() {
                const crop = cropSize();
                centerX = Math.max(crop.width / 2, Math.min(image.naturalWidth - crop.width / 2, centerX));
                centerY = Math.max(crop.height / 2, Math.min(image.naturalHeight - crop.height / 2, centerY));
            }

            function draw() {
                if (!image.naturalWidth) return;
                clampCenter();
                const crop = cropSize();
                context.clearRect(0, 0, outputWidth, outputHeight);
                context.drawImage(image, centerX - crop.width / 2, centerY - crop.height / 2, crop.width, crop.height, 0, 0, outputWidth, outputHeight);
            }

            function setZoom(nextZoom) {
                zoom = Math.max(1, Math.min(3, nextZoom));
                zoomInput.value = String(zoom);
                draw();
            }

            function finish(result) {
                if (settled) return;
                settled = true;
                modal.hidden = true;
                modal.setAttribute("aria-hidden", "true");
                document.body.classList.remove("coach-image-editor-open");
                URL.revokeObjectURL(objectUrl);
                resolve(result);
            }

            function cancel() { finish(null); }

            image.onload = () => {
                centerX = image.naturalWidth / 2;
                centerY = image.naturalHeight / 2;
                draw();
            };
            image.onerror = cancel;
            image.src = objectUrl;
            modal.hidden = false;
            modal.setAttribute("aria-hidden", "false");
            document.body.classList.add("coach-image-editor-open");
            refreshIcons();

            zoomInput.oninput = () => {
                setZoom(Number(zoomInput.value || 1));
            };
            canvas.onpointerdown = (event) => {
                activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
                if (activePointers.size === 2) {
                    const points = Array.from(activePointers.values());
                    pinchStart = { distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y), zoom };
                    dragStart = null;
                } else {
                dragStart = { x: event.clientX, y: event.clientY, centerX, centerY };
                }
                canvas.setPointerCapture?.(event.pointerId);
            };
            canvas.onpointermove = (event) => {
                if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
                if (activePointers.size === 2 && pinchStart) {
                    const points = Array.from(activePointers.values());
                    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
                    setZoom(pinchStart.zoom * distance / Math.max(1, pinchStart.distance));
                    return;
                }
                if (!dragStart) return;
                const crop = cropSize();
                const bounds = canvas.getBoundingClientRect();
                centerX = dragStart.centerX - ((event.clientX - dragStart.x) * crop.width / bounds.width);
                centerY = dragStart.centerY - ((event.clientY - dragStart.y) * crop.height / bounds.height);
                draw();
            };
            canvas.onpointerup = canvas.onpointercancel = (event) => {
                activePointers.delete(event.pointerId);
                pinchStart = null;
                dragStart = null;
            };
            canvas.onwheel = (event) => {
                event.preventDefault();
                setZoom(zoom + (event.deltaY < 0 ? .12 : -.12));
            };
            modal.querySelectorAll("[data-image-editor-cancel]").forEach((button) => { button.onclick = cancel; });
            applyButton.onclick = () => {
                canvas.toBlob((blob) => {
                    if (!blob) return cancel();
                    const baseName = String(file.name || "image").replace(/\.[^.]+$/, "");
                    finish(new File([blob], `${baseName}-cropped.jpg`, { type: "image/jpeg", lastModified: Date.now() }));
                }, "image/jpeg", .9);
            };
        });
    }

    function bindImageEditorInput(inputId, aspectRatio, onReady) {
        const input = el(inputId);
        if (!input) return;
        input.addEventListener("change", async () => {
            const original = input.files?.[0];
            if (!original) return;
            const edited = await editImage(original, aspectRatio);
            if (!edited) {
                input.value = "";
                editedImageFiles.delete(inputId);
                return;
            }
            editedImageFiles.set(inputId, edited);
            updateCoachTabStatuses();
            await onReady?.(edited);
        });
    }

    async function requireCoach() {
        const user = await window.tyfitProfile?.getCurrentUser?.();
        if (!user?.id) {
            window.location.href = "login.html";
            return null;
        }
        const profile = await window.tyfitProfile.fetchProfile(user.id);
        if (String(profile?.role || "").toLowerCase() !== "coach") {
            setStatus("Coach Studio is available only for coach accounts.", "error");
            return null;
        }
        state.user = user;
        state.profile = profile;
        return { user, profile };
    }

    async function fetchOwnCoachProfile() {
        const { data, error } = await window.supabaseClient
            .from("coach_marketing_profiles")
            .select("*")
            .eq("coach_user_id", state.user.id)
            .maybeSingle();
        if (error) throw new Error(error.message || "Failed to load coach profile.");
        state.coachProfile = data || null;
        return state.coachProfile;
    }

    async function ensureCoachProfile() {
        await fetchOwnCoachProfile();
        if (state.coachProfile) return state.coachProfile;

        const name = window.tyfitProfile?.getDisplayName?.(state.profile, state.user) || state.user.email?.split("@")[0] || "Coach";
        const baseSlug = slugify(name);
        const payload = {
            coach_user_id: state.user.id,
            slug: `${baseSlug}-${state.user.id.slice(0, 6)}`,
            display_name: name,
            brand_name: name,
            professional_title: "Certified Nutrition Coach",
            tagline: "Build a stronger routine with practical coaching.",
            bio: "",
            profile_image_url: state.profile?.profile_picture_url || null,
            rating: 5,
            clients_count: 0,
            years_experience: 0,
            is_published: false
        };
        const { data, error } = await window.supabaseClient
            .from("coach_marketing_profiles")
            .insert(payload)
            .select("*")
            .single();
        if (error) throw new Error(error.message || "Failed to create coach profile.");
        state.coachProfile = data;
        return data;
    }

    async function loadCoachChildren(profileId, publicOnly = false) {
        const [
            social,
            contacts,
            expertise,
            plans,
            testimonials,
            transformations
        ] = await Promise.all([
            window.supabaseClient.from("coach_social_links").select("*").eq("coach_profile_id", profileId).order("sort_order"),
            window.supabaseClient.from("coach_contact_methods").select("*").eq("coach_profile_id", profileId).order("sort_order"),
            window.supabaseClient.from("coach_expertise").select("*").eq("coach_profile_id", profileId).order("sort_order"),
            window.supabaseClient.from("coach_coaching_plans").select("*").eq("coach_profile_id", profileId).order("sort_order"),
            window.supabaseClient.from("coach_testimonials").select("*").eq("coach_profile_id", profileId).order("sort_order"),
            window.supabaseClient.from("coach_transformations").select("*").eq("coach_profile_id", profileId).order("sort_order")
        ]);

        [social, contacts, expertise, plans, testimonials, transformations].forEach((result) => {
            if (result.error) throw new Error(result.error.message || "Failed to load coach data.");
        });

        state.socialLinks = (social.data || []).filter((item) => !publicOnly || item.is_visible);
        state.contacts = (contacts.data || []).filter((item) => !publicOnly || item.is_visible);
        state.expertise = (expertise.data || []).filter((item) => !publicOnly || item.is_visible);
        state.plans = (plans.data || []).filter((item) => !publicOnly || (item.is_published && item.is_active));
        state.testimonials = (testimonials.data || []).filter((item) => !publicOnly || item.is_published);
        state.transformations = (transformations.data || []).filter((item) => !publicOnly || item.is_published);
    }

    async function loadPublicCoachProfile() {
        const slug = getParam("slug");
        const coachId = getParam("coach");
        let query = window.supabaseClient
            .from("coach_marketing_profiles")
            .select("*")
            .eq("is_published", true)
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("updated_at", { ascending: false, nullsFirst: false })
            .limit(1);
        if (slug) query = query.eq("slug", slug);
        if (coachId) query = query.eq("coach_user_id", coachId);
        const { data, error } = await query.maybeSingle();
        if (error) throw new Error(error.message || "Failed to load public coach profile.");
        if (!data) return null;
        state.coachProfile = data;
        return data;
    }

    function profileLink(suffix = "coach_public_profile.html") {
        const slug = state.coachProfile?.slug;
        return `${suffix}${slug ? `?slug=${encodeURIComponent(slug)}` : ""}`;
    }

    function setValue(id, value) {
        const node = el(id);
        if (!node) return;
        if (node.type === "checkbox") node.checked = Boolean(value);
        else if (node.type === "file") node.value = "";
        else node.value = value ?? "";
    }

    function getValue(id) {
        const node = el(id);
        if (!node) return "";
        if (node.type === "checkbox") return node.checked;
        return node.value;
    }

    const FIELD_ICONS = {
        coachDisplayName: "user",
        coachBrandName: "badge",
        coachSlug: "link",
        coachTitle: "shield-check",
        coachTagline: "sparkles",
        coachBio: "file-text",
        coachRating: "star",
        coachClientsCount: "users",
        coachYearsExperience: "award",
        coachInstagram: "instagram",
        coachLinkedin: "linkedin",
        coachFacebook: "facebook",
        coachWhatsapp: "message-circle",
        coachEmail: "mail",
        coachPhone: "phone",
        coachExpertise: "flame",
        planTitle: "badge-euro",
        planSubtitle: "captions",
        planPrice: "euro",
        planCurrency: "coins",
        planPriceLabel: "receipt",
        planDuration: "calendar-days",
        planIcon: "icons",
        planChips: "tags",
        planBestFor: "target",
        planFeatures: "list-checks",
        testimonialName: "user-round-check",
        testimonialRating: "star",
        testimonialAvatarFile: "image-up",
        testimonialQuote: "quote",
        transformationClient: "user",
        transformationTitle: "trending-up",
        transformationMetric: "activity",
        transformationBeforeFile: "image-up",
        transformationAfterFile: "image-up",
        transformationBefore: "image",
        transformationAfter: "image",
        transformationSummary: "file-heart"
    };
    const SOCIAL_FIELD_ICONS = {
        coachInstagram: "assets/coach/instagram-icon.svg",
        coachLinkedin: "assets/coach/linkedin-icon.svg",
        coachFacebook: "assets/coach/facebook-icon.svg"
    };

    function enhanceCoachFields() {
        document.querySelectorAll(".coach-field").forEach((field, index) => {
            if (field.dataset.enhanced === "true") return;
            const control = field.querySelector("input, select, textarea");
            if (!control) return;
            field.dataset.enhanced = "true";
            field.classList.add("tyfit-ui-field");
            const label = field.querySelector("label");
            label?.classList.add("tyfit-ui-label");
            const wrap = document.createElement("div");
            wrap.className = control.tagName === "SELECT" ? "coach-standard-control tyfit-ui-select-control" : "coach-standard-control tyfit-ui-icon-control";
            const icon = FIELD_ICONS[control.id] || ["sparkles", "user", "target", "mail", "activity"][index % 5];
            wrap.innerHTML = SOCIAL_FIELD_ICONS[control.id]
                ? `<span class="tyfit-ui-icon-tile coach-brand-icon"><img src="${SOCIAL_FIELD_ICONS[control.id]}" alt=""></span>`
                : `<span class="tyfit-ui-icon-tile"><i data-lucide="${icon}"></i></span>`;
            control.classList.add(control.tagName === "SELECT" ? "tyfit-ui-select" : "tyfit-ui-control");
            field.insertBefore(wrap, control);
            wrap.appendChild(control);
            if (control.tagName === "SELECT") {
                wrap.insertAdjacentHTML("beforeend", '<span class="tyfit-ui-select-chevron"><i data-lucide="chevron-down"></i></span>');
            }
        });
        refreshIcons();
    }

    function hasFormValues(ids) {
        return ids.filter((id) => String(getValue(id) || "").trim()).length;
    }

    function tabStateForForm(ids, requiredIds = ids) {
        const filled = hasFormValues(ids);
        if (!filled) return "empty";
        const requiredFilled = requiredIds.every((id) => String(getValue(id) || "").trim());
        return requiredFilled ? "done" : "partial";
    }

    function updateCoachTabStatuses() {
        const stateMap = {
            profile: tabStateForForm(
                ["coachDisplayName", "coachBrandName", "coachSlug", "coachTitle", "coachTagline", "coachBio", "coachInstagram", "coachLinkedin", "coachFacebook", "coachWhatsapp", "coachEmail", "coachPhone", "coachExpertise"],
                ["coachDisplayName", "coachSlug", "coachTitle", "coachTagline", "coachExpertise"]
            ),
            plans: state.plans.length ? "done" : tabStateForForm(["planTitle", "planSubtitle", "planPrice", "planChips"], ["planTitle", "planPrice"]),
            testimonials: state.testimonials.length ? "done" : tabStateForForm(["testimonialName", "testimonialQuote", "testimonialAvatarFile"], ["testimonialName", "testimonialQuote"]),
            transformations: state.transformations.length ? "done" : tabStateForForm(["transformationTitle", "transformationMetric", "transformationSummary"], ["transformationTitle"])
        };
        document.querySelectorAll("[data-coach-tab]").forEach((tab) => {
            const status = stateMap[tab.dataset.coachTab] || "empty";
            tab.dataset.status = status;
            const dot = tab.querySelector("[data-tab-status]");
            if (dot) dot.setAttribute("aria-label", status === "done" ? "Complete" : status === "partial" ? "Partially filled" : "Empty");
        });
    }

    function calculateCoachCompletion() {
        const p = state.coachProfile || {};
        const has = (value) => String(value || "").trim().length > 0;
        const checks = [
            { key: "photo", label: "Add your profile photo.", points: 10, done: has(p.profile_image_url) },
            { key: "name", label: "Add your coach name.", points: 10, done: has(p.display_name) || has(p.brand_name) },
            { key: "title", label: "Add your professional title.", points: 10, done: has(p.professional_title) },
            { key: "tagline", label: "Add a clear profile tagline.", points: 5, done: has(p.tagline) },
            { key: "contact", label: "Add contact information.", points: 10, done: state.contacts.some((item) => has(item.value)) },
            { key: "social", label: "Add at least one social link.", points: 5, done: state.socialLinks.some((item) => has(item.url)) },
            { key: "plans", label: "Add your first coaching plan.", points: 20, done: state.plans.some((item) => item.is_active !== false) },
            { key: "testimonial", label: "Add testimonials to build trust.", points: 15, done: state.testimonials.length > 0 },
            { key: "transformation", label: "Add transformations to strengthen your profile.", points: 15, done: state.transformations.length > 0 }
        ];
        const score = checks.reduce((sum, item) => sum + (item.done ? item.points : 0), 0);
        const percent = Math.min(100, Math.max(0, score));
        const missing = checks.filter((item) => !item.done);
        const published = Boolean(p.is_published);
        let stateName = "started";
        let status = "Getting Started";
        let icon = "alert-circle";
        let message = missing[0]?.label || "Complete your coach profile to start accepting clients.";
        let href = "coach_marketing_edit.html#profile";

        if (percent >= 100 && published) {
            stateName = "live";
            status = "Live";
            icon = "badge-check";
            message = "Your public page is live and ready for clients.";
            href = profileLink("coach_public_profile.html");
        } else if (percent >= 80) {
            stateName = "ready";
            status = "Ready to Publish";
            icon = "rocket";
            message = missing[0]?.label || "Your profile looks great. Publish your page and start sharing it.";
            href = "coach_marketing_edit.html#profile";
        } else if (percent >= 50) {
            stateName = "almost";
            status = "Almost Ready";
            icon = "sparkles";
            message = missing[0]?.label || "Publish your page when ready.";
            href = missing[0]?.key === "plans" ? "coach_marketing_edit.html#plans" : "coach_marketing_edit.html#testimonials";
        }

        const profilePoints = checks.slice(0, 6).reduce((sum, item) => sum + (item.done ? item.points : 0), 0);
        const marketingPercent = Math.round((profilePoints / 50) * 100);
        return { percent, status, icon, message, href, stateName, marketingPercent };
    }

    function setIconHtml(node, iconName) {
        if (!node) return;
        node.innerHTML = `<i data-lucide="${iconName}"></i>`;
    }

    function initCoachMarketingTabs() {
        const tabs = Array.from(document.querySelectorAll("[data-coach-tab]"));
        const panels = Array.from(document.querySelectorAll("[data-coach-panel]"));
        if (!tabs.length || !panels.length) return;

        const panelNames = new Set(panels.map((panel) => panel.dataset.coachPanel));
        const activate = (name, updateHash = true) => {
            const targetName = panelNames.has(name) ? name : "profile";
            tabs.forEach((tab) => {
                const isActive = tab.dataset.coachTab === targetName;
                tab.classList.toggle("is-active", isActive);
                tab.setAttribute("aria-selected", isActive ? "true" : "false");
            });
            panels.forEach((panel) => {
                const isActive = panel.dataset.coachPanel === targetName;
                panel.classList.toggle("is-active", isActive);
                panel.hidden = !isActive;
            });
            if (updateHash && window.location.hash !== `#${targetName}`) {
                window.history.replaceState(null, "", `#${targetName}`);
            }
            refreshIcons();
        };

        tabs.forEach((tab) => {
            if (tab.dataset.tabsBound === "true") return;
            tab.dataset.tabsBound = "true";
            tab.addEventListener("click", () => activate(tab.dataset.coachTab));
        });

        const initial = window.location.hash.replace("#", "");
        activate(initial || "profile", false);
        window.addEventListener("hashchange", () => activate(window.location.hash.replace("#", ""), false));
        updateCoachTabStatuses();
    }

    function renderStudio() {
        const profile = state.coachProfile;
        const avatar = el("coachStudioAvatar");
        const name = el("coachStudioName");
        const title = el("coachStudioTitle");
        const status = el("coachStudioStatus");
        const completion = calculateCoachCompletion();
        const activePlans = state.plans.filter((item) => item.is_active !== false).length;
        if (avatar) avatar.src = displayUrl(profile?.profile_image_url || DEFAULT_PROFILE_IMAGE);
        if (name) name.textContent = profile?.brand_name || profile?.display_name || "Coach Page";
        if (title) title.textContent = profile?.professional_title || "Marketing profile";
        if (status) {
            status.innerHTML = profile
                ? `<span class="coach-badge"><i data-lucide="${profile.is_published ? "badge-check" : "file-pen-line"}"></i>${profile.is_published ? "Published" : "Draft"}</span>`
                : "";
        }
        const preview = el("coachPreviewLink");
        if (preview) preview.href = profileLink("coach_public_profile.html");
        const completionWidget = el("coachCompletionWidget");
        if (completionWidget) {
            completionWidget.href = completion.href;
            completionWidget.dataset.completionState = completion.stateName;
        }
        setIconHtml(el("coachCompletionIcon"), completion.icon);
        const completionTitle = el("coachCompletionTitle");
        if (completionTitle) completionTitle.textContent = completion.status;
        const completionMessage = el("coachCompletionMessage");
        if (completionMessage) completionMessage.textContent = completion.message;
        const completionPercent = el("coachCompletionPercent");
        if (completionPercent) completionPercent.textContent = `${completion.percent}%`;
        const completionBar = el("coachCompletionBar");
        if (completionBar) completionBar.style.width = `${completion.percent}%`;
        const marketingBar = el("coachMarketingProgressBar");
        if (marketingBar) marketingBar.style.width = `${completion.marketingPercent}%`;
        const marketingText = el("coachMarketingProgressText");
        if (marketingText) marketingText.textContent = `${completion.marketingPercent}% Complete`;
        const plansCount = el("coachPlansCount");
        if (plansCount) plansCount.textContent = `${activePlans} Active ${activePlans === 1 ? "Plan" : "Plans"}`;
        const testimonialsCount = el("coachTestimonialsCount");
        if (testimonialsCount) testimonialsCount.textContent = `${state.testimonials.length} ${state.testimonials.length === 1 ? "Testimonial" : "Testimonials"}`;
        const transformationsCount = el("coachTransformationsCount");
        if (transformationsCount) transformationsCount.textContent = `${state.transformations.length} ${state.transformations.length === 1 ? "Transformation" : "Transformations"}`;
        const clientsCount = el("coachClientsCount");
        if (clientsCount) clientsCount.textContent = "0 Active Clients";
        refreshIcons();
    }

    function initStudioTabs() {
        const tabs = Array.from(document.querySelectorAll("[data-studio-tab]"));
        const panels = Array.from(document.querySelectorAll("[data-studio-panel]"));
        if (!tabs.length || !panels.length) return;
        const activate = (name) => {
            const target = name === "clients" ? "clients" : "marketing";
            tabs.forEach((tab) => {
                const active = tab.dataset.studioTab === target;
                tab.classList.toggle("is-active", active);
                tab.setAttribute("aria-selected", active ? "true" : "false");
            });
            panels.forEach((panel) => {
                const active = panel.dataset.studioPanel === target;
                panel.classList.toggle("is-active", active);
                panel.hidden = !active;
            });
        };
        tabs.forEach((tab) => {
            if (tab.dataset.bound === "true") return;
            tab.dataset.bound = "true";
            tab.addEventListener("click", () => activate(tab.dataset.studioTab));
        });
        activate("marketing");
    }

    async function saveStudioProfileImage(file) {
        if (!file || !state.coachProfile?.id) return;
        const imageUrl = await uploadCoachImage(file, "profile");
        const { data, error } = await window.supabaseClient
            .from("coach_marketing_profiles")
            .update({ profile_image_url: imageUrl })
            .eq("id", state.coachProfile.id)
            .select("*")
            .single();
        if (error) throw new Error(error.message || "Could not update profile image.");
        state.coachProfile = data;
        renderStudio();
        setStatus("Profile image updated.");
    }

    function fillEditor() {
        const p = state.coachProfile || {};
        setValue("coachDisplayName", p.display_name);
        setValue("coachBrandName", p.brand_name);
        setValue("coachSlug", p.slug);
        setValue("coachTitle", p.professional_title);
        setValue("coachTagline", p.tagline);
        setValue("coachBio", p.bio);
        setValue("coachRating", p.rating);
        setValue("coachClientsCount", p.clients_count);
        setValue("coachYearsExperience", p.years_experience);
        setValue("coachPublished", p.is_published);
        setValue("coachInstagram", state.socialLinks.find((x) => x.platform === "instagram")?.url || "");
        setValue("coachLinkedin", state.socialLinks.find((x) => x.platform === "linkedin")?.url || "");
        setValue("coachFacebook", state.socialLinks.find((x) => x.platform === "facebook")?.url || "");
        setValue("coachWhatsapp", state.contacts.find((x) => x.contact_type === "whatsapp")?.value || "");
        setValue("coachEmail", state.contacts.find((x) => x.contact_type === "email")?.value || state.profile?.email || "");
        setValue("coachPhone", state.contacts.find((x) => x.contact_type === "phone")?.value || "");
        setValue("coachExpertise", state.expertise.map((x) => x.label).join(", "));
        const image = el("coachProfilePreview");
        if (image) image.src = displayUrl(p.profile_image_url);
        renderPlansEditor();
        renderTestimonialsEditor();
        renderTransformationsEditor();
        enhanceCoachFields();
        updateCoachTabStatuses();
    }

    async function replaceRows(table, rows) {
        const profileId = state.coachProfile.id;
        const { error: deleteError } = await window.supabaseClient.from(table).delete().eq("coach_profile_id", profileId);
        if (deleteError) throw new Error(deleteError.message || `Failed to clear ${table}.`);
        if (!rows.length) return;
        const { error: insertError } = await window.supabaseClient.from(table).insert(rows);
        if (insertError) throw new Error(insertError.message || `Failed to save ${table}.`);
    }

    async function saveProfileBasics(options = {}) {
        const file = el("coachProfileImageFile")?.files?.[0];
        let imageUrl = state.coachProfile.profile_image_url || null;
        if (file) imageUrl = await uploadCoachImage(file, "profile");

        if (options.publish === true) setValue("coachPublished", true);
        const isPublished = options.publish === true || Boolean(getValue("coachPublished"));
        const payload = {
            display_name: getValue("coachDisplayName").trim(),
            brand_name: getValue("coachBrandName").trim() || null,
            slug: slugify(getValue("coachSlug")),
            professional_title: getValue("coachTitle").trim() || "Certified Nutrition Coach",
            tagline: getValue("coachTagline").trim() || null,
            bio: getValue("coachBio").trim() || null,
            profile_image_url: imageUrl,
            rating: Number(getValue("coachRating") || 5),
            clients_count: Number(getValue("coachClientsCount") || 0),
            years_experience: Number(getValue("coachYearsExperience") || 0),
            is_published: isPublished,
            published_at: isPublished ? (state.coachProfile.published_at || new Date().toISOString()) : null
        };
        if (!payload.display_name) throw new Error("Coach name is required.");
        if (!payload.slug) throw new Error("Slug is required.");
        const { data, error } = await window.supabaseClient
            .from("coach_marketing_profiles")
            .update(payload)
            .eq("id", state.coachProfile.id)
            .select("*")
            .single();
        if (error) throw new Error(error.message || "Failed to save coach profile.");
        state.coachProfile = data;

        await replaceRows("coach_social_links", [
            { platform: "instagram", url: getValue("coachInstagram"), sort_order: 1 },
            { platform: "linkedin", url: getValue("coachLinkedin"), sort_order: 2 },
            { platform: "facebook", url: getValue("coachFacebook"), sort_order: 3 }
        ].filter((x) => x.url).map((x) => ({ ...x, coach_profile_id: state.coachProfile.id, is_visible: true })));

        await replaceRows("coach_contact_methods", [
            { contact_type: "whatsapp", label: "WhatsApp", value: getValue("coachWhatsapp"), sort_order: 1 },
            { contact_type: "email", label: "Email", value: getValue("coachEmail"), sort_order: 2 },
            { contact_type: "phone", label: "Call", value: getValue("coachPhone"), sort_order: 3 }
        ].filter((x) => x.value).map((x) => ({ ...x, coach_profile_id: state.coachProfile.id, is_visible: true })));

        await replaceRows("coach_expertise", splitList(getValue("coachExpertise")).map((label, index) => ({
            coach_profile_id: state.coachProfile.id,
            label,
            sort_order: index + 1,
            is_visible: true
        })));

        await loadCoachChildren(state.coachProfile.id);
        fillEditor();
        setStatus(isPublished ? "Marketing page saved and published." : "Coach profile saved as draft.");
    }

    function planFromForm() {
        return {
            coach_profile_id: state.coachProfile.id,
            title: getValue("planTitle").trim(),
            subtitle: getValue("planSubtitle").trim() || null,
            price_amount: Number(getValue("planPrice") || 0),
            currency: getValue("planCurrency") || "EUR",
            price_label: getValue("planPriceLabel") || "One-time",
            duration_weeks: Number(getValue("planDuration") || 0) || null,
            best_for: getValue("planBestFor").trim() || null,
            feature_chips: splitList(getValue("planChips")),
            included_features: splitList(getValue("planFeatures")),
            icon_key: getValue("planIcon") || "sparkles",
            is_active: true,
            is_published: true,
            sort_order: state.plans.length + 1
        };
    }

    function setPlanFormMode(mode = "add") {
        const isEdit = mode === "edit";
        const save = el("savePlanBtn");
        if (save) save.innerHTML = `<i data-lucide="${isEdit ? "save" : "plus"}"></i> ${isEdit ? "Update Plan" : "Save Plan"}`;
        refreshIcons();
    }

    function resetPlanForm() {
        editorState.editingPlanId = null;
        ["planTitle", "planSubtitle", "planPrice", "planDuration", "planBestFor", "planFeatures", "planChips"].forEach((id) => setValue(id, ""));
        setValue("planCurrency", "EUR");
        setValue("planPriceLabel", "One-time");
        setValue("planIcon", "sparkles");
        setPlanFormMode("add");
        updateCoachTabStatuses();
    }

    function openPlanForm(plan = null) {
        const shell = el("coachPlanFormShell");
        if (shell) shell.hidden = false;
        const addButton = el("addPlanBtn");
        if (addButton) addButton.hidden = true;
        if (plan) {
            editorState.editingPlanId = plan.id;
            setValue("planTitle", plan.title);
            setValue("planSubtitle", plan.subtitle);
            setValue("planPrice", plan.price_amount);
            setValue("planCurrency", plan.currency || "EUR");
            setValue("planPriceLabel", plan.price_label || "One-time");
            setValue("planDuration", plan.duration_weeks);
            setValue("planIcon", plan.icon_key || "sparkles");
            setValue("planChips", (plan.feature_chips || []).join(", "));
            setValue("planBestFor", plan.best_for);
            setValue("planFeatures", joinList(plan.included_features));
            setPlanFormMode("edit");
        } else {
            resetPlanForm();
            if (shell) shell.hidden = false;
        }
        shell?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closePlanForm() {
        el("coachPlanFormShell")?.setAttribute("hidden", "");
        const addButton = el("addPlanBtn");
        if (addButton) addButton.hidden = false;
        resetPlanForm();
    }

    function renderPlansEditor() {
        const list = el("coachPlansList");
        if (!list) return;
        list.innerHTML = state.plans.length ? state.plans.map((plan) => `
            <div class="coach-mini-row">
                <div><strong>${escapeHtml(plan.title)}</strong><span>${money(plan.price_amount, plan.currency)} · ${(plan.feature_chips || []).join(", ")}</span></div>
                <div class="coach-row-actions">
                    <button type="button" class="coach-edit-icon-btn" data-edit-plan="${plan.id}" aria-label="Edit plan"><i data-lucide="pencil"></i></button>
                    <button type="button" class="coach-delete-icon-btn" data-delete-plan="${plan.id}" aria-label="Delete plan"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `).join("") : '<div class="coach-empty">No coaching plans yet.</div>';
        refreshIcons();
        updateCoachTabStatuses();
    }

    async function savePlan() {
        const row = planFromForm();
        if (!row.title) throw new Error("Plan title is required.");
        const wasEdit = Boolean(editorState.editingPlanId);
        let error;
        if (wasEdit) {
            const updateRow = { ...row };
            delete updateRow.coach_profile_id;
            delete updateRow.sort_order;
            ({ error } = await window.supabaseClient.from("coach_coaching_plans").update(updateRow).eq("id", editorState.editingPlanId));
        } else {
            ({ error } = await window.supabaseClient.from("coach_coaching_plans").insert(row));
        }
        if (error) throw new Error(error.message || "Failed to save plan.");
        await loadCoachChildren(state.coachProfile.id);
        renderPlansEditor();
        closePlanForm();
        setStatus(wasEdit ? "Plan updated." : "Plan saved.");
    }

    async function seedDefaultPlans() {
        const rows = DEFAULT_PLANS.map((plan) => ({ ...plan, coach_profile_id: state.coachProfile.id }));
        const { error } = await window.supabaseClient.from("coach_coaching_plans").insert(rows);
        if (error) throw new Error(error.message || "Failed to create default plans.");
        await loadCoachChildren(state.coachProfile.id);
        renderPlansEditor();
        setStatus("Default plans created.");
    }

    function renderTestimonialsEditor() {
        const list = el("coachTestimonialsList");
        if (!list) return;
        list.innerHTML = state.testimonials.length ? state.testimonials.map((item) => `
            <div class="coach-mini-row">
                <img class="coach-mini-avatar" src="${escapeHtml(displayUrl(item.client_image_url || DEFAULT_PROFILE_IMAGE))}" alt="">
                <div><strong>${escapeHtml(item.client_name)}</strong><span>${escapeHtml(item.quote)}</span></div>
                <div class="coach-row-actions">
                    <button type="button" class="coach-edit-icon-btn" data-edit-testimonial="${item.id}" aria-label="Edit testimonial"><i data-lucide="pencil"></i></button>
                    <button type="button" class="coach-delete-icon-btn" data-delete-testimonial="${item.id}" aria-label="Delete testimonial"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        `).join("") : '<div class="coach-empty">No testimonials yet.</div>';
        refreshIcons();
        updateCoachTabStatuses();
    }

    function setTestimonialFormMode(mode = "add") {
        const isEdit = mode === "edit";
        const save = el("saveTestimonialBtn");
        if (save) save.innerHTML = `<i data-lucide="${isEdit ? "save" : "plus"}"></i> ${isEdit ? "Update Testimonial" : "Save Testimonial"}`;
        refreshIcons();
    }

    function resetTestimonialForm() {
        editorState.editingTestimonialId = null;
        editedImageFiles.delete("testimonialAvatarFile");
        setValue("testimonialName", "");
        setValue("testimonialRating", "5");
        setValue("testimonialAvatarFile", "");
        setValue("testimonialQuote", "");
        setTestimonialFormMode("add");
        updateCoachTabStatuses();
    }

    function openTestimonialForm(item = null) {
        const shell = el("coachTestimonialFormShell");
        if (shell) shell.hidden = false;
        const addButton = el("addTestimonialBtn");
        if (addButton) addButton.hidden = true;
        if (item) {
            editorState.editingTestimonialId = item.id;
            setValue("testimonialName", item.client_name);
            setValue("testimonialRating", item.rating || 5);
            setValue("testimonialAvatarFile", "");
            setValue("testimonialQuote", item.quote);
            setTestimonialFormMode("edit");
        } else {
            resetTestimonialForm();
            if (shell) shell.hidden = false;
        }
        shell?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function closeTestimonialForm() {
        el("coachTestimonialFormShell")?.setAttribute("hidden", "");
        const addButton = el("addTestimonialBtn");
        if (addButton) addButton.hidden = false;
        resetTestimonialForm();
    }

    async function saveTestimonial() {
        const avatarFile = imageFileFor("testimonialAvatarFile");
        const existing = state.testimonials.find((item) => item.id === editorState.editingTestimonialId);
        const clientImage = avatarFile ? await uploadCoachImage(avatarFile, "testimonials") : (existing?.client_image_url || null);
        const payload = {
            coach_profile_id: state.coachProfile.id,
            client_name: getValue("testimonialName").trim(),
            quote: getValue("testimonialQuote").trim(),
            rating: Number(getValue("testimonialRating") || 5),
            client_image_url: clientImage,
            is_published: true,
            sort_order: state.testimonials.length + 1
        };
        if (!payload.client_name || !payload.quote) throw new Error("Testimonial name and quote are required.");
        const wasEdit = Boolean(editorState.editingTestimonialId);
        let error;
        if (wasEdit) {
            const updateRow = { ...payload };
            delete updateRow.coach_profile_id;
            delete updateRow.sort_order;
            ({ error } = await window.supabaseClient.from("coach_testimonials").update(updateRow).eq("id", editorState.editingTestimonialId));
        } else {
            ({ error } = await window.supabaseClient.from("coach_testimonials").insert(payload));
        }
        if (error) throw new Error(error.message || "Failed to save testimonial.");
        await loadCoachChildren(state.coachProfile.id);
        renderTestimonialsEditor();
        closeTestimonialForm();
        setStatus(wasEdit ? "Testimonial updated." : "Testimonial saved.");
    }

    function renderTransformationsEditor() {
        const list = el("coachTransformationsList");
        if (!list) return;
        list.innerHTML = state.transformations.length ? state.transformations.map((item) => `
            <div class="coach-mini-row">
                <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.result_metric || item.summary || "")}</span></div>
                <button type="button" class="coach-delete-icon-btn" data-delete-transformation="${item.id}" aria-label="Delete transformation"><i data-lucide="trash-2"></i></button>
            </div>
        `).join("") : '<div class="coach-empty">No transformations yet.</div>';
        refreshIcons();
        updateCoachTabStatuses();
    }

    async function saveTransformation() {
        const beforeFile = imageFileFor("transformationBeforeFile");
        const afterFile = imageFileFor("transformationAfterFile");
        const beforeImage = beforeFile ? await uploadCoachImage(beforeFile, "transformations") : getValue("transformationBefore").trim();
        const afterImage = afterFile ? await uploadCoachImage(afterFile, "transformations") : getValue("transformationAfter").trim();
        const payload = {
            coach_profile_id: state.coachProfile.id,
            client_name: getValue("transformationClient").trim() || null,
            title: getValue("transformationTitle").trim(),
            summary: getValue("transformationSummary").trim() || null,
            before_image_url: beforeImage || null,
            after_image_url: afterImage || null,
            result_metric: getValue("transformationMetric").trim() || null,
            is_published: true,
            sort_order: state.transformations.length + 1
        };
        if (!payload.title) throw new Error("Transformation title is required.");
        const { error } = await window.supabaseClient.from("coach_transformations").insert(payload);
        if (error) throw new Error(error.message || "Failed to save transformation.");
        editedImageFiles.delete("transformationBeforeFile");
        editedImageFiles.delete("transformationAfterFile");
        ["transformationClient", "transformationTitle", "transformationMetric", "transformationBeforeFile", "transformationAfterFile", "transformationBefore", "transformationAfter", "transformationSummary"].forEach((id) => setValue(id, ""));
        await loadCoachChildren(state.coachProfile.id);
        renderTransformationsEditor();
        setStatus("Transformation saved.");
    }

    async function deleteById(table, id) {
        const { error } = await window.supabaseClient.from(table).delete().eq("id", id);
        if (error) throw new Error(error.message || "Delete failed.");
        await loadCoachChildren(state.coachProfile.id);
        fillEditor();
        setStatus("Deleted.");
    }

    function activePanelName() {
        return document.querySelector("[data-coach-panel].is-active")?.dataset.coachPanel || "profile";
    }

    function planDraftHasValue() {
        return ["planTitle", "planSubtitle", "planPrice", "planBestFor", "planFeatures", "planChips"].some((id) => String(getValue(id) || "").trim());
    }

    function testimonialDraftHasValue() {
        return ["testimonialName", "testimonialQuote"].some((id) => String(getValue(id) || "").trim()) || Boolean(el("testimonialAvatarFile")?.files?.[0]);
    }

    function transformationDraftHasValue() {
        return ["transformationClient", "transformationTitle", "transformationMetric", "transformationSummary", "transformationBefore", "transformationAfter"].some((id) => String(getValue(id) || "").trim())
            || Boolean(el("transformationBeforeFile")?.files?.[0])
            || Boolean(el("transformationAfterFile")?.files?.[0]);
    }

    async function autosaveBeforePreview() {
        await saveProfileBasics({ publish: true });
        const active = activePanelName();
        if (active === "plans" && !el("coachPlanFormShell")?.hidden && planDraftHasValue()) await savePlan();
        if (active === "testimonials" && !el("coachTestimonialFormShell")?.hidden && testimonialDraftHasValue()) await saveTestimonial();
        if (active === "transformations" && transformationDraftHasValue()) await saveTransformation();
    }

    async function previewCoachPage() {
        await autosaveBeforePreview();
        window.location.href = profileLink("coach_public_profile.html");
    }

    function iconForPlan(plan, index = 0) {
        const icon = plan?.icon_key || ["sparkles", "badge-check", "heart-handshake"][index % 3];
        return icon;
    }

    function renderPlanCards(host, plans, expanded = false) {
        if (!host) return;
        host.innerHTML = plans.length ? plans.map((plan, index) => `
            <article class="coach-plan-card ${expanded ? "is-open" : ""}">
                <button type="button" class="coach-plan-toggle" data-plan-toggle>
                    <span class="coach-icon-tile ${index === 1 ? "is-green" : index === 2 ? "is-pink" : ""}"><i data-lucide="${iconForPlan(plan, index)}"></i></span>
                    <span class="coach-plan-copy">
                        <h3>${escapeHtml(plan.title)}</h3>
                        <p>${escapeHtml(plan.subtitle || "")}</p>
                        <span class="coach-chip-list">${(plan.feature_chips || []).slice(0, 4).map((chip) => `<span class="coach-chip">${escapeHtml(chip)}</span>`).join("")}</span>
                    </span>
                    <span class="coach-plan-price"><strong>${money(plan.price_amount, plan.currency)}</strong><span>${escapeHtml(plan.price_label || "One-time")}</span></span>
                </button>
                <div class="coach-plan-detail">
                    <ul class="coach-feature-list">${(plan.included_features || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
                    <p class="coach-subtitle"><strong>Duration:</strong> ${plan.duration_weeks || "-"} weeks · <strong>Best for:</strong> ${escapeHtml(plan.best_for || "Coaching clients")}</p>
                    <a class="coach-primary-btn" href="${contactHref("whatsapp") || "#"}">Enroll Now <i data-lucide="arrow-right"></i></a>
                </div>
            </article>
        `).join("") : '<div class="coach-empty">No published coaching plans yet.</div>';
        refreshIcons();
    }

    function contactHref(type) {
        const item = state.contacts.find((contact) => contact.contact_type === type);
        if (!item?.value) return "";
        if (type === "email") return `mailto:${item.value}`;
        if (type === "phone") return `tel:${item.value}`;
        if (type === "whatsapp") return /^https?:\/\//i.test(item.value) ? item.value : `https://wa.me/${String(item.value).replace(/\D/g, "")}`;
        return item.value;
    }

    function scheduleTestimonialAutoAdvance() {
        if (state.publicTestimonialTimer) {
            window.clearTimeout(state.publicTestimonialTimer);
            state.publicTestimonialTimer = null;
        }
    }

    function coachContactIcon(type) {
        const icons = {
            whatsapp: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="15" fill="#25D366"/><path fill="#fff" d="M22.8 18.9c-.4-.2-2.2-1.1-2.5-1.2-.3-.1-.5-.2-.8.2-.2.4-.9 1.2-1.1 1.4-.2.2-.4.3-.8.1-.4-.2-1.5-.5-2.8-1.7-1-1-1.7-2.1-1.9-2.5-.2-.4 0-.6.2-.8l.6-.7c.2-.2.2-.4.3-.6.1-.2 0-.5 0-.7-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.7.1-1 .5-.3.4-1.3 1.2-1.3 3 0 1.8 1.3 3.5 1.5 3.8.2.2 2.6 4 6.3 5.5.9.4 1.6.6 2.1.8.9.3 1.7.3 2.3.2.7-.1 2.2-.9 2.5-1.7.3-.8.3-1.5.2-1.7-.1-.3-.4-.4-.8-.6z"/><path fill="#fff" fill-rule="evenodd" d="M16 5.8c-5.6 0-10.2 4.5-10.2 10.1 0 1.8.5 3.5 1.3 5l-1.4 5.3 5.5-1.4c1.4.8 3.1 1.2 4.8 1.2 5.6 0 10.2-4.5 10.2-10.1S21.6 5.8 16 5.8zm0 18.5c-1.5 0-3-.4-4.2-1.1l-.3-.2-3.2.8.9-3.1-.2-.3c-.8-1.3-1.2-2.8-1.2-4.4 0-4.6 3.7-8.4 8.3-8.4s8.3 3.8 8.3 8.4-3.8 8.3-8.4 8.3z" clip-rule="evenodd"/></svg>`,
            linkedin: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="7" fill="#0A66C2"/><path fill="#fff" d="M9.4 13.2h4.1v12.1H9.4V13.2zm2.1-6c1.3 0 2.3 1 2.3 2.2 0 1.3-1 2.2-2.4 2.2-1.3 0-2.3-1-2.3-2.2s1-2.2 2.4-2.2zm4.3 6h3.9v1.7h.1c.5-1 1.9-2 3.8-2 4.1 0 4.9 2.7 4.9 6.2v6.2h-4.1v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.6h-4.1V13.2z"/></svg>`,
            instagram: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><defs><linearGradient id="coachIgGradient" x1="5" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse"><stop stop-color="#FEDA75"/><stop offset=".25" stop-color="#FA7E1E"/><stop offset=".5" stop-color="#D62976"/><stop offset=".75" stop-color="#962FBF"/><stop offset="1" stop-color="#4F5BD5"/></linearGradient></defs><rect x="3" y="3" width="26" height="26" rx="7" fill="url(#coachIgGradient)"/><rect x="9" y="9" width="14" height="14" rx="4.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="3.3" fill="none" stroke="#fff" stroke-width="2"/><circle cx="21.4" cy="10.8" r="1.3" fill="#fff"/></svg>`,
            facebook: `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="15" fill="#1877F2"/><path fill="#fff" d="M18.5 25.2v-8.3h2.8l.4-3.2h-3.2v-2c0-.9.3-1.6 1.7-1.6h1.8V7.2c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2.5h-3v3.2h3v8.3h3.5z"/></svg>`
        };
        if (icons[type]) return icons[type];
        const lucide = type === "email" ? "mail" : type === "phone" ? "phone" : "link";
        return `<i data-lucide="${lucide}" aria-hidden="true"></i>`;
    }

    function coachContactRow({ type, label, href, external = false }) {
        if (!href) return "";
        return `<a class="coach-public-contact-action is-${escapeHtml(type)}" href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>
            <span class="coach-contact-action-icon is-${escapeHtml(type)}">${coachContactIcon(type)}</span>
            <span>${escapeHtml(label)}</span>
            <i class="coach-contact-action-chevron" data-lucide="chevron-right" aria-hidden="true"></i>
        </a>`;
    }

    function renderPublicProfile() {
        const p = state.coachProfile;
        if (!p) {
            document.querySelector(".coach-shell")?.insertAdjacentHTML("afterbegin", '<div class="coach-page-status is-show is-error">This coach page is not published yet.</div>');
            return;
        }
        const image = displayUrl(p.profile_image_url);
        const rating = Number(p.rating || 0);
        // Temporary display value until the public review count is passed in dynamically.
        const reviews = 120;
        const clientsCount = Number(p.clients_count || 0);
        const yearsExperience = Number(p.years_experience || 0);
        const plansPreview = state.plans.length ? state.plans.slice(0, 3) : DEFAULT_PLANS.slice(0, 1);
        const testimonials = state.testimonials;
        const proofFaces = Array.from({ length: 3 }, (_, index) => {
            const testimonialFace = testimonials[index]?.client_image_url;
            return testimonialFace ? displayUrl(testimonialFace) : TESTIMONIAL_FALLBACK_FACES[index];
        });
        const transformations = state.transformations;
        if (state.publicTestimonialIndex >= testimonials.length) state.publicTestimonialIndex = 0;
        const testimonial = testimonials[state.publicTestimonialIndex] || null;
        const socialMeta = {
            instagram: "Instagram",
            linkedin: "LinkedIn",
            facebook: "Facebook"
        };
        const visibleSocial = state.socialLinks.filter((link) => link?.url && String(link.url).trim());
        const firstTransformation = transformations[0] || null;
        const coachFirstName = String(p.display_name || p.brand_name || "Coach").trim().split(/\s+/)[0] || "Coach";
        const contactActions = [
            { type: "whatsapp", label: "WhatsApp", href: contactHref("whatsapp"), external: true },
            { type: "email", label: "Email", href: contactHref("email") },
            { type: "phone", label: "Call", href: contactHref("phone") }
        ].map(coachContactRow).join("");
        const socialActions = visibleSocial.map((link) => {
            const label = socialMeta[link.platform] || link.platform;
            return coachContactRow({ type: link.platform, label, href: link.url, external: true });
        }).join("");
        const floatingContactContent = [contactActions, socialActions].filter(Boolean).join("");
        const heroExpertise = state.expertise.slice(0, 2);
        const heroExpertiseMarkup = heroExpertise.length ? `<div class="coach-primary-expertise">${heroExpertise.map((x, index) => {
            const rawLabel = String(x.label || "");
            const label = rawLabel.trim().toLowerCase() === "muscle gain" ? "Training" : rawLabel;
            return `<span class="coach-expertise-pill is-${index % 2}"><i data-lucide="${["flame", "dumbbell", "droplet", "leaf", "bone"][index % 2]}"></i>${escapeHtml(label)}</span>`;
        }).join("")}</div>` : "";
        const proofMetric = clientsCount > 0
            ? `<strong>${clientsCount}+</strong><small>Happy Clients</small>`
            : transformations.length > 0
                ? `<strong>${transformations.length}+</strong><small>Success Stories</small>`
                : "";
        const roundedRating = Math.max(0, Math.min(5, rating || 0));
        const proofStars = Array.from({ length: 5 }, (_, index) => `<span class="${index < Math.round(roundedRating) ? "is-filled" : ""}">★</span>`).join("");
        const proofRating = rating > 0 ? `<span class="coach-hero-proof-rating"><span class="coach-proof-stars" aria-label="${escapeHtml(rating.toFixed(1))} out of 5 stars">${proofStars}</span><b>${rating.toFixed(1)}</b>${reviews > 0 ? `<small>(${reviews}+ reviewed)</small>` : ""}</span>` : "";
        const proofCard = (proofMetric || proofRating) ? `
            <div class="coach-proof-card" aria-label="Coach social proof">
                <div class="coach-proof-card-top">
                    <div class="coach-hero-avatar-stack">${proofFaces.map((face, index) => `<img src="${escapeHtml(face)}" alt="Client ${index + 1}">`).join("")}</div>
                    ${proofMetric ? `<div class="coach-hero-proof-metric">${proofMetric}</div>` : ""}
                </div>
                ${proofRating}
            </div>
        ` : "";
        const bookingHref = contactHref("whatsapp") || contactHref("email") || "#";
        const plansMarkup = plansPreview.length ? `<div class="coach-plan-carousel">
            <button type="button" class="coach-plan-scroll-btn is-prev" data-plan-scroll="-1" aria-label="Show previous coaching plan" hidden><i data-lucide="chevron-left"></i></button>
            <div class="coach-plan-preview-grid">${plansPreview.map((plan, index) => {
            const duration = Number(plan.duration_weeks || 0);
            const inclusions = (plan.included_features || plan.feature_chips || []).length;
            const isLongTitle = String(plan.title || "").length > 21;
            return `<a class="coach-plan-preview-card theme-${index % 3}${index === 0 ? " is-popular" : ""}${isLongTitle ? " has-long-title" : ""}" href="${profileLink("coach_plans.html")}">
                ${index === 0 ? '<span class="coach-plan-popular-tag">Most Popular</span>' : ""}
                <span class="coach-plan-preview-heading"><i data-lucide="${escapeHtml(plan.icon_key || "target")}"></i><strong>${escapeHtml(plan.title)}</strong></span>
                <p>${escapeHtml(plan.subtitle || plan.best_for || "Personal coaching built around your goals.")}</p>
                <span class="coach-plan-preview-meta"><small><i data-lucide="calendar-check"></i>${duration ? `${duration} Weeks` : "Flexible"}</small><small><i data-lucide="clipboard-check"></i>${inclusions} Inclusions</small></span>
                <span class="coach-plan-preview-footer"><span><b>${money(plan.price_amount, plan.currency)}</b><small>${escapeHtml(plan.price_label || "One-time")}</small></span><i data-lucide="arrow-right"></i></span>
            </a>`;
        }).join("")}</div>
            <button type="button" class="coach-plan-scroll-btn is-next" data-plan-scroll="1" aria-label="Show next coaching plan" hidden><i data-lucide="chevron-right"></i></button>
        </div>` : '<div class="coach-empty">Coaching plans coming soon.</div>';
        const root = el("coachPublicRoot");
        if (!root) return;
        root.setAttribute("aria-busy", "false");
        root.innerHTML = `
            <div class="coach-public-shell">
                <div class="coach-public-grid">
                    <div class="coach-public-main">
                        <section class="coach-profile-hero">
                            <div class="coach-portrait-area">
                                <div class="coach-portrait-shell">
                                    <img class="coach-portrait-image" src="${escapeHtml(image)}" alt="${escapeHtml(p.display_name || p.brand_name || "Coach")}">
                                </div>
                                ${proofCard}
                            </div>
                            <div class="coach-hero-content">
                                <div class="coach-certified-badge"><i data-lucide="shield-check"></i>Certified Coach</div>
                                <div class="coach-name-row">
                                    <h1 class="coach-name">${escapeHtml(p.brand_name || p.display_name)}</h1>
                                    <span class="coach-verified-icon" aria-label="Verified coach"><i data-lucide="badge-check"></i></span>
                                </div>
                                <p class="coach-tagline">${escapeHtml(p.tagline || "Build a stronger routine with practical coaching.")}</p>
                                ${heroExpertiseMarkup}
                            </div>
                            <div class="coach-conversion-panel">
                                <div class="coach-statistics" aria-label="Coach stats">
                                    <span><i data-lucide="star"></i><strong>${rating ? rating.toFixed(1) : "—"}</strong><small>${reviews ? `(${reviews} Reviews)` : "Rating"}</small></span>
                                    <span><i data-lucide="users"></i><strong>${clientsCount ? `${clientsCount}+` : "—"}</strong><small>Clients</small></span>
                                    <span><i data-lucide="shield-check"></i><strong>${yearsExperience ? `${yearsExperience}+` : "—"}</strong><small>Years Exp.</small></span>
                                </div>
                                <button type="button" class="coach-booking-button js-coach-consultation-open"><span class="coach-booking-icon"><i data-lucide="calendar-days"></i></span><span class="coach-booking-copy"><strong>Book Consultation</strong><small>Get a personalised plan</small></span><span class="coach-booking-arrow"><i data-lucide="arrow-right"></i></span></button>
                                <div class="coach-trust-strip" aria-label="Consultation benefits">
                                    <span><i data-lucide="lock"></i>Private consultation</span>
                                    <span><i data-lucide="message-square"></i>Direct coach contact</span>
                                    <span><i data-lucide="clipboard-check"></i>Personalised plan</span>
                                </div>
                            </div>
                        </section>

                        <section class="coach-public-section coach-public-plans-inline"><div class="coach-public-section-head"><h2>Coaching Plans</h2><a href="${profileLink("coach_plans.html")}">View all plans <i data-lucide="arrow-right"></i></a></div>${plansMarkup}</section>

                        <section class="coach-public-section coach-public-expertise"><h2>My Expertise</h2><div class="coach-expertise-grid">${(state.expertise.length ? state.expertise : [
                            { label: "Fat Loss" }, { label: "Muscle Gain" }, { label: "Diabetes" }, { label: "Vegetarian Diet" }, { label: "Strength Training" }
                        ]).map((x, index) => `<span class="coach-expertise-pill is-${index % 5}"><i data-lucide="${["flame", "dumbbell", "droplet", "leaf", "bone"][index % 5]}"></i>${escapeHtml(x.label)}</span>`).join("")}</div></section>

                        ${testimonial ? `<section class="coach-public-section coach-public-testimonials" id="testimonials">
                            <div class="coach-public-section-head"><h2>What Clients Say</h2><span>${testimonials.length} ${testimonials.length === 1 ? "review" : "reviews"}</span></div>
                            <div class="coach-testimonial-grid">${testimonials.map((item) => {
                                const quote = String(item.quote || "");
                                const isLong = quote.length > 180;
                                return `<article class="coach-review-card">
                                    <div class="coach-review-card-head"><img src="${escapeHtml(displayUrl(item.client_image_url || DEFAULT_PROFILE_IMAGE))}" alt="${escapeHtml(item.client_name)}"><div><strong>${escapeHtml(item.client_name)}</strong><small>${escapeHtml(item.client_title || "Verified client")}</small></div><i data-lucide="badge-check" aria-label="Verified review"></i></div>
                                    <p class="coach-review-copy${isLong ? " is-collapsible" : ""}">${escapeHtml(quote)}</p>
                                    ${isLong ? '<button type="button" class="coach-review-more" data-review-more aria-expanded="false">View more</button>' : ""}
                                </article>`;
                            }).join("")}</div>
                        </section>` : ""}

                        ${firstTransformation ? `<section class="coach-public-section coach-public-transformations" id="transformations">
                            <div class="coach-public-section-head"><h2>Transformations</h2><span>${transformations.length} ${transformations.length === 1 ? "Result" : "Results"}</span></div>
                            <div class="coach-transformation-carousel">${transformations.map((item) => `
                                <article class="coach-transformation-card">
                                    <div class="coach-before-after">
                                        <img src="${escapeHtml(displayUrl(item.before_image_url || DEFAULT_BEFORE_IMAGE))}" alt="${escapeHtml(item.client_name ? `${item.client_name} before` : "Before transformation")}">
                                        <img src="${escapeHtml(displayUrl(item.after_image_url || DEFAULT_AFTER_IMAGE))}" alt="${escapeHtml(item.client_name ? `${item.client_name} after` : "After transformation")}">
                                        <span class="coach-transformation-label is-before">Before</span><b class="coach-transformation-label is-after">After</b>
                                        <div class="coach-before-after-handle" aria-hidden="true"><i data-lucide="chevrons-left-right"></i></div>
                                    </div>
                                    <div class="coach-transformation-content">
                                        ${item.client_name ? `<div class="coach-transformation-client"><strong>${escapeHtml(item.client_name)}</strong><i class="coach-verified-icon" data-lucide="badge-check" aria-label="Verified client"></i></div>` : ""}
                                        <h3>${escapeHtml(item.title || "Client transformation")}</h3>
                                        ${item.result_metric ? `<strong>${escapeHtml(item.result_metric)}</strong>` : ""}
                                        ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
                                    </div>
                                </article>`).join("")}
                            </div>
                        </section>` : ""}
                    </div>

                    <aside class="coach-public-side">
                        <section class="coach-public-plan-card"><h2>Coaching Plans</h2>${plansMarkup}</section>
                    </aside>
                </div>
                <aside class="coach-floating-cta" aria-label="Start a coaching plan">
                    <span><strong>Plans from ${money(Math.min(...plansPreview.map((plan) => Number(plan.price_amount || 0)).filter((price) => price > 0)), plansPreview[0]?.currency || "EUR")}</strong><small>Start your transformation today</small></span>
                    <button type="button" class="js-coach-consultation-open"><i data-lucide="calendar-days"></i><span>Book Consultation</span><i data-lucide="arrow-right"></i></button>
                </aside>
                <div class="coach-consultation-modal" id="coachConsultationModal" hidden aria-hidden="true">
                    <button type="button" class="coach-consultation-backdrop" data-consultation-close aria-label="Close consultation form"></button>
                    <section class="coach-consultation-dialog" role="dialog" aria-modal="true" aria-labelledby="coachConsultationTitle">
                        <button type="button" class="coach-consultation-drag-handle" id="coachConsultationDragHandle" aria-label="Drag down to close"><span></span></button>
                        <header><div><span><i data-lucide="messages-square"></i></span><div><h2 id="coachConsultationTitle">Book a Consultation</h2></div></div><button type="button" data-consultation-close aria-label="Close"><i data-lucide="x"></i></button></header>
                        <form id="coachConsultationForm" novalidate>
                            <div class="coach-consultation-fields">
                                <label class="is-full"><span>Full name <sup class="coach-required" aria-hidden="true">*</sup></span><div><input name="full_name" type="text" autocomplete="name" maxlength="120" placeholder="Your full name" required></div></label>
                                <label class="is-full"><span>Email <sup class="coach-required" aria-hidden="true">*</sup></span><div><input name="email" type="email" autocomplete="email" maxlength="320" placeholder="you@example.com" required></div></label>
                                <fieldset class="is-full coach-contact-preference"><legend>How would you prefer to be contacted? <sup class="coach-required" aria-hidden="true">*</sup></legend><div class="coach-contact-method-options"><label><input type="radio" name="contact_method" value="whatsapp" checked><span>${coachContactIcon("whatsapp")}<b>WhatsApp</b></span></label><label><input type="radio" name="contact_method" value="email"><span><i data-lucide="mail"></i><b>Email</b></span></label><label><input type="radio" name="contact_method" value="either"><span><i data-lucide="messages-square"></i><b>Either is fine</b></span></label></div></fieldset>
                                <label class="is-full coach-whatsapp-field" data-whatsapp-field><span>WhatsApp number <sup class="coach-required" aria-hidden="true">*</sup></span><div class="coach-consultation-phone"><select name="phone_code" aria-label="WhatsApp country code"><option>+49</option><option>+91</option><option>+44</option><option>+1</option><option>+61</option></select><input name="whatsapp_number" type="tel" inputmode="tel" autocomplete="tel" placeholder="WhatsApp number" required></div></label>
                                <label class="is-full"><span>What would you like help with? <sup class="coach-required" aria-hidden="true">*</sup></span><div><select name="help_topic" required><option>Fat Loss</option><option>Muscle Gain</option><option>Nutrition</option><option>Fitness Training</option><option>Lifestyle &amp; Habits</option><option>Other</option></select></div></label>
                                <label class="is-full"><span>Anything you’d like me to know? <small>Optional</small></span><div class="is-textarea"><textarea name="notes" rows="2" maxlength="1000" placeholder="Share any useful context"></textarea></div></label>
                            </div>
                            <button type="submit" class="coach-consultation-submit"><span>Request Free Consultation</span><i data-lucide="arrow-right"></i></button>
                            <p class="coach-consultation-assurance"><i data-lucide="lock"></i>Your details are shared only with your coach.</p>
                        </form>
                        <div class="coach-consultation-success" id="coachConsultationSuccess" hidden><span><i data-lucide="check"></i></span><h3>Request received</h3><p>Your details have been shared securely with ${escapeHtml(coachFirstName)}. You’ll be contacted soon.</p><button type="button" data-consultation-close>Done</button></div>
                    </section>
                </div>
                ${floatingContactContent ? `
                    <button type="button" class="coach-floating-contact-btn" id="coachFloatingContactBtn" aria-label="Contact coach" aria-haspopup="dialog" aria-expanded="false" aria-controls="coachContactMenu">
                        <span class="coach-floating-contact-icon is-message"><i data-lucide="message-square-dot"></i></span>
                        <span class="coach-floating-contact-icon is-close"><i data-lucide="x"></i></span>
                    </button>
                    <div class="coach-contact-menu-backdrop" id="coachContactMenuBackdrop" hidden></div>
                    <section class="coach-contact-menu" id="coachContactMenu" role="dialog" aria-modal="false" aria-labelledby="coachContactMenuTitle" aria-hidden="true" tabindex="-1">
                        <header>
                            <div>
                                <h2 id="coachContactMenuTitle">Contact Coach</h2>
                                <p>Choose how you’d like to connect</p>
                            </div>
                            <button type="button" class="coach-contact-menu-close" id="coachContactMenuClose" aria-label="Close contact menu"><i data-lucide="x"></i></button>
                        </header>
                        <div class="coach-contact-menu-actions">
                            ${floatingContactContent}
                        </div>
                    </section>
                ` : ""}
            </div>
        `;
        document.body.classList.remove("coach-public-loading");
        window.requestAnimationFrame(() => root.classList.add("is-ready"));
        refreshIcons();
        window.requestAnimationFrame(() => initializePlanCarousels());
        initializeFloatingCtaVisibility();
        scheduleTestimonialAutoAdvance();
    }

    function updateFloatingCtaVisibility() {
        floatingCtaVisibilityTicking = false;
        const cta = document.querySelector(".coach-floating-cta");
        const panel = document.querySelector(".coach-conversion-panel");
        if (!cta || !panel) return;

        const panelBounds = panel.getBoundingClientRect();
        const panelTopHalfHasPassed = panelBounds.top + (panelBounds.height / 2) <= 0;
        cta.classList.toggle("is-visible", panelTopHalfHasPassed);
        document.body.classList.toggle("coach-floating-cta-visible", panelTopHalfHasPassed);
    }

    function requestFloatingCtaVisibilityUpdate() {
        if (floatingCtaVisibilityTicking) return;
        floatingCtaVisibilityTicking = true;
        window.requestAnimationFrame(updateFloatingCtaVisibility);
    }

    function initializeFloatingCtaVisibility() {
        updateFloatingCtaVisibility();
        if (floatingCtaVisibilityBound) return;
        floatingCtaVisibilityBound = true;
        window.addEventListener("scroll", requestFloatingCtaVisibilityUpdate, { passive: true });
        window.addEventListener("resize", requestFloatingCtaVisibilityUpdate, { passive: true });
    }

    function updatePlanCarouselControls(carousel) {
        const grid = carousel?.querySelector(".coach-plan-preview-grid");
        const previous = carousel?.querySelector('[data-plan-scroll="-1"]');
        const next = carousel?.querySelector('[data-plan-scroll="1"]');
        if (!grid || !previous || !next) return;
        const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
        previous.hidden = maxScroll < 2 || grid.scrollLeft <= 14;
        next.hidden = maxScroll < 2 || grid.scrollLeft >= maxScroll - 2;
    }

    function initializePlanCarousels() {
        document.querySelectorAll(".coach-plan-carousel").forEach((carousel) => {
            const grid = carousel.querySelector(".coach-plan-preview-grid");
            if (!grid) return;
            if (grid.dataset.carouselReady !== "true") {
                grid.dataset.carouselReady = "true";
                grid.addEventListener("scroll", () => updatePlanCarouselControls(carousel), { passive: true });
                if (window.ResizeObserver) {
                    const observer = new ResizeObserver(() => updatePlanCarouselControls(carousel));
                    observer.observe(grid);
                    Array.from(grid.children).forEach((card) => observer.observe(card));
                }
            }
            updatePlanCarouselControls(carousel);
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => updatePlanCarouselControls(carousel)));
        });
    }

    function setConsultationModal(open) {
        const modal = el("coachConsultationModal");
        const form = el("coachConsultationForm");
        const success = el("coachConsultationSuccess");
        if (!modal) return;
        modal.hidden = !open;
        modal.setAttribute("aria-hidden", open ? "false" : "true");
        modal.classList.toggle("is-open", open);
        document.body.classList.toggle("coach-consultation-open", open);
        if (open) {
            clearConsultationValidation(form);
            modal.classList.remove("is-success");
            const dialog = modal.querySelector(".coach-consultation-dialog");
            if (dialog) {
                dialog.style.transform = "";
                dialog.style.transition = "";
            }
            if (form) form.hidden = false;
            if (success) success.hidden = true;
            const submitButton = form?.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.classList.remove("is-loading");
                const label = submitButton.querySelector("span");
                if (label) label.textContent = "Request Free Consultation";
            }
            const whatsappField = form?.querySelector("[data-whatsapp-field]");
            if (whatsappField) whatsappField.hidden = false;
            const whatsappInput = whatsappField?.querySelector('input[name="whatsapp_number"]');
            if (whatsappInput) whatsappInput.required = true;
            window.setTimeout(() => modal.querySelector("input")?.focus(), 60);
        }
    }

    function clearConsultationValidation(form) {
        if (!form) return;
        form.querySelectorAll("[aria-invalid]").forEach((control) => control.removeAttribute("aria-invalid"));
        form.querySelectorAll(".has-error").forEach((field) => field.classList.remove("has-error"));
        form.querySelectorAll(".coach-field-error").forEach((message) => message.remove());
    }

    function consultationErrorMessage(control) {
        if (control.name === "full_name") return "Enter your full name.";
        if (control.name === "email") return control.validity.typeMismatch ? "Enter a valid email address." : "Enter your email address.";
        if (control.name === "whatsapp_number") return "Enter your WhatsApp number.";
        if (control.name === "help_topic") return "Choose what you would like help with.";
        return "Complete this field.";
    }

    function validateConsultationForm(form) {
        clearConsultationValidation(form);
        const invalidControls = Array.from(form.querySelectorAll("input[required], select[required], textarea[required]"))
            .filter((control) => !control.disabled && !control.closest("[hidden]") && (!String(control.value || "").trim() || !control.checkValidity()));
        invalidControls.forEach((control) => {
            const field = control.closest("label, fieldset");
            control.setAttribute("aria-invalid", "true");
            field?.classList.add("has-error");
            if (field && !field.querySelector(".coach-field-error")) {
                const message = document.createElement("small");
                message.className = "coach-field-error";
                message.textContent = consultationErrorMessage(control);
                field.appendChild(message);
            }
        });
        invalidControls[0]?.focus();
        return invalidControls.length === 0;
    }

    function renderPublicPlansPage() {
        const p = state.coachProfile;
        const title = el("coachPlansTitle");
        if (title) title.textContent = p ? `${p.brand_name || p.display_name} Plans` : "Coaching Plans";
        const backLink = el("coachPlansBackLink");
        if (backLink) backLink.href = profileLink("coach_public_profile.html");
        renderPlanCards(el("coachPlansPublicList"), state.plans, false);
    }

    function setContactMenu(open) {
        const button = el("coachFloatingContactBtn");
        const menu = el("coachContactMenu");
        const backdrop = el("coachContactMenuBackdrop");
        if (!button || !menu || !backdrop) return;
        button.setAttribute("aria-expanded", open ? "true" : "false");
        menu.classList.toggle("is-open", open);
        menu.setAttribute("aria-hidden", open ? "false" : "true");
        backdrop.hidden = !open;
        backdrop.classList.toggle("is-open", open);
        document.body.classList.toggle("coach-contact-menu-open", open);
        if (open) {
            window.setTimeout(() => {
                menu.querySelector("a, button")?.focus?.();
            }, 40);
        } else {
            button.focus?.();
        }
    }

    function bindPlanToggles() {
        let consultationDragStartY = null;
        let consultationDragDistance = 0;
        document.addEventListener("click", (event) => {
            const consultationOpen = event.target.closest(".js-coach-consultation-open");
            const consultationClose = event.target.closest("[data-consultation-close]");
            const planScroll = event.target.closest("[data-plan-scroll]");
            if (consultationOpen) {
                setConsultationModal(true);
                return;
            }
            if (consultationClose) {
                setConsultationModal(false);
                return;
            }
            if (planScroll) {
                const carousel = planScroll.closest(".coach-plan-carousel");
                const grid = carousel?.querySelector(".coach-plan-preview-grid");
                const card = grid?.querySelector(".coach-plan-preview-card");
                if (grid && card) {
                    const direction = Number(planScroll.dataset.planScroll || 1);
                    grid.scrollBy({ left: direction * (card.getBoundingClientRect().width + 10), behavior: "smooth" });
                    window.setTimeout(() => updatePlanCarouselControls(carousel), 360);
                }
                return;
            }
            const contactButton = event.target.closest("#coachFloatingContactBtn");
            const contactClose = event.target.closest("#coachContactMenuClose, #coachContactMenuBackdrop");
            const contactAction = event.target.closest("#coachContactMenu a");
            if (contactButton) {
                setContactMenu(!el("coachContactMenu")?.classList.contains("is-open"));
                return;
            }
            if (contactClose || contactAction) {
                setContactMenu(false);
                if (contactClose) return;
            }
            const reviewMore = event.target.closest("[data-review-more]");
            if (reviewMore) {
                const card = reviewMore.closest(".coach-review-card");
                const expanded = card?.classList.toggle("is-expanded") || false;
                reviewMore.setAttribute("aria-expanded", String(expanded));
                reviewMore.textContent = expanded ? "View less" : "View more";
                return;
            }
            const testimonialNav = event.target.closest("[data-testimonial-nav]");
            const testimonialDot = event.target.closest("[data-testimonial-dot]");
            if (testimonialNav && state.testimonials.length > 1) {
                const delta = Number(testimonialNav.dataset.testimonialNav || 0);
                state.publicTestimonialIndex = (state.publicTestimonialIndex + delta + state.testimonials.length) % state.testimonials.length;
                renderPublicProfile();
                return;
            }
            if (testimonialDot) {
                state.publicTestimonialIndex = Number(testimonialDot.dataset.testimonialDot || 0);
                renderPublicProfile();
                return;
            }
            const toggle = event.target.closest("[data-plan-toggle]");
            if (!toggle) return;
            toggle.closest(".coach-plan-card")?.classList.toggle("is-open");
        });
        document.addEventListener("pointerdown", (event) => {
            const handle = event.target.closest("#coachConsultationDragHandle");
            if (!handle || !window.matchMedia("(max-width: 1024px)").matches) return;
            consultationDragStartY = event.clientY;
            consultationDragDistance = 0;
            handle.setPointerCapture?.(event.pointerId);
            const dialog = handle.closest(".coach-consultation-dialog");
            if (dialog) dialog.style.transition = "none";
        });
        document.addEventListener("pointermove", (event) => {
            if (consultationDragStartY === null) return;
            consultationDragDistance = Math.max(0, event.clientY - consultationDragStartY);
            const dialog = el("coachConsultationModal")?.querySelector(".coach-consultation-dialog");
            if (dialog) dialog.style.transform = `translateY(${consultationDragDistance}px)`;
        });
        document.addEventListener("pointerup", () => {
            if (consultationDragStartY === null) return;
            const dialog = el("coachConsultationModal")?.querySelector(".coach-consultation-dialog");
            if (consultationDragDistance > 80) {
                setConsultationModal(false);
            } else if (dialog) {
                dialog.style.transition = "transform 180ms ease";
                dialog.style.transform = "translateY(0)";
            }
            consultationDragStartY = null;
            consultationDragDistance = 0;
        });
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && el("coachConsultationModal")?.classList.contains("is-open")) {
                setConsultationModal(false);
                return;
            }
            if (event.key === "Escape" && el("coachContactMenu")?.classList.contains("is-open")) {
                setContactMenu(false);
            }
        });
        document.addEventListener("submit", async (event) => {
            if (event.target.id !== "coachConsultationForm") return;
            event.preventDefault();
            const form = event.target;
            const submitButton = form.querySelector('button[type="submit"]');
            if (!state.coachProfile?.id || submitButton?.disabled) return;
            if (!validateConsultationForm(form)) return;
            const fields = new FormData(form);
            const contactMethod = String(fields.get("contact_method") || "whatsapp");
            const payload = {
                coach_profile_id: state.coachProfile.id,
                full_name: String(fields.get("full_name") || "").trim(),
                email: String(fields.get("email") || "").trim(),
                contact_method: contactMethod,
                phone_country_code: contactMethod === "email" ? null : String(fields.get("phone_code") || "").trim(),
                whatsapp_number: contactMethod === "email" ? null : String(fields.get("whatsapp_number") || "").trim(),
                help_topic: String(fields.get("help_topic") || "").trim(),
                notes: String(fields.get("notes") || "").trim() || null
            };
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.classList.add("is-loading");
                submitButton.querySelector("span").textContent = "Sending request…";
            }
            try {
                const { error } = await window.supabaseClient.from("coach_consultation_requests").insert(payload);
                if (error) throw error;
                form.hidden = true;
                const success = el("coachConsultationSuccess");
                if (success) success.hidden = false;
                el("coachConsultationModal")?.classList.add("is-success");
                form.reset();
                refreshIcons();
            } catch (error) {
                setStatus(error.message || "We couldn’t send your request. Please try again.", "error");
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.classList.remove("is-loading");
                    submitButton.querySelector("span").textContent = "Request Free Consultation";
                }
            }
        });
        document.addEventListener("change", (event) => {
            if (event.target.name !== "contact_method") return;
            const whatsappField = document.querySelector("[data-whatsapp-field]");
            const showWhatsApp = event.target.value !== "email";
            if (whatsappField) whatsappField.hidden = !showWhatsApp;
            const numberInput = whatsappField?.querySelector('input[name="whatsapp_number"]');
            if (numberInput) numberInput.required = showWhatsApp;
        });
        document.addEventListener("input", (event) => {
            const form = event.target.closest?.("#coachConsultationForm");
            if (!form || !event.target.matches("input, select, textarea")) return;
            const field = event.target.closest("label, fieldset");
            event.target.removeAttribute("aria-invalid");
            field?.classList.remove("has-error");
            field?.querySelector(".coach-field-error")?.remove();
        });
        window.addEventListener("resize", initializePlanCarousels);
    }

    function openTextareaEditor(textarea) {
        if (!textarea || !window.matchMedia("(max-width: 991px)").matches) return;
        let modal = el("coachTextareaModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "coachTextareaModal";
            modal.className = "coach-textarea-modal";
            modal.hidden = true;
            modal.innerHTML = `
                <div class="coach-textarea-modal__backdrop" data-textarea-close></div>
                <section class="coach-textarea-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="coachTextareaModalTitle">
                    <div class="coach-textarea-modal__handle" aria-hidden="true"></div>
                    <header><h3 id="coachTextareaModalTitle">Edit Text</h3><button type="button" data-textarea-close aria-label="Done"><i data-lucide="check"></i></button></header>
                    <textarea id="coachTextareaModalInput"></textarea>
                </section>
            `;
            document.body.appendChild(modal);
            modal.addEventListener("click", (event) => {
                if (event.target.closest("[data-textarea-close]")) closeTextareaEditor();
            });
        }
        const input = el("coachTextareaModalInput");
        const title = el("coachTextareaModalTitle");
        if (!input) return;
        if (title) title.textContent = textarea.closest(".coach-field")?.querySelector("label")?.textContent?.trim() || "Edit Text";
        input.value = textarea.value || "";
        input.oninput = () => {
            textarea.value = input.value;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
        };
        modal.hidden = false;
        document.body.classList.add("coach-textarea-modal-open");
        requestAnimationFrame(() => modal.classList.add("is-open"));
        refreshIcons();
        setTimeout(() => input.focus(), 80);
    }

    function closeTextareaEditor() {
        const modal = el("coachTextareaModal");
        if (!modal) return;
        modal.classList.remove("is-open");
        document.body.classList.remove("coach-textarea-modal-open");
        setTimeout(() => {
            if (!modal.classList.contains("is-open")) modal.hidden = true;
        }, 180);
    }

    function bindEditor() {
        initCoachMarketingTabs();
        enhanceCoachFields();
        const imageInput = el("coachProfileImageFile");
        const imagePreview = el("coachProfilePreview");
        bindImageEditorInput("coachProfileImageFile", 1, async (file) => {
            if (!imagePreview) return;
            const previewUrl = URL.createObjectURL(file);
            imagePreview.src = previewUrl;
            try {
                await saveStudioProfileImage(file);
                imagePreview.src = displayUrl(state.coachProfile?.profile_image_url);
                if (imageInput) imageInput.value = "";
                editedImageFiles.delete("coachProfileImageFile");
                updateCoachTabStatuses();
            } catch (error) {
                imagePreview.src = displayUrl(state.coachProfile?.profile_image_url);
                setStatus(error.message || "Could not update profile image.", "error");
            } finally {
                URL.revokeObjectURL(previewUrl);
            }
        });
        bindImageEditorInput("testimonialAvatarFile", 1);
        bindImageEditorInput("transformationBeforeFile", 4 / 5);
        bindImageEditorInput("transformationAfterFile", 4 / 5);
        document.querySelectorAll(".coach-field input, .coach-field select, .coach-field textarea").forEach((control) => {
            control.addEventListener("input", updateCoachTabStatuses);
            control.addEventListener("change", updateCoachTabStatuses);
        });
        document.querySelectorAll(".coach-field textarea").forEach((textarea) => {
            textarea.addEventListener("click", () => openTextareaEditor(textarea));
        });
        el("saveCoachProfileBtn")?.addEventListener("click", async () => {
            try { await saveProfileBasics({ publish: true }); } catch (error) { setStatus(error.message || "Save failed.", "error"); }
        });
        el("addPlanBtn")?.addEventListener("click", () => openPlanForm());
        el("cancelPlanBtn")?.addEventListener("click", closePlanForm);
        el("savePlanBtn")?.addEventListener("click", async () => {
            try { await savePlan(); } catch (error) { setStatus(error.message || "Plan save failed.", "error"); }
        });
        el("addTestimonialBtn")?.addEventListener("click", () => openTestimonialForm());
        el("cancelTestimonialBtn")?.addEventListener("click", closeTestimonialForm);
        el("saveTestimonialBtn")?.addEventListener("click", async () => {
            try { await saveTestimonial(); } catch (error) { setStatus(error.message || "Testimonial save failed.", "error"); }
        });
        el("saveTransformationBtn")?.addEventListener("click", async () => {
            try { await saveTransformation(); } catch (error) { setStatus(error.message || "Transformation save failed.", "error"); }
        });
        document.addEventListener("click", async (event) => {
            const editPlan = event.target.closest("[data-edit-plan]");
            const editTestimonial = event.target.closest("[data-edit-testimonial]");
            const plan = event.target.closest("[data-delete-plan]");
            const testimonial = event.target.closest("[data-delete-testimonial]");
            const transformation = event.target.closest("[data-delete-transformation]");
            if (editPlan) {
                const item = state.plans.find((row) => row.id === editPlan.dataset.editPlan);
                if (item) openPlanForm(item);
                return;
            }
            if (editTestimonial) {
                const item = state.testimonials.find((row) => row.id === editTestimonial.dataset.editTestimonial);
                if (item) openTestimonialForm(item);
                return;
            }
            try {
                if (plan) await deleteById("coach_coaching_plans", plan.dataset.deletePlan);
                if (testimonial) await deleteById("coach_testimonials", testimonial.dataset.deleteTestimonial);
                if (transformation) await deleteById("coach_transformations", transformation.dataset.deleteTransformation);
            } catch (error) {
                setStatus(error.message || "Delete failed.", "error");
            }
        });
        document.querySelectorAll("[data-preview-coach], #previewCoachPageBtn").forEach((button) => {
            button.addEventListener("click", async () => {
                try { await previewCoachPage(); } catch (error) { setStatus(error.message || "Could not preview page.", "error"); }
            });
        });
    }

    function bindStudio() {
        initStudioTabs();
        const avatarButton = el("coachStudioAvatarBtn");
        const avatarInput = el("coachStudioAvatarFile");
        const avatar = el("coachStudioAvatar");
        avatarButton?.addEventListener("click", () => avatarInput?.click());
        avatarInput?.addEventListener("change", async () => {
            const file = avatarInput.files?.[0];
            if (!file) return;
            if (avatar) avatar.src = URL.createObjectURL(file);
            try {
                await saveStudioProfileImage(file);
            } catch (error) {
                setStatus(error.message || "Could not update profile image.", "error");
                renderStudio();
            }
        });
    }

    async function initProtected() {
        const auth = await requireCoach();
        if (!auth) return;
        await ensureCoachProfile();
        await loadCoachChildren(state.coachProfile.id);
        if (page() === "coach-studio") {
            renderStudio();
            bindStudio();
        }
        if (page() === "coach-marketing-edit") {
            fillEditor();
            bindEditor();
        }
        refreshIcons();
    }

    async function initPublic() {
        try {
            const publicProfile = await loadPublicCoachProfile();
            if (!publicProfile) throw new Error("This coach page is not published yet.");

            // Paint the complete page structure as soon as the primary profile row arrives.
            if (page() === "coach-public-profile") renderPublicProfile();
            if (page() === "coach-plans") renderPublicPlansPage();
            bindPlanToggles();

            // Secondary profile collections load afterward and progressively enhance the page.
            try {
                await loadCoachChildren(publicProfile.id, true);
                if (page() === "coach-public-profile") renderPublicProfile();
                if (page() === "coach-plans") renderPublicPlansPage();
            } catch (secondaryError) {
                console.warn("Coach profile extras could not be loaded:", secondaryError);
            }
        } catch (error) {
            document.body.classList.remove("coach-public-loading");
            const root = el("coachPublicRoot");
            if (root) {
                root.setAttribute("aria-busy", "false");
                root.innerHTML = `<section class="coach-load-error"><span><i data-lucide="circle-alert"></i></span><h2>We couldn’t load this coach profile</h2><p>${escapeHtml(error.message || "Please check your connection and try again.")}</p><button type="button" onclick="window.location.reload()">Try again</button></section>`;
                refreshIcons();
            }
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        refreshIcons();
        document.querySelectorAll("#coachShareBtn, #coachShareDesktopBtn, #coachShareProfileBtn").forEach((shareButton) => shareButton.addEventListener("click", async () => {
            try {
                if (navigator.share) await navigator.share({ title: document.title, url: window.location.href });
                else await navigator.clipboard?.writeText?.(window.location.href);
            } catch {}
        }));
        if (page() === "coach-studio" || page() === "coach-marketing-edit") {
            await initProtected();
            return;
        }
        if (page() === "coach-public-profile" || page() === "coach-plans") {
            await initPublic();
        }
    });
})();
