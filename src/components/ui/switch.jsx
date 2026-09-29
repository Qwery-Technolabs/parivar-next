'use client';

/**
 * DESIGN.md §6 — a button role="switch", used instead of a checkbox everywhere.
 * `name` renders a hidden input so it works inside a plain <form action>.
 * @param {{ checked: boolean, onChange: (v: boolean) => void, label?: React.ReactNode, title?: string, name?: string, disabled?: boolean, color?: string }} props
 */
export default function Switch({ checked, onChange, label, title, name, disabled = false, color = 'text-primary' }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            title={title}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`inline-flex cursor-pointer items-center gap-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${color}`}
        >
            <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                    checked ? 'bg-brand-orange' : 'bg-surface-border'
                }`}
            >
                <span
                    className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                        checked ? 'translate-x-3.5' : 'translate-x-0.5'
                    }`}
                />
            </span>
            {label}
            {name && <input type="hidden" name={name} value={checked ? '1' : '0'} />}
        </button>
    );
}
