# Hybrid Pipeline Naming Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pure-LLM naming flow with a four-stage pipeline (命理筛选 → RAG检索 → LLM约束生成 → 评分验证) that produces quantitatively scored name cards.

**Architecture:** New `/api/naming` SSE endpoint runs four stages server-side, reusing existing scoring modules (wuxing, sancai-wuge, phonetic, glyph, popularity) and RAG retriever. Chat page triggers pipeline on first message, renders `NameScoreCard` components. Subsequent chat still uses `/api/chat`.

**Tech Stack:** Next.js App Router (SSE), Anthropic SDK (streaming), existing scoring libs, ClassicRetriever (RAG), better-sqlite3 (name memory), React (client components)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/naming-events.ts` | Create | SSE event types for naming pipeline |
| `src/lib/candidate-filter.ts` | Create | Build candidate char pool from wuxing + avoidChars + dislikedChars |
| `src/app/api/naming/route.ts` | Create | Four-stage SSE pipeline endpoint |
| `src/components/NameScoreCard.tsx` | Create | Score card UI component |
| `src/lib/llm.ts` | Modify | Enhance `getSystemPrompt` to accept pipeline context |
| `src/app/chat/page.tsx` | Modify | First message → `/api/naming`, render score cards |
| `src/app/results/page.tsx` | Modify | naming mode reads real data from sessionStorage |

---

### Task 1: Create naming pipeline event types

**Files:**
- Create: `src/types/naming-events.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/types/naming-events.ts

/** 候选字池 */
export interface CandidateCharPool {
  primary: string[]    // 喜用神匹配的字
  secondary: string[]  // 其他常用字
  xiYong: string[]     // 喜用神五行
  jiShen: string[]     // 忌神五行
}

/** 六维评分 */
export interface NameScores {
  wuxingBenefit: number  // /25
  sancaiWuge: number     // /20
  phonetic: number       // /20
  meaning: number        // /20
  glyph: number          // /10
  popularity: number     // /5
}

/** 评分后的名字 */
export interface ScoredName {
  name: string
  surname: string
  givenName: string
  pinyin: string
  scores: NameScores
  totalScore: number
  wuxingTags: string[]
  strokes: number[]
  classicSource?: string
  meaningText?: string
  harmonyWarnings?: string[]
  nameId?: number
}

/** 流水线阶段 */
export type NamingStep = 'filtering' | 'rag' | 'generating' | 'scoring'

/** 阶段进度事件 */
export interface NamingStepEvent {
  step: NamingStep
  status: 'running' | 'done'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  chunk?: string
}

/** 完成事件 */
export interface NamingCompleteEvent {
  type: 'complete'
  data: {
    names: ScoredName[]
    candidateChars?: CandidateCharPool
  }
}

