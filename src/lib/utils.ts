import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Рекурсивно преобразует BigInt в String для JSON-сериализации.
 * SQLite через Prisma возвращает BigInt для полей типа BigInt,
 * а JSON.stringify не поддерживает BigInt нативно.
 */
export function serializeBigInt<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return String(obj) as unknown as T
  if (obj instanceof Date) return obj.toISOString() as unknown as T
  if (Array.isArray(obj)) return obj.map(serializeBigInt) as unknown as T
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt((obj as Record<string, unknown>)[key])
      }
    }
    return result as T
  }
  return obj
}
