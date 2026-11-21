import { withReviewMix } from './build'
import { S13_A } from './stage13a'
import { S13_B } from './stage13b'

export const STAGE13 = withReviewMix([...S13_A, ...S13_B])
