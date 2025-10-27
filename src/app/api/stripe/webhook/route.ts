import config from '@payload-config';
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover',
});

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    console.error('[Stripe Webhook] Missing signature')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOKS_SIGNING_SECRET!
    )
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err}` },
      { status: 400 }
    )
  }

  console.log('[Stripe Webhook] Event received:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded': {
        const session = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent

        console.log('[Stripe Webhook] Payment succeeded:', session.id)

        // Finde die Transaction über Stripe Payment Intent ID
        let paymentIntentId: string | undefined

        if (event.type === 'checkout.session.completed') {
          paymentIntentId = (session as Stripe.Checkout.Session).payment_intent as string
        } else {
          paymentIntentId = session.id
        }

        if (!paymentIntentId) {
          console.log('[Stripe Webhook] No payment intent ID found')
          break
        }

        // Finde Transaction mit dieser Payment Intent ID
        const transactions = await payload.find({
          collection: 'transactions',
          where: {
            'stripe.paymentIntentID': {
              equals: paymentIntentId,
            },
          },
          limit: 1,
        })

        const transaction = transactions.docs[0]

        if (!transaction) {
          console.log('[Stripe Webhook] Transaction not found for payment intent:', paymentIntentId)
          break
        }

        console.log('[Stripe Webhook] Found transaction:', transaction.id)

        // Update Transaction Status
        await payload.update({
          collection: 'transactions',
          id: transaction.id,
          data: {
            status: 'succeeded',
          },
        })

        // Finde oder erstelle Order
        let order = transaction.order
          ? typeof transaction.order === 'string'
            ? await payload.findByID({
                collection: 'orders',
                id: transaction.order,
              })
            : transaction.order
          : null

        if (!order) {
          // Erstelle neue Order aus Transaction
          console.log('[Stripe Webhook] Creating new order from transaction')
          
          const newOrder = await payload.create({
            collection: 'orders',
            data: {
              customer: transaction.customer,
              customerEmail: transaction.customerEmail,
              items: transaction.items,
              amount: transaction.amount,
              currency: transaction.currency,
              status: 'completed',
              transactions: [transaction.id],
            },
          })

          order = newOrder

          // Verknüpfe Order mit Transaction
          await payload.update({
            collection: 'transactions',
            id: transaction.id,
            data: {
              order: newOrder.id,
            },
          })

          console.log('[Stripe Webhook] Created order:', order.id)
        } else {
          // Update bestehende Order
          console.log('[Stripe Webhook] Updating existing order:', order.id)
          
          await payload.update({
            collection: 'orders',
            id: order.id,
            data: {
              status: 'completed',
            },
          })
        }

        console.log('[Stripe Webhook] Order completed, download tracking will be created by hook')

        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        console.log('[Stripe Webhook] Payment failed:', paymentIntent.id)

        const transactions = await payload.find({
          collection: 'transactions',
          where: {
            'stripe.paymentIntentID': {
              equals: paymentIntent.id,
            },
          },
          limit: 1,
        })

        if (transactions.docs[0]) {
          await payload.update({
            collection: 'transactions',
            id: transactions.docs[0].id,
            data: {
              status: 'failed',
            },
          })

          if (transactions.docs[0].order) {
            const orderId = typeof transactions.docs[0].order === 'string' 
              ? transactions.docs[0].order 
              : transactions.docs[0].order.id

            await payload.update({
              collection: 'orders',
              id: orderId,
              data: {
                status: 'cancelled',
              },
            })
          }
        }

        break
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
