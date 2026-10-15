export function imagePoint(x: number, y: number, width: number, height: number): [number, number] { return [(1 - y) * height, x * width]; }
export function normalizedPoint(lat: number, lng: number, width: number, height: number) {
  if (![lat, lng, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const x = lng / width, y = 1 - lat / height;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}
