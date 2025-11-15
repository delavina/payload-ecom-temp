import type { Attachment } from 'nodemailer/lib/mailer'
import type { EmailAdapter, SendEmailOptions } from 'payload'
import { APIError } from 'payload'

export type BrevoAdapterArgs = {
  apiKey: string
  defaultFromAddress: string
  defaultFromName: string
  enabled?: boolean
}

type BrevoAdapter = EmailAdapter<BrevoResponse>

type BrevoError = {
  code: string
  message: string
}

type BrevoResponse = { messageId: string } | BrevoError

type BrevoTemplateParams = {
  templateId?: number
  params?: Record<string, unknown>
}

export const brevoAdapter = (args: BrevoAdapterArgs): BrevoAdapter => {
  const { apiKey, defaultFromAddress, defaultFromName, enabled = true } = args

  const adapter: BrevoAdapter = () => ({
    name: 'brevo-rest',
    defaultFromAddress,
    defaultFromName,
    sendEmail: async (message) => {
      if (!enabled) {
        console.log('📧 Email sending disabled - logging to console:')
        console.log({
          from: message.from || `${defaultFromName} <${defaultFromAddress}>`,
          to: message.to,
          subject: message.subject,
        })
        return { messageId: 'dev-mode-mock-id' }
      }

      const sendEmailOptions = mapPayloadEmailToBrevoEmail(
        message,
        defaultFromAddress,
        defaultFromName,
      )

      // Validate API key and sender email before calling Brevo to provide clearer errors
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
        throw new APIError('Brevo API key missing or invalid', 400)
      }

      const senderEmail = sendEmailOptions?.sender?.email
      const simpleEmailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!senderEmail || !simpleEmailRe.test(senderEmail)) {
        throw new APIError(`Brevo sender email missing or invalid: ${String(senderEmail)}`, 400)
      }

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(sendEmailOptions),
      })

      const data = (await res.json()) as BrevoResponse

      if ('messageId' in data) {
        return data
      } else {
        const statusCode = res.status
        const formattedError = `Error sending email: ${statusCode} ${data.code || ''} - ${data.message || ''}`
        throw new APIError(formattedError, statusCode)
      }
    },
  })

  return adapter
}

function mapPayloadEmailToBrevoEmail(
  message: SendEmailOptions & BrevoTemplateParams,
  defaultFromAddress: string,
  defaultFromName: string,
): BrevoSendEmailOptions {
  const emailOptions: BrevoSendEmailOptions = {
    sender: mapFromAddress(message.from, defaultFromName, defaultFromAddress),
    to: mapAddresses(message.to) || [],
    subject: message.subject ?? '',
  }

  // Only include optional fields if they have values
  const bcc = mapAddresses(message.bcc)
  if (bcc && bcc.length > 0) {
    emailOptions.bcc = bcc
  }

  const cc = mapAddresses(message.cc)
  if (cc && cc.length > 0) {
    emailOptions.cc = cc
  }

  if (message.replyTo) {
    emailOptions.replyTo = mapFromAddress(message.replyTo, defaultFromName, defaultFromAddress)
  }

  const attachments = mapAttachments(message.attachments)
  if (attachments && attachments.length > 0) {
    emailOptions.attachment = attachments
  }

  if (message.templateId) {
    emailOptions.templateId = message.templateId
    if (message.params) {
      emailOptions.params = message.params
    }
  } else {
    emailOptions.htmlContent = message.html?.toString() || ''
    if (message.text) {
      emailOptions.textContent = message.text.toString()
    }
  }

  return emailOptions
}

function mapFromAddress(
  address:
    | string
    | { name?: string; address: string }
    | Array<string | { name?: string; address: string }>
    | undefined,
  defaultFromName: string,
  defaultFromAddress: string,
): BrevoSendEmailOptions['sender'] {
  if (!address) {
    return { name: defaultFromName, email: defaultFromAddress }
  }

  // Wenn es ein Array ist, nimm nur das erste Element
    if (Array.isArray(address)) {
    if (address.length === 0) {
      return { name: defaultFromName, email: defaultFromAddress }
    }
    address = address[0] // Nimm das erste Element
  }
  
  if (typeof address === 'string') {
    const match = address.match(/^(.+?)\s*<(.+?)>$/)
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() }
    }
    return { email: address }
  }

  return { name: address.name, email: address.address }
}

function mapAddresses(
  // addresses: SendEmailOptions['to'],
    addresses: 
    | string 
    | { name?: string; address: string } 
    | Array<string | { name?: string; address: string }> 
    | undefined,
): BrevoSendEmailOptions['to'] | undefined {
  if (!addresses) return undefined

  if (typeof addresses === 'string') {
    return [{ email: addresses }]
  }

  if (Array.isArray(addresses)) {
    return addresses.map((address) => {
      if (typeof address === 'string') {
        return { email: address }
      }
      return { email: address.address, name: address.name }
    })
  }

  return [{ email: addresses.address, name: addresses.name }]
}

function mapAttachments(
  attachments: SendEmailOptions['attachments'],
): BrevoSendEmailOptions['attachment'] {
  if (!attachments || attachments.length === 0) return undefined

  return (attachments as Attachment[]) .map((attachment) => {
    if (!attachment.filename || !attachment.content) {
      throw new APIError('Attachment is missing filename or content', 400)
    }

    let content: string

    if (typeof attachment.content === 'string') {
      content = Buffer.from(attachment.content).toString('base64')
    } else if (attachment.content instanceof Buffer) {
      content = attachment.content.toString('base64')
    } else {
      throw new APIError('Attachment content must be a string or Buffer', 400)
    }

    return { name: attachment.filename, content }
  })
}

type BrevoSendEmailOptions = {
  sender: { name?: string; email: string }
  to: Array<{ email: string; name?: string }>
  subject: string
  htmlContent?: string
  textContent?: string
  cc?: Array<{ email: string; name?: string }>
  bcc?: Array<{ email: string; name?: string }>
  replyTo?: { email: string; name?: string }
  attachment?: Array<{ name: string; content: string }>
  templateId?: number
  params?: Record<string, unknown>
  headers?: Record<string, string>
  tags?: string[]
}