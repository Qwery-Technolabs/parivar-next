'use client';
import { CheckCircle2, Download, ExternalLink, Loader2, MoreVertical, PlusSquare, Share } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useT } from '@/lib/i18n/client';

/** What this browser is — decided once on the client (the server cannot know). */
function detect() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(ua);
    // In-app browsers (WhatsApp, Instagram, Facebook, Telegram … ) cannot install a web app.
    const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Telegram|Snapchat|; wv\)/i.test(ua);
    const iosSafari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) && !inApp;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return { ios, android, inApp, iosSafari, standalone };
}
const noop = () => () => {};
const getEnv = () => JSON.stringify(detect());
const getServerEnv = () => '';

/**
 * /install — one link to send anyone: it installs the app the way their phone allows, or opens it.
 *   Opened inside the installed app (standalone) → straight to the dashboard.
 *   Android Chrome / Edge / Samsung / desktop Chrome: "Install app" → the browser's own install prompt.
 *   Android in-app browser (WhatsApp …): "Open in Chrome" (an intent link), where it can be installed.
 *   iPhone / iPad Safari: the three Add to Home Screen steps (Apple allows no install button);
 *   other iOS browsers / in-app: "open this link in Safari" first.
 *   Already installed (Android: getInstalledRelatedApps): "Open the app".
 * @param {{ samaj: string, icon: string }} props
 */
export default function InstallApp({ samaj, icon }) {
    const { t } = useT();
    const router = useRouter();
    const raw = useSyncExternalStore(noop, getEnv, getServerEnv);
    const env = raw ? JSON.parse(raw) : null;
    const [prompt, setPrompt] = useState(null);
    const [installed, setInstalled] = useState(false);
    const [working, setWorking] = useState(false);

    // Inside the installed app already: go to the dashboard.
    useEffect(() => {
        if (env?.standalone) router.replace('/');
    }, [env?.standalone, router]);

    useEffect(() => {
        // The install prompt Chrome / Edge offer once the page qualifies; kept for the button.
        const onPrompt = (e) => {
            e.preventDefault();
            setPrompt(e);
        };
        const onInstalled = () => {
            setInstalled(true);
            setPrompt(null);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        // The worker the app already uses for notifications (no caching): some browsers want one to offer installing.
        navigator.serviceWorker
            ?.getRegistration('/')
            .then((r) => r || navigator.serviceWorker.register('/sw.js', { scope: '/' }))
            .catch(() => {});
        // Android Chrome: is the app already on this phone? (manifest related_applications → this site)
        navigator
            .getInstalledRelatedApps?.()
            .then((apps) => {
                if (apps?.length) setInstalled(true);
            })
            .catch(() => {});
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    const install = async () => {
        if (!prompt) return;
        setWorking(true);
        prompt.prompt();
        const choice = await prompt.userChoice.catch(() => null);
        setWorking(false);
        if (choice?.outcome === 'accepted') setInstalled(true);
        setPrompt(null);
    };

    const btn =
        'inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90';
    const step = (n, children) => (
        <li className="flex items-start gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary tabular-nums">{n}</span>
            <span className="min-w-0 pt-0.5 text-sm text-ink">{children}</span>
        </li>
    );
    const here = typeof window === 'undefined' ? '' : window.location.href;
    const chromeIntent = typeof window === 'undefined' ? '' : `intent://${window.location.host}/install#Intent;scheme=https;package=com.android.chrome;end`;

    let body;
    if (!env || env.standalone) {
        body = (
            <p className="flex justify-center py-6">
                <Loader2 className="size-5 animate-spin text-ink-gray" />
            </p>
        );
    } else if (installed) {
        body = (
            <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                <p className="text-sm text-ink">{t('install.installed')}</p>
                <Link href="/" className={btn}>
                    {t('install.open')}
                </Link>
            </div>
        );
    } else if (env.android && env.inApp) {
        body = (
            <div className="space-y-3">
                <p className="text-sm text-ink">{t('install.inAppAndroid')}</p>
                <a href={chromeIntent} className={btn}>
                    <ExternalLink className="size-4" /> {t('install.openInChrome')}
                </a>
            </div>
        );
    } else if (env.ios && !env.iosSafari) {
        body = (
            <div className="space-y-3">
                <p className="text-sm text-ink">{t('install.iosOpenSafari')}</p>
                <button type="button" onClick={() => navigator.clipboard?.writeText(here).catch(() => {})} className={btn}>
                    {t('install.copyLink')}
                </button>
            </div>
        );
    } else if (env.ios) {
        body = (
            <ol className="space-y-3">
                {step(
                    1,
                    <>
                        {t('install.iosStep1')} <Share className="inline size-4 align-text-bottom text-primary" />
                    </>,
                )}
                {step(
                    2,
                    <>
                        {t('install.iosStep2')} <PlusSquare className="inline size-4 align-text-bottom text-primary" />
                    </>,
                )}
                {step(3, t('install.iosStep3'))}
            </ol>
        );
    } else if (prompt) {
        body = (
            <button type="button" onClick={install} disabled={working} className={`${btn} disabled:opacity-60`}>
                {working ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} {t('install.install')}
            </button>
        );
    } else {
        // Chrome has not offered its prompt (yet, or already dismissed): the browser menu does the same.
        body = (
            <ol className="space-y-3">
                {step(
                    1,
                    <>
                        {t('install.menuStep1')} <MoreVertical className="inline size-4 align-text-bottom text-primary" />
                    </>,
                )}
                {step(2, t('install.menuStep2'))}
                {step(3, t('install.menuStep3'))}
            </ol>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
                {/* The home-screen icon itself (Settings → General logo). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={icon} alt="" width={72} height={72} className="size-18 rounded-2xl shadow-md" />
                <h1 className="mt-3 text-lg font-semibold text-primary">{samaj}</h1>
                <p className="mt-1 text-sm text-ink-gray">{t('install.subtitle')}</p>
            </div>
            <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm">{body}</div>
            <p className="text-center text-xs text-ink-gray">
                <Link href="/" className="font-medium text-primary hover:underline">
                    {t('install.continueBrowser')}
                </Link>
            </p>
        </div>
    );
}
