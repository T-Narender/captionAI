function write(level, message, details) {
  const timestamp = new Date().toISOString()
  const output = `[${timestamp}] ${level.toUpperCase()}: ${message}`
  if (details === undefined) {
    console[level](output)
  } else {
    console[level](output, details)
  }
}

export const logger = {
  info: (message, details) => write('info', message, details),
  warn: (message, details) => write('warn', message, details),
  error: (message, details) => write('error', message, details),
}
