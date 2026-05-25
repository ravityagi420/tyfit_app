/* ============================================================
   PROFILE EDIT — redesigned JS
   ============================================================ */

const PROFILE_EDIT_STATE = {
    user: null,
    profile: null,
    userAbout: null,
    mode: "avatar",
    selectedAvatarKey: "",
    uploadedFile: null,
    previewObjectUrl: "",
    unitSystem: "metric",  // "metric" | "imperial"
    photoPickerCloseTimer: null
};

/* ── Country data ──────────────────────────────────────────── */
const COUNTRY_DATA = [
    { name: "Afghanistan", flag: "🇦🇫", dial: "+93" },
    { name: "Albania", flag: "🇦🇱", dial: "+355" },
    { name: "Algeria", flag: "🇩🇿", dial: "+213" },
    { name: "Argentina", flag: "🇦🇷", dial: "+54" },
    { name: "Australia", flag: "🇦🇺", dial: "+61" },
    { name: "Austria", flag: "🇦🇹", dial: "+43" },
    { name: "Bangladesh", flag: "🇧🇩", dial: "+880" },
    { name: "Belgium", flag: "🇧🇪", dial: "+32" },
    { name: "Brazil", flag: "🇧🇷", dial: "+55" },
    { name: "Canada", flag: "🇨🇦", dial: "+1" },
    { name: "Chile", flag: "🇨🇱", dial: "+56" },
    { name: "China", flag: "🇨🇳", dial: "+86" },
    { name: "Colombia", flag: "🇨🇴", dial: "+57" },
    { name: "Czech Republic", flag: "🇨🇿", dial: "+420" },
    { name: "Denmark", flag: "🇩🇰", dial: "+45" },
    { name: "Egypt", flag: "🇪🇬", dial: "+20" },
    { name: "Ethiopia", flag: "🇪🇹", dial: "+251" },
    { name: "Finland", flag: "🇫🇮", dial: "+358" },
    { name: "France", flag: "🇫🇷", dial: "+33" },
    { name: "Germany", flag: "🇩🇪", dial: "+49" },
    { name: "Ghana", flag: "🇬🇭", dial: "+233" },
    { name: "Greece", flag: "🇬🇷", dial: "+30" },
    { name: "Hungary", flag: "🇭🇺", dial: "+36" },
    { name: "India", flag: "🇮🇳", dial: "+91" },
    { name: "Indonesia", flag: "🇮🇩", dial: "+62" },
    { name: "Iran", flag: "🇮🇷", dial: "+98" },
    { name: "Iraq", flag: "🇮🇶", dial: "+964" },
    { name: "Ireland", flag: "🇮🇪", dial: "+353" },
    { name: "Israel", flag: "🇮🇱", dial: "+972" },
    { name: "Italy", flag: "🇮🇹", dial: "+39" },
    { name: "Japan", flag: "🇯🇵", dial: "+81" },
    { name: "Jordan", flag: "🇯🇴", dial: "+962" },
    { name: "Kenya", flag: "🇰🇪", dial: "+254" },
    { name: "Kuwait", flag: "🇰🇼", dial: "+965" },
    { name: "Malaysia", flag: "🇲🇾", dial: "+60" },
    { name: "Mexico", flag: "🇲🇽", dial: "+52" },
    { name: "Morocco", flag: "🇲🇦", dial: "+212" },
    { name: "Netherlands", flag: "🇳🇱", dial: "+31" },
    { name: "New Zealand", flag: "🇳🇿", dial: "+64" },
    { name: "Nigeria", flag: "🇳🇬", dial: "+234" },
    { name: "Norway", flag: "🇳🇴", dial: "+47" },
    { name: "Pakistan", flag: "🇵🇰", dial: "+92" },
    { name: "Peru", flag: "🇵🇪", dial: "+51" },
    { name: "Philippines", flag: "🇵🇭", dial: "+63" },
    { name: "Poland", flag: "🇵🇱", dial: "+48" },
    { name: "Portugal", flag: "🇵🇹", dial: "+351" },
    { name: "Qatar", flag: "🇶🇦", dial: "+974" },
    { name: "Romania", flag: "🇷🇴", dial: "+40" },
    { name: "Russia", flag: "🇷🇺", dial: "+7" },
    { name: "Saudi Arabia", flag: "🇸🇦", dial: "+966" },
    { name: "Singapore", flag: "🇸🇬", dial: "+65" },
    { name: "South Africa", flag: "🇿🇦", dial: "+27" },
    { name: "South Korea", flag: "🇰🇷", dial: "+82" },
    { name: "Spain", flag: "🇪🇸", dial: "+34" },
    { name: "Sri Lanka", flag: "🇱🇰", dial: "+94" },
    { name: "Sweden", flag: "🇸🇪", dial: "+46" },
    { name: "Switzerland", flag: "🇨🇭", dial: "+41" },
    { name: "Taiwan", flag: "🇹🇼", dial: "+886" },
    { name: "Thailand", flag: "🇹🇭", dial: "+66" },
    { name: "Turkey", flag: "🇹🇷", dial: "+90" },
    { name: "Ukraine", flag: "🇺🇦", dial: "+380" },
    { name: "United Arab Emirates", flag: "🇦🇪", dial: "+971" },
    { name: "United Kingdom", flag: "🇬🇧", dial: "+44" },
    { name: "United States", flag: "🇺🇸", dial: "+1" },
    { name: "Venezuela", flag: "🇻🇪", dial: "+58" },
    { name: "Vietnam", flag: "🇻🇳", dial: "+84" }
];

