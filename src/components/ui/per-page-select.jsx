'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { PER_PAGE_COOKIE, PER_PAGE_MAX_AGE, PER_PAGE_OPTIONS } from '@/lib/tablePrefs';

export default function PerPageSelect({ value, label }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();

    function onChange(e) {
        document.cookie = `${PER_PAGE_COOKIE}=${e.target.value}; path=/; max-age=${PER_PAGE_MAX_AGE}; samesite=lax`;
        const params = new URLSearchParams(searchParams.toString());
        // Every page param, not just one table's: the cookie is shared across tables.
        for (const key of [...params.keys()]) if (key === 'page' || key.endsWith('Page')) params.delete(key);
        const qs = params.toString();
        startTransition(() => {
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
            router.refresh(); // URL may be unchanged; force the server to re-read the cookie
        });
    }

    return (
        <label className={`inline-flex items-center gap-1.5 ${pending ? 'cursor-wait opacity-70' : ''}`}>
            <span>{label}</span>
            <select
                value={value}
                onChange={onChange}
                disabled={pending}
                className="h-8 rounded-md border border-surface-border bg-white px-1.5 text-xs text-primary"
            >
                {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                        {n}
                    </option>
                ))}
            </select>
        </label>
    );
}
