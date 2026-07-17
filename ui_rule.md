<!-- @format -->

# Jobby UI Design System Guide

> **永远使用下面列出的 token 和语义类，不要硬编码 `zinc-*`、`gray-*`、`slate-*` 等具体颜色，也不要随意使用裸数值的 `rounded-xl`、`rounded-2xl`（除非是特殊设计）。**

---

## 颜色 Token

### 文本色

| Class                | 用途                           |
| -------------------- | ------------------------------ |
| `text-ink-primary`   | 主文本、标题、正文             |
| `text-ink-secondary` | 次级文本、说明、占位符         |
| `text-ink-muted`     | 弱化文本、禁用状态             |
| `text-primary`       | 品牌强调色文本（链接、高亮等） |

### 背景色

| Class                     | 用途                                              |
| ------------------------- | ------------------------------------------------- |
| `bg-background`           | 页面底层背景                                      |
| `bg-background-secondary` | 区域分隔背景、表格行交替色                        |
| `bg-panel`                | 浮层、卡片、面板背景（半透明）                    |
| `bg-primary`              | 品牌主色填充（按钮等）                            |
| `bg-primary/10`           | 品牌色轻量背景（badge、选中态）                   |
| `bg-glass`                | 毛玻璃效果（`bg-primary/5 backdrop-blur-[20px]`） |
| `bg-primary-gradient`     | 品牌渐变（badge、特殊强调）                       |

### 边框色

| Class               | 用途                         |
| ------------------- | ---------------------------- |
| `border-border`     | 标准边框                     |
| `border-border/60`  | 轻量边框（sticky header 等） |
| `border-border/40`  | 极轻边框（分割线）           |
| `border-primary`    | 品牌色边框（聚焦态、选中态） |
| `border-primary/20` | 轻量品牌边框                 |

### 语义色

| Class                             | 用途               |
| --------------------------------- | ------------------ |
| `text-ink-error` / `bg-error`     | 错误状态           |
| `text-ink-success` / `bg-success` | 成功状态           |
| `text-ink-warning` / `bg-warning` | 警告状态           |
| `bg-destructive`                  | 危险操作（删除等） |

---

## 容器组件类

### 层级关系与同心圆角优化

为了确保完美的嵌套美感，圆角和边距遵循数学同心律。当容器 B 嵌套在容器 A 中时，完美的同心圆角关系为：
$$P_{\text{outer}} = R_{\text{outer}} - R_{\text{inner}}$$
通过调整内层半径或外层 padding，可以让边框到内部内容的距离在视觉上看起来完全一致，从而显得非常精致。

推荐嵌套体系：

```
bg-background (页面)
  └─ .panel-xl (超大面板，原 .card，R=24px，P=24px)
      └─ .panel-lg (大展示面板，原 .display-panel，R=16px，P=16px)
          └─ .panel-md (中型模块，原 .module-panel，R=12px，P=14px)
              └─ .panel-sm (小型状态区，原 .status-panel，R=8px，P=10px)
                  └─ .panel-xs (极小内容区，原 .surface，R=6px，P=8px)
```

### 详细说明

| Class           | 样式                                                                                       | 用途                              |
| --------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| `.panel-xl`     | `rounded-[24px] p-6 bg-panel flex flex-col gap-6 border border-border/40`                  | 页面顶层容器/超大面板（原 .card） |
| `.panel-lg`     | `rounded-[16px] p-4 bg-panel flex flex-col`                                                | 通用展示区块（原 .display-panel） |
| `.panel-header` | 与 `.label-overline` 样式一致                                                              | 面板标题 Eyebrow eyebrow 标签     |
| `.panel-md`     | `rounded-[12px] p-3.5 bg-background-secondary/30 dark:bg-black/30 border border-border/30` | 内嵌模块块（原 .module-panel）    |
| `.panel-sm`     | `rounded-[8px] p-2.5 bg-background-secondary/50 dark:bg-black/30`                          | 紧凑状态区（原 .status-panel）    |
| `.panel-xs`     | `rounded-[6px] p-2 bg-background-secondary/40 border border-border/50`                     | 极小辅助内容区（原 .surface）     |

---

## 排版类 (功能分类)

| Class             | 样式                                                                       | 功能分类                          |
| ----------------- | -------------------------------------------------------------------------- | --------------------------------- |
| `.title-page`     | `text-2xl font-bold tracking-tight text-ink-primary`                       | 页面级主标题                      |
| `.title-section`  | `text-xl font-bold text-ink-primary`                                       | 页面区块标题（原 .section-title） |
| `.title-card`     | `text-lg font-bold text-ink-primary`                                       | 卡片/大面板标题（原 .card-title） |
| `.title-sub`      | `text-base font-semibold text-ink-primary`                                 | 子模块标题                        |
| `.body-lg`        | `text-base font-normal text-ink-primary leading-relaxed`                   | 大段正文/可读性文本               |
| `.body-md`        | `text-sm font-normal text-ink-primary leading-relaxed`                     | 标准正文（默认）                  |
| `.body-sm`        | `text-xs font-normal text-ink-secondary leading-normal`                    | 辅助/次要描述正文                 |
| `.label`          | `text-sm font-semibold text-ink-primary`                                   | 表单标签/中等加粗（原 .label）    |
| `.label-sm`       | `text-xs font-semibold text-ink-secondary`                                 | 次要小粗体标签                    |
| `.label-overline` | `text-xs font-bold text-ink-secondary uppercase tracking-wider`            | Eyebrow 分组标题                  |
| `.text-meta`      | `text-xs text-ink-muted`                                                   | 元信息弱化字（原 .meta-text）     |
| `.text-hint`      | `text-[11px] text-ink-muted leading-tight`                                 | 小字提示/表单输入说明             |
| `.text-gradient`  | `bg-linear-to-br from-primary to-primary/70 bg-clip-text text-transparent` | 渐变修饰文字                      |

