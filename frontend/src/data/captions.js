// Sample caption event records mirror the planned caption/caption_update payload fields.
export const captionsBySession = {
  'session-001': [
    { id: 'caption-001-01', sessionId: 'session-001', startTime: 4, endTime: 7, text: 'Welcome everyone. Thanks for joining the project review.', language: 'English', emotion: 'neutral', confidence: 0.82 },
    { id: 'caption-001-02', sessionId: 'session-001', startTime: 8, endTime: 12, text: 'Today we will look at the progress we have made so far.', language: 'English', emotion: 'happy', confidence: 0.76 },
    { id: 'caption-001-03', sessionId: 'session-001', startTime: 13, endTime: 17, text: 'The first prototype is ready for an initial round of feedback.', language: 'English', emotion: 'neutral', confidence: 0.87 },
    { id: 'caption-001-04', sessionId: 'session-001', startTime: 18, endTime: 22, text: 'We still have a few details to refine before the next review.', language: 'English', emotion: 'neutral', confidence: 0.81 },
    { id: 'caption-001-05', sessionId: 'session-001', startTime: 23, endTime: 27, text: 'The team has done thoughtful work on the caption layout.', language: 'English', emotion: 'happy', confidence: 0.79 },
    { id: 'caption-001-06', sessionId: 'session-001', startTime: 28, endTime: 33, text: 'Let’s collect the remaining questions and assign follow-up tasks.', language: 'English', emotion: 'neutral', confidence: 0.85 },
    { id: 'caption-001-07', sessionId: 'session-001', startTime: 34, endTime: 38, text: 'We can share an updated version at our next check-in.', language: 'English', emotion: 'happy', confidence: 0.77 },
    { id: 'caption-001-08', sessionId: 'session-001', startTime: 39, endTime: 42, text: 'Thank you, everyone. That’s all for today.', language: 'English', emotion: 'neutral', confidence: 0.83 },
  ],
  'session-002': [
    { id: 'caption-002-01', sessionId: 'session-002', startTime: 3, endTime: 8, text: 'आज हम अपने शोध के मुख्य निष्कर्षों पर चर्चा करेंगे।', language: 'Hindi', emotion: 'neutral', confidence: 0.84 },
    { id: 'caption-002-02', sessionId: 'session-002', startTime: 9, endTime: 14, text: 'पहले चरण में हमें उपयोगी प्रतिक्रिया मिली है।', language: 'Hindi', emotion: 'happy', confidence: 0.78 },
    { id: 'caption-002-03', sessionId: 'session-002', startTime: 15, endTime: 21, text: 'अगली बैठक से पहले हम इन बिंदुओं की समीक्षा करेंगे।', language: 'Hindi', emotion: 'neutral', confidence: 0.81 },
  ],
  'session-003': [
    { id: 'caption-003-01', sessionId: 'session-003', startTime: 2, endTime: 7, text: 'ఈ రోజు మనం బృందం పురోగతిని సమీక్షిస్తాము.', language: 'Telugu', emotion: 'neutral', confidence: 0.82 },
    { id: 'caption-003-02', sessionId: 'session-003', startTime: 8, endTime: 13, text: 'కొత్త నమూనా సిద్ధంగా ఉంది.', language: 'Telugu', emotion: 'happy', confidence: 0.8 },
    { id: 'caption-003-03', sessionId: 'session-003', startTime: 14, endTime: 19, text: 'తదుపరి సమావేశానికి ముందు పనులను పూర్తి చేద్దాం.', language: 'Telugu', emotion: 'neutral', confidence: 0.86 },
  ],
  'session-004': [
    { id: 'caption-004-01', sessionId: 'session-004', startTime: 5, endTime: 10, text: 'Let’s walk through the latest design changes.', language: 'English', emotion: 'neutral', confidence: 0.86 },
    { id: 'caption-004-02', sessionId: 'session-004', startTime: 11, endTime: 16, text: 'The navigation is clearer on smaller screens now.', language: 'English', emotion: 'happy', confidence: 0.8 },
    { id: 'caption-004-03', sessionId: 'session-004', startTime: 17, endTime: 22, text: 'We will capture any remaining feedback in the notes.', language: 'English', emotion: 'neutral', confidence: 0.83 },
  ],
  'session-005': [
    { id: 'caption-005-01', sessionId: 'session-005', startTime: 4, endTime: 9, text: 'इस सप्ताह की प्राथमिकताओं से शुरुआत करते हैं।', language: 'Hindi', emotion: 'neutral', confidence: 0.85 },
    { id: 'caption-005-02', sessionId: 'session-005', startTime: 10, endTime: 15, text: 'पहला कार्य समय से पहले पूरा हो गया है।', language: 'Hindi', emotion: 'happy', confidence: 0.79 },
    { id: 'caption-005-03', sessionId: 'session-005', startTime: 16, endTime: 22, text: 'हम प्रगति की समीक्षा शुक्रवार को फिर करेंगे।', language: 'Hindi', emotion: 'neutral', confidence: 0.82 },
  ],
  'session-006': [
    { id: 'caption-006-01', sessionId: 'session-006', startTime: 3, endTime: 8, text: 'మన ప్రాజెక్ట్ పరిచయ సమావేశానికి స్వాగతం.', language: 'Telugu', emotion: 'happy', confidence: 0.78 },
    { id: 'caption-006-02', sessionId: 'session-006', startTime: 9, endTime: 14, text: 'ఈ రోజు లక్ష్యాలు మరియు ప్రణాళికను వివరిస్తాము.', language: 'Telugu', emotion: 'neutral', confidence: 0.84 },
    { id: 'caption-006-03', sessionId: 'session-006', startTime: 15, endTime: 20, text: 'మీ ప్రశ్నలను చివరలో చర్చిద్దాం.', language: 'Telugu', emotion: 'neutral', confidence: 0.81 },
  ],
}

export const getCaptionsForSession = (sessionId) => captionsBySession[sessionId] ?? []
