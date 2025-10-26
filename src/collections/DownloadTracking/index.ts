import type { CollectionConfig } from 'payload'

export const DownloadTracking: CollectionConfig = {
  slug: 'download-tracking',
  admin: {
    useAsTitle: 'id',
    description: 'Tracking für digitale Produkt-Downloads',
    defaultColumns: ['order', 'product', 'user', 'downloadCount', 'maxDownloads', 'expiresAt'],
    group: 'E-Commerce',
  },
  access: {
    // Nur Admins können diese Collection direkt sehen
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
        description: 'Die zugehörige Bestellung',
      },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      hasMany: false,
      admin: {
        description: 'Das digitale Produkt',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: false,
      hasMany: false,
      admin: {
        description: 'Der Käufer (falls registriert)',
      },
    },
    {
      name: 'downloadCount',
      type: 'number',
      defaultValue: 0,
      required: true,
      admin: {
        description: 'Anzahl der bisherigen Downloads',
        readOnly: true,
      },
    },
    {
      name: 'maxDownloads',
      type: 'number',
      required: true,
      admin: {
        description: 'Maximale Anzahl erlaubter Downloads',
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: {
        description: 'Datum, bis zu dem Downloads möglich sind',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'lastDownloadAt',
      type: 'date',
      admin: {
        description: 'Zeitpunkt des letzten Downloads',
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
        description: 'IP-Adressen aller Downloads (zur Missbrauchserkennung)',
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
