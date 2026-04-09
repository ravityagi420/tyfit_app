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
            const componentPath = `${basePath}components/${componentName}.html`;
            
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName}`);
            }
            
            const componentHTML = await response.text();
            const targetElement = document.querySelector(targetSelector);
            
            if (targetElement) {
                targetElement.innerHTML = componentHTML;
                
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
        await this.loadComponent('header-top', '#header-top-placeholder', { basePath });
        await this.loadComponent('navbar', '#navbar-placeholder', { basePath });
        await this.loadComponent('footer', '#footer-placeholder', { basePath });
        
        // Adjust navbar links if this is an admin page
        if (options.isAdminPage) {
            this.adjustNavbarForAdminPage();
        }
    },

    /**
     * Adjust navbar for admin pages
     */
    adjustNavbarForAdminPage: function() {
        // Adjust relative paths for admin subdirectory
        const navbar = document.getElementById('navbarCollapse');
        if (navbar) {
            const links = navbar.querySelectorAll('a');
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('/')) {
                    // Add ../ to navigate up from admin directory
                    if (!href.startsWith('..')) {
                        link.setAttribute('href', '../' + href);
                    }
                }
            });
        }

        // Adjust footer links
        const footer = document.querySelector('.footer-logo');
        if (footer) {
            const href = footer.getAttribute('href');
            if (href && !href.startsWith('..')) {
                footer.setAttribute('href', '../' + href);
            }
        }
    },

    /**
     * Show/hide login/logout buttons based on auth state
     * @param {boolean} isLoggedIn - Whether user is logged in
     */
    updateAuthButtons: function(isLoggedIn) {
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        const adminLink = document.getElementById('adminLink');
        
        if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'inline-block';
        if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'inline-block' : 'none';
        if (adminLink) adminLink.style.display = isLoggedIn ? 'inline-block' : 'none';
    }
};

// Auto-load components on DOM ready if placeholders exist
document.addEventListener('DOMContentLoaded', function() {
    // Check for component placeholders
    const hasPlaceholders = document.getElementById('header-top-placeholder') || 
                           document.getElementById('navbar-placeholder') || 
                           document.getElementById('footer-placeholder');
    
    if (hasPlaceholders) {
        // Determine if this is an admin page
        const isAdminPage = window.location.pathname.includes('/admin/');
        const basePath = isAdminPage ? '../' : '';
        
        ComponentsLoader.loadAllComponents({
            basePath,
            isAdminPage
        });
    }
});
