<!-- @format -->

# PostgreSQL 后台管理 + 本地自动申请 Worker 方案

## 1. 当前决策

我们先不做“大而全”的云端架构，也不走纯 SQLite 本地软件。

当前最推荐的路线是：

```text
Docker 管理 PostgreSQL
        +
后端服务管理用户数据 / 申请记录 / 个人信息
        +
自动申请服务作为本地工具运行
```

这个方案的核心思想是：

- 数据先统一进 PostgreSQL
- 后台管理和数据读写先服务化
- 自动申请逻辑暂时保留本地运行，降低浏览器自动化风险
- 未来通过用户权限控制是否允许开启自动申请功能
- 后续如果要上云，可以平滑迁移，不需要推倒重来

---

## 2. 为什么不选纯 SQLite

SQLite 本身很好，但更适合：

- 单用户
- 本地小工具
- 少量数据
- 不需要后台权限
- 不需要多人协作

当前项目已经在往这些方向发展：

- 用户资料管理
- 申请记录长期保存
- 后台管理页
- 未来多用户
- 未来多平台
- 自动申请功能权限控制
- 后续可能上云

如果现在用 SQLite，短期简单，但后面很可能遇到这些问题：

- 多用户权限模型不好扩展
- API 服务并发读写不如 PostgreSQL 稳
- 任务状态、申请历史、日志事件会越来越多
- 后续迁移 PostgreSQL 还要再做一次数据层切换

所以本阶段直接用 Docker 管理 PostgreSQL 更合适。

---

## 3. 为什么不现在全量 Docker 化

不建议现在把自动申请 worker 也强行放进 Docker。

原因：

- LinkedIn 自动申请依赖浏览器环境
- Chrome 登录态、本地 profile、验证码、反爬策略都更适合先在本机调试
- Docker 中跑浏览器自动化会引入额外不确定性
- 当前第一目标是整理数据，不是先解决容器化浏览器

所以本阶段只 Docker 化数据库。

后端服务可以先本地跑，也可以后续进 Docker。

自动申请 worker 第一阶段继续本地跑。

---

## 4. 第一阶段目标

第一阶段只做一个稳定的数据底座和最小后台能力。

目标：

1. 用 Docker Compose 启动 PostgreSQL
2. 把 `config`、`data`、`csv` 中的核心数据整理进数据库
3. 建一个后端 API 服务管理数据
4. 做一个最小后台页编辑个人信息和查看申请记录的后端服务
5. 自动申请工具通过后端服务读取配置
6. 自动申请工具把申请结果写回数据库
7. 为未来用户权限和多平台预留字段

暂时不做：

- 多实例 worker
- 云部署
- 完整 SaaS 权限体系
- 自动申请 worker Docker 化
- Redis / Celery 任务队列
- 复杂团队协作功能

---

## 5. 推荐架构

```text
项目根目录
├── docker-compose.yml
├── services
│   ├── api
│   └── shared
├── worker
│   └── local_runner
├── web
│   └── admin
├── migrations
├── storage
│   ├── resumes
│   ├── screenshots
│   └── exports
└── plan
```

### 5.1 PostgreSQL

职责：

- 存储用户资料
- 存储搜索配置
- 存储问题缓存
- 存储申请历史
- 存储自动申请运行状态

运行方式：

```text
Docker Compose
└── postgres
```

### 5.2 后端 API 服务

职责：

- 读取和保存用户资料
- 读取和保存搜索配置
- 管理申请记录
- 管理 question cache
- 给后台页面提供接口
- 给本地 worker 提供配置读取和结果写入接口

推荐技术：

- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- PostgreSQL driver

### 5.3 后台管理页

职责：

- 编辑个人信息
- 编辑搜索配置
- 查看 question cache
- 查看申请历史
- 查看自动申请状态
- 后续管理“是否允许开启自动申请”

建议：

- 复用现有 `modules/dashboard` 的界面思路，但是使用 next.js
- 但改成独立后台页面，而不是只注入到 LinkedIn 页面里

### 5.4 本地自动申请 Worker

职责：

- 从 API 或数据库读取当前用户配置
- 调用现有 LinkedIn 自动申请逻辑
- 写入申请历史
- 写入失败原因
- 更新 question cache
- 上报运行状态

第一阶段建议：

- 本地运行
- 不进 Docker
- 不做多实例

---

## 6. 数据边界

### 6.1 数据库作为主数据源

未来系统里的主数据都进 PostgreSQL：

- 用户资料
- 求职偏好
- 搜索配置
- 运行设置
- 问题缓存
- 申请历史
- 任务状态

### 6.2 文件只存附件和导出物

这些仍然保留在本地文件夹：

- 简历文件
- 截图
- 日志文件
- 导出的 CSV

数据库只保存这些文件的路径和元信息。

### 6.3 旧数据处理

