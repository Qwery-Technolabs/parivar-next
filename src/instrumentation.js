// Runs once per server start (Next 16). Starts the meeting-reminder loop in the Node runtime.
// On a host where the process sleeps between requests, /api/cron/reminders does the same job.
export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    const { startReminderLoop } = await import('./lib/reminders');
    startReminderLoop();
}
