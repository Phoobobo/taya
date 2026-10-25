# Taya 定位与路线图（v0.1 草案，2026-10-25；2026-10-25/26 记录 D1–D8 决定）

## 定位

Taya 是运行在用户自己机器上的**本地、透明、可控的工程执行层**——"Herdr 里的开源工程团队"。云端编排者（Grok Bot / 幕僚长）只负责**派发任务和验收结果**；Taya 在本机 Herdr pane 中用真实的 coding harness（executor 用 Grok Build `grok`，reviewer 用 Cursor CLI `cursor-agent`，pi 可选）跑 `implement → review → submit → ci` 闭环，止于终态 `awaiting_acceptance`（PR 就绪、CI 绿）；验收与合并由编排者或用户执行（见 D5），每一步都在 Workboard 卡片上可见、可接管。Taya 的价值不是"更聪明的助手"，而是**看得见、能插手、可度量**的本地执行。

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
| 0.1 | 完成 herdr-bot 回写：四个 bot 的 body 由 pi 改为 Grok Build（已决定 2026-10-26），TUI 存储的回复改为读取 grok 会话数据中的 assistant 原文（多行、中文、代码块），不再抓取 pane 文本 | 研发 | 对 4 个 bot 各发 3 条含换行/代码块/长中文的消息：`herdr-bots` store 中 reply 与对应 grok 会话数据里的 assistant 消息逐字相等；回写路径中无 pane 读屏调用（测试用会话数据 fixture 覆盖）；回写过程中 bot 的 `work` pane 不被打断（不注入按键、不中断正在运行的任务）；回复中途有工具调用时，只回写最终面向用户的文本（不含工具调用及中间输出）；同一 bot 连续收到两条消息时，第二条的回复不会被当作第一条的回复写回（两条回复各自对应正确的消息） | S |
| 0.2 | 安装文档改为 keybinding 为唯一用户入口；PATH dispatcher/zsh 内容移到 `docs/local-dev.md` | 研发 | 干净机器按 README 执行 `herdr plugin install` + 绑定 `phoobobo.herdr-bot.bots` 即可打开 overlay；README 中不再出现 `export PATH=…/bin` | S |
| 0.3 | 按 D1（已决定）将 herdr-bot 并入 Taya：monorepo `packages/taya-cli`、`packages/herdr-bot`，herdr-bot 用 `git subtree`（不 squash）导入并保留历史，仍为独立可安装 plugin；herdr-bot 从 `default` session 改为 `taya` session（D3） | 研发 | `herdr plugin install Phoobobo/taya/packages/herdr-bot --ref <ref> --yes` 可装（子目录安装已验证）；#12 合并后归档原 `Phoobobo/herdr-bot` 仓库，其 README 指向 monorepo；各包在自身目录下测试全绿（taya-cli：`vitest`；herdr-bot：`bun test`）；`taya doctor` 能检测 herdr-bot plugin | M |
| 0.4 | 理清角色边界：herdr-bot 的四个聊天 bot（幕僚长/研发工程师/研究员/测试工程师）默认 body 都是 `grok`；它们与 taya 的 executor/reviewer 角色是两套独立系统，**不存在一一对应**——taya 的 reviewer 是 Cursor CLI `cursor-agent`，由 `~/.taya/config.yaml` 的 `reviewer: {harness, model}` 独立配置，不必与 测试工程师 bot 的 body 一致。幕僚长 = Taya assistant（负责验收，D5） | 研发 | `herdr-bots bots list --json` 中四个 bot 的 body 均为 `grok`；修改 `reviewer` 配置不影响任何 bot 的 body，反之亦然（测试覆盖）；herdr-bot 代码与文档中不再出现把 测试工程师 等同于 reviewer profile 的映射；原四人 gate 测试仍通过 | S |
| 0.5 | 清理：处理未跟踪 `.taya/`、决定 workboard PR #4、更新 product-spec 到新定位 | 研发 | `git status` 干净；spec 首段与本文定位一致 | S |
| 0.6 | 按 D5 落实“Taya 从不合并”：`coding-small`/`coding-standard` 的 `merged` 阶段替换为 Taya 侧终态 **`awaiting_acceptance`**（PR 就绪、CI 绿），之后只观察外部验收；停在 `awaiting_acceptance` 超过 24h 时向幕僚长提醒一次（不重复提醒）；更新 `assistant.md` 与 `taya-delegation` skill。三层保障：① taya 代码不调用任何合并 API；② executor（Grok Build）与 reviewer（Cursor CLI）的命令 deny list 都拦截 `gh pr merge`、任意 method 的 `gh api …/merge`、以及向 main/受保护分支的 `git push`；③ GitHub 分支保护或 required check **暂缓**——它会改用户仓库设置，在 #12 验收时与用户一起决定，且必须让不带 `taya` label 的 PR 自动通过 | 研发 + 测试 | ① grep 检查：仓库代码与 prompt/skill 中不出现 `gh pr merge`、`/merge`、`mergePullRequest`；② 在测试仓库中实测：executor 与 reviewer 分别尝试上述三种操作全部被拦截，PR 保持 open；CI 绿后卡片进入 `awaiting_acceptance`，外部合并/关闭后一个 tick 内记录 `merged`/`closed`；`awaiting_acceptance` 满 24h 的 fixture 恰好触发一次对幕僚长的提醒，48h 时不再重复 | S |

