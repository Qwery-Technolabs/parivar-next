import Link from 'next/link';
import { notFound } from 'next/navigation';
import GroupFormDialog from '@/components/groups/group-form-dialog';
import GroupMembers from '@/components/groups/group-members';
import PageHeader, { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { canManageGroup } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { date } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getGroup, groupFundraises, groupMembers } from '@/lib/groups';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const g = await getGroup(Number(id) || 0);
    const { locale } = await getT();
    return { title: g ? localized(g, 'name', locale) : undefined };
}

export default async function GroupPage({ params }) {
    const { id } = await params;
    const user = await requireUser();
    const group = await getGroup(Number(id) || 0);
    if (!group) notFound();
    const { t, locale } = await getT();
    const [members, fundraises, canManage] = await Promise.all([
        groupMembers(group.id),
        groupFundraises(group.id),
        canManageGroup(user, group.id),
    ]);
    const name = localized(group, 'name', locale);

    return (
        <div>
            <PageHeader
                title={name}
                subtitle={group.meta.description || undefined}
                back={{ href: '/groups', label: t('groups.title') }}
                actions={canManage && <GroupFormDialog group={group} />}
            />
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <GroupMembers groupId={group.id} members={members} canManage={canManage} currentUserId={user.id} />
                <Card title={t('groups.fundraises')} bodyClass="" className="theme-fundraise h-fit">
                    {fundraises.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-ink-gray">{t('fundraise.empty')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {fundraises.map((f) => (
                                <li key={f.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                                    <div className="min-w-0">
                                        <Link href={`/fundraise/${f.id}`} className="break-words font-medium text-primary hover:underline">
                                            {localized(f, 'title', locale)}
                                        </Link>
                                        {f.start_date && (
                                            <p className="text-xs text-ink-gray">
                                                {date(f.start_date, locale)}
                                                {f.end_date && ` – ${date(f.end_date, locale)}`}
                                            </p>
                                        )}
                                    </div>
                                    <Badge status={f.status}>{t(`fundraise.${f.status}`)}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>
        </div>
    );
}
