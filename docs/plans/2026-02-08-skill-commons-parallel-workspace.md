# CodeMoss Skill 化输入框与并行 Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不要求用户输入 `/xxx` 的前提下，实现 Skill/Commons 可视化选择、透明 Prompt 自动拼装、并行 Workspace 多 Skill 分析。

**Architecture:** 基于现有 `Composer -> useQueuedSend/useThreadMessaging -> tauri service` 发送链路，新增一层 `Prompt Assembly Layer` 与 `Parallel Workspace Orchestrator`。P0 先在单会话路径完成 Skill/Commons 装配，P1 在同一问题下 fan-out 成多个 Panel 独立执行，P2 增加对比与行动收敛。

**Tech Stack:** React 19 + TypeScript + Vite + Tauri v2 + 现有 hooks/reducer 状态管理 + Vitest。

---

## Progress Update (2026-02-08, PR Prep)

### 已完成（当前 MVP）

- Skill / Commons 管理面板已稳定可用：
  - `! / +S / +M` 固定入口
  - 选择弹窗支持搜索、前缀分组、两列展示、描述摘要
  - 选中项 chip 化展示，支持点击 `×` 取消
- 发送前拼装已简化为 slash 模式：
  - 规则：`/skill-name /commons-name 用户输入`
  - 实现：`src/features/composer/utils/promptAssembler.ts`
  - 接入：`Composer.handleSend/handleQueue`
- 输入框明文 `/xxx` 自动识别已生效：
  - 自动匹配并同步到 S/M 选中区
  - 支持多词别名与连字符/下划线变体
- 管理面板折叠/展开体验已完成：
  - 默认折叠
  - 折叠态保留单行摘要（Skill<=2、Commons<=2、Kanban<=2）
  - 展开态允许多排
- 看板联动与上下文模式已打通：
  - `K` 看板标识、`link` 跳转
  - `新会话 / 继承当前` 模式切换
  - 选中态绿色 icon 提示
- 新代码范围清洗已完成：
  - `Composer.tsx` 新增区域结构降噪（缩进、块边界）
  - 移除未使用的 `composer-parallel-*` 样式块

### 与原方案的取舍

- 已取消并行入口（`并行` 开关）和前台并行工作区 UI，避免与主交互冲突。
- 原文档中的并行 fan-out、模板预设、对比区等内容暂不纳入本次 MVP/PR。

### 本次 PR 范围外（后续可选）

- 多 Skill 并行执行、结果对比区、行动清单收敛。
- 拼装入口下沉到 `useThreadMessaging` 统一层（当前仍在 `Composer` 发送前组装）。

## 0. 现状锚点（基于当前代码）

- 输入与发送：`src/features/composer/components/Composer.tsx`、`src/features/composer/components/ComposerInput.tsx`
- 自动补全：`src/features/composer/hooks/useComposerAutocompleteState.ts`
  - 当前支持 `/`（command/prompt）、`$`（skills）、`@`（file）
- Prompt 预处理：`src/features/threads/hooks/useThreadMessaging.ts`
  - 当前只做 `expandCustomPromptText`（`src/utils/customPrompts.ts`）
- Skill 数据源：`src/features/skills/hooks/useSkills.ts`
  - 目前主要服务 `$skill` 自动补全

结论：现有链路有天然插入点，P0 不需要重写消息发送系统，只需在 `handleSend` 之前统一装配文本。

---

## 1. Prompt 约束与拼装算法

### 1.1 强约束顺序

最终 Prompt 严格为：

1. `[System]`
2. `[Skill Prompt]`（1 个或多个）
3. `[Commons Prompt...]`（0 个或多个）
4. `[Panel Extra Input]`（并行模式可选）
5. `[User Input]`（永远最后，且只出现一次）

### 1.2 单输入框模式（P0）

伪代码：

```text
assembleSinglePrompt(selection, userInput):
  assert trim(userInput) != "" or hasAttachments

  blocks = []
  blocks.push(systemBlock)

  for skill in selection.skills:
    blocks.push(skill.prompt)

  for common in selection.commons:
    blocks.push(common.prompt)

  blocks.push(userBlock(userInput))
  return joinWithSectionSeparator(blocks)
```

### 1.3 并行 Workspace 模式（P1）

伪代码：

```text
createWorkspaceRun(question, selectedSkills, inheritedCommons):
  workspaceId = genId()
  panels = selectedSkills.map(skill => ({ panelId: genId(), skillId: skill.id, status: "idle" }))
  return { workspaceId, question, inheritedCommons, panels }

assemblePanelPrompt(panel, workspace):
  blocks = [systemBlock, panel.skillPrompt, ...workspace.inheritedCommons]
  if panel.extraInput exists: blocks.push(panel.extraInput)
  blocks.push(userBlock(workspace.question))
  return join(blocks)
```

---

## 2. JSON Schema（Skill / Commons / Prompt Assembly）

