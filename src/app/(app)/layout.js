import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { unreadCount } from '@/lib/notifications';
import { canViewAudit } from '@/lib/roles';
import { getSettings } from '@/lib/settings';
import { SIDEBAR_COOKIE } from '@/lib/ui-prefs';
import AppShell from '@/components/shell/app-shell';

export default async function AppLayout({ children }) {
    const user = await requireUser();
    const [{ t, locale }, unread, general, jar] = await Promise.all([
        getT(),
        unreadCount(user.id),
        getSettings('admin'),
        cookies(),
    ]);
    const samaj = (locale === 'gu' && general.samaj_name_local) || general.samaj_name;

    const sections = [
        {
            title: t('nav.sections.community'),
            items: [
                { href: '/', icon: 'home', label: t('nav.dashboard') },
                { href: '/members', icon: 'users', label: t('nav.members') },
                // A fundraise always belongs to a group, so it sits under Groups.
                { href: '/groups', icon: 'group', label: t('nav.groups'), children: [{ href: '/fundraise', icon: 'fund', label: t('nav.fundraise') }] },
            ],
        },
        {
            title: t('nav.sections.services'),
            items: [
                { href: '/blood', icon: 'blood', label: t('nav.blood') },
            ],
        },
        ...(canViewAudit(user.role)
            ? [{ title: t('nav.sections.admin'), items: [{ href: '/audit', icon: 'audit', label: t('nav.audit') }] }]
            : []),
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
            labels={{
                app: samaj || t('app.name'),
                menu: t('nav.menu'),
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