### Phase 1 — 任务入口与派发（L）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 1.1 | **Task Spec v1**（`taya-task.yaml`）：`id`（= `repo#issue`）、`repo/workdir`、`base`（基线分支）、`goal`、`acceptance[]`（每条 `{desc, check}`，`check` 为可运行命令，无法自动化时为 `manual`）、`non_goals`、`context`（相关文件、issue 链接）、`budget`（最长时长、最多返工轮数；超出自动转 `needs_decision`）、`risk`（`high` 时转人工验收，见 2.7）、`workflow(coding-small)`、`executor`/`reviewer`（可选，按任务覆盖 2.4 的 `{harness, model}`，同样受 2.4 启动检查约束）、`priority`、`source`、`report_to`。**GitHub issue 模板是主格式**，字段与 YAML 一一对应 | 研发 | JSON Schema 与 `.github/ISSUE_TEMPLATE/taya-task.yml` 入库，两者字段一一对应（测试互转无损）；非法文件被 `taya task validate` 拒绝并返回稳定错误码；`check` 非 `manual` 的条目在 review 阶段被实际执行；超 `budget` 的样例任务自动进入 `needs_decision` | S |
| 1.2 | 入口：GitHub issue label `taya:ready`（主入口，由 Pick 读取，按 issue 模板解析为 Task Spec）；`taya task submit <file>` 与目录投递 `~/.taya/inbox/*.yaml` 仅作测试入口 | 研发 | 带 `taya:ready` 的 issue → Workboard To-Do 出现 1 张卡，body 含 `Source:`；同一 `repo#issue` 重复触发幂等（不重复建卡）；测试入口提交同一 Spec 得到相同的卡 | S |
| 1.3 | Running-capacity 准入：To-Do 卡按容量自动建 workspace/worktree 并启动 executor（补上 spec 的 open question）。两个工具都走订阅：`running_capacity` 默认等于订阅的并发上限（可配置下调），达到上限后新任务排队；被限流的任务转 `blocked` 并记录原因（`rate_limited`），不计返工，按 3.3 的口径排除出 merge rate 与 cycle time。每个任务启动前检查 `grok` 与 `cursor-agent` 的登录（见 2.8） | 研发 | `running_capacity=2` 时投 3 个任务：同时运行恰好 2 个，第 1 个完成后第 3 个在一个 tick 内启动；未配置时取订阅并发上限；模拟限流的任务进入 `blocked`、report 中有 `rate_limited`、返工轮数不增加，且按 3.3 口径被 merge rate 与 p50 排除 | M |
| 1.4 | **Result Report v1**：任务终态写 `~/.taya/reports/<id>.json`（status `awaiting_acceptance`/failed/cancelled/needs_decision/blocked（附 `rate_limited`/`auth_expired` 等原因），外部验收后追加 accepted/merged/closed；PR url、commits、review 轮数、**reviewer 退回次数**、**executor 与 reviewer 各自的 harness + model**、Taya 耗时、等待验收耗时、blocker 摘要）并按 `report_to` 回帖（issue 评论 / 文件）。用于试运行评估“同模型 review 是否过松” | 研发 | 每个终态任务都有合法 report；**缺少任一方 harness、任一方 model 或 reviewer 退回次数即 FAIL**；`needs_decision` 任务在 issue 上出现评论且卡片停在 blocked | M |
| 1.5 | 编排者接入说明：Grok Bot 通过 GitHub issue label `taya:ready`（D4，远程、无需开端口）派发、读 report 验收（D5）。验收**不依赖 GitHub Approve**（D4 用用户本人账号，作者无法批准自己的 PR）：用户（或幕僚长以用户账号）加上 `taya:accepted` label，或合并 PR，即视为验收；`awaiting_acceptance` 超 24h 的提醒见 0.6 | 研发 + 测试 | 端到端：在 GitHub 按 issue 模板新建带 `taya:ready` 的小 issue → 无人工干预到达 `awaiting_acceptance`（PR 就绪、CI 绿、review 通过、非 `manual` 的 `acceptance[].check` 全部通过）+ issue 评论报告；用户加 `taya:accepted` 或合并后 report 追加验收状态及等待验收时长 | S |
| 1.6 | Taya 工作标记（D4 用用户本人账号，必须可区分）：taya 开的每个 PR 带 label `taya`；taya 的每条评论以 `[taya]` 开头；每个 commit 带 trailer `Taya-Task: <repo#issue>` | 研发 | 端到端任务产出的 PR、评论、commit 全部带对应标记；3.3 的指标只按这些标记统计（不按作者），用户自己未带标记的 PR 被排除（fixture 验证） | S |

