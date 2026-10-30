// Startup recovery must never release a lock still valid for an Agenda job.
// Per-job lock lifetimes must not exceed this shared default.
export const agendaLockLifetime = 10 * 60 * 1000;