/* ── Helpers ───────────────────────────────────────────────── */
function pe(id) { return document.getElementById(id); }

let _toastTimer = null;
function showProfileStatus(message, type) {
    let toast = document.getElementById("tyfit-floating-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "tyfit-floating-toast";
        toast.className = "tyfit-toast";
        toast.innerHTML = '<span class="tyfit-toast__icon"></span><span class="tyfit-toast__msg"></span>';
        document.body.appendChild(toast);
    }
    clearTimeout(_toastTimer);
    const icon = toast.querySelector(".tyfit-toast__icon");
    const msg = toast.querySelector(".tyfit-toast__msg");
    toast.className = "tyfit-toast" + (type === "error" ? " error" : "");
    icon.innerHTML = type === "error"
        ? '<i class="fas fa-exclamation-circle"></i>'
        : '<i class="fas fa-check-circle"></i>';
    msg.textContent = message;
    // Force reflow so transition fires from hidden state
    toast.getBoundingClientRect();
    toast.classList.add("is-visible");
    const delay = type === "error" ? 4000 : 2600;
    _toastTimer = setTimeout(() => {
        toast.classList.add("is-hiding");
        setTimeout(() => {
            toast.classList.remove("is-visible", "is-hiding");
        }, 380);
    }, delay);
}

function getAvatarSrcByKey(avatarKey) {
    const avatar = window.tyfitProfile.getAvatarList().find((item) => item.key === avatarKey);
    return avatar ? avatar.src : "";
}

function updatePreviewImage() {
    const previewEl = pe("profilePreviewImage");
    if (!previewEl) return;
    if (PROFILE_EDIT_STATE.mode === "upload") {
        if (PROFILE_EDIT_STATE.previewObjectUrl) { previewEl.src = PROFILE_EDIT_STATE.previewObjectUrl; return; }
        const existingUri = PROFILE_EDIT_STATE.profile?.profile_picture_url || "";
        if (existingUri && window.tyfitProfile.isStoragePath(existingUri)) {
            previewEl.src = window.tyfitProfile.resolveProfileImage(
                { ...PROFILE_EDIT_STATE.profile, avatar_key: "" },
                PROFILE_EDIT_STATE.userAbout
            );
            return;
        }
    }
    previewEl.src = getAvatarSrcByKey(PROFILE_EDIT_STATE.selectedAvatarKey)
        || window.tyfitProfile.resolveProfileImage(PROFILE_EDIT_STATE.profile, PROFILE_EDIT_STATE.userAbout);
}

function updateDisplayName() {
    const nameEl = pe("profileDisplayName");
    if (!nameEl) return;
    const first = (pe("profileFirstName")?.value || "").trim();
    const last = (pe("profileLastName")?.value || "").trim();
    nameEl.textContent = [first, last].filter(Boolean).join(" ") || "Your Name";
}

function formatIsoDateToDisplay(isoDate) {
    const value = String(isoDate || "").trim();
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const [, yyyy, mm, dd] = m;
    return `${dd}/${mm}/${yyyy}`;
}

function parseDisplayDateToIso(displayDate) {
    const raw = String(displayDate || "").trim();
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const date = new Date(yyyy, mm - 1, dd);
    const valid = date.getFullYear() === yyyy && (date.getMonth() + 1) === mm && date.getDate() === dd;
    if (!valid) return null;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function isAtLeastTenYearsOld(isoDate) {
    if (!isoDate) return false;
    const [yyyy, mm, dd] = String(isoDate).split("-").map(Number);
    if (!yyyy || !mm || !dd) return false;

    const dob = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(dob.getTime())) return false;

    const today = new Date();
    const cutoff = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate());
    return dob <= cutoff;
}

function bindDobInputFormatting() {
    const dobEl = pe("profileDob");
    if (!dobEl) return;

    dobEl.addEventListener("input", () => {
        const digits = dobEl.value.replace(/\D/g, "").slice(0, 8);
        let out = "";
        if (digits.length > 0) out += digits.slice(0, 2);
        if (digits.length >= 3) out += `/${digits.slice(2, 4)}`;
        if (digits.length >= 5) out += `/${digits.slice(4, 8)}`;
        dobEl.value = out;
    });

    dobEl.addEventListener("blur", () => {
        if (!dobEl.value.trim()) return;
        const iso = parseDisplayDateToIso(dobEl.value);
        if (!iso) {
            showProfileStatus("Please enter Date of Birth as DD/MM/YYYY.", "error");
            return;
        }
        if (!isAtLeastTenYearsOld(iso)) {
            showProfileStatus("Birth date must be at least 10 years before today.", "error");
            return;
        }
        dobEl.value = formatIsoDateToDisplay(iso);
    });
}

