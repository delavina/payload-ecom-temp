// Re-export everything from payload-types
export * from '../payload-types'

// Import types we need to extend
import type { Variant as GeneratedVariant, Media } from '../payload-types'

// Override Variant with extended version
export interface Variant extends Omit<GeneratedVariant, 'digitalFile'> {
  digitalFile?: (string | Media) | null
}
