import type { Payload } from 'payload'

/**
 * Check if a specific variant of a digital product was purchased
 * Returns true if the exact variant was purchased
 */
export async function checkIfVariantPurchased(
  payload: Payload,
  userId: string | undefined,
  productId: string,
  variantId: string,
): Promise<boolean> {
  console.log('[Purchase Check] Checking variant purchase:', { userId, productId, variantId })

  if (!userId) {
    console.log('[Purchase Check] No user ID')
    return false
  }

  try {
    const orders = await payload.find({
      collection: 'orders',
      where: {
        and: [
          {
            customer: {
              equals: userId,
            },
          },
          {
            status: {
              equals: 'completed',
            },
          },
        ],
      },
      depth: 2,
    })

    console.log('[Purchase Check] Found orders:', orders.docs.length)

    const hasPurchased = orders.docs.some((order) => {
      const items = order.items || []
      return items.some((item) => {
        const product = typeof item.product === 'object' ? item.product : null
        const itemVariantId = typeof item.variant === 'string' ? item.variant : item.variant?.id

        const matches =
          product?.id === productId &&
          product?.isDigital === true &&
          itemVariantId === variantId

        if (matches) {
          console.log('[Purchase Check] ✅ FOUND VARIANT PURCHASE:', product.title, 'Variant:', variantId)
        }
        return matches
      })
    })

    console.log('[Purchase Check] Variant Result:', hasPurchased)
    return hasPurchased
  } catch (error) {
    console.error('[Purchase Check] Error:', error)
    return false
  }
}

/**
 * Check if a digital product (without variants) was purchased
 * For products with variants, use checkIfVariantPurchased instead
 */
export async function checkIfProductPurchased(
  payload: Payload,
  userId: string | undefined,
  productId: string,
): Promise<boolean> {
  console.log('[Purchase Check] Checking purchase:', { userId, productId })

  if (!userId) {
    console.log('[Purchase Check] No user ID')
    return false
  }

  try {
    const orders = await payload.find({
      collection: 'orders',
      where: {
        and: [
          {
            customer: {
              equals: userId,
            },
          },
          {
            status: {
              equals: 'completed',
            },
          },
        ],
      },
      depth: 2,
    })

    console.log('[Purchase Check] Found orders:', orders.docs.length)

    const hasPurchased = orders.docs.some((order) => {
      const items = order.items || []
      return items.some((item) => {
        const product = typeof item.product === 'object' ? item.product : null
        const matches = product?.id === productId && product?.isDigital === true
        if (matches) {
          console.log('[Purchase Check] ✅ FOUND PURCHASE:', product.title)
        }
        return matches
      })
    })

    console.log('[Purchase Check] Result:', hasPurchased)
    return hasPurchased
  } catch (error) {
    console.error('[Purchase Check] Error:', error)
    return false
  }
}