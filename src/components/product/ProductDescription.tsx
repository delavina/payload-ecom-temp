import { checkIfProductPurchased } from '@/lib/checkIfPurchased'
import type { Product } from '@/payload-types'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import { ProductDescriptionClient } from './ProductDescriptionClient'

export async function ProductDescription({ product }: { product: Product }) {
  // Server-side: Check if already purchased
  const headersList = await headers()
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: headersList as Headers })
  
  const alreadyPurchased = product.isDigital 
    ? await checkIfProductPurchased(payload, user?.id, product.id)
    : false

  console.log('[ProductDescription Server] alreadyPurchased:', alreadyPurchased, 'for user:', user?.id)

  // Pass to client component
  return <ProductDescriptionClient product={product} alreadyPurchased={alreadyPurchased} />
}