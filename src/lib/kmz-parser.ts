/**
 * KMZ/KML парсер для наложения на карту Leaflet
 *
 * KMZ — это ZIP-архив с KML внутри (+ возможны картинки/иконки).
 * KML — XML-формат геоданных: векторные (точки, линии, полигоны) + растровые (GroundOverlay).
 *
 * Процесс:
 *   Вектор: KMZ → unzip (fflate) → KML → DOMParser → @tmcw/togeojson → GeoJSON
 *   Растр:  KMZ → unzip → KML → парсинг <GroundOverlay> → ImageOverlay (base64 data URL)
 */

import { kml } from '@tmcw/togeojson'
import { unzipSync } from 'fflate'
import type { FeatureCollection } from 'geojson'

/** Растровый оверлей (GroundOverlay из KML) */
export interface GroundOverlayData {
  /** Уникальный ID для React key */
  id: string
  /** Название оверлея */
  name: string
  /** URL изображения (data:image/...;base64,... для KMZ, или оригинальный URL для KML) */
  imageUrl: string
  /** Границы: [[south, west], [north, east]] */
  bounds: [[number, number], [number, number]]
  /** Поворот в градусах (0 = без поворота) */
  rotation: number
  /** Прозрачность 0-1 (из <color> KML, alpha-канал) */
  opacity: number
}

export interface KmzParseResult {
  /** Векторные данные (точки, линии, полигоны) */
  geojson: FeatureCollection
  /** Растровые оверлеи (GroundOverlay — изображения на карте) */
  groundOverlays: GroundOverlayData[]
  sourceType: 'kmz' | 'kml'
  fileName: string
  /** Предупреждения при парсинге (для отображения пользователю) */
  warnings: string[]
}

/**
 * Парсит файл .kmz или .kml и возвращает GeoJSON + GroundOverlays
 */
export async function parseKmzFile(file: File): Promise<KmzParseResult> {
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.kmz')) {
    return parseKmz(file)
  } else if (fileName.endsWith('.kml')) {
    return parseKml(file)
  }

  throw new Error(`Неподдерживаемый формат файла: ${file.name}. Используйте .kmz или .kml`)
}

/**
 * Парсит KMZ-файл: распаковывает ZIP, находит KML, извлекает векторные и растровые данные
 */
async function parseKmz(file: File): Promise<KmzParseResult> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)
  const warnings: string[] = []

  // Распаковываем ZIP
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(uint8)
  } catch (e) {
    throw new Error('Не удалось распаковать KMZ-файл. Убедитесь, что файл не повреждён.')
  }

  // Список всех файлов в архиве (для диагностики)
  const allFiles = Object.keys(unzipped).filter(n => !n.startsWith('__MACOSX') && !n.endsWith('/'))

  // Ищем .kml файл внутри архива
  const kmlEntryName = allFiles.find(name => name.toLowerCase().endsWith('.kml'))

  if (!kmlEntryName) {
    throw new Error('В KMZ-архиве не найден KML-файл')
  }

  const kmlBytes = unzipped[kmlEntryName]
  const kmlText = new TextDecoder().decode(kmlBytes)

  // Базовая директория KML внутри архива
  const kmlDir = kmlEntryName.includes('/') ? kmlEntryName.substring(0, kmlEntryName.lastIndexOf('/') + 1) : ''

  // Парсим XML
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml')
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Ошибка парсинга KML: некорректный XML')
  }

  // Векторные данные
  const geojson = kml(xmlDoc)

  // Собираем все изображения из архива (для fallback-поиска)
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tif', 'tiff']
  const imageFiles = allFiles.filter(name => {
    const ext = name.toLowerCase().split('.').pop() || ''
    return imageExtensions.includes(ext)
  })

  // Растровые данные (GroundOverlay) — извлекаем изображения из архива
  const groundOverlays = parseGroundOverlays(xmlDoc, (imagePath: string) => {
    // Стратегия 1: Точное совпадение пути (с учётом kmlDir)
    const fullPath = resolveKmzPath(kmlDir, imagePath)
    const entry1 = findFileEntry(unzipped, fullPath)
    if (entry1) {
      console.log(`[KMZ] Изображение найдено (точный путь): ${imagePath} → ${entry1}`)
      return imageToDataUrl(unzipped, entry1)
    }

    // Стратегия 2: Поиск по имени файла (без пути)
    const fileName = imagePath.split('/').pop() || imagePath
    const entry2 = findFileEntry(unzipped, fileName)
    if (entry2) {
      console.log(`[KMZ] Изображение найдено (по имени): ${imagePath} → ${entry2}`)
      return imageToDataUrl(unzipped, entry2)
    }

    // Стратегия 3: Если href содержит "/files/" — попробовать без этого префикса
    if (imagePath.includes('/files/')) {
      const strippedPath = imagePath.split('/files/')[1]
      if (strippedPath) {
        const entry3 = findFileEntry(unzipped, strippedPath)
        if (entry3) {
          console.log(`[KMZ] Изображение найдено (без /files/): ${imagePath} → ${entry3}`)
          return imageToDataUrl(unzipped, entry3)
        }
      }
    }

    // Стратегия 4: Если есть только одно изображение в архиве — используем его
    if (imageFiles.length === 1) {
      console.log(`[KMZ] Изображение найдено (единственное в архиве): ${imagePath} → ${imageFiles[0]}`)
      return imageToDataUrl(unzipped, imageFiles[0])
    }

    // Стратегия 5: Если href — просто индекс (0, 1, ...) — попробовать i-й файл
    const index = parseInt(imagePath)
    if (!isNaN(index) && index < imageFiles.length) {
      console.log(`[KMZ] Изображение найдено (по индексу ${index}): → ${imageFiles[index]}`)
      return imageToDataUrl(unzipped, imageFiles[index])
    }

    // Не нашли
    console.warn(`[KMZ] Изображение НЕ найдено: "${imagePath}". Файлы в архиве:`, allFiles)
    warnings.push(`Изображение "${imagePath}" не найдено в KMZ-архиве`)
    return null
  })

  // Пустой GeoJSON допустим, если есть GroundOverlay
  const finalGeojson: FeatureCollection = (geojson.features && geojson.features.length > 0)
    ? geojson
    : { type: 'FeatureCollection', features: [] }

  if (finalGeojson.features.length === 0 && groundOverlays.length === 0) {
    throw new Error('KML не содержит геоданных (точек, линий, полигонов или растровых оверлеев)')
  }

  return {
    geojson: finalGeojson,
    groundOverlays,
    sourceType: 'kmz',
    fileName: file.name,
    warnings,
  }
}

