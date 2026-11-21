import { withReviewMix } from './build'
import { S14_A } from './stage14a'
import { S14_B } from './stage14b'

export const STAGE14 = withReviewMix([...S14_A, ...S14_B])