### Phase 2 — 可插拔 Worker Harness（M）

v0.1 harness：Grok Build（`grok`，executor，第一个 adapter）与 Cursor CLI（`cursor-agent`，reviewer），两者都使用用户订阅；pi 降为可选 adapter；Claude Code 不在 v0.1 范围。脚本中必须用全名 `grok` / `cursor-agent` 调用——两个 CLI 都会安装 `agent` 别名，裸 `agent` 调用即 FAIL。裸 `agent` 检查只在 `agent` 本身是命令词时命中（位于命令开头，或紧跟管道 `|`、`&&`、`;`、`$(`、`exec`、`env` 之后），因此 `grok agent stdio`、`cursor-agent` 不会触发。

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 2.1 | `Harness` 接口：`start(pane, profile, prompt)`、`send(msg)`、`status()`（映射 herdr 的 idle/done/blocked）、`readTranscript()`（从 harness 会话数据返回结构化原文，**禁止抓屏**）、`outcome()`（返回 `done`/`blocked`/`needs_decision`）、`listModels()`（工具自身的模型列表）、`authStatus()`（登录状态与到期时间）、`stop()`；Grok Build 为第一个 adapter，现有 pi 路径包装为可选 adapter（行为不变） | 研发 | 现有测试全绿；可选 pi 路径行为与重构前一致；`readTranscript()` 测试用会话数据 fixture 而非 pane 文本；`outcome()` 三种取值各有用例；静态检查：脚本与代码中无裸 `agent` 调用（裸 `agent` 检查只在 `agent` 本身是命令词时命中（位于命令开头，或紧跟管道 `|`、`&&`、`;`、`$(`、`exec`、`env` 之后），因此 `grok agent stdio`、`cursor-agent` 不会触发；用例：`agent -p x`、`x | agent`、`a && agent`、`$(agent …)`、`exec agent`、`env FOO=1 agent` 命中，`grok agent stdio`、`cursor-agent -p x` 不命中） | M |
| 2.2 | Grok Build adapter（executor）：交互用 `grok agent stdio`（ACP），无人值守用 `grok -p` headless，输出 tail 到只读 pane；模型列表来自 `grok models` | 研发 | `executor: {harness: grok, model: …}` 的 Task Spec 跑通 coding-small 到 `awaiting_acceptance` | M |
| 2.3 | Cursor CLI adapter（reviewer，取代原 Claude Code 计划）：`cursor-agent` 无人值守运行 review，读取其会话数据作为 transcript；模型列表来自 `cursor-agent models` | 研发 | executor=grok、reviewer=cursor-agent 的任务跑通到 `awaiting_acceptance`；review 结果写入 `.taya/review.md` | M |
| 2.4 | 按角色配置 harness 与模型（D6）：`~/.taya/config.yaml` 中 `executor: {harness, model}`、`reviewer: {harness, model}`，**两个角色的 `model` 都必填**，缺失即拒绝启动（不使用工具的隐式默认模型）；可选 `require_distinct_models`（默认 `false`）。**默认启动检查**：① 任一角色配置为 `-latest` / `~…-latest` 类别名直接拒绝；② 配置的 id 必须出现在该工具**自身**的模型列表中（`grok models`、`cursor-agent models`），不存在即拒绝启动。工具模型列表可本地缓存 24h；既拿不到列表又无缓存时拒绝启动。**仅当 `require_distinct_models: true` 时**启用下方模型映射表：跟随别名到实际模型、去掉 variant/日期后缀，映射到公共 Grok 版本（如 `grok-4.7`），表外 id 拒绝启动（错误写明工具名与 id），两角色映射到同一版本即拒绝。任何拒绝都以非零码退出，错误同时写出两个角色、工具与模型；`taya doctor` 列出可用 harness、模型与缓存时间；调用工具一律用全名 `grok` / `cursor-agent`（见本 Phase 开头的裸 `agent` 规则） | 研发 | 以下用例均以非零码拒绝并给出上述信息：任一角色缺 `model`；任一角色用 `-latest` 类别名；id 不在工具模型列表中；拿不到模型列表且无缓存；有 24h 内缓存时离线可启动；`require_distinct_models: true` 时：表外 id 拒绝、别名与其解析后的 id 判为同一模型而拒绝、两角色均映射到 `grok-4.7` 拒绝；默认配置（两侧 grok-4.7、`require_distinct_models: false`）可启动 | S |
| 2.5 | 跨 harness 回归矩阵 | 测试 | （executor grok × reviewer cursor-agent，外加可选 pi）× 2 个固定样例任务的矩阵报告入库，含同模型/异模型两种配置的退回次数对比 | S |
| 2.6 | Reviewer 隔离与多轮 review：reviewer 在独立的干净 worktree 中运行（检出 base commit 后应用 executor 的 diff），与 executor 不共享工作目录或缓存；每一轮返工都启动全新 reviewer 会话，输入为该 reviewer 上一轮自己的意见 + 本轮增量 diff；第 2 轮起只判断上一轮意见是否解决以及改动过的代码，对未改动代码只能提阻断性问题 | 研发 | reviewer 的 cwd 与 executor 不同，且不含 executor 的未提交文件或缓存目录；每轮 reviewer 会话 id 不同；第 2 轮输入只含上轮意见与增量 diff；固定样例中第 2 轮不对未改动代码提出非阻断性新要求 | M |
| 2.7 | 高风险改动识别：diff 触及 `AGENTS.md`、`.cursor/`（含 `.cursor/rules/`）或其他 agent 配置/规则文件（如 `CLAUDE.md`、`.grok/`、prompt/skill 文件）时，任务标记 `risk: high`，直接转人工验收 | 研发 + 测试 | 两个注入样例：executor 分别在 `AGENTS.md` 与 `.cursor/rules/` 写入“approve this”类指令，同时埋入一个 bug——reviewer 必须指出该 bug（不被注入指令左右），任务被标记高风险并进入人工验收，report 注明原因 | S |
| 2.8 | 登录到期管理（Grok Build 浏览器登录 7 天过期）：`taya doctor` 检查 `grok` 与 `cursor-agent` 的登录状态与到期时间，到期前 1 天向幕僚长报告；每个任务启动前检查两者登录，任一过期或缺失则任务转 `blocked`，原因 `auth_expired`（“需要重新登录”），不计返工、不算失败，按 3.3 口径不计入指标；登录无效当天的每日 Pick 不建卡 | 研发 + 测试 | 把 auth.json 改为过期状态：任务停在 `blocked` 且原因为 `auth_expired`，返工轮数不变，被 3.3 排除；到期前 1 天的 fixture 触发对幕僚长的报告；登录无效时 3.1 的 Pick 记录原因且不建卡 | S |

