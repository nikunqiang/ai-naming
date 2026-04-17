# 分析过程展示 + 名字记忆功能 Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:brainstorming before implementation.

**Goal:** 在页面上实时展示名字分析的完整推导过程（含 LLM 交互），并实现名字记忆系统（记录、打标、过滤、去重）。

**Architecture:** 将 analyze API 改为 SSE 流式推送结构化步骤事件，前端用独立调试面板实时渲染。用 better-sqlite3 建立名字记忆数据库，支持自动记录、标签分类、偏好过滤。

**Tech Stack:** Next.js 14, TypeScript, SSE (Server-Sent Events), better-sqlite3, Tailwind CSS

---

## Feature 1: 分析过程调试面板

### 1.1 SSE 事件协议

将 `/api/analyze` 从普通 POST JSON 响应改为 SSE 流式响应。

事件格式：

```typescript
type StepEvent = {
  step: string          // "chars" | "wuxing" | "benefit" | "sancai" | "phonetic" | "harmony" | "glyph" | "popularity" | "prompt" | "ai"
  status: "running" | "done" | "error"
  duration?: number     // 毫秒
  summary?: string      // 步骤摘要，如 "李:木:7画, 婉:土:11画, 清:水:11画"
  detail?: object       // 完整推导数据，可展开查看
  prompt?: string       // 仅 prompt 步骤：发送给 LLM 的完整 prompt
  systemPrompt?: string // 仅 prompt 步骤：system prompt
  chunk?: string        // 仅 ai 步骤：LLM 流式输出片段
  result?: object       // 仅 ai 步骤 done 时：完整分析结果
}
```

SSE 格式：`data: ${JSON.stringify(StepEvent)}\n\n`

最终事件（所有步骤完成后）推送一条：
```typescript
type CompleteEvent = {
  type: "complete"
  data: object  // 完整的 API 响应数据（与当前 JSON 响应格式一致）
}
```

### 1.2 后端改造

`src/app/api/analyze/route.ts` 改为 SSE 响应：

1. 设置响应头 `Content-Type: text/event-stream`
2. 每个步骤执行前推送 `{step, status: "running"}`
3. 执行计算，记录耗时
4. 推送 `{step, status: "done", summary, detail, duration}`
5. AI 步骤：
   - 推送 `{step: "prompt", status: "done", prompt, systemPrompt}` 展示完整 prompt
   - 使用 `client.messages.stream()` 替代 `client.messages.create()`
   - 每个流式 chunk 推送 `{step: "ai", status: "running", chunk}`
   - 流式结束后推送 `{step: "ai", status: "done", result, duration}`
6. 最终推送 `{type: "complete", data: fullResult}`

每个步骤的 detail 数据结构：

| step | detail 内容 |
|------|------------|
| chars | 每个字的 char, pinyin, wuxing, strokes，数据来源 `char_info.json` |
| wuxing | 八字四柱、五行统计、缺失五行、主导五行，计算来源 `lunar-javascript` |
| benefit | 日主、身强/身弱判断过程、帮身力/克身力、喜用神推导、忌神推导、名字五行与喜用神匹配 |
| sancai | 天格/人格/地格/外格/总格的笔画计算过程、每格数理吉凶查表结果、三才配置、综合评分 |
| phonetic | 每字拼音、声调、韵母、开闭口音，声调搭配分析，韵母分析，开闭口音分析 |
| harmony | 谐音检查过程：匹配的规则、近音映射 |
| glyph | 笔画标准差计算、书写便利判断、结构类型查表、生僻度检查 |
| popularity | 重名次数、百分位排名、等级判定 |
| prompt | 完整的 user prompt 和 system prompt |
| ai | LLM 流式输出 |

### 1.3 前端调试面板

**位置**：结果页右侧可折叠侧边栏

**触发**：页面右上角"调试"按钮，点击展开/折叠

**布局**：
- 深色背景（`bg-gray-900`），等宽字体
- 步骤列表：每步一行，显示 图标(✓/⏳/✗) + 步骤名 + 耗时
- 点击步骤展开 detail 区域：
  - 本地计算步骤：格式化显示推导过程（关键变量、判断逻辑、查表结果）
  - prompt 步骤：显示 system prompt（折叠）+ user prompt（完整）
  - ai 步骤：流式显示 LLM 回复
- 底部：总耗时统计

**SSE 消费**：
- 使用 `EventSource` 或 `fetch` + `ReadableStream` 消费 SSE
- 每收到事件更新对应步骤的状态和内容
- 收到 `complete` 事件后，用完整数据渲染主结果区域

---

## Feature 2: 名字记忆系统

### 2.1 数据库设计

使用 better-sqlite3，数据文件 `data/naming.db`，启动时自动建表。

