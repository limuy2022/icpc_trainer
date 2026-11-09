export function ratingRange(rating?: number | null) {
  if (rating == null || !Number.isInteger(rating) || rating < 0 || rating > 5000)
    return { min: 1400, max: 1800 };
  const clamp = (value: number) => Math.max(800, Math.min(3500, value));
  return { min: clamp(rating - 100), max: clamp(rating + 300) };
}
export function difficultyOptions(selected: number) {
  return [...new Set([...Array.from({length:28},(_,i)=>800+i*100),selected])].sort((a,b)=>a-b);
}
