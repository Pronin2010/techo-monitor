/**
 * KMZ/KML парсер для наложения на карту Leaflet
 *
 * KMZ — это ZIP-архив с KML внутри (+ возможны картинки/иконки).
 * KML — XML-формат векторных геоданных (точки, линии, полигоны).
 *
 * Процесс: KMZ → unzip (fflate) → KML → DOMParser → @tmcw/togeojson → GeoJSON
 */

import { kml } from '@tmcw/togeojson'
import { unzipSync } from 'fflate'
import type { FeatureCollection } from 'geojson'

export interface KmzParseResult {
  geojson: FeatureCollection
  sourceType: 'kmz' | 'kml'
  fileName: string
}

/**
 * Парсит файл .kmz или .kml и возвращает GeoJSON FeatureCollection
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
 * Парсит KMZ-файл: распаковывает ZIP, находит KML, конвертирует в GeoJSON
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

  return {
    geojson: parseKmlString(kmlText),
    sourceType: 'kmz',
    fileName: file.name,
  }
}

/**
 * Парсит KML-файл
 */
async function parseKml(file: File): Promise<KmzParseResult> {
  const text = await file.text()

  return {
    geojson: parseKmlString(text),
    sourceType: 'kml',
    fileName: file.name,
  }
}

/**
 * Конвертирует KML-строку в GeoJSON FeatureCollection
 */
function parseKmlString(kmlText: string): FeatureCollection {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml')

  // Проверяем ошибки парсинга XML
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Ошибка парсинга KML: некорректный XML')
  }

  const geojson = kml(xmlDoc)

  if (!geojson.features || geojson.features.length === 0) {
    throw new Error('KML не содержит геоданных (точек, линий или полигонов)')
  }

  return geojson
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
