# 混合流水线取名优化设计

## Context

当前取名流程是纯LLM对话：用户填表单→Chat页→`/api/chat`→LLM自由生成文本。存在以下问题：

1. **无量化约束**：LLM自由生成，不受五行喜用神、三才五格等结构化规则约束
2. **RAG未接入**：`ClassicRetriever`已实现但未在取名流程中使用，诗词典故全靠LLM记忆
3. **无评分验证**：生成名未经过六维评分（五行25+三才20+音律20+字义20+字形10+时代5），质量无保障
4. **结果展示粗糙**：Chat页只显示LLM文本，无评分卡片、无对比能力
5. **Results页mock数据**：naming模式显示硬编码的李婉清/李思齐/李沐阳

调研报告（`docs/knowledge/ai取名智能体调研报告.md`）提出"LLM+知识库+工具链"三层架构，本设计实现其核心：**混合流水线（方案C）**。

## Architecture

四阶段流水线：**命理筛选 → RAG检索 → LLM约束生成 → 评分验证**

- 前三步为LLM提供结构化约束（候选字池+文化典故），LLM在约束内组合名字
- 第四步对生成名跑六维评分，过滤低分名，确保输出质量
- 交互模式：对话式+量化约束 — 首次生成走流水线，后续对话可微调

## Data Flow

```
/form 提交 → sessionStorage 存 formData
  → /chat 页读取 formData
  → POST /api/naming { surname, gender, birthTime, expectations, namingMode, avoidChars, ... }
  → SSE events:
      step=filtering  (命理筛选候选字)
      step=rag        (RAG检索诗词典故)
      step=generating (LLM约束生成名字)
      step=scoring    (六维评分验证)
      type=complete   (最终结果)
  → 渲染评分卡片
  → 用户对话微调 → POST /api/chat (带候选字池上下文)
```

## API Design

### `POST /api/naming` — 四阶段流水线

**Request:**
```typescript
interface NamingRequest {
  surname: string
  gender: '男' | '女' | '未定'
  birthTime?: string        // ISO datetime string
  expectations?: string     // 期望寓意
  avoidChars?: string       // 避免用字
  namingMode: '传统' | '文学' | '现代' | '混合'
  nameLength?: 1 | 2 | '不限'
  motherSurname?: string
}
```

**SSE Events:**
```typescript
// 阶段进度事件
interface NamingStepEvent {
  step: 'filtering' | 'rag' | 'generating' | 'scoring'
  status: 'running' | 'done'
  duration?: number
  summary?: string
  detail?: Record<string, unknown>
  chunk?: string  // LLM流式文本（generating阶段）
}

// 完成事件
interface NamingCompleteEvent {
  type: 'complete'
  data: {
    names: ScoredName[]
    candidateChars?: CandidateCharPool  // 用于后续对话上下文
    ragResults?: ClassicSearchResult[]  // 用于后续对话上下文
  }
}

// 评分后的名字
interface ScoredName {
  name: string           // 全名，如"李婉清"
  surname: string
  givenName: string      // 名，如"婉清"
  pinyin: string
  scores: {
    wuxingBenefit: number  // /25
    sancaiWuge: number     // /20
    phonetic: number       // /20
    meaning: number        // /20 (AI评估)
    glyph: number          // /10
    popularity: number     // /5
  }
  totalScore: number      // /100
  wuxingTags: string[]    // ['木', '土', '水']
  strokes: number[]
  classicSource?: string  // 诗词出处
  meaningText?: string    // 寓意说明
  harmonyWarnings?: string[]
  nameId?: number         // saveName后的ID
}
```

### Pipeline Stages Detail

**Stage 1: filtering (命理筛选)**

- 若提供birthTime：调用 `calculateBaZi()` + `analyzeWuxingBenefit()` 计算喜用神
- 从 `char_info.json` 筛选五行属性匹配喜用神的字，构建候选字池
- 若无birthTime：跳过五行筛选，候选字池为全部常用字
- 排除avoidChars中的字
- 排除 `getDislikedChars()` 中的字
- 输出：`CandidateCharPool { primary: string[], secondary: string[], xiYong: string[], jiShen: string[] }`

**Stage 2: rag (RAG检索)**

- 用 `ClassicRetriever.hybridSearch()` 检索诗词典故
- 查询词：喜用神五行 + expectations + namingMode对应风格
- 文学模式：侧重诗经/楚辞
- 传统模式：侧重论语/周易
- 现代模式：减少古典比重
- 输出：`ClassicSearchResult[]`（top 10-15条）

**Stage 3: generating (LLM约束生成)**

- 构建增强system prompt，注入：
  - 候选字池（"请从以下字中选择：婉、清、沐、阳..."）
  - RAG检索结果（"可参考的诗句：..."）
  - 喜用神/忌神信息
  - 评分标准说明（让LLM也考虑音律、字形）
- LLM流式生成，SSE推送chunk
- 解析LLM输出中的 `【名字】` 格式，提取候选名
- 输出：`string[]`（候选名列表）

