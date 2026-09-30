import { HeartOff, Pencil, Phone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { removeMatrimonyProfile } from '@/app/actions/matrimony';
import ActionButton from '@/components/fundraise/action-button';
import GroupAvatar from '@/components/groups/group-avatar';
import PageHeader, { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { getRelatives } from '@/lib/family';
import { age, date } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { canBrowseMatrimony, canListFor, getProfile } from '@/lib/matrimony';
import { formatPhone } from '@/lib/phone';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('matrimony.title') };
}

function Row({ label, children }) {
    return (
        <div className="flex items-baseline justify-between gap-3 py-2 sm:block sm:py-0">
            <dt className="w-2/5 shrink-0 text-[11px] uppercase tracking-wide text-ink-gray sm:w-auto">{label}</dt>
            <dd className="min-w-0 break-words text-right text-sm text-ink sm:mt-0.5 sm:text-left">{children || <span className="text-ink-gray">—</span>}</dd>
        </div>
    );
}

/**
 * One matrimony profile: basics, education & work, family (from the family tree), preferences,
 * about, and the family contact. Browsers see listed profiles; the person's family (and member
 * managers) also see an unlisted one, with Edit / Remove.
 */
export default async function MatrimonyProfilePage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const p = await getProfile(Number(id) || 0);
    if (!p) notFound();
    const [canList, browse] = await Promise.all([canListFor(user, p.id), canBrowseMatrimony(user)]);
    const listed = Boolean(p.is_active) && p.status === 'active' && (!p.marital_status || p.marital_status === 'unmarried');
    if (!canList && !(browse && listed)) notFound();
    const { t, locale } = await getT();
    const relatives = await getRelatives(p.id);
    const name = localized(p, 'full_name', locale);
    const loc = (n, nl) => (n ? localized({ name: n, name_local: nl }, 'name', locale) : null);
    const names = (list) => list.map((r) => localized(r, 'full_name', locale)).join(', ');

    return (
        <div className="theme-fundraise">
            <PageHeader
                title={name}
                subtitle={[p.gender && t(`matrimony.${p.gender === 'female' ? 'bride' : 'groom'}`), p.dob && `${age(p.dob)} ${t('matrimony.years')}`].filter(Boolean).join(' · ')}
                back={{ href: '/matrimony', label: t('matrimony.title') }}
                actions={
                    canList && (
                        <div className="flex items-center gap-1.5">
                            <Link
                                href={`/matrimony/${p.id}/edit`}
                                aria-label={p.has_profile ? t('common.edit') : t('matrimony.list')}
                                className="btn-secondary inline-flex size-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium sm:w-auto sm:px-3"
                            >
                                <Pencil className="size-4" /> <span className="hidden sm:inline">{p.has_profile ? t('common.edit') : t('matrimony.list')}</span>
                            </Link>
                            {listed && (
                                <ActionButton
                                    action={removeMatrimonyProfile.bind(null, p.id)}
                                    confirm={t('matrimony.removeConfirm')}
                                    icon={<HeartOff className="size-4" />}
                                    label={t('matrimony.remove')}
                                    plain
                                    className="h-9 border border-surface-border bg-white px-3 text-destructive hover:bg-destructive/10 max-sm:size-9 max-sm:justify-center max-sm:px-0"
                                >
                                    <span className="hidden sm:inline">{t('matrimony.remove')}</span>
                                </ActionButton>
                            )}
                        </div>
                    )
                }
            />
            {!p.has_profile || !listed ? (
                <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t(p.has_profile ? 'matrimony.notListed' : 'matrimony.noProfile')}</p>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-4">
                    <Card title={t('matrimony.sections.basics')}>
                        <div className="mb-3 flex items-center gap-3">
                            <GroupAvatar id={p.id} name={name} size="lg" />
                            <div className="min-w-0">
                                <p className="font-semibold text-primary">{name}</p>
                                <Badge tone="gray">{p.gender ? t(`gender.${p.gender}`) : '—'}</Badge>
                            </div>
                        </div>
                        <dl className="grid divide-y divide-surface-border sm:grid-cols-3 sm:gap-4 sm:divide-y-0">
                            <Row label={t('members.dob')}>{p.dob && `${date(p.dob, locale)} · ${age(p.dob)}`}</Row>
                            <Row label={t('matrimony.height')}>{p.height_cm && `${p.height_cm} cm`}</Row>
                            <Row label={t('members.caste')}>{[loc(p.caste_name, p.caste_name_local), loc(p.subcaste_name, p.subcaste_name_local)].filter(Boolean).join(' · ')}</Row>
                            <Row label={t('members.city')}>{p.city}</Row>
                            <Row label={t('members.village')}>{p.village}</Row>
                        </dl>
                    </Card>
                    <Card title={t('matrimony.sections.work')}>
                        <dl className="grid divide-y divide-surface-border sm:grid-cols-3 sm:gap-4 sm:divide-y-0">
                            <Row label={t('members.education')}>{p.education}</Row>
                            <Row label={t('members.occupation')}>{p.occupation}</Row>
                            <Row label={t('matrimony.income')}>{p.income_range && t(`matrimony.incomes.${p.income_range}`)}</Row>
                        </dl>
                    </Card>
                    <Card title={t('matrimony.sections.family')}>
                        <dl className="grid divide-y divide-surface-border sm:grid-cols-2 sm:gap-4 sm:divide-y-0">
                            <Row label={t('family.one.father')}>{relatives.father && localized(relatives.father, 'full_name', locale)}</Row>
                            <Row label={t('family.one.mother')}>{relatives.mother && localized(relatives.mother, 'full_name', locale)}</Row>
                            <Row label={t('family.kinds.brother')}>{names(relatives.brother)}</Row>
                            <Row label={t('family.kinds.sister')}>{names(relatives.sister)}</Row>
                        </dl>
                    </Card>
                    <Card title={t('matrimony.sections.preferences')}>
                        <dl className="grid divide-y divide-surface-border sm:grid-cols-2 sm:gap-4 sm:divide-y-0">
                            <Row label={t('matrimony.prefAge')}>{(p.pref_age_min || p.pref_age_max) && `${p.pref_age_min ?? '…'} – ${p.pref_age_max ?? '…'}`}</Row>
                            <Row label={t('members.caste')}>{loc(p.pref_caste_name, p.pref_caste_name_local)}</Row>
                            <Row label={t('members.city')}>{p.pref_city}</Row>
                            <Row label={t('members.education')}>{p.pref_education}</Row>
                        </dl>
                    </Card>
                    {p.about && (
                        <Card title={t('matrimony.about')}>
                            <p className="whitespace-pre-line text-sm text-ink">{p.about}</p>
                        </Card>
                    )}
                </div>
                <div className="min-w-0">
                    <Card title={t('matrimony.contact')}>
                        {p.contact_phone ? (
                            <>
                                <p className="text-sm font-medium text-primary">{p.contact_name}</p>
                                <a
                                    href={`tel:${p.contact_phone}`}
                                    className="btn-secondary mt-2 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium tabular-nums"
                                >
                                    <Phone className="size-4" /> {formatPhone(p.contact_phone)}
                                </a>
                            </>
                        ) : (
                            <p className="text-sm text-ink-gray">—</p>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
