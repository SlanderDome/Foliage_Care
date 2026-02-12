/**
 * Toast Notification System
 * Usage: window.toast.success('Message'), .error(), .warning(), .info()
 */
(function () {
    const ICONS = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle',
    };

    const DURATIONS = { success: 3500, error: 5000, warning: 4000, info: 3500 };

    // Create container
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);

    function show(type, message, duration) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const dur = duration || DURATIONS[type];

        toast.innerHTML = `
      <div class="toast-icon"><i class="${ICONS[type]}"></i></div>
      <div class="toast-body">
        <p class="toast-msg">${message}</p>
      </div>
      <div class="toast-progress">
        <div class="toast-progress-bar" style="animation-duration:${dur}ms"></div>
      </div>
      <button class="toast-close" aria-label="close">&times;</button>
    `;

        container.appendChild(toast);

        // Trigger entrance animation
        requestAnimationFrame(() => toast.classList.add('toast-visible'));

        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => dismiss(toast));

        // Auto dismiss
        const timer = setTimeout(() => dismiss(toast), dur);
        toast._timer = timer;
    }

    function dismiss(el) {
        clearTimeout(el._timer);
        el.classList.remove('toast-visible');
        el.classList.add('toast-exit');
        el.addEventListener('animationend', () => el.remove());
    }

    window.toast = {
        success: (msg, dur) => show('success', msg, dur),
        error: (msg, dur) => show('error', msg, dur),
        warning: (msg, dur) => show('warning', msg, dur),
        info: (msg, dur) => show('info', msg, dur),
    };
})();
