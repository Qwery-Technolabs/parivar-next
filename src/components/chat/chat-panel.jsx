import { Lock } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { chatAccess, listMessages, markRead } from '@/lib/chat';
import { getT } from '@/lib/i18n/server';
import ChatThread from './chat-thread';

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
        <ChatThread
            scope={scope}
            scopeId={scopeId}
            me={user.id}
            moderate={access.moderate}
            messages={messages.map((m) => ({
                id: m.id,
                userId: m.user_id,
                name: m.full_name,
                nameLocal: m.full_name_local,
                body: m.deleted_at ? null : m.body,
                at: m.created_at,
            }))}
        />
    );
}
