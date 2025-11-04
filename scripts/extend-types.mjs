import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const typesPath = path.join(__dirname, '../src/payload-types.ts')

try {
  // Read the generated types
  let content = fs.readFileSync(typesPath, 'utf8')

  // Check if digitalFile already exists in Variant interface
  if (content.includes('digitalFile?: (string | Media) | null;')) {
    console.log('✅ Variant interface already has digitalFile field')
    process.exit(0)
  }

  // Find the Variant interface and add digitalFile before updatedAt
  const variantInterfaceRegex = /(export interface Variant \{[\s\S]*?priceInEUR\?: number \| null;)([\s\n]+updatedAt: string;)/

  if (variantInterfaceRegex.test(content)) {
    content = content.replace(
      variantInterfaceRegex,
      `$1
  /**
   * Digital file for this variant (optional). Used when the product is digital and has different files per variant.
   */
  digitalFile?: (string | Media) | null;$2`
    )

    // Also add to VariantsSelect interface if it exists
    const selectInterfaceRegex = /(export interface VariantsSelect<T extends boolean = true> \{[\s\S]*?priceInEUR\?: T;)([\s\n]+updatedAt\?: T;)/

    if (selectInterfaceRegex.test(content)) {
      content = content.replace(
        selectInterfaceRegex,
        `$1
  digitalFile?: T;$2`
      )
    }

    // Write back
    fs.writeFileSync(typesPath, content, 'utf8')
    console.log('✅ Extended Variant interface with digitalFile field')
  } else {
    console.warn('⚠️  Could not find Variant interface pattern to extend')
    console.log('Using type override in src/types/index.ts instead')
    process.exit(0) // Exit successfully, we have the type override as fallback
  }
} catch (error) {
  console.error('❌ Error extending types:', error.message)
  console.log('Using type override in src/types/index.ts as fallback')
  process.exit(0) // Exit successfully, we have the type override as fallback
}