### 2.1 `SkillDefinition` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://codemoss.dev/schema/skill-definition.json",
  "title": "SkillDefinition",
  "type": "object",
  "required": ["id", "name", "version", "prompt", "enabled"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9._-]+$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "icon": { "type": "string" },
    "version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    "description": { "type": "string", "maxLength": 300 },
    "prompt": { "type": "string", "minLength": 1 },
    "tags": { "type": "array", "items": { "type": "string" }, "default": [] },
    "enabled": { "type": "boolean", "default": true }
  },
  "additionalProperties": false
}
```

### 2.2 `CommonsDefinition` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://codemoss.dev/schema/commons-definition.json",
  "title": "CommonsDefinition",
  "type": "object",
  "required": ["id", "name", "prompt", "scope", "enabled"],
  "properties": {
    "id": { "type": "string", "pattern": "^[a-z0-9._-]+$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 80 },
    "description": { "type": "string", "maxLength": 300 },
    "prompt": { "type": "string", "minLength": 1 },
    "scope": {
      "type": "object",
      "required": ["level"],
      "properties": {
        "level": { "enum": ["global", "workspace", "thread"] },
        "workspaceId": { "type": "string" },
        "tags": { "type": "array", "items": { "type": "string" }, "default": [] }
      },
      "additionalProperties": false
    },
    "enabled": { "type": "boolean", "default": true }
  },
  "additionalProperties": false
}
```

### 2.3 `PromptAssemblyRequest` Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://codemoss.dev/schema/prompt-assembly-request.json",
  "title": "PromptAssemblyRequest",
  "type": "object",
  "required": ["userInput", "skillIds", "commonsIds", "mode"],
  "properties": {
    "mode": { "enum": ["single", "parallel-panel"] },
    "userInput": { "type": "string" },
    "skillIds": { "type": "array", "items": { "type": "string" } },
    "commonsIds": { "type": "array", "items": { "type": "string" } },
    "panelExtraInput": { "type": "string" },
    "workspaceId": { "type": "string" },
    "panelId": { "type": "string" }
  },
  "additionalProperties": false
}
```

---

## 3. 前端状态结构（TypeScript）

```ts
export type SkillDefinition = {
  id: string;
  name: string;
  icon?: string;
  version: string;
  description?: string;
  prompt: string;
  tags: string[];
  enabled: boolean;
};

export type CommonsDefinition = {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  scope: {
    level: "global" | "workspace" | "thread";
    workspaceId?: string;
    tags: string[];
  };
  enabled: boolean;
};

export type ComposerSelectionState = {
  selectedSkillIds: string[];
  selectedCommonsIds: string[];
  parallelEnabled: boolean;
};

export type ParallelPanelState = {
  panelId: string;
  skillId: string;
  extraInput: string;
  status: "idle" | "running" | "success" | "error";
  threadId: string | null;
  resultSummary?: string;
  errorMessage?: string;
};

