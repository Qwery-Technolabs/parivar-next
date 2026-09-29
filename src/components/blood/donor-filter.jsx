'use client';
import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Field, selectInput, textInput } from '@/components/ui/field';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';

/**
 * Live controls (group, compatible) navigate on change; the village box commits on
 * submit. One <form> so the cluster wraps as a unit (DESIGN.md §5).
 */
export default function DonorFilter({ group, compatible, village }) {
    const { t } = useT();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const [villageDraft, setVillageDraft] = useState(village);

    // Follow an externally changed value (Back button) — render-time, not an effect.
    const [seenVillage, setSeenVillage] = useState(village);
    if (seenVillage !== village) {
        setSeenVillage(village);
        setVillageDraft(village);
    }

    function push(overrides) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [k, v] of Object.entries(overrides)) {
            if (v) params.set(k, v);
            else params.delete(k);
        }
        params.set('tab', 'donors');
        const qs = params.toString();
        startTransition(() => router.replace(`${pathname}?${qs}`, { scroll: false }));
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                push({ village: villageDraft.trim() });
            }}
            className={`flex flex-col gap-3 rounded-lg border border-surface-border bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end ${
                pending ? 'cursor-wait opacity-70' : ''
            }`}
        >
            <Field label={t('members.bloodGroup')} className="sm:w-40">
                <select
                    value={group}
                    disabled={pending}
                    onChange={(e) => push({ group: e.target.value })}
                    className={`${selectInput()} w-full`}
                >
                    <option value="">—</option>
                    {BLOOD_GROUPS.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={t('members.village')} className="min-w-0 sm:min-w-56 sm:flex-1">
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        {/* Free text, partial match — no <datalist> (DESIGN.md §6). */}
                        <input
                            value={villageDraft}
                            onChange={(e) => setVillageDraft(e.target.value)}
                            placeholder={t('common.any')}
                            className={`${textInput()} w-full`}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={pending}
                        aria-label={t('common.search')}
                        className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                        <Search className="size-4" />
                    </button>
                </div>
            </Field>
            <div className="flex h-9 items-center" title={t('members.compatibleHint')}>
                <Switch
                    checked={compatible}
                    disabled={pending}
                    onChange={(v) => push({ compatible: v ? '1' : '' })}
                    label={t('members.compatible')}
                />
            </div>
        </form>
    );
}
