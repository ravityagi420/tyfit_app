/**
 * shell.js — Shared sidebar / drawer / sheet interactions for all pages.
 * Relies only on DOM IDs; no homeData dependency.
 */
(function () {
    function byId(id) { return document.getElementById(id); }

    let iconRefreshRaf = null;
    let iconRefreshIdle = null;
    let loaderVisibleAt = 0;
    const PHOSPHOR_CSS_ID = 'tyfitPhosphorIcons';
    const PHOSPHOR_CSS_HREF = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/regular/style.css';
    const PHOSPHOR_FILL_CSS_ID = 'tyfitPhosphorFillIcons';
    const PHOSPHOR_FILL_CSS_HREF = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.1/src/fill/style.css';

    function mountPageLoader() {
        if (byId('tyfitPageLoader')) return;

        const loader = document.createElement('div');
        loader.id = 'tyfitPageLoader';
        loader.className = 'tyfit-page-loader';
        loader.setAttribute('aria-hidden', 'true');
        loader.innerHTML = [
            '<div class="tyfit-page-loader__shell" aria-hidden="true">',
            '  <span class="tyfit-page-loader__bar tyfit-page-loader__bar--sm"></span>',
            '  <span class="tyfit-page-loader__hero"></span>',
            '  <span class="tyfit-page-loader__row"></span>',
            '  <span class="tyfit-page-loader__row tyfit-page-loader__row--short"></span>',
            '  <div class="tyfit-page-loader__grid">',
            '    <span></span><span></span><span></span>',
            '  </div>',
            '</div>'
        ].join('');

        document.body.appendChild(loader);
        requestAnimationFrame(() => loader.classList.add('is-visible'));
        loaderVisibleAt = Date.now();
    }

    function isInternalLink(link) {
        if (!link || !link.getAttribute) return false;
        if (link.target && link.target !== '_self') return false;
        if (link.hasAttribute('download')) return false;

        const url = new URL(link.getAttribute('href'), window.location.href);
        return url.origin === window.location.origin && url.href !== window.location.href;
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

    function ensurePhosphorIcons() {
        if (!document.getElementById(PHOSPHOR_CSS_ID)) {
            const link = document.createElement('link');
            link.id = PHOSPHOR_CSS_ID;
            link.rel = 'stylesheet';
            link.href = PHOSPHOR_CSS_HREF;
            document.head.appendChild(link);
        }

        if (!document.getElementById(PHOSPHOR_FILL_CSS_ID)) {
            const fillLink = document.createElement('link');
            fillLink.id = PHOSPHOR_FILL_CSS_ID;
            fillLink.rel = 'stylesheet';
            fillLink.href = PHOSPHOR_FILL_CSS_HREF;
            document.head.appendChild(fillLink);
        }
    }

    function phosphorIcon(name, weight = 'regular') {
        const family = weight === 'fill' ? 'ph-fill' : 'ph';
        return `<i class="${family} ${name}" aria-hidden="true"></i>`;
    }

    function getBottomNavIconClass(key) {
        const icons = {
            home: 'ph-house',
            diet: 'ph-fork-knife',
            checkin: 'ph-clipboard-text',
            training: 'ph-barbell',
            profile: 'ph-user-circle'
        };
        return icons[key] || 'ph-circle';
    }

    function getBottomNavKeyFromLink(link) {
        const label = link?.querySelector('span')?.textContent?.trim().toLowerCase() || '';
        const href = link?.getAttribute('href') || '';
        if (label === 'home' || href.includes('index.html')) return 'home';
        if (label === 'diet chart' || href.includes('diet_chart.html')) return 'diet';
        if (label === 'checkin' || label === 'daily checkin' || href.includes('daily_checkin.html')) return 'checkin';
        if (label === 'training' || href.includes('training_plan.html')) return 'training';
        if (label === 'profile' || href.includes('profile.html')) return 'profile';
        return '';
    }

    function applyPhosphorBottomNavIcons(root) {
        ensurePhosphorIcons();
        const nav = root?.matches?.('.tyfit-mobile-bottom-nav') ? root : (root || document).querySelector?.('.tyfit-mobile-bottom-nav');
        if (!nav) return;
        nav.querySelectorAll('a, button').forEach((item) => {
            const key = item.dataset.navKey || getBottomNavKeyFromLink(item);
            if (!key) return;
            item.dataset.navKey = key;
            item.querySelectorAll('i[data-lucide], svg[data-lucide], svg.lucide, img.tyfit-mobile-profile-avatar, i.ph, i.ph-fill').forEach((icon) => icon.remove());
            item.insertAdjacentHTML('afterbegin', phosphorIcon(getBottomNavIconClass(key), item.classList.contains('is-active') ? 'fill' : 'regular'));
        });
    }

    window.tyfitApplyPhosphorBottomNavIcons = applyPhosphorBottomNavIcons;

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

    function getRootPrefix() {
        return window.location.pathname.includes('/portal/') ? '../' : '';
    }

    function getActiveBottomNavKey() {
        const page = document.body?.dataset?.page || '';
        if (page === 'home') return 'home';
        if (page === 'diet-chart') return 'diet';
        if (page === 'daily-checkin' || page === 'checkin-goals' || page === 'checkin-summary') return 'checkin';
        if (page === 'training-plan') return 'training';
        if (page === 'journey') return 'profile';
        if (page === 'profile' || page === 'profile-edit' || page.startsWith('privacy') || page === 'terms' || page === 'cookie-policy' || page === 'data-processing') {
            return 'profile';
        }
        return '';
    }

    function mountBottomNav() {
        const placeholder = document.querySelector('[data-tyfit-bottom-nav]');
        if (!placeholder || document.querySelector('.tyfit-mobile-bottom-nav')) return;

        const prefix = getRootPrefix();
        const active = getActiveBottomNavKey();
        const navItems = [
            { key: 'home', href: `${prefix}index.html`, icon: 'ph-house', label: 'Home' },
            { key: 'diet', href: `${prefix}portal/diet_chart.html`, icon: 'ph-fork-knife', label: 'Diet Chart' },
            { key: 'checkin', href: `${prefix}daily_checkin.html`, icon: 'ph-clipboard-text', label: 'CheckIn' },
            { key: 'training', href: `${prefix}training_plan.html`, icon: 'ph-barbell', label: 'Training' },
            { key: 'profile', href: `${prefix}profile.html`, icon: 'ph-user-circle', label: 'Profile' },
        ];

        ensurePhosphorIcons();
        placeholder.outerHTML = [
            '<nav class="tyfit-mobile-bottom-nav" aria-label="Bottom navigation">',
            navItems.slice(0, 2).map((item) => (
                `<a href="${item.href}" data-nav-key="${item.key}"${item.key === active ? ' class="is-active"' : ''}>${phosphorIcon(item.icon, item.key === active ? 'fill' : 'regular')}<span>${item.label}</span></a>`
            )).join(''),
            `<a href="${navItems[2].href}" class="tyfit-checkin-nav-btn${active === 'checkin' ? ' is-active' : ''}" data-nav-key="${navItems[2].key}" aria-label="Daily CheckIn">${phosphorIcon(navItems[2].icon, active === 'checkin' ? 'fill' : 'regular')}<span>${navItems[2].label}</span></a>`,
            navItems.slice(3).map((item) => (
                `<a href="${item.href}" data-nav-key="${item.key}"${item.key === active ? ' class="is-active"' : ''}>${phosphorIcon(item.icon, item.key === active ? 'fill' : 'regular')}<span>${item.label}</span></a>`
            )).join(''),
            '</nav>',
        ].join('');
    }

    function normalizeExistingBottomNav() {
        const nav = document.querySelector('.tyfit-mobile-bottom-nav');
        const quick = nav?.querySelector('#quickAddBtn.tyfit-plus-btn');
        if (!nav || !quick) return;
        const prefix = getRootPrefix();
        const active = getActiveBottomNavKey();
        const checkin = document.createElement('a');
        checkin.href = `${prefix}daily_checkin.html`;
        checkin.className = `tyfit-checkin-nav-btn${active === 'checkin' ? ' is-active' : ''}`;
        checkin.dataset.navKey = 'checkin';
        checkin.setAttribute('aria-label', 'Daily CheckIn');
        checkin.innerHTML = `${phosphorIcon('ph-clipboard-text', active === 'checkin' ? 'fill' : 'regular')}<span>CheckIn</span>`;
        quick.replaceWith(checkin);
        applyPhosphorBottomNavIcons(nav);
    }

    function shouldMountFloatingAction() {
        const page = document.body?.dataset?.page || '';
        if (page === 'daily-checkin' || page === 'checkin-success') return false;
        if (page === 'checkin-goals') return false;
        if (page === 'diet-chart' || page === 'training-plan') return false;
        if (page === 'profile' || page === 'profile-edit') return false;
        if (page.startsWith('privacy') || page === 'terms' || page === 'cookie-policy' || page === 'data-processing') return false;
        return true;
    }

    function floatingActionIsMenuEnabled() {
        const page = document.body?.dataset?.page || '';
        return page !== 'diet-chart' && page !== 'training-plan';
    }

    function todayISO() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async function getCurrentUserId() {
        if (typeof window.getAccessState === 'function') {
            const access = await window.getAccessState();
            if (access?.user?.id) return access.user.id;
        }
        const sessionResult = await window.supabaseClient?.auth?.getSession?.();
        return sessionResult?.data?.session?.user?.id || '';
    }

    function mountWeightModal() {
        if (byId('tyfitWeightModal')) return;
        const modal = document.createElement('div');
        modal.id = 'tyfitWeightModal';
        modal.className = 'tyfit-weight-modal';
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        modal.innerHTML = [
            '<div class="tyfit-weight-modal__backdrop" data-weight-close></div>',
            '<section class="tyfit-weight-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="tyfitWeightTitle">',
            '  <button type="button" class="tyfit-weight-modal__close" data-weight-close aria-label="Close"><i data-lucide="x"></i></button>',
            '  <div class="tyfit-weight-modal__head">',
            '    <span class="tyfit-weight-modal__icon"><i data-lucide="scale"></i></span>',
            '    <div>',
            '      <h3 id="tyfitWeightTitle">Log Weight</h3>',
            '      <p>Track your current body weight for progress history.</p>',
            '    </div>',
            '  </div>',
            '  <div class="tyfit-weight-form-card">',
            '    <label class="tyfit-weight-field" data-field="weight">',
            '      <span class="tyfit-weight-field__icon"><i data-lucide="scale"></i></span>',
            '      <span class="tyfit-weight-field__body"><strong>Weight</strong><input id="tyfitWeightValue" type="number" inputmode="decimal" min="25" max="300" step="0.1" placeholder="61.0 kg"></span>',
            '    </label>',
            '    <label class="tyfit-weight-field" data-field="date">',
            '      <span class="tyfit-weight-field__icon"><i data-lucide="calendar-days"></i></span>',
            '      <span class="tyfit-weight-field__body"><strong>Date</strong><input id="tyfitWeightDate" type="date"></span>',
            '    </label>',
            '    <label class="tyfit-weight-field" data-field="notes">',
            '      <span class="tyfit-weight-field__icon"><i data-lucide="notebook-pen"></i></span>',
            '      <span class="tyfit-weight-field__body"><strong>Note</strong><textarea id="tyfitWeightNotes" rows="2" placeholder="Optional"></textarea></span>',
            '    </label>',
            '  </div>',
            '  <button type="button" class="tyfit-weight-modal__save" id="tyfitWeightSaveBtn">Save Weight</button>',
            '</section>'
        ].join('');
        document.body.appendChild(modal);
    }

    function openWeightModal() {
        mountWeightModal();
        const modal = byId('tyfitWeightModal');
        const date = byId('tyfitWeightDate');
        const value = byId('tyfitWeightValue');
        if (!modal || !date) return;
        const today = todayISO();
        date.value = today;
        date.max = today;
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('tyfit-weight-modal-open');
        requestAnimationFrame(() => modal.classList.add('is-open'));
        refreshIcons();
        setTimeout(() => value?.focus(), 80);
    }

    window.tyfitOpenWeightModal = openWeightModal;

    function closeWeightModal() {
        const modal = byId('tyfitWeightModal');
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('is-open');
        document.body.classList.remove('tyfit-weight-modal-open');
        setTimeout(() => {
            if (!modal.classList.contains('is-open')) modal.hidden = true;
        }, 220);
    }

    async function saveWeightLog() {
        const valueNode = byId('tyfitWeightValue');
        const dateNode = byId('tyfitWeightDate');
        const notesNode = byId('tyfitWeightNotes');
        const saveBtn = byId('tyfitWeightSaveBtn');
        const weight = Number(valueNode?.value || 0);
        const dateValue = dateNode?.value || todayISO();

        if (!Number.isFinite(weight) || weight < 25 || weight > 300) {
            showToast('Enter a valid weight.');
            valueNode?.focus();
            return;
        }
        if (!dateValue || dateValue > todayISO()) {
            showToast('Choose today or a past date.');
            dateNode?.focus();
            return;
        }

        const userId = await getCurrentUserId();
        if (!userId) {
            showToast('Please log in first.');
            return;
        }

        const loggedAt = dateValue === todayISO()
            ? new Date().toISOString()
            : new Date(`${dateValue}T12:00:00`).toISOString();

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }
        try {
            const { error } = await window.supabaseClient
                .from('user_metric_logs')
                .insert({
                    user_id: userId,
                    created_by: userId,
                    metric_key: 'weight',
                    metric_label: 'Weight',
                    value: weight,
                    unit: 'kg',
                    logged_at: loggedAt,
                    notes: (notesNode?.value || '').trim() || null
                });
            if (error) throw error;
            closeWeightModal();
            showToast('Weight logged');
        } catch (error) {
            console.error('weight log error:', error);
            showToast(error?.message || 'Could not log weight.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Save Weight';
            }
        }
    }

    function toggleFloatingMenu(forceOpen) {
        const wrap = byId('tyfitFloatingAction');
        if (!wrap) return;
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !wrap.classList.contains('is-open');
        wrap.classList.toggle('is-open', shouldOpen);
        wrap.querySelector('.tyfit-floating-plus')?.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    function mountFloatingAction() {
        if (!shouldMountFloatingAction() || byId('tyfitFloatingAction')) return;
        const enabled = floatingActionIsMenuEnabled();
        const wrap = document.createElement('div');
        wrap.id = 'tyfitFloatingAction';
        wrap.className = `tyfit-floating-action${enabled ? '' : ' is-disabled'}`;
        wrap.innerHTML = [
            '<div class="tyfit-floating-action__menu" aria-hidden="true">',
            '  <button type="button" data-floating-action="checkin"><i data-lucide="clipboard-check"></i><span>Daily Checkin</span></button>',
            '  <button type="button" data-floating-action="weight"><i data-lucide="scale"></i><span>Log weight</span></button>',
            '</div>',
            `<button type="button" class="tyfit-floating-plus" aria-label="Quick actions" aria-expanded="false"${enabled ? '' : ' disabled'}><i data-lucide="plus"></i></button>`
        ].join('');
        document.body.appendChild(wrap);
    }

    if (document.body) {
        mountPageLoader();
    } else {
        document.addEventListener('readystatechange', () => {
            if (document.readyState !== 'loading') mountPageLoader();
        }, { once: true });
    }

    document.addEventListener('DOMContentLoaded', function () {
        mountBottomNav();
        normalizeExistingBottomNav();
        applyPhosphorBottomNavIcons(document);
        mountFloatingAction();
        mountWeightModal();
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
        const floatingAction    = byId('tyfitFloatingAction');
        const floatingPlus      = floatingAction?.querySelector('.tyfit-floating-plus');
        const sheetClose        = byId('quickSheetClose');
        const sheetBackdrop     = byId('quickSheetBackdrop');
        const weightModal       = byId('tyfitWeightModal');
        const weightSaveBtn     = byId('tyfitWeightSaveBtn');
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
        if (floatingPlus && floatingActionIsMenuEnabled()) {
            floatingPlus.addEventListener('click', () => toggleFloatingMenu());
        }
        if (sheetClose)         sheetClose.addEventListener('click', closeSheet);
        if (sheetBackdrop)      sheetBackdrop.addEventListener('click', closeSheet);
        if (weightSaveBtn)      weightSaveBtn.addEventListener('click', saveWeightLog);
        if (weightModal) {
            weightModal.addEventListener('click', (event) => {
                if (event.target.closest('[data-weight-close]')) closeWeightModal();
            });
        }
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
            if (e.key === 'Escape') {
                toggleFloatingMenu(false);
                closeWeightModal();
            }
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

        document.addEventListener('click', function (event) {
            if (document.body?.dataset?.page === 'home') return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            const link = event.target.closest('a[href]');
            if (!isInternalLink(link)) return;

            event.preventDefault();
            mountPageLoader();
            requestAnimationFrame(() => {
                setTimeout(() => {
                    window.location.href = new URL(link.getAttribute('href'), window.location.href).href;
                }, 60);
            });
        }, true);

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

                if (action === 'weight') {
                    closeSheet();
                    openWeightModal();
                    return;
                }

                closeSheet();
            });
        });

        if (floatingAction) {
            floatingAction.addEventListener('click', (event) => {
                const actionBtn = event.target.closest('[data-floating-action]');
                if (!actionBtn) return;
                const action = String(actionBtn.dataset.floatingAction || '').toLowerCase();
                const inPortal = window.location.pathname.includes('/portal/');
                const checkinHref = inPortal ? '../daily_checkin.html' : 'daily_checkin.html';
                toggleFloatingMenu(false);
                if (action === 'checkin') {
                    window.location.href = checkinHref;
                    return;
                }
                if (action === 'weight') {
                    openWeightModal();
                }
            });
        }

        observeDynamicIcons();
        refreshIcons();

        document.addEventListener('component-loaded', refreshIcons);
        unmountPageLoaderWhenReady();
    });
}());
