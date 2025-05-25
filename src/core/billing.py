from typing import Optional, Dict, List
from datetime import datetime, timedelta
import stripe
from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Boolean, JSON, Integer, ForeignKey
from sqlalchemy.orm import relationship

from .config import settings
from .tenant import Tenant

# Initialize Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY.get_secret_value()


class Subscription(BaseModel):
    """Subscription model."""
    id: str
    tenant_id: str
    plan_id: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool
    quantity: int
    metadata: Dict[str, str] = Field(default_factory=dict)


class BillingManager:
    """Manages billing and subscription operations."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def create_subscription(
        self,
        tenant_id: str,
        plan_id: str,
        payment_method_id: str,
        quantity: int = 1
    ) -> Subscription:
        """Create a new subscription."""
        tenant = await self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise ValueError("Tenant not found")
        
        # Create Stripe customer if not exists
        if not tenant.stripe_customer_id:
            customer = stripe.Customer.create(
                email=tenant.email,
                payment_method=payment_method_id,
                invoice_settings={"default_payment_method": payment_method_id}
            )
            tenant.stripe_customer_id = customer.id
            await self.db.commit()
        
        # Create subscription
        subscription = stripe.Subscription.create(
            customer=tenant.stripe_customer_id,
            items=[{"price": plan_id, "quantity": quantity}],
            payment_behavior="default_incomplete",
            expand=["latest_invoice.payment_intent"]
        )
        
        # Create subscription record
        sub = Subscription(
            id=subscription.id,
            tenant_id=tenant_id,
            plan_id=plan_id,
            status=subscription.status,
            current_period_start=datetime.fromtimestamp(subscription.current_period_start),
            current_period_end=datetime.fromtimestamp(subscription.current_period_end),
            cancel_at_period_end=subscription.cancel_at_period_end,
            quantity=quantity
        )
        
        self.db.add(sub)
        await self.db.commit()
        
        return sub
    
    async def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancel a subscription."""
        subscription = await self.db.query(Subscription).filter(
            Subscription.id == subscription_id
        ).first()
        
        if not subscription:
            return False
        
        # Cancel in Stripe
        stripe.Subscription.modify(
            subscription_id,
            cancel_at_period_end=True
        )
        
        subscription.cancel_at_period_end = True
        await self.db.commit()
        
        return True
    
    async def update_subscription(
        self,
        subscription_id: str,
        quantity: Optional[int] = None,
        plan_id: Optional[str] = None
    ) -> Optional[Subscription]:
        """Update subscription details."""
        subscription = await self.db.query(Subscription).filter(
            Subscription.id == subscription_id
        ).first()
        
        if not subscription:
            return None
        
        # Update in Stripe
        stripe_sub = stripe.Subscription.retrieve(subscription_id)
        
        if quantity is not None:
            stripe_sub.quantity = quantity
            subscription.quantity = quantity
        
        if plan_id is not None:
            # Update subscription items
            stripe.Subscription.modify(
                subscription_id,
                items=[{
                    'id': stripe_sub['items']['data'][0].id,
                    'price': plan_id,
                }]
            )
            subscription.plan_id = plan_id
        
        # Update local record
        subscription.status = stripe_sub.status
        subscription.current_period_start = datetime.fromtimestamp(stripe_sub.current_period_start)
        subscription.current_period_end = datetime.fromtimestamp(stripe_sub.current_period_end)
        
        await self.db.commit()
        return subscription
    
    async def get_invoice(self, invoice_id: str) -> Dict:
        """Get invoice details."""
        invoice = stripe.Invoice.retrieve(invoice_id)
        return {
            "id": invoice.id,
            "amount_due": invoice.amount_due,
            "amount_paid": invoice.amount_paid,
            "status": invoice.status,
            "created": datetime.fromtimestamp(invoice.created),
            "due_date": datetime.fromtimestamp(invoice.due_date) if invoice.due_date else None,
            "lines": [
                {
                    "description": line.description,
                    "amount": line.amount,
                    "quantity": line.quantity
                }
                for line in invoice.lines.data
            ]
        }
    
    async def create_payment_intent(
        self,
        tenant_id: str,
        amount: int,
        currency: str = "usd"
    ) -> Dict:
        """Create a payment intent for one-time charges."""
        tenant = await self.db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant or not tenant.stripe_customer_id:
            raise ValueError("Tenant not found or no Stripe customer")
        
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency=currency,
            customer=tenant.stripe_customer_id,
            payment_method_types=["card"]
        )
        
        return {
            "client_secret": intent.client_secret,
            "amount": intent.amount,
            "currency": intent.currency,
            "status": intent.status
        }
    
    async def handle_webhook(self, payload: Dict, sig_header: str) -> bool:
        """Handle Stripe webhook events."""
        try:
            event = stripe.Webhook.construct_event(
                payload,
                sig_header,
                settings.STRIPE_WEBHOOK_SECRET.get_secret_value()
            )
        except ValueError as e:
            return False
        except stripe.error.SignatureVerificationError as e:
            return False
        
        # Handle different event types
        if event.type == "customer.subscription.updated":
            await self._handle_subscription_updated(event.data.object)
        elif event.type == "customer.subscription.deleted":
            await self._handle_subscription_deleted(event.data.object)
        elif event.type == "invoice.payment_succeeded":
            await self._handle_invoice_payment_succeeded(event.data.object)
        elif event.type == "invoice.payment_failed":
            await self._handle_invoice_payment_failed(event.data.object)
        
        return True
    
    async def _handle_subscription_updated(self, subscription: Dict):
        """Handle subscription update event."""
        sub = await self.db.query(Subscription).filter(
            Subscription.id == subscription.id
        ).first()
        
        if sub:
            sub.status = subscription.status
            sub.current_period_start = datetime.fromtimestamp(subscription.current_period_start)
            sub.current_period_end = datetime.fromtimestamp(subscription.current_period_end)
            sub.cancel_at_period_end = subscription.cancel_at_period_end
            await self.db.commit()
    
    async def _handle_subscription_deleted(self, subscription: Dict):
        """Handle subscription deletion event."""
        sub = await self.db.query(Subscription).filter(
            Subscription.id == subscription.id
        ).first()
        
        if sub:
            sub.status = "canceled"
            await self.db.commit()
    
    async def _handle_invoice_payment_succeeded(self, invoice: Dict):
        """Handle successful invoice payment."""
        # Update tenant status if needed
        tenant = await self.db.query(Tenant).filter(
            Tenant.stripe_customer_id == invoice.customer
        ).first()
        
        if tenant:
            tenant.subscription_status = "active"
            await self.db.commit()
    
    async def _handle_invoice_payment_failed(self, invoice: Dict):
        """Handle failed invoice payment."""
        # Update tenant status and notify
        tenant = await self.db.query(Tenant).filter(
            Tenant.stripe_customer_id == invoice.customer
        ).first()
        
        if tenant:
            tenant.subscription_status = "past_due"
            await self.db.commit()
            
            # TODO: Send notification to tenant admin 