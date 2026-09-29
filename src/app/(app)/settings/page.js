import { BellRing, CalendarDays, Check, Droplet, HandCoins, Languages, ShieldCheck, SlidersHorizontal, UserCircle, History } from 'lucide-react';
import Link from 'next/link';
import { setLocalLanguage } from '@/app/actions/profile';
import { setLanguage } from '@/app/actions/session';
import PageHeader, { Card } from '@/components/shell/page-header';
import { ChangePasswordForm, ChangePhoneForm } from '@/components/profile/profile-forms';
import PushToggle from '@/components/settings/push-toggle';
import SettingsForm from '@/components/settings/settings-form';
import { BloodBadge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { date } from '@/lib/format';
import { getLocalLanguage, getT } from '@/lib/i18n/server';
import { LOCAL_LANGUAGES } from '@/lib/local-language';
import { formatPhone } from '@/lib/phone';
import { canManageSettings, canViewAudit } from '@/lib/roles';
import { vapidPublicKey } from '@/lib/push';
import { getSettings, SETTINGS } from '@/lib/settings';
import AuditLog from '@/components/audit/audit-log';
import MemberEditTabs from '@/components/members/member-edit-tabs';
import { casteOptions } from '@/lib/castes';
import { getMember, listCities, listVillages } from '@/lib/members';
import { sp1 } from '@/lib/url';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('settings.title') };
}

/**
 * Every section, with who may see it. `module` sections render that module's settings
 * registry (lib/settings.js); the personal ones are for everyone. A section someone may
 * not see is not in their menu AND not reachable by URL — an unknown or forbidden
 * ?section falls back to the default (profile).
 */
const SECTIONS = [
    { key: 'profile', group: 'personal', icon: UserCircle },
    { key: 'security', group: 'personal', icon: ShieldCheck },
    { key: 'language', group: 'personal', icon: Languages },
    { key: 'notifications', group: 'personal', icon: BellRing },
    { key: 'general', group: 'admin', icon: SlidersHorizontal, module: 'admin', admin: true },
    { key: 'fundraise', group: 'admin', icon: HandCoins, module: 'fundraise', admin: true },
    { key: 'blood', group: 'admin', icon: Droplet, module: 'blood', admin: true },
    { key: 'calendar', group: 'admin', icon: CalendarDays, module: 'events', admin: true },
    // Kept out of the sidebar: an internal record, shown here (sub-admins and up).
    { key: 'audit', group: 'admin', icon: History, audit: true },
];

