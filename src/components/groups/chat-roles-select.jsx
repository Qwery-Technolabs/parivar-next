'use client';
import { useState } from 'react';
import TagSelect from '@/components/ui/tag-select';
import { GROUP_ROLES } from '@/lib/group-roles';
import { useT } from '@/lib/i18n/client';

/**
 * "Who can send messages" in the group form: a tag selector of group roles, posted as
 * chat_roles[]. Admin always stays in — removing its chip puts it straight back — so a
 * group is never left with nobody able to post.
 * @param {{ defaultValue: string[] }} props
 */
export default function ChatRolesSelect({ defaultValue }) {
    const { t } = useT();
    const [roles, setRoles] = useState(defaultValue);
    const withAdmin = (next) => GROUP_ROLES.filter((r) => r === 'admin' || next.includes(r));
    return (
        <TagSelect
            name="chat_roles"
            label={t('groups.chatMode.label')}
            options={GROUP_ROLES.map((r) => ({ value: r, label: t(`groups.roles.${r}`) }))}
            value={roles}
            onChange={(next) => setRoles(withAdmin(next))}
            placeholder={t('groups.chatMode.placeholder')}
            emptyText={t('groups.chatMode.allChosen')}
        />
    );
}
