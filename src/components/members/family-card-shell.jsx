'use client';
import { Route, Users } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/client';

/**
 * The Family card with a Family | Relation switch in its header — shown only when there is a
 * relation to show (someone else's profile, connected to the viewer). Family = the near
 * relatives list; Relation = how this person is related to the viewer. Both bodies are
 * rendered by the server and handed in; this only swaps them.
 */
export default function FamilyCardShell({ title, actions, family, relation }) {
    const { t } = useT();
    const [view, setView] = useState('family');
    const tabs = [
        { key: 'family', label: t('kin.tabFamily'), Icon: Users },
        { key: 'relation', label: t('kin.tabRelation'), Icon: Route },
    ];
    const toggle = relation && (
        <div role="tablist" className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
            {tabs.map(({ key, label, Icon }) => (
                <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={view === key}
                    aria-label={label}
                    title={label}
                    onClick={() => setView(key)}
                    className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium ${view === key ? 'seg-active' : 'text-ink-gray hover:text-primary'}`}
                >
                    <Icon className="size-3.5" /> <span className="hidden sm:inline">{label}</span>
                </button>
            ))}
        </div>
    );
    return (
        <Card
            title={title}
            bodyClass=""
            actions={
                (toggle || actions) && (
                    <div className="flex items-center gap-1.5">
                        {toggle}
                        {actions}
                    </div>
                )
            }
        >
            {view === 'relation' && relation ? relation : family}
        </Card>
    );
}
