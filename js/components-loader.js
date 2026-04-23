/**
 * Components Loader
 * Dynamically loads modular HTML components (navbar, footer, etc.)
 */

const ComponentsLoader = {
    /**
     * Load a component from the components directory
     * @param {string} componentName - Name of the component file (e.g., 'navbar', 'footer')
     * @param {string} targetSelector - CSS selector for the target element
     * @param {Object} options - Additional options
     */
    loadComponent: async function(componentName, targetSelector, options = {}) {
        try {
            const basePath = options.basePath || '';
            const componentVersion = '20260423a';
            const componentPath = `${basePath}components/${componentName}.html?v=${componentVersion}`;
            
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName}`);
            }
            
            const componentHTML = await response.text();
            const targetElement = document.querySelector(targetSelector);
            
            if (targetElement) {
                targetElement.innerHTML = componentHTML;

                if (componentName === 'navbar' && typeof window.refreshAuthUi === 'function') {
                    await window.refreshAuthUi();
                }
                
                // Trigger custom event for component-loaded
                const event = new CustomEvent('component-loaded', {
                    detail: { componentName }
                });
                document.dispatchEvent(event);
                
                // Re-initialize Bootstrap components if needed
                if (window.$ && window.$.fn.tooltip) {
                    $('[data-toggle="tooltip"]').tooltip();
                }
            } else {
                console.warn(`Target element not found: ${targetSelector}`);
            }
        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
        }
    },

    /**
     * Load all standard components
     * @param {Object} options - Configuration options
     */
    loadAllComponents: async function(options = {}) {
        const basePath = options.basePath || '';
        
        // Load components
        await this.loadComponent('navbar', '#navbar-placeholder', { basePath });

        // Guard against stale cached component HTML missing nav items
        this.ensureBottomNavItems();
        
        // Adjust navbar links if this is an admin page
        if (options.isAdminPage) {
            this.adjustNavbarForAdminPage();
        }

        // Set active nav state and mobile page title for all pages
        this.setActiveNavState();
    },

    /**
     * Ensure mobile bottom nav always has the expected 5 items.
     * This protects against stale cached component HTML on mobile Safari.
     */
    ensureBottomNavItems: function() {
        const nav = document.getElementById('tyfit-bottom-nav');
        if (!nav) {
            return;
        }

        const existingItems = nav.querySelectorAll('.tbn-item');
        if (existingItems.length >= 5) {
            return;
        }

        nav.innerHTML = `
            <a href="portal/index.html" class="tbn-item" data-page="home" id="bnav-home">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span>Home</span>
            </a>
            <a href="portal/food_catalog.html" class="tbn-item" data-page="food" id="bnav-food">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>
                <span>Catalog</span>
            </a>
            <a href="portal/diet_chart.html" class="tbn-item" data-page="diet" id="bnav-diet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
                <span>Diet Plan</span>
            </a>
            <a href="#" class="tbn-item" data-page="training" id="bnav-training">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="4" x2="6" y2="20"/><line x1="18" y1="4" x2="18" y2="20"/><line x1="6" y1="12" x2="18" y2="12"/><circle cx="6" cy="4" r="2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="4" r="2"/><circle cx="18" cy="20" r="2"/></svg>
                <span>Training Plan</span>
            </a>
            <a href="profile_edit.html" class="tbn-item" data-page="profile" id="bnav-me">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Me</span>
            </a>
        `;
    },

    /**
     * Adjust all nav links and logos for admin subdirectory (prefix with ../)
     */
    adjustNavbarForAdminPage: function() {
        const prefix = '../';

        // All anchor links in the new nav elements
        const navContainers = [
            document.querySelector('.tyfit-desktop-header'),
            document.querySelector('.tyfit-mobile-header'),
            document.getElementById('tyfit-bottom-nav'),
        ];

        navContainers.forEach(function(container) {
            if (!container) return;
            container.querySelectorAll('a[href]').forEach(function(link) {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('/') && !href.startsWith('..')) {
                    link.setAttribute('href', prefix + href);
                }
            });
        });

        // Adjust logo image src attributes (mobile + desktop)
        ['siteLogo', 'siteLogoDesktop'].forEach(function(id) {
            const img = document.getElementById(id);
            if (img) {
                const src = img.getAttribute('src');
                if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('..')) {
                    img.setAttribute('src', prefix + src);
                }
            }
        });

        // Adjust footer logo link if present
        const footerLogo = document.querySelector('.footer-logo');
        if (footerLogo) {
            const href = footerLogo.getAttribute('href');
            if (href && !href.startsWith('..') && !href.startsWith('http') && !href.startsWith('/')) {
                footerLogo.setAttribute('href', prefix + href);
            }
        }
    },

    /**
     * Map current page filename to a nav page key
     */
    _detectCurrentPage: function() {
        const path = window.location.pathname;
        const file = path.split('/').pop() || 'index.html';
        const pathLower = path.toLowerCase();
        if (pathLower.includes('portal') && (file === 'index.html' || file === '')) return 'home';
        if (file === 'index.html' || file === '') return 'home';
        if (file === 'diet_chart.html') return 'diet';
        if (file === 'exercise_chart.html') return 'exercise';
        if (file === 'food_catalog.html') return 'food';
        if (file === 'profile_edit.html') return 'profile';
        if (file === 'login.html') return null;
        return null;
    },

    /**
     * Page title labels for the mobile header pill
     */
    _pageTitles: {
        home: 'Home',
        diet: 'Diet Chart',
        exercise: 'Exercise',
        food: 'Food Catalog',
        profile: 'Profile',
    },

    /**
     * Set active state on desktop + mobile bottom nav items, and mobile header title
     */
    setActiveNavState: function() {
        const currentPage = this._detectCurrentPage();
        if (!currentPage) return;

        // Desktop nav active
        const desktopLinks = document.querySelectorAll('.tyfit-desktop-nav .tyfit-nav-link');
        desktopLinks.forEach(function(link) {
            if (link.getAttribute('data-page') === currentPage) {
                link.classList.add('active');
            }
        });

        // Mobile bottom nav active
        const bottomLinks = document.querySelectorAll('#tyfit-bottom-nav .tbn-item');
        bottomLinks.forEach(function(link) {
            if (link.getAttribute('data-page') === currentPage) {
                link.classList.add('active');
            }
        });

        // Mobile header page title
        const titleEl = document.getElementById('mobilePageTitle');
        if (titleEl && this._pageTitles[currentPage]) {
            titleEl.textContent = this._pageTitles[currentPage];
        }
    },
};

// Auto-load components on DOM ready if placeholders exist
document.addEventListener('DOMContentLoaded', function() {
    // Check for component placeholders
    const hasPlaceholders = document.getElementById('navbar-placeholder');
    
    if (hasPlaceholders) {
        // Determine if this is an admin page
        const isAdminPage = window.location.pathname.includes('/portal/');
        const basePath = isAdminPage ? '../' : '';
        
        ComponentsLoader.loadAllComponents({
            basePath,
            isAdminPage
        });
    }
});
