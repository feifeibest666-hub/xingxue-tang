// 案例库：只收 Rodden 评级 AA 或 A 的出生资料，以已故历史人物为主。
// 每条都对照过两个独立来源（Astro-Databank 转录 + 另一家星盘库或传记/档案），只存出生数据和公开传记事实。
import type { Birth } from '../lib/natal'

export interface CaseEvent { date: string; what: string; kind: '迁居' | '婚恋' | '家庭' | '事业' | '健康' | '荣誉' | '挫折' | '信仰' }
export interface CaseChart {
  id: string
  name: string
  en: string
  role: string
  birth: Birth
  /** 当地时间写法，例如"地方平时" */
  clock: string
  rating: 'AA' | 'A'
  source: string
  note?: string
  bio: string[]
  events: CaseEvent[]
}

const lmt = (lon: number) => lon / 15

export const CASES: CaseChart[] = [
  {
    id: 'einstein', name: '爱因斯坦', en: 'Albert Einstein', role: '物理学家',
    birth: { date: '1879-03-14', time: '11:30', tz: lmt(10.0), lat: 48.4, lon: 10.0, place: '德国乌尔姆' }, clock: '地方平时',
    rating: 'AA', source: 'Astro-Databank（出生登记）；与多家星盘库一致',
    bio: ['少年时厌恶死记硬背的学校，1900 年毕业后两年找不到教职，在伯尔尼专利局做审查员。', '1905 年连发四篇论文（光量子、布朗运动、狭义相对论、质能关系）。', '1915 年完成广义相对论，1919 年日食观测证实后成为世界名人。', '1933 年离开德国定居美国普林斯顿，晚年致力于统一场论。'],
    events: [
      { date: '1902-06-23', what: '进入伯尔尼专利局工作', kind: '事业' }, { date: '1902-10-10', what: '父亲去世', kind: '家庭' },
      { date: '1903-01-06', what: '与米列娃结婚', kind: '婚恋' }, { date: '1905-06-30', what: '狭义相对论论文投稿', kind: '事业' },
      { date: '1915-11-25', what: '提交广义相对论场方程', kind: '事业' }, { date: '1919-02-14', what: '与米列娃离婚', kind: '婚恋' },
      { date: '1919-11-06', what: '日食观测结果公布，一夜成名', kind: '荣誉' }, { date: '1922-11-09', what: '获颁 1921 年诺贝尔物理学奖', kind: '荣誉' },
      { date: '1933-10-17', what: '移居美国普林斯顿', kind: '迁居' },
    ],
  },
  {
    id: 'victoria', name: '维多利亚女王', en: 'Queen Victoria', role: '英国女王',
    birth: { date: '1819-05-24', time: '04:15', tz: lmt(-0.17), lat: 51.5, lon: -0.17, place: '伦敦肯辛顿宫' }, clock: '地方平时',
    rating: 'AA', source: 'Astro-Databank（官方公告）；当日《泰晤士报》转载的宫廷公报',
    bio: ['父亲肯特公爵在她 8 个月大时去世，由母亲在严格的"肯辛顿制度"下抚养。', '18 岁继位，在位 63 年。', '1840 年与表兄阿尔伯特亲王结婚，生育 9 个子女；1861 年阿尔伯特去世后长期隐居服丧。'],
    events: [
      { date: '1820-01-23', what: '父亲去世', kind: '家庭' }, { date: '1837-06-20', what: '继位为女王', kind: '事业' },
      { date: '1840-02-10', what: '与阿尔伯特结婚', kind: '婚恋' }, { date: '1840-11-21', what: '长女出生', kind: '家庭' },
      { date: '1861-03-16', what: '母亲去世', kind: '家庭' }, { date: '1861-12-14', what: '阿尔伯特去世，开始长期隐居', kind: '家庭' },
      { date: '1876-05-01', what: '加封印度女皇', kind: '荣誉' },
    ],
  },
  {
    id: 'mozart', name: '莫扎特', en: 'Wolfgang Amadeus Mozart', role: '作曲家',
    birth: { date: '1756-01-27', time: '20:00', tz: lmt(13.05), lat: 47.8, lon: 13.05, place: '奥地利萨尔茨堡' }, clock: '地方平时',
    rating: 'AA', source: 'Astro-Databank（出生记录）；父亲利奥波德的书信',
    bio: ['父亲利奥波德是宫廷乐师和著名的小提琴教师，6 岁起带他和姐姐巡回欧洲演出。', '1781 年与萨尔茨堡大主教决裂，到维也纳做自由音乐家。', '收入时高时低，晚年常向朋友借钱；35 岁去世。'],
    events: [
      { date: '1762-01-15', what: '随父亲开始第一次巡演', kind: '事业' }, { date: '1778-07-03', what: '母亲在巴黎去世', kind: '家庭' },
      { date: '1781-06-08', what: '与大主教决裂，定居维也纳', kind: '迁居' }, { date: '1782-08-04', what: '与康斯坦策结婚', kind: '婚恋' },
      { date: '1786-05-01', what: '《费加罗的婚礼》首演', kind: '事业' }, { date: '1787-05-28', what: '父亲去世', kind: '家庭' },
    ],
  },
  {
    id: 'hesse', name: '黑塞', en: 'Hermann Hesse', role: '作家',
    birth: { date: '1877-07-02', time: '18:30', tz: lmt(8.73), lat: 48.72, lon: 8.73, place: '德国卡尔夫' }, clock: '地方平时',
    rating: 'AA', source: 'Astro-Databank（出生记录）；苏尔坎普版《黑塞全集》年表',
    bio: ['父母都是虔敬派传教士家庭；14 岁从毛尔布龙神学院出逃，少年期一度精神危机。', '1904 年《彼得·卡门青》成功后成为职业作家。', '1916 年起接受荣格派分析师朗格的心理分析，此后写出《德米安》《悉达多》《荒原狼》。', '1946 年获诺贝尔文学奖。'],
    events: [
      { date: '1892-03-07', what: '从神学院出逃', kind: '挫折' }, { date: '1904-08-02', what: '与玛丽亚·贝尔努利结婚', kind: '婚恋' },
      { date: '1916-03-08', what: '父亲去世；开始接受心理分析', kind: '家庭' }, { date: '1919-05-11', what: '独自移居瑞士蒙塔尼奥拉', kind: '迁居' },
      { date: '1922-10-01', what: '《悉达多》出版', kind: '事业' }, { date: '1946-11-14', what: '获诺贝尔文学奖', kind: '荣誉' },
    ],
  },
  {
    id: 'jobs', name: '乔布斯', en: 'Steve Jobs', role: '企业家',
    birth: { date: '1955-02-24', time: '19:15', tz: -8, lat: 37.77, lon: -122.42, place: '美国旧金山' }, clock: '太平洋标准时间',
    rating: 'AA', source: 'Astro-Databank（2006 年取得的加州出生证明）；与多家星盘库一致',
    note: '早年流传过 6:00 的时间，出生证明公布后作废——这是"为什么要查评级"的好例子。',
    bio: ['出生后被收养。大学读了一学期就退学旁听。', '1976 年与沃兹尼亚克创办苹果；1985 年在董事会斗争中离开。', '1986 年买下皮克斯，1997 年回到苹果，2007 年发布 iPhone。'],
    events: [
      { date: '1976-04-01', what: '创办苹果公司', kind: '事业' }, { date: '1980-12-12', what: '苹果上市，身家过亿', kind: '事业' },
      { date: '1985-09-17', what: '辞去苹果职务', kind: '挫折' }, { date: '1991-03-18', what: '与劳伦结婚', kind: '婚恋' },
      { date: '1997-09-16', what: '出任苹果临时 CEO', kind: '事业' }, { date: '2007-01-09', what: '发布 iPhone', kind: '事业' },
    ],
  },
  {
    id: 'disney', name: '沃尔特·迪士尼', en: 'Walt Disney', role: '动画制作人、企业家',
    birth: { date: '1901-12-05', time: '00:35', tz: -6, lat: 41.88, lon: -87.63, place: '美国芝加哥' }, clock: '中部标准时间',
    rating: 'A', source: 'Astro-Databank（评级 A，来自回忆）；没有出生证明可查',
    note: '评级 A 而非 AA：时间来自回忆，另有一个 7:30 的说法。凡是依赖上升和宫位的结论，都要打折扣。',
    bio: ['1922 年在堪萨斯城创办"欢笑动画"工作室，1923 年破产。', '带着几十美元去好莱坞重新开始；1928 年米老鼠一炮而红。', '1937 年《白雪公主》是第一部长篇彩色动画；1955 年建成迪士尼乐园。'],
    events: [
      { date: '1922-05-23', what: '创办欢笑动画工作室', kind: '事业' }, { date: '1923-07-01', what: '工作室破产，迁往好莱坞', kind: '挫折' },
      { date: '1925-07-13', what: '与莉莲结婚', kind: '婚恋' }, { date: '1928-11-18', what: '《汽船威利》首映，米老鼠诞生', kind: '事业' },
      { date: '1937-12-21', what: '《白雪公主》首映', kind: '事业' }, { date: '1955-07-17', what: '迪士尼乐园开幕', kind: '事业' },
    ],
  },
  {
    id: 'fdr', name: '富兰克林·罗斯福', en: 'Franklin D. Roosevelt', role: '政治家',
    birth: { date: '1882-01-30', time: '20:45', tz: lmt(-73.93), lat: 41.79, lon: -73.93, place: '美国纽约州海德公园' }, clock: '地方平时',
    rating: 'AA', source: 'Astro-Databank（引用出生证明）；父亲的日记',
    bio: ['出身富裕世家，哈佛毕业后从政。', '1921 年 39 岁患脊髓灰质炎，下肢瘫痪，此后坚持复健。', '1932 年当选总统，推行"新政"，是唯一四次当选的美国总统。'],
    events: [
      { date: '1905-03-17', what: '与埃莉诺结婚', kind: '婚恋' }, { date: '1910-11-08', what: '当选纽约州参议员', kind: '事业' },
      { date: '1921-08-10', what: '患脊髓灰质炎', kind: '健康' }, { date: '1928-11-06', what: '当选纽约州州长', kind: '事业' },
      { date: '1932-11-08', what: '当选总统', kind: '事业' }, { date: '1941-09-07', what: '母亲去世', kind: '家庭' },
    ],
  },
  {
    id: 'vangogh', name: '梵高', en: 'Vincent van Gogh', role: '画家',
    birth: { date: '1853-03-30', time: '11:00', tz: lmt(4.67), lat: 51.47, lon: 4.67, place: '荷兰津德尔特' }, clock: '地方平时',
    rating: 'AA', source: 'Astro-Databank（出生证明）；津德尔特 1853 年出生登记第 29 号',
    bio: ['牧师之子，做过画商职员、教师、传道人，27 岁才决心学画。', '靠弟弟提奥长期接济，生前几乎卖不出画。', '1888 年在阿尔勒画出《向日葵》等名作；同年底精神危机，1889 年住进圣雷米疗养院。'],
    events: [
      { date: '1869-07-30', what: '进入古皮尔画廊做学徒', kind: '事业' }, { date: '1880-08-01', what: '决心成为画家', kind: '事业' },
      { date: '1885-03-26', what: '父亲去世', kind: '家庭' }, { date: '1886-03-01', what: '移居巴黎投奔提奥', kind: '迁居' },
      { date: '1888-02-20', what: '移居阿尔勒', kind: '迁居' }, { date: '1888-12-23', what: '精神危机（割耳事件）', kind: '健康' },
      { date: '1889-05-08', what: '住进圣雷米疗养院', kind: '健康' },
    ],
  },
  {
    id: 'elizabeth1', name: '伊丽莎白一世', en: 'Elizabeth I', role: '英国女王',
    birth: { date: '1533-09-17', time: '14:54', tz: 0, lat: 51.48, lon: 0, place: '格林尼治宫' }, clock: '地方平时（由"下午三点"视时换算）',
    rating: 'AA', source: 'Astro-Databank（AA）；霍尔与赖奥思利的同代编年史都记"下午三点左右"',
    note: '原始记录是儒略历 9 月 7 日；这里换算成格里高利历 9 月 17 日，星历才能算对。',
    bio: ['父亲亨利八世，母亲安妮·博林在她不到 3 岁时被处死。', '25 岁继位，在位 44 年；终身未婚，自称"嫁给了英格兰"。', '1588 年击退西班牙无敌舰队。'],
    events: [
      { date: '1536-05-29', what: '母亲被处死（儒略历 5 月 19 日）', kind: '家庭' }, { date: '1547-02-07', what: '父亲去世（儒略历 1 月 28 日）', kind: '家庭' },
      { date: '1554-03-28', what: '被姐姐玛丽一世关进伦敦塔', kind: '挫折' }, { date: '1558-11-27', what: '继位为女王（儒略历 11 月 17 日）', kind: '事业' },
      { date: '1588-08-08', what: '格拉沃利讷海战，无敌舰队战败（儒略历 7 月 29 日）', kind: '荣誉' },
    ],
  },
  {
    id: 'benedict', name: '本笃十六世', en: 'Pope Benedict XVI', role: '神学家、教宗',
    birth: { date: '1927-04-16', time: '04:15', tz: 1, lat: 48.25, lon: 12.85, place: '德国马克特尔' }, clock: '中欧时间',
    rating: 'AA', source: 'Astro-Databank（引用出生证明）；帕绍教区的记载',
    bio: ['巴伐利亚警察之子，1951 年晋铎，以神学教授成名。', '1977 年任慕尼黑总主教、枢机；1981 年起任信理部部长 24 年。', '2005 年当选教宗；2013 年主动辞职，是近 600 年来第一位。'],
    events: [
      { date: '1951-06-29', what: '晋铎', kind: '信仰' }, { date: '1959-04-15', what: '任波恩大学教授', kind: '事业' },
      { date: '1977-05-28', what: '任慕尼黑总主教', kind: '信仰' }, { date: '1981-11-25', what: '任信理部部长', kind: '事业' },
      { date: '2005-04-19', what: '当选教宗', kind: '信仰' }, { date: '2013-02-28', what: '辞去教宗职务，隐居修院', kind: '信仰' },
    ],
  },
  {
    id: 'garbo', name: '葛丽泰·嘉宝', en: 'Greta Garbo', role: '演员',
    birth: { date: '1905-09-18', time: '19:30', tz: 1, lat: 59.33, lon: 18.05, place: '瑞典斯德哥尔摩' }, clock: '中欧时间',
    rating: 'AA', source: 'Astro-Databank（出生记录）；与多家星盘库一致',
    bio: ['出身贫寒，14 岁父亲病逝后辍学打工。', '1925 年去好莱坞，成为默片和有声片时代的巨星。', '1941 年 36 岁息影，此后 49 年在纽约深居简出，终身未婚。'],
    events: [
      { date: '1920-06-01', what: '父亲去世', kind: '家庭' }, { date: '1925-07-06', what: '抵达美国', kind: '迁居' },
      { date: '1926-02-09', what: '《激流》上映，一举成名', kind: '事业' }, { date: '1939-11-09', what: '《妮诺契卡》上映', kind: '事业' },
      { date: '1941-11-30', what: '《双面女人》上映后息影', kind: '事业' }, { date: '1951-02-09', what: '入籍美国', kind: '迁居' },
    ],
  },
  {
    id: 'monroe', name: '玛丽莲·梦露', en: 'Marilyn Monroe', role: '演员',
    birth: { date: '1926-06-01', time: '09:30', tz: -8, lat: 34.05, lon: -118.25, place: '美国洛杉矶' }, clock: '太平洋标准时间',
    rating: 'AA', source: 'Astro-Databank（出生证明）；与多家星盘库一致',
    bio: ['生父不详，母亲长期住院，童年辗转寄养家庭和孤儿院。', '16 岁第一次结婚；1950 年代成为好莱坞最知名的明星。', '先后与棒球明星迪马乔、剧作家阿瑟·米勒结婚又离婚。'],
    events: [
      { date: '1942-06-19', what: '第一次结婚', kind: '婚恋' }, { date: '1946-08-26', what: '与福克斯签约', kind: '事业' },
      { date: '1953-07-29', what: '《绅士爱美人》上映', kind: '事业' }, { date: '1954-01-14', what: '与迪马乔结婚', kind: '婚恋' },
      { date: '1956-06-29', what: '与阿瑟·米勒结婚', kind: '婚恋' }, { date: '1961-01-20', what: '与米勒离婚', kind: '婚恋' },
    ],
  },
  {
    id: 'hemingway', name: '海明威', en: 'Ernest Hemingway', role: '作家',
    birth: { date: '1899-07-21', time: '08:00', tz: -6, lat: 41.89, lon: -87.79, place: '美国伊利诺伊州橡树园' }, clock: '中部标准时间',
    rating: 'AA', source: 'Astro-Databank（母亲剪贴簿的当时记录）；与多家星盘库一致',
    bio: ['医生之子，高中毕业做记者；一战在意大利开救护车时重伤。', '1926 年《太阳照常升起》成名；四次结婚。', '1952 年《老人与海》，1954 年获诺贝尔文学奖。'],
    events: [
      { date: '1918-07-08', what: '在意大利前线重伤', kind: '健康' }, { date: '1921-09-03', what: '第一次结婚（哈德莉）', kind: '婚恋' },
      { date: '1926-10-22', what: '《太阳照常升起》出版', kind: '事业' }, { date: '1928-12-06', what: '父亲去世', kind: '家庭' },
      { date: '1940-11-21', what: '第三次结婚（玛莎）', kind: '婚恋' }, { date: '1954-10-28', what: '获诺贝尔文学奖', kind: '荣誉' },
    ],
  },
  {
    id: 'margaret', name: '玛格丽特公主', en: 'Princess Margaret', role: '英国公主',
    birth: { date: '1930-08-21', time: '21:22', tz: 1, lat: 56.62, lon: -3.0, place: '苏格兰格拉姆斯城堡' }, clock: '英国夏令时',
    rating: 'AA', source: 'Astro-Databank（官方公告）；1930 年 8 月 24 日《星期日快报》刊出的星盘',
    bio: ['乔治六世次女、伊丽莎白二世的妹妹。', '她出生三天后，《星期日快报》请占星师纳勒为她写星盘文章，引出了后来的报纸星座专栏（第 8 阶段）。', '1955 年放弃与离过婚的汤森上校结婚；1960 年嫁给摄影师阿姆斯特朗-琼斯，1978 年离婚。'],
    events: [
      { date: '1936-12-11', what: '伯父退位，父亲继位为王', kind: '家庭' }, { date: '1952-02-06', what: '父亲去世', kind: '家庭' },
      { date: '1955-10-31', what: '宣布不与汤森结婚', kind: '婚恋' }, { date: '1960-05-06', what: '与阿姆斯特朗-琼斯结婚', kind: '婚恋' },
      { date: '1978-07-11', what: '离婚', kind: '婚恋' },
    ],
  },
  {
    id: 'elizabeth2', name: '伊丽莎白二世', en: 'Queen Elizabeth II', role: '英国女王',
    birth: { date: '1926-04-21', time: '02:40', tz: 1, lat: 51.5, lon: -0.15, place: '伦敦梅费尔' }, clock: '英国夏令时',
    rating: 'AA', source: 'Astro-Databank（引用官方记录）；《伦敦公报》"差二十分三点"',
    bio: ['出生时并非王储；10 岁时伯父退位、父亲继位，她成为第一继承人。', '1947 年与菲利普结婚，婚姻持续 73 年。', '25 岁继位，在位 70 年，是英国在位最久的君主。'],
    events: [
      { date: '1936-12-11', what: '父亲继位，成为第一继承人', kind: '家庭' }, { date: '1947-11-20', what: '与菲利普结婚', kind: '婚恋' },
      { date: '1948-11-14', what: '长子查尔斯出生', kind: '家庭' }, { date: '1952-02-06', what: '父亲去世，继位为女王', kind: '事业' },
      { date: '1953-06-02', what: '加冕', kind: '荣誉' }, { date: '1992-11-24', what: '"可怕的一年"演讲（温莎城堡火灾、三个子女婚变）', kind: '挫折' },
    ],
  },
  {
    id: 'jfk', name: '约翰·肯尼迪', en: 'John F. Kennedy', role: '政治家',
    birth: { date: '1917-05-29', time: '15:00', tz: -5, lat: 42.33, lon: -71.12, place: '美国马萨诸塞州布鲁克莱恩' }, clock: '东部标准时间',
    rating: 'A', source: 'Astro-Databank（评级 A，来自母亲）；与多家星盘库一致',
    bio: ['政治世家次子；二战中指挥的鱼雷艇被撞沉，带伤救出队员。', '1946 年当选众议员，1952 年当选参议员。', '1960 年 43 岁当选总统。'],
    events: [
      { date: '1943-08-02', what: 'PT-109 鱼雷艇被撞沉', kind: '健康' }, { date: '1944-08-12', what: '兄长小约瑟夫阵亡', kind: '家庭' },
      { date: '1946-11-05', what: '当选众议员', kind: '事业' }, { date: '1952-11-04', what: '当选参议员', kind: '事业' },
      { date: '1953-09-12', what: '与杰奎琳结婚', kind: '婚恋' }, { date: '1960-11-08', what: '当选总统', kind: '事业' },
    ],
  },
]

export const caseById = (id: string) => CASES.find((c) => c.id === id)