function initDobCalendar() {
    const dobEl = pe("profileDob");
    if (!dobEl || typeof window.flatpickr !== "function") return;

    const syncCalendarHeader = (instance) => {
        const calendar = instance?.calendarContainer;
        if (!calendar) return;

        const monthSelect = calendar.querySelector(".flatpickr-monthDropdown-months");
        if (monthSelect) {
            monthSelect.classList.add("tyfit-flatpickr-month-select");
        }

        const currentMonthWrap = calendar.querySelector(".flatpickr-current-month");
        const yearInput = currentMonthWrap?.querySelector("input.cur-year");
        if (!currentMonthWrap || !yearInput) return;

        let yearSelect = currentMonthWrap.querySelector(".tyfit-flatpickr-year-select");
        if (!yearSelect) {
            yearSelect = document.createElement("select");
            yearSelect.className = "tyfit-flatpickr-year-select";
            yearSelect.setAttribute("aria-label", "Select year");

            const today = new Date();
            const maxAllowedYear = today.getFullYear() - 10;
            const minYear = 1940;
            for (let y = maxAllowedYear; y >= minYear; y -= 1) {
                const option = document.createElement("option");
                option.value = String(y);
                option.textContent = String(y);
                yearSelect.appendChild(option);
            }

            yearSelect.addEventListener("change", () => {
                const nextYear = Number(yearSelect.value);
                if (!Number.isFinite(nextYear)) return;
                instance.changeYear(nextYear);
                instance.redraw();
            });

            currentMonthWrap.appendChild(yearSelect);
            yearInput.style.display = "none";
        }

        yearSelect.value = String(instance.currentYear);
    };

    window.flatpickr(dobEl, {
        dateFormat: "d/m/Y",
        allowInput: true,
        disableMobile: true,
        maxDate: new Date(new Date().getFullYear() - 10, new Date().getMonth(), new Date().getDate()),
        monthSelectorType: "dropdown",
        onReady: (_selectedDates, _dateStr, instance) => {
            syncCalendarHeader(instance);
        },
        onYearChange: (_selectedDates, _dateStr, instance) => {
            syncCalendarHeader(instance);
        },
        onMonthChange: (_selectedDates, _dateStr, instance) => {
            syncCalendarHeader(instance);
        },
        onClose: () => {
            if (!dobEl.value.trim()) return;
            const iso = parseDisplayDateToIso(dobEl.value);
            if (!iso) {
                showProfileStatus("Please enter Date of Birth as DD/MM/YYYY.", "error");
                return;
            }
            if (!isAtLeastTenYearsOld(iso)) {
                showProfileStatus("Birth date must be at least 10 years before today.", "error");
                return;
            }
            dobEl.value = formatIsoDateToDisplay(iso);
        }
    });
}

/* ── Photo picker (Instagram-style) ───────────────────────── */
function setPhotoPickerMode(mode) {
    PROFILE_EDIT_STATE.mode = mode === "upload" ? "upload" : "avatar";
    const tabUpload = pe("profileTabUpload");
    const tabAvatar = pe("profileTabAvatar");
    const switchWrap = pe("profilePhotoSwitch");
    const uploadPane = pe("profileUploadPane");
    const avatarPane = pe("profileAvatarPane");
    if (tabUpload) { tabUpload.classList.toggle("active", mode === "upload"); tabUpload.setAttribute("aria-selected", String(mode === "upload")); }
    if (tabAvatar) { tabAvatar.classList.toggle("active", mode === "avatar"); tabAvatar.setAttribute("aria-selected", String(mode === "avatar")); }
    if (switchWrap) {
        switchWrap.classList.toggle("is-upload", mode === "upload");
        switchWrap.classList.toggle("is-avatar", mode === "avatar");
    }
    if (uploadPane) uploadPane.classList.toggle("is-active", mode === "upload");
    if (avatarPane) avatarPane.classList.toggle("is-active", mode === "avatar");
    updatePreviewImage();
}

function togglePhotoPicker(forceOpen) {
    const picker = pe("profilePhotoPicker");
    if (!picker) return;
    const isOpen = picker.classList.contains("is-open");
    const open = forceOpen !== undefined ? forceOpen : !isOpen;

    if (PROFILE_EDIT_STATE.photoPickerCloseTimer) {
        clearTimeout(PROFILE_EDIT_STATE.photoPickerCloseTimer);
        PROFILE_EDIT_STATE.photoPickerCloseTimer = null;
    }

    if (open) {
        picker.classList.remove("is-closing");
        requestAnimationFrame(() => picker.classList.add("is-open"));
        picker.setAttribute("aria-hidden", "false");
        return;
    }

    picker.classList.remove("is-open");
    picker.classList.add("is-closing");
    picker.setAttribute("aria-hidden", "true");
    PROFILE_EDIT_STATE.photoPickerCloseTimer = setTimeout(() => {
        picker.classList.remove("is-closing");
    }, 240);
}

