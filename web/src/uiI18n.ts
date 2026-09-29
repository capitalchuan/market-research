/** 系统起步 UI：中文 / English（登录门禁、会话条、首页粘性栏优先） */

export type UiLang = "zh" | "en";

export function detectBrowserUiLang(): UiLang {
  try {
    const raw = (navigator.language || navigator.languages?.[0] || "en").toLowerCase();
    return raw.startsWith("zh") ? "zh" : "en";
  } catch {
    return "en";
  }
}

const COPY = {
  zh: {
    loginTitle: "CRM 生态系统",
    loginSubtitle: "登录后继续",
    email: "邮箱",
    emailPh: "邮箱",
    password: "密码",
    login: "登录",
    guestEnter: "访客进入",
    langZh: "中文",
    langEn: "English",
    guestRole: "Guest",
    guestPreview: "Guest · 预览",
    guestVerifiedRole: "Guest · 已验证",
    member: "Member",
    admin: "Admin",
    loginBtn: "登录",
    register: "注册",
    registered: "已验证",
    registerUnlock: "注册解锁全部浏览",
    registerHint:
      "未验证访客仅可在地图查看「居民杠杆」。请填写公司、联系人、国家/地区与邮箱，系统将自动向邮箱发送 6 位验证码（不会在页面上显示）。",
    guestBrowseHint: "访客可浏览公开内容；合作机构具名与 CRM 建档仍需白名单成员登录。",
    company: "公司名称",
    companyPh: "公司 / 机构全称",
    contactName: "姓名",
    contactNamePh: "联系人姓名",
    countryRegion: "国家 / 地区",
    countryPh: "请选择国家或地区",
    emailAddr: "邮箱地址",
    phone: "联系电话",
    phonePh: "手机或座机（含区号）",
    sendCode: "发送验证码",
    sending: "发送中…",
    memberLogin: "成员登录",
    close: "关闭",
    emailVerify: "邮箱验证",
    codeSentTo: "验证码已发送至",
    codeTtl: "，15 分钟内有效。请查收邮件（含垃圾箱）。",
    verifyCode: "验证码",
    codePh: "6 位数字",
    verifyUnlock: "验证并解锁",
    resend: "重发验证码",
    editInfo: "修改信息",
    guestVerified: "访客已验证",
    verifiedAt: "验证于",
    exitGuest: "退出访客",
    limitedCallout:
      "访客预览：地图仅「居民杠杆」可点看；对照 / 信源 / 其他地图层需注册验证邮箱后解锁。",
    screenLimited:
      "预览模式：仅「居民杠杆」可点看国别详情；顶栏「注册」验证邮箱后解锁全部地图层。",
    codeSentOk: "验证码已发送至邮箱，请查收邮件完成验证",
    verifyOk: "验证成功，已解锁全部访客浏览权限",
    guestInfoTitle: "访客信息",
    registerUnlockTitle: "注册解锁全部浏览",
    settings: "设置",
    updatePw: "改密",
    changePassword: "更改密码",
    save: "保存",
    cancel: "取消",
    logout: "退出登录",
    oldPassword: "原密码",
    newPassword: "新密码（至少 6 位）",
    oldPwWrong: "原密码错误",
    newPwShort: "新密码至少 6 位",
    pwUpdated: "密码已更新",
    screenMacro: "宏观",
    screenEco: "机构",
    screenRoster: "非银名单",
    screenPickType: "选类型",
    screenModeMacro: (factor: string, region: string) => `宏观 · ${factor} × 展业 · ${region}`,
    screenModeEco: (type: string, region: string) => `机构 · ${type} · ${region}`,
    // 首页粘性栏
    hubCompare: "对照",
    hubSources: "信源",
    mapOpen: "地图",
    mapBack: "返回总览",
    mapOpenTitle: "打开地图大屏",
    mapBackTitle: "返回总览",
    chipFlash: "快讯",
    chipResearch: "研报",
    chipStocks: "上市",
    chipMacro: "宏观",
    chipScenes: "场景",
    chipInstitutions: "机构",
    searchPhMember: "搜索；或上传侧写/方案后发送自动建档",
    searchPhGuest: "搜索（建档需白名单成员登录）",
    attachLink: "链接",
    attachDoc: "文档",
    attachImage: "图片",
    attachText: "文本",
    addAttach: "添加附件",
    pasteLinkPh: "粘贴链接 https://…",
    guestSearchOnly: "访客仅可检索；上传建档需退出访客并以 *@alliancechuan.com 白名单账号登录。",
    // 晨报粘性副栏
    weekFocus: "本周关注",
    itemsN: (n: number) => `${n} 条`,
    disasterN: (n: number) => `灾害 ${n}`,
    storeN: (n: number) => `在架 ${n}`,
    unreadN: (n: number) => `未读 ${n}`,
    updatedTo: (d: string) => `更新至 ${d}`,
    topic: "主题",
    topicCredit: "信贷/监管",
    topicDisaster: "灾害",
    topicStore: "在架/下架",
    investedMkts: "展业国",
    hotMkts: "热点国",
    disasterBadge: (n: number) => `灾${n}`,
    disasterTitle: (n: number) => `灾害 ${n} 条`,
    storeBadge: (n: number) => `架${n}`,
    storeTitle: (n: number) => `商店下架 ${n} 条`,
    noDisasterFlash: "暂无灾害快讯",
    noStoreFlash: "暂无商店在架预警",
    noFlashForCountry: "该国暂无快讯条目",
    flashMeta: "快讯",
    noSummary: "暂无摘要。",
    // 大屏
    loanBook: "在贷余额",
    regionGlobal: "全球",
    regionEastAsia: "东亚",
    regionSeAsia: "东南亚",
    regionSouthAsia: "南亚",
    regionCentralAsia: "中亚",
    regionMena: "中东与北非",
    regionAfrica: "非洲",
    regionLatam: "拉丁美洲",
    regionWest: "欧美",
    macroTitle: (n: number) => `国别宏观 ${n}`,
    scenesTitle: (n: number) => `数字经济 ${n}`,
    ecoTitle: (n: number) => `生态机构 ${n}`,
    stocksTitle: (n: number) => `上市公司 ${n}`,
    stockWatch: "股价监控",
    stockWatchAll: (n: number) => `全部 ${n}`,
    stockWatchEmpty: "暂无监控 · 去上市公司添加（仅本账号）",
    stockWatchCount: (n: number) => `${n}`,
    expand: "展开",
    collapse: "收起",
    expandAll: "展开全部",
    collapseAll: "收起全部",
    countryAll: "全部",
    countryBriefing: "国别速览",
    countryBriefingOpen: (c: string) => `查看${c}快讯`,
    voiceStop: "停止语音",
    voiceStart: "语音录入",
    voiceListening: "聆听中…再点麦克风结束",
    searchBtn: "搜索",
    createPlayerBtn: "创设玩家",
    stopBtn: "停止",
    attachMenuTitleMember: "添加上下文 · 上传建档",
    attachMenuTitleGuest: "添加上下文（访客只读）",
    attachMenuHintMember:
      "白名单成员：上传公司侧写/合作方案后直接发送即可自动归类建档（玩家/资金参与等）；也可写「创设 公司名」。PDF 无文字层时请粘贴要点。建档写入本机 CRM，刷新后仍在。",
    researchMeta: (n: number, packs: number) =>
      packs ? `研报 · ${n} 篇专题 · 监管材料 ${packs}` : `研报 · ${n} 篇专题`,
    researchBrow: "研报",
    researchBrowOfficial: "监管",
    researchKindReport: "研报",
    researchKindThirdParty: "第三方研报",
    researchKindListed: "上市披露",
    researchKindRegulator: "监管/信源包",
    researchKindStats: "监管统计转述",
    researchKindMixed: "混合信源包",
    researchKindTopic: "监管专题",
    researchLede: "导读",
    researchConclusions: "结论",
    researchPolicy: "监管",
    researchPlayers: "相关玩家",
    researchSources: "信源与附件",
    researchMorePlayers: (n: number) => `另有 ${n} 家未展开`,
    researchCollapseTopic: "收起专题",
    researchAsOf: (d: string) => `对照 ${d}`,
    researchCoverage: (r: string) => `覆盖 ${r}`,
    researchConfidence: (c: string) => `置信${c}`,
    researchSourceLink: "原文",
    researchLocalPath: (p: string) => `本地稿 ${p}`,
    researchSourceAsOf: (d: string) => `时点 ${d}`,
    researchRoadshowHide: "路演视角不展示研报明细。",
    mediaFinanceShell: "外媒：财经相关报道",
    mediaBankCreditShell: "银行与信贷动态",
    composerEmptyMember: "检索关键词；或上传公司侧写/合作方案后点发送，自动归类建档",
    composerEmptyGuest: "检索关键词（上传建档需白名单成员登录）",
    composerNeedCompanyName: "已附带材料，未能识别机构名；请写「创设 公司名」后发送",
    composerGuestNoCreate:
      "访客不可建档：请退出访客并以 *@alliancechuan.com 白名单账号登录后，再上传文档创设 CRM 机构",
    compareSearchPh: (mode: string) => `搜索${mode}：品牌 / 法定名 / 牌照 / 国家`,
    comparePickCountry: "请点选至少一个国家加入对照。",
    comparePickOrg: (max: number) => `搜索并点选机构加入对照（可多选，最多 ${max}）。`,
    compareNoMatch: "无匹配机构，换个关键词试试。",
    compareEmptyClass: "本类暂无机构。",
    searchNoMatch: "未找到匹配机构或国别。可换关键词，或点 + 导入创设材料。",
    emptyItems: "暂无条目",
    stockNoMatch: "暂无符合筛选的标的",
    macroCountryTitle: "国别宏观",
    listedStickyTitle: "上市公司",
    listedExportCsv: "导出 CSV",
    listedExportTitle: (n: number) => `导出当前筛选 ${n} 家（CSV，Excel 可开）`,
    listedSort: "排序",
    listedMktCap: "市值",
    listedChangePct: "涨跌幅",
    listedPe: "市盈率",
    listedAllBiz: "全部业务",
    listedAllRegions: "全部地区",
    listedCountry: "国家",
    listedCountryOf: (c: string) => `国家 · ${c}`,
    listedClear: "清除",
    listedWatching: "监控中",
    listedAddWatch: "加入监控",
    listedViewCards: "卡片",
    listedViewList: "一览",
    listedViewMode: "显示模式",
    listedFundNote:
      "市值/财务列统一美元（现价保留本币）；负债率为百分比。准现金/信贷余额仅在口径对齐时展示",
    scenesStickyTitle: "数字经济场景",
    scenesStickyHint: "Web2 / Web3 / Agent · 词条：名称 → 行为/目的 → 玩家名单",
    scenesAllIndustries: "全部业态",
    scenesAllBuckets: "全部子域",
    scenesFinance: "金融",
    scenesDaily: "日常业态",
    scenesCatalogCollapsed: "已收起业态一览；点上方展开，或点筛选芯片直达某一业态",
    scenesFinancePreview: "信用管理 · 信贷产品 · 理财",
    scenesAgentTitle: "Agent 词条",
    scenesAgentHint: (asOf: string) =>
      `来源：36氪AI产品榜（点评/新鲜/热门）+ 首页推荐 · ${asOf}；名称 → 行为/目的 → 玩家名单`,
    filterAll: "全部",
    expandChart: "展开图 ▸",
    collapseChart: "收起图 ▾",
    foldLangZone: "语言区",
    foldCountries: "涉足国家/地区",
    foldCountriesShort: "国家/地区",
    foldLicenses: "涉及金融牌照",
    foldPrimaryPath: "原生路径",
    foldIntel: "情报库词条",
    foldListedEntry: "上市公司词条",
    searchSceneNative: "场景原生",
    searchCreditNative: "信贷原生",
    searchEcoOrgs: "生态机构",
    foldRegions: "涉足洲际",
    foldRegionsHint: "亮起 = 已收录 · 未亮 = 尚未创设",
    filterAllLangZones: "全部语言区",
    filterAllLicenseKinds: "全部牌照粗类",
    cashLoanLens: "现金贷视角",
    // 信源核实 / 经办认领
    claimVerifyTitle: "信源核实（非经营性征标签）",
    claimFullVerify: "完整验证",
    claimIntro:
      "信源一般来自：流量源、监管源、经办认领；宏观对照 Trading Economics〔1〕；国内债券/ABN 交叉中国货币网〔9〕；研报见点点〔2〕/墨腾〔3〕。正文用〔n〕标注，点击跳转「信源编号」目录。",
    claimChannelOn: (c: string) => `已接入·${c}`,
    claimChannelOff: (c: string) => `未接入·${c}`,
    claimChTraffic: "流量源",
    claimChReg: "监管源",
    claimChOwner: "经办认领",
    claimChTrafficHint: "流量源（商店榜/点点/路飞/Sensor Tower/墨腾研报等）",
    claimChRegHint: "监管源（持牌名录/登记）",
    claimChOwnerHint: "经办认领（客户经理联系确认，对信息质量负责）",
    claimCompleteCallout:
      "多源已交叉核实。建议客户经理在更高质量信源（监管登记号补全、经办认领确认）下继续跟进，巩固机构主档。",
    claimIncompleteCallout:
      "信源未齐或仅单侧时，在字段旁标注〔n〕出处编号（不再写「待双端」）；点编号打开信源/研报目录核对。",
    claimClaimed: (name: string, email: string, at: string) =>
      `已认领 · ${name}（${email}）· ${at}`,
    claimRevoke: "撤销我的认领",
    claimPending:
      "待有权限客户经理认领回填（联系确认后对信息质量负责）",
    claimNotePh: "确认摘要（可选）：联系人/要点…",
    claimConfirm: (name: string) => `确认认领（${name}）`,
    claimNeedLogin: "当前未登录或无认领权限。请先登录后再认领。",
    claimNoPerm: "无认领权限：请先登录有效账号",
    claimDefaultNote: "已联系确认；经办对信息质量负责",
    claimOk: (name: string) => `已认领 · ${name}`,
    claimNoRevokeOthers: "无认领权限，无法撤销他人认领",
    claimOnlySelf: "仅本人可撤销自己的认领",
    claimRevoked: "已撤销认领",
    detailsFold: "详情",
    licensePendingClass: "待从牌照信源归类",
    verifyDual: "多源齐备",
    verifyTrafficOnly: "仅流量源",
    verifyRegOnly: "仅监管源",
    verifyCite: "见出处编号",
    verifyConflict: "冲突观察",
  },
  en: {
    loginTitle: "CRM Ecosystem",
    loginSubtitle: "Sign in to continue",
    email: "Email",
    emailPh: "Email",
    password: "Password",
    login: "Sign in",
    guestEnter: "Continue as guest",
    langZh: "中文",
    langEn: "English",
    guestRole: "Guest",
    guestPreview: "Guest · Preview",
    guestVerifiedRole: "Guest · Verified",
    member: "Member",
    admin: "Admin",
    loginBtn: "Sign in",
    register: "Register",
    registered: "Verified",
    registerUnlock: "Register to unlock full access",
    registerHint:
      "Unverified guests can only open the Household leverage map layer. Enter company, contact, country/region and email — a 6-digit code will be emailed automatically (never shown on this page).",
    guestBrowseHint:
      "Guests can browse public content. Partner names and CRM create still require a whitelist member login.",
    company: "Company",
    companyPh: "Enter company name",
    contactName: "Full name",
    contactNamePh: "Contact name",
    countryRegion: "Country / Region",
    countryPh: "Select country or region",
    emailAddr: "Email",
    phone: "Phone",
    phonePh: "Mobile or landline (with country code)",
    sendCode: "Send code",
    sending: "Sending…",
    memberLogin: "Member sign-in",
    close: "Close",
    emailVerify: "Email verification",
    codeSentTo: "Code sent to",
    codeTtl: ". Valid for 15 minutes. Check inbox (and spam).",
    verifyCode: "Verification code",
    codePh: "6-digit code",
    verifyUnlock: "Verify & unlock",
    resend: "Resend code",
    editInfo: "Edit details",
    guestVerified: "Guest verified",
    verifiedAt: "Verified at",
    exitGuest: "Leave guest",
    limitedCallout:
      "Guest preview: only Household leverage is clickable on the map. Register and verify email to unlock Compare, Sources, and other layers.",
    screenLimited:
      "Preview: only Household leverage country details. Use Register in the header to verify email and unlock all map layers.",
    codeSentOk: "Verification code sent — check your email to continue",
    verifyOk: "Verified. Full guest browsing is unlocked.",
    guestInfoTitle: "Guest profile",
    registerUnlockTitle: "Register to unlock full access",
    settings: "Settings",
    updatePw: "Update",
    changePassword: "Change password",
    save: "Save",
    cancel: "Cancel",
    logout: "Sign out",
    oldPassword: "Current password",
    newPassword: "New password (min 6 chars)",
    oldPwWrong: "Current password is incorrect",
    newPwShort: "New password must be at least 6 characters",
    pwUpdated: "Password updated",
    screenMacro: "Macro",
    screenEco: "Institutions",
    screenRoster: "NBFI roster",
    screenPickType: "Pick type",
    screenModeMacro: (factor: string, region: string) => `Macro · ${factor} × invested · ${region}`,
    screenModeEco: (type: string, region: string) => `Orgs · ${type} · ${region}`,
    hubCompare: "Compare",
    hubSources: "Sources",
    mapOpen: "Map",
    mapBack: "Overview",
    mapOpenTitle: "Open map screen",
    mapBackTitle: "Back to overview",
    chipFlash: "Flash",
    chipResearch: "Research",
    chipStocks: "Listed",
    chipMacro: "Macro",
    chipScenes: "Scenes",
    chipInstitutions: "Institutions",
    searchPhMember: "Search; or upload a profile/deck to auto-create CRM",
    searchPhGuest: "Search (creating CRM requires whitelist sign-in)",
    attachLink: "Link",
    attachDoc: "Doc",
    attachImage: "Image",
    attachText: "Text",
    addAttach: "Add attachment",
    pasteLinkPh: "Paste link https://…",
    guestSearchOnly:
      "Guests can search only. Creating CRM requires leaving guest and signing in with an *@alliancechuan.com whitelist account.",
    weekFocus: "This week",
    itemsN: (n: number) => `${n} items`,
    disasterN: (n: number) => `Disasters ${n}`,
    storeN: (n: number) => `Store ${n}`,
    unreadN: (n: number) => `Unread ${n}`,
    updatedTo: (d: string) => `Updated ${d}`,
    topic: "Topics",
    topicCredit: "Credit / reg",
    topicDisaster: "Disaster",
    topicStore: "Store listing",
    investedMkts: "Invested",
    hotMkts: "Hot markets",
    disasterBadge: (n: number) => `D${n}`,
    disasterTitle: (n: number) => `${n} disaster alerts`,
    storeBadge: (n: number) => `S${n}`,
    storeTitle: (n: number) => `${n} store delist alerts`,
    noDisasterFlash: "No disaster flash items",
    noStoreFlash: "No store listing alerts",
    noFlashForCountry: "No flash items for this market",
    flashMeta: "Flash",
    noSummary: "No summary yet.",
    loanBook: "Loan book",
    regionGlobal: "Global",
    regionEastAsia: "East Asia",
    regionSeAsia: "Southeast Asia",
    regionSouthAsia: "South Asia",
    regionCentralAsia: "Central Asia",
    regionMena: "MENA",
    regionAfrica: "Africa",
    regionLatam: "LatAm",
    regionWest: "West",
    macroTitle: (n: number) => `Country macro ${n}`,
    scenesTitle: (n: number) => `Digital economy ${n}`,
    ecoTitle: (n: number) => `Ecosystem orgs ${n}`,
    stocksTitle: (n: number) => `Listed cos ${n}`,
    stockWatch: "Stock watch",
    stockWatchAll: (n: number) => `All ${n}`,
    stockWatchEmpty: "No watchlist yet · add on Listed (per account)",
    stockWatchCount: (n: number) => `${n}`,
    expand: "Expand",
    collapse: "Collapse",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    countryAll: "All",
    countryBriefing: "Country briefing",
    countryBriefingOpen: (c: string) => `Open ${c} flash`,
    voiceStop: "Stop dictation",
    voiceStart: "Voice input",
    voiceListening: "Listening… tap mic again to stop",
    searchBtn: "Search",
    createPlayerBtn: "Create player",
    stopBtn: "Stop",
    attachMenuTitleMember: "Add context · upload to create CRM",
    attachMenuTitleGuest: "Add context (guest read-only)",
    attachMenuHintMember:
      "Whitelist members: upload a company profile/deck and send to auto-classify into CRM (player / funding, etc.); or type “create CompanyName”. If a PDF has no text layer, paste key points. CRM saves locally and persists after refresh.",
    researchMeta: (n: number, packs: number) =>
      packs ? `Research · ${n} topics · ${packs} regulatory packs` : `Research · ${n} topics`,
    researchBrow: "Research",
    researchBrowOfficial: "Regulatory",
    researchKindReport: "Research report",
    researchKindThirdParty: "Third-party research",
    researchKindListed: "Listed disclosure",
    researchKindRegulator: "Regulator / source pack",
    researchKindStats: "Official stats relay",
    researchKindMixed: "Mixed source pack",
    researchKindTopic: "Regulatory topic",
    researchLede: "Brief",
    researchConclusions: "Takeaways",
    researchPolicy: "Policy",
    researchPlayers: "Related players",
    researchSources: "Sources & files",
    researchMorePlayers: (n: number) => `${n} more not shown`,
    researchCollapseTopic: "Collapse topic",
    researchAsOf: (d: string) => `As of ${d}`,
    researchCoverage: (r: string) => `Coverage ${r}`,
    researchConfidence: (c: string) => `Confidence ${c}`,
    researchSourceLink: "Source",
    researchLocalPath: (p: string) => `Local file ${p}`,
    researchSourceAsOf: (d: string) => `As of ${d}`,
    researchRoadshowHide: "Roadshow view hides research detail.",
    mediaFinanceShell: "Foreign media: finance",
    mediaBankCreditShell: "Banking & credit update",
    composerEmptyMember: "Enter a search term; or upload a profile/deck and send to auto-create CRM",
    composerEmptyGuest: "Enter a search term (creating CRM requires whitelist sign-in)",
    composerNeedCompanyName:
      "Attachments added but company name not detected; type “create CompanyName” then send",
    composerGuestNoCreate:
      "Guests cannot create CRM. Leave guest and sign in with an *@alliancechuan.com whitelist account, then upload.",
    compareSearchPh: (mode: string) => `Search ${mode}: brand / legal name / license / country`,
    comparePickCountry: "Pick at least one country to compare.",
    comparePickOrg: (max: number) => `Search and select orgs to compare (multi-select, max ${max}).`,
    compareNoMatch: "No matching orgs — try another keyword.",
    compareEmptyClass: "No orgs in this class yet.",
    searchNoMatch: "No matching org or country. Try another keyword, or tap + to import create materials.",
    emptyItems: "No items yet",
    stockNoMatch: "No tickers match filters",
    macroCountryTitle: "Country macro",
    listedStickyTitle: "Listed companies",
    listedExportCsv: "Export CSV",
    listedExportTitle: (n: number) => `Export ${n} filtered rows (CSV, Excel-ready)`,
    listedSort: "Sort",
    listedMktCap: "Mkt cap",
    listedChangePct: "Change %",
    listedPe: "P/E",
    listedAllBiz: "All businesses",
    listedAllRegions: "All regions",
    listedCountry: "Country",
    listedCountryOf: (c: string) => `Country · ${c}`,
    listedClear: "Clear",
    listedWatching: "Watching",
    listedAddWatch: "Add watch",
    listedViewCards: "Cards",
    listedViewList: "List",
    listedViewMode: "View mode",
    listedFundNote:
      "Mkt-cap & fundamental columns in USD (last price in local FX); debt ratio as %. Cash-like / credit balances only when definitions align.",
    scenesStickyTitle: "Digital-economy scenes",
    scenesStickyHint: "Web2 / Web3 / Agent · entries: name → behavior → player roster",
    scenesAllIndustries: "All industries",
    scenesAllBuckets: "All buckets",
    scenesFinance: "Finance",
    scenesDaily: "Everyday industries",
    scenesCatalogCollapsed: "Industry catalog collapsed — expand above, or jump via filter chips",
    scenesFinancePreview: "Credit mgmt · credit products · wealth",
    scenesAgentTitle: "Agent entries",
    scenesAgentHint: (asOf: string) =>
      `Source: 36Kr AI product ranks · ${asOf}; name → behavior → player roster`,
    filterAll: "All",
    expandChart: "Expand chart ▸",
    collapseChart: "Collapse chart ▾",
    foldLangZone: "Language zone",
    foldCountries: "Markets",
    foldCountriesShort: "Country / region",
    foldLicenses: "Financial licenses",
    foldPrimaryPath: "Origin path",
    foldIntel: "Intel catalog",
    foldListedEntry: "Listed entries",
    searchSceneNative: "Scene-native",
    searchCreditNative: "Credit-native",
    searchEcoOrgs: "Ecosystem orgs",
    foldRegions: "Regions",
    foldRegionsHint: "Lit = in library · dim = not created yet",
    filterAllLangZones: "All language zones",
    filterAllLicenseKinds: "All license classes",
    cashLoanLens: "Cash-loan lens",
    claimVerifyTitle: "Source verification (not a business tag)",
    claimFullVerify: "Fully verified",
    claimIntro:
      "Sources usually: traffic, regulator, owner claim; macro via Trading Economics [1]; China bonds/ABN via Chinamoney [9]; research via Diandian [2] / Momentum [3]. Body cites [n] — tap to open the source index.",
    claimChannelOn: (c: string) => `On · ${c}`,
    claimChannelOff: (c: string) => `Off · ${c}`,
    claimChTraffic: "Traffic",
    claimChReg: "Regulator",
    claimChOwner: "Owner claim",
    claimChTrafficHint: "Traffic (store ranks / Diandian / Sensor Tower / Momentum, etc.)",
    claimChRegHint: "Regulator (license registries)",
    claimChOwnerHint: "Owner claim (RM confirms after contact; owns data quality)",
    claimCompleteCallout:
      "Cross-checked across sources. RM should keep following up with higher-quality sources (full license IDs, owner claim) to harden the org dossier.",
    claimIncompleteCallout:
      "When sources are incomplete or one-sided, cite [n] next to fields (no more “pending dual”); tap the number to open the source/research index.",
    claimClaimed: (name: string, email: string, at: string) =>
      `Claimed · ${name} (${email}) · ${at}`,
    claimRevoke: "Revoke my claim",
    claimPending: "Awaiting an authorized RM claim (contact confirmed; owns data quality)",
    claimNotePh: "Claim note (optional): contact / key points…",
    claimConfirm: (name: string) => `Confirm claim (${name})`,
    claimNeedLogin: "Not signed in or no claim permission. Sign in first to claim.",
    claimNoPerm: "No claim permission — sign in with a valid account",
    claimDefaultNote: "Contact confirmed; RM owns data quality",
    claimOk: (name: string) => `Claimed · ${name}`,
    claimNoRevokeOthers: "No permission to revoke another user’s claim",
    claimOnlySelf: "You can only revoke your own claim",
    claimRevoked: "Claim revoked",
    detailsFold: "Details",
    licensePendingClass: "Pending license-source classification",
    verifyDual: "Multi-source complete",
    verifyTrafficOnly: "Traffic only",
    verifyRegOnly: "Regulator only",
    verifyCite: "See citation IDs",
    verifyConflict: "Conflict watch",
  },
} as const;