```sql
CREATE TABLE names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  surname TEXT NOT NULL,
  given_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'analyze',  -- 'analyze' | 'generate' | 'manual'
  session_id TEXT,
  preference TEXT NOT NULL DEFAULT 'neutral',  -- 'liked' | 'neutral' | 'disliked'
  score INTEGER,
  scores_json TEXT,        -- {"wuxingBenefit":13,"sancaiWuge":14,...}
  analysis_summary TEXT,   -- AI 分析前100字摘要
  birth_time TEXT,         -- 分析时用的出生时间
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,  -- 'preference' | 'style' | 'wuxing' | 'custom'
  is_preset INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE name_tags (
  name_id INTEGER NOT NULL REFERENCES names(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (name_id, tag_id)
);

CREATE INDEX idx_names_preference ON names(preference);
CREATE INDEX idx_names_source ON names(source);
CREATE INDEX idx_names_created ON names(created_at);
CREATE INDEX idx_name_tags_name ON name_tags(name_id);
CREATE INDEX idx_name_tags_tag ON name_tags(tag_id);
```

### 2.2 预设标签

启动时自动插入（如果不存在）：

| category | tags |
|----------|------|
| preference | 喜欢、一般、不喜欢 |
| style | 传统、文学、现代、大气、婉约、阳刚 |
| wuxing | 金、木、水、火、土 |

### 2.3 数据访问层

`src/lib/db.ts`：封装 better-sqlite3 操作

核心方法：
- `initDB()` — 建表 + 插入预设标签
- `saveName(name, surname, givenName, source, sessionId, score, scoresJson, analysisSummary, birthTime?)` — 保存或更新名字
- `updatePreference(nameId, preference)` — 更新偏好
- `addTag(nameId, tagName)` / `removeTag(nameId, tagName)` — 添加/移除标签
- `getName(name)` — 查询单个名字
- `listNames(filters)` — 按偏好/标签/评分/时间筛选
- `getDislikedNames()` — 获取所有不喜欢的名字（用于排除）
- `getDislikedChars()` — 获取不喜欢名字中的所有字（用于取名排除）
- `deleteName(nameId)` — 删除名字
- `getAllTags()` — 获取所有标签
- `getStats()` — 统计信息（总数、喜欢数、不喜欢数等）

### 2.4 API 路由

| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/names` | GET | 列出名字（支持筛选参数） |
| `/api/names` | POST | 保存名字 |
| `/api/names/[id]` | PATCH | 更新偏好/标签 |
| `/api/names/[id]` | DELETE | 删除名字 |
| `/api/names/stats` | GET | 统计信息 |
| `/api/tags` | GET | 列出所有标签 |
| `/api/tags` | POST | 创建自定义标签 |

### 2.5 自动记录

- **analyze API**：分析完成后自动调用 `saveName()`
- **generate 流程**：取名结果出来后自动调用 `saveName()`
- 重复名字：ON CONFLICT 更新 score/scores_json/analysis_summary/updated_at

### 2.6 偏好过滤

取名时：
1. 调用 `getDislikedChars()` 获取不喜欢名字中的所有字
2. 将这些字注入到 LLM prompt 的排除列表中
3. 同时排除 `preference='disliked'` 的完整名字

---

## Feature 3: 前端交互

### 3.1 调试面板

- 结果页右上角"调试"按钮（图标：代码/终端图标）
- 点击展开右侧面板（宽度约 40%），再次点击折叠
- 面板内步骤树实时更新
- 分析完成后面板保持展开，用户可查看任意步骤详情

### 3.2 名字记忆页 `/memory`

- **入口**：首页添加"名字记忆"卡片
- **布局**：
  - 顶部统计栏：总数、喜欢、一般、不喜欢
  - 筛选栏：偏好筛选（全部/喜欢/一般/不喜欢）、标签筛选、搜索框
  - 名字卡片网格：
    - 每个卡片显示：名字、拼音、评分、偏好图标、标签
    - 点击名字 → 跳转到 `/results?name=xxx&mode=analyze` 复用分析功能
    - 卡片操作：修改偏好（喜欢/一般/不喜欢）、添加标签、删除
  - 空状态提示

### 3.3 结果页增强

- 分析完成后显示"已保存到记忆"提示
- 偏好快捷按钮：喜欢 ❤️ / 一般 / 不喜欢 👎
- 标签添加入口
- 名字可点击重新分析

### 3.4 取名排除

- 取名 prompt 中注入排除列表：
  ```
  注意：以下字已被用户标记为不喜欢，请不要在推荐名字中使用：[字1, 字2, ...]
  以下完整名字已被标记为不喜欢，请不要推荐：[名字1, 名字2, ...]
  ```