function bindAvatarPicker() {
    const avatarGrid = pe("profileAvatarGrid");
    if (!avatarGrid) return;
    avatarGrid.addEventListener("click", (event) => {
        const option = event.target.closest(".tyfit-avatar-option");
        if (!option) return;
        const key = option.getAttribute("data-avatar-key") || "";
        if (!key) return;
        PROFILE_EDIT_STATE.selectedAvatarKey = key;
        window.tyfitProfile.renderAvatarPicker(avatarGrid, PROFILE_EDIT_STATE.selectedAvatarKey);
        setPhotoPickerMode("avatar");
        updatePreviewImage();
        togglePhotoPicker(false);
        autoSaveProfilePicture();
    });
}

/* ── Country code dropdown ─────────────────────────────────── */
let _ccDropdownOpen = false;

function renderCCList(filter) {
    const list = pe("profileCCList");
    if (!list) return;
    const q = (filter || "").toLowerCase();
    const currentDial = pe("profilePhoneCode")?.value || "";
    const filtered = q ? COUNTRY_DATA.filter(c => c.name.toLowerCase().includes(q) || c.dial.includes(q)) : COUNTRY_DATA;
    list.innerHTML = filtered.map(c => `
        <li class="tyfit-cc-item${c.dial === currentDial ? " selected" : ""}" data-dial="${c.dial}" data-name="${c.name}" data-flag="${c.flag}" role="option">
            <span class="tyfit-cc-item-flag">${c.flag}</span>
            <span class="tyfit-cc-item-name">${c.name}</span>
            <span class="tyfit-cc-item-dial">${c.dial}</span>
        </li>
    `).join("");
}

function selectCountryCode(dial, flag) {
    const codeInput = pe("profilePhoneCode");
    const flagEl = pe("profileCCFlag");
    const dialEl = pe("profileCCDial");
    if (codeInput) codeInput.value = dial;
    if (flagEl) flagEl.textContent = flag;
    if (dialEl) dialEl.textContent = dial;
}

function openCCDropdown() {
    const dropdown = pe("profileCountryCodeDropdown");
    const btn = pe("profileCountryCodeBtn");
    if (!dropdown) return;
    dropdown.classList.add("is-open");
    btn?.setAttribute("aria-expanded", "true");
    _ccDropdownOpen = true;
    const searchEl = pe("profileCCSearch");
    if (searchEl) { searchEl.value = ""; renderCCList(""); }
}

function closeCCDropdown() {
    const dropdown = pe("profileCountryCodeDropdown");
    const btn = pe("profileCountryCodeBtn");
    if (!dropdown) return;
    dropdown.classList.remove("is-open");
    btn?.setAttribute("aria-expanded", "false");
    _ccDropdownOpen = false;
}

function bindCCDropdown() {
    const btn = pe("profileCountryCodeBtn");
    const search = pe("profileCCSearch");
    const list = pe("profileCCList");

    if (btn) {
        btn.addEventListener("click", () => _ccDropdownOpen ? closeCCDropdown() : openCCDropdown());
        btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); _ccDropdownOpen ? closeCCDropdown() : openCCDropdown(); } });
    }

    if (search) {
        search.addEventListener("input", () => renderCCList(search.value));
    }

    if (list) {
        list.addEventListener("click", (e) => {
            const item = e.target.closest(".tyfit-cc-item");
            if (!item) return;
            selectCountryCode(item.dataset.dial, item.dataset.flag);
            closeCCDropdown();
        });
    }

    document.addEventListener("click", (e) => {
        if (!_ccDropdownOpen) return;
        const wrap = pe("profileCountryCodeBtn")?.closest(".tyfit-phone-wrap");
        if (wrap && !wrap.contains(e.target)) closeCCDropdown();
    });
}

/* ── Country select population ─────────────────────────────── */
function populateCountrySelect(currentValue) {
    const sel = pe("profileCountry");
    if (!sel) return;
    // Keep first blank option
    const blank = sel.options[0];
    sel.innerHTML = "";
    sel.appendChild(blank);
    COUNTRY_DATA.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.name;
        opt.textContent = `${c.flag}  ${c.name}`;
        sel.appendChild(opt);
    });
    if (currentValue) sel.value = currentValue;
}

/* ── Unit toggle (metric / imperial) ──────────────────────── */
function cmToFtIn(cm) {
    const totalInches = cm / 2.54;
    const ft = Math.floor(totalInches / 12);
    const inch = Math.round(totalInches % 12);
    return { ft, inch };
}

function ftInToCm(ft, inch) {
    return Math.round(((ft * 12) + inch) * 2.54 * 10) / 10;
}

function kgToLbs(kg) { return Math.round(kg * 2.20462 * 10) / 10; }
function lbsToKg(lbs) { return Math.round(lbs / 2.20462 * 10) / 10; }

function normalizeActivityLevelForSelect(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const key = raw.toLowerCase();
    const legacyMap = {
        "sedentary": "Sedentary",
        "light": "Light Exercise",
        "light exercise": "Light Exercise",
        "moderate": "Moderate Exercise",
        "moderate exercise": "Moderate Exercise",
        "active": "Heavy Exercise",
        "heavy": "Heavy Exercise",
        "heavy exercise": "Heavy Exercise",
        "very active": "Athlete",
        "athlete": "Athlete"
    };

    return legacyMap[key] || raw;
}

