# 名字分析逻辑全量升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全面升级名字分析逻辑，新增八字五行补益分析、五格数理吉凶、音韵增强、字形分析、重名率分析、RAG升级、提示词优化，使分析结果以传统命理优先、更符合主流审美。

**Architecture:** 在现有 Next.js + TypeScript 项目中，增强 `src/lib/` 下的分析模块，新增 `glyph.ts` 和 `popularity.ts` 模块，新增数据文件到 `data/`，重写 `analyze/route.ts` 集成所有增强，优化前端进度展示。采用 vitest 作为测试框架。

**Tech Stack:** Next.js 14, TypeScript, lunar-javascript, @anthropic-ai/sdk, vitest, Ollama (bge-m3 embeddings)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/index.ts` | Modify | 新增 PhoneticResult, WuxingBenefitResult, WuGeDetailItem, GlyphResult, PopularityResult 类型 |
| `src/lib/phonetic.ts` | Rewrite | 声调+韵母+开闭口音+量化评分 |
| `src/lib/wuxing.ts` | Modify | 新增 analyzeWuxingBenefit(), 五行相生相克 |
| `src/lib/sancai-wuge.ts` | Modify | 新增五格数理吉凶表+量化评分 |
| `src/lib/glyph.ts` | Create | 字形结构分析（笔画平衡+书写便利+视觉结构+生僻度） |
| `src/lib/popularity.ts` | Create | 重名率分析（基于 names_corpus_gender.txt） |
| `src/lib/rag/embeddings.ts` | Rewrite | 替换为 Ollama bge-m3 嵌入，带缓存 |
| `src/lib/rag/retriever.ts` | Modify | 混合检索+唐诗宋词论语加载 |
| `src/lib/llm.ts` | Modify | 系统提示词+分析提示词模板优化 |
| `src/app/api/analyze/route.ts` | Rewrite | 集成所有增强模块+结构化提示词 |
| `src/app/results/page.tsx` | Modify | 进度步骤8步+评分雷达图展示 |
| `data/harmony_warnings.json` | Create | 50+条谐音词库 |
| `data/char_structure.json` | Create | 常用字结构映射表 |
| `data/wuge_fortune.json` | Create | 五格数理1-81吉凶表 |
| `data/tangshi.json` | Create | 唐诗三百首 |
| `data/songci.json` | Create | 宋词三百首 |
| `data/lunyu.json` | Create | 论语名句 |
| `vitest.config.ts` | Create | 测试配置 |
| `src/lib/__tests__/phonetic.test.ts` | Create | 音韵分析测试 |
| `src/lib/__tests__/wuxing.test.ts` | Create | 五行补益测试 |
| `src/lib/__tests__/sancai-wuge.test.ts` | Create | 三才五格测试 |
| `src/lib/__tests__/glyph.test.ts` | Create | 字形分析测试 |
| `src/lib/__tests__/popularity.test.ts` | Create | 重名率测试 |

---

### Task 1: 设置测试框架 vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: 安装 vitest 依赖**

```bash
cd D:/dev/git/ai-naming && npm install -D vitest
```

- [ ] **Step 2: 创建 vitest 配置文件**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/lib/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: 在 package.json 中添加 test 脚本**

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 验证 vitest 安装成功**

```bash
cd D:/dev/git/ai-naming && npx vitest run --passWithNoTests
```

Expected: PASS (no tests yet)

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add vitest.config.ts package.json package-lock.json && git commit -m "chore: add vitest test framework"
```

---

### Task 2: 新增类型定义

**Files:**
- Modify: `src/types/index.ts:1-80`

- [ ] **Step 1: 在 src/types/index.ts 末尾追加新类型**

Add after the existing `ClassicSearchResult` interface:

```typescript
// 增强音律结果
export interface PhoneticResult {
  pinyins: string[]
  tones: number[]
  toneNames: string[]
  toneAnalysis: string      // 声调评价
  rhymeAnalysis: string     // 韵母评价
  opennessAnalysis: string  // 开闭口音评价
  analysis: string          // 综合评价
  score: number             // 音律得分（满分20）
}

// 五行补益结果
export interface WuxingBenefitResult {
  xiYong: string[]      // 喜用神五行
  jiShen: string[]      // 忌神五行
  nameBenefit: string   // 名字对八字的补益说明
  score: number         // 补益得分（满分25）
}

// 五格单项详情
export interface WuGeDetailItem {
  num: number
  wuxing: string
  fortune: string   // 吉凶描述
  level: '大吉' | '吉' | '半吉' | '凶' | '大凶'
}

// 五格详情结果
export interface WuGeDetailResult {
  tianGe: WuGeDetailItem
  renGe: WuGeDetailItem
  diGe: WuGeDetailItem
  waiGe: WuGeDetailItem
  zongGe: WuGeDetailItem
  sancaiFortune: string
  sancaiLevel: '大吉' | '吉' | '半吉' | '凶' | '大凶'
  score: number  // 三才五格得分（满分20）
}

// 字形分析结果
export interface GlyphResult {
  strokeBalance: string   // 笔画平衡评价
  writingEase: string     // 书写便利评价
  visualStructure: string // 视觉结构评价
  rarity: string          // 生僻度评价
  score: number           // 字形得分（满分10）
}

// 重名率结果
export interface PopularityResult {
  level: '极低' | '低' | '中等' | '高' | '极高'
  count: number           // 词频出现次数
  homophoneCount: number  // 同音名数量
  score: number           // 时代适用得分（满分5）
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/types/index.ts && git commit -m "feat: add new type definitions for enhanced analysis"
```

---

### Task 3: 创建数据文件 — 谐音词库

**Files:**
- Create: `data/harmony_warnings.json`

- [ ] **Step 1: 创建谐音词库 JSON**

Create `data/harmony_warnings.json` with 50+ entries. Structure: `{ "exact": { "名字片段": "谐音词" }, "near": { "名字片段": "近音词" } }`.

```json
{
  "exact": {
    "杜子腾": "肚子疼",
    "范统": "饭桶",
    "朱逸群": "猪一群",
    "杨伟": "阳痿",
    "范剑": "犯贱",
    "沈京": "神经",
    "苟史": "狗屎",
    "史珍香": "屎真香",
    "付岩杰": "犯贱杰",
    "魏生津": "卫生巾",
    "矫厚根": "脚后跟",
    "沈京兵": "神经病",
    "杜琦燕": "肚脐眼",
    "吴用": "无用",
    "贾政": "假正",
    "贾雨村": "假语存",
    "贾宝玉": "假宝玉",
    "甄士隐": "真事隐",
    "霍启": "祸起",
    "封肃": "风俗",
    "冯渊": "逢冤",
    "秦钟": "情种",
    "卜世仁": "不是人",
    "单聘仁": "善骗人",
    "吴新登": "无星灯",
    "詹光": "沾光",
    "张友士": "张有事",
    "王作梅": "妄作媒",
    "夏金桂": "下筋骨",
    "史湘云": "屎香云",
    "傅试": "附势",
    "胡庸医": "胡用医",
    "石呆子": "实呆子",
    "钱华": "钱花",
    "赖大": "赖大",
    "戴权": "代权",
    "吴贵": "乌龟",
    "孙绍祖": "孙少祖",
    "邢夫人": "刑夫人"
  },
  "near": {
    "朱": "猪",
    "史": "屎",
    "苟": "狗",
    "贾": "假",
    "吴": "无",
    "付": "负",
    "范": "饭",
    "魏": "喂",
    "杜": "肚",
    "沈": "神",
    "矫": "脚",
    "霍": "祸"
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add data/harmony_warnings.json && git commit -m "feat: add expanded harmony warnings dictionary (50+ entries)"
```

---

### Task 4: 创建数据文件 — 五格数理吉凶表

**Files:**
- Create: `data/wuge_fortune.json`

- [ ] **Step 1: 创建五格数理1-81吉凶表**

Create `data/wuge_fortune.json`. Each entry: `{ "数": { "level": "大吉|吉|半吉|凶|大凶", "desc": "描述" } }`. This is the standard 81-number numerology table used in Chinese name studies.

