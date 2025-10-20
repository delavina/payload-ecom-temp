'use client'
import { useCurrency } from '@payloadcms/plugin-ecommerce/client/react'
import React, { useCallback, useMemo } from 'react'

type BaseProps = {
  className?: string
  currencyCodeClassName?: string
  as?: 'span' | 'p'
}

type PriceFixed = {
  amount: number
  currencyCode?: string
  highestAmount?: never
  lowestAmount?: never
}

type PriceRange = {
  amount?: never
  currencyCode?: string
  highestAmount: number
  lowestAmount: number
}

type Props = BaseProps & (PriceFixed | PriceRange)

export const Price = ({
  amount,
  className,
  highestAmount,
  lowestAmount,
  currencyCode: currencyCodeFromProps,
  as = 'p',
}: Props & React.ComponentProps<'p'>) => {
   const { formatCurrency: originalFormatCurrency, supportedCurrencies } = useCurrency()

  // Custom formatCurrency that adds space between symbol and amount
  const formatCurrency = useCallback(
    (value: number, options?: Parameters<typeof originalFormatCurrency>[1]) => {
  const formatted = originalFormatCurrency(value, options)
  // Add space between currency symbol and amount if not already present
  return formatted.replace(/([€$£CHF])(\d)/, '$1\u2009$2')
  }, [originalFormatCurrency])

  const Element = as

  const currencyToUse = useMemo(() => {
    if (currencyCodeFromProps) {
      return supportedCurrencies.find((currency) => currency.code === currencyCodeFromProps)
    }
    return undefined
  }, [currencyCodeFromProps, supportedCurrencies])

  if (typeof amount === 'number') {
    return (
      <Element className={className} suppressHydrationWarning>
        {formatCurrency(amount, { currency: currencyToUse })}
      </Element>
    )
  }

  if (highestAmount && highestAmount !== lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {`${formatCurrency(lowestAmount, { currency: currencyToUse })} - ${formatCurrency(highestAmount, { currency: currencyToUse })}`}
      </Element>
    )
  }

  if (lowestAmount) {
    return (
      <Element className={className} suppressHydrationWarning>
        {`${formatCurrency(lowestAmount, { currency: currencyToUse })}`}
      </Element>
    )
  }

  return null
}
