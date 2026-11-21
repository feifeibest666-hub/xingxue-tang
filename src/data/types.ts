export type LessonKind = 'new' | 'practice' | 'case' | 'review'

/** 七种标签：一眼分清事实和说法 */
export type Tag = '天文' | '推导' | '传统' | '约定' | '争议' | '类比' | '小结'
export const TAGS: Tag[] = ['天文', '推导', '传统', '约定', '争议', '类比', '小结']

export type Screen =
  /** 钩子屏：开头抛出的大问题 */
  | { t: 'hook'; q: string; body?: string }
  /** 观察 / 例子 / 一般讲解，带标签 */
  | { t: 'text'; tag: Tag; title: string; body: string }
  /** 推导屏：每点一下出现下一步，最后高亮结论 */
  | { t: 'derive'; title: string; steps: { s: string; tag?: Tag }[]; result: string }
  /** 类比屏：左边日常场景，右边天文概念，底部"这个类比在哪里不成立" */
  | { t: 'analogy'; title: string; life: string; sky: string; pairs?: [string, string][]; breaks: string }
  /** 约定 / 争议屏：并列不同做法 */
  | { t: 'debate'; tag: '约定' | '争议'; title: string; body: string; sides?: { who: string; says: string }[] }
  /** 互动屏 */
  | { t: 'widget'; w: string; title: string; body?: string; tag?: Tag; args?: Record<string, unknown> }
  /** 连线屏：与旧知识连起来 */
  | { t: 'connect'; from: string[]; to: string; next?: string }
  /** 小结屏：3 条以内，带标签 */
  | { t: 'summary'; points: [Tag, string][] }
  /** 周易侧卡（可在设置里关闭） */
  | { t: 'yi'; title: string; body: string }
  /** 原典摘句 */
  | { t: 'quote'; text: string; source: string; note?: string }
  /** 实践课任务卡 */
  | { t: 'tasks'; title: string; intro?: string; tasks: string[] }
  /** 写三句话 / 记心得（只存本机） */
  | { t: 'write'; id: string; prompt: string; hint?: string; reference?: string }

export interface ChoiceQ { t: 'choice'; q: string; opts: string[]; a: number; ex: string; back?: number }
export interface SortQ { t: 'sort'; q: string; bins: string[]; items: [string, number][]; ex?: string }
export interface OrderQ { t: 'order'; q: string; steps: string[]; ex?: string }
export interface StepsQ { t: 'steps'; q: string; parts: { q: string; opts: string[]; a: number; ex: string }[] }
export interface CalcQ { t: 'calc'; q: string; answer: number; tol?: number; unit?: string; ex: string }
export interface ExplainQ { t: 'explain'; q: string; points: string[] }
export type Quiz = ChoiceQ | SortQ | OrderQ | StepsQ | CalcQ | ExplainQ

export interface QA { q: string; a: string; tag?: Tag }

export interface Lesson {
  day: number
  stage: number
  kind: LessonKind
  title: string
  /** 本课问题 */
  question: string
  cover?: string
  minutes?: number
  screens: Screen[]
  quiz: Quiz[]
  qa: QA[]
  /** 知识星网：本课点亮的概念 */
  star?: string
  /** 阶段毕业课：讲解清单全部勾选后生成证书 */
  cert?: boolean
}

export const KIND_LABEL: Record<LessonKind, string> = { new: '新课', practice: '实践', case: '案例', review: '复盘' }
