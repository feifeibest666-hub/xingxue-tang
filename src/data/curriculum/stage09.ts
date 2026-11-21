import type { Lesson } from '../types'
import { withReviewMix } from './build'
import { S09A } from './stage09a'
import { S09B } from './stage09b'

const lessons: Lesson[] = [...S09A, ...S09B]
const grad = lessons.find((l) => l.day === 399)
if (grad) grad.cert = true

export const STAGE09 = withReviewMix(lessons)
