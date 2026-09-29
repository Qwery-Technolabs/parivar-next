'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { safeNext } from '@/lib/url';

/** Mark one notification read and go to what it is about. Only the owner's rows are touched. */
export async function openNotification(formData) {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    const id = Number(formData?.get?.('id')) || 0;
    const n = await queryOne('SELECT link FROM users_notifications WHERE id = :id AND user_id = :uid', { id, uid: user.id });
    if (!n) redirect('/notifications');
    await query('UPDATE users_notifications SET read_at = NOW() WHERE id = :id AND user_id = :uid AND read_at IS NULL', {
        id,
        uid: user.id,
    });
    revalidatePath('/', 'layout'); // the bell's count lives in the shared layout
    redirect(safeNext(n.link, '/notifications'));
}

export async function markAllRead() {
    const user = await getCurrentUser();
    if (!user) return;
    await query('UPDATE users_notifications SET read_at = NOW() WHERE user_id = :uid AND read_at IS NULL', { uid: user.id });
    revalidatePath('/', 'layout');
}
