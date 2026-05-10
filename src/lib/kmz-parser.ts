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

  // Распаковываем ZIP
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(uint8)
  } catch (e) {
    throw new Error('Не удалось распаковать KMZ-файл. Убедитесь, что файл не повреждён.')
  }

  // Ищем .kml файл внутри архива
  const kmlEntryName = Object.keys(unzipped).find(
    name => name.toLowerCase().endsWith('.kml') && !name.startsWith('__MACOSX')
  )

  if (!kmlEntryName) {
    throw new Error('В KMZ-архиве не найден KML-файл')
  }

  const kmlBytes = unzipped[kmlEntryName]
  const kmlText = new TextDecoder().decode(kmlBytes)

  // Базовая директория KML внутри архива (для разрешения относительных путей к картинкам)
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

  // Растровые данные (GroundOverlay) — извлекаем изображения из архива
  const groundOverlays = parseGroundOverlays(xmlDoc, (imagePath: string) => {
    // Разрешаем относительный путь к картинке внутри KMZ
    const fullPath = resolveKmzPath(kmlDir, imagePath)
    const imageEntry = findFileEntry(unzipped, fullPath)
    if (!imageEntry) return null

    const imageBytes = unzipped[imageEntry]
    const mimeType = guessMimeType(imageEntry)
    const base64 = arrayBufferToBase64(imageBytes)
    return `data:${mimeType};base64,${base64}`
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
  }
}

/**
 * Парсит KML-файл (без ZIP-архива — изображения по внешним URL)
 */
async function parseKml(file: File): Promise<KmzParseResult> {
  const text = await file.text()

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(text, 'text/xml')
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Ошибка парсинга KML: некорректный XML')
  }

  const geojson = kml(xmlDoc)

  // Для KML без архива — картинки по оригинальным URL (могут быть относительными — не загрузятся)
  const groundOverlays = parseGroundOverlays(xmlDoc, (imagePath: string) => {
    // Если URL абсолютный (http/https) — используем как есть
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath
    }
    // Относительный путь в KML без архива — не можем загрузить
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
  }
}

/**
 * Парсит все <GroundOverlay> из KML XML-документа
 *
 * KML GroundOverlay структура:
 * <GroundOverlay>
 *   <name>...</name>
 *   <Icon><href>path/to/image.png</href></Icon>
 *   <LatLonBox>
 *     <north>48.5</north>
 *     <south>45.0</south>
 *     <east>71.0</east>
 *     <west>48.0</west>
 *     <rotation>0</rotation>
 *   </LatLonBox>
 *   <color>aabbggrr</color>  <!-- опционально, alpha-канал = прозрачность -->
 * </GroundOverlay>
 */
function parseGroundOverlays(
  xmlDoc: Document,
  resolveImage: (href: string) => string | null
): GroundOverlayData[] {
  const overlays: GroundOverlayData[] = []

  // KML может использовать namespace — ищем с и без
  const groundOverlays = xmlDoc.getElementsByTagName('GroundOverlay')

  for (let i = 0; i < groundOverlays.length; i++) {
    const go = groundOverlays[i]

    // Имя
    const nameEl = go.getElementsByTagName('name')[0]
    const name = nameEl?.textContent?.trim() || `Оверлей ${i + 1}`

    // Изображение
    const iconEl = go.getElementsByTagName('Icon')[0]
    const hrefEl = iconEl?.getElementsByTagName('href')[0]
    const href = hrefEl?.textContent?.trim()

    if (!href) continue

    const imageUrl = resolveImage(href)
    if (!imageUrl) continue

    // Границы (LatLonBox)
    const latLonBox = go.getElementsByTagName('LatLonBox')[0]
    if (!latLonBox) continue

    const north = parseFloat(latLonBox.getElementsByTagName('north')[0]?.textContent || '0')
    const south = parseFloat(latLonBox.getElementsByTagName('south')[0]?.textContent || '0')
    const east = parseFloat(latLonBox.getElementsByTagName('east')[0]?.textContent || '0')
    const west = parseFloat(latLonBox.getElementsByTagName('west')[0]?.textContent || '0')
    const rotation = parseFloat(latLonBox.getElementsByTagName('rotation')[0]?.textContent || '0')

    if (north === 0 && south === 0 && east === 0 && west === 0) continue

    // Прозрачность из <color> (KML формат: aabbggrr, первые 2 символа = alpha)
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

  return overlays
}

/**
 * Разрешает относительный путь к файлу внутри KMZ-архива
 * Например: kmlDir="doc.kml/files/", imagePath="files/image.png" → "doc.kml/files/image.png"
 */
function resolveKmzPath(kmlDir: string, imagePath: string): string {
  // Уже абсолютный путь
  if (imagePath.startsWith('/')) return imagePath.substring(1)

  // URL — не относительный путь
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath

  // Относительный путь — склеиваем с директорией KML
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

  // Частичное совпадение (конец пути) — иногда пути в KMZ не совпадают точно
  const partialMatch = Object.keys(archive).find(
    name => name.toLowerCase().endsWith(lowerPath) && !name.startsWith('__MACOSX')
  )
  return partialMatch || null
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
    default: return 'image/png'  // по умолчанию
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
