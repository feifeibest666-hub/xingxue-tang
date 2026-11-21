import { withReviewMix } from './build'
import { S05A } from './stage05a'
import { S05B } from './stage05b'

export const STAGE05 = withReviewMix([...S05A, ...S05B])
