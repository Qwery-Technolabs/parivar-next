'use client';
import {
    Bell,
    CalendarDays,
    Droplet,
    HandCoins,
    History,
    Home,
    Languages,
    LogOut,
    Menu,
    Settings,
    UserCircle,
    Users,
    UsersRound,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { logout, setLanguage } from '@/app/actions/session';
import { Popover } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

// Icons are mapped here rather than passed from the server layout: a component
// reference cannot cross the server→client boundary as a prop.
const ICONS = {
    home: Home,
    users: Users,
    group: UsersRound,
    blood: Droplet,
    fund: HandCoins,
    calendar: CalendarDays,
    audit: History,
    settings: Settings,
};

function isActive(pathname, href) {
    return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ nav, pathname, onNavigate }) {
    return (
        <nav className="flex flex-col gap-0.5 px-2">
            {nav.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
                            active ? 'bg-brand-navy-soft text-white' : 'text-white/80 hover:bg-brand-navy-soft hover:text-white'
                        }`}
                    >
                        {/* Orange is a state colour on navy (5.99:1) — a bar, never text on white. */}
                        {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-orange" />}
                        <Icon className="size-4 shrink-0" />
                        <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

function LanguageToggle({ label }) {
    const { locale } = useT();
    const other = locale === 'gu' ? 'en' : 'gu';
    return (
        <form action={setLanguage}>
            <input type="hidden" name="locale" value={other} />
            <button
                type="submit"
                title={label}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 text-sm font-medium text-primary hover:bg-accent"
            >
                <Languages className="size-4 text-ink-gray" />
                <span lang={other}>{other === 'gu' ? 'ગુજરાતી' : 'English'}</span>
            </button>
        </form>
    );
}

export default function AppShell({ nav, user, labels, unread = 0, children }) {
    const pathname = usePathname();
    const [drawer, setDrawer] = useState(false);

    // Close the drawer on navigation (render-time, not an effect — DESIGN.md §7).
    const [seenPath, setSeenPath] = useState(pathname);
    if (seenPath !== pathname) {
        setSeenPath(pathname);
        if (drawer) setDrawer(false);
    }

    const brand = (
        <Link href="/" className="flex h-14 items-center gap-2.5 px-4 text-white">
            <span className="flex size-8 items-center justify-center rounded-md bg-white/10">
                <Users className="size-4" />
            </span>
            <span className="text-base font-semibold">{labels.app}</span>
        </Link>
    );

    return (
        <div className="flex h-dvh overflow-hidden">
            {/* Desktop sidebar */}
            <aside className="hidden w-60 shrink-0 flex-col bg-brand-navy lg:flex">
                {brand}
                <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                    <NavLinks nav={nav} pathname={pathname} />
                </div>
            </aside>

            {/* Mobile drawer */}
            {drawer && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label={labels.menu}
                        onClick={() => setDrawer(false)}
                        className="absolute inset-0 bg-black/30"
                    />
                    <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-brand-navy shadow-xl">
                        <div className="flex items-center justify-between pr-2">
                            {brand}
                            <button
                                type="button"
                                onClick={() => setDrawer(false)}
                                aria-label={labels.menu}
                                className="flex size-9 items-center justify-center rounded-md text-white/80 hover:bg-brand-navy-soft"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
                            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setDrawer(false)} />
                        </div>
                    </aside>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-14 shrink-0 items-center gap-2 border-b border-surface-border bg-white px-3 sm:px-6">
                    <button
                        type="button"
                        onClick={() => setDrawer(true)}
                        aria-label={labels.menu}
                        className="flex size-9 items-center justify-center rounded-md text-primary hover:bg-accent lg:hidden"
                    >
                        <Menu className="size-5" />
                    </button>
                    <span className="text-base font-semibold text-primary lg:hidden">{labels.app}</span>
                    <div className="ml-auto flex items-center gap-2">
                        <Link
                            href="/notifications"
                            aria-label={unread ? `${labels.notifications} (${unread})` : labels.notifications}
                            aria-current={pathname === '/notifications' ? 'page' : undefined}
                            className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-primary hover:bg-accent"
                        >
                            <Bell className="size-5" />
                            {/* A count, capped: "9+" still says "go look" without a 3-digit pill. */}
                            {unread > 0 && (
                                <span
                                    aria-hidden
                                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums leading-none text-white ring-2 ring-white"
                                >
                                    {unread > 9 ? '9+' : unread}
                                </span>
                            )}
                        </Link>
                        <LanguageToggle label={labels.language} />
                        <Popover
                            width="w-56"
                            trigger={({ open, toggle, id }) => (
                                <button
                                    id={id}
                                    type="button"
                                    onClick={toggle}
                                    aria-haspopup="menu"
                                    aria-expanded={open}
                                    className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-left hover:bg-accent"
                                >
                                    <UserCircle className="size-6 shrink-0 text-primary" />
                                    <span className="hidden min-w-0 sm:block">
                                        <span className="block max-w-40 truncate text-sm font-medium text-primary">{user.name}</span>
                                        <span className="block text-[11px] uppercase tracking-wide text-ink-gray">{user.role}</span>
                                    </span>
                                </button>
                            )}
                        >
                            <div className="border-b border-surface-border px-3 py-2 sm:hidden">
                                <p className="truncate text-sm font-medium text-primary">{user.name}</p>
                                <p className="text-[11px] uppercase tracking-wide text-ink-gray">{user.role}</p>
                            </div>
                            <Link
                                role="menuitem"
                                href="/profile"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent"
                            >
                                <UserCircle className="size-4 text-ink-gray" /> {labels.profile}
                            </Link>
                            <div className="my-1 border-t border-surface-border" />
                            <form action={logout}>
                                <button
                                    role="menuitem"
                                    type="submit"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                                >
                                    <LogOut className="size-4" /> {labels.logout}
                                </button>
                            </form>
                        </Popover>
                    </div>
                </header>
                <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-login/40">
                    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</div>
                </main>
            </div>
        </div>
    );
}
