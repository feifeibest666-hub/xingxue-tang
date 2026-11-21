import { withReviewMix } from './build'
import { S16_A } from './stage16a'
import { S16_B } from './stage16b'

export const STAGE16 = withReviewMix([...S16_A, ...S16_B])
