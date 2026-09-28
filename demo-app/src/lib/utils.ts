type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>

function normalizeClass(value: ClassValue): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap(normalizeClass)
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([className]) => className)
  }
  return [String(value)]
}

export function cn(...inputs: ClassValue[]) {
  return inputs.flatMap(normalizeClass).join(' ')
}
