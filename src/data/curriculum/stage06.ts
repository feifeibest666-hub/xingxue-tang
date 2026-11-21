import type { Lesson } from '../types'
import { withReviewMix } from './build'
import { S06A } from './stage06a'
import { S06B } from './stage06b'
import { S06C } from './stage06c'

export const STAGE06: Lesson[] = withReviewMix([...S06A, ...S06B, ...S06C])
