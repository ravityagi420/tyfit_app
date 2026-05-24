/**
 * shell.js — Shared sidebar / drawer / sheet interactions for all pages.
 * Relies only on DOM IDs; no homeData dependency.
 */
(function () {
    function byId(id) { return document.getElementById(id); }

    let iconRefreshRaf = null;
    let iconRefreshIdle = null;
    let loaderVisibleAt = 0;

    function mountPageLoader() {
        if (byId('tyfitPageLoader')) return;

        const loader = document.createElement('div');
        loader.id = 'tyfitPageLoader';
        loader.className = 'tyfit-page-loader';
        loader.setAttribute('aria-hidden', 'true');
        loader.innerHTML = [
            '<div class="tyfit-page-loader__panel">',
            '  <div class="tyfit-page-loader__spinner" aria-hidden="true"></div>',
            '  <p>Loading TYFIT...</p>',
            '</div>'
        ].join('');

        document.body.appendChild(loader);
        requestAnimationFrame(() => loader.classList.add('is-visible'));
        loaderVisibleAt = Date.now();
    }

    function unmountPageLoader() {
        const loader = byId('tyfitPageLoader');
        if (!loader) return;

        const minVisible = 280;
        const elapsed = Date.now() - loaderVisibleAt;
        const wait = Math.max(0, minVisible - elapsed);

        setTimeout(() => {
            loader.classList.remove('is-visible');
            loader.classList.add('is-leaving');
            setTimeout(() => loader.remove(), 220);
        }, wait);
    }

    function unmountPageLoaderWhenReady() {
        if (document.readyState === 'complete') {
            refreshIcons();
            unmountPageLoader();
            return;
        }

        window.addEventListener('load', () => {
            refreshIcons();
            unmountPageLoader();
        }, { once: true });
    }

    function refreshIcons() {
        if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;

        if (iconRefreshRaf) cancelAnimationFrame(iconRefreshRaf);
        if (iconRefreshIdle && typeof window.cancelIdleCallback === 'function') {
            window.cancelIdleCallback(iconRefreshIdle);
        }

        iconRefreshRaf = requestAnimationFrame(() => {
            const run = () => {
                try {
                    window.lucide.createIcons();
                } catch (err) {
                    console.warn('Icon render warning:', err?.message || err);
                }
            };

            if (typeof window.requestIdleCallback === 'function') {
                iconRefreshIdle = window.requestIdleCallback(run, { timeout: 220 });
            } else {
                setTimeout(run, 16);
            }
        });
    }

    // Expose a shared, throttled icon refresh for other page scripts.
    window.tyfitRefreshIcons = refreshIcons;

    function optimizeImages() {
        const images = document.querySelectorAll('img');
        images.forEach((img, index) => {
            if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
            if (!img.getAttribute('loading')) {
                const shouldEager = index < 2 || img.closest('.tyfit-mobile-topbar, .tyfit-sidebar-head, .tyfit-hero-card');
                img.setAttribute('loading', shouldEager ? 'eager' : 'lazy');
            }
        });
    }

    function observeDynamicIcons() {
        const root = byId('tyfitLayout') || document.body;
        if (!root || typeof MutationObserver === 'undefined') return;

        const observer = new MutationObserver((mutations) => {
            let found = false;
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if ((node.matches && node.matches('i[data-lucide]')) || (node.querySelector && node.querySelector('i[data-lucide]'))) {
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            if (found) refreshIcons();
        });

        observer.observe(root, { childList: true, subtree: true });
    }

    function toggleSidebar() {
        const layout = byId('tyfitLayout');
        if (layout) layout.classList.toggle('sidebar-collapsed');
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

    if (document.body) {
        mountPageLoader();
    } else {
        document.addEventListener('readystatechange', () => {
            if (document.readyState !== 'loading') mountPageLoader();
        }, { once: true });
    }

    document.addEventListener('DOMContentLoaded', function () {
        optimizeImages();

        document.querySelectorAll('.tyfit-sidebar .sidebar-nav-item').forEach((item) => {
            const label = item.querySelector('span')?.textContent?.trim();
            if (!label) return;
            item.setAttribute('data-tooltip', label);
            item.setAttribute('aria-label', label);
        });

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
        const desktopAccountWrap = byId('desktopAccountWrap') || desktopAccountBtn?.closest('.tyfit-dropdown-wrap');

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

        if (desktopAccountWrap && desktopAccountMenu) {
            desktopAccountWrap.addEventListener('mouseenter', () => {
                if (window.matchMedia('(min-width: 1024px)').matches) {
                    desktopAccountMenu.classList.add('is-open');
                    desktopAccountMenu.setAttribute('aria-hidden', 'false');
                }
            });

            desktopAccountWrap.addEventListener('mouseleave', () => {
                if (window.matchMedia('(min-width: 1024px)').matches) {
                    desktopAccountMenu.classList.remove('is-open');
                    desktopAccountMenu.setAttribute('aria-hidden', 'true');
                }
            });
        }

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
                const action = String(btn.dataset.action || '').toLowerCase();
                const inPortal = window.location.pathname.includes('/portal/');
                const checkinHref = inPortal ? '../daily_checkin.html' : 'daily_checkin.html';

                if (action === 'checkin' || action === 'meal') {
                    closeSheet();
                    window.location.href = checkinHref;
                    return;
                }

                showToast('Log Weight clicked.');
                closeSheet();
            });
        });

        observeDynamicIcons();
        refreshIcons();

        document.addEventListener('component-loaded', refreshIcons);
        unmountPageLoaderWhenReady();
    });
}());