当前这些数据需要被整理：

- `config/personals.py`
- `config/questions.py`
- `config/search.py`
- `config/settings.py`
- `data/question_cache.json`
- `data/applications_history.json`
- `data/bot_status.json`
- `all excels/all_applied_applications_history.csv`
- `all excels/all_failed_applications_history.csv`

迁移后：

- PostgreSQL 是主数据源
- `config/*.py` 可以保留为默认值或兼容旧入口
- `data/*.json` 不再作为主存储
- `csv` 只作为导出或历史备份

---

## 7. 第一阶段最小数据表

不用一开始设计太多表，先建立足够清晰的一组核心表。

### 7.1 `users`

用途：

- 保存系统用户
- 未来做权限控制

字段建议：

- `id`
- `email`
- `display_name`
- `role`
- `status`
- `can_use_auto_apply`
- `created_at`
- `updated_at`

说明：

- 第一阶段可以只有一个管理员用户
- `can_use_auto_apply` 用来预留功能权限

### 7.2 `user_profiles`

用途：

- 保存个人资料
- 对应现在的 `config/personals.py`

字段建议：

- `id`
- `user_id`
- `first_name`
- `middle_name`
- `last_name`
- `phone_number`
- `current_city`
- `street`
- `state`
- `zipcode`
- `country`
- `ethnicity`
- `gender`
- `gender_identity`
- `disability_status`
- `veteran_status`
- `extra_data`
- `created_at`
- `updated_at`

### 7.3 `platform_accounts`

用途：

- 保存平台账号信息
- 当前主要是 LinkedIn
- 未来支持其他平台

字段建议：

- `id`
- `user_id`
- `platform`
- `account_name`
- `login_identifier`
- `status`
- `last_login_at`
- `extra_data`
- `created_at`
- `updated_at`

注意：

- 不建议第一阶段把明文密码存数据库
- 可以先继续使用本地浏览器登录态
- 后续再做加密凭据管理

### 7.4 `job_preferences`

用途：

- 保存长期求职资料
- 对应 `config/questions.py` 中不是运行开关的部分

字段建议：

- `id`
- `user_id`
- `years_of_experience`
- `require_visa`
- `website`
- `linkedin_url`
- `us_citizenship`
- `desired_salary`
- `current_ctc`
- `notice_period`
- `linkedin_headline`
- `linkedin_summary`
- `cover_letter`
- `recent_employer`
- `confidence_level`
- `extra_data`
- `created_at`
- `updated_at`

### 7.5 `search_profiles`

用途：

- 保存搜索关键词和筛选条件
- 对应 `config/search.py`

字段建议：

- `id`
- `user_id`
- `platform_account_id`
- `name`
- `platform`
- `search_terms`
- `search_location`
- `filters`
- `blacklist_rules`
- `whitelist_rules`
- `is_default`
- `created_at`
- `updated_at`

说明：

- `filters` 可以先用 JSON 存复杂筛选条件
- 后续稳定后再拆更细的表

### 7.6 `runtime_settings`

用途：

- 保存运行开关
- 对应 `config/settings.py` 和部分 `config/questions.py`

字段建议：

- `id`
- `user_id`
- `platform_account_id`
- `run_in_background`
- `safe_mode`
- `stealth_mode`
- `click_gap`
- `pause_before_submit`
- `pause_at_failed_question`
- `overwrite_previous_answers`
- `learn_from_manual_answers`
- `question_similarity_threshold`
- `settings`
- `created_at`
- `updated_at`

### 7.7 `question_cache_entries`

用途：

- 保存自动答题缓存
- 对应 `data/question_cache.json`

字段建议：

- `id`
- `user_id`
- `platform_account_id`
- `platform`
- `original_label`
- `normalized_label`
- `field_type`
- `options`
- `answer`
- `source`
- `times_used`
- `last_used_at`
- `companies`
- `created_at`
- `updated_at`

建议唯一约束：

- `user_id + platform + normalized_label + field_type`

### 7.8 `job_applications`

用途：

- 保存申请记录
- 对应 `data/applications_history.json` 和 CSV 历史

字段建议：

- `id`
- `user_id`
- `platform_account_id`
- `platform`
- `job_id`
- `title`
- `company`
- `work_location`
- `work_style`
- `job_link`
- `external_job_link`
- `status`
- `application_type`
- `resume_path`
- `date_posted`
- `date_applied`
- `questions`
- `error_message`
- `screenshot_path`
- `raw_data`
- `created_at`
- `updated_at`

### 7.9 `automation_runs`

用途：

- 保存每次自动申请运行记录

字段建议：

- `id`
- `user_id`
- `platform_account_id`
- `search_profile_id`
- `status`
- `started_at`
- `finished_at`
- `current_message`
- `summary`
- `error_message`
- `created_at`
- `updated_at`

