import { HeartHandshake, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import GroupAvatar from '@/components/groups/group-avatar';
import PageHeader, { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import FilterBar from '@/components/ui/filter-bar';
import { requireUser } from '@/lib/auth';
import { casteOptions } from '@/lib/castes';
import { age } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canBrowseMatrimony, listableInFamily, listProfiles } from '@/lib/matrimony';
import { sp1 } from '@/lib/url';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('matrimony.title') };
}

const num = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 100 ? n : null;
};

/**
 * Matrimony: "Your family" (who in your family can be listed, and their profiles), then the
 * listed profiles with filters — for those allowed to browse (lib/matrimony.js canBrowseMatrimony).
 */
export default async function MatrimonyPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const [browse, family, castes] = await Promise.all([canBrowseMatrimony(user), listableInFamily(user), casteOptions(locale)]);
    const filters = {
        gender: ['male', 'female'].includes(sp1(sp.gender)) ? sp1(sp.gender) : null,
        ageMin: num(sp1(sp.age_min)),
        ageMax: num(sp1(sp.age_max)),
        casteId: Number.isInteger(Number(sp1(sp.caste))) && Number(sp1(sp.caste)) > 0 ? Number(sp1(sp.caste)) : null,
        place: (sp1(sp.q) || '').trim().slice(0, 60) || null,
    };
    const profiles = browse ? await listProfiles(filters) : [];
    const casteLabel = (p) =>
        [localized({ name: p.caste_name, name_local: p.caste_name_local }, 'name', locale), p.subcaste_name && localized({ name: p.subcaste_name, name_local: p.subcaste_name_local }, 'name', locale)]
            .filter(Boolean)
            .join(' · ');

    return (
        <div className="theme-fundraise">
            <PageHeader title={t('matrimony.title')} subtitle={t('matrimony.subtitle')} />

            {/* Your family: who can be listed (unmarried, 18+) and whether they are. */}
            <Card title={t('matrimony.yourFamily')} bodyClass="" className="mb-4">
                <p className="border-b border-surface-border px-4 py-2 text-xs text-ink-gray">{t('matrimony.whoCanList')}</p>
                {family.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-ink-gray">{t('matrimony.noneEligible')}</p>
                ) : (
                    <ul className="divide-y divide-surface-border">
                        {family.map((p) => (
                            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                                <div className="min-w-0 flex-1">
                                    <Link href={`/matrimony/${p.id}`} className="font-medium text-primary hover:underline">
                                        {localized(p, 'full_name', locale)}
                                    </Link>
                                    <span className="ml-2 text-xs text-ink-gray tabular-nums">{age(p.dob)}</span>
                                    {p.listed ? (
                                        <Badge tone="green" className="ml-2">
                                            {t('matrimony.listed')}
                                        </Badge>
                                    ) : null}
                                </div>
                                <Link
                                    href={`/matrimony/${p.id}/edit`}
                                    aria-label={p.listed ? t('common.edit') : t('matrimony.list')}
                                    title={p.listed ? t('common.edit') : t('matrimony.list')}
                                    className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                                >
                                    {p.listed ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
                                    <span className="hidden sm:inline">{p.listed ? t('common.edit') : t('matrimony.list')}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {!browse ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-8 text-center text-sm text-ink-gray">{t('matrimony.browseLocked')}</p>
            ) : (
                <>
                    <FilterBar
                        search={{ param: 'q', placeholder: t('matrimony.placeSearch') }}
                        filters={[
                            {
                                param: 'gender',
                                label: t('matrimony.looking'),
                                type: 'select',
                                allLabel: t('common.any'),
                                options: [
                                    { value: 'female', label: t('matrimony.bride') },
                                    { value: 'male', label: t('matrimony.groom') },
                                ],
                            },
                            { param: 'age_min', label: t('matrimony.ageMin'), type: 'text' },
                            { param: 'age_max', label: t('matrimony.ageMax'), type: 'text' },
                            { param: 'caste', label: t('members.caste'), type: 'select', allLabel: t('common.any'), options: castes.castes },
                        ]}
                    />
                    {profiles.length === 0 ? (
                        <p className="mt-3 rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">{t('matrimony.empty')}</p>
                    ) : (
                        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {profiles.map((p) => {
                                const name = localized(p, 'full_name', locale);
                                return (
                                    <li key={p.id}>
                                        <Link
                                            href={`/matrimony/${p.id}`}
                                            className="flex h-full gap-3 rounded-lg border border-surface-border bg-white p-3 shadow-sm hover:bg-accent/60"
                                        >
                                            <GroupAvatar id={p.id} name={name} size="lg" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-semibold text-primary">{name}</p>
                                                <p className="text-xs text-ink-gray tabular-nums">
                                                    {[p.gender && t(`matrimony.${p.gender === 'female' ? 'bride' : 'groom'}`), `${age(p.dob)} ${t('matrimony.years')}`, p.height_cm && `${p.height_cm} cm`]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                                {casteLabel(p) && <p className="truncate text-xs text-ink-gray">{casteLabel(p)}</p>}
                                                <p className="truncate text-xs text-ink-gray">{[p.education, p.occupation].filter(Boolean).join(' · ')}</p>
                                                <p className="truncate text-xs text-ink-gray">{[p.city, p.village].filter(Boolean).join(' · ')}</p>
                                            </div>
                                            <HeartHandshake aria-hidden className="size-4 shrink-0 text-rose-700" />
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
