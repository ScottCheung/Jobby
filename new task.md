<!-- @format -->

# Interview Playbook - 功能需求

## 项目目标

增加一个人面试准备系统。

目标：

帮助用户系统化管理面试准备内容，练习面试问题，记录学习进度，并通过数据反馈持续提升面试能力。

系统需要支持：

- 个人数据管理
- 面试知识库管理
- 练习记录追踪
- 模拟面试
- 面试复盘

请基于当前项目架构实现。

当前项目已经使用 PostgreSQL 数据库，并且已经容器化。

请优先复用现有技术架构：

- 不重新设计整个项目
- 不引入不必要的新技术
- 根据现有代码结构扩展功能

宝宝，我觉得你现在的想法其实已经很完整了，只是**混合了“内容管理、练习记录、计划管理、数据分析”几个层级**，所以读起来会有一点散。🧐

我帮你重新整理成一个更像产品需求的版本。

核心思路：

> 一个面试题训练系统，不只是存题，而是管理「题目 → 学习 → 练习 → 复盘 → 提升」。

---

# Interview Practice System 功能需求

## 1. 题目知识库（Question Library）

### 目标

管理所有面试问题，并提供结构化准备内容。

---

## 每个问题包含：

### 基础信息

- 问题标题
- 问题分类
- 标签 Tags
- 难度等级
- 重要程度评分
- 创建时间
- 更新时间

---

### 分类

例如：

```
About Yourself

Projects

Behaviour Questions

Professional

 ├── React
 ├── JavaScript
 ├── HTML/CSS
 ├── TypeScript
 ├── .NET
 └── Database

Company Research

Interview Questions
```

---

### 问题内容结构

每个问题提供：

```
Question

回答目标
(Interviewer's expectation)


回答框架
(Answer Framework)


参考答案
(Sample Answer)


我的回答
(My Answer)


改进记录
(Improvement Notes)
```

---

例如：

问题：

> Tell me about your project.

回答框架：

```
1. Project Background

2. Technical Challenge

3. My Contribution

4. Result

5. Learning
```

---

# 2. 问题练习系统（Practice Tracking）

### 目标

记录每一个问题的练习情况。

---

每个问题显示：

```
React Hooks

Category:
Professional


Importance:
⭐⭐⭐⭐⭐


Practice Count:
8


Last Practice:
2026-07-12


Status:
Practiced
```

---

支持：

- 开始练习
- 完成练习
- 修改答案
- 查看历史记录

---

## 练习历史

每次练习记录：

```
Date:

Question:

My Answer:

Confidence Score:

Notes:

Audio Recording:
(optional)
```

---

例如：

历史：

```
2026-07-10

回答：
第一次回答比较混乱

评分：
6/10


2026-07-12

回答：
结构更加清晰

评分：
8/10
```

---

# 3. 录音功能（Audio Practice）

### 目标

模拟真实面试。

支持：

- 浏览器录音
- 保存录音记录
- 回放历史回答

每次练习：

保存：

```
Audio

Duration

Date

Related Question
```

---

第一阶段：

本地 Docker 存储。

未来：

迁移 Supabase Storage。

---

# 4. 练习计划系统（Practice Plan）

### 目标

帮助用户规划未来学习任务。

---

## 创建计划

用户可以：

选择多个问题：

例如：

```
React:
20 questions

Behaviour:
10 stories

Projects:
5 questions
```

设置：

```
计划名称:

Frontend Interview Preparation


目标日期:

30 days


每天练习:

5 questions
```

---

系统自动生成：

每日任务：

```
Day 1

☐ React useEffect

☐ Explain your project

☐ Conflict Story


Day 2

☐ React State

☐ Leadership Story
```

---

# 5. 今日任务 Dashboard

首页显示：

```
Today's Practice


3 / 5 Completed


☑ Tell me about yourself

☐ React Hooks

☐ Auto Apply Project


Progress:

60%
```

---

支持：

- 完成任务
- 删除任务
- 清除计划
- 创建新计划

---

# 6. Tag 系统

每个问题支持多个 Tag。

例如：

```
React

Frontend

Important

Weak Area

Frequently Asked
```

---

Tag 用途：

搜索：

```
React
```

显示：

所有 React 问题。

---

筛选：

```
重要程度 > 4

未练习

计划内

Behaviour
```

---

# 7. 问题管理

支持：

## 添加问题

用户可以手动创建：

填写：

```
Question

Category

Tags

Importance Score

Answer Framework

Sample Answer
```

---

## 编辑问题

支持：

- 修改内容
- 修改分类
- 修改评分
- 添加标签

---

# 8. 数据统计 Dashboard

展示：

## 总体数据

```
Total Questions:

120


Practiced:

75


Mastered:

30
```

---

## 分类统计

例如：

```
React

20/50


Behaviour

15/30


Projects

10/15
```

---

## 练习趋势

图表：

- 每日练习次数
- 每周完成数量
- 连续练习天数

---

# 9. 搜索功能

支持：

搜索：

- 问题标题
- 内容
- 标签

例如：

搜索：

```
performance
```

找到：

```
React Performance Optimization

Database Performance

Project Optimization Story
```

---

# 核心数据模型

未来数据库：

```
User

Question

Category

Tag

Question_Tag

Practice_Record

Practice_Plan

Plan_Task

Audio_Record

Answer_History
```

---

# 开发优先级

## Phase 1 MVP

必须完成：

✅ 问题管理
✅ 分类和标签
✅ 回答框架
✅ 我的回答
✅ 练习次数记录
✅ 基础 Dashboard

---

## Phase 2

加入：

✅ 练习计划
✅ 每日任务
✅ 历史记录
✅ 数据统计

---

## Phase 3

加入：

✅ 录音
✅ AI 评分
✅ AI 改进建议
✅ Supabase 迁移

---

宝宝，我觉得这样整理之后，AI 会更容易理解。

而且我发现一个很关键的点：

你这个项目的核心实体其实不是“Interview Content”。

而是：

> **Question（问题）**

因为所有东西最终都围绕问题展开：

问题
→ 我的答案
→ 练习记录
→ 录音
→ 计划
→ 统计

# 2. Interview 分类：

01 About Yourself
02 Projects
03 Behaviour Stories
04 Professional
05 Company Research
06 Questions To Ask
07 Interview Tips

开始开发前：

1. 分析当前项目结构。
2. 分析已有数据库。
3. 设计新增数据库模型。
4. 输出实现计划。
5. 分阶段开发。

不要一次实现所有功能。

优先完成一个可以使用的 MVP。

```

```
