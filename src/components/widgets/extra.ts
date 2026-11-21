import type { WidgetMap } from './common'
export const EXTRA: WidgetMap = {}
export const registerWidgets = (m: WidgetMap) => { Object.assign(EXTRA, m) }
