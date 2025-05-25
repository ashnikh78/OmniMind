from typing import Dict, Optional, Any, List
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import babel
from babel import Locale
from babel.dates import format_datetime, format_date, format_time
from babel.numbers import format_number, format_currency, format_decimal
import pytz
import json
import os

from .models import Base
from .config import settings

class Translation(Base):
    """Translation model for storing localized content."""
    __tablename__ = "translations"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    locale = Column(String, nullable=False)  # e.g., en_US, fr_FR, ja_JP
    namespace = Column(String, nullable=False)  # e.g., ui, emails, notifications
    key = Column(String, nullable=False)
    value = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

class UserPreferences(Base):
    """User preferences for localization and cultural settings."""
    __tablename__ = "user_preferences"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    tenant_id = Column(String, nullable=False)
    locale = Column(String, nullable=False)
    timezone = Column(String, nullable=False)
    date_format = Column(String, nullable=True)
    time_format = Column(String, nullable=True)
    number_format = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    language = Column(String, nullable=False)
    cultural_preferences = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class I18nManager:
    """Manages internationalization and localization operations."""
    
    def __init__(self, db_session, audit_logger):
        self.db = db_session
        self.audit_logger = audit_logger
        self._load_translations()
    
    def _load_translations(self):
        """Load translations from database into memory."""
        self.translations = {}
        translations = self.db.query(Translation).filter(
            Translation.is_active == True
        ).all()
        
        for trans in translations:
            if trans.tenant_id not in self.translations:
                self.translations[trans.tenant_id] = {}
            if trans.locale not in self.translations[trans.tenant_id]:
                self.translations[trans.tenant_id][trans.locale] = {}
            if trans.namespace not in self.translations[trans.tenant_id][trans.locale]:
                self.translations[trans.tenant_id][trans.locale][trans.namespace] = {}
            
            self.translations[trans.tenant_id][trans.locale][trans.namespace][trans.key] = trans.value
    
    async def get_translation(
        self,
        tenant_id: str,
        locale: str,
        namespace: str,
        key: str,
        default: Optional[str] = None
    ) -> str:
        """Get translation for a key."""
        try:
            return self.translations[tenant_id][locale][namespace][key]
        except KeyError:
            if default:
                return default
            return key
    
    async def add_translation(
        self,
        tenant_id: str,
        locale: str,
        namespace: str,
        key: str,
        value: str,
        metadata: Optional[Dict] = None
    ) -> Translation:
        """Add or update a translation."""
        translation = await self.db.query(Translation).filter(
            Translation.tenant_id == tenant_id,
            Translation.locale == locale,
            Translation.namespace == namespace,
            Translation.key == key
        ).first()
        
        if translation:
            translation.value = value
            translation.metadata = metadata
            translation.updated_at = datetime.utcnow()
        else:
            translation = Translation(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                locale=locale,
                namespace=namespace,
                key=key,
                value=value,
                metadata=metadata
            )
            self.db.add(translation)
        
        await self.db.commit()
        self._load_translations()  # Reload translations
        
        return translation
    
    async def get_user_preferences(
        self,
        user_id: str,
        tenant_id: str
    ) -> Optional[UserPreferences]:
        """Get user preferences."""
        return await self.db.query(UserPreferences).filter(
            UserPreferences.user_id == user_id,
            UserPreferences.tenant_id == tenant_id
        ).first()
    
    async def update_user_preferences(
        self,
        user_id: str,
        tenant_id: str,
        preferences: Dict[str, Any]
    ) -> UserPreferences:
        """Update user preferences."""
        user_prefs = await self.get_user_preferences(user_id, tenant_id)
        
        if not user_prefs:
            user_prefs = UserPreferences(
                id=str(uuid.uuid4()),
                user_id=user_id,
                tenant_id=tenant_id,
                locale=preferences.get("locale", "en_US"),
                timezone=preferences.get("timezone", "UTC"),
                language=preferences.get("language", "en")
            )
            self.db.add(user_prefs)
        
        for key, value in preferences.items():
            setattr(user_prefs, key, value)
        
        await self.db.commit()
        return user_prefs
    
    def format_datetime(
        self,
        dt: datetime,
        locale: str,
        format: str = "medium",
        timezone: Optional[str] = None
    ) -> str:
        """Format datetime according to locale."""
        if timezone:
            dt = dt.astimezone(pytz.timezone(timezone))
        return format_datetime(dt, format=format, locale=locale)
    
    def format_date(
        self,
        date: datetime,
        locale: str,
        format: str = "medium"
    ) -> str:
        """Format date according to locale."""
        return format_date(date, format=format, locale=locale)
    
    def format_time(
        self,
        time: datetime,
        locale: str,
        format: str = "medium",
        timezone: Optional[str] = None
    ) -> str:
        """Format time according to locale."""
        if timezone:
            time = time.astimezone(pytz.timezone(timezone))
        return format_time(time, format=format, locale=locale)
    
    def format_number(
        self,
        number: float,
        locale: str,
        format: Optional[str] = None
    ) -> str:
        """Format number according to locale."""
        return format_number(number, locale=locale, format=format)
    
    def format_currency(
        self,
        amount: float,
        currency: str,
        locale: str,
        format: Optional[str] = None
    ) -> str:
        """Format currency according to locale."""
        return format_currency(amount, currency, locale=locale, format=format)
    
    def format_decimal(
        self,
        number: float,
        locale: str,
        format: Optional[str] = None
    ) -> str:
        """Format decimal number according to locale."""
        return format_decimal(number, locale=locale, format=format)
    
    async def get_supported_locales(self) -> List[Dict[str, Any]]:
        """Get list of supported locales with their details."""
        locales = []
        for locale in babel.localedata.locale_identifiers():
            try:
                locale_obj = Locale.parse(locale)
                locales.append({
                    "code": locale,
                    "name": locale_obj.get_display_name(),
                    "language": locale_obj.language,
                    "territory": locale_obj.territory,
                    "script": locale_obj.script,
                    "number_system": locale_obj.number_systems[0],
                    "calendar": locale_obj.calendars[0],
                    "time_zones": locale_obj.time_zones,
                    "currencies": locale_obj.currencies
                })
            except:
                continue
        return locales
    
    async def get_supported_timezones(self) -> List[Dict[str, Any]]:
        """Get list of supported timezones with their details."""
        timezones = []
        for tz in pytz.all_timezones:
            try:
                tz_obj = pytz.timezone(tz)
                timezones.append({
                    "name": tz,
                    "offset": tz_obj.utcoffset(datetime.utcnow()).total_seconds() / 3600,
                    "dst": bool(tz_obj.dst(datetime.utcnow())),
                    "country": tz.split("/")[0] if "/" in tz else None,
                    "region": tz.split("/")[1] if "/" in tz else None
                })
            except:
                continue
        return timezones
    
    async def get_supported_currencies(self) -> List[Dict[str, Any]]:
        """Get list of supported currencies with their details."""
        currencies = []
        for currency in babel.numbers.list_currencies():
            try:
                currencies.append({
                    "code": currency,
                    "name": babel.numbers.get_currency_name(currency),
                    "symbol": babel.numbers.get_currency_symbol(currency),
                    "decimal_places": babel.numbers.get_currency_precision(currency)
                })
            except:
                continue
        return currencies
    
    async def import_translations(
        self,
        tenant_id: str,
        locale: str,
        namespace: str,
        translations: Dict[str, str],
        metadata: Optional[Dict] = None
    ):
        """Import multiple translations at once."""
        for key, value in translations.items():
            await self.add_translation(
                tenant_id=tenant_id,
                locale=locale,
                namespace=namespace,
                key=key,
                value=value,
                metadata=metadata
            )
    
    async def export_translations(
        self,
        tenant_id: str,
        locale: str,
        namespace: str
    ) -> Dict[str, str]:
        """Export translations for a locale and namespace."""
        translations = await self.db.query(Translation).filter(
            Translation.tenant_id == tenant_id,
            Translation.locale == locale,
            Translation.namespace == namespace,
            Translation.is_active == True
        ).all()
        
        return {trans.key: trans.value for trans in translations}
    
    async def get_missing_translations(
        self,
        tenant_id: str,
        source_locale: str,
        target_locale: str,
        namespace: str
    ) -> List[str]:
        """Get list of keys that are missing translations."""
        source_keys = set(
            key for key in self.translations.get(tenant_id, {}).get(source_locale, {}).get(namespace, {})
        )
        target_keys = set(
            key for key in self.translations.get(tenant_id, {}).get(target_locale, {}).get(namespace, {})
        )
        
        return list(source_keys - target_keys)
    
    async def get_translation_coverage(
        self,
        tenant_id: str,
        namespace: str
    ) -> Dict[str, float]:
        """Get translation coverage for each locale."""
        source_locale = "en_US"  # Assuming English is the source
        source_keys = set(
            key for key in self.translations.get(tenant_id, {}).get(source_locale, {}).get(namespace, {})
        )
        
        coverage = {}
        for locale in self.translations.get(tenant_id, {}):
            if locale == source_locale:
                coverage[locale] = 100.0
                continue
            
            target_keys = set(
                key for key in self.translations.get(tenant_id, {}).get(locale, {}).get(namespace, {})
            )
            coverage[locale] = (len(target_keys) / len(source_keys)) * 100 if source_keys else 0
        
        return coverage 