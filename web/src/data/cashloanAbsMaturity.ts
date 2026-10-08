/**
 * 个人现金贷「ABS成熟度」的七条。
 * 已核国家的条文在 cashloanAbsOrdinance.json。
 */

export type AbsMarketLens = "local" | "intl";

export type AbsMaturityDimension = {
  id: string;
  title: string;
  local: string;
  intl: string;
};

export const ABS_MATURITY_DIMENSIONS: AbsMaturityDimension[] = [
  {
    id: "legal",
    title: "法律能否出表",
    local: "有没有证券化或特殊目的载体的法律；真实出售和破产隔离能不能执行。",
    intl: "本地贷款能不能卖给境外载体；外汇和资本项目放不放行。",
  },
  {
    id: "issuance",
    title: "发行是否连续",
    local: "近 1–3 年消费贷、现金贷、信用卡 ABS（含本地 ABN、信托、私募）的金额、单数，以及是否每年都有。",
    intl: "有没有以该国资产发行的美元或离岸证券；是单次试点还是重复发行。",
  },
  {
    id: "asset",
    title: "哪类资产进得了池",
    local: "无抵押现金贷、场景分期、信用卡，哪一类能进公募或常规私募。",
    intl: "国际买方实际买过哪一类；现金贷是否被排除在合格资产之外。",
  },
  {
    id: "buyers",
    title: "买方是否稳定",
    local: "银行、货币基金、保险、养老金是否反复配置，还是只有发起人自持。",
    intl: "买方是本地账户还是国际 ABS 账户；利差相对本国国债或同类国家。",
  },
  {
    id: "retention",
    title: "发起人还要留多少",
    local: "次级档和自持比例。外部买得越少、自持越高，接受度越低。",
    intl: "国际发行里，发起人或本地银行要担保或认购多少。",
  },
  {
    id: "plumbing",
    title: "发行基础设施",
    local: "受托、托管、评级、登记结算是否有可重复使用的标准文本；披露是池级还是逐笔，滞后多久。",
    intl: "用的是本地评级还是国际评级；披露能否满足跨境买方的报告频率。",
  },
  {
    id: "policy",
    title: "监管是否允许",
    local: "监管是允许消费信贷出表，还是限制非银、现金贷资产入池。",
    intl: "外资能否持有这些证券，本息能不能汇出。",
  },
];
