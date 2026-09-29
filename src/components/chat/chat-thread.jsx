'use client';
import { Bell, BellRing, CalendarClock, Loader2, SendHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { deleteMessage, postMessage } from '@/app/actions/chat';
import { date as fmtDate, time as fmtTime } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

const POLL_MS = 10000;

// A stable colour per author, so a busy thread is scannable by who is speaking. Every
// value is ≥4.5:1 on white.
const NAME_COLOURS = ['text-rose-700', 'text-emerald-700', 'text-blue-800', 'text-purple-800', 'text-amber-800', 'text-teal-700', 'text-brand-navy'];
const colourFor = (id) => NAME_COLOURS[(id ?? 0) % NAME_COLOURS.length];

/**
 * @param {{ scope: string, scopeId: number, me: number, moderate: boolean,
 *           messages: Array<{ id: number, userId: number|null, name: string|null, nameLocal: string|null, body: string|null, at: string,
 *                             kind?: 'meeting'|null, data?: object|null }> }} props
 * A message with a `kind` is a system note (e.g. a meeting was scheduled), shown centred.
 */
export default function ChatThread({ scope, scopeId, me, moderate, canPost = true, canAlert = false, postRoles = [], paused = false, messages }) {
    const { t, locale } = useT();
    const router = useRouter();
    const scroller = useRef(null);
    const input = useRef(null);
    const [text, setText] = useState('');
    // Off by default: a normal message. On: it also notifies everyone (and turns off after sending).
    const [alert, setAlert] = useState(false);

    const [, send, sending] = useActionState(async (prev, fd) => {
        const res = await postMessage(prev, fd);
        if (res?.ok) {
            setText('');
            setAlert(false);
        }
        else toast.error(t(res?.error ?? 'common.error'));
        return res;
    }, null);

    // Stay pinned to the newest message whenever the list grows (new post or a poll).
    const lastId = messages.at(-1)?.id;
    useEffect(() => {
        const el = scroller.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [lastId]);

    // Poll while the page is visible — cheap, and no socket server to run. A hidden tab
    // does not poll at all.
    useEffect(() => {
        const timer = setInterval(() => {
            if (document.visibilityState === 'visible') router.refresh();
        }, POLL_MS);
        return () => clearInterval(timer);
    }, [router]);

    function submit(e) {
        e?.preventDefault();
        if (!text.trim() || sending) return;
        const fd = new FormData();
        fd.set('scope', scope);
        fd.set('scope_id', String(scopeId));
        fd.set('body', text);
        if (alert) fd.set('alert', '1');
        startTransition(() => send(fd));
        input.current?.focus();
    }

    function remove(id) {
        if (!window.confirm(t('chat.deleteConfirm'))) return;
        startTransition(async () => {
            const res = await deleteMessage(id);
            if (!res?.ok) toast.error(t(res?.error ?? 'common.error'));
        });
    }

    // A day chip goes above the first message of each day.
    const rows = messages.map((m, i) => ({ ...m, day: m.at.slice(0, 10), showDay: i === 0 || messages[i - 1].at.slice(0, 10) !== m.at.slice(0, 10) }));

    return (
        <div className="flex h-[calc(100dvh-15rem)] min-h-96 flex-col overflow-hidden rounded-lg border border-surface-border bg-surface-login">
            <div ref={scroller} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
                {messages.length === 0 && <p className="py-10 text-center text-sm text-ink-gray">{t('chat.empty')}</p>}
                {rows.map((m) => {
                    const mine = m.userId === me;
                    const name = (locale !== 'en' && m.nameLocal) || m.name || t('chat.formerMember');
                    return (
                        <div key={m.id}>
                            {m.showDay && (
                                <div className="my-2 flex justify-center">
                                    <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-medium text-ink-gray shadow-sm">
                                        {fmtDate(m.day, locale)}
                                    </span>
                                </div>
                            )}
                            {m.kind === 'meeting' ? (
                                <MeetingNote m={m} who={mine ? t('groups.you') : name} />
                            ) : m.kind === 'member' ? (
                                <MemberNote m={m} who={mine ? t('groups.you') : name} />
                            ) : (
                            <div className={`group flex ${mine ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`relative max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm sm:max-w-[70%] ${
                                        mine ? 'rounded-tr-none bg-orange-50' : 'rounded-tl-none bg-white'
                                    }`}
                                >
                                    {!mine && <p className={`text-xs font-semibold ${colourFor(m.userId)}`}>{name}</p>}
                                    {m.alert && (
                                        <p className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-900">
                                            <BellRing className="size-3" /> {t('chat.alertBadge')}
                                        </p>
                                    )}
                                    {m.body == null ? (
                                        <p className="text-sm italic text-ink-gray">{t('chat.deleted')}</p>
                                    ) : (
                                        <p className="whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>
                                    )}
                                    <p className="mt-0.5 text-right text-[10px] tabular-nums text-ink-gray">{fmtTime(m.at.slice(11, 16))}</p>
                                    {m.body != null && (mine || moderate) && (
                                        <button
                                            type="button"
                                            onClick={() => remove(m.id)}
                                            aria-label={t('common.delete')}
                                            className={`absolute top-1 hidden size-6 items-center justify-center rounded-full bg-white text-ink-gray shadow-sm hover:text-destructive group-hover:flex focus-visible:flex ${
                                                mine ? '-left-7' : '-right-7'
                                            }`}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {!canPost ? (
                <p className="border-t border-surface-border bg-white px-3 py-3 text-center text-xs text-ink-gray">
                    {paused ? t('chat.paused') : t('chat.restricted', { roles: postRoles.map((r) => t(`groups.roles.${r}`)).join(', ') })}
                </p>
            ) : (
            <form onSubmit={submit} className="flex items-end gap-2 border-t border-surface-border bg-white p-2">
                <textarea
                    ref={input}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        // Enter sends; Shift+Enter is a new line — the chat convention.
                        if (e.key === 'Enter' && !e.shiftKey) submit(e);
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder={t('chat.placeholder')}
                    className="max-h-32 min-h-9 min-w-0 flex-1 resize-none rounded-2xl border border-surface-border bg-white px-3 py-1.5 text-sm text-ink outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                {canAlert && (
                    <button
                        type="button"
                        onClick={() => setAlert((a) => !a)}
                        aria-pressed={alert}
                        aria-label={t('chat.alertToggle')}
                        title={alert ? t('chat.alertOn') : t('chat.alertOff')}
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${
                            alert ? 'border-amber-300 bg-amber-100 text-amber-900' : 'border-surface-border bg-white text-ink-gray hover:text-primary'
                        }`}
                    >
                        {alert ? <BellRing className="size-4" /> : <Bell className="size-4" />}
                    </button>
                )}
                <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    aria-label={alert ? t('chat.sendAlert') : t('chat.send')}
                    className="btn-secondary flex size-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
                </button>
            </form>
            )}
        </div>
    );
}

/** Centred system note — "Asha scheduled a meeting" with its title, when and where. */
function MeetingNote({ m, who }) {
    const { t, locale } = useT();
    const d = m.data ?? {};
    const title = (locale !== 'en' && d.title_local) || d.title || m.body;
    const when = [d.date && fmtDate(d.date, locale), d.time && fmtTime(d.time)].filter(Boolean).join(' · ');
    return (
        <div className="my-2 flex justify-center">
            <Link
                href="?tab=meetings"
                className="flex max-w-[90%] items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-900 shadow-sm hover:bg-amber-100 sm:max-w-[70%]"
            >
                <CalendarClock className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                    <span className="block">{t('chat.meetingNote', { name: who })}</span>
                    <span className="block font-semibold">{title}</span>
                    {(when || d.place) && <span className="block tabular-nums">{[when, d.place].filter(Boolean).join(' · ')}</span>}
                </span>
            </Link>
        </div>
    );
}

/** Centred grey note — "Asha added Ravi" / "Asha removed Ravi": the group's membership history. */
function MemberNote({ m, who }) {
    const { t, locale } = useT();
    const d = m.data ?? {};
    const list = (locale !== 'en' ? d.names_local : d.names) ?? d.names ?? [];
    const names = list.join(', ') + (d.more ? ` ${t('chat.andMore', { count: d.more })}` : '');
    return (
        <div className="my-1.5 flex justify-center">
            <span className="max-w-[90%] rounded-lg bg-white/80 px-3 py-1 text-center text-xs text-ink-gray shadow-sm sm:max-w-[70%]">
                {t(d.action === 'removed' ? 'chat.memberRemoved' : 'chat.memberAdded', { who, names })}
            </span>
        </div>
    );
}
