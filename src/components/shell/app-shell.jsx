'use client';
import {
    Bell,
    CalendarDays,
    ChevronsLeft,
    ChevronsRight,
    Droplet,
    HandCoins,
    History,
    Home,
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
import { logout } from '@/app/actions/session';
import { Popover } from '@/components/ui/popover';
import { BACK_SLOT_ID } from './header-back';
import SamajLogo from './samaj-logo';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';

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

function NavItem({ item, pathname, collapsed, onNavigate, child = false }) {
    const Icon = ICONS[item.icon];
    const active = isActive(pathname, item.href);
    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            // Collapsed, the label is gone — title gives a hover name and aria-label a spoken one.
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={`relative flex h-9 items-center gap-2.5 rounded-md text-sm font-medium transition-colors ${
                collapsed ? 'justify-center px-0' : child ? 'pl-9 pr-3' : 'px-3'
            } ${active ? 'bg-brand-navy-soft text-white' : 'text-white/80 hover:bg-brand-navy-soft hover:text-white'}`}
        >
            {/* Orange is a state colour on navy (5.99:1) — a bar, never text on white. */}
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-orange" />}
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
        </Link>
    );
}

/** Sections with titles, and a footer group (Settings) pinned to the bottom. */
function SidebarNav({ sections, footer, pathname, collapsed = false, onNavigate }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2 py-2">
                {sections.map((s) => (
                    <div key={s.key ?? s.title}>
                        {/* An untitled section (Home) needs no caption or divider. */}
                        {!s.title ? null : collapsed ? (
                            <div aria-hidden className="mx-3 mb-2 border-t border-white/10" />
                        ) : (
                            // white/60 on navy is 6.2:1 — a caption, readable without shouting.
                            <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wide text-white/60">{s.title}</p>
                        )}
                        <div className="flex flex-col gap-0.5">
                            {s.items.map((item) => (
                                <div key={item.href} className="flex flex-col gap-0.5">
                                    <NavItem item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
                                    {item.children?.map((c) => (
                                        <NavItem key={c.href} item={c} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} child />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>
            <div className="flex flex-col gap-0.5 border-t border-white/10 px-2 py-2">
                {footer.map((item) => (
                    <NavItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
                ))}
            </div>
        </div>
    );
}

/**
 * @param {{ sections: Array<{title: string, items: any[]}>, footer: any[], user: {name: string, role: string},
 *           labels: Record<string, string>, unread?: number, initialCollapsed?: boolean, children: React.ReactNode }} props
 */
export default function AppShell({ sections, footer, user, labels, logo = {}, unread = 0, initialCollapsed = false, children }) {
    const pathname = usePathname();
    const [drawer, setDrawer] = useState(false);
    // Initial state comes from a cookie read on the server, so the first paint already has
    // the right width — localStorage would render expanded and then jump.
    const [collapsed, setCollapsed] = useState(initialCollapsed);

    // Close the drawer on navigation (render-time, not an effect — DESIGN.md §7).
    const [seenPath, setSeenPath] = useState(pathname);
    if (seenPath !== pathname) {
        setSeenPath(pathname);
        if (drawer) setDrawer(false);
    }

    function toggleCollapsed() {
        const next = !collapsed;
        setCollapsed(next);
        document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
    }

    const brand = (small) => (
        <Link href="/" title={labels.app} className={`flex h-12 shrink-0 items-center gap-2.5 text-white ${small ? 'justify-center' : 'px-4'}`}>
            <SamajLogo settings={logo} name={labels.app} />
            {!small && <span className="min-w-0 truncate text-base font-semibold">{labels.app}</span>}
        </Link>
    );

    return (
        <div className="flex h-dvh overflow-hidden">
            {/* Desktop sidebar */}
            <aside
                className={`relative hidden shrink-0 flex-col border-r border-white/10 bg-brand-navy transition-[width] duration-150 lg:flex ${
                    collapsed ? 'w-14' : 'w-56'
                }`}
            >
                {brand(collapsed)}
                {/* Collapse toggle: a small round button beside the logo, straddling the sidebar's
                    edge (half in, half out) so it costs no row of its own. z-30 keeps it above
                    the header, which comes later in the DOM. */}
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-expanded={!collapsed}
                    aria-label={collapsed ? labels.expand : labels.collapse}
                    title={collapsed ? labels.expand : labels.collapse}
                    className="absolute -right-3 top-3 z-30 flex size-6 items-center justify-center rounded-full border border-surface-border bg-white text-brand-navy shadow-sm hover:bg-accent"
                >
                    {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
                </button>
                <SidebarNav sections={sections} footer={footer} pathname={pathname} collapsed={collapsed} />
            </aside>

            {/* Mobile drawer — always expanded; collapsing is a desktop affordance */}
            {drawer && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button type="button" aria-label={labels.menu} onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/30" />
                    <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-brand-navy shadow-xl">
                        <div className="flex items-center justify-between pr-2">
                            {brand(false)}
                            <button
                                type="button"
                                onClick={() => setDrawer(false)}
                                aria-label={labels.menu}
                                className="flex size-9 items-center justify-center rounded-md text-white/80 hover:bg-brand-navy-soft"
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <SidebarNav sections={sections} footer={footer} pathname={pathname} onNavigate={() => setDrawer(false)} />
                    </aside>
                </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-brand-navy px-3 text-white sm:px-5">
                    <button
                        type="button"
                        onClick={() => setDrawer(true)}
                        aria-label={labels.menu}
                        className="flex size-9 items-center justify-center rounded-md text-white hover:bg-brand-navy-soft lg:hidden"
                    >
                        <Menu className="size-5" />
                    </button>
                    {/* Page "back" links portal in here (HeaderBack): right of the collapse arrow on desktop. */}
                    <div id={BACK_SLOT_ID} className="flex min-w-0 items-center empty:hidden lg:-ml-1" />
                    <span className="min-w-0 truncate text-base font-semibold lg:hidden">{labels.app}</span>
                    <div className="ml-auto flex items-center gap-2">
                        <Link
                            href="/notifications"
                            aria-label={unread ? `${labels.notifications} (${unread})` : labels.notifications}
                            aria-current={pathname === '/notifications' ? 'page' : undefined}
                            className="relative flex size-9 shrink-0 items-center justify-center rounded-md text-white hover:bg-brand-navy-soft"
                        >
                            <Bell className="size-5" />
                            {/* A count, capped: "9+" still says "go look" without a 3-digit pill. */}
                            {unread > 0 && (
                                <span
                                    aria-hidden
                                    className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white tabular-nums ring-2 ring-brand-navy"
                                >
                                    {unread > 9 ? '9+' : unread}
                                </span>
                            )}
                        </Link>
                        {/* Calendar sits beside the bell: both answer "what's coming up". */}
                        <Link
                            href="/calendar"
                            aria-label={labels.calendar}
                            title={labels.calendar}
                            aria-current={isActive(pathname, '/calendar') ? 'page' : undefined}
                            className={`relative flex size-9 shrink-0 items-center justify-center rounded-md text-white hover:bg-brand-navy-soft ${
                                isActive(pathname, '/calendar') ? 'bg-brand-navy-soft' : ''
                            }`}
                        >
                            <CalendarDays className="size-5" />
                        </Link>
                        {/* A light divider: the tools (bell, calendar) on one side, the person on the other. */}
                        <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-white/25" />
                        <Popover
                            width="w-56"
                            trigger={({ open, toggle, id }) => (
                                <button
                                    id={id}
                                    type="button"
                                    onClick={toggle}
                                    aria-haspopup="menu"
                                    aria-expanded={open}
                                    className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-left hover:bg-brand-navy-soft"
                                >
                                    <UserCircle className="size-6 shrink-0 text-white" />
                                    <span className="hidden min-w-0 sm:block">
                                        <span className="block max-w-40 truncate text-sm font-medium text-white">{user.name}</span>
                                        {/* white/70 on navy: 7.34:1 */}
                                        <span className="block text-[11px] uppercase tracking-wide text-white/70">{user.role}</span>
                                    </span>
                                </button>
                            )}
                        >
                            <div className="border-b border-surface-border px-3 py-2 sm:hidden">
                                <p className="truncate text-sm font-medium text-primary">{user.name}</p>
                                <p className="text-[11px] uppercase tracking-wide text-ink-gray">{user.role}</p>
                            </div>
                            <Link role="menuitem" href="/settings" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-accent">
                                <Settings className="size-4 text-ink-gray" /> {labels.profile}
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
                <main id="content" className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-login/40">
                    {/* Full width with slim side gutters: tables and the discussion get the room.
                        Forms keep their own max-w-* so lines stay readable. */}
                    <div className="w-full px-2 py-3 sm:px-3 lg:px-4">{children}</div>
                </main>
            </div>
        </div>
    );
}
