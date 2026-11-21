import type { Lesson } from '../types'
import { withReviewMix } from './build'
import { S10A } from './stage10a'
import { S10B } from './stage10b'

const lessons: Lesson[] = [...S10A, ...S10B]
const grad = lessons.find((l) => l.day === 455)
if (grad) grad.cert = true

export const STAGE10 = withReviewMix(lessons)