**Stage 4: scoring (评分验证)**

- 对每个候选名，复用analyze流程的评分逻辑：
  - `getCharacterInfo()` → 字符信息
  - `analyzeSanCaiWuGeEnhanced()` → 三才五格 /20
  - `analyzePhonetic()` → 音律 /20
  - `analyzeGlyph()` → 字形 /10
  - `analyzeNamePopularity()` → 时代 /5
  - `analyzeWuxingBenefit()` → 五行补益 /25（若有八字）
  - meaning score → 由LLM在Stage 3中给出，或默认15/20
- 计算totalScore，过滤 totalScore < 60 的名字
- 调用 `saveName()` 保存到记忆
- 输出：`ScoredName[]`

## Frontend Changes

### `src/app/chat/page.tsx` — 改造

**首次消息逻辑变更：**
- 读取 sessionStorage 中的 formData
- 若有 formData（从/form跳转来），POST `/api/naming` 而非 `/api/chat`
- 消费SSE，渲染阶段进度 + 评分卡片
- 首次生成完成后，将候选字池+RAG结果存入state，供后续对话使用

**后续对话：**
- 仍走 `/api/chat`，但在messages中注入上下文：
  - "之前为你推荐了以下名字：[名字列表]，候选字池：[字池]，请在此基础上微调"

**UI变更：**
- 新增：阶段进度条（filtering→rag→generating→scoring）
- 新增：评分卡片区域（替代纯文本显示）
- 保留：底部对话输入框

### `src/components/NameScoreCard.tsx` — 新建

评分卡片组件，每个候选名一张卡片：

```
┌─────────────────────────────────┐
│  李婉清  Lǐ Wǎn Qīng           │
│  ─────────────────────────────  │
│  五行 [木] [土] [水]  笔画 7-11-11 │
│                                 │
│  五行补益 ████████░░ 20/25     │
│  三才五格 ██████░░░░ 14/20     │
│  音律听感 █████████░ 17/20     │
│  字义内涵 ████████░░ 16/20     │
│  字形结构 ████████░░  8/10     │
│  时代适用 █████░░░░░  3/5      │
│  ─────────────────────────────  │
│  总分 78/100                    │
│                                 │
│  出处：《诗经·郑风》"清扬婉兮"  │
│  寓意：温婉美好，清雅脱俗       │
│                                 │
│  [喜欢] [一般] [不喜欢]         │
└─────────────────────────────────┘
```

- 评分条用颜色区分：>=80绿色，60-79黄色，<60红色
- 出处和寓意可折叠
- 偏好按钮调用 `PATCH /api/names/:id`

### `src/app/results/page.tsx` — 改造

- naming模式：从URL参数或sessionStorage读取流水线结果，替代mockData
- 复用 `NameScoreCard` 组件
- 保留卡片/详细/对比三种视图模式

## System Prompt Enhancement

`getSystemPrompt()` 新增参数：

```typescript
export function getSystemPrompt(options: {
  dislikedChars?: string[]
  dislikedNames?: string[]
  candidateChars?: string[]      // 候选字池
  ragContext?: string            // RAG检索的诗词典故
  xiYong?: string[]             // 喜用神
  jiShen?: string[]             // 忌神
  namingMode?: string           // 取名模式
}): string
```

当有candidateChars时，prompt增加：
> "请从以下候选字中组合名字：[字池]。这些字已根据五行喜用神筛选，优先使用primary池中的字。"

当有ragContext时，prompt增加：
> "可参考以下诗词典故取名：\n[典故内容]"

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/naming/route.ts` | Create | 四阶段流水线API |
| `src/components/NameScoreCard.tsx` | Create | 评分卡片组件 |
| `src/app/chat/page.tsx` | Modify | 首次消息走流水线，渲染评分卡片 |
| `src/app/results/page.tsx` | Modify | naming模式用真实数据 |
| `src/lib/llm.ts` | Modify | getSystemPrompt接受候选字池+RAG上下文 |

## Files NOT Modified

- `src/app/api/analyze/route.ts` — 分析流程独立
- `src/app/api/chat/route.ts` — 保留用于后续对话微调
- `src/lib/rag/*` — 直接复用，不重构
- `src/lib/wuxing.ts`, `sancai-wuge.ts`, `phonetic.ts`, `glyph.ts`, `popularity.ts` — 直接复用

## Verification

1. 访问 `/form`，填写姓氏"李"、性别"女"、出生时间、期望寓意"文雅"
2. 提交后进入 `/chat`，观察四阶段进度：筛选→检索→生成→评分
3. 生成完成后，页面显示评分卡片（非纯文本）
4. 每张卡片有六维评分条、总分、诗词出处
5. 低分名（<60）被过滤，不显示
6. 名字自动保存到记忆（`/memory` 页可见）
7. 在对话框输入"换一个更文雅的"，系统在约束内重新生成
8. 标记"不喜欢"后，后续生成不再使用该字/名