function setUnitSystem(system) {
    PROFILE_EDIT_STATE.unitSystem = system;

    const metricBtn = pe("unitMetricBtn");
    const imperialBtn = pe("unitImperialBtn");
    const switchWrap = pe("unitSystemSwitch");
    if (metricBtn) metricBtn.classList.toggle("active", system === "metric");
    if (imperialBtn) imperialBtn.classList.toggle("active", system === "imperial");
    if (switchWrap) {
        switchWrap.classList.toggle("is-metric", system === "metric");
        switchWrap.classList.toggle("is-imperial", system === "imperial");
    }

    const heightCm = pe("profileHeight");
    const heightFt = pe("profileHeightFt");
    const heightIn = pe("profileHeightIn");
    const heightLabelM = pe("heightUnitLabel");
    const heightLabelI = pe("heightUnitLabelImperial");
    const weightInput = pe("profileWeight");
    const weightLabel = pe("weightUnitLabel");

    if (system === "imperial") {
        // Convert current cm value to ft/in
        const cmVal = parseFloat(heightCm?.value) || 0;
        if (cmVal > 0) {
            const { ft, inch } = cmToFtIn(cmVal);
            if (heightFt) heightFt.value = ft;
            if (heightIn) heightIn.value = inch;
        }
        if (heightCm) heightCm.style.display = "none";
        if (heightFt) heightFt.style.display = "block";
        if (heightIn) heightIn.style.display = "block";
        if (heightLabelM) heightLabelM.style.display = "none";
        if (heightLabelI) heightLabelI.style.display = "flex";

        // Convert weight
        const kgVal = parseFloat(weightInput?.value) || 0;
        if (kgVal > 0 && weightInput) weightInput.value = kgToLbs(kgVal);
        if (weightLabel) weightLabel.textContent = "lbs";
    } else {
        // Convert ft/in back to cm
        const ftVal = parseFloat(heightFt?.value) || 0;
        const inVal = parseFloat(heightIn?.value) || 0;
        if ((ftVal > 0 || inVal > 0) && heightCm) heightCm.value = ftInToCm(ftVal, inVal);
        if (heightCm) heightCm.style.display = "block";
        if (heightFt) heightFt.style.display = "none";
        if (heightIn) heightIn.style.display = "none";
        if (heightLabelM) heightLabelM.style.display = "flex";
        if (heightLabelI) heightLabelI.style.display = "none";

        // Convert weight lbs → kg
        const lbsVal = parseFloat(weightInput?.value) || 0;
        if (lbsVal > 0 && weightInput) weightInput.value = lbsToKg(lbsVal);
        if (weightLabel) weightLabel.textContent = "kg";
    }
}

function bindUnitToggle() {
    const metricBtn = pe("unitMetricBtn");
    const imperialBtn = pe("unitImperialBtn");
    if (metricBtn) metricBtn.addEventListener("click", () => setUnitSystem("metric"));
    if (imperialBtn) imperialBtn.addEventListener("click", () => setUnitSystem("imperial"));
}

/* ── Form fill ─────────────────────────────────────────────── */
function fillProfileForm(profile, userAbout, user) {
    pe("profileFirstName").value = profile?.first_name || "";
    pe("profileLastName").value = profile?.last_name || "";
    pe("profileEmail").value = profile?.email || user?.email || "";

    const savedDial = profile?.phone_country_code || "+91";
    const savedCountry = COUNTRY_DATA.find(c => c.dial === savedDial);
    selectCountryCode(savedDial, savedCountry?.flag || "🌐");
    pe("profilePhoneNumber").value = profile?.phone_number || "";

    populateCountrySelect(profile?.country || "");

    const dobDisplayValue = formatIsoDateToDisplay(profile?.date_of_birth || "");
    pe("profileDob").value = dobDisplayValue;
    if (pe("profileDob")?._flatpickr) {
        pe("profileDob")._flatpickr.setDate(dobDisplayValue, false, "d/m/Y");
    }
    pe("profileGender").value = userAbout?.gender || "";
    pe("profileHeight").value = userAbout?.height ?? "";
    pe("profileWeight").value = userAbout?.weight ?? "";
    pe("profileGoal").value = userAbout?.goal || "";
    pe("profileActivityLevel").value = normalizeActivityLevelForSelect(userAbout?.activity_level);

    updateDisplayName();
}

