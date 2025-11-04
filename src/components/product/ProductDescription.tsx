import { checkIfProductPurchased, checkIfVariantPurchased } from '@/lib/checkIfPurchased'
import type { Product } from '@/payload-types'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { ProductDescriptionClient } from './ProductDescriptionClient'

export async function ProductDescription({
  product,
  searchParams,
}: {
  product: Product
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  // Server-side: Check if already purchased
  const headersList = await headers()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: headersList as Headers })

  let alreadyPurchased = false

  if (product.isDigital) {
    // Check if product has variants
    const hasVariants = product.enableVariants && Boolean(product.variants?.docs?.length)
    const variantId = searchParams?.variant as string | undefined

    if (hasVariants && variantId) {
      // For products with variants: check if THIS specific variant was purchased
      alreadyPurchased = await checkIfVariantPurchased(payload, user?.id, product.id, variantId)
      console.log(
        '[ProductDescription Server] Variant purchase check:',
        alreadyPurchased,
        'for variant:',
        variantId,
      )
    } else if (!hasVariants) {
      // For products without variants: check if product was purchased
      alreadyPurchased = await checkIfProductPurchased(payload, user?.id, product.id)
      console.log('[ProductDescription Server] Product purchase check:', alreadyPurchased)
    }
    // If product has variants but no variant is selected, alreadyPurchased remains false
  }

  // Pass to client component
  return <ProductDescriptionClient product={product} alreadyPurchased={alreadyPurchased} />
}