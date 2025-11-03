import config from '@payload-config'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

function verifyToken(
  token: string,
  orderId: string,
  productId: string,
  userId: string,
  variantId?: string,
): boolean {
  try {
    const secret = process.env.DOWNLOAD_SECRET || 'your-secret-key-change-this'
    const decoded = Buffer.from(token, 'base64url').toString()
    const [hash, timestamp] = decoded.split(':')

    // Token check (5 minutes validity)
    const tokenAge = Date.now() - parseInt(timestamp)
    const maxAge = 5 * 60 * 1000 // 5 minutes

    if (tokenAge > maxAge) {
      console.log('[File Download] Token expired - Age:', tokenAge, 'ms')
      return false
    }

    // verify Hash (including variant)
    const data = `${orderId}:${productId}:${userId}:${variantId || 'no-variant'}:${timestamp}`
    const expectedHash = crypto.createHmac('sha256', secret).update(data).digest('hex')

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
    const variantId = searchParams.get('variant')

    console.log(
      '[File Download] Request for order:',
      orderId,
      'product:',
      productId,
      'variant:',
      variantId || 'none',
    )

    if (!token || !orderId || !productId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // 1. User authentication
    const { user } = await payload.auth({ headers: req.headers })

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // 2. Token verification (including variant)
    if (!verifyToken(token, orderId, productId, user.id, variantId || undefined)) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 })
    }

    // 3. Order loading and verification
    const order = await payload.findByID({
      collection: 'orders',
      id: orderId,
    })

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const orderCustomerId = typeof order.customer === 'string' 
      ? order.customer 
      : order.customer?.id

    const isAdmin = user.roles?.includes('admin')

    if (orderCustomerId !== user.id && !isAdmin) {
      return NextResponse.json(
        { error: 'No permission' },
        { status: 403 }
      )
    }

    // 4. Product and file loading
    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 2,
    })

    if (!product.isDigital) {
      return NextResponse.json({ error: 'Product is not digital' }, { status: 404 })
    }

    // Determine which file to serve: variant-specific or product fallback
    let digitalFileId = product.digitalFile
    let fileSource = 'product'

    if (variantId) {
      try {
        const variant = await payload.findByID({
          collection: 'variants',
          id: variantId,
          depth: 1,
        })

        if (variant.digitalFile) {
          digitalFileId = variant.digitalFile
          fileSource = 'variant'
          console.log('[File Download] Using variant-specific file')
        } else {
          console.log('[File Download] Variant has no file, using product fallback')
        }
      } catch (error) {
        console.error('[File Download] Error loading variant, using product fallback:', error)
      }
    }

    if (!digitalFileId) {
      return NextResponse.json({ error: 'No digital file available' }, { status: 404 })
    }

    // 5. File information extraction
    const file =
      typeof digitalFileId === 'string'
        ? await payload.findByID({
            collection: 'media',
            id: digitalFileId,
          })
        : digitalFileId

    console.log('[File Download] Delivering file:', file.filename, `(from ${fileSource})`)

    // 6. File delivery - Proxy instead of Redirect
    if (file.url) {
      console.log('[File Download] File URL:', file.url)
      
      // Build absolute URL
      let fileUrl = file.url
      if (fileUrl.startsWith('/')) {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
        fileUrl = `${baseUrl}${fileUrl}`
      }
      
      console.log('[File Download] Fetching file from:', fileUrl)

      try {
        // Fetch file from Payload with our Auth-Cookies
        const fileResponse = await fetch(fileUrl, {
          headers: {
            cookie: req.headers.get('cookie') || '',
          },
        })

        if (!fileResponse.ok) {
          console.error('[File Download] Failed to fetch file:', fileResponse.status)
          return NextResponse.json(
            { error: 'File could not be loaded' },
            { status: 500 }
          )
        }

        // Fetch file body as Buffer
        const arrayBuffer = await fileResponse.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        console.log('[File Download] ✅ Streaming file to user:', file.filename)

        // Force download for all file types (including images)
        const mimeType = file.mimeType || 'application/octet-stream'
        
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(file.filename || 'download')}"`,
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Content-Type-Options': 'nosniff',
            'X-Download-Options': 'noopen',
          },
        })
      } catch (fetchError) {
        console.error('[File Download] Error fetching file:', fetchError)
        return NextResponse.json(
          { error: 'Error loading file' },
          { status: 500 }
        )
      }
    }

    // For local storage (if used)
    return NextResponse.json(
      { error: 'File URL not available. Please configure Storage Adapter.' },
      { status: 500 }
    )

  } catch (error) {
    console.error('[File Download] Error:', error)
    return NextResponse.json(
      { error: 'Download failed' },
      { status: 500 }
    )
  }
}