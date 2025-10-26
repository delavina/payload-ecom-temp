import config from '@payload-config'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

// Funktion zum Generieren eines sicheren Tokens
function generateSecureToken(orderId: string, productId: string, userId: string): string {
  const secret = process.env.DOWNLOAD_SECRET || 'your-secret-key-change-this'
  const timestamp = Date.now()
  const data = `${orderId}:${productId}:${userId}:${timestamp}`
  
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')
  
  // Token mit timestamp für Expiry
  return Buffer.from(`${hash}:${timestamp}`).toString('base64url')
}

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const body = await req.json()
    const { orderId, productId } = body

    console.log('[Generate URL] Request for order:', orderId, 'product:', productId)

    // 1. Authentifizierung prüfen
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    // 2. Bestellung verifizieren
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Bestellung nicht gefunden' },
        { status: 404 }
      )
    }

    // 3. Prüfen ob User die Bestellung besitzt
    const orderCustomerId = typeof order.customer === 'string' 
      ? order.customer 
      : order.customer?.id

    const isAdmin = user.roles?.includes('admin')

    if (orderCustomerId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Keine Berechtigung für diese Bestellung' },
        { status: 403 }
      )
    }

    // 4. Prüfen ob Produkt in Bestellung enthalten ist
    const orderItem = order.items?.find(item => {
      const itemProductId = typeof item.product === 'string' 
        ? item.product 
        : item.product?.id
      return itemProductId === productId
    })

    if (!orderItem) {
      return NextResponse.json(
        { error: 'Produkt nicht in dieser Bestellung enthalten' },
        { status: 404 }
      )
    }

    // 5. Produkt laden
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
    })

    if (!product.isDigital || !product.digitalFile) {
      return NextResponse.json(
        { error: 'Produkt ist nicht digital oder hat keine Datei' },
        { status: 400 }
      )
    }

    // 6. Download-Tracking laden
    const trackingDocs = await payload.find({
      collection: 'download-tracking',
      where: {
        and: [
          { order: { equals: orderId } },
          { product: { equals: productId } },
        ],
      },
    })

    const tracking = trackingDocs.docs[0]

    if (!tracking) {
      return NextResponse.json(
        { error: 'Download-Tracking nicht gefunden. Bitte kontaktieren Sie den Support.' },
        { status: 404 }
      )
    }

    // 7. Download-Limits prüfen
    if (tracking.downloadCount >= tracking.maxDownloads) {
      return NextResponse.json(
        { 
          error: 'Download-Limit erreicht',
          details: {
            downloaded: tracking.downloadCount,
            maximum: tracking.maxDownloads
          }
        },
        { status: 403 }
      )
    }

    // 8. Expiry prüfen
    if (new Date(tracking.expiresAt) < new Date()) {
      return NextResponse.json(
        { 
          error: 'Download-Link ist abgelaufen',
          details: {
            expiredAt: tracking.expiresAt
          }
        },
        { status: 403 }
      )
    }

    // 9. Generiere Presigned URL Token
    const token = generateSecureToken(orderId, productId, user.id)
    
    // 10. URL zusammenstellen
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const downloadUrl = `${baseUrl}/api/downloads/file?token=${token}&order=${orderId}&product=${productId}`

    // 11. Tracking aktualisieren
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown'

    await payload.update({
      collection: 'download-tracking',
      id: tracking.id,
      data: {
        downloadCount: tracking.downloadCount + 1,
        lastDownloadAt: new Date().toISOString(),
        ipAddresses: [
          ...(tracking.ipAddresses || []),
          {
            ip: clientIp,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    })

    console.log('[Generate URL] Success - Downloads remaining:', tracking.maxDownloads - tracking.downloadCount - 1)

    return NextResponse.json({
      downloadUrl,
      remainingDownloads: tracking.maxDownloads - tracking.downloadCount - 1,
      expiresAt: tracking.expiresAt,
      productTitle: product.title,
    })

  } catch (error) {
    console.error('[Generate URL] Error:', error)
    return NextResponse.json(
      { error: 'Interner Serverfehler' },
      { status: 500 }
    )
  }
}