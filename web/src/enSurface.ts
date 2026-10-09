import { COMPANY_PHRASES } from "./companyPhrases";
import { EXACT_EN } from "./enExact";
import { translate, type Lang } from "./locale";

/** 英文界面下，把详情页仍直接展示的中文读数换成英文。数字、日期、代码保持原值。 */
const PHRASES: [string, string][] = [
  ["主尺为世行 GNI/人 PPP，不是住户可支配收入；与现价人均 GDP 不可直接比大小", "The main scale is World Bank GNI per capita, PPP, not household disposable income. Do not compare it directly with GDP per capita in current USD"],
  ["准入成熟阈值进度按人均 GDP 现价（阈值 12000），不用 PPP 收入硬套", "The mature-market marker uses GDP per capita in current USD (threshold 12,000), not PPP income"],
  ["PPP 抬升属常见（生活成本折算后购买力高于名义美元）", "a higher PPP figure is common (purchasing power after local prices exceeds the nominal dollar amount)"],
  ["单看占比难判人均增减，见下方序时配看。", "Shares alone do not show whether income per person is rising. See the time series below."],
  ["世行年频 · 近约十年 · 三产静态图请对照本行序时", "World Bank, annual · about ten years · compare this series with the sector snapshot"],
  ["（世行年频，末端可并入国别卡）。与汇率图并读：逆差加深+外储回落常抬本币压力。对照", "(World Bank, annual; the last point can sit on the country card). Read with the FX chart: a deeper deficit plus falling reserves usually raises pressure on the currency. Versus"],
  ["涨跌按区间首末变动（升=定价压力↑）；通胀负值标通缩冷色并画零轴。对照时点", "Change is from the start to the end of the window (up = more pricing pressure). Negative inflation is marked as deflation, with a zero line. Snapshot"],
  ["箭头按本币强弱（红涨绿跌）· 可选窗口重算 · 悬停看时点", "Arrows follow local-currency strength (red up, green down). The window is recomputed. Hover for the date"],
  ["三图横排各约 1/3 · 队列达龄推算 · k=就业/适龄出生队列示意存量 · 源 OWID/UN WPP", "Three charts, each about one third of the row. Cohort ages into work or retirement. k is an illustrative employment stock over the working-age birth cohort. Source: OWID/UN WPP"],
  ["分项占比（Trading Economics 绝对值折算）· 水平快照", "Share of each sector (from Trading Economics levels) · snapshot"],
  ["人均收入 · GNI/人 PPP（美元）", "Income per capita · GNI per capita, PPP (USD)"],
  ["人均与旁路收入（配看三产）", "Income per capita and side income (read with the sector mix)"],
  ["时段 · 消费信贷 / 私营部门贷款", "Period · consumer credit / private-sector loans"],
  ["*其他≈私营贷款−消费口径", "*Other ≈ private loans minus the consumer measure"],
  ["（单位已粗对齐）。相对关系用于看零售杠杆浓度。", " of private loans (units roughly aligned). The ratio shows how concentrated retail leverage is."],
  ["示意：有一定缓冲，极端冲击仍需锁汇/限兑预案", "Illustrative: there is some buffer. An extreme shock still needs an FX plan"],
  ["通胀/政策利率：BIS 月度观测。", "Inflation and the policy rate: BIS monthly observations."],
  ["服务占比已过附加值偏高阈值", "The services share is above the high value-added threshold"],
  ["人均 GDP 介于新兴与成熟阈值之间", "GDP per capita sits between the emerging and mature thresholds"],
  ["人均 GDP 已过成熟阈值 12000", "GDP per capita is above the mature threshold of 12,000"],
  ["人均 GDP 低于准入关注阈值 2000", "GDP per capita is below the 2,000 watch threshold"],
  ["距过热带仍有空间，整体未触顶", "is still short of the hot band and has not topped out"],
  ["Doing Business 2020，数据采集截至 2019-05。世界银行纠错后历史表。", "Doing Business 2020, data collected through May 2019. World Bank corrected historical table."],
  ["这一行是两个最大商业城市的人口加权。", "This row is population-weighted across the two largest business cities."],
  ["案例设在该国最大商业城市。", "The case is set in the country's largest business city."],
  ["私人征信局覆盖成年人口", "Private credit bureaus cover"],
  ["公共征信登记覆盖成年人口", "the public credit registry covers"],
  ["私人征信局覆盖率无读数", "no private-bureau coverage reading"],
  ["公共征信登记覆盖率无读数", "no public-registry coverage reading"],
  ["征信局或公共登记在运转。信用信息覆盖满分表示个人与企业贷款数据都共享给金融机构。数据来源满分表示金融机构之外另有来源。", "A credit bureau or public registry is operating. A full coverage score means both household and business loan data are shared with lenders. A full source score means there is a source besides lenders."],
  ["征信局或公共登记未运转，或覆盖 15–64 岁人口不足 5%，或截至采集截止日未出信用报告。", "No credit bureau or public registry is operating, coverage of people aged 15–64 is under 5%, or no credit report had been issued by the cutoff."],
  ["Business Ready 2025，金融服务专题，101 个经济体。新信息写入信用报告的标尺为提交后 0–30 个日历日。", "Business Ready 2025, financial services topic, 101 economies. The scale for writing new information into a credit report is 0–30 calendar days after submission."],
  ["本人单独或主要使用的智能手机。GSMA Consumer Survey 2024。这一调查没有给出全国单一占比。", "A smartphone the person uses alone or as the main phone. GSMA Consumer Survey 2024. The survey does not give one nationwide share."],
  ["城镇成年人口（18 岁及以上）", "Urban adults (18 and older)"],
  ["过去三个月使用过互联网的人口", "People who used the internet in the past three months"],
  ["国际电信联盟，世界银行 WDI IT.NET.USER.ZS。", "International Telecommunication Union, World Bank WDI IT.NET.USER.ZS."],
  ["商业合同从起诉到付款", "A commercial contract takes"],
  ["其中判决执行", "of which judgment enforcement takes"],
  ["（上诉期届满至收回款项）", "(from the end of the appeal window to collection)"],
  ["从起诉到付款的天数无读数", "no reading for days from filing to payment"],
  ["判决执行天数无读数", "no reading for judgment-enforcement days"],
  ["利率上限本地未收录。", "No local source for a rate cap."],
  ["外资持股限制本地未收录。", "No local source for a foreign-ownership cap."],
  ["本地信源未收录", "Not in local sources"],
  ["《金融科技机构法》下的 ITF（集体融资或电子支付机构）须获 CNBV 授权。电子支付牌照不等于放贷牌照，现金贷须另核银行或 SOFOM 等放贷主体；消费者保护走 Condusef。", "Under the Fintech Institutions Law, an ITF (crowdfunding or electronic-payment institution) needs CNBV authorization. An electronic-payment license is not a lending license. Cash loans still need a bank, SOFOM, or other lender. Consumer protection sits with Condusef."],
  ["已打开的条文没有这一读数。", "The opened text does not give this reading."],
  ["已打开的专章没有金额和单数。", "The opened chapter has no amounts or deal counts."],
  ["已打开的条文没有金额和单数。", "The opened text has no amounts or deal counts."],
  ["已打开的专章没有离岸发行记录。", "The opened chapter has no offshore issuance record."],
  ["已打开的条文没有离岸发行记录。", "The opened text has no offshore issuance record."],
  ["已打开的条文没有国际买方或利差。", "The opened text has no international buyer or spread."],
  ["已打开的专章没有国际买方或利差。", "The opened chapter has no international buyer or spread."],
  ["已打开的条文没有外资持有或汇出。", "The opened text does not cover foreign holding or repatriation."],
  ["不把第 64 条的系列隔离写成发起人出表。", "Article 64's series segregation is not treated here as the originator taking assets off its balance sheet."],
  ["不把外国发行人条款写成跨境出表。", "The foreign-issuer clause is not treated here as cross-border derecognition."],
  ["已打开的条文没有这一读数", "The opened text does not give this reading"],
  ["服务业已过附加值偏高阈值", "Services are above the high value-added threshold"],
  ["服务占主导、制造仍有空间", "Services lead, and manufacturing still has room"],
  ["仍偏初级/制造驱动", "Still tilted to primary production or manufacturing"],
  ["缺人均收入（GNI PPP）· 暂用人均 GDP 现价代理", "No income per capita (GNI PPP) · GDP per capita in current USD is the stand-in"],
  ["三产/人均收入字段不足，暂无法作图。", "Not enough sector or income fields to draw the chart."],
  ["无三产分项", "No sector split"],
  ["序时暂缺", "No time series yet"],
  ["待接入世行人均GDP / 侨汇 / 三产份额序列", "World Bank series for GDP per capita, remittances, and sector shares are not loaded"],
  ["近十年人均GDP上行", "GDP per capita has risen over about ten years"],
  ["近十年人均GDP承压", "GDP per capita has been under pressure over about ten years"],
  ["近十年人均GDP大致持平", "GDP per capita is roughly flat over about ten years"],
  ["农业份额未降、服务回落→结构改善叙事要打折", "The farm share has not fallen and services have slipped, so a structural-upgrade story should be discounted"],
  ["农业降、服务升→结构与人均更易同向", "Farm share down and services up, so structure and income per person are more likely to move together"],
  ["三产是形态快照；人均增减看序时，侨汇/通胀会让结构与口袋脱节。", "The sector mix is a snapshot. Income per person is in the time series. Remittances and inflation can pull structure and take-home pay apart."],
  ["西非法郎共同区（多国同币，曲线会高度相似）", "West African CFA franc zone (one currency, so the lines look alike)"],
  ["中非法郎共同区（多国同币，曲线会高度相似）", "Central African CFA franc zone (one currency, so the lines look alike)"],
  ["与兰特联动较紧（南非兰特区关联）", "Closely tied to the rand (South African rand area)"],
  ["墨最低劳动年龄", "Mexico minimum working age "],
  ["右入职", "entries on the right, age"],
  ["左退休", "retirements on the left, age"],
  ["入职/退休", "Entries / retirements"],
  ["队列净增", "Cohort net change"],
  ["就业存量", "Employment stock"],
  ["入职 − 退休 · 上正下负", "Entries minus retirements · positive above, negative below"],
  ["纵轴自 0", "axis starts at 0"],
  ["峰值后约自", "after the peak, from about"],
  ["年起年变动很小，接近走平；截至", "the yearly change is small and nearly flat; through"],
  ["存量约", "the stock is about"],
  ["就业锚点", "employment anchor"],
  ["拐点", "turning point"],
  ["净增", "net"],
  ["入职", "entries"],
  ["退休", "retirements"],
  ["合计", "total"],
  ["产业结构", "Sector mix"],
  ["收入能力", "Income capacity"],
  ["农业占 GDP", "Agriculture share of GDP"],
  ["服务占 GDP", "Services share of GDP"],
  ["农业分项", "agriculture "],
  ["人均 GDP", "GDP per capita"],
  ["人均收入（GNI/人 PPP）", "Income per capita (GNI per capita, PPP)"],
  ["人均 GDP（现价·代理）", "GDP per capita (current USD, stand-in)"],
  ["对照人均 GDP 现价", "versus GDP per capita, current"],
  ["侨汇 / GDP", "Remittances / GDP"],
  ["侨汇/GDP约", "remittances/GDP about"],
  ["通胀（月频）", "Inflation (monthly)"],
  ["服务阈值对照", "Services threshold"],
  ["信贷结构", "Credit mix"],
  ["消费信贷约", "consumer credit about"],
  ["私营部门贷款约", "private-sector loans about"],
  ["负债率", "Debt ratios"],
  ["时点 · 居民阈值", "Snapshot · household band"],
  ["政府观察线", "government watch line"],
  ["居民杠杆", "Household leverage"],
  ["汇率走势", "FX path"],
  ["周抽样", "Weekly sample"],
  ["经常账户", "Current account"],
  ["外汇储备", "FX reserves"],
  ["汇兑韧性", "FX resilience"],
  ["外储规模", "Reserve stock"],
  ["汇率波动", "FX volatility"],
  ["年内汇率波动约", "year-to-date FX volatility about"],
  ["汇率水平", "FX level"],
  ["本币对美元约", "local currency per USD about"],
  ["本币升", "local currency up"],
  ["本币贬", "local currency down"],
  ["轻度逆差", "a mild deficit"],
  ["逆差收窄/外部压力缓解", "a narrower deficit eases external pressure"],
  ["外储增厚/缓冲改善", "reserves are thicker and the buffer is stronger"],
  ["外储约", "reserves about"],
  ["规模很大", "a large stock"],
  ["示意分", "illustrative score"],
  ["非评级", "not a rating"],
  ["混用时段+时点", "mixes periods and snapshots"],
  ["末端并入国别卡", "the last point is also on the country card"],
  ["零轴=平衡", "zero line = balance"],
  ["压测序时", "Stress series"],
  ["压测趋势", "Stress trend"],
  ["年频", "Annual"],
  ["时点", "Snapshot"],
  ["窗口", "window"],
  ["全区间", "Full"],
  ["3个月", "3m"],
  ["6个月", "6m"],
  ["10年", "10y"],
  ["5年", "5y"],
  ["3年", "3y"],
  ["1年", "1y"],
  ["政策利率", "Policy rate"],
  ["消费者信心", "Consumer confidence"],
  ["通胀", "Inflation"],
  ["制造", "Manufacturing "],
  ["农业", "Agriculture"],
  ["服务", "Services "],
  ["居民", "Household"],
  ["政府债务/GDP约", "government debt/GDP about"],
  ["政府", "Government"],
  ["消费约占私营贷款", "Consumer credit is about"],
  ["其他*", "Other*"],
  ["信心", "Confidence"],
  ["Doing Business 2020（数据采集截至 2019-05）纠错历史表没有该国的征信覆盖率。", "The Doing Business 2020 corrected historical table (data through May 2019) has no credit-coverage reading for this country."],
  ["Doing Business 2020（数据采集截至 2019-05）纠错历史表没有该国的合同执行天数。", "The Doing Business 2020 corrected historical table (data through May 2019) has no contract-enforcement days for this country."],
  ["Business Ready 2025 金融服务专题覆盖 101 个经济体，没有该国读数。", "Business Ready 2025 financial services covers 101 economies and has no reading for this country."],
  ["零售汽油标「示意」时=TE 泵价水平×布伦特月均路径，非官方零售序时。", "When retail gasoline is marked illustrative, it is the TE pump-price level times the Brent monthly path, not an official retail series."],
  ["该国暂无通胀/政策利率/汽油序时落库（BIS 未覆盖或汽油缺快照）。", "No inflation, policy-rate, or gasoline series is on file for this country (BIS does not cover it, or there is no gasoline snapshot)."],
  ["峰值后持续下行（未见走平）；截至可推算末年", "After the peak it keeps falling (no flattening). Through the last estimated year"],
  ["，其后若出生队列不再回升则趋势仍向下", ", and if birth cohorts do not recover the trend stays down"],
  ["峰值后一度下行，但截至", "After the peak it fell, but by"],
  ["末段已回升至约", "the latest stretch has recovered to about"],
  ["暂无消费/私营信贷存量口径", "No consumer or private-credit stock on file"],
  ["仅录入私营/私人部门贷款约", "Only private-sector loans are on file, about"],
  ["仅录入消费信贷约", "Only consumer credit is on file, about"],
  ["（缺私营贷款对照）", "(no private-loan comparison)"],
  ["（缺消费信贷分项）", "(no consumer-credit split)"],
  ["暂无就业锚点", "No employment anchor yet"],
  ["农业占比偏高", "the farm share is high"],
  ["偏薄", "thin"],
  ["中等", "mid-sized"],
  ["消费", "Consumer"],
  ["示意", "illustrative"],
  ["农村", "rural"],
  ["运营中", "operating"],
  ["缺公开周序列，且宏观卡未同时给出对美元水平与年内波动，无法示意。", "There is no public weekly series, and the macro card does not give both the dollar level and the year-to-date move, so this cannot be drawn."],
  ["示意：外部缓冲相对厚，极端冲击下本币稳定空间更大", "Illustrative: the external buffer is relatively thick, so the currency has more room in an extreme shock"],
  ["示意：缓冲一般，融资与汇兑需并排盯", "Illustrative: the buffer is ordinary. Funding and FX need to be watched together"],
  ["示意：缓冲偏弱，极端情形本币稳定压力大", "Illustrative: the buffer is thin, and an extreme case puts heavy pressure on the currency"],
  ["分项不足，示意分仅供对照", "Too few components. The illustrative score is only a cross-check"],
  ["经常账户大致平衡", "current account roughly balanced"],
  ["经常账户顺差约", "current-account surplus about"],
  ["逆差偏深", "a deep deficit"],
  ["外部缓冲序时", "External-buffer series"],
  ["暂无可用序列", "No series available"],
  ["零售汽油", "Retail gasoline"],
  ["通缩", "deflation"],
  ["持平", "flat"],
  ["累计", "cumulative"],
  ["区间", "span"],
  ["波动", "volatility"],
  ["世行GNI/人PPP·OWID转载·非住户可支配收入", "World Bank GNI per capita, PPP, via OWID, not household disposable income"],
  ["占GDP比重待续拆·对照三产阈值", "GDP share not yet split · compare with the sector thresholds"],
  ["占成年人口·待联合国年龄结构续采", "of the adult population · UN age structure not yet pulled"],
  ["非正式就业/青年失业待ILO交叉", "informal employment and youth unemployment still to be checked against the ILO"],
  ["就业/非正式就业待ILO与官方交叉", "employment and informal employment still to be checked against the ILO and official figures"],
  ["就业亿人/人口亿人·世行就业人口比", "employed, 100 million / population, 100 million · World Bank employment-to-population ratio"],
  ["家庭债务/GDP·BIS·WS_TC家庭信贷/GDP", "household debt/GDP · BIS · WS_TC household credit/GDP"],
  ["年内高低相对均价粗算", "rough high-low versus the average within the year"],
  ["官方失业率未破", "official unemployment has not exceeded "],
  ["官方失业率破", "official unemployment has exceeded "],
  ["Credenz报告转引", "cited from the Credenz report"],
  ["百万美元", " USD million"],
  ["百万", "million"],
  ["十亿", "billion"],
  ["近季约", "latest quarter about "],
  ["CA/GDP约", "CA/GDP about "],
  ["TE货币", "TE currency"],
  ["×15+人口", "× ages 15 and older"],
  ["对照包", "country pack"],
  ["居民杠杆接近/进入新兴市场过热带，需防触顶", "Household leverage is near or inside the emerging-market hot band. Watch for a ceiling"],
  ["居民杠杆暂缺", "No household-leverage reading"],
  ["政府债务已过观察线", "government debt is past the watch line"],
  ["消费信贷存量（单边）", "Consumer-credit stock (one side only)"],
  ["私营/私人部门贷款（单边）", "Private-sector loans (one side only)"],
  ["P2P网络借贷", "P2P lending"],
  ["融资公司", "finance companies"],
  ["小额贷款公司", "microloan companies"],
  ["消费金融公司", "consumer-finance companies"],
  ["万亿", " trillion "],
  ["Nano金融提供商（含银行+非银）", "Nano finance providers (banks and non-banks)"],
  ["Nano金融提供商(含银行+非银)", "Nano finance providers (banks and non-banks)"],
  ["青年失业约", "youth unemployment about "],
  ["顺差收窄", "the surplus is narrowing"],
  ["泰铢", "THB"],
  ["NBFC（上层+中层并表样本）", "NBFC (upper and middle layer, consolidated sample)"],
  ["家庭/零售信贷粗算·BIS杠杆×GDP量级待RBI复核", "household/retail credit, rough: BIS leverage times GDP, still to be checked against the RBI"],
  ["私营信贷粗算·世行%GDP反推待核", "private credit, rough: back-calculated from World Bank percent of GDP, still to be checked"],
  ["贷款增长约", "loan growth about "],
  ["逆差加深/外部压力上升", "a deeper deficit raises external pressure"],
  ["INR - 亿", " INR ×100 million"],
  ["SEC监管借贷/融资类主体", "SEC-supervised lending and financing entities"],
  ["家庭债务/GDP·CEIC转述", "household debt/GDP, as cited by CEIC"],
  ["外储", "reserves"],
  ["阈值", "threshold"],
  ["千", "thousand"],
  ["低", "low"],
  ["高", "high"],
].concat(COMPANY_PHRASES).sort((a, b) => b[0].length - a[0].length);