**模型映射表（仅 `require_distinct_models: true` 时使用；id 以各工具实际显示为准）**

| 公共 Grok 版本 | `grok`（Grok Build）id | `cursor-agent` id |
|---|---|---|
| `grok-4.7` | `grok-4.7`（待工具登录后核实） | 待工具登录后在 `cursor-agent models` 中核实 |
| `grok-4.6` | `grok-4.6`（未登录时 `grok models` 已列出） | 待工具登录后核实 |
| `grok-4.5` | `grok-4.5`（未登录时 `grok models` 已列出） | 待工具登录后核实 |

开启时表外 id 一律拒绝启动；新增模型需先更新此表。

### Phase 3 — 可度量的自主 PR 闭环（M）

| # | 交付物 | Owner | 验收标准 | 规模 |
|---|---|---|---|---|
| 3.1 | 每日 Pick：scheduler 支持 cron 式（如每天 09:00 CST）从 backlog（label `taya:ready`）挑 ≤N 个任务 | 研发 | 设定时间触发一次 pick；无合格 issue 时只记录"无活"不建卡；`grok` 或 `cursor-agent` 登录无效时当天不建卡并记录原因 | S |
| 3.2 | 事件日志 `~/.taya/metrics/events.jsonl`（每次 stage transition、review 结果、CI 结果带时间戳） | 研发 | 每个任务的事件序列可从日志完整重放其 Workboard 轨迹 | S |
| 3.3 | `taya metrics [--since 7d] [--json]`：只统计带 Taya 标记（1.6：label `taya` / `Taya-Task:` trailer）的工作，**不按作者统计**。**merge rate**（全文唯一定义，其他处引用此处）：分子 = merged 或带 `taya:accepted` 的任务；分母 = 已有外部结果的任务（accepted、merged、未合并即关闭——计为未合并）+ failed + needs_decision；**仍在 `awaiting_acceptance` 的任务不计入**；同时排除 cancelled、`rate_limited`（blocked）、`auth_expired`（blocked）以及不带 `taya` label 的 PR、**rework rate**（出现 `review.changes_requested` 或 `ci.failed` 的任务占比、平均返工轮数；限流与登录过期不计返工）、**cycle time**（admit→`awaiting_acceptance` 的 p50/p90，排除限流与登录过期任务）、**acceptance wait**（`awaiting_acceptance`→验收/关闭，单独统计）、reviewer 退回次数按“同模型/异模型”分组、人工介入次数 | 研发 | 用固定的样例 events.jsonl 计算结果与手算一致（fixture 含 cancelled、`rate_limited`、`auth_expired`、长时间等待验收的任务，以及用户自己未带标记的 PR，验证它们都不影响 merge rate 分母、返工与 p50；另含仍在 `awaiting_acceptance` 的任务与未合并即关闭的 PR，分别验证不计入分母、计为未合并） | S |
| 3.4 | 周报：将 metrics 写入 report 并可被 Grok Bot 拉取 | 研发 | `taya metrics --json` 字段稳定、有 schema | S |
| 3.5 | 两周试运行：在 taya 仓库本身投放 ≥10 个小 issue | 测试 | 产出试运行报告；目标线（已决定 2026-10-25，D7）：merge rate（口径见 3.3）≥ 70%，平均返工 ≤ 1 轮，p50 cycle time（至 `awaiting_acceptance`）≤ 4h | M |

