import type { Plugin, Field } from 'payload'

/**
 * Plugin to extend the Variants collection from the ecommerce plugin
 * with digitalFile support for variant-specific digital downloads.
 *
 * This plugin must be added AFTER the ecommercePlugin in the plugins array.
 */
export const variantsExtensionPlugin: Plugin = (incomingConfig) => {
  console.log('[Variants Plugin] Extending variants collection...')

  const collections = incomingConfig.collections || []
  const variantsCollection = collections.find((c) => c.slug === 'variants')

  if (!variantsCollection) {
    console.warn('⚠️  Variants collection not found - ecommerce plugin may not be loaded')
    return incomingConfig
  }

  const modifiedCollections = collections.map((collection) => {
    if (collection.slug === 'variants') {
      // Add digitalFile field
      const digitalFileField: Field = {
        name: 'digitalFile',
        type: 'upload',
        relationTo: 'media',
        required: false,
        admin: {
          description:
            'Digitale Datei für diese Variante (optional). Wird verwendet, wenn das Produkt digital ist und verschiedene Dateien pro Variante hat.',
        },
        label: 'Digitale Datei',
      }

      return {
        ...collection,
        admin: {
          ...collection.admin,
          hidden: false, // Make visible in admin
          group: 'E-Commerce',
          useAsTitle: 'title',
        },
        fields: [...collection.fields, digitalFileField],
      }
    }

    return collection
  })

  console.log('✅ Variants collection extended with digitalFile field')

  return {
    ...incomingConfig,
    collections: modifiedCollections,
  }
}
