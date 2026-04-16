// src/lib/popularity.ts
import type { PopularityResult } from '@/types'
import fs from 'fs'
import path from 'path'

/**
 * Lazy-loaded singleton data:
 *   nameFreqMap    - maps given-name (without surname) to occurrence count
 *   namePercentile - maps given-name to its percentile rank (0-100) among names of the same length
 */
let nameFreqMap: Map<string, number> | null = null
let namePercentile: Map<string, number> | null = null

/**
 * Load the names corpus and build a frequency map keyed by given-name (without surname).
 * Uses a singleton pattern so the file is only read once.
 *
 * File format: each data line is "全名,性别" (full name, gender).
 * We skip the first 3 header lines (source, date, blank) and the column header line.
 * For each full name with length >= 2, the surname is the first character
 * and the given-name (nameOnly) is the remaining characters.
 */
function loadNameData(): { freqMap: Map<string, number>; percentileMap: Map<string, number> } {
  if (nameFreqMap && namePercentile) {
    return { freqMap: nameFreqMap, percentileMap: namePercentile }
  }

  const corpusPath = path.resolve(process.cwd(), 'data/names_corpus_gender.txt')
  const content = fs.readFileSync(corpusPath, 'utf-8')

  // Remove BOM if present
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/)

  const freq = new Map<string, number>()

  // Skip first 4 lines: source header, date, blank line, column header ("dict,sex")
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const commaIdx = line.indexOf(',')
    const fullName = commaIdx >= 0 ? line.substring(0, commaIdx).trim() : line.trim()

    if (fullName.length < 2) continue

    // First char is surname, the rest is the given-name
    const nameOnly = fullName.substring(1)
    if (nameOnly.length < 1) continue

    freq.set(nameOnly, (freq.get(nameOnly) || 0) + 1)
  }

  // Compute percentile ranking per name length.
  // Group names by length, sort by count, and assign percentile (0-100).
  const byLength = new Map<number, Array<{ name: string; count: number }>>()
  for (const [name, count] of Array.from(freq.entries())) {
    const len = name.length
    const arr = byLength.get(len) || []
    arr.push({ name, count })
    byLength.set(len, arr)
  }

  const percentile = new Map<string, number>()
  for (const [, arr] of Array.from(byLength.entries())) {
    // Sort ascending by count
    arr.sort((a: { name: string; count: number }, b: { name: string; count: number }) => a.count - b.count)
    const total = arr.length
    for (let i = 0; i < total; i++) {
      // Percentile: what fraction of names have a count <= this name's count
      const p = Math.round(((i + 1) / total) * 100)
      percentile.set(arr[i].name, p)
    }
  }

  nameFreqMap = freq
  namePercentile = percentile
  return { freqMap: nameFreqMap, percentileMap: namePercentile }
}

/**
 * Analyze the popularity of a given name (nameOnly, without surname).
 *
 * Uses percentile-based thresholds relative to other names of the same length,
 * so that common 2-char names and common 1-char names are both correctly
 * classified despite having very different raw counts.
 *
 * @param nameOnly - The given-name portion (e.g. "子轩"), without surname
 * @returns PopularityResult with level, count, homophoneCount, and score
 */
export function analyzeNamePopularity(nameOnly: string): PopularityResult {
  const { freqMap, percentileMap } = loadNameData()

  const count = freqMap.get(nameOnly) || 0

  // Simplified homophone approximation: count entries with same character length
  // but different characters. This serves as a rough proxy for names that
  // sound similar (homophones) without requiring a full pinyin lookup.
  let homophoneCount = 0
  const nameLen = nameOnly.length

  for (const [key, val] of Array.from(freqMap.entries())) {
    if (key.length === nameLen && key !== nameOnly) {
      homophoneCount += val
    }
  }

  // Cap at 99999
  homophoneCount = Math.min(homophoneCount, 99999)

  // Determine level and score based on percentile rank.
  // Higher percentile = more common = higher duplication risk.
  // The score reflects "时代适用性" (era-appropriateness): very common names
  // score low (high duplication risk), rare names score high (more unique).
  const percentile = percentileMap.get(nameOnly) || 0

  let level: PopularityResult['level']
  let score: number

  if (percentile >= 95) {
    level = '极高'
    score = 2
  } else if (percentile >= 80) {
    level = '高'
    score = 4
  } else if (percentile >= 50) {
    level = '中等'
    score = 5
  } else if (percentile >= 20) {
    level = '低'
    score = 5
  } else {
    level = '极低'
    score = 5
  }

  return { level, count, homophoneCount, score }
}
