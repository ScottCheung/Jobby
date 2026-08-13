<!-- @format -->

# Jobby 职位匹配与投递优先级算法设计与实现方案

## 一、 背景与改进目标

根据用户反馈，系统对职位打分进行了**概念拆分**与**模型权重精细化调整**：

1. **概念拆分**：
   - **`Match Score`（匹配度）**：衡量候选人履历与职位 JD 的真实能力契合度（不受发布时间影响）。
   - **`Priority Score`（投递优先级分）**：决定当前是否优先投递该职位，公式为：
     $$\text{Priority Score} = \text{Match Score} \times \text{Recency}$$
2. **权重重分配（突出技能重要性）**：
   - **Skill（技能）**：从 40% 提升至 **55%** （Developer 岗位最核心维度）。
   - **Title（职位名称）**：从 40% 降低至 **25%**。
   - **Experience（经验年限）**：保持 **20%**。
3. **阶梯式 Seniority 资历扣分**：
   - 差距 0 级（同级）：**1.00**
   - 差距 1 级：**0.85**
   - 差距 2 级：**0.65**
   - 差距 3+ 级：**0.50**
4. **规范化别名字典与模块解耦**：
   - 抽出单独文件 [matching_dictionaries.py](file:///Users/xianzhezhang/Projects/Jobby/Jobby/backend/services/shared/matching_dictionaries.py)，方便独立维护。
   - 映射到标准 Canonical Short Name（如 `reactjs` / `react.js` $\rightarrow$ `react`；`golang` $\rightarrow$ `go`；`k8s` $\rightarrow$ `kubernetes`）。

---

## 二、 核心模块架构

```
                     ┌────────────────────────────────┐
                     │     输入: JD, 简历, 发布时间      │
                     └───────────────┬────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
┌───────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│ 1. 规范切词与别名  │      │ 2. 阶梯 Seniority │      │ 3. 24h平滑时间衰减│
│ (matching_dict)   │      │    级差扣分       │      │ (24h protection + │
│ - 废词过滤         │      │ - 同级: 1.00      │      │  3.5天半衰期)     │
│ - Canonical Alias │      │ - 差1级: 0.85     │      │ - 24h: 0.92       │
│ - 技能占比 55%    │      │ - 差2级: 0.65     │      │ - 3天: ~0.61      │
└─────────┬─────────┘      │ - 差3+级: 0.50    │      └─────────┬─────────┘
          │                └─────────┬─────────┘                │
          └──────────────────────────┼──────────────────────────┘
                                     │
                                     ▼
                       ┌───────────────────────────┐
                       │   Match Score 计算        │
                       │ Skill(55%) + Title(25%)   │
                       │ + Exp(20%) * Seniority    │
                       └─────────────┬─────────────┘
                                     │
                                     ▼
                       ┌───────────────────────────┐
                       │   Priority Score 计算     │
                       │ Priority = Match * Recency│
                       └───────────────────────────┘
```

---

## 三、 测试与集成验证

- **单元测试文件**：[test_application_matching.py](file:///Users/xianzhezhang/Projects/Jobby/Jobby/backend/tests/test_application_matching.py)
- **验证命令**：`PYTHONPATH=backend pytest backend/tests/test_application_matching.py backend/tests/test_application_decisions.py`
- **验证状态**：**17 项测试全数 Pass**。

## 四、 关键数据与日志结构预留

为了满足未来通过真实投递数据优化权重的要求，`MatchScore` 结构体已原生支持导出：
- `match_score`: 能力匹配分（0.0 ~ 1.0）
- `recency_factor`: 时间衰减因子（0.0 ~ 1.0）
- `priority_score`: 综合投递优先级分（0.0 ~ 1.0）
- `matched_terms`: 命中的标准 Canonical 技能集合

