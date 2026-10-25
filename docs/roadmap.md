# Taya 定位与路线图（v0.1 草案，2026-10-25）

## 定位

Taya 是运行在用户自己机器上的**本地、透明、可控的工程执行层**——"Herdr 里的开源工程团队"。云端编排者（Grok Bot / 幕僚长）只负责**派发任务和验收结果**；Taya 在本机 Herdr pane 中用真实的 coding harness（pi、Grok Build、Claude Code…）跑 `implement → review → submit → ci → merge` 闭环，每一步都在 Workboard 卡片上可见、可接管。Taya 的价值不是"更聪明的助手"，而是**看得见、能插手、可度量**的本地执行。

## 非目标

- 不做通用个人助手（日程、邮件、闲聊、调研由 Grok Bot 负责）。
- 不做云端托管 / 多机调度；单机、单用户、单 Herdr session。
- 不自建模型登录或凭据存储（仍归 harness 与 `gh`）。
- 不追求无人值守的新需求决策：新颖/有歧义的任务只上报，不自主拍板（沿用 product-spec 的 Bounded autonomy）。
- 本阶段不做 multi-repo 任务、stacked MR、偏好自动学习。

## 现状盘点

| 仓库 | 已有 | 缺口 |
| --- | --- | --- |
| **taya**（TS/Node 22，npm，~1.2k 行 src，8 个测试文件/30 tests；PR #1–#10 全部已合并，最后合并 2026-08-29） | CLI：`taya init / doctor / workdir add / agent / scheduler`；`~/.taya` 配置；prompt-template/skill 按名合并（用户覆盖优先）；`pick.md`（默认源 `gh issue list`，To-Do 上限 5）；Agent Profiles：executor / reviewer / architect / coder / qa；workflow `coding-small.yaml`（默认）与 `coding-standard.yaml`；`TAYA-MSG` 单行 JSON 协议 + messenger；HerdrClient / WorkboardClient；scheduler 每 300s 发 `pick.check`；skills `taya-delegation`、`taya-herdr-communication` | 无对外任务入口（只能在 assistant pane 里人工下达或 Pick）；Running-capacity 准入未定义（spec 明确 open）；harness 只支持 pi；Provider 只设计未完整实现（`gh`/`bitscli`）；无结果报告格式、无指标；Taya Server 尚是概念（scheduler 是唯一常驻进程）；GitHub 上 0 个 issue → Pick 默认源无活可干；工作区有未跟踪 `.taya/`（PR #10 review 残留） |
| **herdr-bot**（TS/bun，~4.2k 行含测试，Herdr plugin `phoobobo.herdr-bot` v0.1.0，最后提交 2026-09-03，已推送） | overlay TUI（bots 侧栏 + #channel + 1:1 DM + composer）；默认四人 幕僚长/研发工程师/研究员/测试工程师（lead/eng/research/qa，body=pi）；每 bot 一个 tab，`work` / `instant-msg` / `channel` 三 pane；`#standup` 共享频道；`herdr-bots` CLI（bots/channel/bodies，`--json` 为 QA 面）；`bodies list` 已能枚举 pi/claude/codex/grok 等 integration；plugin actions 7 个 + `tui` pane | 两个遗留问题：① TUI 回写需与 pane 文本逐字一致（`90d60d1`、`aa1d989` 已做"全文回写/去 Pi 边框"，但未验收）；② 安装文档入口须是 keybinding `plugin_action`（`74cb1ed` 已改主段，但 README 仍保留大段 PATH dispatcher/zshrc 内容，`bin/herdr` 仍在仓库）；与 Taya 无任何代码联系（不认识 Workboard、TAYA-MSG、workflow）；GitHub 无 issue/PR |
| **herdr-workboard**（bun，Herdr plugin） | Board=Workspace、Column=Tab、Card=Pane；workspace-scoped 机器 CLI（task/workflow/transition/run，JSON 输出）；`attach` action | 开放 PR #4「tab grouping strategy: state or agent role」未合并；无 card 级耗时/状态历史导出（Phase 3 指标需要） |

