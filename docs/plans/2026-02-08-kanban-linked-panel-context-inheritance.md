# Kanban Linked Panel Context Inheritance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让“关联项目看板”发送支持可选“新会话”或“继承当前会话上下文”，并保持默认行为不破坏现有流程。

**Architecture:** 在 Composer 层新增“上下文策略”UI 和状态（`new` / `inherit`），通过 `App.tsx` 的 `handleComposerSendWithKanban` 执行分支。`inherit` 优先走 Codex `fork`（硬继承），不满足条件时自动降级到 `new` 并给出可追踪日志。

**Tech Stack:** React 19 + TypeScript + Vitest + i18next + Tauri RPC (`start_thread` / `fork_thread`).

---

## Progress Update (2026-02-08, PR Prep)

### 已完成

- 参数透传已完成：
  - `Composer` 支持 `kanbanContextMode` / `onKanbanContextModeChange`
  - `useLayoutNodes` / `App` 透传链路已打通
- UI 交互已完成并稳定：
  - 选中看板后显示 `新会话 / 继承当前`
  - 折叠态与展开态均可切换
  - 当前生效项显示绿色勾选 icon
- 发送链路已完成：
  - `inherit` 满足条件时优先 `fork`
  - 不满足条件自动 fallback 到 `new`
  - 默认行为保持不破坏

### 待补（PR 后续）

- 按计划文档补齐 Task 4/Task 5 的失败路径与回归测试矩阵。
- 补充一轮手工验收记录（A/B/C 场景）到变更说明。

### PR 说明建议

- 本次以“交互可用 + 行为安全回退”为主，测试完善作为后续补丁迭代。

### Task 1: 定义策略模型与跨层参数透传

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/layout/hooks/useLayoutNodes.tsx`
- Modify: `src/features/composer/components/Composer.tsx`

**Step 1: 写失败测试（参数透传）**

在 `src/features/layout/hooks/useLayoutNodes.test.tsx`（若不存在则新建）新增用例：
- 传入 `composerKanbanContextMode="inherit"` 时，渲染 `Composer` 收到相同 prop。
- 切换回调 `onComposerKanbanContextModeChange` 被触发。

**Step 2: 运行测试确认失败**

Run: `npm run test -- src/features/layout/hooks/useLayoutNodes.test.tsx`
Expected: FAIL，提示缺少 `composerKanbanContextMode` 相关 props。

**Step 3: 最小实现**

- 在 `App.tsx` 新增状态：`composerKanbanContextMode`（默认 `"new"`）。
- 在 `useLayoutNodes` 的 `LayoutNodesOptions` 与 `<Composer />` 传参链中新增：
  - `composerKanbanContextMode: "new" | "inherit"`
  - `onComposerKanbanContextModeChange: (mode) => void`
- 在 `Composer.tsx` props 中接收并使用该字段（先透传，不做 UI 逻辑）。

**Step 4: 运行测试确认通过**

Run: `npm run test -- src/features/layout/hooks/useLayoutNodes.test.tsx`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/App.tsx src/features/layout/hooks/useLayoutNodes.tsx src/features/composer/components/Composer.tsx src/features/layout/hooks/useLayoutNodes.test.tsx
git commit -m "feat: plumb kanban composer context mode through layout"
```

### Task 2: Composer 增加“新会话/继承上下文”交互

**Files:**
- Modify: `src/features/composer/components/Composer.tsx`
- Modify: `src/styles/composer.css`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`
- Test: `src/features/composer/components/ComposerEditorHelpers.test.tsx`

**Step 1: 写失败测试（UI + 交互）**

在 `ComposerEditorHelpers.test.tsx` 新增用例：
- 选中 `linked panel` 时显示策略控件（`new` / `inherit`）。
- 点击 `inherit` 调用 `onKanbanContextModeChange("inherit")`。
- 未选中 panel 时策略控件隐藏。

**Step 2: 运行测试确认失败**

Run: `npm run test -- src/features/composer/components/ComposerEditorHelpers.test.tsx`
Expected: FAIL，找不到策略控件或回调未触发。

**Step 3: 最小实现**

- 在 `Composer.tsx` 的 `composer-kanban-toolbar` 区域新增策略切换控件（仅在有选中 panel 时展示）。
- 新增 i18n key：
  - `kanban.composer.contextModeLabel`
  - `kanban.composer.contextModeNew`
  - `kanban.composer.contextModeInherit`
  - `kanban.composer.contextModeFallbackHint`（可选）
- 在 `composer.css` 添加对应样式，保持与现有 toolbar 视觉一致。

**Step 4: 运行测试确认通过**

Run: `npm run test -- src/features/composer/components/ComposerEditorHelpers.test.tsx`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/composer/components/Composer.tsx src/styles/composer.css src/i18n/locales/zh.ts src/i18n/locales/en.ts src/features/composer/components/ComposerEditorHelpers.test.tsx
git commit -m "feat: add kanban linked-panel context mode switcher in composer"
```

