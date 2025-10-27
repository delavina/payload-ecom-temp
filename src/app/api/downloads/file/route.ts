import config from '@payload-config'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

function verifyToken(
  token: string,
  orderId: string,
  productId: string,
  userId: string
): boolean {
  try {
    const secret = process.env.DOWNLOAD_SECRET || 'your-secret-key-change-this'
    const decoded = Buffer.from(token, 'base64url').toString()
    const [hash, timestamp] = decoded.split(':')

    // Token-Alter prüfen (5 Minuten Gültigkeit)
    const tokenAge = Date.now() - parseInt(timestamp)
    const maxAge = 5 * 60 * 1000 // 5 Minuten
    
    if (tokenAge > maxAge) {
      console.log('[File Download] Token expired - Age:', tokenAge, 'ms')
      return false
    }

    // Hash verifizieren
    const data = `${orderId}:${productId}:${userId}:${timestamp}`
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex')

    const isValid = hash === expectedHash
    if (!isValid) {
      console.log('[File Download] Invalid token hash')
    }

    return isValid
  } catch (error) {
    console.error('[File Download] Token verification error:', error)
    return false
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = await getPayload({ config })
    const { searchParams } = new URL(req.url)
    
    const token = searchParams.get('token')
    const orderId = searchParams.get('order')
    const productId = searchParams.get('product')

    console.log('[File Download] Request for order:', orderId, 'product:', productId)

    if (!token || !orderId || !productId) {
      return NextResponse.json(
        { error: 'Fehlende Parameter' },
        { status: 400 }
      )
    }

    // 1. User authentifizieren
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    // 2. Token verifizieren
    if (!verifyToken(token, orderId, productId, user.id)) {
      return NextResponse.json(
        { error: 'Ungültiger oder abgelaufener Token' },
        { status: 403 }
      )
    }

    // 3. Bestellung laden und verifizieren
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

    const orderCustomerId = typeof order.customer === 'string' 
      ? order.customer 
      : order.customer?.id

    const isAdmin = user.roles?.includes('admin')

    if (orderCustomerId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'Keine Berechtigung' },
        { status: 403 }
      )
    }

    // 4. Produkt und Datei laden
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 2,
    })

    if (!product.isDigital || !product.digitalFile) {
      return NextResponse.json(
        { error: 'Keine digitale Datei verfügbar' },
        { status: 404 }
      )
    }

    // 5. Datei-Informationen extrahieren
    const file = typeof product.digitalFile === 'string' 
      ? await payload.findByID({
          collection: 'media',
          id: product.digitalFile,
        })
      : product.digitalFile

    console.log('[File Download] Delivering file:', file.filename)

    // 6. Datei ausliefern - Proxy statt Redirect
    if (file.url) {
      console.log('[File Download] File URL:', file.url)
      
      // Baue absolute URL
      let fileUrl = file.url
      if (fileUrl.startsWith('/')) {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        fileUrl = `${baseUrl}${fileUrl}`
      }
      
      console.log('[File Download] Fetching file from:', fileUrl)

      try {
        // Hole Datei von Payload mit unseren Auth-Cookies
        const fileResponse = await fetch(fileUrl, {
          headers: {
            // Kopiere alle Auth-Header vom ursprünglichen Request
            cookie: req.headers.get('cookie') || '',
          },
        })

        if (!fileResponse.ok) {
          console.error('[File Download] Failed to fetch file:', fileResponse.status)
          return NextResponse.json(
            { error: 'Datei konnte nicht geladen werden' },
            { status: 500 }
          )
        }

        // Hole Datei-Body als Buffer
        const arrayBuffer = await fileResponse.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        console.log('[File Download] ✅ Streaming file to user:', file.filename)

        // Sende Datei direkt an User
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': file.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename || 'download')}"`,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          },
        })
      } catch (fetchError) {
        console.error('[File Download] Error fetching file:', fetchError)
        return NextResponse.json(
          { error: 'Fehler beim Laden der Datei' },
          { status: 500 }
        )
      }
    }

    // Für lokalen Storage (falls du das verwendest)
    // Hinweis: Payload speichert Dateien normalerweise in /media oder verwendet einen Storage Adapter
    return NextResponse.json(
      { error: 'Datei-URL nicht verfügbar. Bitte Storage-Adapter konfigurieren.' },
      { status: 500 }
    )

  } catch (error) {
    console.error('[File Download] Error:', error)
    return NextResponse.json(
      { error: 'Download fehlgeschlagen' },
      { status: 500 }
    )
  }
}