/* ── Collect patches ────────────────────────────────────────── */
function collectProfilePatches() {
        const dobDisplayValue = (pe("profileDob")?.value || "").trim();
        const dobIsoValue = dobDisplayValue ? parseDisplayDateToIso(dobDisplayValue) : null;
        if (!dobIsoValue) {
            throw new Error("Please enter Date of Birth in DD/MM/YYYY format.");
        }
        if (!isAtLeastTenYearsOld(dobIsoValue)) {
            throw new Error("Birth date must be at least 10 years before today.");
        }

    // Always save height/weight in metric (cm / kg)
    let heightVal = null;
    let weightVal = null;
    if (PROFILE_EDIT_STATE.unitSystem === "imperial") {
        const ftVal = parseFloat(pe("profileHeightFt")?.value) || 0;
        const inVal = parseFloat(pe("profileHeightIn")?.value) || 0;
        if (ftVal > 0 || inVal > 0) heightVal = ftInToCm(ftVal, inVal);
        const lbsVal = pe("profileWeight")?.value ? parseFloat(pe("profileWeight").value) : null;
        if (lbsVal) weightVal = lbsToKg(lbsVal);
    } else {
        heightVal = pe("profileHeight")?.value ? Number(pe("profileHeight").value) : null;
        weightVal = pe("profileWeight")?.value ? Number(pe("profileWeight").value) : null;
    }

    const profilePatch = {
        first_name: (pe("profileFirstName")?.value || "").trim(),
        last_name: (pe("profileLastName")?.value || "").trim(),
        email: (pe("profileEmail")?.value || "").trim(),
        phone_country_code: (pe("profilePhoneCode")?.value || "").trim(),
        phone_number: (pe("profilePhoneNumber")?.value || "").replace(/\D/g, "").trim(),
        country: (pe("profileCountry")?.value || "").trim(),
        date_of_birth: dobIsoValue,
        full_name: `${(pe("profileFirstName")?.value || "").trim()} ${(pe("profileLastName")?.value || "").trim()}`.trim()
    };

    const userAboutPatch = {
        gender: pe("profileGender")?.value || null,
        height: heightVal,
        weight: weightVal,
        goal: pe("profileGoal")?.value || null,
        activity_level: pe("profileActivityLevel")?.value || null
    };

    return { profilePatch, userAboutPatch };
}

/* ── Dirty-state helpers ───────────────────────────────────── */
let _autoSaveTimer = null;
const AUTO_SAVE_DELAY = 30000; // 30 seconds

function scheduleAutoSave() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => {
        if (PROFILE_EDIT_STATE.dirty) {
            pe("profileEditForm")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
    }, AUTO_SAVE_DELAY);
}

function markFormDirty() {
    PROFILE_EDIT_STATE.dirty = true;
    const bar = document.getElementById("profileSaveBar");
    if (bar) { bar.classList.add("is-dirty"); bar.removeAttribute("aria-hidden"); }
    scheduleAutoSave();
}

function markFormClean() {
    PROFILE_EDIT_STATE.dirty = false;
    clearTimeout(_autoSaveTimer);
    const bar = document.getElementById("profileSaveBar");
    if (bar) { bar.classList.remove("is-dirty"); bar.setAttribute("aria-hidden", "true"); }
}

/* ── Auto-save profile picture ──────────────────────────────── */
async function autoSaveProfilePicture() {
    const previewEl = pe("profilePreviewImage");
    if (previewEl) previewEl.style.opacity = "0.55";
    try {
        let profilePictureUri = PROFILE_EDIT_STATE.profile?.profile_picture_url || "";

        if (PROFILE_EDIT_STATE.mode === "upload" && PROFILE_EDIT_STATE.uploadedFile) {
            const oldUri = PROFILE_EDIT_STATE.profile?.profile_picture_url || "";
            const uploaded = await window.tyfitProfile.uploadProfilePicture(
                PROFILE_EDIT_STATE.uploadedFile,
                PROFILE_EDIT_STATE.user.id,
                oldUri
            );
            profilePictureUri = uploaded.path;
        } else if (PROFILE_EDIT_STATE.mode === "avatar") {
            profilePictureUri = PROFILE_EDIT_STATE.selectedAvatarKey || "avatar-5.svg";
        }

        const profilePatch = {
            profile_picture_url: profilePictureUri || null
        };
        const userAboutPatch = {
            avatar_key: PROFILE_EDIT_STATE.mode === "avatar" ? (PROFILE_EDIT_STATE.selectedAvatarKey || null) : null
        };
        await window.tyfitProfile.saveProfileEdits({
            userId: PROFILE_EDIT_STATE.user.id,
            profilePatch,
            userAboutPatch
        });
        PROFILE_EDIT_STATE.profile = { ...PROFILE_EDIT_STATE.profile, ...profilePatch };
        PROFILE_EDIT_STATE.userAbout = { ...PROFILE_EDIT_STATE.userAbout, ...userAboutPatch };
        PROFILE_EDIT_STATE.uploadedFile = null;
        if (PROFILE_EDIT_STATE.previewObjectUrl) {
            URL.revokeObjectURL(PROFILE_EDIT_STATE.previewObjectUrl);
            PROFILE_EDIT_STATE.previewObjectUrl = "";
        }
        showProfileStatus("Profile picture updated.", "success");
        if (typeof window.refreshAuthUi === "function") await window.refreshAuthUi();
    } catch (error) {
        console.error("autoSaveProfilePicture error:", error);
        showProfileStatus(error.message || "Could not update picture.", "error");
    } finally {
        if (previewEl) previewEl.style.opacity = "";
    }
}

