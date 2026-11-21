import type { WidgetMap } from './common'
import type { HouseSystem } from '../../lib/natal'
import { ChartWidget, EmphasisWidget, MyBirthWidget, ScaleWidget, SevenStepsWidget, TemperamentWidget } from './natal'

const s = (v: unknown) => (typeof v === 'string' ? v : undefined)
const ids = (v: unknown) => (Array.isArray(v) ? (v as string[]) : undefined)

/** 第 7 阶段的互动部件：名字 → 渲染函数 */
export const W07: WidgetMap = {
  chart: (a) => <ChartWidget src={s(a.src)} theme={s(a.theme)} sys={s(a.sys) as HouseSystem | undefined} ids={ids(a.ids)} sidereal={Boolean(a.sidereal)} facts={a.facts !== false} />,
  sevenSteps: (a) => <SevenStepsWidget src={s(a.src)} ids={ids(a.ids)} />,
  evidenceScale: (a) => <ScaleWidget cards={(a.cards as [string, number][]) ?? []} left={s(a.left)} right={s(a.right)} />,
  temperament: (a) => <TemperamentWidget src={s(a.src)} />,
  emphasis: (a) => <EmphasisWidget src={s(a.src)} outer={Boolean(a.outer)} />,
  myBirth: () => <MyBirthWidget />,
}
