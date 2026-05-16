/*
  Supabase table suggestion:

  privacy_requests:
  - id uuid primary key
  - user_id uuid
  - request_type text: data_export, deletion, correction, objection, restriction
  - message text
  - status text default 'pending'
  - created_at timestamptz default now()
  - resolved_at timestamptz nullable
*/

(function () {
  function byId(id) {
    return document.getElementById(id);
  }

  function showToast(message) {
    const toast = byId("appToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove("is-show");
    }, 2600);
  }

  async function getCurrentUser() {
    if (window.tyfitProfile?.getCurrentUser) {
      return window.tyfitProfile.getCurrentUser();
    }

    const sessionRes = await window.supabaseClient.auth.getSession();
    return sessionRes?.data?.session?.user || null;
  }

  async function submitPrivacyRequest(userId, requestType, message) {
    const payload = {
      user_id: userId,
      request_type: requestType,
      message: message || null,
      status: "pending"
    };

    const { error } = await window.supabaseClient
      .from("privacy_requests")
      .insert(payload);

    if (error) {
      throw new Error(error.message || "Could not submit request.");
    }
  }

  function openDeleteModal() {
    const modal = byId("privacyDeleteModal");
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDeleteModal() {
    const modal = byId("privacyDeleteModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  async function hydrateHeader(user) {
    const nameEl = byId("desktopProfileName");
    const avatarEl = byId("desktopProfileAvatar");

    try {
      const profile = window.tyfitProfile?.fetchProfile
        ? await window.tyfitProfile.fetchProfile(user.id)
        : null;
      const about = window.tyfitProfile?.fetchUserAbout
        ? await window.tyfitProfile.fetchUserAbout(user.id)
        : null;

      const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
        || profile?.full_name
        || user?.user_metadata?.full_name
        || user?.email?.split("@")[0]
        || "Account";

      if (nameEl) nameEl.textContent = fullName;

      if (avatarEl && window.tyfitProfile?.resolveProfileImage) {
        const src = window.tyfitProfile.resolveProfileImage(profile, about);
        if (src) avatarEl.src = src;
      }
    } catch (error) {
      console.warn("privacy header hydrate warning:", error?.message || error);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    let user = null;

    try {
      user = await getCurrentUser();
      if (!user) {
        window.location.href = "login.html";
        return;
      }
    } catch (error) {
      console.error("privacy init auth error:", error);
      window.location.href = "login.html";
      return;
    }

    await hydrateHeader(user);

    const requestDataBtn = byId("requestDataBtn");
    const requestDeleteBtn = byId("requestDeleteBtn");
    const requestDeleteConfirmBtn = byId("requestDeleteConfirmBtn");
    const requestCorrectionBtn = byId("requestCorrectionBtn");
    const contactSupportBtn = byId("contactSupportBtn");

    requestDataBtn?.addEventListener("click", async () => {
      requestDataBtn.disabled = true;
      try {
        await submitPrivacyRequest(user.id, "data_export", "User requested personal data export.");
        showToast("Data export request submitted.");
      } catch (error) {
        console.error(error);
        showToast(error.message || "Could not submit export request.");
      } finally {
        requestDataBtn.disabled = false;
      }
    });

    requestDeleteBtn?.addEventListener("click", () => {
      openDeleteModal();
    });

    requestDeleteConfirmBtn?.addEventListener("click", async () => {
      requestDeleteConfirmBtn.disabled = true;
      try {
        await submitPrivacyRequest(user.id, "deletion", "User requested account and personal data deletion.");
        closeDeleteModal();
        showToast("Deletion request submitted for review.");
      } catch (error) {
        console.error(error);
        showToast(error.message || "Could not submit deletion request.");
      } finally {
        requestDeleteConfirmBtn.disabled = false;
      }
    });

    requestCorrectionBtn?.addEventListener("click", () => {
      window.location.href = "profile_edit.html";
    });

    contactSupportBtn?.addEventListener("click", () => {
      window.location.href = "mailto:privacy@tyfit.app?subject=Tyfit%20Privacy%20Question";
    });

    document.querySelectorAll("[data-close-delete-modal]").forEach((el) => {
      el.addEventListener("click", closeDeleteModal);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDeleteModal();
      }
    });
  });
})();
