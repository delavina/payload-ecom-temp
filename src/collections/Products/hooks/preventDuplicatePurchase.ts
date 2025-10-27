import type { FieldHook } from 'payload'

/**
 * Hook der prüft ob ein User dieses digitale Produkt bereits gekauft hat
 * Wird beim Add-to-Cart verwendet
 */
export const preventDuplicatePurchase: FieldHook = async ({ req, value, data }) => {
  const { payload, user } = req

  // Nur prüfen wenn User eingeloggt ist
  if (!user) return value

  // Nur bei digitalen Produkten prüfen
  const productId = data?.id || value

  if (!productId) return value

  try {
    // Lade Produkt um zu prüfen ob digital
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
    })

    if (!product.isDigital) {
      // Nicht-digitale Produkte können mehrfach gekauft werden
      return value
    }

    // Prüfe ob User bereits eine abgeschlossene Bestellung mit diesem Produkt hat
    const existingOrders = await payload.find({
      collection: 'orders',
      where: {
        and: [
          { customer: { equals: user.id } },
          { status: { equals: 'completed' } },
        ],
      },
      limit: 100,
    })

    // Durchsuche alle Orders nach diesem Produkt
    for (const order of existingOrders.docs) {
      const hasProduct = order.items?.some(item => {
        const itemProductId = typeof item.product === 'string' 
          ? item.product 
          : item.product?.id
        return itemProductId === productId
      })

      if (hasProduct) {
        // User hat dieses Produkt bereits gekauft
        throw new Error(
          `Sie haben "${product.title}" bereits erworben. Digitale Produkte können nicht mehrfach gekauft werden. Besuchen Sie die Downloads-Seite um auf Ihre Datei zuzugreifen.`
        )
      }
    }

    return value
  } catch (error) {
    // Wenn es unser eigener Error ist, werfen wir ihn weiter
    if (error instanceof Error && error.message.includes('bereits erworben')) {
      throw error
    }
    
    // Bei anderen Fehlern loggen und durchlassen (fail-open)
    console.error('[Duplicate Purchase Check] Error:', error)
    return value
  }
}