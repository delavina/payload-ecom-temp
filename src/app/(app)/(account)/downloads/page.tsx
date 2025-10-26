import config from '@payload-config'
import { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { DownloadsList } from './DownloadList'

export const metadata: Metadata = {
  title: 'Meine Downloads | Payload Ecommerce',
  description: 'Verwalten Sie Ihre digitalen Downloads',
}

export default async function DownloadsPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config })
  
  // User authentifizieren
  const { user } = await payload.auth({ headers })

  if (!user) {
    redirect('/login?redirect=/downloads')
  }

  console.log('[Downloads Page] Loading downloads for user:', user.id)

  // Alle abgeschlossenen Bestellungen des Users laden
  const orders = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { customer: { equals: user.id } },
        { status: { equals: 'completed' } },
      ],
    },
    depth: 2,
    limit: 100,
    sort: '-createdAt',
  })

  console.log('[Downloads Page] Found orders:', orders.docs.length)

  // Digitale Produkte aus Bestellungen extrahieren
  const digitalProducts = []

  for (const order of orders.docs) {
    for (const item of order.items || []) {
      const product = typeof item.product === 'string'
        ? await payload.findByID({
            collection: 'products',
            id: item.product,
            depth: 1,
          })
        : item.product

      if (product && product.isDigital && product.digitalFile) {
        // Download-Tracking laden
        const tracking = await payload.find({
          collection: 'download-tracking',
          where: {
            and: [
              { order: { equals: order.id } },
              { product: { equals: product.id } },
            ],
          },
          limit: 1,
        })

        if (tracking.docs.length > 0) {
          digitalProducts.push({
            order: {
              id: order.id,
              createdAt: order.createdAt,
              status: order.status || 'completed',
            },
            product: {
              id: product.id,
              title: product.title,
              slug: product.slug,
            },
            tracking: tracking.docs[0],
          })
        }
      }
    }
  }

  console.log('[Downloads Page] Found digital products:', digitalProducts.length)

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Meine Downloads</h1>
        <p className="text-gray-600">
          Hier finden Sie alle Ihre erworbenen digitalen Produkte
        </p>
      </div>
      
      {digitalProducts.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            Keine Downloads verfügbar
          </h3>
          <p className="text-gray-600 mb-4">
            Sie haben noch keine digitalen Produkte erworben.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Shop durchsuchen
          </Link>
        </div>
      ) : (
        <DownloadsList items={digitalProducts} />
      )}
    </div>
  )
}