/* ── Save ──────────────────────────────────────────────────── */
async function handleProfileSave(event) {
    event.preventDefault();
    const saveBtn = pe("profileSaveBtn");
    try {
        if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...'; }

        const { profilePatch, userAboutPatch } = collectProfilePatches();

        if (!profilePatch.first_name || !profilePatch.last_name) throw new Error("First name and last name are required.");

        if (!PROFILE_EDIT_STATE.selectedAvatarKey && !PROFILE_EDIT_STATE.profile?.profile_picture_url && !PROFILE_EDIT_STATE.uploadedFile) {
            PROFILE_EDIT_STATE.selectedAvatarKey = window.tyfitProfile.getDefaultAvatar().key;
        }

        let profilePictureUri = PROFILE_EDIT_STATE.profile?.profile_picture_url || "";
        if (PROFILE_EDIT_STATE.mode === "upload" && PROFILE_EDIT_STATE.uploadedFile) {
            const oldUri = PROFILE_EDIT_STATE.profile?.profile_picture_url || "";
            const uploaded = await window.tyfitProfile.uploadProfilePicture(
                PROFILE_EDIT_STATE.uploadedFile,
                PROFILE_EDIT_STATE.user.id,
                oldUri
            );
            profilePictureUri = uploaded.path;
        } else if (PROFILE_EDIT_STATE.mode === "avatar") {
            profilePictureUri = PROFILE_EDIT_STATE.selectedAvatarKey || "avatar-5.svg";
        }

        userAboutPatch.avatar_key = PROFILE_EDIT_STATE.mode === "avatar" ? (PROFILE_EDIT_STATE.selectedAvatarKey || null) : null;
        profilePatch.profile_picture_url = profilePictureUri || null;

        await window.tyfitProfile.saveProfileEdits({ userId: PROFILE_EDIT_STATE.user.id, profilePatch, userAboutPatch });

        PROFILE_EDIT_STATE.profile = { ...PROFILE_EDIT_STATE.profile, ...profilePatch };
        PROFILE_EDIT_STATE.userAbout = { ...PROFILE_EDIT_STATE.userAbout, ...userAboutPatch };
        PROFILE_EDIT_STATE.uploadedFile = null;

        if (PROFILE_EDIT_STATE.previewObjectUrl) { URL.revokeObjectURL(PROFILE_EDIT_STATE.previewObjectUrl); PROFILE_EDIT_STATE.previewObjectUrl = ""; }
        updatePreviewImage();
        updateDisplayName();
        showProfileStatus("Profile updated successfully.", "success");
        markFormClean();

        if (typeof window.refreshAuthUi === "function") await window.refreshAuthUi();
    } catch (error) {
        console.error("handleProfileSave error:", error);
        showProfileStatus(error.message || "Could not save profile.", "error");
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa fa-check mr-1"></i> Save Changes'; }
    }
}

/* ── Bind events ───────────────────────────────────────────── */
function bindFormEvents() {
    const form = pe("profileEditForm");
    if (form) form.addEventListener("submit", handleProfileSave);

    // Photo picker triggers
    const editBtn = pe("profileEditPhotoBtn");
    const changeLink = pe("profileChangePhotoTrigger");
    if (editBtn) editBtn.addEventListener("click", () => togglePhotoPicker());
    if (changeLink) changeLink.addEventListener("click", () => togglePhotoPicker());

    // Photo picker tabs
    const tabUpload = pe("profileTabUpload");
    const tabAvatar = pe("profileTabAvatar");
    if (tabUpload) tabUpload.addEventListener("click", () => setPhotoPickerMode("upload"));
    if (tabAvatar) tabAvatar.addEventListener("click", () => setPhotoPickerMode("avatar"));

    // File upload
    const pictureInput = pe("profilePictureInput");
    if (pictureInput) {
        pictureInput.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            PROFILE_EDIT_STATE.uploadedFile = file;
            if (PROFILE_EDIT_STATE.previewObjectUrl) URL.revokeObjectURL(PROFILE_EDIT_STATE.previewObjectUrl);
            PROFILE_EDIT_STATE.previewObjectUrl = URL.createObjectURL(file);
            setPhotoPickerMode("upload");
            updatePreviewImage();
            togglePhotoPicker(false);
            autoSaveProfilePicture();
        });
    }

    // Avatar picker
    bindAvatarPicker();

    // Country code dropdown
    bindCCDropdown();
    renderCCList("");

    // Unit toggle
    bindUnitToggle();

    // Manual Date of Birth formatting and validation.
    bindDobInputFormatting();
    initDobCalendar();

    // Live display name update
    ["profileFirstName", "profileLastName"].forEach(id => {
        const el = pe(id);
        if (el) el.addEventListener("input", updateDisplayName);
    });

    // Dirty tracking — show save bar when any field changes
    const TRACKED_FIELDS = [
        "profileFirstName", "profileLastName", "profileDob", "profileGender",
        "profileHeight", "profileWeight", "profileGoal", "profileActivityLevel",
        "profileCountry", "profilePhoneNumber", "profilePhoneCode"
    ];
    TRACKED_FIELDS.forEach(id => {
        const el = pe(id);
        if (el) { el.addEventListener("input", markFormDirty); el.addEventListener("change", markFormDirty); }
    });

    // Close picker when user clicks away from the photo card.
    document.addEventListener("click", (event) => {
        const picker = pe("profilePhotoPicker");
        if (!picker || picker.style.display === "none") return;
        const withinPhotoCard = event.target.closest(".tyfit-photo-card");
        if (!withinPhotoCard) {
            togglePhotoPicker(false);
        }
    });
}

