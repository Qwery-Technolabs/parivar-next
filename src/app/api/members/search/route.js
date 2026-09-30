import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { canManageMembers } from '@/lib/roles';

// Options source for the member Combobox. Signed-in users only; returns at most 20.
//   ?surname=… — only that surname (family tree: father / brother / son come from the same line)
//   ?family=1  — include late (deceased) members, who can still be linked as relatives
// Phone numbers of relatives added from a family tree are private: shown to member managers only.
export async function GET(request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim().slice(0, 60);
    const surname = (sp.get('surname') || '').trim().slice(0, 60);
    const digits = q.replace(/\D/g, '');
    const params = { like: `%${q}%` };
    let where = sp.get('family') === '1' ? "u.status IN ('active', 'deceased')" : "u.status = 'active'";
    if (surname) {
        where += ' AND (u.surname = :surname OR u.surname_local = :surname)';
        params.surname = surname;
    }
    if (q) {
        where += ' AND (u.full_name LIKE :like OR u.full_name_local LIKE :like';
        if (digits.length >= 3) {
            where += ' OR u.phone LIKE :phone';
            params.phone = `%${digits}%`;
        }
        where += ')';
    }
    const rows = await query(
        `SELECT u.id, u.full_name, u.full_name_local, u.phone, u.village, u.status,
                (SELECT meta_value FROM users_listmeta m WHERE m.user_id = u.id AND m.meta_key = 'added_via') AS added_via
           FROM users_list u WHERE ${where} ORDER BY u.full_name LIMIT 20`,
        params,
    );
    const manager = canManageMembers(user.role);
    return NextResponse.json(
        rows.map((r) => {
            const phone = r.added_via === 'family' && !manager ? null : r.phone;
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
