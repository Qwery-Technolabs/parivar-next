import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { canSeeFamily, familyTreeData, getPerson } from '@/lib/family';

// The family tree page's data (components/members/family-tree-loader.jsx), in parts (lib/family familyTreeData):
//   ?married=1 — with married daughters' branches · ?details=1 — + birth date, marital status, relation names.
// The page links it with ?v=<version of this family> (familyTreeMeta): each version is kept by the browser for good,
// so opening the same tree again costs no request until a link or a person in that family changes.
export async function GET(request, { params }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const { id } = await params;
    const person = await getPerson(Number(id) || 0);
    if (!person) return NextResponse.json({ error: 'notFound' }, { status: 404 });
    const sp = request.nextUrl.searchParams;
    const family = await canSeeFamily(user, person);
    const data = await familyTreeData(person, family, { married: sp.get('married') === '1', details: sp.get('details') === '1' });
    return NextResponse.json(data, {
        // private: only this browser keeps it (what is in it depends on the viewer).
        headers: { 'Cache-Control': sp.get('v') ? 'private, max-age=31536000, immutable' : 'private, no-store', Vary: 'Cookie' },
    });
}
