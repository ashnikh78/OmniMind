from typing import Dict, Optional, Any, List
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import json
import os

from .models import Base
from .config import settings

class DataResidencyRule(Base):
    """Data residency rule model for storing data location requirements."""
    __tablename__ = "data_residency_rules"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    country_code = Column(String, nullable=False)  # ISO 3166-1 alpha-2
    region_code = Column(String, nullable=True)  # ISO 3166-2
    data_type = Column(String, nullable=False)  # personal, financial, health, etc.
    storage_location = Column(String, nullable=False)  # country/region where data must be stored
    processing_location = Column(String, nullable=True)  # country/region where data can be processed
    encryption_required = Column(Boolean, default=True)
    backup_location = Column(String, nullable=True)  # country/region where backups must be stored
    retention_period_days = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

class DataResidencyManager:
    """Manages data residency rules and compliance."""
    
    def __init__(self, db_session, audit_logger):
        self.db = db_session
        self.audit_logger = audit_logger
        self._load_rules()
    
    def _load_rules(self):
        """Load data residency rules from database into memory."""
        self.rules = {}
        rules = self.db.query(DataResidencyRule).filter(
            DataResidencyRule.is_active == True
        ).all()
        
        for rule in rules:
            if rule.tenant_id not in self.rules:
                self.rules[rule.tenant_id] = {}
            
            key = f"{rule.country_code}_{rule.region_code}" if rule.region_code else rule.country_code
            if key not in self.rules[rule.tenant_id]:
                self.rules[rule.tenant_id][key] = {}
            
            self.rules[rule.tenant_id][key][rule.data_type] = rule
    
    async def get_residency_rule(
        self,
        tenant_id: str,
        country_code: str,
        data_type: str,
        region_code: Optional[str] = None
    ) -> Optional[DataResidencyRule]:
        """Get data residency rule for a country/region and data type."""
        key = f"{country_code}_{region_code}" if region_code else country_code
        return self.rules.get(tenant_id, {}).get(key, {}).get(data_type)
    
    async def set_residency_rule(
        self,
        tenant_id: str,
        country_code: str,
        data_type: str,
        storage_location: str,
        processing_location: Optional[str] = None,
        encryption_required: bool = True,
        backup_location: Optional[str] = None,
        retention_period_days: Optional[int] = None,
        region_code: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> DataResidencyRule:
        """Set data residency rule for a country/region and data type."""
        rule = await self.db.query(DataResidencyRule).filter(
            DataResidencyRule.tenant_id == tenant_id,
            DataResidencyRule.country_code == country_code,
            DataResidencyRule.region_code == region_code,
            DataResidencyRule.data_type == data_type
        ).first()
        
        if rule:
            rule.storage_location = storage_location
            rule.processing_location = processing_location
            rule.encryption_required = encryption_required
            rule.backup_location = backup_location
            rule.retention_period_days = retention_period_days
            rule.metadata = metadata
            rule.updated_at = datetime.utcnow()
        else:
            rule = DataResidencyRule(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                country_code=country_code,
                region_code=region_code,
                data_type=data_type,
                storage_location=storage_location,
                processing_location=processing_location,
                encryption_required=encryption_required,
                backup_location=backup_location,
                retention_period_days=retention_period_days,
                metadata=metadata
            )
            self.db.add(rule)
        
        await self.db.commit()
        self._load_rules()  # Reload rules
        
        return rule
    
    async def check_compliance(
        self,
        tenant_id: str,
        country_code: str,
        data_type: str,
        storage_location: str,
        processing_location: Optional[str] = None,
        region_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check if data storage and processing locations comply with rules."""
        rule = await self.get_residency_rule(
            tenant_id=tenant_id,
            country_code=country_code,
            data_type=data_type,
            region_code=region_code
        )
        
        if not rule:
            return {
                "compliant": True,
                "message": "No specific residency rules found"
            }
        
        compliance = {
            "compliant": True,
            "storage_compliant": storage_location == rule.storage_location,
            "processing_compliant": True,
            "messages": []
        }
        
        if not compliance["storage_compliant"]:
            compliance["compliant"] = False
            compliance["messages"].append(
                f"Data must be stored in {rule.storage_location}"
            )
        
        if rule.processing_location and processing_location:
            compliance["processing_compliant"] = (
                processing_location == rule.processing_location
            )
            if not compliance["processing_compliant"]:
                compliance["compliant"] = False
                compliance["messages"].append(
                    f"Data must be processed in {rule.processing_location}"
                )
        
        return compliance
    
    async def get_required_locations(
        self,
        tenant_id: str,
        country_code: str,
        data_type: str,
        region_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get required storage and processing locations."""
        rule = await self.get_residency_rule(
            tenant_id=tenant_id,
            country_code=country_code,
            data_type=data_type,
            region_code=region_code
        )
        
        if not rule:
            return {
                "storage_location": None,
                "processing_location": None,
                "backup_location": None
            }
        
        return {
            "storage_location": rule.storage_location,
            "processing_location": rule.processing_location,
            "backup_location": rule.backup_location
        }
    
    async def get_data_types(
        self,
        tenant_id: str,
        country_code: str,
        region_code: Optional[str] = None
    ) -> List[str]:
        """Get list of data types with residency rules."""
        key = f"{country_code}_{region_code}" if region_code else country_code
        return list(self.rules.get(tenant_id, {}).get(key, {}).keys())
    
    async def get_country_rules(
        self,
        tenant_id: str,
        country_code: str
    ) -> List[Dict[str, Any]]:
        """Get all residency rules for a country."""
        rules = await self.db.query(DataResidencyRule).filter(
            DataResidencyRule.tenant_id == tenant_id,
            DataResidencyRule.country_code == country_code,
            DataResidencyRule.is_active == True
        ).all()
        
        return [
            {
                "region_code": rule.region_code,
                "data_type": rule.data_type,
                "storage_location": rule.storage_location,
                "processing_location": rule.processing_location,
                "encryption_required": rule.encryption_required,
                "backup_location": rule.backup_location,
                "retention_period_days": rule.retention_period_days,
                "metadata": rule.metadata
            }
            for rule in rules
        ]
    
    async def import_rules(
        self,
        tenant_id: str,
        rules: Dict[str, Dict[str, Any]]
    ):
        """Import multiple residency rules at once."""
        for country_code, country_rules in rules.items():
            if isinstance(country_rules, dict) and "regions" in country_rules:
                # Handle regional rules
                for region_code, region_rules in country_rules["regions"].items():
                    for data_type, rule_data in region_rules.items():
                        await self.set_residency_rule(
                            tenant_id=tenant_id,
                            country_code=country_code,
                            region_code=region_code,
                            data_type=data_type,
                            **rule_data
                        )
            else:
                # Handle country-level rules
                for data_type, rule_data in country_rules.items():
                    await self.set_residency_rule(
                        tenant_id=tenant_id,
                        country_code=country_code,
                        data_type=data_type,
                        **rule_data
                    )
    
    async def export_rules(
        self,
        tenant_id: str
    ) -> Dict[str, Dict[str, Any]]:
        """Export all residency rules."""
        rules = await self.db.query(DataResidencyRule).filter(
            DataResidencyRule.tenant_id == tenant_id,
            DataResidencyRule.is_active == True
        ).all()
        
        result = {}
        for rule in rules:
            if rule.region_code:
                if rule.country_code not in result:
                    result[rule.country_code] = {"regions": {}}
                if rule.region_code not in result[rule.country_code]["regions"]:
                    result[rule.country_code]["regions"][rule.region_code] = {}
                result[rule.country_code]["regions"][rule.region_code][rule.data_type] = {
                    "storage_location": rule.storage_location,
                    "processing_location": rule.processing_location,
                    "encryption_required": rule.encryption_required,
                    "backup_location": rule.backup_location,
                    "retention_period_days": rule.retention_period_days,
                    "metadata": rule.metadata
                }
            else:
                if rule.country_code not in result:
                    result[rule.country_code] = {}
                result[rule.country_code][rule.data_type] = {
                    "storage_location": rule.storage_location,
                    "processing_location": rule.processing_location,
                    "encryption_required": rule.encryption_required,
                    "backup_location": rule.backup_location,
                    "retention_period_days": rule.retention_period_days,
                    "metadata": rule.metadata
                }
        
        return result
    
    async def get_compliance_report(
        self,
        tenant_id: str,
        country_code: str,
        region_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate compliance report for a country/region."""
        rules = await self.db.query(DataResidencyRule).filter(
            DataResidencyRule.tenant_id == tenant_id,
            DataResidencyRule.country_code == country_code,
            DataResidencyRule.region_code == region_code,
            DataResidencyRule.is_active == True
        ).all()
        
        report = {
            "country_code": country_code,
            "region_code": region_code,
            "total_rules": len(rules),
            "data_types": {},
            "compliance_summary": {
                "compliant": True,
                "warnings": [],
                "errors": []
            }
        }
        
        for rule in rules:
            report["data_types"][rule.data_type] = {
                "storage_location": rule.storage_location,
                "processing_location": rule.processing_location,
                "encryption_required": rule.encryption_required,
                "backup_location": rule.backup_location,
                "retention_period_days": rule.retention_period_days
            }
            
            # Add compliance checks
            if rule.encryption_required:
                report["compliance_summary"]["warnings"].append(
                    f"Ensure encryption is enabled for {rule.data_type} data"
                )
            
            if rule.retention_period_days:
                report["compliance_summary"]["warnings"].append(
                    f"Ensure data retention policy is set to {rule.retention_period_days} days for {rule.data_type} data"
                )
        
        return report 