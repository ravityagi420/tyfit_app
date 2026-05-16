(function () {
    "use strict";

    const PROFILE_PICTURE_BUCKET = "profile-pictures";
    const REQUIRED_PROFILE_FIELDS = [
        "first_name",
        "last_name",
        "email",
        "phone_country_code",
        "phone_number",
        "country",
        "date_of_birth"
    ];
    const REQUIRED_ABOUT_FIELDS = [
        "weight",
        "height",
        "goal",
        "activity_level",
        "gender"
    ];

    function inPortalPath() {
        return window.location.pathname.includes("/portal/");
    }

    function withBasePath(relativePath) {
        if (!relativePath) {
            return "";
        }
        return inPortalPath() ? `../${relativePath}` : relativePath;
    }

    function hasValue(value) {
        if (value === null || value === undefined) {
            return false;
        }
        if (typeof value === "number") {
            return Number.isFinite(value);
        }
        return String(value).trim() !== "";
    }

    function normalizeAboutRow(data) {
        return {
            user_id: data?.user_id || "",
            weight: data?.weight ?? null,
            height: data?.height ?? null,
            goal: data?.goal || "",
            activity_level: data?.activity_level || "",
            gender: data?.gender || "",
            avatar_key: data?.avatar_key || ""
        };
    }

    function sanitizePhoneNumber(value) {
        const digits = String(value || "").replace(/\D/g, "");
        return digits || null;
    }

    function sanitizeCountryCode(value) {
        const digits = String(value || "").replace(/\D/g, "");
        return digits ? `+${digits}` : null;
    }

    function getAvatarList() {
        return [
            { key: "avatar-1.svg", label: "Avatar 1", src: withBasePath("assets/avatars/avatar-1.svg") },
            { key: "avatar-2.svg", label: "Avatar 2", src: withBasePath("assets/avatars/avatar-2.svg") },
            { key: "avatar-3.svg", label: "Avatar 3", src: withBasePath("assets/avatars/avatar-3.svg") },
            { key: "avatar-4.svg", label: "Avatar 4", src: withBasePath("assets/avatars/avatar-4.svg") },
            { key: "avatar-5.svg", label: "Avatar 5", src: withBasePath("assets/avatars/avatar-5.svg") },
            { key: "avatar-6.svg", label: "Avatar 6", src: withBasePath("assets/avatars/avatar-6.svg") }
        ];
    }

    function getRandomAvatar() {
        const avatars = getAvatarList();
        const index = Math.floor(Math.random() * avatars.length);
        return avatars[index];
    }

    function getStoragePublicUrl(path) {
        if (!path) {
            return "";
        }
        const { data } = window.supabaseClient.storage.from(PROFILE_PICTURE_BUCKET).getPublicUrl(path);
        return data?.publicUrl || "";
    }

    function resolveAvatarByKey(avatarKey) {
        if (!avatarKey) {
            return "";
        }
        const match = getAvatarList().find((item) => item.key === avatarKey);
        return match ? match.src : "";
    }

    function resolveProfileImage(profileOrAbout, userAboutArg) {
        const merged = {
            ...(profileOrAbout || {}),
            ...(userAboutArg || {})
        };
        const about = normalizeAboutRow(merged);

        if (hasValue(merged.profile_picture_url)) {
            const value = String(merged.profile_picture_url);
            if (/^https?:\/\//i.test(value)) {
                return value;
            }
            return getStoragePublicUrl(value);
        }

        if (hasValue(merged.profile_picture_path)) {
            return getStoragePublicUrl(merged.profile_picture_path);
        }

        if (hasValue(about.avatar_key)) {
            return resolveAvatarByKey(about.avatar_key);
        }
        return getAvatarList()[0]?.src || "";
    }

    async function getCurrentUser() {
        if (typeof window.requireLoginWithModal === "function") {
            return window.requireLoginWithModal();
        }

        for (let i = 0; i < 8; i += 1) {
            const {
                data: { session },
                error
            } = await window.supabaseClient.auth.getSession();

            if (error) {
                throw error;
            }

            if (session?.user) {
                return session.user;
            }

            await new Promise((resolve) => setTimeout(resolve, 150));
        }

        return null;
    }

    async function fetchProfile(userId) {
        const { data, error } = await window.supabaseClient
            .from("profiles")
            .select("id, first_name, last_name, full_name, email, phone_country_code, phone_number, country, role, profile_picture_url, date_of_birth")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            console.error("fetchProfile error:", error.message);
            throw new Error("Failed to load profile.");
        }

        return data || null;
    }

    async function fetchUserAbout(userId) {
        let query = window.supabaseClient
            .from("user_about")
            .select("user_id, weight, height, goal, activity_level, gender, avatar_key")
            .eq("user_id", userId)
            .maybeSingle();

        let { data, error } = await query;

        if (error && String(error.message || "").toLowerCase().includes("avatar_key")) {
            const fallback = await window.supabaseClient
                .from("user_about")
                .select("user_id, weight, height, goal, activity_level, gender")
                .eq("user_id", userId)
                .maybeSingle();
            data = fallback.data || null;
            error = fallback.error || null;
        }

        if (error) {
            console.warn("fetchUserAbout warning:", error.message);
            return normalizeAboutRow(null);
        }

        return normalizeAboutRow(data);
    }

    function getDisplayName(profile, user) {
        const fullFromProfile = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
        if (fullFromProfile) {
            return fullFromProfile;
        }
        if (profile?.full_name) {
            return profile.full_name;
        }
        const meta = user?.user_metadata || {};
        return meta.full_name || meta.name || user?.email?.split("@")[0] || "User";
    }

    function calculateProfileCompletion(profile, userAbout) {
        const about = normalizeAboutRow(userAbout);
        const completedProfile = REQUIRED_PROFILE_FIELDS.filter((key) => hasValue(profile?.[key])).length;
        const completedAbout = REQUIRED_ABOUT_FIELDS.filter((key) => hasValue(about?.[key])).length;
        const hasPicture = hasValue(profile?.profile_picture_url) || hasValue(about.avatar_key);

        const totalFields = REQUIRED_PROFILE_FIELDS.length + REQUIRED_ABOUT_FIELDS.length + 1;
        const completed = completedProfile + completedAbout + (hasPicture ? 1 : 0);
        const percent = Math.round((completed / totalFields) * 100);

        return {
            completed,
            totalFields,
            percent
        };
    }

    function isProfileComplete(profile, userAbout) {
        const completion = calculateProfileCompletion(profile, userAbout);
        return completion.completed === completion.totalFields;
    }

    function renderProfileCompletionCard(profile, userAbout, elements) {
        const titleEl = elements?.titleEl;
        const copyEl = elements?.copyEl;
        const buttonEl = elements?.buttonEl;
        const pillEl = elements?.pillEl;
        const completion = calculateProfileCompletion(profile, userAbout);
        const complete = isProfileComplete(profile, userAbout);

        if (titleEl) {
            titleEl.textContent = `Profile ${completion.percent}% completed`;
        }
        if (pillEl) {
            pillEl.textContent = `${completion.percent}%`;
        }
        if (copyEl) {
            if (complete) {
                copyEl.style.display = "none";
                copyEl.textContent = "";
            } else {
                copyEl.style.display = "block";
                copyEl.textContent = "Complete your profile to personalize your plans and calculations.";
            }
        }
        if (buttonEl) {
            buttonEl.textContent = complete ? "Edit Profile" : "Complete Profile";
        }

        return {
            completion,
            complete
        };
    }

    function renderAvatarPicker(containerEl, selectedAvatarKey) {
        if (!containerEl) {
            return;
        }
        const avatars = getAvatarList();
        containerEl.innerHTML = avatars.map((avatar) => `
            <button type="button" class="tyfit-avatar-option${avatar.key === selectedAvatarKey ? " active" : ""}" data-avatar-key="${avatar.key}" aria-label="${avatar.label}">
                <img src="${avatar.src}" alt="${avatar.label}">
            </button>
        `).join("");
    }

    async function uploadProfilePicture(file, userId) {
        if (!file || !userId) {
            throw new Error("Missing file or user.");
        }

        const rawName = String(file.name || "profile.jpg");
        const cleanName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-");
        const filePath = `${userId}/${Date.now()}-${cleanName}`;

        const { error } = await window.supabaseClient
            .storage
            .from(PROFILE_PICTURE_BUCKET)
            .upload(filePath, file, {
                cacheControl: "3600",
                upsert: true,
                contentType: file.type || "image/jpeg"
            });

        if (error) {
            throw new Error(error.message || "Image upload failed.");
        }

        return {
            path: filePath,
            publicUrl: getStoragePublicUrl(filePath)
        };
    }

    async function upsertUserAbout(userId, patch) {
        const payload = {
            user_id: userId,
            ...patch,
            updated_at: new Date().toISOString()
        };

        let { error } = await window.supabaseClient
            .from("user_about")
            .upsert(payload, { onConflict: "user_id" });

        if (error && String(error.message || "").toLowerCase().includes("avatar_key")) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.avatar_key;
            ({ error } = await window.supabaseClient
                .from("user_about")
                .upsert(fallbackPayload, { onConflict: "user_id" }));
        }

        if (error) {
            throw new Error(error.message || "Failed to save profile details.");
        }
    }

    async function saveProfileEdits(payload) {
        const userId = payload?.userId;
        if (!userId) {
            throw new Error("Missing user id.");
        }

        const profilePatch = payload.profilePatch || {};
        const userAboutPatch = payload.userAboutPatch || {};

        const normalizedProfilePatch = {
            ...profilePatch,
            phone_number: sanitizePhoneNumber(profilePatch.phone_number),
            phone_country_code: sanitizeCountryCode(profilePatch.phone_country_code)
        };

        const { error: profileError } = await window.supabaseClient
            .from("profiles")
            .update({
                ...normalizedProfilePatch,
                updated_at: new Date().toISOString()
            })
            .eq("id", userId);

        if (profileError) {
            if (String(profileError.message || "").includes("profiles_phone_number_check")) {
                const { error: fallbackError } = await window.supabaseClient
                    .from("profiles")
                    .update({
                        ...normalizedProfilePatch,
                        phone_number: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", userId);

                if (!fallbackError) {
                    await upsertUserAbout(userId, userAboutPatch);
                    return;
                }
                throw new Error(fallbackError.message || "Failed to save contact details.");
            }
            throw new Error(profileError.message || "Failed to save contact details.");
        }

        await upsertUserAbout(userId, userAboutPatch);
    }

    async function ensureAvatarAssignment(userId, userAboutArg) {
        const userAbout = normalizeAboutRow(userAboutArg);
        if (!userId) {
            return userAbout;
        }

        if (hasValue(userAbout.avatar_key)) {
            return userAbout;
        }

        const randomAvatar = getRandomAvatar();
        const nextAbout = {
            ...userAbout,
            avatar_key: randomAvatar.key
        };

        try {
            await upsertUserAbout(userId, { avatar_key: randomAvatar.key });
        } catch (error) {
            console.warn("Unable to persist random avatar:", error.message || error);
        }

        return nextAbout;
    }

    async function loadProfileEditPage(handler) {
        const user = await getCurrentUser();
        if (!user) {
            return;
        }
        await handler(user);
    }

    window.tyfitProfile = {
        getCurrentUser,
        fetchProfile,
        fetchUserAbout,
        calculateProfileCompletion,
        isProfileComplete,
        renderProfileCompletionCard,
        getAvatarList,
        getRandomAvatar,
        resolveProfileImage,
        renderAvatarPicker,
        uploadProfilePicture,
        saveProfileEdits,
        loadProfileEditPage,
        ensureAvatarAssignment,
        getDisplayName
    };
})();
