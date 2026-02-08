# Worktree Sidebar 样式优化与折叠交互计划（2026-02-08）

## 目标
优化左侧工作区内 `worktrees` 与 `当前会话` 的视觉层次与交互一致性：
- icon + 字体更精致、单行紧凑。
- `worktrees`、worktree 子项、`当前会话` 支持折叠。
- 全局折叠/展开按钮覆盖工作区主折叠 + worktrees + 当前会话 + 分组折叠。
- 去掉明显“包裹块感”的竖向视觉，保留横向分隔，提升融合感。

## 边界（严格）
仅处理本次新增/修改相关代码，不扩展到无关模块：
- 允许：`Sidebar`、`WorktreeSection`、`WorktreeCard`、`WorkspaceCard`、`useCollapsedGroups`、对应 i18n、`sidebar.css`、相关测试。
- 禁止：改动业务逻辑链路、数据模型、后端接口、无关页面。

## 实施项
1. `worktrees` 折叠头与子项交互
- [x] worktrees 区块增加可折叠 header。
- [x] 每个 worktree 子项支持点击切换其消息折叠。
- [x] 子项保留小 icon 与紧凑排版。

2. `当前会话` 区块折叠
- [x] 在 workspace 下增加 `当前会话` 折叠头。
- [x] 标题前增加会话 icon。
- [x] 与 worktrees 使用统一折叠动效与视觉语义。

3. 全局折叠/展开
- [x] 工作区标题区增加“全部折叠/展开”按钮（在创建项目按钮左侧）。
- [x] 全局动作覆盖：workspace 折叠、worktrees section 折叠、当前会话折叠、workspace group 折叠。
- [x] `useCollapsedGroups` 支持批量替换（用于全局切换）。

4. 视觉融合（去竖线，保横线）
- [x] worktrees 与当前会话改为 top border 分层，减少卡片包裹感。
- [x] 调整字体、间距、圆角、hover/active 对比度，避免“浮肿”。

5. 本轮无效代码清理（仅限本次改动新增内容）
- [x] 清理 Sidebar 中已失效的 addMenu 状态/副作用。
- [x] 清理 WorkspaceCard 中无效 props（`addMenuOpen`、`addMenuWidth`、`onConnectWorkspace`）。
- [x] 清理 useCollapsedGroups 无效入参 `_storageKey`。
- [x] 清理本次引入的临时注释噪音。

## 改动文件（Refers to）
- `src/features/app/components/Sidebar.tsx`
- `src/features/app/components/WorktreeSection.tsx`
- `src/features/app/components/WorktreeCard.tsx`
- `src/features/app/components/WorkspaceCard.tsx`
- `src/features/app/hooks/useCollapsedGroups.ts`
- `src/styles/sidebar.css`
- `src/i18n/locales/zh.ts`
- `src/i18n/locales/en.ts`
- `src/features/app/components/WorktreeSection.test.tsx`

## 验证
- [x] `npm run build` 通过。
- [x] `npm run lint` 通过（仅历史 warning，无新增 error）。
- [ ] `npm run test -- WorktreeSection` 受现有环境依赖问题阻塞：`@lobehub/fluent-emoji` ESM 目录导入报错（非本次改动引入）。

## 回滚策略
- 若 UI 反馈不满意，可仅回滚以下文件到优化前版本：
  - `src/styles/sidebar.css`
  - `src/features/app/components/WorktreeSection.tsx`
  - `src/features/app/components/WorktreeCard.tsx`
  - `src/features/app/components/Sidebar.tsx`

## PR 说明建议
本次为侧栏样式与折叠交互优化，功能边界限定于工作区展示层；构建通过，测试受既有依赖问题影响。