## 路线图

规模：S ≈ 1–2 天，M ≈ 3–5 天，L ≈ 1–2 周（按单个工程 bot 估算）。

### Phase 0 — 合并与清理（M）

| # | 交付物 | Owner | 验收标准（QA 可测） | 规模 |
|---|---|---|---|---|
| 0.1 | 完成 herdr-bot 回写：TUI 存储的回复 == pane 中 assistant 全文（多行、wrap、中文、代码块） | 研发 | 对 4 个 bot 各发 3 条含换行/代码块/长中文的消息：`herdr-bots` store 中 reply 与 `herdr agent read` 去除 thinking/footer 后逐字相等；新增回归测试覆盖 wrap 与 frame chrome | S |
| 0.2 | 安装文档改为 keybinding 为唯一用户入口；PATH dispatcher/zsh 内容移到 `docs/local-dev.md` | 研发 | 干净机器按 README 执行 `herdr plugin install` + 绑定 `phoobobo.herdr-bot.bots` 即可打开 overlay；README 中不再出现 `export PATH=…/bin` | S |
| 0.3 | 按决策 D1 将 herdr-bot 并入 Taya（默认建议：monorepo `packages/taya-cli`、`packages/herdr-bot`，herdr-bot 保留为独立可安装 plugin；保留 git 历史） | 研发 | `npm test`/`bun test` 在新结构下全绿；`herdr plugin install Phoobobo/taya`（或子路径）可装；`taya doctor` 能检测 herdr-bot plugin | M |
| 0.4 | 统一角色：herdr-bot 的 研发工程师/测试工程师 = Taya 的 executor/reviewer profile；幕僚长 = Taya assistant | 研发 | `herdr-bots bots list --json` 每个 bot 带 `profile` 字段且能解析到 `resources/agents/*`；原四人 gate 测试仍通过 | S |
| 0.5 | 清理：处理未跟踪 `.taya/`、决定 workboard PR #4、更新 product-spec 到新定位 | 研发 | `git status` 干净；spec 首段与本文定位一致 | S |

### Phase 1 — 任务入口与派发（L）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 1.1 | **Task Spec v1**（`taya-task.yaml`）：`id, repo/workdir, goal, acceptance[], workflow(coding-small), harness, priority, source, report_to` | 研发 | JSON Schema 入库；非法文件被 `taya task validate` 拒绝并返回稳定错误码 | S |
| 1.2 | 三种入口，全部落到同一 Task Spec：`taya task submit <file>`；目录投递 `~/.taya/inbox/*.yaml`；GitHub issue label `taya:ready`（由 Pick 读取） | 研发 | 三种入口各提交 1 个任务 → Workboard To-Do 各出现 1 张卡，body 含 `Source:`；重复提交幂等（同 id 不重复建卡） | M |
| 1.3 | Running-capacity 准入：To-Do 卡按容量自动建 workspace/worktree 并启动 executor（补上 spec 的 open question） | 研发 | `running_capacity=2` 时投 3 个任务：同时运行恰好 2 个，第 1 个完成后第 3 个在一个 tick 内启动 | M |
| 1.4 | **Result Report v1**：任务终态写 `~/.taya/reports/<id>.json`（status merged/failed/cancelled/needs_decision、PR url、commits、review 轮数、耗时、blocker 摘要）并按 `report_to` 回帖（issue 评论 / 文件） | 研发 | 每个终态任务都有合法 report；`needs_decision` 任务在 issue 上出现评论且卡片停在 blocked | M |
| 1.5 | 编排者接入说明：Grok Bot 通过 GitHub issue label（远程、无需开端口）派发、读 report 验收 | 研发 + 测试 | 端到端：在 GitHub 新建带 `taya:ready` 的小 issue → 无人工干预得到合并 PR + issue 评论报告 | S |

