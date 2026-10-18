'use client';
import { Monitor, Search, Smartphone, Users } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { selectInput, textInput } from '@/components/ui/field';
import { deviceName, isPhone } from '@/lib/device-name';
import { date, time } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

// DATETIME arrives as 'YYYY-MM-DD HH:MM:SS' (app timezone).
const when = (v, locale) => (v ? `${date(v, locale)}, ${time(String(v).slice(11, 16))}` : null);

/**
 * Settings → Samaj → Push notification: the two count boxes (People with notifications on · Devices), each a button
 * opening its list — People (one row per person: their devices) or Devices (one row per device: whose, turned on, last
 * notification). Searchable (name, village, device) and filterable: Phones / Computers, and for devices also "Got a
 * notification" / "Never got one". Each row opens the member's profile (⋮ → Notification devices there).
 * `devices`: [{ id, user_id, name, village, user_agent, created_at, last_used_at }] — active members only.
 * @param {{ stats: { people: number, devices: number }, devices: Array<object> }} props
 */
export default function PushReach({ stats, devices }) {
    const { t, locale } = useT();
    const [view, setView] = useState(null); // null | 'people' | 'devices'
    const [q, setQ] = useState('');
    const [kind, setKind] = useState('all'); // all | phone | computer
    const [got, setGot] = useState('all'); // all | yes | never (devices view)

    const open = (v) => {
        setQ('');
        setKind('all');
        setGot('all');
        setView(v);
    };
    const needle = q.trim().toLowerCase();
    const rows = useMemo(() => {
        const match = (d) =>
            (kind === 'all' || (kind === 'phone') === isPhone(d.user_agent)) &&
            (!needle || `${d.name} ${d.village ?? ''} ${deviceName(d.user_agent)}`.toLowerCase().includes(needle));
        if (view === 'devices') return devices.filter((d) => match(d) && (got === 'all' || (got === 'yes') === Boolean(d.last_used_at)));
        // People: grouped, keeping only their devices that match the filters.
        const byPerson = new Map();
        for (const d of devices.filter(match)) {
            const p = byPerson.get(d.user_id) ?? { user_id: d.user_id, name: d.name, village: d.village, devices: [] };
            p.devices.push(d);
            byPerson.set(d.user_id, p);
        }
        return [...byPerson.values()];
    }, [view, devices, kind, got, needle]);

    const box = (key, Icon, label, value) => (
        <button
            type="button"
            onClick={() => open(key)}
            className="rounded-lg border border-surface-border bg-white p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-gray">
                <Icon className="size-3.5" /> {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-primary">{value}</p>
            <p className="mt-0.5 text-[11px] text-ink-gray">{t('push.reach.open')}</p>
        </button>
    );

    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                {box('people', Users, t('push.admin.people'), stats.people)}
                {box('devices', Smartphone, t('push.admin.devices'), stats.devices)}
            </div>
            <Dialog open={view !== null} onOpenChange={(v) => !v && setView(null)}>
                <DialogContent focusPopup className="flex max-h-[92vh] flex-col bg-white sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">
                            {view === 'devices' ? t('push.admin.devices') : t('push.admin.people')}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">{t('push.reach.hint')}</DialogDescription>
                    </DialogHeader>
                    {/* People ⇄ Devices, then search + filters. */}
                    <div className="grid grid-cols-2 rounded-md bg-surface-bggray/70 p-0.5">
                        {[
                            ['people', Users, `${t('push.admin.people')} (${stats.people})`],
                            ['devices', Smartphone, `${t('push.admin.devices')} (${stats.devices})`],
                        ].map(([key, Icon, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setView(key)}
                                className={`inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded px-2 text-xs font-medium ${
                                    view === key ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'
                                }`}
                            >
                                <Icon className="size-3.5 shrink-0" /> <span className="truncate">{label}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative min-w-40 flex-1">
                            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-gray" />
                            <input
                                type="search"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={t('push.reach.search')}
                                aria-label={t('push.reach.search')}
                                className={`${textInput()} w-full pl-8`}
                            />
                        </div>
                        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('push.reach.kind')} className={`${selectInput()} w-auto`}>
                            <option value="all">{t('push.reach.kinds.all')}</option>
                            <option value="phone">{t('push.reach.kinds.phone')}</option>
                            <option value="computer">{t('push.reach.kinds.computer')}</option>
                        </select>
                        {view === 'devices' && (
                            <select value={got} onChange={(e) => setGot(e.target.value)} aria-label={t('push.reach.got')} className={`${selectInput()} w-auto`}>
                                <option value="all">{t('push.reach.gots.all')}</option>
                                <option value="yes">{t('push.reach.gots.yes')}</option>
                                <option value="never">{t('push.reach.gots.never')}</option>
                            </select>
                        )}
                    </div>
                    <p className="text-xs text-ink-gray">{t('push.reach.count', { count: rows.length })}</p>
                    <ul className="min-h-0 flex-1 divide-y divide-surface-border overflow-y-auto rounded-md border border-surface-border">
                        {rows.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-gray">{t('common.noResults')}</li>}
                        {view === 'devices'
                            ? rows.map((d) => {
                                  const Icon = isPhone(d.user_agent) ? Smartphone : Monitor;
                                  return (
                                      <li key={d.id}>
                                          <Link href={`/members/${d.user_id}`} className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent">
                                              <Icon className="mt-0.5 size-4 shrink-0 text-ink-gray" />
                                              <div className="min-w-0 flex-1 text-xs">
                                                  <p className="truncate text-sm font-medium text-primary">{d.name}</p>
                                                  <p className="truncate text-ink">
                                                      {deviceName(d.user_agent)}
                                                      {d.village ? ` · ${d.village}` : ''}
                                                  </p>
                                                  <p className="text-ink-gray">
                                                      {t('push.devices.since')}: {when(d.created_at, locale)} · {t('push.devices.lastSent')}:{' '}
                                                      {when(d.last_used_at, locale) ?? t('push.devices.never')}
                                                  </p>
                                              </div>
                                          </Link>
                                      </li>
                                  );
                              })
                            : rows.map((p) => (
                                  <li key={p.user_id}>
                                      <Link href={`/members/${p.user_id}`} className="flex items-start gap-3 px-3 py-2.5 hover:bg-accent">
                                          <Users className="mt-0.5 size-4 shrink-0 text-ink-gray" />
                                          <div className="min-w-0 flex-1 text-xs">
                                              <p className="truncate text-sm font-medium text-primary">{p.name}</p>
                                              {p.village && <p className="truncate text-ink-gray">{p.village}</p>}
                                              <p className="truncate text-ink">{p.devices.map((d) => deviceName(d.user_agent)).join(', ')}</p>
                                          </div>
                                          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 tabular-nums">
                                              {t('push.reach.devicesN', { count: p.devices.length })}
                                          </span>
                                      </Link>
                                  </li>
                              ))}
                    </ul>
                </DialogContent>
            </Dialog>
        </>
    );
}
