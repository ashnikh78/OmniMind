from typing import List, Dict, Optional, Any
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr
import aiohttp
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from .models import Base
from .config import settings

class Notification(Base):
    """Notification model for storing notifications."""
    __tablename__ = "notifications"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    user_id = Column(String, nullable=True)
    type = Column(String, nullable=False)  # email, in_app, webhook
    status = Column(String, nullable=False)  # pending, sent, failed
    subject = Column(String, nullable=True)
    content = Column(String, nullable=False)
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    sent_at = Column(DateTime, nullable=True)
    error = Column(String, nullable=True)

class NotificationTemplate(Base):
    """Template model for notification content."""
    __tablename__ = "notification_templates"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    subject_template = Column(String, nullable=True)
    content_template = Column(String, nullable=False)
    variables = Column(JSON, nullable=True)
    is_active = Column(Boolean, default=True)

class NotificationPreference(Base):
    """User notification preferences."""
    __tablename__ = "notification_preferences"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    tenant_id = Column(String, nullable=False)
    email_enabled = Column(Boolean, default=True)
    in_app_enabled = Column(Boolean, default=True)
    webhook_enabled = Column(Boolean, default=False)
    webhook_url = Column(String, nullable=True)
    preferences = Column(JSON, nullable=True)

class NotificationManager:
    """Manages notification operations."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    async def create_notification(
        self,
        tenant_id: str,
        type: str,
        content: str,
        user_id: Optional[str] = None,
        subject: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Notification:
        """Create a new notification."""
        notification = Notification(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            user_id=user_id,
            type=type,
            status="pending",
            subject=subject,
            content=content,
            metadata=metadata
        )
        
        self.db.add(notification)
        await self.db.commit()
        
        # Process notification asynchronously
        await self._process_notification(notification)
        
        return notification
    
    async def _process_notification(self, notification: Notification):
        """Process a notification based on its type."""
        try:
            if notification.type == "email":
                await self._send_email(notification)
            elif notification.type == "in_app":
                await self._create_in_app_notification(notification)
            elif notification.type == "webhook":
                await self._send_webhook(notification)
            
            notification.status = "sent"
            notification.sent_at = datetime.utcnow()
        except Exception as e:
            notification.status = "failed"
            notification.error = str(e)
        
        await self.db.commit()
    
    async def _send_email(self, notification: Notification):
        """Send email notification."""
        if not settings.SMTP_HOST or not settings.SMTP_USER:
            raise ValueError("SMTP configuration missing")
        
        msg = MIMEMultipart()
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = notification.metadata.get("email")
        msg["Subject"] = notification.subject
        
        msg.attach(MIMEText(notification.content, "html"))
        
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            server.login(
                settings.SMTP_USER,
                settings.SMTP_PASSWORD.get_secret_value()
            )
            server.send_message(msg)
    
    async def _create_in_app_notification(self, notification: Notification):
        """Create in-app notification."""
        # Store notification in database for user to view
        # This could be enhanced with real-time notifications using WebSocket
        pass
    
    async def _send_webhook(self, notification: Notification):
        """Send webhook notification."""
        webhook_url = notification.metadata.get("webhook_url")
        if not webhook_url:
            raise ValueError("Webhook URL not provided")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                webhook_url,
                json={
                    "id": notification.id,
                    "type": notification.type,
                    "subject": notification.subject,
                    "content": notification.content,
                    "metadata": notification.metadata,
                    "created_at": notification.created_at.isoformat()
                }
            ) as response:
                if response.status >= 400:
                    raise Exception(f"Webhook failed with status {response.status}")
    
    async def get_user_notifications(
        self,
        user_id: str,
        tenant_id: str,
        page: int = 1,
        per_page: int = 50,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get notifications for a user."""
        query = self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.tenant_id == tenant_id
        )
        
        if status:
            query = query.filter(Notification.status == status)
        
        total = await query.count()
        notifications = await query.order_by(Notification.created_at.desc())\
            .offset((page - 1) * per_page)\
            .limit(per_page)\
            .all()
        
        return {
            "data": notifications,
            "meta": {
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page
            }
        }
    
    async def mark_notification_read(
        self,
        notification_id: str,
        user_id: str
    ) -> bool:
        """Mark a notification as read."""
        notification = await self.db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        
        if not notification:
            return False
        
        notification.metadata = {
            **(notification.metadata or {}),
            "read": True,
            "read_at": datetime.utcnow().isoformat()
        }
        
        await self.db.commit()
        return True
    
    async def get_notification_preferences(
        self,
        user_id: str,
        tenant_id: str
    ) -> Optional[NotificationPreference]:
        """Get notification preferences for a user."""
        return await self.db.query(NotificationPreference).filter(
            NotificationPreference.user_id == user_id,
            NotificationPreference.tenant_id == tenant_id
        ).first()
    
    async def update_notification_preferences(
        self,
        user_id: str,
        tenant_id: str,
        preferences: Dict[str, Any]
    ) -> NotificationPreference:
        """Update notification preferences for a user."""
        prefs = await self.get_notification_preferences(user_id, tenant_id)
        
        if not prefs:
            prefs = NotificationPreference(
                id=str(uuid.uuid4()),
                user_id=user_id,
                tenant_id=tenant_id
            )
            self.db.add(prefs)
        
        for key, value in preferences.items():
            setattr(prefs, key, value)
        
        await self.db.commit()
        return prefs

# Event handlers for automatic notifications
class NotificationEventHandler:
    """Handles events and creates notifications."""
    
    def __init__(self, notification_manager: NotificationManager):
        self.notification_manager = notification_manager
    
    async def handle_user_created(self, user: Dict):
        """Handle user creation event."""
        # Send welcome email
        await self.notification_manager.create_notification(
            tenant_id=user["tenant_id"],
            type="email",
            subject="Welcome to OmniMind",
            content=f"Welcome {user['name']}! We're excited to have you on board.",
            user_id=user["id"],
            metadata={"email": user["email"]}
        )
    
    async def handle_task_assigned(self, task: Dict, assignee: Dict):
        """Handle task assignment event."""
        # Send in-app notification
        await self.notification_manager.create_notification(
            tenant_id=task["tenant_id"],
            type="in_app",
            subject="New Task Assigned",
            content=f"You have been assigned to task: {task['title']}",
            user_id=assignee["id"]
        )
        
        # Send email if enabled
        prefs = await self.notification_manager.get_notification_preferences(
            assignee["id"],
            task["tenant_id"]
        )
        
        if prefs and prefs.email_enabled:
            await self.notification_manager.create_notification(
                tenant_id=task["tenant_id"],
                type="email",
                subject="New Task Assigned",
                content=f"You have been assigned to task: {task['title']}",
                user_id=assignee["id"],
                metadata={"email": assignee["email"]}
            )
    
    async def handle_subscription_updated(self, subscription: Dict):
        """Handle subscription update event."""
        # Send webhook notification if enabled
        prefs = await self.notification_manager.get_notification_preferences(
            subscription["user_id"],
            subscription["tenant_id"]
        )
        
        if prefs and prefs.webhook_enabled and prefs.webhook_url:
            await self.notification_manager.create_notification(
                tenant_id=subscription["tenant_id"],
                type="webhook",
                subject="Subscription Updated",
                content="Your subscription has been updated",
                user_id=subscription["user_id"],
                metadata={
                    "webhook_url": prefs.webhook_url,
                    "subscription": subscription
                }
            ) 