import Link from 'next/link';

/**
 * "Old WhatsApp" tab row: equal-width tabs on the navy header, uppercase labels, and a
 * bright-orange bar under the active one. Orange is a state colour here (a 3px bar on navy,
 * 5.99:1), never a text colour. Links, not buttons — each tab is a URL (?tab=), so it can
 * be shared and survives a reload.
 * @param {{ tabs: Array<{ key: string, label: string, href: string, count?: number }>, active: string }} props
 */
export default function WaTabs({ tabs, active }) {
    return (
        <nav className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => {
                const on = tab.key === active;
                return (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        scroll={false}
                        aria-current={on ? 'page' : undefined}
                        className={`relative flex h-10 items-center justify-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide ${
                            on ? 'text-white' : 'text-white/70 hover:text-white'
                        }`}
                    >
                        <span className="truncate">{tab.label}</span>
                        {tab.count > 0 && (
                            <span className="rounded-full bg-white/15 px-1.5 text-[10px] tabular-nums">{tab.count}</span>
                        )}
                        {on && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-brand-orange" />}
                    </Link>
                );
            })}
        </nav>
    );
}
