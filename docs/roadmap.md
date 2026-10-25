# Taya 定位与路线图（v0.1 草案，2026-10-25；2026-10-25 记录 D1/D3/D4/D5/D7 决定）

## 定位

Taya 是运行在用户自己机器上的**本地、透明、可控的工程执行层**——"Herdr 里的开源工程团队"。云端编排者（Grok Bot / 幕僚长）只负责**派发任务和验收结果**；Taya 在本机 Herdr pane 中用真实的 coding harness（pi、Grok Build、Claude Code…）跑 `implement → review → submit → ci` 闭环，止于终态 `awaiting_acceptance`（PR 就绪、CI 绿）；验收与合并由编排者或用户执行（见 D5），每一步都在 Workboard 卡片上可见、可接管。Taya 的价值不是"更聪明的助手"，而是**看得见、能插手、可度量**的本地执行。

## 非目标

- 不做通用个人助手（日程、邮件、闲聊、调研由 Grok Bot 负责）。
- 不做云端托管 / 多机调度；单机、单用户、单 Herdr session（名为 `taya`，见 D3）。
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
| 0.3 | 按 D1（已决定）将 herdr-bot 并入 Taya：monorepo `packages/taya-cli`、`packages/herdr-bot`，herdr-bot 用 `git subtree`（不 squash）导入并保留历史，仍为独立可安装 plugin；herdr-bot 从 `default` session 改为 `taya` session（D3） | 研发 | 各包在自身目录下测试全绿（taya-cli：`vitest`；herdr-bot：`bun test`）；`herdr plugin install Phoobobo/taya`（或子路径）可装；`taya doctor` 能检测 herdr-bot plugin | M |
| 0.4 | 统一角色：herdr-bot 的 研发工程师/测试工程师 = Taya 的 executor/reviewer profile；幕僚长 = Taya assistant（负责验收与合并，D5） | 研发 | `herdr-bots bots list --json` 每个 bot 带 `profile` 字段且能解析到 `resources/agents/*`；原四人 gate 测试仍通过 | S |
| 0.5 | 清理：处理未跟踪 `.taya/`、决定 workboard PR #4、更新 product-spec 到新定位 | 研发 | `git status` 干净；spec 首段与本文定位一致 | S |
| 0.6 | 按 D5 调整合并职责：`coding-small`/`coding-standard` 的 `merged` 阶段替换为 Taya 侧终态 **`awaiting_acceptance`**（PR 就绪、CI 绿）；之后 Taya 只观察 PR 被外部合并或关闭并记录；更新 `assistant.md` 与 `taya-delegation` skill 中“自己推进到 merged”的描述 | 研发 | Taya 任何角色都不执行 `gh pr merge`（测试断言 prompt/skill 中无合并指令）；CI 绿后卡片进入 `awaiting_acceptance`；PR 被外部合并/关闭后在一个 tick 内记录 `merged`/`closed` 事件 | S |

### Phase 1 — 任务入口与派发（L）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 1.1 | **Task Spec v1**（`taya-task.yaml`）：`id`（= `repo#issue`）、`repo/workdir`、`base`（基线分支）、`goal`、`acceptance[]`（每条 `{desc, check}`，`check` 为可运行命令，无法自动化时为 `manual`）、`non_goals`、`context`（相关文件、issue 链接）、`budget`（最长时长、最多返工轮数；超出自动转 `needs_decision`）、`risk`（决定是否需要人工 review）、`workflow(coding-small)`、`harness`、`priority`、`source`、`report_to`。**GitHub issue 模板是主格式**，字段与 YAML 一一对应 | 研发 | JSON Schema 与 `.github/ISSUE_TEMPLATE/taya-task.yml` 入库，两者字段一一对应（测试互转无损）；非法文件被 `taya task validate` 拒绝并返回稳定错误码；`check` 非 `manual` 的条目在 review 阶段被实际执行；超 `budget` 的样例任务自动进入 `needs_decision` | S |
| 1.2 | 入口：GitHub issue label `taya:ready`（主入口，由 Pick 读取，按 issue 模板解析为 Task Spec）；`taya task submit <file>` 与目录投递 `~/.taya/inbox/*.yaml` 仅作测试入口 | 研发 | 带 `taya:ready` 的 issue → Workboard To-Do 出现 1 张卡，body 含 `Source:`；同一 `repo#issue` 重复触发幂等（不重复建卡）；测试入口提交同一 Spec 得到相同的卡 | S |
| 1.3 | Running-capacity 准入：To-Do 卡按容量自动建 workspace/worktree 并启动 executor（补上 spec 的 open question） | 研发 | `running_capacity=2` 时投 3 个任务：同时运行恰好 2 个，第 1 个完成后第 3 个在一个 tick 内启动 | M |
| 1.4 | **Result Report v1**：任务终态写 `~/.taya/reports/<id>.json`（status `awaiting_acceptance`/failed/cancelled/needs_decision，外部合并后追加 merged/closed；PR url、commits、review 轮数、Taya 耗时、等待验收耗时、blocker 摘要）并按 `report_to` 回帖（issue 评论 / 文件） | 研发 | 每个终态任务都有合法 report；`needs_decision` 任务在 issue 上出现评论且卡片停在 blocked | M |
| 1.5 | 编排者接入说明：Grok Bot 通过 GitHub issue label `taya:ready`（D4，远程、无需开端口）派发、读 report 验收并合并（D5） | 研发 + 测试 | 端到端：在 GitHub 按 issue 模板新建带 `taya:ready` 的小 issue → 无人工干预到达 `awaiting_acceptance`（PR 就绪、CI 绿、review 通过、非 `manual` 的 `acceptance[].check` 全部通过）+ issue 评论报告；编排者合并后 report 追加 `merged` 及等待验收时长 | S |

