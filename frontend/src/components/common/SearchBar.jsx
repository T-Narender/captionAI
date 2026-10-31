export default function SearchBar({ value, onChange, placeholder = 'Search session titles or transcript text' }) {
  return (
    <label className="block w-full sm:max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <span className="relative block">
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle">
          <circle cx="8.75" cy="8.75" r="5.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          maxLength={100}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </span>
    </label>
  )
}
