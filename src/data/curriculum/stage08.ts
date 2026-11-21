import type { Lesson } from '../types'
import { withReviewMix } from './build'
import { S08A } from './stage08a'
import { S08B } from './stage08b'

const lessons: Lesson[] = [...S08A, ...S08B]
const grad = lessons.find((l) => l.day === 350)
if (grad) grad.cert = true

export const STAGE08 = withReviewMix(lessons)