### Phase 2 — 可插拔 Worker Harness（M）

首批只做 pi 与 Grok Build 两个 harness；Claude Code 等试运行数据再定。

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 2.1 | `Harness` 接口：`start(pane, profile, prompt)`、`send(msg)`、`status()`（映射 herdr 的 idle/done/blocked）、`readTranscript()`（从 harness 会话数据返回结构化原文，**禁止抓屏**）、`outcome()`（返回 `done`/`blocked`/`needs_decision`）、`stop()`；pi 实现为第一个 adapter（行为不变） | 研发 | 现有测试全绿；pi 路径行为与重构前一致；`readTranscript()` 测试用会话数据 fixture 而非 pane 文本；`outcome()` 三种取值各有用例 | M |
| 2.2 | Grok Build adapter：交互用 `grok agent stdio`（ACP），无人值守用 `grok -p` headless，输出 tail 到只读 pane | 研发 | 同一 Task Spec `harness: grok` 跑通 coding-small 到可合并 PR（CI 绿） | M |
| 2.3 | （暂缓）Claude Code adapter（复用 Herdr integration `claude`）：待 Phase 3 试运行数据决定是否做 | — | 不在 v0.1 范围 | — |
| 2.4 | 按角色配置 harness 与模型（D6）：`~/.taya/config.yaml` 中 `roles.executor.{harness, model}`、`roles.reviewer.{harness, model}`，Task Spec `harness` 可覆盖；装有多个 harness 时 reviewer 默认用与 executor 不同的 harness，只有一个时 reviewer 用同一 harness 的全新会话；**启动检查：`executor.model == reviewer.model` 时拒绝启动**；`taya doctor` 列出可用 harness（复用 herdr-bot `bodies list` 逻辑） | 研发 | executor=grok、reviewer=pi 的混搭任务可完成；只装一个 harness 时 reviewer 在新会话中以不同模型运行；executor 与 reviewer 模型相同的配置被 `taya doctor` 与启动流程拒绝并返回稳定错误码；未安装的 harness 被 doctor 标记且任务被拒绝并给出原因 | S |
| 2.5 | 跨 harness 回归矩阵 | 测试 | 2 harness（pi、Grok Build）× 2 个固定样例任务的矩阵报告入库 | S |

### Phase 3 — 可度量的自主 PR 闭环（M）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 3.1 | 每日 Pick：scheduler 支持 cron 式（如每天 09:00 CST）从 backlog（label `taya:ready`）挑 ≤N 个任务 | 研发 | 设定时间触发一次 pick；无合格 issue 时只记录"无活"不建卡 | S |
| 3.2 | 事件日志 `~/.taya/metrics/events.jsonl`（每次 stage transition、review 结果、CI 结果带时间戳） | 研发 | 每个任务的事件序列可从日志完整重放其 Workboard 轨迹 | S |
| 3.3 | `taya metrics [--since 7d] [--json]`：**merge rate**（merged / 已终态，**分母不含 cancelled**）、**rework rate**（出现 `review.changes_requested` 或 `ci.failed` 的任务占比、平均返工轮数）、**cycle time**（admit→`awaiting_acceptance` 的 p50/p90，Taya 自身耗时）、**acceptance wait**（`awaiting_acceptance`→merged/closed，单独统计、不计入 cycle time）、人工介入次数 | 研发 | 用固定的样例 events.jsonl 计算结果与手算一致（测试用 fixture，含 cancelled 任务与长时间等待验收的任务，验证二者不影响 merge rate 分母与 cycle time） | S |
| 3.4 | 周报：将 metrics 写入 report 并可被 Grok Bot 拉取 | 研发 | `taya metrics --json` 字段稳定、有 schema | S |
| 3.5 | 两周试运行：在 taya 仓库本身投放 ≥10 个小 issue | 测试 | 产出试运行报告；目标线（已决定 2026-10-25，D7）：merge rate ≥ 70%（不含 cancelled），平均返工 ≤ 1 轮，p50 cycle time（至 `awaiting_acceptance`）≤ 4h | M |

