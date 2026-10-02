import { Eraser } from 'lucide-react';
import { clearChat } from '@/app/actions/chat';
import ActionButton from '@/components/fundraise/action-button';

/**
 * Danger zone row (server component): delete the whole discussion of a group or fundraise, with a
 * sentence saying what it does and a confirmation. Shown to those with chatAccess.canClear.
 */
export default function ClearChatRow({ scope, scopeId, count, t }) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 flex-1">{t('chat.clearHint', { count })}</span>
            <ActionButton
                action={clearChat.bind(null, scope, scopeId)}
                confirm={t('chat.clearConfirm')}
                icon={<Eraser className="size-3.5" />}
                plain
                label={t('chat.clear')}
                className="bg-destructive text-white hover:bg-destructive/90 sm:px-2.5 max-sm:size-8 max-sm:justify-center max-sm:px-0"
            >
                <span className="hidden sm:inline">{t('chat.clear')}</span>
            </ActionButton>
        </li>
    );
}
