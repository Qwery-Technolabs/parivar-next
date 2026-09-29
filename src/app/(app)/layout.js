import { requireUser } from '@/lib/auth';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { unreadCount } from '@/lib/notifications';
import { canManageSettings, canViewAudit } from '@/lib/roles';
import { getSettings } from '@/lib/settings';
import AppShell from '@/components/shell/app-shell';

export default async function AppLayout({ children }) {
    const user = await requireUser();
    const [{ t, locale }, unread, general] = await Promise.all([getT(), unreadCount(user.id), getSettings('admin')]);
    const samaj = (locale === 'gu' && general.samaj_name_gu) || general.samaj_name;

    const nav = [
        { href: '/', icon: 'home', label: t('nav.dashboard') },
        { href: '/members', icon: 'users', label: t('nav.members') },
        { href: '/groups', icon: 'group', label: t('nav.groups') },
        { href: '/blood', icon: 'blood', label: t('nav.blood') },
        { href: '/fundraise', icon: 'fund', label: t('nav.fundraise') },
        { href: '/calendar', icon: 'calendar', label: t('nav.calendar') },
        ...(canViewAudit(user.role) ? [{ href: '/audit', icon: 'audit', label: t('nav.audit') }] : []),
        ...(canManageSettings(user.role) ? [{ href: '/settings', icon: 'settings', label: t('nav.settings') }] : []),
    ];

    return (
        <AppShell
            nav={nav}
            unread={unread}
            user={{ name: localized(user, 'full_name', locale), role: t(`roles.${user.role}`) }}
            labels={{
                app: samaj || t('app.name'),
                menu: t('nav.menu'),
                profile: t('nav.profile'),
                logout: t('nav.logout'),
                language: t('lang.switch'),
                notifications: t('nav.notifications'),
            }}
        >
            {children}
        </AppShell>
    );
}
