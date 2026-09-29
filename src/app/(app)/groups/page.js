import GroupChatList from '@/components/groups/group-chat-list';
import GroupFormDialog from '@/components/groups/group-form-dialog';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { date as fmtDate, time as fmtTime } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { getT } from '@/lib/i18n/server';
import { listGroupsForChat } from '@/lib/groups';
import { canManageGroups } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('groups.title') };
}

/** Time label like WhatsApp's chat list: 18:04 today, "Yesterday", else the date. */
function whenLabel(at, t, locale) {
    if (!at) return '';
    const day = String(at).slice(0, 10);
    const today = todayLocal();
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
    if (day === today) return fmtTime(String(at).slice(11, 16));
    if (day === yesterday) return t('groups.yesterday');
    return fmtDate(day, locale);
}

export default async function GroupsPage() {
    const user = await requireUser();
    const { t, locale } = await getT();
    const manager = canManageGroups(user.role);
    const rows = await listGroupsForChat(user.id);

    const groups = rows.map((g) => {
        // Only people who can read a discussion see its preview and unread count.
        const canRead = manager || Boolean(g.my_role);
        const name = (locale !== 'en' && g.name_local) || g.name;
        let preview = null;
        if (!canRead) preview = t('groups.membersOnlyPreview');
        else if (!g.last_id) preview = t('groups.noMessages');
        else if (g.last_deleted) preview = t('chat.deleted');
        else {
            const who = g.last_user_id === user.id ? t('groups.you') : (locale !== 'en' && g.last_author_local) || g.last_author || t('chat.formerMember');
            const body = String(g.last_body ?? '').replace(/\s+/g, ' ').slice(0, 120);
            preview =
                g.last_kind === 'meeting'
                    ? `📅 ${t('chat.meetingPreview', { name: who, title: body })}`
                    : g.last_kind === 'member'
                      ? body
                      : `${who}: ${body}`;
        }
        return {
            id: g.id,
            name,
            avatar: g.avatar,
            members: Number(g.members),
            admin: g.my_role === 'admin',
            member: Boolean(g.my_role),
            preview,
            muted: !canRead || !g.last_id,
            when: canRead ? whenLabel(g.last_at, t, locale) : '',
            unread: canRead ? Number(g.unread) : 0,
        };
    });

    return (
        <div>
            <PageHeader title={t('groups.title')} subtitle={t('groups.subtitle')} actions={manager && <GroupFormDialog />} />
            <GroupChatList groups={groups} />
        </div>
    );
}
