import { Eraser, Lock } from 'lucide-react';
import { clearChat } from '@/app/actions/chat';
import ActionButton from '@/components/fundraise/action-button';
import { getCurrentUser } from '@/lib/auth';
import { chatAccess, listMessages, markRead } from '@/lib/chat';
import { getT } from '@/lib/i18n/server';
import ChatThread from './chat-thread';

// MariaDB hands JSON back as text; a damaged value must not break the thread.
function parseData(raw) {
    try {
        return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {});
    } catch {
        return {};
    }
}

/**
 * A WhatsApp-style discussion for one group or fundraise. Server component: checks access
 * and loads the latest messages itself, so a page only has to place it.
 * @param {{ scope: 'group'|'fundraise', scopeId: number }} props
 */
export default async function ChatPanel({ scope, scopeId }) {
    const user = await getCurrentUser();
    const [{ t }, access] = await Promise.all([getT(), chatAccess(user, scope, scopeId)]);
    if (!access.allowed) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">
                <Lock className="size-5" />
                {t('chat.membersOnly')}
            </div>
        );
    }
    const messages = await listMessages(scope, scopeId);
    // Opening the discussion clears its unread badge in the group list.
    await markRead(user.id, scope, scopeId, messages.at(-1)?.id);
    return (
        <div>
            {access.canClear && messages.length > 0 && (
                <div className="mb-2 flex justify-end">
                    <ActionButton
                        action={clearChat.bind(null, scope, scopeId)}
                        confirm={t('chat.clearConfirm')}
                        icon={<Eraser className="size-3.5" />}
                        danger
                        className="h-8"
                    >
                        {t('chat.clear')}
                    </ActionButton>
                </div>
            )}
        <ChatThread
            scope={scope}
            scopeId={scopeId}
            me={user.id}
            moderate={access.moderate}
            canPost={access.canPost}
            canAlert={access.canAlert}
            postRoles={access.postRoles ?? []}
            paused={Boolean(access.paused)}
            messages={messages.map((m) => ({
                id: m.id,
                userId: m.user_id,
                name: m.full_name,
                nameLocal: m.full_name_local,
                body: m.deleted_at ? null : m.body,
                alert: !m.deleted_at && m.alert === '1',
                kind: m.deleted_at ? null : m.kind || null,
                data: m.kind ? parseData(m.data) : null,
                at: m.created_at,
            }))}
        />
        </div>
    );
}