export default async function SettingsPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;
    const { t, locale } = await getT();
    const isAdmin = canManageSettings(user.role);
    const visible = SECTIONS.filter((s) => (s.audit ? canViewAudit(user.role) : !s.admin || isAdmin));
    // Link entries (the activity log) are pages of their own, never the open section.
    const current = visible.find((s) => !s.href && s.key === sp1(sp.section)) ?? visible[0];

    const groups = [
        { key: 'personal', title: t('settings.groups.personal') },
        ...(visible.some((s) => s.group === 'admin') ? [{ key: 'admin', title: t('settings.groups.admin') }] : []),
    ];

    return (
        <div>
            <PageHeader title={t('settings.title')} subtitle={t(`settings.sections.${current.key}.hint`)} />
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
                {/* Section menu: a column on desktop, a scrolling strip on a phone. */}
                <nav className="md:w-56 md:shrink-0">
                    <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:gap-4 md:overflow-visible md:px-0">
                        {groups.map((g) => (
                            <div key={g.key} className="flex shrink-0 gap-1 md:flex-col">
                                <p className="hidden px-3 pb-1 text-[11px] uppercase tracking-wide text-ink-gray md:block">{g.title}</p>
                                {visible
                                    .filter((s) => s.group === g.key)
                                    .map((s) => {
                                        const Icon = s.icon;
                                        const active = s.key === current.key;
                                        return (
                                            <Link
                                                key={s.key}
                                                href={s.href ?? (s.key === visible[0].key ? '/settings' : `/settings?section=${s.key}`)}
                                                scroll={false}
                                                aria-current={active ? 'page' : undefined}
                                                className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium ${
                                                    active ? 'seg-active' : 'text-ink-gray hover:bg-accent hover:text-primary'
                                                }`}
                                            >
                                                <Icon className="size-4 shrink-0" />
                                                {t(`settings.sections.${s.key}.title`)}
                                            </Link>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                </nav>
                <div className="min-w-0 flex-1">
                    {/* ?action=edit: edit your own details right here (tabs, each saved on its own). */}
                    {current.key === 'profile' && sp1(sp.action) === 'edit' ? (
                        <ProfileEditSection userId={user.id} t={t} locale={locale} initialTab={sp1(sp.tab)} />
                    ) : (
                        current.key === 'profile' && <ProfileSection userId={user.id} t={t} locale={locale} />
                    )}
                    {current.key === 'audit' && <AuditLog sp={sp} t={t} locale={locale} canClear={isAdmin} />}
                    {current.key === 'security' && <SecuritySection userId={user.id} t={t} />}
                    {current.key === 'notifications' && (
                        <Card title={t('settings.sections.notifications.title')}>
                            <p className="mb-3 text-xs text-ink-gray">{t('push.hint')}</p>
                            {/* The VAPID public key is not secret; it identifies this server to the browser push service. */}
                            <PushToggle publicKey={vapidPublicKey()} />
                        </Card>
                    )}
                    {current.key === 'language' && <LanguageSection t={t} locale={locale} />}
                    {current.module && <ModuleSection module={current.module} title={t(`settings.sections.${current.key}.title`)} t={t} />}
                </div>
            </div>
        </div>
    );
}

function Row({ label, children }) {
    return (
        <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
            <dt className="text-[11px] uppercase tracking-wide text-ink-gray sm:w-36 sm:shrink-0 sm:pt-0.5">{label}</dt>
            <dd className="min-w-0 break-words text-sm text-ink">{children ?? <span className="text-ink-gray">—</span>}</dd>
        </div>
    );
}

async function ProfileSection({ userId, t, locale }) {
    // Both spellings are shown here — this is where a person checks how their name reads.
    const localLang = await getLocalLanguage();
    const me = await queryOne(
        `SELECT id, phone, full_name, full_name_local, gender, dob, blood_group, village, role FROM users_list WHERE id = :id`,
        { id: userId },
    );
    return (
        <Card
            title={t('settings.sections.profile.title')}
            actions={
                <Link href="/settings?section=profile&action=edit" scroll={false} className="btn-secondary inline-flex h-8 items-center rounded-md px-3 text-xs font-medium">
                    {t('common.edit')}
                </Link>
            }
        >
            <dl className="divide-y divide-surface-border">
                <Row label={t('members.fullName')}>{me.full_name}</Row>
                <Row label={t('members.fullNameLocal', { lang: LOCAL_LANGUAGES[localLang].label })}>
                    {me.full_name_local ? <span lang={localLang}>{me.full_name_local}</span> : null}
                </Row>
                <Row label={t('members.phone')}>
                    <span className="tabular-nums">{formatPhone(me.phone)}</span>
                </Row>
                <Row label={t('members.role')}>{t(`roles.${me.role}`)}</Row>
                <Row label={t('members.village')}>{me.village || null}</Row>
                <Row label={t('members.bloodGroup')}>{me.blood_group ? <BloodBadge group={me.blood_group} /> : null}</Row>
                <Row label={t('members.gender')}>{me.gender ? t(`gender.${me.gender}`) : null}</Row>
                <Row label={t('members.dob')}>{me.dob ? date(me.dob, locale) : null}</Row>
            </dl>
        </Card>
    );
}

async function SecuritySection({ userId, t }) {
    const me = await queryOne('SELECT phone FROM users_list WHERE id = :id', { id: userId });
    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <Card title={t('profile.changePhone')}>
                <ChangePhoneForm currentPhone={me.phone} />
            </Card>
            <Card title={t('profile.changePassword')}>
                <ChangePasswordForm />
            </Card>
        </div>
    );
}

function Choice({ action, name, value, selected, label, sub, lang }) {
    return (
        <form action={action}>
            <input type="hidden" name={name} value={value} />
            <button
                type="submit"
                lang={lang}
                aria-pressed={selected}
                className={`flex h-14 w-full items-center justify-between rounded-lg border px-3 text-left hover:bg-accent ${
                    selected ? 'border-primary ring-2 ring-ring/30' : 'border-surface-border'
                }`}
            >
                <span className="min-w-0">
                    <span className="block font-semibold text-primary">{label}</span>
                    <span className="block text-xs text-ink-gray">{sub}</span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" />}
            </button>
        </form>
    );
}

async function LanguageSection({ t, locale }) {
    const localLang = await getLocalLanguage();
    // Both labels in their own script, so someone who reads only one can still find it.
    const appLanguages = [
        { value: 'gu', label: 'ગુજરાતી', sub: 'Gujarati' },
        { value: 'en', label: 'English', sub: 'અંગ્રેજી' },
    ];
    return (
        <div className="space-y-4">
            <Card title={t('settings.language.app')}>
                <p className="mb-3 text-xs text-ink-gray">{t('settings.language.appHint')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                    {appLanguages.map((o) => (
                        <Choice key={o.value} action={setLanguage} name="locale" value={o.value} selected={locale === o.value} label={o.label} sub={o.sub} lang={o.value} />
                    ))}
                </div>
            </Card>
            <Card title={t('settings.language.local')}>
                <p className="mb-3 text-xs text-ink-gray">{t('settings.language.localHint')}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                    {Object.entries(LOCAL_LANGUAGES).map(([code, l]) => (
                        <Choice
                            key={code}
                            action={setLocalLanguage}
                            name="local_language"
                            value={code}
                            selected={localLang === code}
                            label={l.label}
                            sub={l.english}
                            lang={code}
                        />
                    ))}
                </div>
            </Card>
        </div>
    );
}

async function ModuleSection({ module: mod, title, t }) {
    const values = await getSettings(mod);
    return (
        <SettingsForm
            module={mod}
            title={title}
            fields={[
                // General: the Samaj logo, drawn left of the Samaj name (default: the orange people icon).
                ...(mod === 'admin'
                    ? [
                          {
                              key: 'logo',
                              type: 'logo',
                              with: 'samaj_name',
                              value: {
                                  avatar_kind: values.logo_kind || 'icon',
                                  avatar_value: values.logo_value || 'Users',
                                  avatar_color: values.logo_color || '#b85d09',
                              },
                          },
                      ]
                    : []),
                ...Object.entries(SETTINGS[mod].keys)
                    .filter(([, def]) => !def.hidden)
                    .map(([key, def]) => {
                        const hintKey = `settings.hints.${mod}_${key}`;
                        const hint = t(hintKey);
                        return {
                            key,
                            type: def.type,
                            value: values[key],
                            label: t(`settings.keys.${mod}_${key}`),
                            hint: hint === hintKey ? undefined : hint,
                            options: def.options?.map((o) => ({ value: o, label: def.labels?.[o] ?? t(`lang.${o}`) })),
                        };
                    }),
            ]}
        />
    );
}


/**
 * Settings → Profile → Edit: your own details in the member editor's tabs (Basic info,
 * Community, Details), each saved on its own. No role (never your own) and no password tab
 * (that is Settings → Security, which asks for the current one).
 */
async function ProfileEditSection({ userId, t, locale, initialTab }) {
    const [member, villages, cities, castes] = await Promise.all([getMember(userId), listVillages(), listCities(), casteOptions(locale)]);
    if (!member) return null;
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">{t('settings.editProfile')}</h2>
                <Link
                    href="/settings"
                    scroll={false}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 text-xs font-medium text-primary hover:bg-accent"
                >
                    <Check className="size-3.5" /> {t('common.done')}
                </Link>
            </div>
            <MemberEditTabs
                // Invited without a name, the phone number stood in: show an empty (required) name to fill.
                member={member.full_name === member.phone ? { ...member, full_name: '' } : member}
                initialTab={initialTab}
                roles={[]}
                canEdit
                canSetRole={false}
                canSetPassword={false}
                villages={villages.map((v) => v.value)}
                cities={cities.map((c) => c.value)}
                casteOptions={castes}
            />
        </div>
    );
}
