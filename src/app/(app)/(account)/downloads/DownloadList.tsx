'use client'

import { useEffect, useState } from 'react'

interface DownloadItem {
  order: {
    id: string
    createdAt: string
    status: string
  }
  product: {
    id: string
    title: string
    slug: string
  }
  tracking: {
    id: string
    downloadCount: number
    maxDownloads: number
    expiresAt: string
    lastDownloadAt?: string | null
  }
}

export function DownloadsList({ items }: { items: DownloadItem[] }) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
   const [mounted, setMounted] = useState(false)

     // Verhindere Hydration-Fehler bei Datum-Formatierung
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDownload = async (orderId: string, productId: string) => {
    const key = `${orderId}-${productId}`
    setLoading(prev => ({ ...prev, [key]: true }))
    setError(null)

    try {
      console.log('[Download] Requesting URL for:', { orderId, productId })

      // 1. Presigned URL anfordern
      const response = await fetch('/api/downloads/generate-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Wichtig für Cookie-basierte Auth
        body: JSON.stringify({ orderId, productId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Download fehlgeschlagen')
      }

      const data = await response.json()
      console.log('[Download] Got URL, starting download...')

      // 2. Download starten
      window.location.href = data.downloadUrl

      // 3. Seite neu laden um Zähler zu aktualisieren (nach kurzer Verzögerung)
      setTimeout(() => {
        window.location.reload()
      }, 1500)

    } catch (err) {
      console.error('[Download] Error:', err)
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten')
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const formatDate = (dateString: string) => {
     if (!mounted) return dateString.split('T')[0] // Fallback für SSR
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  const formatDateTime = (dateString: string) => {
    if (!mounted) return dateString.split('T')[0] // Fallback für SSR
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start">
          <svg
            className="h-5 w-5 text-red-400 mr-3 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="font-medium">Fehler beim Download</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="grid gap-6">
        {items.map(({ order, product, tracking }) => {
          const key = `${order.id}-${product.id}`
          const isExpired = new Date(tracking.expiresAt) < new Date()
          const downloadsRemaining = tracking.maxDownloads - tracking.downloadCount
          const canDownload = !isExpired && downloadsRemaining > 0

          return (
            <div
              key={key}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 truncate">
                    {product.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-4">
                    Bestellt am: <span className="font-medium">{formatDate(order.createdAt)}</span>
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`h-5 w-5 ${downloadsRemaining > 0 ? 'text-green-500' : 'text-red-500'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">Downloads verbleibend:</span>
                      <span className={`font-bold ${downloadsRemaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {downloadsRemaining} von {tracking.maxDownloads}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <svg
                        className={`h-5 w-5 ${isExpired ? 'text-red-500' : 'text-blue-500'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">Gültig bis:</span>
                      <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-900'}>
                        {formatDate(tracking.expiresAt)}
                      </span>
                    </div>

                    {tracking.lastDownloadAt && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Letzter Download:</span>
                        <span>{formatDateTime(tracking.lastDownloadAt)}</span>
                      </div>
                    )}
                  </div>

                  {isExpired && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800 flex items-start">
                        <svg className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>
                          Dieser Download ist abgelaufen. Bitte kontaktieren Sie den Support, 
                          falls Sie weitere Downloads benötigen.
                        </span>
                      </p>
                    </div>
                  )}

                  {!isExpired && downloadsRemaining === 0 && (
                    <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-md">
                      <p className="text-sm text-orange-800 flex items-start">
                        <svg className="h-5 w-5 text-orange-400 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>
                          Download-Limit erreicht. Bitte kontaktieren Sie den Support für 
                          weitere Downloads.
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDownload(order.id, product.id)}
                  disabled={!canDownload || loading[key]}
                  className={`
                    flex-shrink-0 px-6 py-3 rounded-lg font-medium transition-all
                    flex items-center gap-2 min-w-[140px] justify-center
                    ${
                      canDownload && !loading[key]
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {loading[key] ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Laden...</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Download</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}