function replacePhrase(text: string, zh: string, en: string): string {
  if (zh.length >= 6) return text.split(zh).join(en);
  const escaped = zh.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const digitGuard = /^\d/.test(zh) ? "\\d" : "";
  return text.replace(
    new RegExp(`(?<![\\u4e00-\\u9fff${digitGuard}])${escaped}(?![\\u4e00-\\u9fff${digitGuard}])`, "g"),
    en,
  );
}

function trimNum(n: number): string {
  const text = n.toFixed(2).replace(/\.?0+$/, "");
  return text;
}

function convertUnits(text: string): string {
  let s = text.replace(/约(?=\s*[-−]?\s*(?:[\d$]|USD))/g, "about ");
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*万亿美元/g, (_, raw: string) => `USD ${trimNum(Number(raw.replace(/,/g, "")))} trillion`);
  s = s.replace(/(-?\d[\d,]*(?:\.\d+)?)\s*亿美元/g, (_, raw: string) => {
    const n = Number(raw.replace(/,/g, ""));
    const sign = n < 0 ? "-" : "";
    const v = Math.abs(n);
    return v >= 10 ? `USD ${sign}${trimNum(v / 10)} billion` : `USD ${sign}${trimNum(v * 100)} million`;
  });
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*万美元/g, (_, raw: string) => {
    const n = Number(raw.replace(/,/g, ""));
    return `USD ${trimNum(n / 100)} million`;
  });
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*亿人/g, (_, raw: string) => `${trimNum(Number(raw.replace(/,/g, "")) * 100)} million people`);
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*万人/g, (_, raw: string) => `${trimNum(Number(raw.replace(/,/g, "")) / 100)} million people`);
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*万元/g, (_, raw: string) => `CNY ${trimNum(Number(raw.replace(/,/g, "")) * 10000)}`);
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*万(?!亿)/g, (_, raw: string) => `${trimNum(Number(raw.replace(/,/g, "")) / 100)} million`);
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*亿元/g, (_, raw: string) => {
    const n = Number(raw.replace(/,/g, ""));
    return n >= 10 ? `CNY ${trimNum(n / 10)} billion` : `CNY ${trimNum(n * 100)} million`;
  });
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*亿(?!美)/g, (_, raw: string) => {
    const n = Number(raw.replace(/,/g, ""));
    return n >= 10 ? `${trimNum(n / 10)} billion` : `${trimNum(n * 100)} million`;
  });
  s = s.replace(/亿美元/g, "USD 100m");
  s = s.replace(/(\d[\d,]*(?:\.\d+)?)\s*美元/g, "USD $1");
  s = s.replace(/美元/g, "USD");
  const cjkLeft = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  if (cjkLeft <= 8) {
    s = s.replace(/(\d+(?:\.\d+)?)\s*个月/g, "$1 months");
    s = s.replace(/(\d+(?:\.\d+)?)\s*年/g, "$1y");
    s = s.replace(/(\d+(?:\.\d+)?)\s*天/g, "$1 days");
  }
  s = s.replace(/(\d+)\s*岁/g, "$1y");
  return s;
}