/**
 * Конвертирует файл из архива в data URL
 */
function imageToDataUrl(archive: Record<string, Uint8Array>, entryName: string): string {
  const imageBytes = archive[entryName]
  const mimeType = guessMimeType(entryName)
  const base64 = arrayBufferToBase64(imageBytes)
  return `data:${mimeType};base64,${base64}`
}

/**
 * Парсит KML-файл (без ZIP-архива — изображения по внешним URL)
 */
async function parseKml(file: File): Promise<KmzParseResult> {
  const text = await file.text()
  const warnings: string[] = []

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Ошибка парсинга KML: некорректный XML')
  }

  const geojson = kml(xmlDoc)

  // Для KML без архива — картинки по оригинальным URL
  const groundOverlays = parseGroundOverlays(xmlDoc, (imagePath: string) => {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    warnings.push(`Локальное изображение "${imagePath}" недоступно — используйте .kmz вместо .kml`)
    return null
  })

  const finalGeojson: FeatureCollection = (geojson.features && geojson.features.length > 0)
    ? geojson
    : { type: 'FeatureCollection', features: [] }

  if (finalGeojson.features.length === 0 && groundOverlays.length === 0) {
    throw new Error('KML не содержит геоданных (точек, линий, полигонов или растровых оверлеев)')
  }

  return {
    geojson: finalGeojson,
    groundOverlays,
    sourceType: 'kml',
    fileName: file.name,
    warnings,
  }
}

/**
 * Парсит все <GroundOverlay> из KML XML-документа
 */
