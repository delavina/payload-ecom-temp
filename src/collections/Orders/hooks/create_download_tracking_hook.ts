import type { Order } from '@/payload-types'
import type { CollectionAfterChangeHook } from 'payload'

export const createDownloadTracking: CollectionAfterChangeHook<Order> = async ({
  doc,
  req,
  operation,
}) => {
  // Nur bei neuen, abgeschlossenen Bestellungen
  if (operation === 'create' && doc.status === 'completed') {
    const { payload } = req

    console.log('[Download Tracking] Processing completed order:', doc.id)

    // Durchlaufe alle Items in der Bestellung
    for (const item of doc.items || []) {
      try {
        // Produkt laden um zu prüfen ob es digital ist
        const productId = typeof item.product === 'string' ? item.product : item.product?.id

        if (!productId) {
          console.log('[Download Tracking] Skipping item - no product ID')
          continue
        }

        const product = await payload.findByID({
          collection: 'products',
          id: productId,
        })

        // Erstelle Tracking nur für digitale Produkte
        if (product.isDigital && product.digitalFile) {
          console.log('[Download Tracking] Creating tracking for digital product:', product.title)

          // Berechne Ablaufdatum
          const expiryDate = new Date()
          expiryDate.setDate(expiryDate.getDate() + (product.downloadExpiryDays || 30))

          // Prüfe ob bereits ein Tracking-Eintrag existiert
          const existingTracking = await payload.find({
            collection: 'download-tracking',
            where: {
              and: [
                { order: { equals: doc.id } },
                { product: { equals: product.id } },
              ],
            },
          })

          // Erstelle nur wenn noch kein Eintrag existiert
          if (existingTracking.docs.length === 0) {
            await payload.create({
              collection: 'download-tracking',
              data: {
                order: doc.id,
                product: product.id,
                user: doc.customer,
                downloadCount: 0,
                maxDownloads: product.downloadLimit || 3,
                expiresAt: expiryDate.toISOString(),
              },
            })

            console.log('[Download Tracking] Successfully created tracking entry')
          } else {
            console.log('[Download Tracking] Tracking entry already exists, skipping')
          }
        }
      } catch (error) {
        console.error('[Download Tracking] Error processing item:', error)
        // Weiter mit nächstem Item, nicht den ganzen Prozess abbrechen
      }
    }
  }

  return doc
}
