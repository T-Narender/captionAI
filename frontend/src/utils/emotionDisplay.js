const emotionPresentation = {
  angry: { emoji: '😠', label: 'Angry' },
  happy: { emoji: '😊', label: 'Happy' },
  neutral: { emoji: '😐', label: 'Neutral' },
  sad: { emoji: '😢', label: 'Sad' },
}

export function getEmotionPresentation(emotion) {
  return emotionPresentation[emotion] ?? null
}
