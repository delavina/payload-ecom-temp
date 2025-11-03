import type { CollectionConfig } from 'payload'

export const DownloadTracking: CollectionConfig = {
  slug: 'download-tracking',
  admin: {
    useAsTitle: 'id',
    description: 'Tracking for digital product downloads',
    defaultColumns: [
      'order',
      'product',
      'variant',
      'user',
      'downloadCount',
      'maxDownloads',
      'expiresAt',
    ],
    group: 'E-Commerce',
  },
  access: {
    // Only admins can view this collection directly
    read: ({ req: { user } }) => {
      if (!user) return false
      return user.roles?.includes('admin') ?? false
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      return user.roles?.includes('admin') ?? false
    },
  },
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      hasMany: false,
      admin: {
        description: 'The related order',
      },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      hasMany: false,
      admin: {
        description: 'The digital product',
      },
    },
    {
      name: 'variant',
      type: 'relationship',
      relationTo: 'variants',
      required: false,
      hasMany: false,
      admin: {
        description:
          'The specific variant purchased (optional - only for products with variants)',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      hasMany: false,
      admin: {
        description: 'The customer (if registered)',
      },
    },
    {
      name: 'downloadCount',
      type: 'number',
      defaultValue: 0,
      required: true,
      admin: {
        description: 'Number of downloads so far',
        readOnly: true,
      },
    },
    {
      name: 'maxDownloads',
      type: 'number',
      required: true,
      admin: {
        description: 'Maximum number of allowed downloads',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: {
        description: 'Date, until downloads are possible',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'lastDownloadAt',
      type: 'date',
      admin: {
        description: 'Timestamp of the last download',
        readOnly: true,
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'ipAddresses',
      type: 'array',
      admin: {
        description: 'IP addresses of all downloads (for abuse detection)',
        readOnly: true,
      },
      fields: [
        {
          name: 'ip',
          type: 'text',
          required: true,
        },
        {
          name: 'timestamp',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
  ],
  timestamps: true,
}
