'use client';
import { useEffect } from 'react';

/**
 * In the INSTALLED app (opened from the home screen — display-mode standalone, or iOS `navigator.standalone`) the
 * browser's context menu is off: no right-click menu, no long-press menu on links / pictures, so it feels like an
 * app. Text selection stays as it is (long-press still selects; the selection's Copy bar is not the context menu), and
 * fields keep their menu (paste). In a normal browser tab nothing changes. Draws nothing.
 */
export default function NoContextMenu() {
    useEffect(() => {
        const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        if (!installed) return;
        document.documentElement.classList.add('pv-installed');
        const block = (e) => {
            if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
            e.preventDefault();
        };
        document.addEventListener('contextmenu', block);
        return () => {
            document.removeEventListener('contextmenu', block);
            document.documentElement.classList.remove('pv-installed');
        };
    }, []);
    return null;
}
