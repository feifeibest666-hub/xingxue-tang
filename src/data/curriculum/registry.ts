import type { Lesson } from '../types'
import type { WidgetMap } from '../../components/widgets/common'

export interface StageEntry {
  lessons: () => Promise<Lesson[]>
  widgets?: () => Promise<WidgetMap>
}

export const BUILT: Record<number, StageEntry> = {
  1: { lessons: () => import('./stage01').then((m) => m.STAGE01) },
  2: { lessons: () => import('./stage02').then((m) => m.STAGE02), widgets: () => import('../../components/widgets/stage02').then((m) => m.W02) },
  3: { lessons: () => import('./stage03').then((m) => m.STAGE03), widgets: () => import('../../components/widgets/stage03').then((m) => m.W03) },
  4: { lessons: () => import('./stage04').then((m) => m.STAGE04), widgets: () => import('../../components/widgets/stage04').then((m) => m.W04) },
  5: { lessons: () => import('./stage05').then((m) => m.STAGE05), widgets: () => import('../../components/widgets/stage05').then((m) => m.W05) },
  6: { lessons: () => import('./stage06').then((m) => m.STAGE06), widgets: () => import('../../components/widgets/stage06').then((m) => m.W06) },
  7: { lessons: () => import('./stage07').then((m) => m.STAGE07), widgets: () => import('../../components/widgets/stage07').then((m) => m.W07) },
  8: { lessons: () => import('./stage08').then((m) => m.STAGE08), widgets: () => import('../../components/widgets/stage08').then((m) => m.W08) },
  9: { lessons: () => import('./stage09').then((m) => m.STAGE09), widgets: () => import('../../components/widgets/stage09').then((m) => m.W09) },
  10: { lessons: () => import('./stage10').then((m) => m.STAGE10), widgets: () => import('../../components/widgets/stage10').then((m) => m.W10) },
  11: { lessons: () => import('./stage11').then((m) => m.STAGE11), widgets: () => import('../../components/widgets/stage11').then((m) => m.W11) },
  12: { lessons: () => import('./stage12').then((m) => m.STAGE12), widgets: () => import('../../components/widgets/stage12').then((m) => m.W12) },
  13: { lessons: () => import('./stage13').then((m) => m.STAGE13), widgets: () => import('../../components/widgets/stage13').then((m) => m.W13) },
  14: { lessons: () => import('./stage14').then((m) => m.STAGE14), widgets: () => import('../../components/widgets/stage14').then((m) => m.W14) },
  15: { lessons: () => import('./stage15').then((m) => m.STAGE15), widgets: () => import('../../components/widgets/stage15').then((m) => m.W15) },
  16: { lessons: () => import('./stage16').then((m) => m.STAGE16), widgets: () => import('../../components/widgets/stage16').then((m) => m.W16) },
  17: { lessons: () => import('./stage17').then((m) => m.STAGE17), widgets: () => import('../../components/widgets/stage17').then((m) => m.W17) },
}