function articleLine(text: string): string | null {
  const rest = text.replace(/第|条|款|末段|至|修订后|修改后的|；|，|、|\d|\s|\(|\)|（|）|[a-zA-Z./\-]|Bis/g, "");
  if (rest.length || !/第/.test(text)) return null;
  return text
    .replace(/修订后/g, "as amended, ")
    .replace(/修改后的/g, "as amended, ")
    .replace(/第\s*(\d+(?:\/\d+)?)\s*条/g, "Article $1")
    .replace(/、第/g, ", ")
    .replace(/末段/g, ", last sentence")
    .replace(/至/g, "–")
    .replace(/款/g, "")
    .replace(/第/g, "Article ")
    .replace(/条/g, "")
    .replace(/；/g, "; ")
    .replace(/、/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function englishSurface(text: string, lang: Lang = "zh"): string {
  if (lang !== "en" || !text) return text;
  const hasHan = /[\u4e00-\u9fff]/.test(text);
  const hasFull = /[（）：，。；、]/.test(text);
  if (!hasHan && !hasFull) return text;
  const exact = translate("en", text);
  if (exact !== text) return exact;
  const mapped = EXACT_EN[text];
  if (mapped) return mapped;
  const article = articleLine(text);
  if (article) return article;
  let s = text.replace(/优先名单第\s*(\d+)\s*优先/g, "priority-list rank $1");
  for (const [zh, en] of PHRASES) {
    if (s.includes(zh)) s = replacePhrase(s, zh, en);
  }
  s = convertUnits(s);
  s = s.replace(/（/g, "(").replace(/）/g, ")").replace(/：/g, ": ").replace(/，/g, ", ").replace(/。/g, ". ").replace(/；/g, "; ").replace(/、/g, ", ");
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

export function en(text: string): string {
  if (typeof window === "undefined" || !window.location.hash.toLowerCase().startsWith("#/en")) return text;
  return englishSurface(text, "en");
}