/** 流水线请求 */
export interface NamingRequest {
  surname: string
  gender: '男' | '女' | '未定'
  birthTime?: string
  expectations?: string
  avoidChars?: string
  namingMode: '传统' | '文学' | '现代' | '混合'
  nameLength?: 1 | 2 | '不限'
  motherSurname?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/naming-events.ts
git commit -m "feat: add naming pipeline event types"
```

---

### Task 2: Create candidate char filter module

**Files:**
- Create: `src/lib/candidate-filter.ts`

- [ ] **Step 1: Create the filter module**

This module builds the candidate char pool by filtering `char_info.json` against wuxing preferences and exclusion lists.

```typescript
// src/lib/candidate-filter.ts
import { getWuxing, getNameChars, getCharacterInfo } from './character'
import { getDislikedChars } from './db'
import type { CandidateCharPool } from '@/types/naming-events'

/**
 * 构建候选字池
 * @param xiYong 喜用神五行（如 ['木', '水']）
 * @param gender 性别，用于筛选常用字
 * @param avoidChars 用户指定避免的字
 * @param maxPrimary 喜用神匹配字上限
 * @param maxSecondary 其他常用字上限
 */
export function buildCandidateCharPool(
  xiYong: string[],
  gender: '男' | '女' | '未定',
  avoidChars: string[] = [],
  maxPrimary: number = 80,
  maxSecondary: number = 40,
): CandidateCharPool {
  const disliked = getDislikedChars()
  const excludeSet = new Set([...avoidChars, ...disliked])

  // 获取取名常用字
  const genderKey = gender === '男' ? 'boy' : gender === '女' ? 'girl' : undefined
  const allNameChars = getNameChars(genderKey)

  // 按五行分组
  const primaryChars: string[] = []
  const secondaryChars: string[] = []

  for (const char of allNameChars) {
    if (excludeSet.has(char)) continue
    const info = getCharacterInfo(char)
    if (!info) continue

    if (xiYong.length > 0 && xiYong.includes(info.wuxing)) {
      if (primaryChars.length < maxPrimary) primaryChars.push(char)
    } else {
      if (secondaryChars.length < maxSecondary) secondaryChars.push(char)
    }
  }

  return {
    primary: primaryChars,
    secondary: secondaryChars,
    xiYong,
    jiShen: [],
  }
}

/**
 * 无八字时构建通用候选字池（不按五行筛选）
 */
export function buildGenericCharPool(
  gender: '男' | '女' | '未定',
  avoidChars: string[] = [],
  maxChars: number = 100,
): CandidateCharPool {
  const disliked = getDislikedChars()
  const excludeSet = new Set([...avoidChars, ...disliked])

  const genderKey = gender === '男' ? 'boy' : gender === '女' ? 'girl' : undefined
  const allNameChars = getNameChars(genderKey)

  const chars: string[] = []
  for (const char of allNameChars) {
    if (excludeSet.has(char)) continue
    if (chars.length >= maxChars) break
    chars.push(char)
  }

  return {
    primary: chars,
    secondary: [],
    xiYong: [],
    jiShen: [],
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/candidate-filter.ts
git commit -m "feat: add candidate char filter for naming pipeline"
```

---

### Task 3: Enhance getSystemPrompt to accept pipeline context

**Files:**
- Modify: `src/lib/llm.ts`

- [ ] **Step 1: Update getSystemPrompt signature and body**

Replace the current `getSystemPrompt(dislikedChars?, dislikedNames?)` with an options-object signature. Keep backward compatibility by checking if first arg is an array (old style) or object (new style).

In `src/lib/llm.ts`, replace the `getSystemPrompt` function (lines 72-127) with:

```typescript
/** getSystemPrompt 选项 */
export interface SystemPromptOptions {
  dislikedChars?: string[]
  dislikedNames?: string[]
  candidateChars?: string[]
  ragContext?: string
  xiYong?: string[]
  jiShen?: string[]
  namingMode?: string
}

/**
 * 获取系统提示词（取名模式）
 */
export function getSystemPrompt(
  optionsOrChars?: string[] | SystemPromptOptions,
  dislikedNames?: string[]
): string {
  // Backward compat: if first arg is array, treat as old-style (dislikedChars, dislikedNames)
  let options: SystemPromptOptions
  if (Array.isArray(optionsOrChars)) {
    options = { dislikedChars: optionsOrChars, dislikedNames }
  } else {
    options = optionsOrChars || {}
  }

  const {
    dislikedChars,
    dislikedNames: dn,
    candidateChars,
    ragContext,
    xiYong,
    jiShen,
    namingMode,
  } = options

  let prompt = `你是一位专业、客观的中文取名顾问，精通传统文化和现代审美。

你的能力：
1. 为新生儿取名：根据用户需求生成合适的名字
2. 分析已有名字：客观解析名字的真实优劣

**重要原则：**
- 必须客观公正，好就是好，坏就是坏，不要回避问题
- 不要一味说好话，要指出名字的真实优缺点
- 推荐名字时要实事求是，不要过度美化
- 如果名字有问题，直接指出，不要拐弯抹角
- 尊重传统但不迷信，注重文化内涵
- 名字要好听、好写、好记
- 避免生僻字、不雅谐音

**评分锚定规则：**
- 90+ 分：各维度都优秀，极少数名字能达到
- 80-89 分：多数维度优秀，个别有瑕疵
- 70-79 分：普通好名字，有一定优点
- 60-69 分：有较明显问题
- <60 分：有严重问题

**禁止"和稀泥"：**
- 差就是差，不用"尚可""还行""基本可以"等模糊词
- 五行/三才五格的解读必须引用具体数据，不能泛泛而谈

取名策略：
- 文学模式：从诗经楚辞唐诗宋词中寻找灵感，注重意境和韵律
- 传统模式：考虑五行八字、三才五格，以命理为核心
- 现代模式：注重实用性，避免生僻字
- 混合模式：综合考虑以上因素

**重要：名字展示格式要求**
推荐名字时，必须使用以下格式：

## 推荐名字

### 1. 【名字】(拼音)
- **出处**：引用的诗句或典故（如无则写"无特定出处"）
- **寓意**：名字的含义解释
- **五行**：字的五行属性
- **音律**：声调搭配分析
- **注意**：潜在的问题或不足（如谐音、生僻程度等，没有则写"无明显问题"）

请严格按照此格式展示每个推荐的名字，确保拼音准确，并客观指出每个名字的优缺点。`

  // 候选字池约束
  if (candidateChars && candidateChars.length > 0) {
    prompt += `\n\n**候选字约束：**\n请从以下候选字中组合名字：${candidateChars.join('、')}。\n这些字已根据五行喜用神筛选，优先使用喜用神匹配的字。不要使用候选字池以外的字。`
  }

  // RAG诗词典故
  if (ragContext) {
    prompt += `\n\n**可参考的诗词典故：**\n${ragContext}`
  }

  // 喜用神/忌神
  if (xiYong && xiYong.length > 0) {
    prompt += `\n\n**命理约束：**\n- 喜用神：${xiYong.join('、')}（名字五行宜包含喜用神）\n- 忌神：${jiShen?.join('、') || '无'}（名字五行宜避免忌神）`
  }

  // 取名模式强化
  if (namingMode) {
    const modeGuidance: Record<string, string> = {
      '传统': '请重点考虑五行八字和三才五格，确保命理配置优良。',
      '文学': '请重点从诗词典故中取意，注重意境美和音律美。',
      '现代': '请注重实用性，选择易读易写、避免生僻的字，兼顾现代审美。',
      '混合': '请综合考虑命理、文化、实用性，平衡各维度。',
    }
    if (modeGuidance[namingMode]) {
      prompt += `\n\n**模式强调：**${modeGuidance[namingMode]}`
    }
  }

  // 排除规则
  if (dislikedChars && dislikedChars.length > 0) {
    prompt += `\n\n**用户偏好排除规则：**\n- 以下字已被用户标记为不喜欢，请不要在推荐名字中使用：${dislikedChars.join('、')}`
  }
  const effectiveDislikedNames = dn || dislikedNames
  if (effectiveDislikedNames && effectiveDislikedNames.length > 0) {
    prompt += `\n- 以下完整名字已被标记为不喜欢，请不要推荐：${effectiveDislikedNames.join('、')}`
  }

  return prompt
}
```

- [ ] **Step 2: Update the call site in `src/app/api/chat/route.ts`**

The current call on line 22 is:
```typescript
system: getSystemPrompt(getDislikedChars(), getDislikedNames().map(n => n.name)),
```

This still works with the backward-compat signature (first arg is `string[]`). No change needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm.ts
git commit -m "feat: enhance getSystemPrompt with pipeline context options"
```

---

### Task 4: Create the naming pipeline API

**Files:**
- Create: `src/app/api/naming/route.ts`

- [ ] **Step 1: Create the four-stage pipeline endpoint**

```typescript
// src/app/api/naming/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getSystemPrompt } from '@/lib/llm'
import { getCharacterInfo, getPinyin } from '@/lib/character'
import { analyzeSanCaiWuGeEnhanced } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { calculateBaZi, parseBirthTime, analyzeWuxingBenefit } from '@/lib/wuxing'
import { analyzeGlyph } from '@/lib/glyph'
import { analyzeNamePopularity } from '@/lib/popularity'
import { saveName, getDislikedChars, getDislikedNames } from '@/lib/db'
import { buildCandidateCharPool, buildGenericCharPool } from '@/lib/candidate-filter'
import { getRetriever } from '@/lib/rag'
import type { NamingStepEvent, NamingCompleteEvent, ScoredName, NamingRequest, CandidateCharPool } from '@/types/naming-events'

export const maxDuration = 120

/** SSE helper */
function sendEvent(controller: ReadableStreamDefaultController, event: NamingStepEvent | NamingCompleteEvent): void {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`))
}

