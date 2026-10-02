'use client';
import {
    Bell,
    CalendarDays,
    ChevronsLeft,
    ChevronsRight,
    Droplet,
    HandCoins,
    HeartHandshake,
    History,
    Home,
    LogOut,
    Menu,
    Network,
    Settings,
    UserCircle,
    Users,
    UsersRound,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
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
    tree: Network,
    group: UsersRound,
    blood: Droplet,
    fund: HandCoins,
    matrimony: HeartHandshake,
    calendar: CalendarDays,
    audit: History,
    settings: Settings,
};

function isActive(pathname, href) {
    return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Active for this item — unless a more specific item (item.exclude, e.g. My family tree inside /members) is. */
function itemActive(pathname, item) {
    return isActive(pathname, item.href) && !(item.exclude ?? []).some((h) => isActive(pathname, h));
}

function NavItem({ item, pathname, collapsed, onNavigate, child = false }) {
    const Icon = ICONS[item.icon];
    const active = itemActive(pathname, item);
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
            {/* Active: the icon joins the orange bar (orange-400 on navy passes 3:1 for icons). */}
            <Icon className={`size-4 shrink-0 ${active ? 'text-orange-400' : ''}`} />
            {!collapsed && <span className="min-w-0 truncate">{item.label}</span>}
        </Link>
    );
}

// Mobile bottom bar: the main sections, in this order (only those this person can see).
const BOTTOM_TABS = ['/', '/groups', '/fundraise', '/blood', '/members'];

/**
 * Mobile only, and only on the section home pages themselves. Inside a group, a fundraise, a
 * discussion, etc. it steps aside (like a chat app) and the header's back link takes over.
 */
function BottomNav({ sections, pathname }) {
    const items = sections.flatMap((s) => s.items);
    const tabs = BOTTOM_TABS.map((href) => items.find((i) => i.href === href)).filter(Boolean);
    if (tabs.length < 2 || !BOTTOM_TABS.includes(pathname)) return null;
    return (
        <nav className="flex shrink-0 border-t border-surface-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            {tabs.map((item) => {
                const Icon = ICONS[item.icon];
                const active = itemActive(pathname, item);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                            active ? 'font-semibold text-primary' : 'font-medium text-ink-gray hover:text-primary'
                        }`}
                    >
                        {/* Active: a warm orange pill behind the icon (orange-600 on orange-100 ≥3:1 for
                            icons), bold navy label, and the sidebar's orange bar on top. */}
                        {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand-orange" />}
                        <span
                            className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                                active ? 'bg-orange-100 text-orange-600' : ''
                            }`}
                        >
                            <Icon className="size-5 shrink-0" />
                        </span>
                        <span className="max-w-full truncate px-1">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
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
                            <p className="mb-1 px-3 pt-[5px] text-[11px] font-medium uppercase tracking-wide text-white/60">{s.title}</p>
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
    // The mobile drawer is driven by a hidden checkbox + CSS (peer-checked), so the menu button
    // works even before the page's JS has loaded (slow phone, first visit). React only closes it.
    const drawerToggle = useRef(null);
    const closeDrawer = () => {
        if (drawerToggle.current) drawerToggle.current.checked = false;
    };
    // Initial state comes from a cookie read on the server, so the first paint already has
    // the right width — localStorage would render expanded and then jump.
    const [collapsed, setCollapsed] = useState(initialCollapsed);

    function toggleCollapsed() {
        const next = !collapsed;
        setCollapsed(next);
        document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
    }

    // The logo row carries the same faint line as the header's bottom edge, so both line up.
    const brand = (small, bordered = true, fill = false) => (
        <Link
            href="/"
            title={labels.app}
            className={`flex h-12 items-center gap-2.5 text-white ${fill ? 'min-w-0 flex-1' : 'shrink-0'} ${bordered ? 'border-b border-white/10' : ''} ${small ? 'justify-center' : 'px-4'}`}
        >
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

            {/* Mobile drawer — always expanded; collapsing is a desktop affordance. The checkbox is the
                open/closed state (see drawerToggle); the menu button and the backdrop are its labels.
                Closed = invisible (no focus, no clicks, hidden from readers) once the slide-out ends. */}
            <input ref={drawerToggle} id="nav-drawer" type="checkbox" aria-label={labels.menu} className="peer sr-only lg:hidden" />
            <div className="invisible fixed inset-0 z-40 transition-[visibility] duration-200 peer-checked:visible lg:hidden">
                <label
                    htmlFor="nav-drawer"
                    aria-hidden
                    className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-200 [.peer:checked~div_&]:opacity-100"
                />
                {/* Any link inside (the logo too) closes it on the way out. */}
                <aside
                    onClick={(e) => e.target.closest?.('a') && closeDrawer()}
                    className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] -translate-x-full flex-col bg-brand-navy shadow-xl transition-transform duration-200 ease-out motion-reduce:transition-none [.peer:checked~div_&]:translate-x-0"
                >
                    {/* The name truncates so a long Samaj name never runs under the close button. */}
                    <div className="flex items-center gap-1 border-b border-white/10 pr-2">
                        {brand(false, false, true)}
                        <label
                            htmlFor="nav-drawer"
                            aria-label={labels.close}
                            title={labels.close}
                            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/80 hover:bg-brand-navy-soft hover:text-white"
                        >
                            <X className="size-5" />
                        </label>
                    </div>
                    <SidebarNav sections={sections} footer={footer} pathname={pathname} />
                </aside>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                {/* A page with a back link (group, fundraise) shows only that on phones — no hamburger, like a chat app. */}
                <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-brand-navy px-3 text-white sm:px-5 [&:has(#page-back-slot>*)_.nav-burger]:hidden">
                    {/* A label for the drawer checkbox: opens it with or without JS. */}
                    <label
                        htmlFor="nav-drawer"
                        aria-label={labels.menu}
                        title={labels.menu}
                        className="nav-burger flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-white hover:bg-brand-navy-soft lg:hidden"
                    >
                        <Menu className="size-5" />
                    </label>
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
                <main id="content" className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-content">
                    {/* Full width with slim side gutters: tables and the discussion get the room.
                        Forms keep their own max-w-* so lines stay readable. */}
                    <div className="w-full px-2 py-3 sm:px-3 lg:px-4">{children}</div>
                </main>
                <BottomNav sections={sections} pathname={pathname} />
            </div>
        </div>
    );
}
