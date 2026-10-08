// ============================================================
// Abhyas Quiz Portal — Shared Utilities
// ============================================================

const Utils = {

    // ── ID Generation ──────────────────────────────────────
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // ── Password Hashing (SHA-256) ─────────────────────────
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + '_abhyas_2024_salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ── Date Formatting ────────────────────────────────────
    formatDate(timestamp) {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    },

    formatDateShort(timestamp) {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    },

    // ── Time Formatting ────────────────────────────────────
    formatTime(seconds) {
        if (!seconds && seconds !== 0) return '—';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    },

    formatTimer(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    // ── Toast Notifications ────────────────────────────────
    showToast(message, type = 'info') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        // Auto-dismiss
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 350);
        }, 3500);
    },

    // ── Loader ─────────────────────────────────────────────
    showLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('active');
    },

    hideLoader() {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.remove('active');
    },

    // ── SPA View Management ────────────────────────────────
    showView(viewId) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(viewId);
        if (target) {
            target.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Update nav link active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.view === viewId) {
                link.classList.add('active');
            }
        });
    },

    // ── Array Shuffle (Fisher-Yates) ───────────────────────
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    // ── Percentage Calculation ─────────────────────────────
    percentage(obtained, total) {
        if (!total || total === 0) return 0;
        return Math.round((obtained / total) * 100);
    },

    // ── Grade Calculation ──────────────────────────────────
    getGrade(pct) {
        if (pct >= 90) return { grade: 'A+', color: '#16a34a', label: 'Outstanding' };
        if (pct >= 80) return { grade: 'A',  color: '#22c55e', label: 'Excellent' };
        if (pct >= 70) return { grade: 'B+', color: '#65a30d', label: 'Very Good' };
        if (pct >= 60) return { grade: 'B',  color: '#ca8a04', label: 'Good' };
        if (pct >= 50) return { grade: 'C',  color: '#ea580c', label: 'Average' };
        if (pct >= 40) return { grade: 'D',  color: '#dc2626', label: 'Below Average' };
        return { grade: 'F',  color: '#991b1b', label: 'Fail' };
    },

    // ── Excel Export (uses SheetJS) ────────────────────────
    exportToExcel(data, filename) {
        if (typeof XLSX === 'undefined') {
            this.showToast('Excel library not loaded', 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);

        // Auto-size columns
        const colWidths = Object.keys(data[0] || {}).map(key => ({
            wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)).toString().length + 4
        }));
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        XLSX.writeFile(wb, `${filename}.xlsx`);
    },

    // ── HTML Escaping ──────────────────────────────────────
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ── Debounce ───────────────────────────────────────────
    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    // ── Custom Confirm Dialog ──────────────────────────────
    confirmAction(message) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-dialog">
                    <div class="confirm-icon">⚠</div>
                    <p class="confirm-message">${message}</p>
                    <div class="confirm-actions">
                        <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
                        <button class="btn btn-primary" id="confirmOk">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
            requestAnimationFrame(() => overlay.classList.add('active'));

            const cleanup = () => {
                overlay.classList.remove('active');
                setTimeout(() => overlay.remove(), 200);
            };

            document.getElementById('confirmOk').onclick = () => { cleanup(); resolve(true); };
            document.getElementById('confirmCancel').onclick = () => { cleanup(); resolve(false); };
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) { cleanup(); resolve(false); }
            });
        });
    },

    // ── Question Type Labels ───────────────────────────────
    typeLabel(type) {
        const labels = {
            'mcq': 'MCQ',
            'oneword': 'One Word',
            'short': 'Short Answer',
            'long': 'Long Answer'
        };
        return labels[type] || type;
    },

    // ── Status Badge Class ─────────────────────────────────
    statusBadge(status) {
        const map = {
            'draft': 'badge-draft',
            'live': 'badge-live',
            'completed': 'badge-completed',
            'auto-graded': 'badge-pending',
            'evaluated': 'badge-evaluated',
            'released': 'badge-released'
        };
        return map[status] || 'badge-draft';
    },

    // ── Truncate Text ──────────────────────────────────────
    truncate(text, maxLen = 50) {
        if (!text) return '';
        return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
    }
};
