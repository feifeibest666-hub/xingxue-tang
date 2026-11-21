import { withReviewMix } from './build'
import { S17_A } from './stage17a'
import { S17_B } from './stage17b'

export const STAGE17 = withReviewMix([...S17_A, ...S17_B])
