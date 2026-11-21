import type { Lesson } from '../types'
import { withReviewMix } from './build'
import { S07A } from './stage07a'
import { S07B } from './stage07b'
import { S07C } from './stage07c'

const lessons: Lesson[] = [...S07A, ...S07B, ...S07C]
const grad = lessons.find((l) => l.day === 315)
if (grad) grad.cert = true

export const STAGE07 = withReviewMix(lessons)
