/**
 * Scroll Reveal — IntersectionObserver-based entrance animations.
 * Add class "reveal" to any element. It will animate in when scrolled into view.
 * Optional data-delay="200" for staggered reveals.
 */
(function () {
    const THRESHOLD = 0.15;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    const delay = el.dataset.delay || 0;
                    setTimeout(() => el.classList.add('revealed'), delay);
                    observer.unobserve(el);
                }
            });
        },
        { threshold: THRESHOLD, rootMargin: '0px 0px -40px 0px' }
    );

    // Observe all .reveal elements once DOM is ready
    function init() {
        document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