export type UiCopy = (typeof COPY)["zh"];

export function uiCopy(lang: UiLang): UiCopy {
  return (COPY[lang] ?? COPY.zh) as UiCopy;
}

/** 机构五大类（键与 Atlas InstBucket 中文枚举对齐） */
const INST_BUCKET_EN: Record<string, string> = {
  用户端: "Demand side",
  监管与合规中介: "Reg & compliance",
  资本风险方: "Capital & risk",
  业务运营服务商: "Ops services",
  基础设施服务商: "Infrastructure",
};

/** 机构类型芯片（键与 Atlas InstitutionType 对齐） */
const INST_TYPE_EN: Record<string, string> = {
  玩家: "Player (operator)",
  流量服务商: "Traffic vendor",
  数据服务方: "Data provider",
  监管: "Regulator",
  资金参与机构: "Funding participant",
  风险参与机构: "Risk participant",
  股权投资人: "Equity investor",
  风控服务方: "Risk-control vendor",
  支付服务机构: "Payment institution",
  回收机构: "Collections / AMC",
  权益服务商: "Benefits vendor",
  触达服务机构: "Reach / messaging",
  公关服务机构: "PR agency",
  信托服务机构: "Trust services",
  会计师事务所: "Accounting firm",
  律师事务所: "Law firm",
  评级机构: "Rating agency",
};

