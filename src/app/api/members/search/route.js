import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';

// Options source for the member Combobox. Signed-in users only; returns at most 20.
export async function GET(request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
    const digits = q.replace(/\D/g, '');
    const params = { like: `%${q}%` };
    let where = "status = 'active'";
    if (q) {
        where += ' AND (full_name LIKE :like OR full_name_local LIKE :like';
        if (digits.length >= 3) {
            where += ' OR phone LIKE :phone';
            params.phone = `%${digits}%`;
        }
        where += ')';
    }
    const rows = await query(
        `SELECT id, full_name, full_name_local, phone, village FROM users_list WHERE ${where} ORDER BY full_name LIMIT 20`,
        params,
    );
    return NextResponse.json(
        rows.map((r) => ({
            value: String(r.id),
            label: r.full_name,
            labelLocal: r.full_name_local,
            hint: [r.phone, r.village].filter(Boolean).join(' · '),
            phone: r.phone,
        })),
    );
}
