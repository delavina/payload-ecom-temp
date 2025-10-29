import type { Payload } from 'payload'

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