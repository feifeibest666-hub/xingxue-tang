import { withReviewMix } from './build'
import { S02A } from './stage02a'
import { S02B } from './stage02b'

export const STAGE02 = withReviewMix([...S02A, ...S02B])
