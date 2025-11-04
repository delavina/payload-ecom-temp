import type { Transaction } from '@/types'
import type { CollectionAfterChangeHook } from 'payload'

/**
 * Wird nach Transaction-Update ausgeführt
 * Erstellt/Updated Order und Download-Tracking wenn Transaction succeeded
 */
export const handleTransactionSuccess: CollectionAfterChangeHook<Transaction> = async ({
  doc,
  req,
  previousDoc,
}) => {
  const { payload } = req

  // Only react to status change to "succeeded"
  const wasSuccessful = previousDoc?.status !== 'succeeded' && doc.status === 'succeeded'
  
  if (!wasSuccessful) {
    return doc
  }

  console.log('[Transaction Success] Processing transaction:', doc.id)

  try {
    let orderId: string | undefined

    // 1. Get or create Order
    if (doc.order) {
      orderId = typeof doc.order === 'string' ? doc.order : doc.order.id
      
      console.log('[Transaction Success] Found existing order:', orderId)
      
      // Update Order Status zu completed
      await payload.update({
        collection: 'orders',
        id: orderId,
        data: {
          status: 'completed',
        },
      })
      
      console.log('[Transaction Success] Order status updated to completed')
    } else {
      // Create new Order
      console.log('[Transaction Success] Creating new order from transaction')
      
      const newOrder = await payload.create({
        collection: 'orders',
        data: {
          customer: doc.customer,
          customerEmail: doc.customerEmail,
          items: doc.items,
          amount: doc.amount,
          currency: doc.currency,
          status: 'completed',
          transactions: [doc.id],
        },
      })

      orderId = newOrder.id
      
      console.log('[Transaction Success] Created order:', orderId)

      // Link Transaction with Order
      await payload.update({
        collection: 'transactions',
        id: doc.id,
        data: {
          order: orderId,
        },
      })
    }

    // 2. Create Download-Tracking for digital products
    console.log('[Transaction Success] Checking for digital products in order')

    for (const item of doc.items || []) {
      try {
        const productId = typeof item.product === 'string'
          ? item.product
          : item.product?.id

        if (!productId) {
          console.log('[Transaction Success] Skipping item - no product ID')
          continue
        }

        // Load product
        const product = await payload.findByID({
          collection: 'products',
          id: productId,
        })

        // Only digital products
        if (!product.isDigital) {
          continue
        }

        console.log('[Transaction Success] Found digital product:', product.title)

        // Check for variant
        const variantId = typeof item.variant === 'string' ? item.variant : item.variant?.id
        let digitalFile = product.digitalFile
        let variantInfo = ''

        // If product has variants, check if the variant has its own digital file
        if (variantId) {
          try {
            const variant = await payload.findByID({
              collection: 'variants',
              id: variantId,
            })

            // Use variant's digital file if available, otherwise fall back to product's file
            if (variant.digitalFile) {
              digitalFile = variant.digitalFile
              variantInfo = ` (Variant: ${variantId})`
              console.log(
                '[Transaction Success] Using variant-specific digital file for variant:',
                variantId,
              )
            } else {
              console.log(
                '[Transaction Success] Variant has no digital file, using product fallback',
              )
            }
          } catch (error) {
            console.error('[Transaction Success] Error loading variant:', error)
          }
        }

        // Skip if no digital file is available (neither on product nor variant)
        if (!digitalFile) {
          console.log('[Transaction Success] No digital file available, skipping')
          continue
        }

        // Check if tracking already exists for this product + variant combination
        const whereConditions: any = {
          and: [
            { order: { equals: orderId } },
            { product: { equals: productId } },
          ],
        }

        // Add variant condition if present
        if (variantId) {
          whereConditions.and.push({ variant: { equals: variantId } })
        }

        const existingTracking = await payload.find({
          collection: 'download-tracking',
          where: whereConditions,
          limit: 1,
        })

        if (existingTracking.docs.length > 0) {
          console.log('[Transaction Success] Download tracking already exists, skipping')
          continue
        }

        // Calculate expiry date
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + (product.downloadExpiryDays || 30))

        // Create Download-Tracking with variant reference
        await payload.create({
          collection: 'download-tracking',
          data: {
            order: orderId,
            product: productId,
            variant: variantId || undefined,
            user: doc.customer,
            downloadCount: 0,
            maxDownloads: product.downloadLimit || 3,
            expiresAt: expiryDate.toISOString(),
          },
        })

        console.log(
          '[Transaction Success] ✅ Created download tracking for:',
          product.title + variantInfo,
        )
      } catch (error) {
        console.error('[Transaction Success] Error processing item:', error)
      }
    }

    console.log('[Transaction Success] ✅ Processing complete')
    return doc
  } catch (error) {
    console.error('[Transaction Success] Error:', error)
    return doc
  }
}