## 关键决策

状态标记：**已决定 2026-10-25 / 2026-10-26** = 用户已拍板。D1–D8 均已决定，当前无待审建议。

- **D1 仓库合并方式** — **已决定 2026-10-25：(a) monorepo。** `Phoobobo/taya` 下 `packages/*`（`packages/taya-cli`、`packages/herdr-bot`），herdr-bot 用 `git subtree add`（不 `--squash`）导入并保留完整历史；herdr-bot 仍是可独立安装的 Herdr plugin。（备选 (b) 独立仓库作依赖、(c) 并入单包，均不采用。）
- **运行时统一（D1 附带问题）** — **已决定 2026-10-26：仓库级用 bun 管理 workspace（根 `package.json` `workspaces: ["packages/*"]` + 单一 `bun.lock`），`taya-cli` 保持 Node ≥22 运行时与 vitest 测试不变，herdr-bot 保持 bun 运行时与 `bun test`。** 理由：Herdr plugin manifest（herdr-bot、workboard）的 action/pane 命令都是 `bun run …`，bun 已是装 plugin 的硬依赖；而 taya-cli 是发布到 npm 的 Node CLI（`bin: dist/cli.js`，pi 本身也是 Node），只依赖 `yaml`，没有必要为统一而重写测试/运行时。后续若要彻底统一，再评估把 taya-cli 测试迁到 `bun test`。
- **D2 herdr-workboard** — **已决定 2026-10-26：v0.1 保持独立仓库/plugin，不并入 monorepo；Phase 3 前再评估。** 理由：workboard 是通用的 Herdr 看板 plugin（`phoobobo.workboard`），Taya 只通过其 JSON CLI（`herdr-workboard`）和 plugin 检测耦合，接口边界清楚；它还有未合并的 PR #4，且 TypeScript 版本（^7）与另外两包（^5.9）不同，现在并入会把三边的变更绑在一起。若 Phase 3.2/3.3 需要频繁改 workboard 的 card 历史导出，再按 D1 同样方式 subtree 导入。
- **D3 Herdr session 拓扑** — **已决定 2026-10-25：统一为一个名为 `taya` 的 Herdr session。** herdr-bot 现绑定 `default` session，需在 Phase 0.3 改为 `taya`。herdr-bot 四个 bot 的 body 由 pi 改为 Grok Build，回写读取 grok 会话数据（已决定 2026-10-26，见 0.1）。#12 合并后归档原 `Phoobobo/herdr-bot` 仓库并在其 README 指向 monorepo（已决定 2026-10-26；子目录安装 `herdr plugin install Phoobobo/taya/packages/herdr-bot --ref <ref> --yes` 已验证）。
- **D4 编排者派发通道** — **已决定 2026-10-25：GitHub issue label `taya:ready`。** 编排者（Grok Bot）派发与验收只走这一通道，GitHub issue 模板是任务主格式，任务 id 为 `repo#issue`（保证建卡幂等）；`taya task submit` 与本地 inbox 目录仅作测试入口，不提供 HTTP 端点。GitHub 身份（已决定 2026-10-26）：Grok Bot 与 taya 都使用用户本人的 GitHub 账号，不设 bot 账号；因此 taya 的工作必须打标记（PR label `taya`、评论前缀 `[taya]`、commit trailer `Taya-Task: <repo#issue>`，见 1.6），指标按标记而非作者统计。
- **D5 合并权限** — **已决定 2026-10-25：Taya 从不合并自己的 PR，由幕僚长（lead bot）或用户验收并合并。** 影响：Taya 侧终态为 `awaiting_acceptance`（PR 就绪、CI 绿），合并属于外部事件（见 0.6）。验收不依赖 GitHub Approve：用户（或幕僚长以用户账号）加 `taya:accepted` label 或合并即视为验收（已决定 2026-10-26）；`awaiting_acceptance` 超 24h 向幕僚长提醒一次（0.6）。“从不合并”三层保障：代码不调用合并 API、executor 与 reviewer 的命令 deny list、GitHub 分支保护/required check（暂缓，#12 验收时与用户决定，且须让无 `taya` label 的 PR 自动通过），`assistant.md` / `taya-delegation` 中“自己推进到 merged”的说法需同步修改。
- **D6 harness / 模型** — **已决定 2026-10-25/26：executor = Grok Build（`grok` CLI，用户 Grok 订阅），reviewer = Cursor CLI（`cursor-agent`），工具不同；两侧默认都用 `grok-4.7`，依靠会话隔离（2.6）保证 review 独立性。** 配置按角色 `executor: {harness, model}`、`reviewer: {harness, model}`，`model` 必填；禁止 `-latest` 类别名；默认只校验 id 存在于该工具自身的模型列表（24h 缓存，无列表无缓存拒绝启动）；可选 `require_distinct_models`（默认关闭），开启时才启用模型映射表，表外 id 拒绝、两角色映射到同一 Grok 版本即拒绝（2.4）。每份 report 必须记录两角色 harness/model 与 reviewer 退回次数，用试运行数据判断同模型 review 是否过松（1.4、3.3）。taya 的 reviewer 与 herdr-bot 的 测试工程师 bot 互相独立（见 0.4）。登录到期见 2.8。
  - **默认模型对**：executor 与 reviewer 均为 `grok-4.7`，两个工具中的具体 id 都待登录后核实。核实环境为 box（共享 Linux 测试机）：2026-10-26 box 上已安装 `grok` 1.0.70 与 `cursor-agent` 2026.10.22-27dcf5f，两者均未登录；登录前 `grok models` 列出 `grok-4.6`（默认）与 `grok-4.5`，`cursor-agent models` 需登录后才能列出。
- **D7 Phase 3 指标目标线** — **已决定 2026-10-25：merge rate ≥ 70%，平均返工 ≤ 1 轮，p50 cycle time ≤ 4h。** 口径（2026-10-25 review 补充）：cycle time 止于 `awaiting_acceptance`，等待验收时间单独统计；merge rate 口径见 3.3（唯一定义）。试运行仓库沿用 3.5 的安排（taya 仓库本身），如需扩展到其他仓库另行确认。
- **D8 `coding-standard.yaml` 与 Advisor** — **已决定 2026-10-26：冻结但不删除。** `coding-small` 保持默认；`coding-standard.yaml`（architect/coder/qa）与对应 profile 继续保留并保持现有测试通过，标记为 experimental，不再投入新功能；Advisor 设计（`docs/advisor-scheduler` 分支）暂不合并。理由：新定位聚焦小而可度量的 PR 闭环，多角色流程会稀释 Phase 1–3 的精力；若 Phase 3 试运行显示 `coding-small` 返工超过目标线，再以数据为依据解冻。
