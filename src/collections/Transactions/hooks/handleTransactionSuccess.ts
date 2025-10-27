import type { Transaction } from '@/payload-types'
import type { CollectionAfterChangeHook } from 'payload'

/**
 * Wird nach Transaction-Update ausgeführt
 * Erstellt/Updated Order und Download-Tracking wenn Transaction succeeded
 */
export const handleTransactionSuccess: CollectionAfterChangeHook<Transaction> = async ({
  doc,
  req,
  previousDoc,
  operation,
}) => {
  const { payload } = req

  // Nur bei Status-Änderung zu "succeeded" reagieren
  const wasSuccessful = previousDoc?.status !== 'succeeded' && doc.status === 'succeeded'
  
  if (!wasSuccessful) {
    return doc
  }

  console.log('[Transaction Success] Processing transaction:', doc.id)

  try {
    let orderId: string | undefined

    // 1. Hole oder erstelle Order
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
      // Erstelle neue Order
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

      // Verknüpfe Transaction mit Order
      await payload.update({
        collection: 'transactions',
        id: doc.id,
        data: {
          order: orderId,
        },
      })
    }

    // 2. Erstelle Download-Tracking für digitale Produkte
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

        // Lade Produkt
        const product = await payload.findByID({
          collection: 'products',
          id: productId,
        })

        // Nur digitale Produkte
        if (!product.isDigital || !product.digitalFile) {
          continue
        }

        console.log('[Transaction Success] Found digital product:', product.title)

        // Prüfe ob bereits Tracking existiert
        const existingTracking = await payload.find({
          collection: 'download-tracking',
          where: {
            and: [
              { order: { equals: orderId } },
              { product: { equals: productId } },
            ],
          },
          limit: 1,
        })

        if (existingTracking.docs.length > 0) {
          console.log('[Transaction Success] Download tracking already exists, skipping')
          continue
        }

        // Berechne Ablaufdatum
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() + (product.downloadExpiryDays || 30))

        // Erstelle Download-Tracking
        await payload.create({
          collection: 'download-tracking',
          data: {
            order: orderId,
            product: productId,
            user: doc.customer,
            downloadCount: 0,
            maxDownloads: product.downloadLimit || 3,
            expiresAt: expiryDate.toISOString(),
          },
        })

        console.log('[Transaction Success] ✅ Created download tracking for:', product.title)
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