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

  // Collect all purchased digital product IDs with variant info
  // For products with variants: key is "productId:variantId", for products without: key is just "productId"
  const purchasedDigitalItems = new Map<string, string>() // key -> title

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
          const hasVariants = Boolean(product.enableVariants && product.variants?.docs?.length)
          const variantId = typeof item.variant === 'string' ? item.variant : item.variant?.id

          if (hasVariants && variantId) {
            // For products with variants: track product+variant combination
            const key = `${productId}:${variantId}`
            purchasedDigitalItems.set(key, `${product.title} (Variant: ${variantId})`)
            console.log('[Checkout Check] Found purchased variant:', key)
          } else if (!hasVariants) {
            // For products without variants: track product only
            purchasedDigitalItems.set(productId, product.title)
            console.log('[Checkout Check] Found purchased product:', productId)
          }
        }
      } catch (error) {
        console.error('[Checkout Check] Error loading product:', productId, error)
      }
    }
  }

  console.log('[Checkout Check] User has purchased', purchasedDigitalItems.size, 'digital items')

  // Check each item in the new transaction
  const duplicates: string[] = []

  for (const item of data.items) {
    const productId = typeof item.product === 'string'
      ? item.product
      : item.product?.id

    if (!productId) continue

    // Check if this is a product with variants
    let hasVariants = false
    try {
      const product = await payload.findByID({
        collection: 'products',
        id: productId,
      })
      hasVariants = Boolean(product.enableVariants && product.variants?.docs?.length)
    } catch (error) {
      console.error('[Checkout Check] Error loading product for variant check:', productId)
      continue
    }

    const variantId = typeof item.variant === 'string' ? item.variant : item.variant?.id

    let checkKey: string
    if (hasVariants && variantId) {
      // Check specific variant
      checkKey = `${productId}:${variantId}`
    } else {
      // Check product without variant
      checkKey = productId
    }

    if (purchasedDigitalItems.has(checkKey)) {
      const title = purchasedDigitalItems.get(checkKey)!
      duplicates.push(title)
      console.log('[Checkout Check] Duplicate found:', title)
    }
  }

  if (duplicates.length > 0) {
    const errorMessage =
      duplicates.length === 1
        ? `Dieses digitale Produkt oder diese Variante "${duplicates[0]}" wurde bereits erworben und kann nicht erneut gekauft werden. Besuchen Sie /downloads um auf Ihre Datei zuzugreifen.`
        : `Folgende digitale Produkte oder Varianten wurden bereits erworben und können nicht erneut gekauft werden: ${duplicates.join(', ')}. Besuchen Sie /downloads um auf Ihre Dateien zuzugreifen.`

    console.log('[Checkout Check] Blocking purchase:', errorMessage)
    throw new Error(errorMessage)
  }

  console.log('[Checkout Check] No duplicates found, allowing purchase')
  return data
}