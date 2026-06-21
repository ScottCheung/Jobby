# Auto Job Applier LinkedIn - 开发与启动指南 🚀

这篇文档将解答你关于 Docker 容器重复、数据安全、以及日常开发如何启动的疑惑。

---

## 1. 为什么 Docker 会有多个重复的容器？

从你的 Docker Desktop 截图来看，出现了多个 `user` 和 `api` 容器，有些在运行，有些已停止。这通常是因为以下原因：

1. **项目重命名或路径变更**：Docker Compose 默认使用当前文件夹名称（如 `auto_job_applier_linkedin`）作为项目前缀。如果你重命名了文件夹、复制了项目，或者在不同目录下运行过，Docker 会认为它们是不同的项目，从而创建了多套容器。
2. **修改了 `docker-compose.yml`**：之前你可能启用了 `user` (Next.js) 和 `adminer` 服务，后来在 `docker-compose.yml` 中把它们注释掉了（目前确实是注释状态）。但已经创建的旧容器依然残留在 Docker 历史记录中。
3. **没有正确关闭**：如果直接关闭终端或电脑，容器没有执行 `docker compose down`，它们就会一直处于挂起或停止状态，下次启动时可能会产生冲突。

---

## 2. 数据库数据会丢失吗？如何安全清理？

### 🔒 数据安全结论
**绝对不会丢失！** 只要你不主动删除 Docker 数据卷 (Volume)，你可以随意删除任何容器。

* **为什么？**  
  在 [docker-compose.yml](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/docker-compose.yml) 的第 14-15 行和 87-88 行定义了具名数据卷：
  ```yaml
  volumes:
    - postgres_data:/var/lib/postgresql/data
  ```
  这表示 PostgreSQL 的所有数据都安全地存储在你的宿主机磁盘上（由 Docker 管理的 `postgres_data` 卷中），而不是在容器内部。
* **什么是安全的？**
  * 在 Docker Desktop 中点击容器右侧的 **垃圾桶图标（Trash/Delete）** 是 **100% 安全** 的。它只会销毁容器外壳，下次启动时会自动创建新外壳并重新挂载你的数据卷，数据完好无损。
  * 运行 `docker compose down` 是安全的，它只会停止并删除当前项目的容器，不会删除数据。
* **什么是不安全的？（千万不要运行）**
  * ⚠️ 带有 `-v` 参数的命令：`docker compose down -v`（`-v` 代表删除关联的数据卷）。
  * ⚠️ 卷清理命令：`docker volume rm <volume_name>` 或 `docker volume prune`。

### 🧹 推荐的安全清理步骤
如果你想把 Docker 界面清理干净，只留下需要的容器，请按以下步骤操作：

1. **停止所有容器**：
   在项目根目录下打开终端，运行：
   ```bash
   docker compose down
   ```
2. **清理无用的旧容器**：
   打开 Docker Desktop，找到那些灰色的（已停止的）、重复的 `user`、`api`、`adminer` 容器，直接点击右侧的 **垃圾桶（Delete）** 删掉。
   *(或者在终端运行 `docker container prune`，这会安全地删除所有已经停止的容器，而不会影响任何运行中的容器或数据卷。)*

---

## 3. 日期开发时，我要怎么启动？

项目已经为你写好了非常方便的一键启动脚本！**你不需要手动 `cd` 到各个目录去分别运行 `npm run dev`**。

### 💻 开发模式启动（推荐）
在日常开发、修改代码时，请直接使用 [dev.sh](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/dev.sh)。

1. **只需一步命令**（在项目根目录下）：
   ```bash
   ./dev.sh
   ```
   *(如果提示权限不足，先运行一次 `chmod +x dev.sh` 赋予执行权限)*

2. **`./dev.sh` 帮你做了什么？**
   * **启动 Docker 后端**：在后台自动启动 `postgres`（数据库）和 `api`（Python 后端）容器。
   * **等待 API 就绪**：脚本会自动轮询，直到检测到后端 API 启动成功（`http://127.0.0.1:8000/ready`）。
   * **启动前端 Next.js**：自动进入 `Apps/user` 目录，安装依赖（如果未安装）并在后台启动本地 Next.js 开发服务器（带热重载）。
   * **启动 Desktop 客户端**：自动进入 `desktop` 目录，安装依赖并在前台启动 Electron 桌面应用（带热重载）。
   * **优雅退出**：当你关闭 Electron 窗口或在终端按 `Ctrl + C` 时，脚本会自动关闭本地的 Next.js 服务。

3. **注意**：为了下次启动更迅速，`dev.sh` 退出时**会故意保持 Docker 中的 Postgres 和 API 容器在后台运行**。如果你想彻底关闭它们，只需运行：
   ```bash
   docker compose down
   ```

---

## 4. 生产/打包模式启动

如果你只想运行体验，不需要修改前端或桌面端代码，可以使用 [start.sh](file:///Users/xianzhezhang/Projects/Auto%20Job%20Apply/Auto_job_applier_linkedIn/start.sh)：
```bash
./start.sh
```
* 它会通过 Docker Compose 启动 **全部** 服务（包括前端）。
* 然后在本地拉起 Electron 桌面端。
* 退出时，它会自动运行 `docker compose down` 彻底清理所有容器。

---

## 5. 服务与端口对照表

| 服务名称 | 启动方式 (开发模式) | 访问地址/端口 | 作用 |
| :--- | :--- | :--- | :--- |
| **Postgres** | Docker 容器 (`postgres`) | `localhost:55432` | 数据库，数据持久化保存在 `postgres_data` 卷中 |
| **API** | Docker 容器 (`api`) | `localhost:8000` | FastAPI Python 后端 service |
| **Frontend** | 本地 Node.js (`npm run dev`) | `localhost:3000` | Next.js 网页控制台（热重载） |
| **Desktop** | 本地 Electron (`npm run dev`) | 独立客户端窗口 | 桌面应用程序（自动连接前端与后端） |

---

## 6. 常见问题与排查 (FAQ)

### ❓ 为什么我修改了前端代码，在 Desktop 窗口里看不到实时更新（热重载失效）？

这通常是因为 **端口冲突** 导致的，最常见的情况如下：

1. **Docker `user` 容器占用了 3000 端口**：
   如果你在 Docker 中启动了 `user` 容器（占用了 `localhost:3000`），此时当你运行 `./dev.sh` 时，本地主机的 `npm run dev` 会发现 3000 端口被占用了，于是 Next.js 会**自动切换到 3001 端口**启动。
2. **Desktop 连错了端口**：
   但此时 Desktop 仍然在访问 `localhost:3000`（即 Docker 容器里的旧代码）。因此，你修改本地代码时，Desktop 里的页面完全没有变化，因为你看到的是 Docker 容器里的静态版本！

**解决方案**：
* 确保 Docker 中**没有任何 `user` 容器在运行**（端口 3000 应该留给本地开发服务器）。
* 重新运行 `./dev.sh`，确保控制台输出中 Next.js 成功在 `http://localhost:3000` 启动。
* 这样 Desktop 就能正常加载本地的 Next.js 服务，并且修改代码后，Desktop 窗口里会**立即自动更新**，无需重启 Desktop。

