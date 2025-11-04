'use client'
import { Button } from '@/components/ui/button'
import type { Product, Variant } from '@/payload-types'

import { useCart } from '@payloadcms/plugin-ecommerce/client/react'
import clsx from 'clsx'
import { useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

type Props = {
  product: Product
}

export function AddToCart({ product }: Props) {
  const { addItem, cart } = useCart()
  const searchParams = useSearchParams()

  const selectedVariant = useMemo<Variant | undefined>(() => {
    const variants = product.variants?.docs || []
    if (product.enableVariants && variants.length) {
      const variantId = searchParams.get('variant')
      const validVariant = variants.find((variant) => {
        if (typeof variant === 'object') {
          return String(variant.id) === variantId
        }
        return String(variant) === variantId
      })

      if (validVariant && typeof validVariant === 'object') {
        return validVariant
      }
    }
    return undefined
  }, [product.enableVariants, searchParams, product.variants?.docs])

  const addToCart = useCallback(
    (e: React.FormEvent<HTMLButtonElement>) => {
      e.preventDefault()

      // For digital Products: Check if already in cart
      // For products with variants: check product + variant combination
      if (product.isDigital) {
        const hasVariants = product.enableVariants && Boolean(product.variants?.docs?.length)

        const alreadyInCart = cart?.items?.some((item) => {
          const productID = typeof item.product === 'object' ? item.product?.id : item.product
          const itemVariantID = item.variant
            ? typeof item.variant === 'object'
              ? item.variant?.id
              : item.variant
            : undefined

          if (productID !== product.id) {
            return false
          }

          // For products with variants: check if the exact variant is in cart
          if (hasVariants) {
            return itemVariantID === selectedVariant?.id
          }

          // For products without variants: product match is enough
          return true
        })

        if (alreadyInCart) {
          if (hasVariants) {
            toast.error('This variant is already in your cart.')
          } else {
            toast.error('This digital product is already in your cart.')
          }
          return
        }
      }

      addItem({
        product: product.id,
        variant: selectedVariant?.id ?? undefined,
      }, 
      product.isDigital ? 1 : undefined // Quantity as second argument
    ).then(() => {
        toast.success('Item added to cart.')
      })
    },
    [addItem, product, selectedVariant, cart?.items],
  )

  const disabled = useMemo<boolean>(() => {
    const existingItem = cart?.items?.find((item) => {
      const productID = typeof item.product === 'object' ? item.product?.id : item.product
      const variantID = item.variant
        ? typeof item.variant === 'object'
          ? item.variant?.id
          : item.variant
        : undefined

      if (productID === product.id) {
        if (product.enableVariants) {
          return variantID === selectedVariant?.id
        }
        return true
      }
    })

    // 🆕 For digital Products: Disable button if already in cart
    if (existingItem && product.isDigital) {
      return true
    }

    if (existingItem) {
      const existingQuantity = existingItem.quantity
      if (product.enableVariants) {
        return existingQuantity >= (selectedVariant?.inventory || 0)
      }
      return existingQuantity >= (product.inventory || 0)
    }

    if (product.enableVariants) {
      if (!selectedVariant) {
        return true
      }
      if (selectedVariant.inventory === 0) {
        return true
      }
    } else {
      if (product.inventory === 0) {
        return true
      }
    }

    return false
  }, [selectedVariant, cart?.items, product])

  return (
    <Button
      aria-label="Add to cart"
      variant={'outline'}
      className={clsx({
        'hover:opacity-90': true,
      })}
      disabled={disabled}
      onClick={addToCart}
      type="submit"
    >
      Add To Cart
    </Button>
  )
}