### Task 3: 在看板关联发送链路实现硬继承（fork）

**Files:**
- Modify: `src/features/threads/hooks/useThreads.ts`
- Modify: `src/App.tsx`
- Test: `src/features/threads/hooks/useThreadActions.test.tsx`

**Step 1: 写失败测试（fork 能力可编排）**

新增用例覆盖：
- 当存在 `activeThreadId` 且策略为 `inherit` 时，调用 `forkThreadForWorkspace(activeWorkspaceId, activeThreadId)`。
- fork 成功返回 `forkedThreadId`，后续发送消息进入该 thread。

**Step 2: 运行测试确认失败**

Run: `npm run test -- src/features/threads/hooks/useThreadActions.test.tsx`
Expected: FAIL，`useThreads` 未暴露可直接调用的 fork API 或调用链缺失。

**Step 3: 最小实现**

- 在 `useThreads.ts` 暴露一个可直接调用的 `forkThreadForWorkspace`（或同义 API），供 `App.tsx` 非 slash-command 场景复用。
- 在 `App.tsx` `handleComposerSendWithKanban` 中调整策略：
  - `new`: 维持现状 `startThreadForWorkspace(..., { activate: false })`。
  - `inherit`: 满足条件则 `fork`：
    - 当前存在 `activeThreadId`
    - `activeEngine === "codex"`（fork 当前仅 Codex 支持）
    - 工作区一致（避免跨 workspace 错绑）
  - fork 不可用时自动降级 `new`，并输出 debug 事件。

**Step 4: 运行测试确认通过**

Run: `npm run test -- src/features/threads/hooks/useThreadActions.test.tsx`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/features/threads/hooks/useThreads.ts src/App.tsx src/features/threads/hooks/useThreadActions.test.tsx
git commit -m "feat: support fork-based context inheritance for linked kanban send"
```

### Task 4: 降级策略与回归保护

**Files:**
- Modify: `src/App.tsx`
- Test: `src/features/threads/hooks/useQueuedSend.test.tsx`
- Test: `src/features/threads/hooks/useThreads.integration.test.tsx`

**Step 1: 写失败测试（降级不破坏）**

新增场景：
- `inherit` + 无 `activeThreadId` -> 自动走 `new`。
- `inherit` + 非 Codex engine -> 自动走 `new`。
- 自动降级不会影响原有 `/new`、`/fork` 指令行为。

**Step 2: 运行测试确认失败**

Run: `npm run test -- src/features/threads/hooks/useQueuedSend.test.tsx src/features/threads/hooks/useThreads.integration.test.tsx`
Expected: FAIL，缺少降级分支或行为断言。

**Step 3: 最小实现**

- 在 `App.tsx` 增加统一 resolver：`resolveKanbanThreadCreationStrategy(...)`（本地函数即可）。
- 所有失败分支返回 `startThreadForWorkspace` fallback，避免“关联发送无响应”。

**Step 4: 运行测试确认通过**

Run: `npm run test -- src/features/threads/hooks/useQueuedSend.test.tsx src/features/threads/hooks/useThreads.integration.test.tsx`
Expected: PASS。

**Step 5: Commit**

```bash
git add src/App.tsx src/features/threads/hooks/useQueuedSend.test.tsx src/features/threads/hooks/useThreads.integration.test.tsx
git commit -m "test: cover kanban context inherit fallback paths"
```

### Task 5: 全量验证与文档补充

**Files:**
- Modify: `docs/changelog.html` (仅当项目要求更新 release note)

**Step 1: 执行验证命令**

Run:
- `npm run typecheck`
- `npm run lint`
- `npm run test -- src/features/composer/components/ComposerEditorHelpers.test.tsx src/features/threads/hooks/useThreadActions.test.tsx src/features/threads/hooks/useThreads.integration.test.tsx`

Expected: 全部 PASS。

**Step 2: 手工验收（本地）**

- 场景 A：选择关联看板 + 策略 `new`，创建全新 thread。
- 场景 B：选择关联看板 + 策略 `inherit`（Codex + 有活跃 thread），新任务 thread 为 fork 分支并带上下文。
- 场景 C：`inherit` 但不满足条件，自动降级到 `new` 且消息正常发送。

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add optional context inheritance for linked kanban conversations"
```

## 验收标准（Acceptance Criteria）

- 默认行为不变：未选择 `inherit` 时仍为新会话。
- 选择 `inherit` 时优先使用 fork（硬继承），不是摘要拼接。
- 降级路径稳定，不会出现“发送失败/无响应”。
- 中英文文案完整，UI 在桌面与紧凑布局均可用。

## 回滚方案

- UI 回滚：移除 Composer 策略控件与相关 i18n key。
- 行为回滚：`handleComposerSendWithKanban` 固定回退到 `startThreadForWorkspace`。
- API 回滚：撤销 `useThreads` 新暴露的 fork API，不影响现有 `/fork` 指令路径。