/** Timer helper */
function timed<T>(fn: () => T): { result: T; duration: number } {
  const start = Date.now()
  const result = fn()
  return { result, duration: Date.now() - start }
}

export async function POST(req: Request) {
  const body: NamingRequest = await req.json()
  const config = loadModelConfig()

  if (!body.surname) {
    return new Response(JSON.stringify({ error: '请提供姓氏' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ===== Stage 1: filtering =====
        sendEvent(controller, { step: 'filtering', status: 'running' })

        let baZi = null
        let xiYong: string[] = []
        let jiShen: string[] = []
        let candidatePool: CandidateCharPool

        const { result: filterResult, duration: filterDuration } = timed(() => {
          const avoidCharsList = (body.avoidChars || '').split(/[,，、\s]/).filter(Boolean)

          if (body.birthTime) {
            const parsed = parseBirthTime(body.birthTime)
            if (parsed) {
              baZi = calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
            }
          }

          if (baZi) {
            // 用八字喜用神筛选候选字
            const dummyWuxing: string[] = [] // 需要名字五行才能算benefit，这里先算喜用神
            const dayGanWuxing = baZi.dominant // 简化：用主导五行
            // 用 analyzeWuxingBenefit 的逻辑推算喜用神
            const benefit = analyzeWuxingBenefit(baZi, ['木']) // dummy, 只取xiYong/jiShen
            xiYong = benefit.xiYong
            jiShen = benefit.jiShen
            candidatePool = buildCandidateCharPool(xiYong, body.gender, avoidCharsList)
            candidatePool.jiShen = jiShen
          } else {
            candidatePool = buildGenericCharPool(body.gender, avoidCharsList)
          }

          return candidatePool
        })

        candidatePool = filterResult

        sendEvent(controller, {
          step: 'filtering', status: 'done', duration: filterDuration,
          summary: `候选字池：${candidatePool.primary.length}个喜用字 + ${candidatePool.secondary.length}个通用字${xiYong.length > 0 ? `，喜用神：${xiYong.join('、')}` : ''}`,
          detail: { poolSize: candidatePool.primary.length + candidatePool.secondary.length, xiYong, jiShen },
        })

        // ===== Stage 2: RAG =====
        sendEvent(controller, { step: 'rag', status: 'running' })

        let ragResults: Array<{ source: string; content: string; relevance: number }> = []

        const { duration: ragDuration } = await (async () => {
          const start = Date.now()
          try {
            const retriever = getRetriever()
            await retriever.initialize()

            // 构建查询词
            const queryParts: string[] = []
            if (xiYong.length > 0) queryParts.push(xiYong.join(' '))
            if (body.expectations) queryParts.push(body.expectations)

            // 按模式添加风格词
            const modeKeywords: Record<string, string> = {
              '文学': '诗意 典雅 意境',
              '传统': '吉祥 端正 稳重',
              '现代': '清新 简洁 时尚',
              '混合': '美好 寓意 深远',
            }
            queryParts.push(modeKeywords[body.namingMode] || '美好 寓意')

            const query = queryParts.join(' ')
            ragResults = await retriever.hybridSearch(query, 12)
          } catch (err) {
            console.error('RAG error:', err)
          }
          return { duration: Date.now() - start }
        })()

        // 构建RAG上下文字符串
        const ragContext = ragResults.length > 0
          ? ragResults.map((r, i) => `${i + 1}. 【${r.source}】${r.content}`).join('\n')
          : undefined

        sendEvent(controller, {
          step: 'rag', status: 'done', duration: ragDuration,
          summary: `检索到${ragResults.length}条相关诗句`,
          detail: { resultCount: ragResults.length, topSources: ragResults.slice(0, 3).map(r => r.source) },
        })

        // ===== Stage 3: generating =====
        sendEvent(controller, { step: 'generating', status: 'running' })

        // 构建增强system prompt
        const allCandidateChars = [...candidatePool.primary, ...candidatePool.secondary]
        const systemPrompt = getSystemPrompt({
          dislikedChars: getDislikedChars(),
          dislikedNames: getDislikedNames().map(n => n.name),
          candidateChars: allCandidateChars,
          ragContext,
          xiYong,
          jiShen,
          namingMode: body.namingMode,
        })

        // 构建用户消息
        const userParts: string[] = []
        userParts.push(`我想为姓${body.surname}的${body.gender === '未定' ? '宝宝' : body.gender}孩取名。`)
        if (body.motherSurname) userParts.push(`母亲姓${body.motherSurname}，可以考虑组合。`)
        if (body.expectations) userParts.push(`期望寓意：${body.expectations}。`)
        if (body.avoidChars) userParts.push(`避免用字：${body.avoidChars}。`)
        userParts.push(`取名模式：${body.namingMode}。`)
        if (body.nameLength && body.nameLength !== '不限') {
          userParts.push(`名字字数：${body.nameLength === 1 ? '单字名' : '双字名'}。`)
        }
        userParts.push(`请推荐5个好名字，必须使用【名字】格式。`)
        const userMessage = userParts.join('')

        // LLM流式生成
        const client = new Anthropic({
          apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
          baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        })

        let fullText = ''
        const genStart = Date.now()

        const llmStream = client.messages.stream({
          model: config.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        })

        llmStream.on('text', (text: string) => {
          fullText += text
          sendEvent(controller, { step: 'generating', status: 'running', chunk: text })
        })

        await llmStream.finalMessage()
        const genDuration = Date.now() - genStart

        // 解析【名字】格式
        const bracketRegex = /【([^\】]+)】/g
        const rawNames: string[] = []
        let match: RegExpExecArray | null
        while ((match = bracketRegex.exec(fullText)) !== null) {
          const name = match[1].trim()
          if (name.startsWith(body.surname) && name.length >= 2 && name.length <= 3) {
            rawNames.push(name)
          }
        }

        sendEvent(controller, {
          step: 'generating', status: 'done', duration: genDuration,
          summary: `生成${rawNames.length}个候选名：${rawNames.join('、')}`,
          detail: { rawNames, textLength: fullText.length },
        })

        // ===== Stage 4: scoring =====
        sendEvent(controller, { step: 'scoring', status: 'running' })

        const scoredNames: ScoredName[] = []
        const scoreStart = Date.now()

        for (const name of rawNames) {
          const givenName = name.slice(body.surname.length)
          const chars = name.split('')
          const charInfos = chars.map(c => getCharacterInfo(c) || { char: c, pinyin: '', wuxing: '-', strokes: 0 })

          // 三才五格
          const sancai = analyzeSanCaiWuGeEnhanced(name)

          // 音律
          const phonetic = analyzePhonetic(givenName)

          // 字形
          const strokes = charInfos.map(c => c.strokes)
          const glyph = analyzeGlyph(givenName, strokes.slice(1))

          // 重名率
          const popularity = analyzeNamePopularity(givenName)

          // 五行补益
          let wuxingBenefitScore = 13 // 默认基础分
          if (baZi) {
            const nameWuxing = charInfos.slice(1).map(c => c.wuxing).filter(w => w !== '-')
            const benefit = analyzeWuxingBenefit(baZi, nameWuxing)
            wuxingBenefitScore = benefit.score
          }

          // 谐音检查
          const harmonyWarnings = checkHarmony(name)

          // 字义内涵：默认15分（LLM在生成时已考虑）
          const meaningScore = 15

          const scores = {
            wuxingBenefit: wuxingBenefitScore,
            sancaiWuge: sancai.score,
            phonetic: phonetic.score,
            meaning: meaningScore,
            glyph: glyph.score,
            popularity: popularity.score,
          }

          const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0)

          // 过滤低分名
          if (totalScore < 60) continue

          // 提取诗词出处（从RAG结果中匹配）
          let classicSource: string | undefined
          for (const r of ragResults) {
            if (givenName.split('').some(c => r.content.includes(c))) {
              classicSource = `《${r.source}》"${r.content}"`
              break
            }
          }

          // 提取寓意（从LLM文本中匹配）
          let meaningText: string | undefined
          const meaningRegex = new RegExp(`【${name}】[^]*?\\*\\*寓意\\*\\*[：:]\\s*(.+?)(?:\\n|\\*\\*)`, 'u')
          const meaningMatch = fullText.match(meaningRegex)
          if (meaningMatch) meaningText = meaningMatch[1].trim()

          // 保存到记忆
          let nameId: number | undefined
          try {
            nameId = saveName({
              name,
              surname: body.surname,
              givenName,
              source: 'generate',
              score: totalScore,
              scoresJson: JSON.stringify(scores),
              analysisSummary: meaningText?.substring(0, 100),
              birthTime: body.birthTime,
            })
          } catch (e) {
            console.error('Failed to save name:', e)
          }

          scoredNames.push({
            name,
            surname: body.surname,
            givenName,
            pinyin: charInfos.map(c => c.pinyin).filter(Boolean).join(' '),
            scores,
            totalScore,
            wuxingTags: charInfos.slice(1).map(c => c.wuxing).filter(w => w !== '-'),
            strokes: charInfos.map(c => c.strokes),
            classicSource,
            meaningText,
            harmonyWarnings: harmonyWarnings.length > 0 ? harmonyWarnings : undefined,
            nameId,
          })
        }

        const scoreDuration = Date.now() - scoreStart

        sendEvent(controller, {
          step: 'scoring', status: 'done', duration: scoreDuration,
          summary: `评分完成：${scoredNames.length}个合格名（过滤了${rawNames.length - scoredNames.length}个低分名）`,
          detail: { passed: scoredNames.length, filtered: rawNames.length - scoredNames.length },
        })

        // ===== Complete =====
        sendEvent(controller, {
          type: 'complete',
          data: {
            names: scoredNames,
            candidateChars: candidatePool,
          },
        })
      } catch (error) {
        console.error('Naming pipeline error:', error)
        sendEvent(controller, { step: 'scoring', status: 'done', summary: `错误：${String(error)}` })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/naming/route.ts
git commit -m "feat: add four-stage naming pipeline API"
```

---

### Task 5: Create NameScoreCard component

**Files:**
- Create: `src/components/NameScoreCard.tsx`

- [ ] **Step 1: Create the score card component**

```tsx
// src/components/NameScoreCard.tsx
'use client'

import { useState } from 'react'
import type { ScoredName } from '@/types/naming-events'

interface NameScoreCardProps {
  data: ScoredName
  onSelect?: (name: string) => void
  selected?: boolean
}

const SCORE_DIMENSIONS = [
  { key: 'wuxingBenefit' as const, label: '五行补益', max: 25 },
  { key: 'sancaiWuge' as const, label: '三才五格', max: 20 },
  { key: 'phonetic' as const, label: '音律听感', max: 20 },
  { key: 'meaning' as const, label: '字义内涵', max: 20 },
  { key: 'glyph' as const, label: '字形结构', max: 10 },
  { key: 'popularity' as const, label: '时代适用', max: 5 },
]

function scoreBarColor(score: number, max: number): string {
  const pct = (score / max) * 100
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function totalScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-600'
}

const WUXING_COLORS: Record<string, string> = {
  '金': 'bg-ink-100 text-ink-700',
  '木': 'bg-emerald-50 text-emerald-700',
  '水': 'bg-blue-50 text-blue-700',
  '火': 'bg-red-50 text-red-700',
  '土': 'bg-amber-50 text-amber-700',
}

export default function NameScoreCard({ data, onSelect, selected }: NameScoreCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [pref, setPref] = useState<'liked' | 'neutral' | 'disliked' | null>(null)

  const handlePref = (p: 'liked' | 'neutral' | 'disliked') => {
    setPref(p)
    if (data.nameId) {
      fetch(`/api/names/${data.nameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference: p }),
      }).catch(() => {})
    }
  }

  return (
    <div className="card-elegant p-6">
      {/* Header: name + pinyin + select */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif-cn text-3xl text-ink-900 tracking-wider">
            {data.name}
          </h3>
          <p className="text-ink-400 text-sm mt-1">{data.pinyin}</p>
        </div>
        {onSelect && (
          <button
            onClick={() => onSelect(data.name)}
            className={`p-2 rounded-sm border transition-all
              ${selected ? 'border-vermilion-500 bg-vermilion-50 text-vermilion-500' : 'border-ink-200 text-ink-300 hover:border-ink-300'}`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M11 17l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
            </svg>
          </button>
        )}
      </div>

      {/* Wuxing tags + strokes */}
      <div className="flex gap-4 text-sm mb-4">
        <div className="flex items-center gap-2">
          <span className="text-ink-400">五行</span>
          <div className="flex gap-1">
            {data.wuxingTags.map((w, i) => (
              <span key={i} className={`px-2 py-0.5 rounded-sm text-xs ${WUXING_COLORS[w] || 'bg-ink-50 text-ink-600'}`}>
                {w}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-400">笔画</span>
          <span className="text-ink-600">{data.strokes.join('-')}</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2 mb-4">
        {SCORE_DIMENSIONS.map(({ key, label, max }) => {
          const score = data.scores[key]
          const pct = Math.round((score / max) * 100)
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="w-16 text-ink-500 shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${scoreBarColor(score, max)} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-10 text-right text-ink-600 shrink-0">{score}/{max}</span>
            </div>
          )
        })}
      </div>

      {/* Total score */}
      <div className={`text-lg font-semibold mb-3 ${totalScoreColor(data.totalScore)}`}>
        总分 {data.totalScore}/100
      </div>

      {/* Harmony warnings */}
      {data.harmonyWarnings && data.harmonyWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-2 mb-3 text-sm text-amber-700">
          谐音提示：{data.harmonyWarnings.join('、')}
        </div>
      )}

      {/* Expandable: source + meaning */}
      {(data.classicSource || data.meaningText) && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
          >
            {expanded ? '收起详情 ▲' : '展开详情 ▼'}
          </button>
          {expanded && (
            <div className="mt-2 space-y-2 text-sm">
              {data.classicSource && (
                <p className="text-vermilion-600 italic">「{data.classicSource}」</p>
              )}
              {data.meaningText && (
                <p className="text-ink-600">{data.meaningText}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preference buttons */}
      {data.nameId && (
        <div className="flex gap-2 mt-4">
          {(['liked', 'neutral', 'disliked'] as const).map(p => (
            <button
              key={p}
              onClick={() => handlePref(p)}
              className={`px-3 py-1 rounded-sm text-sm transition-colors
                ${pref === p
                  ? (p === 'liked' ? 'bg-jade-100 text-jade-700' : p === 'disliked' ? 'bg-red-100 text-red-700' : 'bg-ink-100 text-ink-700')
                  : (p === 'liked' ? 'bg-jade-50 text-jade-600 hover:bg-jade-100' : p === 'disliked' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-ink-50 text-ink-500 hover:bg-ink-100')
                }`}
            >
              {p === 'liked' ? '喜欢' : p === 'disliked' ? '不喜欢' : '一般'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NameScoreCard.tsx
git commit -m "feat: add NameScoreCard component with six-dimension score bars"
```

---

### Task 6: Modify chat page to use naming pipeline

**Files:**
- Modify: `src/app/chat/page.tsx`

- [ ] **Step 1: Rewrite chat page to trigger pipeline on first message**

The key changes:
1. Import `NameScoreCard` and pipeline types
2. Add state for pipeline results (`scoredNames`, `pipelineStage`, `candidateChars`)
3. First message triggers `POST /api/naming` instead of `/api/chat`
4. Consume SSE events, render progress + score cards
5. Subsequent messages still use `/api/chat` with injected context
6. Keep existing `saveGeneratedNames` as fallback (no longer needed for pipeline, but keep for chat-based generation)

Replace the entire `src/app/chat/page.tsx` with:

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import NameScoreCard from '@/components/NameScoreCard'
import type { ScoredName, NamingStepEvent, NamingCompleteEvent, CandidateCharPool } from '@/types/naming-events'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface FormData {
  surname: string
  motherSurname?: string
  gender: '男' | '女' | '未定' | ''
  birthTime?: string
  expectations?: string
  avoidChars?: string
  namingMode: '传统' | '文学' | '现代' | '混合'
  nameLength?: 1 | 2 | '不限'
}

const PIPELINE_STEPS = [
  { key: 'filtering', label: '命理筛选候选字' },
  { key: 'rag', label: '检索诗词典故' },
  { key: 'generating', label: 'AI生成名字' },
  { key: 'scoring', label: '六维评分验证' },
] as const

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-ink-800 mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-ink-800 mt-4 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="font-semibold text-ink-800 mt-4 mb-2">$1</h2>')
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-ink-600">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-ink-600">$2</li>')
    .replace(/\n/g, '<br/>')
}

export default function ChatPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<string>('')
  const initializedRef = useRef(false)

  // Pipeline state
  const [scoredNames, setScoredNames] = useState<ScoredName[]>([])
  const [pipelineStage, setPipelineStage] = useState<number>(-1) // -1 = not started
  const [pipelineStepStatus, setPipelineStepStatus] = useState<Record<string, { status: string; summary?: string }>>({})
  const [candidateChars, setCandidateChars] = useState<CandidateCharPool | undefined>()
  const [generatingText, setGeneratingText] = useState('')

  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'naming' }),
    })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, scoredNames])

  // Auto-trigger naming pipeline on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const formDataStr = sessionStorage.getItem('namingFormData')
    if (!formDataStr) return

    const formData: FormData = JSON.parse(formDataStr)
    if (!formData.surname || !formData.gender) return

    // Build initial user message for display
    const parts: string[] = []
    parts.push(`我想为姓${formData.surname}的${formData.gender === '未定' ? '宝宝' : formData.gender}孩取名。`)
    if (formData.expectations) parts.push(`期望寓意：${formData.expectations}。`)
    parts.push(`取名模式：${formData.namingMode}。`)

    const displayMsg = parts.join('')
    setMessages(prev => [...prev, { id: `user_${Date.now()}`, role: 'user', content: displayMsg }])

    // Trigger pipeline
    setTimeout(() => {
      runNamingPipeline(formData)
    }, 300)
  }, [])

  /** Run the four-stage naming pipeline */
  async function runNamingPipeline(formData: FormData) {
    setIsLoading(true)
    setPipelineStage(0)
    setScoredNames([])
    setGeneratingText('')

    try {
      const response = await fetch('/api/naming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surname: formData.surname,
          gender: formData.gender,
          birthTime: formData.birthTime,
          expectations: formData.expectations,
          avoidChars: formData.avoidChars,
          namingMode: formData.namingMode,
          nameLength: formData.nameLength,
          motherSurname: formData.motherSurname,
        }),
      })

      if (!response.ok) throw new Error('Pipeline request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6)
          if (!json) continue
          try {
            const event = JSON.parse(json)

            if (event.type === 'complete') {
              const names: ScoredName[] = event.data.names || []
              setScoredNames(names)
              setCandidateChars(event.data.candidateChars)

              // Add assistant message summarizing results
              const summary = names.length > 0
                ? `为您推荐了${names.length}个名字，请查看下方评分卡片。`
                : '未能生成符合条件的名字，请调整需求后重试。'
              setMessages(prev => [...prev, { id: `assistant_${Date.now()}`, role: 'assistant', content: summary }])
            } else if (event.step) {
              // Step event
              const stepIdx = PIPELINE_STEPS.findIndex(s => s.key === event.step)
              if (stepIdx >= 0) setPipelineStage(stepIdx)

              setPipelineStepStatus(prev => ({
                ...prev,
                [event.step]: { status: event.status, summary: event.summary },
              }))

              // Stream generating text
              if (event.step === 'generating' && event.chunk) {
                setGeneratingText(prev => prev + event.chunk)
              }
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error)
      setMessages(prev => [...prev, { id: `assistant_${Date.now()}`, role: 'assistant', content: '取名服务暂时不可用，请稍后重试。' }])
    } finally {
      setIsLoading(false)
      setPipelineStage(-1)
    }
  }

  /** Send chat message (for refinement after pipeline) */
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
    }

    const assistantId = `assistant_${Date.now()}`
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    contentRef.current = ''

    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    // Inject pipeline context into conversation
    const contextMessage = scoredNames.length > 0
      ? `之前为你推荐了以下名字：${scoredNames.map(n => n.name).join('、')}。${candidateChars ? `候选字池：${candidateChars.primary.slice(0, 20).join('、')}。` : ''}请在此基础上微调。`
      : ''

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...(contextMessage ? [{ role: 'user', content: contextMessage }] : []),
            ...messages,
            userMessage,
          ].map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              const text = JSON.parse(line.slice(2))
              contentRef.current += text
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: contentRef.current } : m))
            } catch { /* ignore */ }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await sendMessage(input)
  }

  return (
    <main className="min-h-screen flex flex-col ink-wash">
      <header className="sticky top-0 z-50 bg-ink-50/90 backdrop-blur-sm border-b border-ink-100">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/form" className="text-ink-400 hover:text-ink-600 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="font-serif-cn text-lg text-ink-700">取名顾问</h1>
          <div className="w-5" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          {/* Messages */}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-sm px-4 py-3 ${message.role === 'user' ? 'bg-ink-900 text-ink-50' : 'bg-white border border-ink-100 text-ink-700'}`}>
                {message.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                ) : (
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                )}
              </div>
            </div>
          ))}

          {/* Pipeline progress */}
          {isLoading && pipelineStage >= 0 && (
            <div className="card-elegant p-6">
              <div className="space-y-3">
                {PIPELINE_STEPS.map((step, index) => {
                  const status = pipelineStepStatus[step.key]?.status
                  const summary = pipelineStepStatus[step.key]?.summary
                  return (
                    <div key={step.key} className={`flex items-center gap-3 p-2 rounded-sm transition-all ${
                      status === 'done' ? 'bg-jade-50 text-jade-700' :
                      index === pipelineStage ? 'bg-ink-100 text-ink-800' :
                      'text-ink-400'
                    }`}>
                      <span className="w-6 h-6 flex items-center justify-center">
                        {status === 'done' ? (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-jade-500">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        ) : index === pipelineStage ? (
                          <div className="w-4 h-4 border-2 border-ink-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-ink-300" />
                        )}
                      </span>
                      <span className="flex-1 text-sm">{step.label}</span>
                      {status === 'done' && summary && (
                        <span className="text-xs text-ink-400">{summary}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Streaming text during generating stage */}
              {generatingText && (
                <div className="mt-4 text-sm text-ink-600 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(generatingText) }}
                />
              )}
            </div>
          )}

          {/* Score cards */}
          {scoredNames.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-serif-cn text-lg text-ink-700">推荐名字</h3>
              {scoredNames.map((name) => (
                <NameScoreCard key={name.name} data={name} />
              ))}
            </div>
          )}

          {/* Loading dots (for chat, not pipeline) */}
          {isLoading && pipelineStage < 0 && messages[messages.length - 1]?.content === '' && (
            <div className="flex justify-start">
              <div className="bg-white border border-ink-100 rounded-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-ink-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="sticky bottom-0 bg-ink-50/90 backdrop-blur-sm border-t border-ink-100">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 input-field"
              placeholder={scoredNames.length > 0 ? '继续对话微调...' : '输入您的想法...'}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-ink-900 text-ink-50 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.176A5.968 5.968 0 0121 12a5.967 5.967 0 01-8.977 5.424L3 21l2.176-6.731A5.968 5.968 0 016 12z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/chat/page.tsx
git commit -m "feat: chat page triggers naming pipeline, renders score cards"
```

---

### Task 6: Modify results page to use real naming data

**Files:**
- Modify: `src/app/results/page.tsx`

- [ ] **Step 1: Replace mock data with real pipeline results**

In `src/app/results/page.tsx`, make two changes:

**Change 1:** In the `useEffect` where `mode === 'naming'` sets mockNames (around line 383-385), replace:

```typescript
      } else if (mode === 'naming') {
        setNames(mockNames)
      }
```

with:

```typescript
      } else if (mode === 'naming') {
        // Read pipeline results from sessionStorage
        const pipelineResultsStr = sessionStorage.getItem('namingPipelineResults')
        if (pipelineResultsStr) {
          try {
            const pipelineResults = JSON.parse(pipelineResultsStr)
            const realNames: NameResult[] = (pipelineResults.names || []).map((n: any) => ({
              name: n.name,
              pinyin: n.pinyin,
              source: n.classicSource,
              meaning: n.meaningText || '',
              wuxing: n.wuxingTags || [],
              strokes: n.strokes || [],
              nameId: n.nameId,
              scores: n.scores,
              analysis: {
                harmonyWarning: n.harmonyWarnings,
              },
            }))
            setNames(realNames.length > 0 ? realNames : mockNames)
          } catch {
            setNames(mockNames)
          }
        } else {
          setNames(mockNames)
        }
      }
```

**Change 2:** Add an import at the top of the file for `NameScoreCard`:

After the existing imports, add:
```typescript
import NameScoreCard from '@/components/NameScoreCard'
```

And in the naming card view section (around line 610-677), replace the card rendering with `NameScoreCard` when scores are available. Replace the entire `{mode === 'naming' && viewMode === 'card' && (` block with:

```tsx
          {mode === 'naming' && viewMode === 'card' && (
            <div className="space-y-4">
              {names.map((item) => (
                item.scores ? (
                  <NameScoreCard
                    key={item.name}
                    data={{
                      name: item.name,
                      surname: item.name.charAt(0),
                      givenName: item.name.slice(1),
                      pinyin: item.pinyin,
                      scores: item.scores as any,
                      totalScore: Object.values(item.scores).reduce((sum: number, s: any) => sum + (s || 0), 0),
                      wuxingTags: item.wuxing,
                      strokes: item.strokes,
                      classicSource: item.source,
                      meaningText: item.meaning,
                      harmonyWarnings: item.analysis?.harmonyWarning,
                      nameId: item.nameId,
                    }}
                    onSelect={toggleSelect}
                    selected={selectedNames.includes(item.name)}
                  />
                ) : (
                  <div key={item.name} className="card-elegant p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-serif-cn text-3xl text-ink-900 tracking-wider">{item.name}</h3>
                        <p className="text-ink-400 text-sm mt-1">{item.pinyin}</p>
                      </div>
                    </div>
                    {item.source && <p className="text-vermilion-600 text-sm mb-2 font-light italic">「{item.source}」</p>}
                    <p className="text-ink-600 mb-4">{item.meaning}</p>
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">五行</span>
                        <div className="flex gap-1">
                          {item.wuxing.map((w, i) => (
                            <span key={i} className={`px-2 py-0.5 rounded-sm text-xs ${w === '金' ? 'bg-ink-100 text-ink-700' : w === '木' ? 'bg-emerald-50 text-emerald-700' : w === '水' ? 'bg-blue-50 text-blue-700' : w === '火' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{w}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-ink-400">笔画</span>
                        <span className="text-ink-600">{item.strokes.join('-')}</span>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/results/page.tsx
git commit -m "feat: results page uses real pipeline data instead of mock"
```

---

### Task 7: Wire chat page to save pipeline results for results page

**Files:**
- Modify: `src/app/chat/page.tsx`

- [ ] **Step 1: Save pipeline results to sessionStorage when complete**

In the `runNamingPipeline` function, after `setScoredNames(names)` (inside the `type === 'complete'` handler), add:

```typescript
              // Save to sessionStorage for results page
              sessionStorage.setItem('namingPipelineResults', JSON.stringify({ names }))
```

Also, update the "生成名字" button in the header to navigate to results with pipeline data. In the header section, replace the existing button:

```tsx
          <button
            onClick={handleGenerateNames}
            className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
          >
            生成名字
          </button>
```

with:

```tsx
          {scoredNames.length > 0 && (
            <button
              onClick={() => {
                sessionStorage.setItem('namingPipelineResults', JSON.stringify({ names: scoredNames }))
                router.push('/results?mode=naming')
              }}
              className="text-sm text-ink-400 hover:text-ink-600 transition-colors"
            >
              查看结果
            </button>
          )}
```

Remove the `handleGenerateNames` function since it's no longer needed.

- [ ] **Step 2: Commit**

```bash
git add src/app/chat/page.tsx
git commit -m "feat: wire pipeline results to results page via sessionStorage"
```

---

### Task 8: Export new types from types index

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add re-export**

At the end of `src/types/index.ts`, add:

```typescript
// 命名流水线事件类型
export type { NamingStepEvent, NamingCompleteEvent, ScoredName, NamingRequest, CandidateCharPool, NameScores, NamingStep } from './naming-events'
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: export naming pipeline types from types index"
```

---

## Verification

After all tasks are complete:

1. Run `npm run dev` and verify no TypeScript errors
2. Visit `/form`, fill surname "李", gender "女", birthTime, expectations "文雅", submit
3. Chat page shows four-stage progress: filtering → rag → generating → scoring
4. Score cards appear with six-dimension bars, total score, poetry source
5. Names with totalScore < 60 are filtered out
6. Names auto-saved to memory (visible on `/memory`)
7. Click "查看结果" → results page shows score cards (not mock data)
8. Type "换一个更文雅的" in chat → system regenerates within constraints
9. Mark a name as "不喜欢" → subsequent generation excludes that name/char
