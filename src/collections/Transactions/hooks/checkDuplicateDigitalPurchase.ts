import type { Transaction } from '@/payload-types'
import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Prevents digital products from being purchased multiple times
 * Runs when a Transaction is created (before checkout)
 */
export const checkDuplicateDigitalPurchase: CollectionBeforeChangeHook<Transaction> = async ({
  data,
  req,
  operation,
}) => {
  const { payload, user } = req
  
// Only check for new Transactions
  if (operation !== 'create') {
    return data
  }

  // Only check if user is logged in
  if (!user || !data.items?.length) {
    return data
  }

  console.log('[Checkout Check] Checking for duplicate digital purchases for user:', user.id)

  // Get all completed orders of the user
  const completedOrders = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { customer: { equals: user.id } },
        { status: { equals: 'completed' } },
      ],
    },
    limit: 200,
    depth: 1,
  })

  console.log('[Checkout Check] User has', completedOrders.docs.length, 'completed orders')

  // Collect all purchased digital product IDs with names
  const purchasedDigitalProducts = new Map<string, string>() // id -> title
  
  for (const order of completedOrders.docs) {
    for (const item of order.items || []) {
      const productId = typeof item.product === 'string' 
        ? item.product 
        : item.product?.id

      if (!productId) continue

      // Load product to check if it is digital
      try {
        const product = await payload.findByID({
          collection: 'products',
          id: productId,
        })

        if (product.isDigital) {
          purchasedDigitalProducts.set(productId, product.title)
        }
      } catch (error) {
        console.error('[Checkout Check] Error loading product:', productId, error)
      }
    }
  }

  console.log('[Checkout Check] User has purchased', purchasedDigitalProducts.size, 'digital products')

  // Check each item in the new transaction
  const duplicates: string[] = []

  for (const item of data.items) {
    const productId = typeof item.product === 'string' 
      ? item.product 
      : item.product?.id

    if (!productId) continue

    if (purchasedDigitalProducts.has(productId)) {
      const title = purchasedDigitalProducts.get(productId)!
      duplicates.push(title)
      console.log('[Checkout Check] Duplicate found:', title)
    }
  }

  if (duplicates.length > 0) {
    const errorMessage = duplicates.length === 1
      ? `Das digitale Produkt "${duplicates[0]}" wurde bereits erworben und kann nicht erneut gekauft werden. Besuchen Sie /downloads um auf Ihre Datei zuzugreifen.`
      : `Folgende digitale Produkte wurden bereits erworben und können nicht erneut gekauft werden: ${duplicates.join(', ')}. Besuchen Sie /downloads um auf Ihre Dateien zuzugreifen.`
    
    console.log('[Checkout Check] Blocking purchase:', errorMessage)
    throw new Error(errorMessage)
  }

  console.log('[Checkout Check] No duplicates found, allowing purchase')
  return data
}