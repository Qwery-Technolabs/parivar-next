import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { unreadCount } from '@/lib/notifications';
import { kickReminders } from '@/lib/reminders';
import { getSettings } from '@/lib/settings';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';
import AppShell from '@/components/shell/app-shell';

export default async function AppLayout({ children }) {
    const user = await requireUser();
    kickReminders(); // Vercel only: due meeting reminders, after this page is sent
    // Added by phone number and still on the temporary password (the number): choose one first.
    if (user.must_change_password) redirect('/set-password');
    const [{ t, locale }, unread, general, jar] = await Promise.all([
        getT(),
        unreadCount(user.id),
        getSettings('admin'),
        cookies(),
    ]);
    const samaj = (locale === 'gu' && general.samaj_name_local) || general.samaj_name;

    // Overview · Community · Services · Miscellaneous (Members).
    const sections = [
        { title: t('nav.sections.overview'), items: [{ href: '/', icon: 'home', label: t('nav.dashboard') }] },
        { title: t('nav.sections.community'), items: [{ href: '/groups', icon: 'group', label: t('nav.groups') }] },
        {
            title: t('nav.sections.services'),
            items: [
                { href: '/fundraise', icon: 'fund', label: t('nav.fundraise') },
                { href: '/matrimony', icon: 'matrimony', label: t('nav.matrimony') },
                { href: '/blood', icon: 'blood', label: t('nav.blood') },
            ],
        },
        {
            title: t('nav.sections.admin'),
            // The activity log lives in Settings (admins), not here.
            // My own family tree first, then everyone.
            items: [
                { href: `/members/${user.id}/tree`, icon: 'tree', label: t('nav.myTree') },
                { href: '/members', icon: 'users', label: t('nav.members'), exclude: [`/members/${user.id}/tree`] },
            ],
        },
    ];
    // Pinned to the bottom of the sidebar. Everyone has Settings (language, phone,
    // password); admins also get the Samaj tab there.
    const footer = [{ href: '/settings', icon: 'settings', label: t('nav.settings') }];

    return (
        <AppShell
            sections={sections}
            footer={footer}
            unread={unread}
            initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
            user={{ name: localized(user, 'full_name', locale), role: t(`roles.${user.role}`) }}
            logo={{ logo_kind: general.logo_kind, logo_value: general.logo_value, logo_color: general.logo_color }}
            labels={{
                app: samaj || t('app.name'),
                menu: t('nav.menu'),
                close: t('common.close'),
                profile: t('nav.settings'),
                logout: t('nav.logout'),
                notifications: t('nav.notifications'),
                calendar: t('nav.calendar'),
                collapse: t('nav.collapse'),
                expand: t('nav.expand'),
            }}
        >
            {children}
        </AppShell>
    );
}