## 关键决策

状态标记：**已决定 2026-10-25** = 用户已拍板；**建议（待用户审）** = 依据本文与仓库现状给出的建议，尚未确认。

- **D1 仓库合并方式** — **已决定 2026-10-25：(a) monorepo。** `Phoobobo/taya` 下 `packages/*`（`packages/taya-cli`、`packages/herdr-bot`），herdr-bot 用 `git subtree add`（不 `--squash`）导入并保留完整历史；herdr-bot 仍是可独立安装的 Herdr plugin。（备选 (b) 独立仓库作依赖、(c) 并入单包，均不采用。）
- **运行时统一（D1 附带问题）** — **建议（待用户审）：仓库级用 bun 管理 workspace（根 `package.json` `workspaces: ["packages/*"]` + 单一 `bun.lock`），`taya-cli` 保持 Node ≥22 运行时与 vitest 测试不变，herdr-bot 保持 bun 运行时与 `bun test`。** 理由：Herdr plugin manifest（herdr-bot、workboard）的 action/pane 命令都是 `bun run …`，bun 已是装 plugin 的硬依赖；而 taya-cli 是发布到 npm 的 Node CLI（`bin: dist/cli.js`，pi 本身也是 Node），只依赖 `yaml`，没有必要为统一而重写测试/运行时。后续若要彻底统一，再评估把 taya-cli 测试迁到 `bun test`。
- **D2 herdr-workboard** — **建议（待用户审）：v0.1 保持独立仓库/plugin，不并入 monorepo；Phase 3 前再评估。** 理由：workboard 是通用的 Herdr 看板 plugin（`phoobobo.workboard`），Taya 只通过其 JSON CLI（`herdr-workboard`）和 plugin 检测耦合，接口边界清楚；它还有未合并的 PR #4，且 TypeScript 版本（^7）与另外两包（^5.9）不同，现在并入会把三边的变更绑在一起。若 Phase 3.2/3.3 需要频繁改 workboard 的 card 历史导出，再按 D1 同样方式 subtree 导入。
- **D3 Herdr session 拓扑** — **已决定 2026-10-25：统一为一个名为 `taya` 的 Herdr session。** herdr-bot 现绑定 `default` session，需在 Phase 0.3 改为 `taya`。
- **D4 编排者派发通道** — **已决定 2026-10-25：GitHub issue label `taya:ready`。** 编排者（Grok Bot）派发与验收只走这一通道，GitHub issue 模板是任务主格式，任务 id 为 `repo#issue`（保证建卡幂等）；`taya task submit` 与本地 inbox 目录仅作测试入口，不提供 HTTP 端点。仍待明确：Grok Bot 在 issue 上发/收所用的 GitHub 身份。
- **D5 合并权限** — **已决定 2026-10-25：Taya 从不合并自己的 PR，由幕僚长（lead bot）或用户验收并合并。** 影响：Taya 侧终态为 `awaiting_acceptance`（PR 就绪、CI 绿），合并属于外部事件（见 0.6），`assistant.md` / `taya-delegation` 中“自己推进到 merged”的说法需同步修改。
- **D6 默认 harness / 模型** — **已决定 2026-10-25：默认 reviewer 使用与 executor 不同的 harness；硬性要求：executor 与 reviewer 必须使用不同的模型。** 只装一个 harness 时，reviewer 可以是同一 harness 的全新会话，但模型仍须不同。实现见 2.4：按角色配置 `harness` 与 `model`，`executor.model == reviewer.model` 时拒绝启动。Phase 2 前只有 pi 一个 harness，因此 executor 与 reviewer 用 pi 的不同模型。
- **D7 Phase 3 指标目标线** — **已决定 2026-10-25：merge rate ≥ 70%，平均返工 ≤ 1 轮，p50 cycle time ≤ 4h。** 口径（2026-10-25 review 补充）：cycle time 止于 `awaiting_acceptance`，等待验收时间单独统计；merge rate 分母不含 cancelled。 试运行仓库沿用 3.5 的安排（taya 仓库本身），如需扩展到其他仓库另行确认。
- **D8 `coding-standard.yaml` 与 Advisor** — **建议（待用户审）：冻结但不删除。** `coding-small` 保持默认；`coding-standard.yaml`（architect/coder/qa）与对应 profile 继续保留并保持现有测试通过，标记为 experimental，不再投入新功能；Advisor 设计（`docs/advisor-scheduler` 分支）暂不合并。理由：新定位聚焦小而可度量的 PR 闭环，多角色流程会稀释 Phase 1–3 的精力；若 Phase 3 试运行显示 `coding-small` 返工超过目标线，再以数据为依据解冻。
