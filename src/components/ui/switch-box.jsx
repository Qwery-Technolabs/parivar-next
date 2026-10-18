'use client';
import Switch from './switch';

/**
 * An optional part of a form behind a switch ("Open a specific page?", "Send to a specific audience?"): a bordered box
 * with the switch; its fields show only while it is on (and only then are they posted). Two of them sit side by side
 * in a `grid sm:grid-cols-2`.
 * @param {{ label: string, hint?: string, on: boolean, onChange: (v: boolean) => void, children?: React.ReactNode }} props
 */
export default function SwitchBox({ label, hint, on, onChange, children }) {
    return (
        <div className={`min-w-0 rounded-md border px-3 py-2.5 ${on ? 'border-primary/40 bg-accent/30' : 'border-surface-border'}`}>
            <Switch checked={on} onChange={onChange} label={label} />
            {hint && !on && <p className="mt-1 text-xs text-ink-gray">{hint}</p>}
            {on && <div className="mt-2.5 space-y-2">{children}</div>}
        </div>
    );
}
