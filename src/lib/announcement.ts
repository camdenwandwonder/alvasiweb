/** Today's date in Dutch time as YYYY-MM-DD. */
function todayNl(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The shop announcement when it is set and today falls within its dates. */
export function activeAnnouncement(company: {
  announcement_text?: string | null;
  announcement_from?: string | null;
  announcement_until?: string | null;
} | null): string | null {
  const text = company?.announcement_text?.trim();
  if (!text) return null;
  const today = todayNl();
  if (company?.announcement_from && today < company.announcement_from) return null;
  if (company?.announcement_until && today > company.announcement_until) return null;
  return text;
}