export type ParallelWorkspaceState = {
  workspaceRunId: string;
  question: string;
  inheritedCommonsIds: string[];
  panels: ParallelPanelState[];
  createdAt: number;
  updatedAt: number;
};
```

---

## 4. 事件流设计

### 4.1 单输入（P0）

1. 用户输入自然语言。
2. 选择 Skill/Commons Chip。
3. 点击发送。
4. `promptAssembler` 生成最终文本。
5. 调用现有 `handleSend(finalPrompt, images)`。
6. 消息进入现有线程事件系统。

### 4.2 并行 Workspace（P1）

1. 打开 `🧩 并行`。
2. 输入 Workspace Question。
3. 选多个 Skill。
4. 生成 N 个 Panel（每 Skill 一个）。
5. 每 Panel 装配 Prompt 并并发执行。
6. 输出区横向渲染 Panel 结果。

---

## 5. 文件级改造清单（到函数级）

### Task 1: 类型与注册表基础（P0）

**Files:**
- Create: `src/features/skills/types.ts`
- Create: `src/features/skills/registry/defaultSkills.ts`
- Create: `src/features/commons/types.ts`
- Create: `src/features/commons/registry/defaultCommons.ts`
- Modify: `src/types.ts`

**Step 1: Write failing tests**
- Create: `src/features/skills/registry/defaultSkills.test.ts`
- Create: `src/features/commons/registry/defaultCommons.test.ts`
- 验证字段完整、ID 唯一、prompt 非空。

**Step 2: Implement minimal structures**
- 新增类型定义与默认数据。

**Step 3: Run tests**
- Run: `npm run test -- defaultSkills defaultCommons`

**Step 4: Commit**
- `git commit -m "feat: add skill and commons schema-aligned registries"`

### Task 2: Prompt Assembler（P0 核心）

**Files:**
- Create: `src/features/composer/utils/promptAssembler.ts`
- Create: `src/features/composer/utils/promptAssembler.test.ts`
- Modify: `src/features/threads/hooks/useThreadMessaging.ts`

**Step 1: Write failing tests**
- 覆盖顺序约束、空输入保护、重复 commons 去重、用户输入只出现一次。

**Step 2: Implement minimal assembler**
- 暴露 `assembleSinglePrompt`、`assemblePanelPrompt`。

**Step 3: Integrate send path**
- 在发送前调用装配器，替换 `expandCustomPromptText` 的主入口。
- 保留 `/command` 兼容作为 fallback（迁移期）。

**Step 4: Run tests**
- Run: `npm run test -- promptAssembler useThreadMessaging`

**Step 5: Commit**
- `git commit -m "feat: add deterministic prompt assembler for skill/commons"`

### Task 3: Composer Chip UI（P0）

**Files:**
- Modify: `src/features/composer/components/ComposerInput.tsx`
- Modify: `src/features/composer/components/Composer.tsx`
- Create: `src/features/composer/components/SkillCommonsPicker.tsx`
- Create: `src/features/composer/components/SelectionChips.tsx`
- Modify: `src/styles/composer.css`
- Create: `src/features/composer/components/SelectionChips.test.tsx`

**Step 1: Write failing tests**
- Chip 增删、重复选择拦截、禁用状态。

**Step 2: Implement UI**
- 左侧增加 `+ Skill` / `+ Commons`。
- 已选项以 Chip 展示，可删除。

**Step 3: Integrate state**
- 在 `Composer` 保存 `ComposerSelectionState`。

**Step 4: Run tests**
- Run: `npm run test -- SelectionChips ComposerInput`

**Step 5: Commit**
- `git commit -m "feat: add chip-based skill and commons selection in composer"`

### Task 4: 并行 Workspace Orchestrator（P1）

**Files:**
- Create: `src/features/parallel/types.ts`
- Create: `src/features/parallel/hooks/useParallelWorkspace.ts`
- Create: `src/features/parallel/components/ParallelWorkspacePanels.tsx`
- Create: `src/features/parallel/components/ParallelPanelCard.tsx`
- Modify: `src/features/composer/components/ComposerInput.tsx`
- Modify: `src/features/app/components/AppLayout.tsx`
- Modify: `src/App.tsx`
- Create: `src/features/parallel/hooks/useParallelWorkspace.test.ts`

**Step 1: Write failing tests**
- 多 panel 并发状态流转。
- 单 panel 失败不影响其他 panel。

**Step 2: Implement orchestrator**
- 提供 `createWorkspaceRun`, `runPanel`, `runAllPanels`。
- 通过 `Promise.allSettled` 收敛。

**Step 3: Render panel output**
- 输出区改为横向 panel。

**Step 4: Run tests**
- Run: `npm run test -- useParallelWorkspace`

**Step 5: Commit**
- `git commit -m "feat: support parallel workspace multi-skill execution"`

### Task 5: 结果对比与行动收敛（P2）

**Files:**
- Create: `src/features/parallel/utils/consensus.ts`
- Create: `src/features/parallel/components/ConsensusSummary.tsx`
- Create: `src/features/parallel/utils/consensus.test.ts`

**Step 1: Write failing tests**
- 提取交集结论、冲突项识别、行动项汇总。

**Step 2: Implement minimal compare**
- 先基于规则提取，不引入额外模型调用。

**Step 3: Run tests**
- Run: `npm run test -- consensus`

**Step 4: Commit**
- `git commit -m "feat: add parallel result consensus summary"`

---

## 6. API 与函数签名建议

```ts
export type PromptAssemblyContext = {
  systemPrompt: string;
  skillPrompts: string[];
  commonsPrompts: string[];
  panelExtraInput?: string;
  userInput: string;
};

export function assembleSinglePrompt(ctx: PromptAssemblyContext): string;

export function assemblePanelPrompt(ctx: PromptAssemblyContext): string;
```

```ts
export type RunPanelInput = {
  workspaceId: string;
  sourceThreadId: string | null;
  panel: ParallelPanelState;
  question: string;
  inheritedCommonsIds: string[];
};

export type RunPanelResult = {
  panelId: string;
  success: boolean;
  threadId: string | null;
  error?: string;
};
```

---

## 7. 验收标准（DoD）

1. 用户可仅输入自然语言并完成技能增强调用，无需 `/xxx`。
2. Prompt 装配顺序稳定且可测试。
3. 单输入模式支持 1..N Skills + 0..N Commons。
4. 并行模式下同一问题可多 Skill 同时分析，结果隔离。
5. Prompt 对用户默认不可见（仅 debug 开关可查看）。

---

## 8. 风险与回滚

- 风险：Prompt 长度膨胀、并发 UI 复杂、上下文混乱。
- 缓解：
  - 限制并行 panel 数（默认 4，上限 8）。
  - 提示 token 预算与超长截断。
  - 每 panel 独立 threadId，禁止跨 panel 混写。
- 回滚：
  - Feature flags：`skillComposer.enabled`、`parallelWorkspace.enabled`
  - 可一键退回当前单输入发送逻辑。

---

## 9. 执行顺序建议

1. Week 1: P0（类型、装配器、Chip UI）
2. Week 2: P1（并行编排、横向输出）
3. Week 3: P2（结果对比、行动收敛）

---

Plan complete and saved to `docs/plans/2026-02-08-skill-commons-parallel-workspace.md`.
Two execution options:

1. Subagent-Driven (this session): 我按任务逐个实现并在每个任务后汇报测试结果。
2. Parallel Session (separate): 你开新会话按该计划批量执行。
