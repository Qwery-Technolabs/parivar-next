import Link from 'next/link';

/**
 * "Old WhatsApp" tab row on the navy header: equal-width tabs, each an icon over a short
 * label (so five tabs still fit a 360px phone), and a bright-orange bar under the active one.
 *
 * The strip sits on a soft fade (a few % of white over the navy, darkening toward the bottom)
 * so it reads as its own band under the title, and the active tab gets a light wash. Measured
 * label contrast: inactive white/75 ≥6.87:1, active white 8.02:1 (AA). Orange is only a 3px bar
 * (5.99:1 on navy), never text. Links, not buttons: each tab is a URL (?tab=). Switching tabs
 * replaces the history entry, so the phone's Back leaves the page instead of replaying tabs.
 *
 * @param {{ tabs: Array<{ key: string, label: string, href: string, count?: number, icon?: React.ComponentType<{className?: string}> }>, active: string }} props
 */
export default function WaTabs({ tabs, active }) {
    return (
        <nav
            className="grid border-t border-white/10 bg-linear-to-b from-white/[0.07] to-black/15"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
            {tabs.map((tab) => {
                const on = tab.key === active;
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        scroll={false}
                        replace
                        aria-current={on ? 'page' : undefined}
                        className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-colors ${
                            on ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        <span className="relative">
                            {Icon && <Icon className="size-4 sm:size-[18px]" />}
                            {tab.count > 0 && (
                                <span className="absolute -right-3 -top-1.5 rounded-full bg-white/20 px-1 text-[9px] font-semibold leading-3.5 tabular-nums">
                                    {tab.count > 99 ? '99+' : tab.count}
                                </span>
                            )}
                        </span>
                        {/* Phones: smaller, untracked labels so five tabs fit without cutting words off. */}
                        <span className="max-w-full truncate text-[10px] font-semibold uppercase sm:text-[11px] sm:tracking-wide">{tab.label}</span>
                        {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-orange" />}
                    </Link>
                );
            })}
        </nav>
    );
}