### Phase 2 — 可插拔 Worker Harness（M–L）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 2.1 | `Harness` 接口：`start(pane, profile, prompt)`、`send(msg)`、`status()`、`readTranscript()`、`stop()`；pi 实现为第一个 adapter（行为不变） | 研发 | 现有测试全绿；pi 路径行为与重构前一致 | M |
| 2.2 | Grok Build adapter：交互用 `grok agent stdio`（ACP），无人值守用 `grok -p` headless，输出 tail 到只读 pane | 研发 | 同一 Task Spec `harness: grok` 跑通 coding-small 到 merged | M |
| 2.3 | Claude Code adapter（复用 Herdr integration `claude`） | 研发 | 同上，`harness: claude` 到 merged | S |
| 2.4 | 按任务/按角色选择：Task Spec `harness`，profile 默认值，`~/.taya/config.yaml` 全局默认；`taya doctor` 列出可用 harness（复用 herdr-bot `bodies list` 逻辑） | 研发 | executor=grok、reviewer=pi 的混搭任务可完成；未安装的 harness 被 doctor 标记且任务被拒绝并给出原因 | S |
| 2.5 | 跨 harness 回归矩阵 | 测试 | 3 harness × 2 个固定样例任务的矩阵报告入库 | S |

### Phase 3 — 可度量的自主 PR 闭环（M）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 3.1 | 每日 Pick：scheduler 支持 cron 式（如每天 09:00 CST）从 backlog（label `taya:ready`）挑 ≤N 个任务 | 研发 | 设定时间触发一次 pick；无合格 issue 时只记录"无活"不建卡 | S |
| 3.2 | 事件日志 `~/.taya/metrics/events.jsonl`（每次 stage transition、review 结果、CI 结果带时间戳） | 研发 | 每个任务的事件序列可从日志完整重放其 Workboard 轨迹 | S |
| 3.3 | `taya metrics [--since 7d] [--json]`：**merge rate**（merged / 已终态）、**rework rate**（出现 `review.changes_requested` 或 `ci.failed` 的任务占比、平均返工轮数）、**cycle time**（admit→merged 的 p50/p90）、人工介入次数 | 研发 | 用固定的样例 events.jsonl 计算结果与手算一致（测试用 fixture） | S |
| 3.4 | 周报：将 metrics 写入 report 并可被 Grok Bot 拉取 | 研发 | `taya metrics --json` 字段稳定、有 schema | S |
| 3.5 | 两周试运行：在 taya 仓库本身投放 ≥10 个小 issue | 测试 | 产出试运行报告；目标线（待用户确认）：merge rate ≥ 70%，平均返工 ≤ 1 轮，p50 cycle time ≤ 4h | M |

## 关键决策 / 待用户确认

- **D1 仓库合并方式**：(a) monorepo（`Phoobobo/taya` 下 `packages/*`，herdr-bot 历史用 subtree 导入）；(b) herdr-bot 保持独立仓库，作为 Taya 的 UI 依赖包；(c) herdr-bot 代码直接并入 taya 单包。建议 (a)。附带问题：运行时统一 Node 还是 bun（taya 用 Node/npm，herdr-bot 与 workboard 用 bun）。
- **D2 herdr-workboard** 是否也并入 monorepo，还是保持独立 plugin？
- **D3 Herdr session 拓扑**：herdr-bot 绑定 `default` session，Taya 用 `taya` session——合并后统一为哪个？
- **D4 编排者派发通道**：首选 GitHub issue label，还是还需要本地 inbox 目录 / HTTP 端点？Grok Bot 通过什么身份在 issue 上发/收？
- **D5 合并权限**：自主闭环是否允许 Taya 自动 merge，还是 merge 前必须由编排者/用户验收？
- **D6 默认 harness**：executor/reviewer 默认用哪个（pi / Grok Build / Claude Code）？是否要求 reviewer 与 executor 用不同 harness 以提高独立性？
- **D7 Phase 3 指标目标线**与试运行目标仓库（只在 taya 自身，还是包括其他仓库）。
- **D8** 是否保留 `coding-standard.yaml`（architect/coder/qa）与 Advisor 设计，还是在新定位下暂时冻结。