状态建议：

- `pending`
- `running`
- `success`
- `failed`
- `cancelled`

---

## 8. 旧数据迁移顺序

建议按这个顺序迁移，风险最低。

### 第 1 步：备份现有数据

备份：

- `config`
- `data`
- `all excels`
- `all resumes`

### 第 2 步：迁移用户基础资料

来源：

- `config/personals.py`

目标：

- `users`
- `user_profiles`

### 第 3 步：迁移求职资料和运行设置

来源：

- `config/questions.py`
- `config/settings.py`

目标：

- `job_preferences`
- `runtime_settings`

### 第 4 步：迁移搜索配置

来源：

- `config/search.py`

目标：

- `search_profiles`

### 第 5 步：迁移问题缓存

来源：

- `data/question_cache.json`

目标：

- `question_cache_entries`

### 第 6 步：迁移申请历史

来源：

- `data/applications_history.json`
- `all excels/all_applied_applications_history.csv`
- `all excels/all_failed_applications_history.csv`

目标：

- `job_applications`

处理规则：

- JSON 优先
- CSV 作为补充
- 如果同一个职位重复，优先保留字段更完整的数据

---

## 9. 后端 API 最小范围

第一阶段 API 只做这些：

### 用户资料

- 获取当前用户资料
- 更新当前用户资料

### 求职资料

- 获取求职偏好
- 更新求职偏好

### 搜索配置

- 获取默认搜索配置
- 更新搜索配置

### 问题缓存

- 列表
- 修改答案
- 删除缓存项

### 申请记录

- 列表
- 查看详情
- 按状态筛选

### 自动申请状态

- 获取最近一次运行状态
- 创建一次本地 worker 可读取的运行记录
- 更新运行状态

---

## 10. 后台页面最小范围

第一阶段后台页面只需要：

1. 个人信息
2. 求职资料
3. 搜索配置
4. 问题缓存
5. 申请历史
6. 自动申请状态

暂时不做复杂功能：

- 团队成员管理
- 细粒度角色权限
- 多平台复杂配置
- 高级报表

---

## 11. 本地 Worker 改造方式

当前自动申请逻辑不要大重写。

建议做一个适配层：

```text
Database/API 配置
    ↓
转换为当前 bot 需要的配置对象
    ↓
调用现有 LinkedIn 自动化逻辑
    ↓
把结果写回 Database/API
```

这样可以保留现有稳定逻辑，只替换数据来源和数据写入。

### Worker 第一阶段读写方式

推荐优先通过 API 读写，而不是直接连数据库。

原因：

- 权限逻辑集中在 API
- 后续上云更容易
- worker 不需要知道数据库表细节
- 数据校验更统一

---

## 12. Docker Compose 最小组成

第一阶段：

```text
docker-compose.yml
└── postgres
```

可选开发辅助：

```text
docker-compose.yml
├── postgres
└── adminer
```

后续可以加入：

```text
docker-compose.yml
├── postgres
├── api
└── admin-web
```

自动申请 worker 暂时不加入 Docker Compose。

---

## 13. 推荐执行顺序

### 第 1 步：建立数据库和迁移框架

产出：

- `docker-compose.yml`
- PostgreSQL 启动配置
- 数据库连接配置
- Alembic 初始化
- 第一版核心表

### 第 2 步：写数据迁移脚本

产出：

- 从 `config/*.py` 导入用户配置
- 从 `data/*.json` 导入 question cache 和申请历史
- 从 CSV 补充申请历史

### 第 3 步：建立后端 API

产出：

- 用户资料接口
- 搜索配置接口
- 问题缓存接口
- 申请历史接口
- 自动申请状态接口

### 第 4 步：做最小后台页面

产出：

- 能编辑个人资料
- 能编辑搜索配置
- 能查看申请历史
- 能查看和编辑问题缓存

### 第 5 步：改造本地 worker 数据入口

产出：

- worker 从 API 读取配置
- worker 写回申请记录
- worker 写回问题缓存
- worker 写回运行状态

### 第 6 步：逐步弃用旧文件存储

产出：

- `data/*.json` 不再作为主存储
- CSV 只作为导出或备份
- `config/*.py` 只作为兼容默认值

---

## 14. 最重要的原则

第一阶段只解决一件事：

```text
把混乱的数据收拢到 PostgreSQL，并通过后端服务统一管理。
```

不要在第一阶段同时解决：

- 云部署
- 多实例扩容
- 全容器化浏览器
- 完整 SaaS 权限体系

这些都可以等数据稳定后再做。

---

## 15. 最终推荐

下一步最推荐执行：

1. 先建 Docker PostgreSQL
2. 设计并创建最小核心表
3. 写现有数据迁移脚本
4. 建最小 API
5. 再让本地自动申请工具读写 API

这条路线足够稳，也不会限制未来发展。