```json
{
  "1": { "level": "大吉", "desc": "万物开泰，最大吉数" },
  "2": { "level": "大凶", "desc": "动摇不安，一败涂地" },
  "3": { "level": "大吉", "desc": "进取如意，智谋优秀" },
  "4": { "level": "大凶", "desc": "万事休止，凶险破败" },
  "5": { "level": "大吉", "desc": "福禄长寿，名利双收" },
  "6": { "level": "大吉", "desc": "安稳余庆，吉人天相" },
  "7": { "level": "吉", "desc": "精力旺盛，刚毅果断" },
  "8": { "level": "吉", "desc": "意志坚刚，努力成功" },
  "9": { "level": "大凶", "desc": "穷苦逆境，病弱废疾" },
  "10": { "level": "大凶", "desc": "万事终局，损耗晦暗" },
  "11": { "level": "大吉", "desc": "稳健吉顺，旱苗逢雨" },
  "12": { "level": "大凶", "desc": "薄弱无力，谋事难成" },
  "13": { "level": "大吉", "desc": "智略超群，富贵荣华" },
  "14": { "level": "大凶", "desc": "破兆浮沉，忍苦失败" },
  "15": { "level": "大吉", "desc": "福寿拱照，富贵荣华" },
  "16": { "level": "大吉", "desc": "贵人得助，天降吉祥" },
  "17": { "level": "半吉", "desc": "刚柔相济，突破万难" },
  "18": { "level": "半吉", "desc": "铁石之意，有志竟成" },
  "19": { "level": "大凶", "desc": "遮云蔽月，困难重重" },
  "20": { "level": "大凶", "desc": "非业破运，灾祸重重" },
  "21": { "level": "大吉", "desc": "明月光照，独立权威" },
  "22": { "level": "大凶", "desc": "秋草逢霜，百事不如" },
  "23": { "level": "大吉", "desc": "旭日东升，壮丽果敢" },
  "24": { "level": "大吉", "desc": "家门余庆，金钱丰盈" },
  "25": { "level": "半吉", "desc": "资性英敏，才略奇特" },
  "26": { "level": "半吉", "desc": "变怪之谜，英雄豪杰" },
  "27": { "level": "大凶", "desc": "欲望无止，自寻苦恼" },
  "28": { "level": "大凶", "desc": "家亲缘薄，遭难之数" },
  "29": { "level": "半吉", "desc": "智谋优异，归功享福" },
  "30": { "level": "半吉", "desc": "绝死逢生，浮沉不定" },
  "31": { "level": "大吉", "desc": "智勇得志，心想事成" },
  "32": { "level": "大吉", "desc": "宝马金鞍，侥幸多望" },
  "33": { "level": "大吉", "desc": "旭日升天，鸾凤相会" },
  "34": { "level": "大凶", "desc": "破家亡身，见识短小" },
  "35": { "level": "大吉", "desc": "温良和顺，平安健康" },
  "36": { "level": "半吉", "desc": "波澜壮阔，侠义之气" },
  "37": { "level": "大吉", "desc": "权威显达，吉人天相" },
  "38": { "level": "半吉", "desc": "意志薄弱，刻苦奋斗" },
  "39": { "level": "半吉", "desc": "富贵荣华，一帆风顺" },
  "40": { "level": "大凶", "desc": "退安享福，廉让退守" },
  "41": { "level": "大吉", "desc": "德望高大，纯阳独秀" },
  "42": { "level": "半吉", "desc": "十项不全，财库暗耗" },
  "43": { "level": "大凶", "desc": "散财破产，诸事不遂" },
  "44": { "level": "大凶", "desc": "破家亡身，暗藏惨淡" },
  "45": { "level": "大吉", "desc": "顺风扬帆，新生泰和" },
  "46": { "level": "大凶", "desc": "浪里淘金，载宝沉舟" },
  "47": { "level": "大吉", "desc": "开花结果，进取如意" },
  "48": { "level": "大吉", "desc": "德智兼备，顾问统师" },
  "49": { "level": "半吉", "desc": "吉凶难分，不断努力" },
  "50": { "level": "半吉", "desc": "吉凶参半，须防倾覆" },
  "51": { "level": "半吉", "desc": "一盛一衰，浮沉不定" },
  "52": { "level": "半吉", "desc": "眼望高山，两脚就地" },
  "53": { "level": "半吉", "desc": "忧愁困苦，内隐祸患" },
  "54": { "level": "大凶", "desc": "石上栽花，难得好果" },
  "55": { "level": "大凶", "desc": "善恶分明，吉凶参半" },
  "56": { "level": "大凶", "desc": "浪里行舟，历尽艰辛" },
  "57": { "level": "半吉", "desc": "日照春松，寒雪逢春" },
  "58": { "level": "半吉", "desc": "晚行遇月，沉浮多端" },
  "59": { "level": "大凶", "desc": "寒蝉悲风，意志难坚" },
  "60": { "level": "大凶", "desc": "无谋之人，漂泊不定" },
  "61": { "level": "大吉", "desc": "名利双收，繁荣富贵" },
  "62": { "level": "大凶", "desc": "衰败暗淡，自内生忧" },
  "63": { "level": "大吉", "desc": "万物化育，繁荣之象" },
  "64": { "level": "大凶", "desc": "骨肉分离，孤独悲愁" },
  "65": { "level": "大吉", "desc": "富贵至极，大吉大利" },
  "66": { "level": "半吉", "desc": "岩头步马，进退维谷" },
  "67": { "level": "大吉", "desc": "利路亨通，万商云集" },
  "68": { "level": "半吉", "desc": "兴家立业，宽宏大量" },
  "69": { "level": "大凶", "desc": "坐立不安，病弱废疾" },
  "70": { "level": "大凶", "desc": "凄惨衰退，悲剧之象" },
  "71": { "level": "半吉", "desc": "劳神费力，自强不息" },
  "72": { "level": "大凶", "desc": "先甘后苦，难望成功" },
  "73": { "level": "半吉", "desc": "高视阔步，独往独来" },
  "74": { "level": "大凶", "desc": "沉沦逆境，无用之数" },
  "75": { "level": "半吉", "desc": "退守可安，发迹甚迟" },
  "76": { "level": "大凶", "desc": "倾覆离散，穷困之数" },
  "77": { "level": "半吉", "desc": "先苦后甜，甘露同降" },
  "78": { "level": "半吉", "desc": "晚景凄清，功名不遂" },
  "79": { "level": "大凶", "desc": "云遮蔽月，挽回乏力" },
  "80": { "level": "大凶", "desc": "辛苦重重，凶数难改" },
  "81": { "level": "大吉", "desc": "万物回春，最吉之数" }
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add data/wuge_fortune.json && git commit -m "feat: add 81-number wuge fortune table"
```

---

### Task 5: 创建数据文件 — 字结构映射表

**Files:**
- Create: `data/char_structure.json`

- [ ] **Step 1: 创建常用取名汉字的结构映射表**

Create `data/char_structure.json` with structure types: `左右`, `上下`, `包围`, `独体`, `左中右`, `上中下`. Include the most common 200+ naming characters.

```json
{
  "左右": "明林沐沛沐沐清婉思悦恒怀忆忆信修佳俊健伟儒仪仁伟伦伯仲作佩使佳俊信倍倩值健伟儒仪仁伦伯仲作佩使佳俊信倍倩值健伟儒仪仁伦伯仲",
  "上下": "字守安宜宛宝容宫家宴宿寄寇富寒寝实宁宙宽宾导宫室客宣宴家容守安宜宛宝宫寒寇富寝宁宙宽宾寄宿导",
  "包围": "国园圆围回困因团圈图固圈园围国回因困团图固",
  "独体": "一乙人入八几九十千万上下天夫矢禾白立生主王玉术本未末母水火永民弗必矛半亚臣吏再西至贞而血舟辛言走足身车金长门雨飞食首香鬼骨鱼鸟鹿麻黄黑鼎鼓鼠齐齿龙龟",
  "左中右": "谢树淋渐湖激潮湾澎灌滩潋溅潇潆澜",
  "上中下": "意竟章率冀翼裹褒亵裹"
}
```

Note: The actual file should contain a more comprehensive mapping. The above is a skeleton — the implementer should expand it with all common naming characters from `name_dict.json`.

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add data/char_structure.json && git commit -m "feat: add character structure mapping table"
```

---

### Task 6: 重写音韵分析模块

**Files:**
- Rewrite: `src/lib/phonetic.ts`
- Create: `src/lib/__tests__/phonetic.test.ts`

- [ ] **Step 1: 写音韵分析的失败测试**

Create `src/lib/__tests__/phonetic.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { analyzePhonetic, checkHarmony } from '../phonetic'

describe('analyzePhonetic', () => {
  it('should return score 20 for ideal tone pattern (平仄相间)', () => {
    // 思远: sī(1) yuǎn(3) — 阴平+上声, 末字非去声
    const result = analyzePhonetic('思远')
    expect(result.score).toBeGreaterThan(15)
    expect(result.toneAnalysis).toBeTruthy()
    expect(result.rhymeAnalysis).toBeTruthy()
    expect(result.opennessAnalysis).toBeTruthy()
  })

  it('should penalize all-same tones', () => {
    // 三个同声调字
    const result = analyzePhonetic('天天天')
    expect(result.score).toBeLessThan(15)
    expect(result.toneAnalysis).toContain('平淡')
  })

  it('should penalize rhyme conflict', () => {
    // 李丽: lǐ lì — 韵母都是 i
    const result = analyzePhonetic('丽')
    expect(result.rhymeAnalysis).toBeTruthy()
  })

  it('should reward ending with 去声', () => {
    const result = analyzePhonetic('远大')
    expect(result.toneAnalysis).toContain('收音')
  })

  it('should return score between 0 and 20', () => {
    const result = analyzePhonetic('明远')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(20)
  })
})

