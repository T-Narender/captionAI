export default function FilterBar({ language, onLanguageChange, date, onDateChange, onClear }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">Language</span>
        <select
          value={language}
          onChange={(event) => onLanguageChange(event.target.value)}
          className="min-h-11 min-w-36 rounded-md border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="all">All languages</option>
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
          <option value="Telugu">Telugu</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted">Date</span>
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <button type="button" onClick={onClear} className="min-h-11 rounded-md px-3 text-sm font-semibold text-brand hover:bg-brand-soft focus-visible:outline-offset-2">
        Clear filters
      </button>
    </div>
  )
}
