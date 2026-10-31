// Sample emotion event records mirror the planned emotion payload fields.
export const emotionTimelineBySession = {
  'session-001': [
    { id: 'emotion-001-01', sessionId: 'session-001', emotion: 'neutral', confidence: 0.82, startTime: 4, endTime: 7 },
    { id: 'emotion-001-02', sessionId: 'session-001', emotion: 'happy', confidence: 0.76, startTime: 8, endTime: 12 },
    { id: 'emotion-001-03', sessionId: 'session-001', emotion: 'neutral', confidence: 0.87, startTime: 13, endTime: 17 },
    { id: 'emotion-001-04', sessionId: 'session-001', emotion: 'neutral', confidence: 0.81, startTime: 18, endTime: 22 },
    { id: 'emotion-001-05', sessionId: 'session-001', emotion: 'happy', confidence: 0.79, startTime: 23, endTime: 27 },
    { id: 'emotion-001-06', sessionId: 'session-001', emotion: 'neutral', confidence: 0.85, startTime: 28, endTime: 33 },
    { id: 'emotion-001-07', sessionId: 'session-001', emotion: 'happy', confidence: 0.77, startTime: 34, endTime: 38 },
    { id: 'emotion-001-08', sessionId: 'session-001', emotion: 'neutral', confidence: 0.83, startTime: 39, endTime: 42 },
  ],
  'session-002': [
    { id: 'emotion-002-01', sessionId: 'session-002', emotion: 'neutral', confidence: 0.84, startTime: 3, endTime: 8 },
    { id: 'emotion-002-02', sessionId: 'session-002', emotion: 'happy', confidence: 0.78, startTime: 9, endTime: 14 },
    { id: 'emotion-002-03', sessionId: 'session-002', emotion: 'neutral', confidence: 0.81, startTime: 15, endTime: 21 },
  ],
  'session-003': [
    { id: 'emotion-003-01', sessionId: 'session-003', emotion: 'neutral', confidence: 0.82, startTime: 2, endTime: 7 },
    { id: 'emotion-003-02', sessionId: 'session-003', emotion: 'happy', confidence: 0.8, startTime: 8, endTime: 13 },
    { id: 'emotion-003-03', sessionId: 'session-003', emotion: 'neutral', confidence: 0.86, startTime: 14, endTime: 19 },
  ],
}

export const getEmotionTimelineForSession = (sessionId) => emotionTimelineBySession[sessionId] ?? []