> **⚠️ 禁止随意使用内联的 font-size + weight + color 组合，一律按功能选择使用上方排版类，从而保持全局风格高度一致。**

---

## 布局工具类

| Class          | 样式                                | 用途                    |
| -------------- | ----------------------------------- | ----------------------- |
| `.row`         | `flex items-center gap-2`           | 水平对齐容器（小间距）  |
| `.row-md`      | `flex items-center gap-3`           | 水平对齐容器（中间距）  |
| `.row-between` | `flex items-center justify-between` | 两端对齐行（header 等） |
| `.stack`       | `flex flex-col gap-1.5`             | 紧凑纵向堆叠            |
| `.col`         | `flex flex-col gap-3`               | 标准纵向排列            |
| `.wrap`        | `flex flex-wrap gap-3`              | 换行排列（tag 列表等）  |

---

## 表单元素类

| Class       | 用途                                             |
| ----------- | ------------------------------------------------ |
| `.input`    | 主文本输入框（圆角全宽，`h-12`，`rounded-full`） |
| `.textarea` | 多行文本域（`rounded-xl`，使用 token 背景/边框） |
| `.select`   | 下拉选择（`rounded-xl`，与 textarea 保持一致）   |
| `.label`    | 表单字段标签                                     |

> `.textarea` 和 `.select` 已对齐 `.input` 的 token 风格，不再使用 `zinc-*`。

---

## 徽章 & 状态指示

| Class           | 用途                                   |
| --------------- | -------------------------------------- |
| `.status-badge` | 通用状态徽章（品牌色，`rounded-full`） |
| `.badge`        | 渐变徽章（XP/等级等游戏化元素）        |

---

## 按钮变体类

> 配合 `<Button variant="...">` 组件使用，底层 CSS 在 `customize/button.css`。

| Class                 | 用途                       |
| --------------------- | -------------------------- |
| `.button-default`     | 主要操作（品牌色填充）     |
| `.button-destructive` | 危险操作（红色）           |
| `.button-outline`     | 次要操作（边框）           |
| `.button-ghost`       | 透明按钮（hover 显示背景） |
| `.button-icon`        | 图标按钮                   |
| `.button-secondary`   | 次级按钮（黑/白）          |
| `.button-link`        | 链接样式按钮               |

---

## Drawer / 表单布局类

| Class        | 用途                          |
| ------------ | ----------------------------- |
| `.header`    | 抽屉顶部（标题 + 关闭按钮行） |
| `.form-body` | 抽屉/表单滚动内容区域         |
| `.footer`    | 操作按钮行（右对齐）          |

---

## 特殊工具类

| Class               | 用途                              |
| ------------------- | --------------------------------- |
| `.custom-scrollbar` | 统一滚动条样式（细，自动深/浅色） |
| `.skeleton`         | 加载占位符（`animate-pulse`）     |
| `.bg-glass`         | 毛玻璃背景                        |
| `.text-gradient`    | 品牌色渐变文字                    |
| `.rounded-card`     | 响应式圆角（`xl → 2xl → 3xl`）    |
| `.rounded-button`   | 按钮圆角（`rounded-full`）        |
| `.shadow-brand`     | 彩虹光晕阴影（特殊组件）          |

---

## 命名规范

1. **颜色**：只用 token（`text-ink-primary`、`bg-panel`、`border-border`），禁止 `zinc-*`、`slate-*`、`gray-*`
2. **间距**：使用语义 padding token（`p-page`、`p-panel`、`p-card`、`p-sidebar`）
3. **圆角**：优先用 `.rounded-card`、`.rounded-button` 等语义类；需要具体尺寸时用 `rounded-xl`（panel）、`rounded-2xl`（card 内）、`rounded-full`（pill/button）
4. **文字**：用排版类（`.label`、`.label-overline`、`.section-title`），避免内联 font-size + weight + color 组合
5. **布局**：用 `.row`、`.col`、`.stack` 等工具类替代高频内联 flex 组合
6. **例外**：游戏化页面（schedule、特殊动画组件）允许保留特定设计色（`emerald`、`rose`、`amber`）

---

## 文件结构

```
styles/
├── config/
│   ├── palette.css      # CSS 变量 & 主题色
│   ├── backgrounds.css  # 背景 token
│   ├── text.css         # 文本 token & fluid 字体
│   ├── radius.css       # 圆角工具类
│   ├── spacing.css      # 间距 token
│   └── padding.css      # Padding token
├── customize/
│   ├── components.css   # 所有组件语义类（主文件）
│   ├── button.css       # 按钮变体
│   ├── text.css         # 文字特效（gradient）
│   └── badge.css        # Badge 样式
└── main.css             # 入口，@import 所有文件
```
