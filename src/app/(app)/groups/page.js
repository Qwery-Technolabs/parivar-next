import { ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import GroupFormDialog from '@/components/groups/group-form-dialog';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { number } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { listGroups } from '@/lib/groups';
import { canManageGroups } from '@/lib/roles';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('groups.title') };
}

export default async function GroupsPage() {
    const user = await requireUser();
    const { t, locale } = await getT();
    const groups = await listGroups();

    return (
        <div>
            <PageHeader
                title={t('groups.title')}
                subtitle={t('groups.subtitle')}
                actions={canManageGroups(user.role) && <GroupFormDialog />}
            />
            {groups.length === 0 ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">
                    {t('groups.empty')}
                </p>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {groups.map((g) => (
                        <Link
                            key={g.id}
                            href={`/groups/${g.id}`}
                            className="block min-w-0 rounded-lg border border-surface-border bg-white p-4 shadow-sm hover:bg-accent/40"
                        >
                            <p className="break-words text-sm font-semibold text-primary">{localized(g, 'name', locale)}</p>
                            {locale === 'gu' && g.name_gu && <p className="text-xs text-ink-gray">{g.name}</p>}
                            <div className="mt-3 flex gap-4 text-xs text-ink-gray">
                                <span className="inline-flex items-center gap-1.5">
                                    <Users className="size-3.5" />
                                    <span className="tabular-nums">{number(g.members)}</span> {t('groups.members')}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <ShieldCheck className="size-3.5" />
                                    <span className="tabular-nums">{number(g.admins)}</span> {t('groups.admins')}
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
