import { withReviewMix } from './build'
import { S03A } from './stage03a'
import { S03B } from './stage03b'
import { S03C } from './stage03c'

export const STAGE03 = withReviewMix([...S03A, ...S03B, ...S03C])