function parseGroundOverlays(
  xmlDoc: Document,
  resolveImage: (href: string) => string | null
): GroundOverlayData[] {
  const overlays: GroundOverlayData[] = []

  const groundOverlays = xmlDoc.getElementsByTagName('GroundOverlay')

  for (let i = 0; i < groundOverlays.length; i++) {
    const go = groundOverlays[i]

    // Имя
    const nameEl = go.getElementsByTagName('name')[0]
    const name = nameEl?.textContent?.trim() || `Оверлей ${i + 1}`

    // Изображение — пробуем несколько вариантов
    let href = ''

    // Вариант 1: <Icon><href>...</href></Icon>
    const iconEl = go.getElementsByTagName('Icon')[0]
    const hrefEl = iconEl?.getElementsByTagName('href')[0]
    href = hrefEl?.textContent?.trim() || ''

    // Вариант 2: <href> напрямую внутри GroundOverlay (нестандартный, но бывает)
    if (!href) {
      const directHref = go.getElementsByTagName('href')[0]
      href = directHref?.textContent?.trim() || ''
    }

    if (!href) {
      console.warn(`[KMZ] GroundOverlay "${name}" не содержит <href> — пропущен`)
      continue
    }

    console.log(`[KMZ] GroundOverlay "${name}": href="${href}"`)

    const imageUrl = resolveImage(href)
    if (!imageUrl) continue

    // Границы — пробуем LatLonBox и LatLonQuad
    const latLonBox = go.getElementsByTagName('LatLonBox')[0]
    const latLonQuad = go.getElementsByTagName('LatLonQuad')[0]

    let south = 0, north = 0, east = 0, west = 0, rotation = 0

    if (latLonBox) {
      north = parseFloat(latLonBox.getElementsByTagName('north')[0]?.textContent || '0')
      south = parseFloat(latLonBox.getElementsByTagName('south')[0]?.textContent || '0')
      east = parseFloat(latLonBox.getElementsByTagName('east')[0]?.textContent || '0')
      west = parseFloat(latLonBox.getElementsByTagName('west')[0]?.textContent || '0')
      rotation = parseFloat(latLonBox.getElementsByTagName('rotation')[0]?.textContent || '0')
    } else if (latLonQuad) {
      // LatLonQuad: <coordinates>south,west south,east north,east north,west</coordinates>
      const coordsText = latLonQuad.getElementsByTagName('coordinates')[0]?.textContent?.trim() || ''
      const coords = coordsText.split(/\s+/).map(pair => {
        const [lat, lon] = pair.split(',').map(Number)
        return { lat, lon }
      })
      if (coords.length >= 4) {
        south = Math.min(...coords.map(c => c.lat))
        north = Math.max(...coords.map(c => c.lat))
        west = Math.min(...coords.map(c => c.lon))
        east = Math.max(...coords.map(c => c.lon))
      }
    }

    if (north === 0 && south === 0 && east === 0 && west === 0) {
      console.warn(`[KMZ] GroundOverlay "${name}": координаты = 0 — пропущен`)
      continue
    }

    console.log(`[KMZ] GroundOverlay "${name}": bounds S=${south} W=${west} N=${north} E=${east}`)

    // Прозрачность из <color> (KML формат: aabbggrr)
    let opacity = 1
    const colorEl = go.getElementsByTagName('color')[0]
    if (colorEl?.textContent) {
      const colorHex = colorEl.textContent.trim()
      if (colorHex.length >= 2) {
        const alphaHex = colorHex.substring(0, 2)
        const alphaVal = parseInt(alphaHex, 16)
        if (!isNaN(alphaVal)) {
          opacity = alphaVal / 255
        }
      }
    }

    overlays.push({
      id: `ground-overlay-${i}`,
      name,
      imageUrl,
      bounds: [[south, west], [north, east]],
      rotation,
      opacity,
    })
  }

  console.log(`[KMZ] Найдено GroundOverlay: ${overlays.length}`)
  return overlays
}

/**
 * Разрешает относительный путь к файлу внутри KMZ-архива
 */
function resolveKmzPath(kmlDir: string, imagePath: string): string {
  if (imagePath.startsWith('/')) return imagePath.substring(1)
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath
  return kmlDir + imagePath
}

/**
 * Ищет файл в архиве KMZ, игнорируя регистр и __MACOSX
 */
function findFileEntry(archive: Record<string, Uint8Array>, path: string): string | null {
  const lowerPath = path.toLowerCase()

  // Точное совпадение
  if (archive[path]) return path

  // Без учёта регистра
  const found = Object.keys(archive).find(
    name => name.toLowerCase() === lowerPath && !name.startsWith('__MACOSX')
  )
  if (found) return found

  // Частичное совпадение (конец пути)
  const partialMatch = Object.keys(archive).find(
    name => name.toLowerCase().endsWith('/' + lowerPath) && !name.startsWith('__MACOSX')
  )
  if (partialMatch) return partialMatch

  // Совпадение только имени файла (без директории)
  const justName = lowerPath.split('/').pop() || lowerPath
  const nameMatch = Object.keys(archive).find(name => {
    const entryName = name.toLowerCase().split('/').pop() || ''
    return entryName === justName && !name.startsWith('__MACOSX')
  })
  if (nameMatch) return nameMatch

  return null
}

/**
 * Определяет MIME-тип по расширению файла
 */
function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'png': return 'image/png'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'gif': return 'image/gif'
    case 'bmp': return 'image/bmp'
    case 'webp': return 'image/webp'
    case 'tif':
    case 'tiff': return 'image/tiff'
    default: return 'image/png'
  }
}

/**
 * Конвертирует Uint8Array в base64-строку
 */
function arrayBufferToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk))
  }
  return btoa(binary)
}

/**
 * Возвращает количество объектов каждого типа в GeoJSON
 */
export function getGeoJsonStats(geojson: FeatureCollection): {
  points: number
  lines: number
  polygons: number
  total: number
} {
  let points = 0
  let lines = 0
  let polygons = 0

  for (const feature of geojson.features) {
    const geomType = feature.geometry?.type
    if (geomType === 'Point' || geomType === 'MultiPoint') {
      points++
    } else if (geomType === 'LineString' || geomType === 'MultiLineString') {
      lines++
    } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
      polygons++
    }
  }

  return { points, lines, polygons, total: geojson.features.length }
}
