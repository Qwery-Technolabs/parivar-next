'use server';
import { refresh } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { alertAudience, CHAT_MAX_LENGTH, chatAccess } from '@/lib/chat';
import { notifyMany } from '@/lib/notifications';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';

/**
 * Post to a group or fundraise discussion. Access is re-checked here, not trusted from the page.
 * alert=1 (only for those who may, see chatAccess.canAlert) also notifies everyone connected —
 * this replaced the separate "post an update".
 */
export async function postMessage(prev, fd) {
    const user = await getCurrentUser();
    const scope = String(fd.get('scope') ?? '');
    const scopeId = Number(fd.get('scope_id')) || 0;
    const body = String(fd.get('body') ?? '').trim().slice(0, CHAT_MAX_LENGTH);
    if (!body) return { error: 'chat.errors.empty' };
    const access = await chatAccess(user, scope, scopeId);
    if (!access.canPost) return { error: access.allowed ? 'chat.errors.restricted' : 'common.forbidden' };

    const alert = fd.get('alert') === '1' && access.canAlert;
    await withTransaction(async (q) => {
        const r = await q('INSERT INTO chat_messages (scope, scope_id, user_id) VALUES (:scope, :scopeId, :uid)', {
            scope,
            scopeId,
            uid: user.id,
        });
        await setMeta('chat_messages', r.insertId, { body, alert: alert ? '1' : '' }, q);
    });
    if (alert) {
        const a = await alertAudience(scope, scopeId);
        await notifyMany(a.userIds, {
            type: 'chat.alert',
            data: { title: a.title, title_local: a.titleLocal, preview: body.replace(/\s+/g, ' ').slice(0, 120) },
            link: a.link,
            actorId: user.id,
        });
    }
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