export function instBucketLabel(bucket: string, lang: UiLang): string {
  if (lang === "en") return INST_BUCKET_EN[bucket] || bucket;
  return bucket;
}

export function institutionTypeLabel(type: string, lang: UiLang, zhOverride?: string): string {
  const zh = zhOverride || type;
  if (lang !== "en") return zh;
  if (type === "玩家" || zh.startsWith("玩家")) return INST_TYPE_EN.玩家;
  return INST_TYPE_EN[type] || zh;
}

/** ISO 国码 → UI 国名；en 用 DisplayNames，缺省回退中文/码 */
const COUNTRY_EN_OVERRIDE: Record<string, string> = {
  all: "All",
  CN: "China (Mainland)",
  HK: "Hong Kong SAR",
  MO: "Macao SAR",
  TW: "Taiwan",
  MN: "Mongolia",
  US: "United States",
  GB: "United Kingdom",
  AE: "United Arab Emirates",
  KR: "South Korea",
  CZ: "Czechia",
  RU: "Russia",
};

export function countryLabelUi(code: string, lang: UiLang, zhFallback?: string): string {
  const c = (code || "").trim();
  if (!c) return zhFallback || "";
  if (lang === "zh") return zhFallback || COUNTRY_EN_OVERRIDE[c] || c;
  if (c === "all") return COUNTRY_EN_OVERRIDE.all;
  if (COUNTRY_EN_OVERRIDE[c]) return COUNTRY_EN_OVERRIDE[c];
  try {
    if (/^[A-Z]{2}$/i.test(c)) {
      const name = new Intl.DisplayNames(["en"], { type: "region" }).of(c.toUpperCase());
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return zhFallback || c;
}

/** 研报 docKind / 中文标签 → EN */
export function researchKindLabelUi(labelOrKind: string, lang: UiLang): string {
  if (lang !== "en") return labelOrKind;
  const t = uiCopy("en");
  const map: Record<string, string> = {
    研报: t.researchKindReport,
    第三方研报: t.researchKindThirdParty,
    上市披露: t.researchKindListed,
    "监管/信源包": t.researchKindRegulator,
    监管统计转述: t.researchKindStats,
    混合信源包: t.researchKindMixed,
    监管专题: t.researchKindTopic,
    research_report: t.researchKindReport,
    regulator_pack: t.researchKindRegulator,
    market_stats_relay: t.researchKindStats,
    mixed_source_pack: t.researchKindMixed,
  };
  return map[labelOrKind] || labelOrKind;
}

const CONFIDENCE_EN: Record<string, string> = { 高: "High", 中: "Medium", 低: "Low" };

export function confidenceLabelUi(c: string, lang: UiLang): string {
  if (lang !== "en") return c;
  return CONFIDENCE_EN[c] || c;
}

/** 股价条展示名：EN 去全角括号并英文化备注 */
const STOCK_PAREN_EN: Record<string, string> = {
  含金融: "incl. finance",
  "含信贷/支付": "incl. credit/payments",
  "含 LexisNexis Risk": "incl. LexisNexis Risk",
  "STC Pay": "STC Pay",
  "B3 存托": "B3 depositary",
  "Etisalat·钱包": "Etisalat wallet",
  征信: "credit bureau",
  信用评分: "credit scoring",
  "MoMo 钱包": "MoMo wallet",
};

export function stockDisplayNameUi(nameZh: string, lang: UiLang, symbol?: string): string {
  const raw = (nameZh || "").trim();
  if (!raw) return symbol || "";
  if (lang !== "en") {
    // 中文条：去掉括号备注避免裁切，与历史行为一致
    const short = raw.split(/[（(]/)[0]?.trim() || raw;
    return short || symbol || raw;
  }
  const m = raw.match(/^(.+?)[（(](.+?)[）)]\s*$/);
  if (m) {
    const base = m[1].trim();
    const note = m[2].trim();
    const noteEn = STOCK_PAREN_EN[note] || note.replace(/含/g, "incl. ");
    return `${base} (${noteEn})`;
  }
  return raw.replace(/（/g, "(").replace(/）/g, ")") || symbol || raw;
}

/** 国别速览：中文国名 → ISO（用于 countryLabelUi） */
const BRIEF_COUNTRY_TO_CODE: Record<string, string> = {
  印尼: "ID",
  印度: "IN",
  泰国: "TH",
  菲律宾: "PH",
  马来: "MY",
  马来西亚: "MY",
  越南: "VN",
  新加坡: "SG",
  中国香港: "HK",
  香港: "HK",
  墨西哥: "MX",
  巴西: "BR",
  阿根廷: "AR",
  哥伦比亚: "CO",
  肯尼亚: "KE",
  尼日利亚: "NG",
  南非: "ZA",
  埃及: "EG",
  加纳: "GH",
  巴基斯坦: "PK",
  孟加拉: "BD",
  斯里兰卡: "LK",
  美国: "US",
  日本: "JP",
  韩国: "KR",
  中国: "CN",
  沙特: "SA",
  阿联酋: "AE",
  哈萨克: "KZ",
  格鲁吉亚: "GE",
  以色列: "IL",
  澳洲: "AU",
  澳大利亚: "AU",
};

export function briefCountryCode(nameZh: string): string | undefined {
  return BRIEF_COUNTRY_TO_CODE[nameZh];
}

/** 国别速览电报短语 → EN */
const BRIEF_PHRASE_EN: [RegExp, string][] = [
  [/POJK\s*8\/2026\s*日报落地/, "POJK 8/2026 daily reporting live"],
  [/拟禁\s*NBFC\s*循环授信|拟禁止\s*NBFC\s*循环授信/, "RBI draft: ban NBFC revolving credit"],
  [/负责任借贷\/禁提前还款费约束仍硬|负责任借贷/, "responsible lending / early-repay fee rules still tight"],
  [/数字银行存量竞争/, "digital banks in share fight"],
  [/SOFOM\/CAT\s*披露加严/, "SOFOM/CAT disclosure tightening"],
  [/Pix\s*探索信贷抵押/, "Pix exploring credit collateral"],
  [/DCP\s*持牌扩至约\s*(\d+)/, "DCP licenses ~$1"],
  [/开放银行与\s*FCCPC\s*放贷登记并行/, "open banking + FCCPC lender registry in parallel"],
  [/约束仍然偏硬|约束仍硬/, "constraints still tight"],
  [/日报制度已经落地|日报落地/, "daily reporting live"],
  [/仍处在存量竞争阶段|存量竞争/, "incumbent share fight"],
  [/披露要求加严|披露加严/, "disclosure tightening"],
  [/正在探索把支付能力用于信贷抵押|探索信贷抵押/, "exploring payment-as-credit collateral"],
  [/持牌机构扩至约\s*(\d+)\s*家|持牌扩至约\s*(\d+)/, "licensed entities ~$1"],
  [/媒体口径待双端/, "media claims — pending dual-source check"],
  [/数字借贷/, "digital lending"],
];

export function briefPhraseToEn(raw: string): string {
  let t = (raw || "").trim();
  if (!t) return t;
  for (const [re, en] of BRIEF_PHRASE_EN) t = t.replace(re, en);
  // 去掉残留中文标点习惯
  t = t.replace(/[：]/g, ": ").replace(/[；]/g, "; ").replace(/[，]/g, ", ").replace(/[。]/g, ".");
  t = t.replace(/\s{2,}/g, " ").trim();
  return t;
}

/** 灾害中文标题模板 → EN（无 titleEn 时） */
export function disasterTitleToEn(titleZh: string, kindZh?: string): string {
  let t = (titleZh || "").trim();
  if (!t) return t;
  t = t
    .replace(/洪涝绿色预警/g, "Flood — green alert")
    .replace(/洪涝橙色预警/g, "Flood — orange alert")
    .replace(/洪涝红色预警/g, "Flood — red alert")
    .replace(/洪涝黄色预警/g, "Flood — yellow alert")
    .replace(/地震/g, "Earthquake")
    .replace(/干旱/g, "Drought")
    .replace(/台风|热带气旋/g, "Tropical cyclone")
    .replace(/林火|火灾/g, "Wildfire")
    .replace(/火山/g, "Volcano")
    .replace(/绿色预警/g, "green alert")
    .replace(/橙色预警/g, "orange alert")
    .replace(/红色预警/g, "red alert");
  const countrySwap: [RegExp, string][] = [
    [/菲律宾/, "Philippines"],
    [/印度尼西亚|印尼/, "Indonesia"],
    [/墨西哥/, "Mexico"],
    [/巴西/, "Brazil"],
    [/泰国/, "Thailand"],
    [/越南/, "Vietnam"],
    [/印度/, "India"],
    [/美国/, "United States"],
    [/中国/, "China"],
    [/韩国/, "South Korea"],
    [/阿富汗/, "Afghanistan"],
  ];
  for (const [re, en] of countrySwap) t = t.replace(re, en);
  if (kindZh && !t.toLowerCase().includes(kindZh.toLowerCase())) {
    const kindEn =
      ({ 地震: "Earthquake", 洪涝: "Flood", 干旱: "Drought", 台风: "Cyclone", 林火: "Wildfire" } as Record<
        string,
        string
      >)[kindZh] || kindZh;
    if (!t.includes(kindEn)) t = `${kindEn}: ${t}`;
  }
  return t.replace(/·/g, " · ").replace(/\s{2,}/g, " ").trim();
}

/** 快讯通用中文壳 → EN */
export function flashShellToEn(title: string): string {
  const s = (title || "").trim();
  if (s === "外媒：财经相关报道" || s === "外媒速览：财经") return "Foreign media: finance";
  if (s === "银行与信贷动态") return "Banking & credit update";
  if (s.endsWith("：财经相关")) {
    const src = s.slice(0, -5);
    return `${src}: finance-related`;
  }
  if (s === "美联储动态") return "Federal Reserve update";
  if (s === "OJK 监管动态") return "OJK regulatory update";
  if (s === "金融诈骗警示") return "Financial scam alert";
  if (s === "新获牌照动态") return "New license update";
  if (s === "网贷/P2P 动态") return "P2P / online lending update";
  if (s === "先买后付动态") return "BNPL update";
  if (s === "RBI/NBFC 数字借贷") return "RBI/NBFC digital lending";
  return s;
}


/** 上市筛选地区/业态 → EN */
const LISTED_REGION_EN: Record<string, string> = {
  东亚: "East Asia",
  东南亚: "Southeast Asia",
  南亚: "South Asia",
  中亚: "Central Asia",
  拉美: "LatAm",
  中东北非: "MENA",
  非洲: "Africa",
  欧美: "West",
  其他: "Other",
  全球: "Global",
};
const LISTED_ORIGIN_EN: Record<string, string> = {
  信贷原生: "Credit-native",
  支付跨界: "Payments crossover",
  电商跨界: "E-commerce crossover",
  "出行/外卖": "Ride / food",
  数字银行: "Digital bank",
  "BNPL/分期": "BNPL / installment",
  数据服务: "Data services",
  风控服务: "Risk-control services",
  其他: "Other",
};

export function listedRegionLabelUi(label: string, lang: UiLang): string {
  if (lang !== "en") return label;
  return LISTED_REGION_EN[label] || label;
}

export function listedOriginLabelUi(label: string, lang: UiLang): string {
  if (lang !== "en") return label;
  return LISTED_ORIGIN_EN[label] || label;
}

/** Atlas REGION_LABEL 键 → EN（与 uiCopy region* 对齐） */
export function regionLabelUi(regionKey: string, lang: UiLang, zhFallback?: string): string {
  if (lang !== "en") return zhFallback || regionKey;
  const t = uiCopy("en");
  const map: Record<string, string> = {
    all: t.regionGlobal,
    "east-asia": t.regionEastAsia,
    "se-asia": t.regionSeAsia,
    "south-asia": t.regionSouthAsia,
    "central-asia": t.regionCentralAsia,
    mena: t.regionMena,
    africa: t.regionAfrica,
    latam: t.regionLatam,
    west: t.regionWest,
  };
  return map[regionKey] || zhFallback || regionKey;
}


/** 机构 hub：流量 / 资金 / 股权细分芯片 */
const TRAFFIC_KIND_EN: Record<string, string> = {
  流量平台: "Traffic platform",
  代理商: "Agency / reseller",
  贷超: "Loan marketplace",
  代理运营: "Ops / ASO agency",
};

const FUND_KIND_EN: Record<string, string> = {
  本地银行: "Local bank",
  本地银行代理: "Local bank agent",
  结构化服务商: "Structuring provider",
  优先投资人: "Senior investor",
  夹层投资人: "Mezzanine investor",
};

const EQUITY_KIND_EN: Record<string, string> = {
  PE: "PE",
  VC: "VC",
  战略: "Strategic",
  银行财务投资人: "Bank financial investor",
  信贷基金: "Credit fund",
  其他: "Other",
};

export function trafficKindLabelUi(kind: string, lang: UiLang): string {
  if (lang !== "en") return kind;
  return TRAFFIC_KIND_EN[kind] || kind;
}

export function fundKindLabelUi(kind: string, lang: UiLang): string {
  if (lang !== "en") return kind;
  return FUND_KIND_EN[kind] || kind;
}

export function equityKindLabelUi(kind: string, lang: UiLang): string {
  if (lang !== "en") return kind;
  return EQUITY_KIND_EN[kind] || kind;
}

/** Listed 卡片/详情 KPI 标签（营收/净利等）；未命中则回退原文 */
const FINTECH_KPI_LABEL_EN: Record<string, string> = {
  营收: "Revenue",
  收入: "Revenue",
  总收入: "Total revenue",
  营业收入: "Operating revenue",
  经营收入: "Operating revenue",
  净收入: "Net revenue",
  集团净收入: "Group net revenue",
  金融科技净收入: "Fintech net revenue",
  净利: "Net income",
  净利润: "Net income",
  归母净利: "Net income to parent",
  归属净利: "Attributable net income",
  毛利: "Gross profit",
  经营利润: "Operating profit",
  税前利润: "Profit before tax",
  权益: "Equity",
  总资产: "Total assets",
  信贷组合: "Loan book",
  在贷余额: "Outstanding loans",
  在贷本金: "Outstanding principal",
  总在贷: "Total outstanding",
  放款量: "Origination",
  季放款额: "Quarterly origination",
  净放款: "Net loans",
  存款: "Deposits",
  活跃客户: "Active customers",
  客户余额: "Customer balances",
  摊薄EPS: "Diluted EPS",
  "摊薄 EPS": "Diluted EPS",
  "经调摊薄 EPS": "Adj. diluted EPS",
  "经调 EBITDA": "Adj. EBITDA",
  "90+ 逾期率": "90+ delinquency",
  "NPL 15–90": "NPL 15–90",
  "NPL 90+": "NPL 90+",
  资产负债率: "Debt / assets",
  负债率: "Leverage",
  净资产: "Book equity",
  准现金: "Cash-like",
  信贷余额: "Credit book",
};

export function fintechKpiLabelUi(label: string, lang: UiLang): string {
  if (lang !== "en" || !label) return label;
  if (FINTECH_KPI_LABEL_EN[label]) return FINTECH_KPI_LABEL_EN[label];
  // light pattern fallbacks
  let s = label;
  s = s.replace(/营业收入|经营收入|总收入|净收入|营收|收入/g, (m) => ({
    营业收入: "Op. revenue",
    经营收入: "Op. revenue",
    总收入: "Total revenue",
    净收入: "Net revenue",
    营收: "Revenue",
    收入: "Revenue",
  }[m] || m));
  s = s.replace(/归母净利|归属净利|净利润|净利/g, (m) => ({
    归母净利: "NI to parent",
    归属净利: "Attributable NI",
    净利润: "Net income",
    净利: "Net income",
  }[m] || m));
  s = s.replace(/在贷余额|在贷本金|总在贷|信贷组合|信贷余额/g, (m) => ({
    在贷余额: "Outstanding",
    在贷本金: "Outstanding principal",
    总在贷: "Total outstanding",
    信贷组合: "Loan book",
    信贷余额: "Credit book",
  }[m] || m));
  s = s.replace(/放款量|季放款额|净放款|促成放款额/g, (m) => ({
    放款量: "Origination",
    季放款额: "Q origination",
    净放款: "Net loans",
    促成放款额: "Facilitated origination",
  }[m] || m));
  s = s.replace(/逾期率/g, "delinquency");
  s = s.replace(/利润率/g, "margin");
  return s === label ? label : s;
}
