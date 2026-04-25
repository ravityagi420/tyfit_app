/**
 * shell.js — Shared sidebar / drawer / sheet interactions for all pages.
 * Relies only on DOM IDs; no homeData dependency.
 */
(function () {
    function byId(id) { return document.getElementById(id); }

    function toggleSidebar() {
        document.body.classList.toggle('sidebar-collapsed');
    }

    function openMobileDrawer() {
        const drawer = byId('mobileDrawer');
        const backdrop = byId('mobileDrawerBackdrop');
        if (!drawer || !backdrop) return;
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        backdrop.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeMobileDrawer() {
        const drawer = byId('mobileDrawer');
        const backdrop = byId('mobileDrawerBackdrop');
        if (!drawer || !backdrop) return;
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        backdrop.hidden = true;
        document.body.style.overflow = '';
    }

    function openSheet() {
        const sheet = byId('quickSheet');
        const backdrop = byId('quickSheetBackdrop');
        if (!sheet || !backdrop) return;
        sheet.classList.add('is-open');
        sheet.setAttribute('aria-hidden', 'false');
        backdrop.hidden = false;
    }

    function closeSheet() {
        const sheet = byId('quickSheet');
        const backdrop = byId('quickSheetBackdrop');
        if (!sheet || !backdrop) return;
        sheet.classList.remove('is-open');
        sheet.setAttribute('aria-hidden', 'true');
        backdrop.hidden = true;
    }

    function showToast(msg) {
        const toast = byId('appToast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('is-show');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.remove('is-show'), 2200);
    }

    document.addEventListener('DOMContentLoaded', function () {
        const sidebarCollapseBtn = byId('sidebarCollapseBtn');
        const mobileMenuBtn     = byId('mobileMenuBtn');
        const mobileDrawerClose = byId('mobileDrawerClose');
        const mobileDrawerBack  = byId('mobileDrawerBackdrop');
        const quickAddBtn       = byId('quickAddBtn');
        const sheetClose        = byId('quickSheetClose');
        const sheetBackdrop     = byId('quickSheetBackdrop');
        const upgradeNowBtn     = byId('upgradeNowBtn');

        if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener('click', toggleSidebar);
        if (mobileMenuBtn)      mobileMenuBtn.addEventListener('click', openMobileDrawer);
        if (mobileDrawerClose)  mobileDrawerClose.addEventListener('click', closeMobileDrawer);
        if (mobileDrawerBack)   mobileDrawerBack.addEventListener('click', closeMobileDrawer);
        if (quickAddBtn)        quickAddBtn.addEventListener('click', openSheet);
        if (sheetClose)         sheetClose.addEventListener('click', closeSheet);
        if (sheetBackdrop)      sheetBackdrop.addEventListener('click', closeSheet);
        if (upgradeNowBtn)      upgradeNowBtn.addEventListener('click', () => showToast('Premium flow coming soon.'));

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMobileDrawer();
        });

        document.querySelectorAll('.sidebar-logout').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                try {
                    if (window.supabaseClient && window.supabaseClient.auth) {
                        await window.supabaseClient.auth.signOut();
                    }
                } catch (err) {
                    console.warn('Logout error:', err);
                }
                window.location.href = '/login.html';
            });
        });

        document.querySelectorAll('.tyfit-sheet-action').forEach(btn => {
            btn.addEventListener('click', () => {
                showToast((btn.dataset.action === 'meal' ? 'Add Meal' : 'Log Weight') + ' clicked.');
                closeSheet();
            });
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}());
