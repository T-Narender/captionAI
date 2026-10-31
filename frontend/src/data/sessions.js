// Frontend-only sample sessions, shaped for a future sessions API response.
export const sessions = [
  { id: 'session-001', title: 'Project review', date: '2026-10-06', dateLabel: 'Today, 10:24 AM', durationSeconds: 1080, duration: '18 min', language: 'English', captionCount: 126, emotionSummary: 'Mostly neutral' },
  { id: 'session-002', title: 'Research discussion', date: '2026-10-05', dateLabel: 'Yesterday, 3:10 PM', durationSeconds: 1920, duration: '32 min', language: 'Hindi', captionCount: 214, emotionSummary: 'Mixed' },
  { id: 'session-003', title: 'Team check-in', date: '2026-10-03', dateLabel: 'Oct 3, 11:45 AM', durationSeconds: 720, duration: '12 min', language: 'Telugu', captionCount: 89, emotionSummary: 'Mostly positive' },
  { id: 'session-004', title: 'Design handoff', date: '2026-10-02', dateLabel: 'Oct 2, 2:30 PM', durationSeconds: 1560, duration: '26 min', language: 'English', captionCount: 178, emotionSummary: 'Mostly neutral' },
  { id: 'session-005', title: 'Weekly planning', date: '2026-09-30', dateLabel: 'Sep 30, 9:05 AM', durationSeconds: 1260, duration: '21 min', language: 'Hindi', captionCount: 143, emotionSummary: 'Mostly positive' },
  { id: 'session-006', title: 'Project introduction', date: '2026-09-28', dateLabel: 'Sep 28, 4:15 PM', durationSeconds: 900, duration: '15 min', language: 'Telugu', captionCount: 102, emotionSummary: 'Mixed' },
]

export const sessionStats = {
  totalSessions: sessions.length,
  totalDurationSeconds: sessions.reduce((total, session) => total + session.durationSeconds, 0),
  languagesUsed: new Set(sessions.map(({ language }) => language)).size,
}
