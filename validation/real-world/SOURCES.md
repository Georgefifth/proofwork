# 外部素材、权利与参考依据

检索和下载：2026-10-11 UTC。逐文件 URL、固定版本、字节数、SHA-256、下载时间和访问结果见 [manifest.json](manifest.json)，辅助基准代码见 [TOOL-MANIFEST.json](TOOL-MANIFEST.json)。无需账号或付费。15 个 PDF 均下载成功；13 个来自真实公开文档，2 个属于外部合成/脱敏测试素材。文件公开可访问不等于有任意再分发许可。原始文件、全文提取、参考页图片和包含全文的测试项目均保留在忽略目录，未提交 Git。

固定仓库版本：

- [Docling 测试素材](https://github.com/docling-project/docling/tree/21588f5261d0a5a051102356d9babb35e790f33e/tests/data/pdf)：`21588f5261d0a5a051102356d9babb35e790f33e`。代码 MIT；不能将代码许可自动套用于论文、手册或期刊 PDF。[上游端到端测试](https://github.com/docling-project/docling/blob/21588f5261d0a5a051102356d9babb35e790f33e/tests/test_e2e_conversion.py)使用生成的回归快照；`groundtruth` 目录名不是事实准确性的独立证明。
- [olmOCR 示例素材](https://github.com/allenai/olmocr/tree/f7cfe4c22098b154c76b6ec950d1c0a464eecf8d/olmocr/bench/sample_data)：`f7cfe4c22098b154c76b6ec950d1c0a464eecf8d`。代码 Apache-2.0。[官方数据集卡](https://huggingface.co/datasets/allenai/olmOCR-bench)注明 ODC-BY-1.0、研究/教育用途及 AI2 使用规范；不据此推断每个第三方页面都可任意重发布。此次使用仓库示例，不是下载并评测整个 HF benchmark。其 pipeline Markdown 是被测输入，JSONL 标签是参考材料，最终选中事实仍核对原页。
- [美国 Census 2012 Statistical Abstract 官方入口](https://cdn.www.census.gov/library/publications/2011/compendia/statab/131ed.html)与[完整 PDF](https://www2.census.gov/library/publications/2011/compendia/statab/131ed/2012-statab.pdf)：2012 第 131 版。[美国版权局说明](https://www.copyright.gov/history/copyright-exhibit/lifecycle/)中联邦政府作品与事实的版权边界不意味着第三方引用、图片都失去权利。本次不再分发该 PDF。

## 逐份测试用途和参考可靠性

所有 Docling 文件的下载路径为上述固定版本的 `tests/data/pdf/sources/{名称}.pdf`；配对输出为 `tests/data/pdf/groundtruth/{名称}.md` 和 `.json`。olmOCR 对应 `olmocr/bench/sample_data/pdfs/{名称}.pdf` 和 `olmocr_pipeline/{名称}_pg1_repeat1.md`。完整直链在 manifest，避免只记录浮动分支。

| 名称 / 固定版本 | 页数 | 性质与难度 | 预期 / 参考依据 | 权利与限制 |
|---|---:|---|---|---|
| [TableFormer 2203.01017v2](https://arxiv.org/abs/2203.01017v2) | 16 | 真实论文，Basic / Advanced | p7 原表；Tabula/Simple 78.0，重复 Model 应要求复核 | 论文页面指向 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)；截图注明作者及来源。仓库 PDF 是压缩/转换副本，以 manifest 哈希为准 |
| [DocLayNet 2206.01062v1](https://arxiv.org/abs/2206.01062) | 9 | 真实论文，多层表头 | p4 Caption 数量和 Train 比例；p7 多层列已在提取中展平，参考定义勘误独立记录 | arXiv 非独占分发许可，不据此授予我方任意重发布；本地研究 |
| [OTSL 2305.03393v1](https://arxiv.org/abs/2305.03393v1) | 14 | 真实论文，Advanced，保留样本 | p10 PubTabNet 两个独立源值被合并；原页 0.965 不等于输出 `0.965 0.969` | arXiv 页面提供许可入口，此次许可链接访问失败；不宣称开放再分发，本地研究 |
| amt_handbook_sample | 1 | FAA 手册图文页，Negative | 原页插图/文字，没有选中的表格事实；测试加载、零自动验证 | 美国政府来源特征；特定副本授权未独立确认，不再分发 |
| redp5110_sampled | 18 | IBM DB2 技术手册，Basic / Intermediate | p8 FUNCTION_ID / VARCHAR(30)，p12 CLIENT_PORT / INTEGER，人工读源表 | IBM 版权手册，无开放再分发依据；本地研究 |
| elsevier-00 | 19 | 地理遗产真实期刊文档，Intermediate | p7 Area / Albian，多列、带重音列名；人工核对 | Elsevier 标识，未确认该文件开放许可；不公开 PDF、全文或截图 |
| table_misidentified_as_form | 1 | **外部脱敏/合成表单** | 字段以 aaaa/000 替换，不是自然业务准确性样本；只测加载 | 公开上游 fixture 并非公开个人信息授权；不再分发 |
| table_mislabeled_as_picture | 1 | UN Legal Aid 问卷，Negative | 空复选框不是已填事实；不得把表格形状当作事实真值 | 来源内容许可未确认；本地研究、无截图再分发 |
| earnings | 1 | NVIDIA 财报真实页面，Intermediate / Advanced | 原页三年日期与 2,532；输出自然重复 2023、遗漏 2025；人工核对 | 第三方财报版权；数据集许可不自动消除页面权利，不再分发 |
| discoverworld_crazy_table4 | 1 | DiscoveryWorld 真实研究表，Advanced | 原页 Simplified Clustering / ReACT Procedure 0.87；输出头/体列数不一致 | AI2 benchmark 背景；不独立推断页面开放许可，不再分发 |
| mathfuncs | 1 | **外部生成数学 fixture** | PDF 元数据为 Claude Artifact，公式和人为表格；只测加载，不计真实业务事实准确率 | 外部生成，特定素材授权未确认，不再分发 |
| lincoln_letter | 1 | 历史手写扫描，Negative | 非表格；渲染和无自动事实生成；不评 OCR | 历史作品可能已公有领域，但扫描副本权利未独立确认，不再分发 |
| small_page_size | 1 | British Husbandry 历史扫描，Edge，保留样本 | 原页 Fatty matter 20；180×300 pt、无表头，现有工作流程不可寻址 | 历史文本/扫描副本分别考虑；不再分发 |
| multi_column_miss | 1 | 双栏真实研究文章，Negative | 没有选择表格事实；仅检查渲染，不评正文/阅读顺序提取 | 第三方文章权限未确认，本地研究 |
| census-2012-entire | 940 | 真实官方年鉴，Advanced 性能 | 31,959,786 bytes；实际首/末页渲染；不推断全年鉴事实正确率 | 联邦作品和第三方材料混合边界；不再分发 |

## 基准选择与限制

采用[官方 olmOCR TableTest 实现](https://github.com/allenai/olmocr/blob/f7cfe4c22098b154c76b6ec950d1c0a464eecf8d/olmocr/bench/tests.py)及[纯表格解析 helper](https://github.com/allenai/olmocr/blob/f7cfe4c22098b154c76b6ec950d1c0a464eecf8d/olmocr/bench/table_parsing.py)。代码审查后仅执行纯表格类/函数；没有运行仓库脚本、OCR 模型、网络调用或不可信 PDF 中嵌入的程序。隔离 venv 使用 `rapidfuzz==3.14.3` 二进制 wheel，加系统 BeautifulSoup；不修改产品依赖。

[PubTables-1M 官方仓库](https://github.com/microsoft/table-transformer)是结构识别数据，完整集规模大且与人工合同回归任务不同；此次未下载/执行全套。没有商业产品同条件可用接口，因此未做商业产品胜负排名。没有把 PDF 提取器速度或模型榜单分数当作本产品能力比较。

用户输入只包含原始输出、PDF 和普通检查合同；测试用类别、预期判定、故障标签、基准评分不送入应用。原页视觉核对是评估者的证据，非模型自我评分。所选事实不是全面人工双盲标注，且以英文和科技出版物为主，存在目的性抽样偏差。