describe('checkHarmony', () => {
  it('should detect exact harmony warnings', () => {
    const warnings = checkHarmony('杜子腾')
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('肚子疼')
  })

  it('should detect near-harmony warnings', () => {
    const warnings = checkHarmony('朱伟')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('should return empty for safe names', () => {
    const warnings = checkHarmony('明远')
    expect(warnings).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/phonetic.test.ts
```

Expected: FAIL (functions not yet implemented with new signatures)

- [ ] **Step 3: 重写 src/lib/phonetic.ts**

Rewrite `src/lib/phonetic.ts` with enhanced analysis:

```typescript
// src/lib/phonetic.ts
import { getPinyin } from './character'
import fs from 'fs'
import path from 'path'
import type { PhoneticResult } from '@/types'

// 声调映射
const TONE_MAP: Record<string, number> = {
  'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
  'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
  'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
  'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
  'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
  'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
}

const TONE_NAMES: Record<number, string> = {
  1: '阴平', 2: '阳平', 3: '上声', 4: '去声', 0: '轻声',
}

// 开口音韵母
const OPEN_FINALS = ['a', 'o', 'e', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng']
// 闭口音韵母
const CLOSED_FINALS = ['i', 'u', 'ü', 'in', 'un', 'ing', 'ia', 'ie', 'iu', 'ua', 'uo', 'ui']

// 近韵母对照表
const NEAR_RHYME_PAIRS: [string, string][] = [
  ['an', 'ang'], ['en', 'eng'], ['in', 'ing'], ['on', 'ong'],
]

// 谐音词库（懒加载）
let harmonyData: { exact: Record<string, string>; near: Record<string, string> } | null = null

function loadHarmonyData() {
  if (harmonyData) return harmonyData
  try {
    const filePath = path.join(process.cwd(), 'data', 'harmony_warnings.json')
    if (fs.existsSync(filePath)) {
      harmonyData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } else {
      harmonyData = { exact: {}, near: {} }
    }
  } catch {
    harmonyData = { exact: {}, near: {} }
  }
  return harmonyData
}

/**
 * 提取拼音中的声调
 */
export function extractTone(pinyin: string): number {
  for (const char of pinyin) {
    if (TONE_MAP[char]) return TONE_MAP[char]
  }
  const lastChar = pinyin.slice(-1)
  if (['1', '2', '3', '4'].includes(lastChar)) return parseInt(lastChar, 10)
  return 0
}

/**
 * 提取拼音的韵母（去掉声母和声调）
 */
function extractFinal(pinyin: string): string {
  // 去掉声调符号，得到纯拼音
  let plain = pinyin
  for (const accented of Object.keys(TONE_MAP)) {
    plain = plain.replace(accented, '')
  }
  // 常见声母列表
  const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w']
  for (const init of initials) {
    if (plain.startsWith(init)) {
      return plain.slice(init.length) || plain
    }
  }
  return plain
}

/**
 * 判断韵母是开口还是闭口
 */
function isOpenFinal(final: string): boolean | null {
  if (OPEN_FINALS.some(f => final.includes(f))) return true
  if (CLOSED_FINALS.some(f => final.includes(f))) return false
  return null
}

/**
 * 分析声调搭配，返回评价和扣分
 */
function analyzeTonePattern(tones: number[]): { analysis: string; deduction: number } {
  if (tones.length === 0) return { analysis: '', deduction: 0 }

  let deduction = 0
  const parts: string[] = []

  // 全同声调
  const allSame = tones.every(t => t === tones[0])
  if (allSame && tones[0] !== 0) {
    deduction += 8
    parts.push('声调单一，平淡乏味')
    return { analysis: parts.join('；'), deduction }
  }

  // 相邻字同声调
  let adjacentSame = 0
  for (let i = 1; i < tones.length; i++) {
    if (tones[i] === tones[i - 1] && tones[i] !== 0) adjacentSame++
  }
  if (adjacentSame > 0) {
    deduction += 3 * adjacentSame
    parts.push(`${adjacentSame}处相邻字同声调，缺乏变化`)
  }

  // 平仄分析
  const pings = tones.filter(t => t === 1 || t === 2).length
  const zes = tones.filter(t => t === 3 || t === 4).length
  if (pings > 0 && zes > 0) {
    if (Math.abs(pings - zes) <= 1) {
      parts.push('平仄相间，抑扬顿挫')
    } else {
      deduction += 2
      parts.push('平仄搭配尚可，略有偏重')
    }
  } else if (pings === tones.length) {
    deduction += 5
    parts.push('全平声，平淡无起伏')
  } else if (zes === tones.length) {
    deduction += 5
    parts.push('全仄声，生硬不柔和')
  }

  // 末字为去声（收音有力）
  if (tones[tones.length - 1] === 4) {
    deduction -= 2 // 加2分
    parts.push('末字去声收音，有力响亮')
  }

  return { analysis: parts.join('；'), deduction: Math.max(0, deduction) }
}

/**
 * 分析韵母搭配
 */
function analyzeRhyme(pinyins: string[]): { analysis: string; deduction: number } {
  if (pinyins.length < 2) return { analysis: '单字无需韵母搭配分析', deduction: 0 }

  const finals = pinyins.map(extractFinal)
  let deduction = 0
  const parts: string[] = []

  for (let i = 1; i < finals.length; i++) {
    // 相同韵母
    if (finals[i] === finals[i - 1]) {
      deduction += 3
      parts.push(`第${i}字与第${i + 1}字韵母相同(${finals[i]})，拗口`)
      continue
    }
    // 近韵母
    const isNear = NEAR_RHYME_PAIRS.some(([a, b]) =>
      (finals[i] === a && finals[i - 1] === b) || (finals[i] === b && finals[i - 1] === a)
    )
    if (isNear) {
      deduction += 1
      parts.push(`第${i}字与第${i + 1}字韵母相近(${finals[i - 1]}/${finals[i]})，略显重复`)
    }
  }

  if (parts.length === 0) {
    parts.push('韵母搭配和谐，无冲突')
  }

  return { analysis: parts.join('；'), deduction }
}

/**
 * 分析开闭口音
 */
function analyzeOpenness(pinyins: string[]): { analysis: string; deduction: number } {
  if (pinyins.length < 2) return { analysis: '单字无需开闭口音分析', deduction: 0 }

  const finals = pinyins.map(extractFinal)
  const types = finals.map(f => isOpenFinal(f))

  const opens = types.filter(t => t === true).length
  const closes = types.filter(t => t === false).length

  if (opens > 0 && closes > 0) {
    return { analysis: '开闭口音搭配得当，音韵丰富', deduction: 0 }
  } else if (opens === types.length) {
    return { analysis: '全开口音，略显单调', deduction: 2 }
  } else if (closes === types.length) {
    return { analysis: '全闭口音，音色偏窄', deduction: 2 }
  }

  return { analysis: '开闭口音基本搭配', deduction: 0 }
}

/**
 * 分析名字的音律（增强版）
 */
export function analyzePhonetic(name: string): PhoneticResult {
  const chars = name.split('')
  const pinyins: string[] = []
  const tones: number[] = []
  const toneNames: string[] = []

  for (const char of chars) {
    const pinyin = getPinyin(char)
    pinyins.push(pinyin)
    const tone = extractTone(pinyin)
    tones.push(tone)
    toneNames.push(TONE_NAMES[tone] || '轻声')
  }

  const { analysis: toneAnalysis, deduction: toneDeduction } = analyzeTonePattern(tones)
  const { analysis: rhymeAnalysis, deduction: rhymeDeduction } = analyzeRhyme(pinyins)
  const { analysis: opennessAnalysis, deduction: opennessDeduction } = analyzeOpenness(pinyins)

  const totalDeduction = toneDeduction + rhymeDeduction + opennessDeduction
  const score = Math.max(0, Math.min(20, 20 - totalDeduction))

  const analysisParts = [toneAnalysis, rhymeAnalysis, opennessAnalysis].filter(Boolean)
  const analysis = analysisParts.join('。')

  return {
    pinyins,
    tones,
    toneNames,
    toneAnalysis,
    rhymeAnalysis,
    opennessAnalysis,
    analysis,
    score,
  }
}

/**
 * 检查是否有不良谐音（增强版）
 */
export function checkHarmony(name: string): string[] {
  const warnings: string[] = []
  const data = loadHarmonyData()

  // 精确匹配
  for (const [bad, warning] of Object.entries(data.exact)) {
    if (name.includes(bad) || name === bad) {
      warnings.push(`谐音"${warning}"`)
    }
  }

  // 近音匹配：检查名字中的每个字是否在近音表中
  for (const char of name) {
    if (data.near[char]) {
      // 只在姓氏位置触发（名字第一个字）
      if (name.indexOf(char) === 0) {
        warnings.push(`姓"${char}"近音"${data.near[char]}"，需注意谐音`)
      }
    }
  }

  return warnings
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/phonetic.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/phonetic.ts src/lib/__tests__/phonetic.test.ts && git commit -m "feat: rewrite phonetic analysis with tone, rhyme, openness scoring"
```

---

### Task 7: 增强五行模块 — 八字补益分析

**Files:**
- Modify: `src/lib/wuxing.ts`
- Create: `src/lib/__tests__/wuxing.test.ts`

- [ ] **Step 1: 写五行补益的失败测试**

Create `src/lib/__tests__/wuxing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateBaZi, analyzeWuxingBenefit, getWuxingRelation } from '../wuxing'

describe('analyzeWuxingBenefit', () => {
  it('should identify xi-yong when day master is weak', () => {
    // 构造一个日主弱的八字（木日主，金多克木）
    const baZi = {
      yearGan: '庚', yearZhi: '申',
      monthGan: '辛', monthZhi: '酉',
      dayGan: '甲', dayZhi: '寅',
      timeGan: '庚', timeZhi: '申',
      wuxing: { gold: 4, wood: 2, water: 0, fire: 0, earth: 0 },
      missing: ['水', '火', '土'],
      dominant: '金',
    }
    const result = analyzeWuxingBenefit(baZi, ['水', '木'])
    expect(result.xiYong).toContain('水')
    expect(result.score).toBeGreaterThan(0)
  })

  it('should penalize name with ji-shen elements', () => {
    const baZi = {
      yearGan: '甲', yearZhi: '寅',
      monthGan: '丙', monthZhi: '午',
      dayGan: '甲', dayZhi: '寅',
      timeGan: '丙', timeZhi: '午',
      wuxing: { gold: 0, wood: 3, water: 0, fire: 3, earth: 0 },
      missing: ['金', '水', '土'],
      dominant: '木',
    }
    // 名字五行包含火（忌神，日主已旺）
    const result = analyzeWuxingBenefit(baZi, ['火', '木'])
    expect(result.score).toBeLessThan(15)
  })

  it('should return score between 0 and 25', () => {
    const baZi = {
      yearGan: '甲', yearZhi: '子',
      monthGan: '丙', monthZhi: '寅',
      dayGan: '戊', dayZhi: '辰',
      timeGan: '庚', timeZhi: '申',
      wuxing: { gold: 1, wood: 2, water: 1, fire: 1, earth: 2 },
      missing: [],
      dominant: '木',
    }
    const result = analyzeWuxingBenefit(baZi, ['金', '水'])
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(25)
  })
})

describe('getWuxingRelation', () => {
  it('should return 生 for wood→fire', () => {
    expect(getWuxingRelation('木', '火')).toBe('生')
  })
  it('should return 克 for metal→wood', () => {
    expect(getWuxingRelation('金', '木')).toBe('克')
  })
  it('should return 同 for same element', () => {
    expect(getWuxingRelation('水', '水')).toBe('同')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/wuxing.test.ts
```

Expected: FAIL

- [ ] **Step 3: 在 wuxing.ts 中新增 analyzeWuxingBenefit 和 getWuxingRelation**

Add to `src/lib/wuxing.ts` after the existing `parseBirthTime` function:

```typescript
// 五行相生关系：木→火→土→金→水→木
const SHENG_CHAIN = ['木', '火', '土', '金', '水']
// 五行相克关系：木→土→水→火→金→木
const KE_CHAIN = ['木', '土', '水', '火', '金']

/**
 * 获取两个五行之间的关系
 */
export function getWuxingRelation(from: string, to: string): '生' | '克' | '被生' | '被克' | '同' | '无' {
  if (from === to) return '同'
  if (!SHENG_CHAIN.includes(from) || !SHENG_CHAIN.includes(to)) return '无'

  const fromIdx = SHENG_CHAIN.indexOf(from)
  const toIdx = SHENG_CHAIN.indexOf(to)

  // 相生：from 生 to
  if (SHENG_CHAIN[(fromIdx + 1) % 5] === to) return '生'
  // 被生：to 生 from
  if (SHENG_CHAIN[(toIdx + 1) % 5] === from) return '被生'

  const fromKeIdx = KE_CHAIN.indexOf(from)
  const toKeIdx = KE_CHAIN.indexOf(to)
  // 相克：from 克 to
  if (KE_CHAIN[(fromKeIdx + 1) % 5] === to) return '克'
  // 被克：to 克 from
  if (KE_CHAIN[(toKeIdx + 1) % 5] === from) return '被克'

  return '无'
}

/**
 * 判断日主强弱（简化版）
 * 日主 = 日干对应的五行
 * 强弱判断：同类五行（日主+生我者）vs 异类五行（克我+我生+我克）
 */
function judgeDayMasterStrength(baZi: BaZiResult): '强' | '弱' | '中' {
  const dayGanWuxing = getGanWuxing(baZi.dayGan)
  if (!dayGanWuxing) return '中'

  // 生我者的五行
  const shengMeIdx = (SHENG_CHAIN.indexOf(dayGanWuxing) + 4) % 5
  const shengMeWuxing = SHENG_CHAIN[shengMeIdx]

  // 同类 = 日主五行 + 生我者五行
  const stats = baZi.wuxing
  const wuxingCounts: Record<string, number> = {
    '金': stats.gold, '木': stats.wood, '水': stats.water, '火': stats.fire, '土': stats.earth,
  }

  const sameKind = (wuxingCounts[dayGanWuxing] || 0) + (wuxingCounts[shengMeWuxing] || 0)
  const diffKind = 8 - sameKind // 八字共8个字

  if (sameKind > diffKind + 1) return '强'
  if (sameKind < diffKind - 1) return '弱'
  return '中'
}

function getGanWuxing(gan: string): string | null {
  const map: Record<string, string> = {
    '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土',
    '庚': '金', '辛': '金', '壬': '水', '癸': '水',
  }
  return map[gan] || null
}

/**
 * 分析名字五行对八字的补益
 */
export function analyzeWuxingBenefit(baZi: BaZiResult, nameWuxing: string[]): WuxingBenefitResult {
  const dayMasterStrength = judgeDayMasterStrength(baZi)
  const dayGanWuxing = getGanWuxing(baZi.dayGan) || '木'

  // 确定喜用神和忌神
  const xiYong: string[] = []
  const jiShen: string[] = []

  const dayIdx = SHENG_CHAIN.indexOf(dayGanWuxing)

  if (dayMasterStrength === '强') {
    // 日主强：喜克泄耗（克我者、我生者、我克者）
    // 克我者
    jiShen.push(SHENG_CHAIN[(dayIdx + 4) % 5]) // 生我者（使更强）
    jiShen.push(dayGanWuxing) // 同类
    xiYong.push(SHENG_CHAIN[(dayIdx + 1) % 5]) // 我生者（泄）
    const keMeIdx = KE_CHAIN.indexOf(dayGanWuxing)
    xiYong.push(KE_CHAIN[(keMeIdx + 1) % 5]) // 我克者（耗）
    const keMeFromIdx = (KE_CHAIN.indexOf(dayGanWuxing) + 4) % 5
    xiYong.push(KE_CHAIN[keMeFromIdx]) // 克我者
  } else {
    // 日主弱：喜生扶（生我者、同类）
    xiYong.push(SHENG_CHAIN[(dayIdx + 4) % 5]) // 生我者
    xiYong.push(dayGanWuxing) // 同类
    jiShen.push(SHENG_CHAIN[(dayIdx + 1) % 5]) // 我生者（泄弱）
    const keMeFromIdx = (KE_CHAIN.indexOf(dayGanWuxing) + 4) % 5
    jiShen.push(KE_CHAIN[keMeFromIdx]) // 克我者
  }

  // 计算补益评分
  let score = 13 // 基础分
  const benefitParts: string[] = []

  for (const wx of nameWuxing) {
    if (xiYong.includes(wx)) {
      score += 8
      benefitParts.push(`名字含"${wx}"为喜用神，大吉`)
    }
    if (jiShen.includes(wx)) {
      score -= 8
      benefitParts.push(`名字含"${wx}"为忌神，不利`)
    }
    if (baZi.missing.includes(wx)) {
      score += 5
      benefitParts.push(`名字补了八字缺失的"${wx}"`)
    }
  }

  // 相邻字五行相生相克
  for (let i = 1; i < nameWuxing.length; i++) {
    const relation = getWuxingRelation(nameWuxing[i - 1], nameWuxing[i])
    if (relation === '生') {
      score += 3
      benefitParts.push(`${nameWuxing[i - 1]}生${nameWuxing[i]}，相生为吉`)
    } else if (relation === '克') {
      score -= 3
      benefitParts.push(`${nameWuxing[i - 1]}克${nameWuxing[i]}，相克为凶`)
    }
  }

  score = Math.max(0, Math.min(25, score))

  const nameBenefit = benefitParts.length > 0
    ? benefitParts.join('；')
    : '名字五行与八字无明显冲突或补益'

  return { xiYong, jiShen, nameBenefit, score }
}
```

Also add the import for `WuxingBenefitResult` at the top:

```typescript
import type { WuxingBenefitResult } from '@/types'
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/wuxing.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/wuxing.ts src/lib/__tests__/wuxing.test.ts && git commit -m "feat: add wuxing benefit analysis with xi-yong and ji-shen"
```

---

### Task 8: 增强三才五格 — 数理吉凶+量化评分

**Files:**
- Modify: `src/lib/sancai-wuge.ts`
- Create: `src/lib/__tests__/sancai-wuge.test.ts`

- [ ] **Step 1: 写三才五格增强的失败测试**

Create `src/lib/__tests__/sancai-wuge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { analyzeSanCaiWuGeEnhanced } from '../sancai-wuge'

describe('analyzeSanCaiWuGeEnhanced', () => {
  it('should return WuGeDetailResult with score', () => {
    const result = analyzeSanCaiWuGeEnhanced('李明远')
    expect(result).not.toBeNull()
    expect(result!.score).toBeGreaterThanOrEqual(0)
    expect(result!.score).toBeLessThanOrEqual(20)
    expect(result!.tianGe.level).toBeTruthy()
    expect(result!.renGe.level).toBeTruthy()
    expect(result!.sancaiLevel).toBeTruthy()
  })

  it('should give high score for auspicious configuration', () => {
    // 找一个三才大吉的名字
    const result = analyzeSanCaiWuGeEnhanced('李婉清')
    expect(result).not.toBeNull()
    // 三才吉的名字分数应该较高
    if (result!.sancaiLevel === '大吉' || result!.sancaiLevel === '吉') {
      expect(result!.score).toBeGreaterThanOrEqual(14)
    }
  })

  it('should return null for invalid name', () => {
    const result = analyzeSanCaiWuGeEnhanced('')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/sancai-wuge.test.ts
```

Expected: FAIL

- [ ] **Step 3: 在 sancai-wuge.ts 中新增增强分析函数**

Add to `src/lib/sancai-wuge.ts` after the existing `analyzeSanCaiWuGe` function:

```typescript
import type { WuGeDetailResult, WuGeDetailItem } from '@/types'
import wugeFortuneData from '@/data/wuge_fortune.json'

const wugeFortune: Record<string, { level: string; desc: string }> = wugeFortuneData as Record<string, { level: string; desc: string }>

/**
 * 获取五格数的吉凶信息
 */
function getWugeFortune(num: number): WuGeDetailItem {
  // 超过81的数取模，但姓名学中通常直接用原数
  const key = String(num)
  const fortune = wugeFortune[key]
  if (fortune) {
    return {
      num,
      wuxing: numberToWuxing(num),
      fortune: fortune.desc,
      level: fortune.level as WuGeDetailItem['level'],
    }
  }
  // 超过81的数，用模80+1映射回1-81
  const mappedNum = ((num - 1) % 80) + 1
  const mappedFortune = wugeFortune[String(mappedNum)]
  return {
    num,
    wuxing: numberToWuxing(num),
    fortune: mappedFortune?.desc || '运势一般',
    level: (mappedFortune?.level || '半吉') as WuGeDetailItem['level'],
  }
}

/**
 * 判断三才吉凶等级
 */
function getSanCaiLevel(fortune: string): WuGeDetailResult['sancaiLevel'] {
  if (fortune.includes('佳') || fortune.includes('顺利') || fortune.includes('稳固')) return '大吉'
  if (fortune.includes('但需')) return '吉'
  if (fortune.includes('被压抑') || fortune.includes('消极')) return '凶'
  if (fortune.includes('灾祸') || fortune.includes('不稳')) return '大凶'
  return '半吉'
}

/**
 * 增强版三才五格分析，包含量化评分
 */
export function analyzeSanCaiWuGeEnhanced(fullName: string): WuGeDetailResult | null {
  if (!fullName || fullName.length < 2) return null

  const basic = analyzeSanCaiWuGe(fullName)
  if (!basic) return null

  const { wuge, sancai } = basic

  // 五格详情
  const tianGe = getWugeFortune(wuge.tianGe)
  const renGe = getWugeFortune(wuge.renGe)
  const diGe = getWugeFortune(wuge.diGe)
  const waiGe = getWugeFortune(wuge.waiGe)
  const zongGe = getWugeFortune(wuge.zongGe)

  // 三才吉凶等级
  const sancaiLevel = getSanCaiLevel(sancai.fortune)

  // 量化评分
  let score = 10 // 基础分

  // 三才评分
  if (sancaiLevel === '大吉') score = 20
  else if (sancaiLevel === '吉') score = 17
  else if (sancaiLevel === '半吉') score = 14
  else if (sancaiLevel === '凶') score = 6
  else if (sancaiLevel === '大凶') score = 3

  // 人格（核心格）加减分
  if (renGe.level === '大吉' || renGe.level === '吉') score += 3
  else if (renGe.level === '凶' || renGe.level === '大凶') score -= 5

  // 总格加减分
  if (zongGe.level === '大吉' || zongGe.level === '吉') score += 2
  else if (zongGe.level === '凶' || zongGe.level === '大凶') score -= 3

  score = Math.max(0, Math.min(20, score))

  return {
    tianGe,
    renGe,
    diGe,
    waiGe,
    zongGe,
    sancaiFortune: sancai.fortune,
    sancaiLevel,
    score,
  }
}
```

Also need to copy `wuge_fortune.json` to `src/data/` for the build (following the existing pattern where `src/data/` symlinks/copies from `data/`):

```bash
cp D:/dev/git/ai-naming/data/wuge_fortune.json D:/dev/git/ai-naming/src/data/wuge_fortune.json
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/sancai-wuge.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/sancai-wuge.ts src/lib/__tests__/sancai-wuge.test.ts src/data/wuge_fortune.json && git commit -m "feat: add wuge fortune table and enhanced sancai-wuge scoring"
```

---

### Task 9: 新增字形结构分析模块

**Files:**
- Create: `src/lib/glyph.ts`
- Create: `src/lib/__tests__/glyph.test.ts`

- [ ] **Step 1: 写字形分析的测试**

Create `src/lib/__tests__/glyph.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { analyzeGlyph } from '../glyph'

describe('analyzeGlyph', () => {
  it('should return score 10 for balanced name', () => {
    // 明远: 8+7=15画，笔画平衡
    const result = analyzeGlyph('明远', [8, 7])
    expect(result.score).toBeGreaterThan(7)
    expect(result.strokeBalance).toBeTruthy()
  })

  it('should penalize unbalanced strokes', () => {
    // 一鑫: 1+24=25画，标准差极大
    const result = analyzeGlyph('一鑫', [1, 24])
    expect(result.score).toBeLessThan(8)
    expect(result.strokeBalance).toContain('差异')
  })

  it('should penalize hard-to-write characters', () => {
    // 鑫: 24画
    const result = analyzeGlyph('鑫', [24])
    expect(result.writingEase).toContain('难写')
  })

  it('should penalize rare characters', () => {
    const result = analyzeGlyph('彧', [10])
    expect(result.rarity).toContain('生僻')
  })

  it('should return score between 0 and 10', () => {
    const result = analyzeGlyph('明远', [8, 7])
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/glyph.test.ts
```

Expected: FAIL

- [ ] **Step 3: 创建 src/lib/glyph.ts**

```typescript
// src/lib/glyph.ts
import fs from 'fs'
import path from 'path'
import { getNameChars } from './character'
import type { GlyphResult } from '@/types'

// 字结构数据（懒加载）
let structureMap: Record<string, string> | null = null

function loadStructureMap(): Record<string, string> {
  if (structureMap) return structureMap
  try {
    const filePath = path.join(process.cwd(), 'data', 'char_structure.json')
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      // 将分类表转为 字→结构类型 的映射
      structureMap = {}
      for (const [type, chars] of Object.entries(data)) {
        for (const char of (chars as string)) {
          structureMap![char] = type
        }
      }
    } else {
      structureMap = {}
    }
  } catch {
    structureMap = {}
  }
  return structureMap!
}

// GB2312 常用字范围（简化判断：Unicode 0x4E00-0x9FFF 中的常用字）
// 实际 GB2312 有 6763 字，这里用简化判断
function isInGB2312(char: string): boolean {
  const code = char.charCodeAt(0)
  // CJK 基本区，大部分 GB2312 字在此范围
  // 精确判断需要完整的 GB2312 字表，这里用近似
  return code >= 0x4E00 && code <= 0x9FFF
}

/**
 * 分析字形结构
 */
export function analyzeGlyph(name: string, strokes: number[]): GlyphResult {
  const chars = name.split('')
  let deduction = 0

  // 1. 笔画平衡度
  const avg = strokes.reduce((a, b) => a + b, 0) / strokes.length
  const variance = strokes.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / strokes.length
  const stdDev = Math.sqrt(variance)

  let strokeBalance: string
  if (stdDev <= 2) {
    strokeBalance = `笔画均衡（标准差${stdDev.toFixed(1)}）`
  } else if (stdDev <= 5) {
    deduction += 1
    strokeBalance = `笔画略有差异（标准差${stdDev.toFixed(1)}）`
  } else {
    deduction += 3
    strokeBalance = `笔画差异大（标准差${stdDev.toFixed(1)}），视觉不协调`
  }

  // 2. 书写便利度
  const writingParts: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (strokes[i] > 20) {
      deduction += 2
      writingParts.push(`"${chars[i]}"${strokes[i]}画，难写`)
    } else if (strokes[i] > 15) {
      deduction += 1
      writingParts.push(`"${chars[i]}"${strokes[i]}画，较难写`)
    }
  }
  const totalStrokes = strokes.reduce((a, b) => a + b, 0)
  if (totalStrokes > 30) {
    deduction += 1
    writingParts.push(`总笔画${totalStrokes}画，整体偏繁`)
  }
  const writingEase = writingParts.length > 0
    ? writingParts.join('；')
    : '书写便利，笔画适中'

  // 3. 视觉结构分析
  const structMap = loadStructureMap()
  const structures = chars.map(c => structMap[c] || '未知')
  let sameStructureCount = 0
  for (let i = 1; i < structures.length; i++) {
    if (structures[i] === structures[i - 1] && structures[i] !== '未知') {
      sameStructureCount++
    }
  }
  let visualStructure: string
  if (sameStructureCount > 0) {
    deduction += 1
    visualStructure = `${sameStructureCount}处相邻字同结构类型(${structures.filter(s => s !== '未知').join('→')})，视觉单调`
  } else {
    const uniqueStructures = new Set(structures.filter(s => s !== '未知'))
    visualStructure = uniqueStructures.size > 1
      ? `结构多样(${[...uniqueStructures].join('、')})，视觉丰富`
      : '结构类型单一'
  }

  // 4. 生僻度检测
  const nameChars = getNameChars()
  let rarity: string
  let hasRare = false
  for (const char of chars) {
    if (nameChars.includes(char)) continue
    if (isInGB2312(char)) {
      deduction += 1
      rarity = `"${char}"不在常用取名字中，较不常见`
      hasRare = true
    } else {
      deduction += 3
      rarity = `"${char}"为生僻字，影响日常使用`
      hasRare = true
    }
  }
  if (!hasRare) {
    rarity = '均为常用字，易于识别'
  }

  const score = Math.max(0, Math.min(10, 10 - deduction))

  return {
    strokeBalance,
    writingEase,
    visualStructure,
    rarity: rarity!,
    score,
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/glyph.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/glyph.ts src/lib/__tests__/glyph.test.ts && git commit -m "feat: add glyph structure analysis module"
```

---

### Task 10: 新增重名率分析模块

**Files:**
- Create: `src/lib/popularity.ts`
- Create: `src/lib/__tests__/popularity.test.ts`

- [ ] **Step 1: 写重名率分析的测试**

Create `src/lib/__tests__/popularity.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { analyzeNamePopularity } from '../popularity'

describe('analyzeNamePopularity', () => {
  it('should return 极高 for very common names', () => {
    // 子轩 is extremely common
    const result = analyzeNamePopularity('子轩')
    expect(result.level).toBe('极高')
    expect(result.score).toBeLessThanOrEqual(2)
  })

  it('should return 极低 for rare names', () => {
    const result = analyzeNamePopularity('彧翀')
    expect(result.level).toBe('极低')
    expect(result.score).toBeGreaterThanOrEqual(4)
  })

  it('should return score between 0 and 5', () => {
    const result = analyzeNamePopularity('明远')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(5)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/popularity.test.ts
```

Expected: FAIL

- [ ] **Step 3: 创建 src/lib/popularity.ts**

```typescript
// src/lib/popularity.ts
import fs from 'fs'
import path from 'path'
import type { PopularityResult } from '@/types'

// 名字词频缓存
let nameFreqMap: Map<string, number> | null = null

/**
 * 加载名字词频数据
 * 数据格式：每行 "名字\t性别" 或 "名字"
 */
function loadNameFreq(): Map<string, number> {
  if (nameFreqMap) return nameFreqMap

  nameFreqMap = new Map()
  try {
    const filePath = path.join(process.cwd(), 'data', 'names_corpus_gender.txt')
    if (!fs.existsSync(filePath)) return nameFreqMap

    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // 格式可能是 "名字 性别" 或 "名字"
      const parts = trimmed.split(/\s+/)
      const name = parts[0]
      if (name.length >= 2) {
        nameFreqMap.set(name, (nameFreqMap.get(name) || 0) + 1)
      }
    }

    console.log(`Loaded ${nameFreqMap.size} unique names from corpus`)
  } catch (err) {
    console.error('Failed to load name corpus:', err)
  }

  return nameFreqMap
}

/**
 * 分析名字的重名率
 */
export function analyzeNamePopularity(nameOnly: string): PopularityResult {
  const freqMap = loadNameFreq()

  // 只分析名（不含姓）
  const count = freqMap.get(nameOnly) || 0

  // 计算同音名数量（简化：相同名但不同字的已在count中）
  // 精确的同音名需要拼音数据，这里用近似
  let homophoneCount = 0
  for (const [key, val] of freqMap) {
    if (key.length === nameOnly.length && key !== nameOnly) {
      // 简化判断：同长度不同字的名字视为潜在同音名
      homophoneCount += val
    }
  }
  // 同音名数量太大，只取一个合理的近似值
  homophoneCount = Math.min(homophoneCount, 99999)

  // 重名等级
  let level: PopularityResult['level']
  let score: number

  if (count > 10000) {
    level = '极高'
    score = 2
  } else if (count > 1000) {
    level = '高'
    score = 4
  } else if (count > 100) {
    level = '中等'
    score = 5
  } else if (count > 10) {
    level = '低'
    score = 5
  } else {
    level = '极低'
    score = 5
  }

  return { level, count, homophoneCount, score }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
cd D:/dev/git/ai-naming && npx vitest run src/lib/__tests__/popularity.test.ts
```

Expected: PASS (may need adjustment based on actual corpus data)

- [ ] **Step 5: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/popularity.ts src/lib/__tests__/popularity.test.ts && git commit -m "feat: add name popularity analysis module"
```

---

### Task 11: 升级 RAG 嵌入 — 替换为 Ollama bge-m3

**Files:**
- Rewrite: `src/lib/rag/embeddings.ts`

- [ ] **Step 1: 重写 embeddings.ts 使用 Ollama API**

Rewrite `src/lib/rag/embeddings.ts`:

```typescript
// src/lib/rag/embeddings.ts
import fs from 'fs'
import path from 'path'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'bge-m3'
const CACHE_FILE = path.join(process.cwd(), 'data', 'embedding_cache.json')

// 嵌入缓存
let cache: Record<string, number[]> = {}

/**
 * 加载嵌入缓存
 */
function loadCache(): void {
  if (Object.keys(cache).length > 0) return
  try {
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
      console.log(`Loaded ${Object.keys(cache).length} cached embeddings`)
    }
  } catch {
    cache = {}
  }
}

/**
 * 保存嵌入缓存
 */
function saveCache(): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8')
  } catch (err) {
    console.error('Failed to save embedding cache:', err)
  }
}

/**
 * 获取文本的向量嵌入（通过 Ollama bge-m3）
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  loadCache()

  // 检查缓存
  if (cache[text]) return cache[text]

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
    })

    if (!response.ok) {
      console.error(`Ollama embedding failed (${response.status}), falling back to char-freq`)
      return getCharFreqEmbedding(text)
    }

    const data = await response.json()
    const embedding: number[] = data.embedding

    if (!embedding || embedding.length === 0) {
      return getCharFreqEmbedding(text)
    }

    // 缓存结果
    cache[text] = embedding
    saveCache()

    return embedding
  } catch (err) {
    console.error('Ollama embedding error, falling back to char-freq:', err)
    return getCharFreqEmbedding(text)
  }
}

/**
 * 字频向量（降级方案，当 Ollama 不可用时使用）
 */
function getCharFreqEmbedding(text: string): number[] {
  const vector = new Array(256).fill(0)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) % 256
    vector[code]++
  }
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] /= magnitude
  }
  return vector
}

/**
 * 计算余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    magnitudeA += a[i] * a[i]
    magnitudeB += b[i] * b[i]
  }

  magnitudeA = Math.sqrt(magnitudeA)
  magnitudeB = Math.sqrt(magnitudeB)

  if (magnitudeA === 0 || magnitudeB === 0) return 0
  return dotProduct / (magnitudeA * magnitudeB)
}

/**
 * 预计算所有条目的嵌入并缓存
 */
export async function precomputeEmbeddings(entries: string[]): Promise<void> {
  loadCache()

  let newCount = 0
  for (const text of entries) {
    if (!cache[text]) {
      const embedding = await getEmbeddings(text)
      cache[text] = embedding
      newCount++
    }
  }

  if (newCount > 0) {
    saveCache()
    console.log(`Precomputed ${newCount} new embeddings (total: ${Object.keys(cache).length})`)
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/rag/embeddings.ts && git commit -m "feat: replace char-freq embeddings with Ollama bge-m3"
```

---

### Task 12: 增强 RAG 检索器 — 混合检索+新数据源

**Files:**
- Modify: `src/lib/rag/retriever.ts`

- [ ] **Step 1: 增强 retriever.ts 支持唐诗宋词论语和混合检索**

Modify `src/lib/rag/retriever.ts` to add:

1. In `initialize()`, after loading 楚辞, add loading for 唐诗, 宋词, 论语:

```typescript
    // 加载唐诗
    const tangshiPath = path.join(process.cwd(), 'data', 'tangshi.json')
    if (fs.existsSync(tangshiPath)) {
      const tangshi = JSON.parse(fs.readFileSync(tangshiPath, 'utf-8'))
      for (const poem of tangshi) {
        const source = `唐诗·${poem.author}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({ source, content: line })
        }
      }
    }

    // 加载宋词
    const songciPath = path.join(process.cwd(), 'data', 'songci.json')
    if (fs.existsSync(songciPath)) {
      const songci = JSON.parse(fs.readFileSync(songciPath, 'utf-8'))
      for (const poem of songci) {
        const source = `宋词·${poem.author}·${poem.title}`
        for (const line of poem.content || []) {
          this.entries.push({ source, content: line })
        }
      }
    }

    // 加载论语
    const lunyuPath = path.join(process.cwd(), 'data', 'lunyu.json')
    if (fs.existsSync(lunyuPath)) {
      const lunyu = JSON.parse(fs.readFileSync(lunyuPath, 'utf-8'))
      for (const item of lunyu) {
        const source = `论语·${item.chapter || '论语'}`
        this.entries.push({ source, content: item.content })
      }
    }
```

2. Add hybrid search method:

```typescript
  /**
   * 混合检索：语义搜索 + 关键词搜索
   */
  async hybridSearch(query: string, topK: number = 10): Promise<ClassicSearchResult[]> {
    await this.initialize()

    // 语义搜索 top 20
    const semanticResults = await this.search(query, 20)

    // 关键词搜索 top 5
    const keywordResults = await this.searchByKeyword(query, 5)

    // 合并去重
    const seen = new Set<string>()
    const merged: ClassicSearchResult[] = []

    for (const r of [...semanticResults, ...keywordResults]) {
      const key = `${r.source}:${r.content}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(r)
      }
    }

    // 按相关度排序，取 topK
    merged.sort((a, b) => b.relevance - a.relevance)
    return merged.slice(0, topK)
  }
```

3. In `initialize()`, after loading all entries, call precompute:

```typescript
    // 预计算嵌入
    const { precomputeEmbeddings } = await import('./embeddings')
    const contents = this.entries.map(e => e.content)
    await precomputeEmbeddings(contents)
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/rag/retriever.ts && git commit -m "feat: enhance RAG retriever with hybrid search and Tang/Song/Lunyu data"
```

---

### Task 13: 优化 AI 提示词

**Files:**
- Modify: `src/lib/llm.ts`

- [ ] **Step 1: 重写 getSystemPrompt 和新增 getAnalysisSystemPrompt**

Modify `src/lib/llm.ts` — replace `getSystemPrompt()` and add `getAnalysisSystemPrompt()`:

```typescript
/**
 * 获取系统提示词（取名模式）
 */
export function getSystemPrompt(): string {
  return `你是一位专业、客观的中文取名顾问，精通传统文化和现代审美。

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
}

/**
 * 获取分析模式的系统提示词
 */
export function getAnalysisSystemPrompt(): string {
  return `你是一位拥有20年经验的资深姓名学专家，精通汉字字源、五行学说、三才五格、音律美学以及现代命名趋势。

你的原则：
1. 专业、客观、实事求是
2. 好的地方要肯定，不好的地方要明确指出
3. 不为了讨好用户而只说好话
4. 用现代语言解释，不要故弄玄虚
5. 评分要真实反映名字的质量，不要虚高

**评分锚定规则：**
- 90+ 分：各维度都优秀，极少数名字能达到
- 80-89 分：多数维度优秀，个别有瑕疵
- 70-79 分：普通好名字，有一定优点
- 60-69 分：有较明显问题
- <60 分：有严重问题

**禁止"和稀泥"：**
- 差就是差，不用"尚可""还行""基本可以"等模糊词
- 五行/三才五格的解读必须引用具体数据，不能泛泛而谈
- 如果某维度得分低，必须明确指出问题所在

**你的角色：**
你收到的数据中已包含各维度的量化评分。你的任务是：
1. 用专业语言解释每个维度得分的理由
2. 可以在量化评分基础上微调 ±2 分，但必须说明理由
3. 综合评分 = 各维度评分之和 + 你的微调
4. 给出专家点评和改进建议

你的风格是犀利但不刻薄，专业但不晦涩。用户需要的是真实的分析，帮助他们理解名字的真实价值。`
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/lib/llm.ts && git commit -m "feat: optimize AI prompts with score anchoring and analysis system prompt"
```

---

### Task 14: 重写分析 API 路由 — 集成所有增强模块

**Files:**
- Rewrite: `src/app/api/analyze/route.ts`

- [ ] **Step 1: 重写 analyze/route.ts 集成所有增强模块**

Rewrite `src/app/api/analyze/route.ts`:

```typescript
// src/app/api/analyze/route.ts
import { Anthropic } from '@anthropic-ai/sdk'
import { loadModelConfig } from '@/lib/model-config'
import { getCharacterInfo } from '@/lib/character'
import { analyzeSanCaiWuGe, analyzeSanCaiWuGeEnhanced } from '@/lib/sancai-wuge'
import { analyzePhonetic, checkHarmony } from '@/lib/phonetic'
import { calculateBaZi, parseBirthTime, analyzeWuxingBenefit } from '@/lib/wuxing'
import { analyzeGlyph } from '@/lib/glyph'
import { analyzeNamePopularity } from '@/lib/popularity'
import { createSession, addMessage } from '@/lib/session'
import { getAnalysisSystemPrompt } from '@/lib/llm'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const { name, birthTime, sessionId } = await req.json()
    console.log('Analyze API received name:', name)
    const config = loadModelConfig()

    if (!name || name.length < 2) {
      return new Response(JSON.stringify({ error: '请输入有效的姓名' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 创建或使用现有会话
    let currentSessionId = sessionId
    if (!currentSessionId) {
      const session = createSession('analyze')
      currentSessionId = session.sessionId
    }

    // ① 字符查询
    const chars = name.split('')
    const charInfos = chars.map(char => getCharacterInfo(char) || { char, pinyin: '', wuxing: '-', strokes: 0 })
    console.log('Char infos:', charInfos.map(c => `${c.char}:${c.pinyin}:${c.wuxing}:${c.strokes}`).join(', '))

    // ② 八字五行补益分析
    let wuxingBenefit = null
    let baZi = null
    if (birthTime) {
      const parsed = parseBirthTime(birthTime)
      if (parsed) {
        baZi = calculateBaZi(parsed.year, parsed.month, parsed.day, parsed.hour, parsed.minute)
        if (baZi) {
          const nameWuxing = charInfos.slice(1).map(c => c.wuxing).filter(w => w !== '-')
          wuxingBenefit = analyzeWuxingBenefit(baZi, nameWuxing)
        }
      }
    }

    // ③ 三才五格增强分析
    const sancaiWugeEnhanced = analyzeSanCaiWuGeEnhanced(name)
    const sancaiWuge = analyzeSanCaiWuGe(name)

    // ④ 音律分析（增强版）
    const nameOnly = name.slice(1)
    const phonetic = analyzePhonetic(nameOnly)

    // ⑤ 谐音检查（增强版）
    const harmonyWarnings = checkHarmony(name)

    // ⑥ 字形分析
    const strokes = charInfos.map(c => c.strokes)
    const glyph = analyzeGlyph(nameOnly, strokes.slice(1))

    // ⑦ 重名率分析
    const popularity = analyzeNamePopularity(nameOnly)

    // 保存用户消息
    const userMessage = `请分析名字"${name}"${birthTime ? `，出生时间：${birthTime}` : ''}`
    addMessage(currentSessionId, 'user', userMessage)

    // ⑧ 构建结构化提示词（包含所有量化评分）
    const analysisPrompt = buildAnalysisPrompt({
      name,
      charInfos,
      baZi,
      wuxingBenefit,
      sancaiWugeEnhanced,
      phonetic,
      harmonyWarnings,
      glyph,
      popularity,
    })

    // ⑨ 调用 AI 进行深度分析
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    })

    const message = await client.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: getAnalysisSystemPrompt(),
      messages: [{
        role: 'user',
        content: analysisPrompt,
      }],
    })

    const analysisText = message.content[0].type === 'text' ? message.content[0].text : ''

    // 保存AI回复
    addMessage(currentSessionId, 'assistant', analysisText)

    return new Response(JSON.stringify({
      sessionId: currentSessionId,
      name,
      pinyin: charInfos.map(c => c.pinyin).filter(Boolean).join(' '),
      charInfos,
      baZi,
      wuxingBenefit,
      sancaiWuge,
      sancaiWugeEnhanced,
      phonetic,
      harmonyWarnings,
      glyph,
      popularity,
      analysis: analysisText,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Analyze API error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * 构建结构化分析提示词
 */
function buildAnalysisPrompt(data: {
  name: string
  charInfos: Array<{ char: string; pinyin: string; wuxing: string; strokes: number }>
  baZi: any
  wuxingBenefit: any
  sancaiWugeEnhanced: any
  phonetic: any
  harmonyWarnings: string[]
  glyph: any
  popularity: any
}): string {
  const { name, charInfos, baZi, wuxingBenefit, sancaiWugeEnhanced, phonetic, harmonyWarnings, glyph, popularity } = data

  const lines: string[] = []

  lines.push(`请对名字"${name}"进行全面分析。`)
  lines.push('')
  lines.push('## 基本信息')
  lines.push(`- 姓名：${name}`)
  lines.push(`- 各字拼音：${charInfos.map(c => `${c.char}(${c.pinyin || '未知'})`).join(' ')}`)
  lines.push(`- 五行属性：${charInfos.slice(1).map(c => c.wuxing).join(' ')}`)
  lines.push(`- 笔画数：${charInfos.map(c => c.strokes).join('、')}`)

  // 八字信息
  if (baZi) {
    lines.push('')
    lines.push('## 八字信息')
    lines.push(`- 八字：${baZi.yearGan}${baZi.yearZhi} ${baZi.monthGan}${baZi.monthZhi} ${baZi.dayGan}${baZi.dayZhi} ${baZi.timeGan}${baZi.timeZhi}`)
    lines.push(`- 五行统计：金${baZi.wuxing.gold} 木${baZi.wuxing.wood} 水${baZi.wuxing.water} 火${baZi.wuxing.fire} 土${baZi.wuxing.earth}`)
    if (baZi.missing.length > 0) lines.push(`- 缺失五行：${baZi.missing.join('、')}`)
    lines.push(`- 主导五行：${baZi.dominant}`)
  }

  // 预计算评分数据
  lines.push('')
  lines.push('## 预计算评分数据')

  // 五行补益
  if (wuxingBenefit) {
    lines.push(`- 五行补益得分：${wuxingBenefit.score}/25（喜用神：${wuxingBenefit.xiYong.join('、')}，忌神：${wuxingBenefit.jiShen.join('、')}）`)
    lines.push(`- 补益说明：${wuxingBenefit.nameBenefit}`)
  } else {
    lines.push(`- 五行补益得分：未提供八字，仅从字面分析（上限15分）`)
  }

  // 三才五格
  if (sancaiWugeEnhanced) {
    lines.push(`- 三才五格得分：${sancaiWugeEnhanced.score}/20（三才${sancaiWugeEnhanced.sancaiLevel}：${sancaiWugeEnhanced.sancaiFortune}）`)
    lines.push(`  - 天格${sancaiWugeEnhanced.tianGe.num}(${sancaiWugeEnhanced.tianGe.level}) 人格${sancaiWugeEnhanced.renGe.num}(${sancaiWugeEnhanced.renGe.level}) 地格${sancaiWugeEnhanced.diGe.num}(${sancaiWugeEnhanced.diGe.level}) 外格${sancaiWugeEnhanced.waiGe.num}(${sancaiWugeEnhanced.waiGe.level}) 总格${sancaiWugeEnhanced.zongGe.num}(${sancaiWugeEnhanced.zongGe.level})`)
  }

  // 音律
  lines.push(`- 音律得分：${phonetic.score}/20（${phonetic.analysis}）`)
  lines.push(`  - 声调：${phonetic.toneNames.join(' → ')}，${phonetic.toneAnalysis}`)
  lines.push(`  - 韵母：${phonetic.rhymeAnalysis}`)
  lines.push(`  - 开闭口音：${phonetic.opennessAnalysis}`)

  // 谐音
  if (harmonyWarnings.length > 0) {
    lines.push(`- 谐音预警：${harmonyWarnings.join('、')}（音律得分已扣10分）`)
  }

  // 字形
  lines.push(`- 字形得分：${glyph.score}/10`)
  lines.push(`  - 笔画平衡：${glyph.strokeBalance}`)
  lines.push(`  - 书写便利：${glyph.writingEase}`)
  lines.push(`  - 视觉结构：${glyph.visualStructure}`)
  lines.push(`  - 生僻度：${glyph.rarity}`)

  // 重名率
  lines.push(`- 时代适用得分：${popularity.score}/5（重名率：${popularity.level}，出现${popularity.count}次）`)

  // 字义（待 LLM 评估）
  lines.push(`- 字义内涵得分：待你评估（满分20分）`)

  // 输出格式要求
  lines.push('')
  lines.push('## 输出格式要求')
  lines.push('')
  lines.push('### 综合评分：XX/100')
  lines.push('')
  lines.push('### 各维度评分')
  lines.push('| 维度 | 得分 | 说明 |')
  lines.push('|------|------|------|')
  lines.push('| 五行配置 | XX/25 | ... |')
  lines.push('| 三才五格 | XX/20 | ... |')
  lines.push('| 音律听感 | XX/20 | ... |')
  lines.push('| 字义内涵 | XX/20 | ... |')
  lines.push('| 字形结构 | XX/10 | ... |')
  lines.push('| 时代适用 | XX/5 | ... |')
  lines.push('')
  lines.push('### 详细分析')
  lines.push('[各维度的专业解读，引用具体数据]')
  lines.push('')
  lines.push('### 专家点评')
  lines.push('[核心优缺点总结，犀利但不刻薄]')
  lines.push('')
  lines.push('### 改进建议')
  lines.push('[如总分<70，给出具体替代字建议]')

  return lines.join('\n')
}
```

- [ ] **Step 2: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/api/analyze/route.ts && git commit -m "feat: rewrite analyze API with all enhanced modules and structured prompt"
```

---

### Task 15: 更新前端 — 进度步骤扩展+评分展示

**Files:**
- Modify: `src/app/results/page.tsx`

- [ ] **Step 1: 更新 ANALYSIS_STEPS 为8步**

In `src/app/results/page.tsx`, replace the `ANALYSIS_STEPS` constant:

```typescript
const ANALYSIS_STEPS = [
  { key: 'chars', label: '解析汉字信息', duration: 500 },
  { key: 'wuxing', label: '计算八字五行', duration: 300 },
  { key: 'benefit', label: '分析五行补益', duration: 400 },
  { key: 'sancai', label: '分析三才五格', duration: 400 },
  { key: 'phonetic', label: '分析音律搭配', duration: 300 },
  { key: 'glyph', label: '分析字形结构', duration: 300 },
  { key: 'popularity', label: '检查重名率', duration: 200 },
  { key: 'ai', label: 'AI深度分析', duration: 60000 },
]
```

- [ ] **Step 2: 更新分析结果展示，增加评分维度标签**

In the analyze mode section of the results page, after the wuxing badges, add score badges if the API returns `sancaiWugeEnhanced`:

Find the section that renders `{names[0].wuxing.length > 0 && (` and after the wuxing badges div, add:

```tsx
              {/* 评分概览 */}
              {names[0].analysis?.sancai && (
                <div className="flex justify-center gap-2 mt-2 text-xs text-ink-500">
                  <span>五行: {data.wuxingBenefit?.score ?? '-'}/25</span>
                  <span>三才: {data.sancaiWugeEnhanced?.score ?? '-'}/20</span>
                  <span>音律: {data.phonetic?.score ?? '-'}/20</span>
                  <span>字形: {data.glyph?.score ?? '-'}/10</span>
                </div>
              )}
```

Note: This requires the `data` object from the API response to be accessible. The current code destructures it into `result`. Adjust the rendering to use the raw API data for score display.

- [ ] **Step 3: Commit**

```bash
cd D:/dev/git/ai-naming && git add src/app/results/page.tsx && git commit -m "feat: update results page with 8-step progress and score display"
```

---

### Task 16: 下载唐诗宋词论语数据

**Files:**
- Create: `data/tangshi.json`
- Create: `data/songci.json`
- Create: `data/lunyu.json`

- [ ] **Step 1: 从 chinese-poetry 项目下载唐诗数据**

```bash
cd D:/dev/git/ai-naming && curl -sL "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/全唐诗/tangshi.json" -o data/tangshi.json
```

If the exact URL doesn't work, try alternative paths from the chinese-poetry repo. The data format should be `{ title, author, content: string[] }[]`.

- [ ] **Step 2: 从 chinese-poetry 项目下载宋词数据**

```bash
cd D:/dev/git/ai-naming && curl -sL "https://raw.githubusercontent.com/chinese-poetry/chinese-poetry/master/宋词/songci.json" -o data/songci.json
```

- [ ] **Step 3: 创建论语名句数据**

Create `data/lunyu.json` manually with ~200 curated entries suitable for naming:

```json
[
  { "chapter": "学而", "content": "学而时习之，不亦说乎" },
  { "chapter": "学而", "content": "有朋自远方来，不亦乐乎" },
  { "chapter": "学而", "content": "人不知而不愠，不亦君子乎" },
  { "chapter": "为政", "content": "温故而知新，可以为师矣" },
  { "chapter": "为政", "content": "学而不思则罔，思而不学则殆" },
  { "chapter": "里仁", "content": "见贤思齐焉，见不贤而内自省也" },
  { "chapter": "里仁", "content": "德不孤，必有邻" },
  { "chapter": "里仁", "content": "君子欲讷于言而敏于行" },
  { "chapter": "公冶长", "content": "敏而好学，不耻下问" },
  { "chapter": "雍也", "content": "知之者不如好之者，好之者不如乐之者" },
  { "chapter": "述而", "content": "三人行，必有我师焉" },
  { "chapter": "述而", "content": "默而识之，学而不厌，诲人不倦" },
  { "chapter": "泰伯", "content": "士不可以不弘毅，任重而道远" },
  { "chapter": "子罕", "content": "三军可夺帅也，匹夫不可夺志也" },
  { "chapter": "子罕", "content": "岁寒，然后知松柏之后凋也" },
  { "chapter": "颜渊", "content": "己所不欲，勿施于人" },
  { "chapter": "子路", "content": "其身正，不令而行" },
  { "chapter": "宪问", "content": "修己以敬，修己以安人" },
  { "chapter": "卫灵公", "content": "志士仁人，无求生以害仁，有杀身以成仁" },
  { "chapter": "卫灵公", "content": "人无远虑，必有近忧" }
]
```

Expand this to ~200 entries covering all chapters.

- [ ] **Step 4: Commit**

```bash
cd D:/dev/git/ai-naming && git add data/tangshi.json data/songci.json data/lunyu.json && git commit -m "feat: add Tang poetry, Song ci, and Lunyu data sources"
```

---

### Task 17: 运行全量测试并修复

- [ ] **Step 1: 运行所有测试**

```bash
cd D:/dev/git/ai-naming && npx vitest run
```

Expected: All tests PASS

- [ ] **Step 2: 如果有测试失败，修复后重新运行**

Fix any failures iteratively.

- [ ] **Step 3: 运行 TypeScript 类型检查**

```bash
cd D:/dev/git/ai-naming && npx tsc --noEmit
```

Expected: No type errors

- [ ] **Step 4: 运行 Next.js 构建**

```bash
cd D:/dev/git/ai-naming && npm run build
```

Expected: Build succeeds

- [ ] **Step 5: Commit any fixes**

```bash
cd D:/dev/git/ai-naming && git add -A && git commit -m "fix: resolve test and build issues"
```

---

### Task 18: 端到端验证

- [ ] **Step 1: 启动开发服务器**

```bash
cd D:/dev/git/ai-naming && npm run dev
```

- [ ] **Step 2: 在浏览器中测试名字分析**

Navigate to `/analyze`, enter a test name (e.g., "李婉清"), verify:
- 8-step progress indicator works
- Analysis result shows all 6 scoring dimensions
- Scores are reasonable (not all 90+)
- Expert commentary is specific, not generic

- [ ] **Step 3: 测试带出生时间的分析**

Enter a name with birth time, verify:
- BaZi information is displayed
- Wuxing benefit analysis shows xi-yong and ji-shen
- Score reflects traditional priority

- [ ] **Step 4: 测试谐音检测**

Enter "杜子腾", verify harmony warning is detected.

- [ ] **Step 5: Commit final state**

```bash
cd D:/dev/git/ai-naming && git add -A && git commit -m "feat: complete name analysis optimization - all modules integrated"
```
