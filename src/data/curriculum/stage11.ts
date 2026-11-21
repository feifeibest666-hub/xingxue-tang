import type { Lesson } from '../types'
import { withReviewMix } from './build'
import { S11A } from './stage11a'

const lessons: Lesson[] = [...S11A]
const grad = lessons.find((l) => l.day === 476)
if (grad) grad.cert = true

export const STAGE11 = withReviewMix(lessons)
