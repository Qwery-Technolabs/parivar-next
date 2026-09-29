import { Check } from 'lucide-react';
import { setLanguage } from '@/app/actions/session';
import PageHeader, { Card } from '@/components/shell/page-header';
import { ChangePasswordForm, ChangePhoneForm } from '@/components/profile/profile-forms';
import { BloodBadge } from '@/components/ui/badge';
import { requireUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { date } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { formatPhone } from '@/lib/phone';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('profile.title') };
}

function Row({ label, children }) {
    return (
        <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
            <dt className="text-[11px] uppercase tracking-wide text-ink-gray sm:w-36 sm:shrink-0 sm:pt-0.5">{label}</dt>
            <dd className="min-w-0 break-words text-sm text-ink">{children ?? <span className="text-ink-gray">—</span>}</dd>
        </div>
    );
}

export default async function ProfilePage() {
    const session = await requireUser();
    const { t, locale } = await getT();
    const me = await queryOne(
        `SELECT id, phone, full_name, full_name_gu, gender, dob, blood_group, village, role, language, last_login_at
           FROM users_list WHERE id = :id`,
        { id: session.id },
    );

    const languages = [
        { locale: 'gu', label: 'ગુજરાતી', sub: 'Gujarati' },
        { locale: 'en', label: 'English', sub: 'અંગ્રેજી' },
    ];

    return (
        <div>
            <PageHeader title={t('profile.title')} subtitle={localized(me, 'full_name', locale)} />
            <div className="grid gap-4 xl:grid-cols-2">
                <Card title={t('members.details')}>
                    <dl className="divide-y divide-surface-border">
                        <Row label={t('members.fullName')}>{me.full_name}</Row>
                        {me.full_name_gu && (
                            <Row label={t('members.fullNameGu')}>
                                <span lang="gu">{me.full_name_gu}</span>
                            </Row>
                        )}
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

                <div className="space-y-4">
                    <Card title={t('profile.language')}>
                        <div className="grid grid-cols-2 gap-2">
                            {languages.map((o) => (
                                <form key={o.locale} action={setLanguage}>
                                    <input type="hidden" name="locale" value={o.locale} />
                                    <button
                                        type="submit"
                                        lang={o.locale}
                                        aria-pressed={me.language === o.locale}
                                        className={`flex h-14 w-full items-center justify-between rounded-lg border px-3 text-left hover:bg-accent ${
                                            me.language === o.locale ? 'border-primary ring-2 ring-ring/30' : 'border-surface-border'
                                        }`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block font-semibold text-primary">{o.label}</span>
                                            <span className="block text-xs text-ink-gray">{o.sub}</span>
                                        </span>
                                        {me.language === o.locale && <Check className="size-4 shrink-0 text-primary" />}
                                    </button>
                                </form>
                            ))}
                        </div>
                    </Card>
                    <Card title={t('profile.changePhone')}>
                        <ChangePhoneForm currentPhone={me.phone} />
                    </Card>
                    <Card title={t('profile.changePassword')}>
                        <ChangePasswordForm />
                    </Card>
                </div>
            </div>
        </div>
    );
}
