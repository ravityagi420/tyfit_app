(function ($) {
    "use strict";
    
    // Initiate the wowjs
    new WOW().init();
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 200) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });
    
    
    // Dropdown on mouse hover
    $(document).ready(function () {
        function toggleNavbarMethod() {
            if ($(window).width() > 992) {
                $('.navbar .dropdown').on('mouseover', function () {
                    $('.dropdown-toggle', this).trigger('click');
                }).on('mouseout', function () {
                    $('.dropdown-toggle', this).trigger('click').blur();
                });
            } else {
                $('.navbar .dropdown').off('mouseover').off('mouseout');
            }
        }
        toggleNavbarMethod();
        $(window).resize(toggleNavbarMethod);
    });


    // Testimonials carousel
    $(".testimonials-carousel").owlCarousel({
        center: true,
        autoplay: true,
        dots: true,
        loop: true,
        responsive: {
            0:{
                items:1
            },
            576:{
                items:1
            },
            768:{
                items:2
            },
            992:{
                items:3
            }
        }
    });
    
    
    // Blogs carousel
    $(".blog-carousel").owlCarousel({
        autoplay: true,
        dots: false,
        loop: true,
        nav : true,
        navText : [
            '<i class="fa fa-angle-left" aria-hidden="true"></i>',
            '<i class="fa fa-angle-right" aria-hidden="true"></i>'
        ],
        responsive: {
            0:{
                items:1
            },
            576:{
                items:1
            },
            768:{
                items:2
            },
            992:{
                items:3
            }
        }
    });
    
    
    // Class filter
    var classIsotope = $('.class-container').isotope({
        itemSelector: '.class-item',
        layoutMode: 'fitRows'
    });

    $('#class-filter li').on('click', function () {
        $("#class-filter li").removeClass('filter-active');
        $(this).addClass('filter-active');
        classIsotope.isotope({filter: $(this).data('filter')});
    });
    
    
    // Portfolio filter
    var portfolioIsotope = $('.portfolio-container').isotope({
        itemSelector: '.portfolio-item',
        layoutMode: 'fitRows'
    });

    $('#portfolio-filter li').on('click', function () {
        $("#portfolio-filter li").removeClass('filter-active');
        $(this).addClass('filter-active');
        portfolioIsotope.isotope({filter: $(this).data('filter')});
    });
    
})(jQuery);

(function ($) {
    "use strict";

    let dialogInitialized = false;

    function ensureDialogModal() {
        if (dialogInitialized) {
            return;
        }

        if (!document.body) {
            return;
        }

        const modalMarkup = `
            <div class="modal fade" id="tyfitDialogModal" tabindex="-1" role="dialog" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content border-0 shadow tyfit-dialog-content">
                        <div class="modal-header tyfit-dialog-header">
                            <h5 class="modal-title" id="tyfitDialogTitle">Notice</h5>
                            <button type="button" class="close tyfit-dialog-close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body tyfit-dialog-body" id="tyfitDialogBody"></div>
                        <div class="modal-footer tyfit-dialog-footer">
                            <button type="button" class="btn btn-outline-secondary tyfit-dialog-btn" id="tyfitDialogCancelBtn" data-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary tyfit-dialog-btn" id="tyfitDialogConfirmBtn">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", modalMarkup);
        dialogInitialized = true;
    }

    function escapeDialogText(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function normalizeDialogOptions(input, defaults) {
        if (typeof input === "string") {
            return {
                ...defaults,
                message: input
            };
        }

        return {
            ...defaults,
            ...(input || {})
        };
    }

    function showBootstrapDialog(options) {
        ensureDialogModal();

        const modalEl = document.getElementById("tyfitDialogModal");
        const titleEl = document.getElementById("tyfitDialogTitle");
        const bodyEl = document.getElementById("tyfitDialogBody");
        const cancelBtn = document.getElementById("tyfitDialogCancelBtn");
        const confirmBtn = document.getElementById("tyfitDialogConfirmBtn");

        if (!modalEl || !titleEl || !bodyEl || !confirmBtn || !$.fn.modal) {
            if (options.showCancel) {
                return Promise.resolve(window.confirm(options.message));
            }

            window.alert(options.message);
            return Promise.resolve(true);
        }

        titleEl.textContent = options.title;
        bodyEl.innerHTML = `<p class="mb-0 tyfit-dialog-message">${escapeDialogText(options.message)}</p>`;
        confirmBtn.textContent = options.confirmText;
        confirmBtn.className = `btn tyfit-dialog-btn ${options.confirmClass}`;
        cancelBtn.className = "btn btn-outline-secondary tyfit-dialog-btn";
        cancelBtn.style.display = options.showCancel ? "inline-block" : "none";
        cancelBtn.textContent = options.cancelText;

        return new Promise((resolve) => {
            let settled = false;

            function cleanup(result) {
                if (settled) {
                    return;
                }

                settled = true;
                confirmBtn.removeEventListener("click", onConfirm);
                $(modalEl).off("hidden.bs.modal", onHidden);
                resolve(result);
            }

            function onConfirm() {
                cleanup(true);
                $(modalEl).modal("hide");
            }

            function onHidden() {
                cleanup(options.showCancel ? false : true);
            }

            confirmBtn.addEventListener("click", onConfirm);
            $(modalEl).off("hidden.bs.modal").on("hidden.bs.modal", onHidden);
            $(modalEl).modal({
                backdrop: true,
                keyboard: true,
                show: true
            });
        });
    }

    window.tyfitDialog = {
        alert(input) {
            const options = normalizeDialogOptions(input, {
                title: "Notice",
                message: "",
                confirmText: "OK",
                cancelText: "Cancel",
                confirmClass: "btn-primary",
                showCancel: false
            });

            return showBootstrapDialog(options);
        },

        confirm(input) {
            const options = normalizeDialogOptions(input, {
                title: "Please Confirm",
                message: "",
                confirmText: "Confirm",
                cancelText: "Cancel",
                confirmClass: "btn-danger",
                showCancel: true
            });

            return showBootstrapDialog(options);
        }
    };
})(jQuery);

