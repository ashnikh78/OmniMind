from typing import Dict, Optional, Any, List
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import json
import os

from .models import Base
from .config import settings

class CulturalPreference(Base):
    """Cultural preference model for storing cultural-specific settings."""
    __tablename__ = "cultural_preferences"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    country_code = Column(String, nullable=False)  # ISO 3166-1 alpha-2
    region_code = Column(String, nullable=True)  # ISO 3166-2
    preferences = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

class CulturalManager:
    """Manages cultural preferences and settings."""
    
    def __init__(self, db_session, audit_logger):
        self.db = db_session
        self.audit_logger = audit_logger
        self._load_preferences()
    
    def _load_preferences(self):
        """Load cultural preferences from database into memory."""
        self.preferences = {}
        prefs = self.db.query(CulturalPreference).filter(
            CulturalPreference.is_active == True
        ).all()
        
        for pref in prefs:
            if pref.tenant_id not in self.preferences:
                self.preferences[pref.tenant_id] = {}
            
            key = f"{pref.country_code}_{pref.region_code}" if pref.region_code else pref.country_code
            self.preferences[pref.tenant_id][key] = pref.preferences
    
    async def get_cultural_preference(
        self,
        tenant_id: str,
        country_code: str,
        region_code: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get cultural preferences for a country/region."""
        key = f"{country_code}_{region_code}" if region_code else country_code
        return self.preferences.get(tenant_id, {}).get(key)
    
    async def set_cultural_preference(
        self,
        tenant_id: str,
        country_code: str,
        preferences: Dict[str, Any],
        region_code: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> CulturalPreference:
        """Set cultural preferences for a country/region."""
        pref = await self.db.query(CulturalPreference).filter(
            CulturalPreference.tenant_id == tenant_id,
            CulturalPreference.country_code == country_code,
            CulturalPreference.region_code == region_code
        ).first()
        
        if pref:
            pref.preferences = preferences
            pref.metadata = metadata
            pref.updated_at = datetime.utcnow()
        else:
            pref = CulturalPreference(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                country_code=country_code,
                region_code=region_code,
                preferences=preferences,
                metadata=metadata
            )
            self.db.add(pref)
        
        await self.db.commit()
        self._load_preferences()  # Reload preferences
        
        return pref
    
    async def get_default_preferences(self) -> Dict[str, Any]:
        """Get default cultural preferences."""
        return {
            "date_format": "YYYY-MM-DD",
            "time_format": "24h",
            "number_format": {
                "decimal_separator": ".",
                "thousands_separator": ",",
                "decimal_places": 2
            },
            "currency_format": {
                "symbol_position": "before",
                "space_between": True
            },
            "name_format": {
                "order": "first_last",
                "title_required": False
            },
            "address_format": {
                "country_first": False,
                "postal_code_first": False
            },
            "phone_format": {
                "country_code_required": True,
                "format": "international"
            },
            "measurement_system": "metric",
            "paper_size": "A4",
            "first_day_of_week": "monday",
            "holidays": [],
            "working_days": [1, 2, 3, 4, 5],  # Monday to Friday
            "working_hours": {
                "start": "09:00",
                "end": "17:00"
            },
            "timezone": "UTC",
            "language": "en",
            "text_direction": "ltr",
            "color_scheme": {
                "primary": "#000000",
                "secondary": "#ffffff"
            },
            "icons": {
                "currency": "$",
                "check": "✓",
                "cross": "✗"
            }
        }
    
    async def get_country_preferences(
        self,
        tenant_id: str,
        country_code: str
    ) -> List[Dict[str, Any]]:
        """Get all regional preferences for a country."""
        prefs = await self.db.query(CulturalPreference).filter(
            CulturalPreference.tenant_id == tenant_id,
            CulturalPreference.country_code == country_code,
            CulturalPreference.is_active == True
        ).all()
        
        return [
            {
                "region_code": pref.region_code,
                "preferences": pref.preferences,
                "metadata": pref.metadata
            }
            for pref in prefs
        ]
    
    async def import_preferences(
        self,
        tenant_id: str,
        preferences: Dict[str, Dict[str, Any]]
    ):
        """Import multiple cultural preferences at once."""
        for country_code, country_prefs in preferences.items():
            if isinstance(country_prefs, dict) and "regions" in country_prefs:
                # Handle regional preferences
                for region_code, region_prefs in country_prefs["regions"].items():
                    await self.set_cultural_preference(
                        tenant_id=tenant_id,
                        country_code=country_code,
                        region_code=region_code,
                        preferences=region_prefs
                    )
            else:
                # Handle country-level preferences
                await self.set_cultural_preference(
                    tenant_id=tenant_id,
                    country_code=country_code,
                    preferences=country_prefs
                )
    
    async def export_preferences(
        self,
        tenant_id: str
    ) -> Dict[str, Dict[str, Any]]:
        """Export all cultural preferences."""
        prefs = await self.db.query(CulturalPreference).filter(
            CulturalPreference.tenant_id == tenant_id,
            CulturalPreference.is_active == True
        ).all()
        
        result = {}
        for pref in prefs:
            if pref.region_code:
                if pref.country_code not in result:
                    result[pref.country_code] = {"regions": {}}
                result[pref.country_code]["regions"][pref.region_code] = pref.preferences
            else:
                result[pref.country_code] = pref.preferences
        
        return result
    
    async def get_supported_countries(self) -> List[Dict[str, Any]]:
        """Get list of supported countries with their details."""
        # This could be loaded from a JSON file or database
        return [
            {
                "code": "US",
                "name": "United States",
                "regions": [
                    {"code": "CA", "name": "California"},
                    {"code": "NY", "name": "New York"}
                ]
            },
            {
                "code": "GB",
                "name": "United Kingdom",
                "regions": [
                    {"code": "ENG", "name": "England"},
                    {"code": "SCT", "name": "Scotland"}
                ]
            }
            # Add more countries and regions
        ]
    
    async def get_cultural_insights(
        self,
        tenant_id: str,
        country_code: str,
        region_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get cultural insights and recommendations."""
        preferences = await self.get_cultural_preference(
            tenant_id=tenant_id,
            country_code=country_code,
            region_code=region_code
        )
        
        if not preferences:
            return {}
        
        return {
            "business_practices": {
                "meetings": {
                    "punctuality": preferences.get("punctuality", "moderate"),
                    "formality": preferences.get("formality", "moderate"),
                    "small_talk": preferences.get("small_talk", True)
                },
                "communication": {
                    "directness": preferences.get("directness", "moderate"),
                    "hierarchy": preferences.get("hierarchy", "moderate"),
                    "non_verbal": preferences.get("non_verbal", {})
                },
                "negotiation": {
                    "pace": preferences.get("negotiation_pace", "moderate"),
                    "style": preferences.get("negotiation_style", "collaborative")
                }
            },
            "cultural_norms": {
                "greetings": preferences.get("greetings", {}),
                "gift_giving": preferences.get("gift_giving", {}),
                "dining": preferences.get("dining", {}),
                "dress_code": preferences.get("dress_code", "business_casual")
            },
            "holidays": preferences.get("holidays", []),
            "working_hours": preferences.get("working_hours", {}),
            "recommendations": self._generate_recommendations(preferences)
        }
    
    def _generate_recommendations(self, preferences: Dict[str, Any]) -> List[str]:
        """Generate cultural recommendations based on preferences."""
        recommendations = []
        
        # Add business practice recommendations
        if preferences.get("punctuality") == "strict":
            recommendations.append("Be punctual for all meetings and appointments")
        elif preferences.get("punctuality") == "flexible":
            recommendations.append("Allow for some flexibility in meeting times")
        
        if preferences.get("formality") == "high":
            recommendations.append("Use formal titles and maintain professional distance")
        elif preferences.get("formality") == "low":
            recommendations.append("Use first names and maintain a casual atmosphere")
        
        # Add communication recommendations
        if preferences.get("directness") == "high":
            recommendations.append("Be direct and clear in communication")
        elif preferences.get("directness") == "low":
            recommendations.append("Use indirect communication and read between the lines")
        
        # Add cultural norm recommendations
        if preferences.get("gift_giving"):
            recommendations.append("Follow local gift-giving customs and taboos")
        
        if preferences.get("dining"):
            recommendations.append("Observe local dining etiquette and customs")
        
        return recommendations 