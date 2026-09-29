'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { selectInput } from '@/components/ui/field';

/** DESIGN.md §6: past ~5 options a segmented control wraps into a block — use a select. Live: one change = one intent. */
export default function EntityFilter({ value, options, allLabel, label }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();

    function onChange(e) {
        const params = new URLSearchParams(searchParams.toString());
        if (e.target.value) params.set('entity', e.target.value);
        else params.delete('entity');
        params.delete('page');
        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }

    return (
        <label className={`mb-3 inline-flex items-center gap-2 text-xs font-medium text-ink-gray ${pending ? 'cursor-wait opacity-70' : ''}`}>
            {label}
            <select value={value} onChange={onChange} disabled={pending} className={`${selectInput()} min-w-40`}>
                <option value="">{allLabel}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
