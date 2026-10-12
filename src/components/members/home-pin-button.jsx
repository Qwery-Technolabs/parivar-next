'use client';
import { Crosshair, Loader2, MapPin, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setHomeLocation } from '@/app/actions/home';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/client';

// The map is browser-only (Leaflet) and only needed once the picker opens.
const OsmMap = dynamic(() => import('@/components/maps/osm-map'), {
    ssr: false,
    loading: () => (
        <div className="flex h-72 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-ink-gray" />
        </div>
    ),
});

/**
 * Icon button beside the address (member edit): opens a map to set the home's exact spot — tap the map or drag
 * the pin, or "Use my current location". Saved on its own (actions/home.js), not with the form.
 * @param {{ userId: number, initial?: { lat: number, lng: number } | null }} props
 */
export default function HomePinButton({ userId, initial = null }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState(initial);
    const [pick, setPick] = useState(initial);
    const [locating, setLocating] = useState(false);
    const [pending, start] = useTransition();

    const locate = () => {
        if (!navigator.geolocation) return toast.error(t('home.noGeo'));
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (p) => {
                setPick({ lat: p.coords.latitude, lng: p.coords.longitude });
                setLocating(false);
            },
            () => {
                setLocating(false);
                toast.error(t('home.geoDenied'));
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };
    const save = (lat, lng) =>
        start(async () => {
            const res = await setHomeLocation(userId, lat, lng);
            if (res?.ok) {
                toast.success(t(res.message));
                setSaved(lat === '' ? null : { lat, lng });
                setOpen(false);
            } else toast.error(t(res?.error ?? 'common.error'));
        });

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setPick(saved);
                    setOpen(true);
                }}
                aria-label={t('home.setPin')}
                title={t('home.setPin')}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium ${saved ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'btn-secondary'}`}
            >
                <MapPin className="size-4" /> <span className="hidden sm:inline">{saved ? t('home.pinSet') : t('home.setPin')}</span>
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('home.setPin')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-xs text-ink-gray">{t('home.pickHint')}</p>
                        <OsmMap pick={pick ?? null} onPick={(lat, lng) => setPick({ lat, lng })} focus={pick} className="h-72 sm:h-96" />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={locate}
                                disabled={locating}
                                className="btn-secondary inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium"
                            >
                                {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} {t('home.useMyLocation')}
                            </button>
                            <div className="flex items-center gap-2">
                                {saved && (
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => window.confirm(t('home.clearConfirm')) && save('', '')}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-3 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60"
                                    >
                                        <Trash2 className="size-4" /> <span className="hidden sm:inline">{t('home.clear')}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={!pick || pending}
                                    onClick={() => save(pick.lat, pick.lng)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                                >
                                    {pending ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />} {t('home.save')}
                                </button>
                            </div>
                        </div>
                        {pick && (
                            <p className="text-[11px] text-ink-gray tabular-nums">
                                {pick.lat.toFixed(5)}, {pick.lng.toFixed(5)}
                            </p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
