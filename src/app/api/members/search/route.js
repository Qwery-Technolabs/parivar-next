import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { seesAllNumbers } from '@/lib/contact-privacy';

// Options source for the member Combobox. Signed-in users only; returns at most 20.
//   ?surname=… — only that surname (family tree: father / brother / son come from the same line)
//   ?family=1  — include late (deceased) members, who can still be linked as relatives
//   ?group=<id> — only that group's members (a Mandal's team comes from the Mandal's group)
// A woman's number is in the results for women and admins only (lib/contact-privacy); men's for everyone.
export async function GET(request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const allNumbers = seesAllNumbers(user);
    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim().slice(0, 60);
    const surname = (sp.get('surname') || '').trim().slice(0, 60);
    const digits = q.replace(/\D/g, '');
    const params = { like: `%${q}%` };
    let where = sp.get('family') === '1' ? "u.status IN ('active', 'deceased')" : "u.status = 'active'";
    const group = Number(sp.get('group')) || 0;
    if (group > 0) {
        where += ' AND EXISTS (SELECT 1 FROM admin_group_members gm WHERE gm.group_id = :group AND gm.user_id = u.id)';
        params.group = group;
    }
    if (surname) {
        where += ' AND (u.surname = :surname OR u.surname_local = :surname)';
        params.surname = surname;
    }
    if (q) {
        where += ' AND (u.full_name LIKE :like OR u.full_name_local LIKE :like';
        if (digits.length >= 3) {
            // A man finds a woman by name, not by her number (unless he may see it — lib/contact-privacy).
            where += allNumbers ? ' OR u.phone LIKE :phone' : " OR (u.phone LIKE :phone AND (u.gender IS NULL OR u.gender <> 'female'))";
            params.phone = `%${digits}%`;
        }
        where += ')';
    }
    const rows = await query(
        `SELECT u.id, u.full_name, u.full_name_local, u.phone, u.gender, u.village, u.status
           FROM users_list u WHERE ${where} ORDER BY u.full_name LIMIT 20`,
        params,
    );
    return NextResponse.json(
        rows.map((r) => {
            // Women see every number, men every man's; a woman's number: women and admins only (lib/contact-privacy).
            const phone = r.gender === 'female' && !allNumbers && r.id !== user.id ? null : r.phone;
            return {
                value: String(r.id),
                label: r.full_name,
                labelLocal: r.full_name_local,
                hint: [phone, r.village, r.status === 'deceased' ? '✝' : null].filter(Boolean).join(' · '),
                phone,
            };
        }),
    );
}
