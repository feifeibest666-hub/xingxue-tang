import { withReviewMix } from './build'
import { S15_A } from './stage15a'
import { S15_B } from './stage15b'

export const STAGE15 = withReviewMix([...S15_A, ...S15_B])
