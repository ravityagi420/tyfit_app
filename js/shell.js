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

    function togglePopover(menuEl) {
        if (!menuEl) return;

        document.querySelectorAll('.tyfit-popover-menu.is-open').forEach((menu) => {
            if (menu !== menuEl) {
                menu.classList.remove('is-open');
                menu.setAttribute('aria-hidden', 'true');
            }
        });

        const shouldOpen = !menuEl.classList.contains('is-open');
        menuEl.classList.toggle('is-open', shouldOpen);
        menuEl.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
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
        const desktopNotifBtn   = byId('desktopNotifBtn');
        const desktopNotifMenu  = byId('desktopNotifMenu');
        const desktopAccountBtn = byId('desktopAccountBtn');
        const desktopAccountMenu = byId('desktopAccountMenu');

        if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener('click', toggleSidebar);
        if (mobileMenuBtn)      mobileMenuBtn.addEventListener('click', openMobileDrawer);
        if (mobileDrawerClose)  mobileDrawerClose.addEventListener('click', closeMobileDrawer);
        if (mobileDrawerBack)   mobileDrawerBack.addEventListener('click', closeMobileDrawer);
        if (quickAddBtn)        quickAddBtn.addEventListener('click', openSheet);
        if (sheetClose)         sheetClose.addEventListener('click', closeSheet);
        if (sheetBackdrop)      sheetBackdrop.addEventListener('click', closeSheet);
        if (upgradeNowBtn)      upgradeNowBtn.addEventListener('click', () => showToast('Premium flow coming soon.'));
        if (desktopNotifBtn)    desktopNotifBtn.addEventListener('click', () => togglePopover(desktopNotifMenu));
        if (desktopAccountBtn)  desktopAccountBtn.addEventListener('click', () => togglePopover(desktopAccountMenu));

        if (desktopAccountMenu) {
            desktopAccountMenu.addEventListener('click', async (event) => {
                const actionBtn = event.target.closest('.tyfit-menu-action');
                if (!actionBtn) return;
                const action = actionBtn.dataset.action;
                if (action === 'account') {
                    window.location.href = window.location.pathname.includes('/portal/') ? '../profile.html' : 'profile.html';
                    return;
                }
                if (action === 'logout') {
                    try {
                        if (window.supabaseClient && window.supabaseClient.auth) {
                            await window.supabaseClient.auth.signOut();
                        }
                    } catch (err) {
                        console.warn('Logout error:', err);
                    }
                    window.location.href = '/login.html';
                }
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeMobileDrawer();
        });

        document.addEventListener('click', function (event) {
            const insideDropdown = event.target.closest('.tyfit-dropdown-wrap');
            if (insideDropdown) return;

            document.querySelectorAll('.tyfit-popover-menu.is-open').forEach((menu) => {
                menu.classList.remove('is-open');
                menu.setAttribute('aria-hidden', 'true');
            });
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