function scrollToProfileSectionFromHash() {
    const rawHash = (window.location.hash || "").trim();
    if (!rawHash || rawHash.length < 2) return;

    const targetId = decodeURIComponent(rawHash.slice(1));
    const card = document.getElementById(targetId);
    if (!card) return;

    // Wait two rAF ticks + a short settle so layout is fully painted after
    // display:block before we measure getBoundingClientRect.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                const heading = card.querySelector(".tyfit-profile-card-head h2") || card;
                const OFFSET = 16;
                const top = heading.getBoundingClientRect().top + window.scrollY - OFFSET;
                window.scrollTo({ top, behavior: "smooth" });

                // Backlight glow — 10 layers, 50% → 2%
                card.style.transition = "box-shadow 0.3s ease";
                card.style.boxShadow = [
                    "0 0 0px  1px rgba(108, 99, 255, 0.50)",
                    "0 0 1px  1px rgba(108, 99, 255, 0.44)",
                    "0 0 2px  2px rgba(108, 99, 255, 0.38)",
                    "0 0 3px  2px rgba(108, 99, 255, 0.32)",
                    "0 0 4px  2px rgba(108, 99, 255, 0.26)",
                    "0 0 6px  3px rgba(108, 99, 255, 0.19)",
                    "0 0 7px  3px rgba(108, 99, 255, 0.14)",
                    "0 0 9px  3px rgba(108, 99, 255, 0.09)",
                    "0 0 11px 4px rgba(108, 99, 255, 0.05)",
                    "0 0 12px 4px rgba(108, 99, 255, 0.02)"
                ].join(", ");

                // Fade out after 1.8 s
                setTimeout(() => {
                    card.style.transition = "box-shadow 0.6s ease";
                    card.style.boxShadow = "";
                    setTimeout(() => { card.style.transition = ""; }, 650);
                }, 1800);
            }, 80); // 80 ms settle — enough for layout after display:block
        });
    });
}

/* ── Load page ─────────────────────────────────────────────── */
async function loadProfileEditPage() {
    const skeleton = pe("profileSkeleton");
    const main = pe("profileMain");

    if (skeleton) skeleton.style.display = "block";
    if (main) main.style.display = "none";

    await window.tyfitProfile.loadProfileEditPage(async (user) => {
        PROFILE_EDIT_STATE.user = user;

        const [profile, userAbout] = await Promise.all([
            window.tyfitProfile.fetchProfile(user.id),
            window.tyfitProfile.fetchUserAbout(user.id)
        ]);

        const hydratedAbout = await window.tyfitProfile.ensureAvatarAssignment(user.id, userAbout);

        PROFILE_EDIT_STATE.profile = profile || { id: user.id, email: user.email || "" };
        PROFILE_EDIT_STATE.userAbout = hydratedAbout;

        // Determine selected avatar key: prefer profile_picture_uri if it's an avatar key,
        // then fall back to user_about.avatar_key, then the default avatar
        const savedUri = PROFILE_EDIT_STATE.profile?.profile_picture_url || "";
        const uriIsAvatarKey = savedUri && window.tyfitProfile.isAvatarKey(savedUri);
        PROFILE_EDIT_STATE.selectedAvatarKey = uriIsAvatarKey
            ? savedUri
            : (hydratedAbout.avatar_key || window.tyfitProfile.getDefaultAvatar().key);

        const avatarGrid = pe("profileAvatarGrid");
        window.tyfitProfile.renderAvatarPicker(avatarGrid, PROFILE_EDIT_STATE.selectedAvatarKey);

        fillProfileForm(PROFILE_EDIT_STATE.profile, hydratedAbout, user);

        const preferredMode = (savedUri && window.tyfitProfile.isStoragePath(savedUri)) ? "upload" : "avatar";
        setPhotoPickerMode(preferredMode);

        if (skeleton) skeleton.style.display = "none";
        if (main) main.style.display = "block";
        scrollToProfileSectionFromHash();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    bindFormEvents();

    document.addEventListener("component-loaded", (event) => {
        if (event.detail?.componentName === "navbar") {
            loadProfileEditPage().catch((error) => {
                console.error("loadProfileEditPage failed:", error);
                showProfileStatus("Unable to load profile right now.", "error");
            });
        }
    });

    setTimeout(() => {
        loadProfileEditPage().catch((error) => {
            console.error("loadProfileEditPage fallback failed:", error);
            showProfileStatus("Unable to load profile right now.", "error");
        });
    }, 900);
});
