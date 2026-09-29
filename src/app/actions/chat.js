'use server';
import { refresh } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { CHAT_MAX_LENGTH, chatAccess } from '@/lib/chat';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';

/** Post to a group or fundraise discussion. Access is re-checked here, not trusted from the page. */
export async function postMessage(prev, fd) {
    const user = await getCurrentUser();
    const scope = String(fd.get('scope') ?? '');
    const scopeId = Number(fd.get('scope_id')) || 0;
    const body = String(fd.get('body') ?? '').trim().slice(0, CHAT_MAX_LENGTH);
    if (!body) return { error: 'chat.errors.empty' };
    const access = await chatAccess(user, scope, scopeId);
    if (!access.canPost) return { error: access.allowed ? 'chat.errors.restricted' : 'common.forbidden' };

    await withTransaction(async (q) => {
        const r = await q('INSERT INTO chat_messages (scope, scope_id, user_id) VALUES (:scope, :scopeId, :uid)', {
            scope,
            scopeId,
            uid: user.id,
        });
        await setMeta('chat_messages', r.insertId, { body }, q);
    });
    refresh();
    return { ok: true };
}

/** Soft-delete: your own message, or any message if you moderate the thread. */
export async function deleteMessage(messageId) {
    const user = await getCurrentUser();
    const msg = await queryOne('SELECT id, scope, scope_id, user_id FROM chat_messages WHERE id = :id AND deleted_at IS NULL', {
        id: Number(messageId) || 0,
    });
    if (!user || !msg) return { error: 'common.forbidden' };
    const access = await chatAccess(user, msg.scope, msg.scope_id);
    if (!access.allowed || (msg.user_id !== user.id && !access.moderate)) return { error: 'common.forbidden' };
    await query('UPDATE chat_messages SET deleted_at = NOW() WHERE id = :id', { id: msg.id });
    // The text goes too — a deleted message must not linger in the meta table.
    await query("DELETE FROM chat_messagesmeta WHERE message_id = :id AND meta_key = 'body'", { id: msg.id });
    refresh();
    return { ok: true };
}
