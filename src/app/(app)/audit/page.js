import { redirect } from 'next/navigation';

// The activity log lives in Settings now; old links (and filters) land there.
export default async function AuditPage({ searchParams }) {
    const sp = await searchParams;
    const params = new URLSearchParams({ section: 'audit' });
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && k !== 'section') params.set(k, v);
    redirect(`/settings?${params}`);
}
