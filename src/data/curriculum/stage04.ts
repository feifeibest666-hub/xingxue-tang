import { withReviewMix } from './build'
import { S04A } from './stage04a'
import { S04B } from './stage04b'
import { S04C } from './stage04c'

export const STAGE04 = withReviewMix([...S04A, ...S04B, ...S04C])
