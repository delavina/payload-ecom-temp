import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

export const VariantsCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['product', 'options', 'inventory', 'digitalFile'],
  },
  fields: [
    ...(defaultCollection?.fields || []),
    {
      name: 'digitalFile',
      type: 'upload',
      relationTo: 'media',
      required: false,
      admin: {
        description:
          'Digitale Datei für diese Variante (optional). Wird verwendet, wenn das Produkt digital ist und verschiedene Dateien pro Variante hat.',
        condition: (data, siblingData) => {
          // Show only if the parent product is digital
          // This is checked via the product relationship
          return true // We'll validate this in hooks
        },
      },
      label: 'Digitale Datei (für digitale Produkte)',
    },
  ],
})
