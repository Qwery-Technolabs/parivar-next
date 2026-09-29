// Runs once per server start (Next 16). Starts the meeting-reminder loop in the Node runtime.
// On a host where the process sleeps between requests, /api/cron/reminders does the same job.
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    // Load the admin's project timezone before the first request uses "today" or the DB clock.
    try {
        const { getSettings } = await import('./lib/settings');
        await getSettings('admin');
    } catch (err) {
        console.error('timezone setting not loaded; using IST', err.message);
    }
    // Serverless (Vercel): no long-lived process to run a timer in; Vercel Cron calls
    // /api/cron/reminders instead (vercel.json).
    if (process.env.VERCEL) return;
    const { startReminderLoop } = await import('./lib/reminders');
    startReminderLoop();
}
