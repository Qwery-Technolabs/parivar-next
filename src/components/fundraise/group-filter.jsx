'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { selectInput } from '@/components/ui/field';

/**
 * A URL-backed select (DESIGN.md §6 live control): one change is one intent, so it
 * navigates on change; the default is the absence of the param; a new filter resets the page.
 * @param {{ param: string, options: Array<{value: string, label: string}>, allLabel: string }} props
 */
export default function GroupFilter({ param, options, allLabel }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const current = searchParams.get(param) || '';

    function onChange(e) {
        const value = e.target.value;
        if (value === current) return;
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(param, value);
        else params.delete(param);
        params.delete('page');
        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }

    // A value no longer offered still shows, so an applied filter never silently vanishes.
    const opts = current && !options.some((o) => o.value === current) ? [...options, { value: current, label: current }] : options;

    return (
        <select
            value={current}
            onChange={onChange}
            disabled={pending}
            aria-label={allLabel}
            className={`${selectInput()} w-full min-w-0 sm:w-48 ${pending ? 'cursor-wait opacity-70' : ''}`}
        >
            <option value="">{allLabel}</option>
            {opts.map((o) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    );
}
