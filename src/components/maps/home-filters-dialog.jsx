'use client';
import { Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MenuOpener } from '@/components/shell/page-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, textInput } from '@/components/ui/field';
import PickOrType from '@/components/ui/pick-or-type';
import Switch from '@/components/ui/switch';
import { homeFiltersHref, NO_HOME_FILTERS } from '@/lib/home-filters';
import { useT } from '@/lib/i18n/client';

/**
 * Nearby ⋮ → Filters: which homes the map shows — only my family tree, current city, native village, surname, age
 * from / to. Default: everyone (each "All"). Apply puts them in the URL (shareable, survives a reload); the map then
 * loads only matching homes, area by area (lib/homes.js filterSql). Opened from the page's ⋮ (MenuOpener `menuKey`).
 * @param {{ menuKey: string, filters: object, cities: Array<{value:string,label:string,count:number}>, villages: Array<{value:string,label:string,count:number}>, surnames: string[] }} props
 */
export default function HomeFiltersDialog({ menuKey, filters, cities, villages, surnames }) {
    const { t } = useT();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const initial = () => ({
        family: Boolean(filters.family),
        city: filters.city ?? '',
        village: filters.village ?? '',
        surname: filters.surname ?? '',
        ageMin: filters.ageMin != null ? String(filters.ageMin) : '',
        ageMax: filters.ageMax != null ? String(filters.ageMax) : '',
    });
    const [d, setD] = useState(initial);
    const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
    const apply = (next) => {
        setOpen(false);
        router.push(homeFiltersHref(next));
    };
    const age = (k) => (
        <input
            type="number"
            inputMode="numeric"
            min={0}
            max={120}
            value={d[k]}
            onChange={(e) => set(k, e.target.value.replace(/\D/g, '').slice(0, 3))}
            placeholder={k === 'ageMin' ? t('home.filters.from') : t('home.filters.to')}
            aria-label={`${t('home.filters.age')} — ${k === 'ageMin' ? t('home.filters.from') : t('home.filters.to')}`}
            className={`${textInput()} w-full tabular-nums`}
        />
    );

    return (
        <>
            <MenuOpener
                id={menuKey}
                open={() => {
                    setD(initial());
                    setOpen(true);
                }}
            />
            <Dialog
                open={open}
                onOpenChange={(next, details) => {
                    // A suggestion list floats on its own layer: pressing it is not "outside".
                    if (!next && details?.event?.target?.closest?.('[data-floating-list]')) return details.cancel?.();
                    setOpen(next);
                }}
            >
                <DialogContent focusPopup className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-semibold text-primary">
                            <Filter className="size-4" /> {t('home.filters.title')}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">{t('home.filters.hint')}</DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            apply(d);
                        }}
                        className="space-y-3"
                    >
                        <div className="rounded-md border border-surface-border px-3 py-2.5">
                            <Switch checked={d.family} onChange={(v) => set('family', v)} label={t('home.filters.family')} />
                            <p className="mt-1 text-xs text-ink-gray">{t('home.filters.familyHint')}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label={t('members.city')}>
                                <PickOrType
                                    name="city"
                                    value={d.city}
                                    onChange={(v) => set('city', v)}
                                    suggestions={cities}
                                    placeholder={t('common.all')}
                                    label={t('members.city')}
                                />
                            </Field>
                            <Field label={t('members.village')}>
                                <PickOrType
                                    name="village"
                                    value={d.village}
                                    onChange={(v) => set('village', v)}
                                    suggestions={villages}
                                    placeholder={t('common.all')}
                                    label={t('members.village')}
                                />
                            </Field>
                            <Field label={t('members.surname')}>
                                <PickOrType
                                    name="surname"
                                    value={d.surname}
                                    onChange={(v) => set('surname', v)}
                                    suggestions={surnames}
                                    placeholder={t('common.all')}
                                    label={t('members.surname')}
                                />
                            </Field>
                            {/* One question, one label: from – to (years). */}
                            <Field label={t('home.filters.age')}>
                                <div className="flex items-center gap-1.5">
                                    {age('ageMin')}
                                    <span className="text-ink-gray">–</span>
                                    {age('ageMax')}
                                </div>
                            </Field>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-surface-border pt-3">
                            <Button type="button" variant="ghost" onClick={() => apply(NO_HOME_FILTERS)}>
                                {t('home.filters.clear')}
                            </Button>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit">{t('home.filters.apply')}</Button>
                            </div>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
