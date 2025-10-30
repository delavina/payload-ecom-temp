'use client'
import { AddToCart } from '@/components/Cart/AddToCart'
import { Price } from '@/components/Price'
import { StockIndicator } from '@/components/product/StockIndicator'
import { RichText } from '@/components/RichText'
import { Button } from '@/components/ui/button'
import type { Product, Variant } from '@/payload-types'
import { useCurrency } from '@payloadcms/plugin-ecommerce/client/react'
import { CheckCircle2, Download } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { VariantSelector } from './VariantSelector'

export function ProductDescriptionClient({ 
  product,
  alreadyPurchased = false 
}: { 
  product: Product
  alreadyPurchased?: boolean
}) {

  const { currency } = useCurrency()
  let amount = 0,
    lowestAmount = 0,
    highestAmount = 0

  const priceField = `priceIn${currency.code}` as keyof Product
  const hasVariants = product.enableVariants && Boolean(product.variants?.docs?.length)

  if (hasVariants) {
    const priceField = `priceIn${currency.code}` as keyof Variant
    const variantsOrderedByPrice = product.variants?.docs
      ?.filter((variant) => variant && typeof variant === 'object')
      .sort((a, b) => {
        if (
          typeof a === 'object' &&
          typeof b === 'object' &&
          priceField in a &&
          priceField in b &&
          typeof a[priceField] === 'number' &&
          typeof b[priceField] === 'number'
        ) {
          return a[priceField] - b[priceField]
        }
        return 0
      }) as Variant[]

    const lowestVariant = variantsOrderedByPrice[0][priceField]
    const highestVariant = variantsOrderedByPrice[variantsOrderedByPrice.length - 1][priceField]

    if (
      variantsOrderedByPrice &&
      typeof lowestVariant === 'number' &&
      typeof highestVariant === 'number'
    ) {
      lowestAmount = lowestVariant
      highestAmount = highestVariant
    }
  } else if (product[priceField] && typeof product[priceField] === 'number') {
    amount = product[priceField]
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-medium">{product.title}</h1>
        <div className="uppercase font-mono">
          {hasVariants ? (
            <Price highestAmount={highestAmount} lowestAmount={lowestAmount} />
          ) : (
            <Price amount={amount} />
          )}
        </div>
      </div>

      {/* 🆕 Already Purchased Badge */}
      {product.isDigital && alreadyPurchased && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            Already Purchased
          </span>
        </div>
      )}

      {product.description ? (
        <RichText className="" data={product.description} enableGutter={false} />
      ) : null}

      <hr />

      {hasVariants && (
        <>
          <Suspense fallback={null}>
            <VariantSelector product={product} />
          </Suspense>
          <hr />
        </>
      )}

      <div className="flex items-center justify-between">
        <Suspense fallback={null}>
          <StockIndicator product={product} />
        </Suspense>
      </div>

      <div className="flex items-center justify-between">
        {/* 🆕 Conditional: View Downloads button or Add to Cart */}
        {product.isDigital && alreadyPurchased ? (
          <Button asChild className="w-full" size="lg">
            <Link href="/downloads" className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              View My Downloads
            </Link>
          </Button>
        ) : (
          <Suspense fallback={null}>
            {/* 🆕 Pass hideQuantity prop for digital products */}
            <AddToCart product={product} />
          </Suspense>
        )}
      </div>
    </div>
  )
}