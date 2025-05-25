import re
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
from pydantic import BaseModel
import time
import logging
import aiofiles
import asyncio
import os
from cryptography.fernet import Fernet
from app.core.config import settings
from app.core.monitoring import logger, performance_monitor

class ComplianceRule(BaseModel):
    name: str
    description: str
    pattern: str
    severity: str
    region: str
    last_updated: datetime
    version: str

class PIIPattern:
    EMAIL = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    PHONE = r'\b\+?1?\d{10,12}\b'
    SSN = r'\b\d{3}-?\d{2}-?\d{4}\b'
    CREDIT_CARD = r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b'

class RulesEngine:
    def __init__(self, gdpr: bool = True, ccpa: bool = True, hipaa: bool = True):
        self.rules = self._initialize_rules(gdpr, ccpa, hipaa)
        self.patterns = {
            "email": re.compile(PIIPattern.EMAIL),
            "phone": re.compile(PIIPattern.PHONE),
            "ssn": re.compile(PIIPattern.SSN),
            "credit_card": re.compile(PIIPattern.CREDIT_CARD)
        }
    
    def _initialize_rules(self, gdpr: bool, ccpa: bool, hipaa: bool) -> List[ComplianceRule]:
        rules = []
        
        if gdpr:
            rules.extend([
                ComplianceRule(
                    name="GDPR_PII",
                    description="Personal Identifiable Information under GDPR",
                    pattern="pii",
                    severity="high",
                    region="EU",
                    last_updated=datetime.utcnow(),
                    version=settings.API_VERSION
                ),
                ComplianceRule(
                    name="GDPR_CONSENT",
                    description="User consent tracking",
                    pattern="consent",
                    severity="medium",
                    region="EU",
                    last_updated=datetime.utcnow(),
                    version=settings.API_VERSION
                )
            ])
        
        if ccpa:
            rules.extend([
                ComplianceRule(
                    name="CCPA_PII",
                    description="Personal Information under CCPA",
                    pattern="pii",
                    severity="high",
                    region="CA",
                    last_updated=datetime.utcnow(),
                    version=settings.API_VERSION
                )
            ])
        
        if hipaa:
            rules.extend([
                ComplianceRule(
                    name="HIPAA_PHI",
                    description="Protected Health Information",
                    pattern="phi",
                    severity="high",
                    region="US",
                    last_updated=datetime.utcnow(),
                    version=settings.API_VERSION
                )
            ])
        
        return rules
    
    async def validate(self, data: Dict[str, Any], region: str) -> List[Dict[str, Any]]:
        violations = []
        
        # Check region-specific rules
        region_rules = [rule for rule in self.rules if rule.region == region]
        
        for rule in region_rules:
            if rule.pattern == "pii":
                # Check for PII patterns
                for field, value in data.items():
                    if isinstance(value, str):
                        for pii_type, pattern in self.patterns.items():
                            if pattern.search(value):
                                violations.append({
                                    "rule": rule.name,
                                    "field": field,
                                    "type": pii_type,
                                    "severity": rule.severity
                                })
        
        return violations

class PIIAnonymizer:
    def __init__(self, detection_level: str = "strict", replacement_strategy: str = "crypto_hash"):
        self.detection_level = detection_level
        self.replacement_strategy = replacement_strategy
        self.patterns = {
            "email": re.compile(PIIPattern.EMAIL),
            "phone": re.compile(PIIPattern.PHONE),
            "ssn": re.compile(PIIPattern.SSN),
            "credit_card": re.compile(PIIPattern.CREDIT_CARD)
        }
    
    def _hash_value(self, value: str) -> str:
        return hashlib.sha256(value.encode()).hexdigest()[:8]
    
    def process(self, data: Dict[str, Any]) -> Dict[str, Any]:
        processed_data = data.copy()
        
        for field, value in processed_data.items():
            if isinstance(value, str):
                for pii_type, pattern in self.patterns.items():
                    if pattern.search(value):
                        if self.replacement_strategy == "crypto_hash":
                            processed_data[field] = pattern.sub(
                                lambda m: self._hash_value(m.group()),
                                value
                            )
                        else:
                            # Default to simple masking
                            processed_data[field] = pattern.sub(
                                lambda m: "*" * len(m.group()),
                                value
                            )
        
        return processed_data

class ComplianceLogger:
    @staticmethod
    async def log_action(action: str, user: str, details: Dict[str, Any]):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "user": user,
            "details": details
        }
        
        # In a real implementation, this would write to a secure log storage
        print(f"Compliance Log: {json.dumps(log_entry)}")

class ContentModerationResult(BaseModel):
    is_safe: bool
    categories: Dict[str, float]
    flagged_content: List[str]
    confidence: float
    moderation_id: str

class ComplianceAudit(BaseModel):
    timestamp: datetime
    action: str
    user_id: str
    model_used: str
    input_hash: str
    output_hash: str
    compliance_checks: Dict[str, bool]
    metadata: Dict[str, Any]
    audit_id: str
    session_id: str
    ip_address: str
    user_agent: str
    risk_score: float
    compliance_version: str

class LearningModerationResult(BaseModel):
    is_appropriate: bool
    age_group: str
    difficulty_level: str
    content_type: str
    topics: List[str]
    warnings: List[str]

class ComplianceGuard:
    def __init__(self):
        self.audit_log_path = "logs/compliance"
        self.moderation_cache = {}
        self.learning_profiles = {}
        self.compliance_rules = self._load_compliance_rules()
        self.encryption_key = self._initialize_encryption()
        self.audit_retention_days = settings.compliance.AUDIT_RETENTION_DAYS
        
        # Enhanced backup retention settings
        self.backup_retention_policy = {
            "daily": {
                "retention_days": 7,
                "compression": True,
                "encryption": True
            },
            "weekly": {
                "retention_days": 30,
                "compression": True,
                "encryption": True
            },
            "monthly": {
                "retention_days": 365,
                "compression": True,
                "encryption": True
            },
            "yearly": {
                "retention_days": 2555,  # 7 years
                "compression": True,
                "encryption": True
            }
        }
        
        # Ensure audit log directory exists with proper permissions
        os.makedirs(self.audit_log_path, mode=0o700, exist_ok=True)
    
    def _initialize_encryption(self) -> Fernet:
        # In production, this should be loaded from a secure key management service
        key = os.getenv("COMPLIANCE_ENCRYPTION_KEY")
        if not key:
            key = Fernet.generate_key()
            logger.warning("No encryption key found, generated new key")
        return Fernet(key)
    
    def _hash_content(self, content: str) -> str:
        # Use a more secure hashing method
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def _write_audit_log(self, audit: ComplianceAudit):
        try:
            log_entry = audit.dict()
            log_entry["timestamp"] = log_entry["timestamp"].isoformat()
            
            # Encrypt sensitive data
            encrypted_entry = self._encrypt_sensitive_data(log_entry)
            
            # Write to daily log file with proper permissions
            log_file = f"{self.audit_log_path}/audit_{datetime.utcnow().date()}.log"
            async with aiofiles.open(log_file, mode="a") as f:
                await f.write(json.dumps(encrypted_entry) + "\n")
            
            # Set proper file permissions
            os.chmod(log_file, 0o600)
            
            # Also write to a separate secure audit trail
            await self._write_secure_audit_trail(audit)
            
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            # Alert security team
            await self._alert_security_team("audit_log_failure", str(e))
    
    def _encrypt_sensitive_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        sensitive_fields = ["user_id", "ip_address", "user_agent"]
        encrypted_data = data.copy()
        
        for field in sensitive_fields:
            if field in encrypted_data:
                encrypted_data[field] = self.encryption_key.encrypt(
                    str(encrypted_data[field]).encode()
                ).decode()
        
        return encrypted_data
    
    async def _write_secure_audit_trail(self, audit: ComplianceAudit):
        # Write to a separate secure audit trail for compliance
        secure_trail = {
            "audit_id": audit.audit_id,
            "timestamp": audit.timestamp.isoformat(),
            "action": audit.action,
            "user_id_hash": self._hash_content(audit.user_id),
            "compliance_checks": audit.compliance_checks,
            "risk_score": audit.risk_score,
            "compliance_version": audit.compliance_version
        }
        
        secure_file = f"{self.audit_log_path}/secure_trail_{datetime.utcnow().date()}.log"
        async with aiofiles.open(secure_file, mode="a") as f:
            await f.write(json.dumps(secure_trail) + "\n")
    
    async def _alert_security_team(self, alert_type: str, details: str):
        # Implement security team alerting
        alert = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": alert_type,
            "details": details,
            "severity": "high"
        }
        logger.error(f"Security Alert: {json.dumps(alert)}")
    
    async def cleanup_old_logs(self):
        try:
            current_time = datetime.utcnow()
            
            # Clean up based on retention policy
            for backup_type, policy in self.backup_retention_policy.items():
                cutoff_date = current_time - timedelta(days=policy["retention_days"])
                
                for filename in os.listdir(self.audit_log_path):
                    if filename.startswith(f"backup_{backup_type}_"):
                        file_path = os.path.join(self.audit_log_path, filename)
                        file_date = datetime.strptime(
                            filename.split("_")[2].split(".")[0],
                            "%Y-%m-%d"
                        )
                        
                        if file_date < cutoff_date:
                            # Securely delete old backups
                            if policy["encryption"]:
                                # Decrypt before deletion
                                await self._decrypt_file(file_path)
                            
                            # Overwrite with random data before deletion
                            with open(file_path, "wb") as f:
                                f.write(os.urandom(os.path.getsize(file_path)))
                            os.remove(file_path)
                            logger.info(f"Securely deleted old backup: {filename}")
                            
                            # Record metric
                            performance_monitor.increment_counter(
                                "backup_cleanup",
                                {
                                    "type": backup_type,
                                    "age_days": (current_time - file_date).days
                                }
                            )
        
        except Exception as e:
            logger.error(f"Error cleaning up old backups: {e}")
            await self._alert_security_team("backup_cleanup_failure", str(e))

    async def _decrypt_file(self, file_path: str):
        """Decrypt a file before deletion"""
        try:
            with open(file_path, "rb") as f:
                encrypted_data = f.read()
            
            decrypted_data = self.encryption_key.decrypt(encrypted_data)
            
            with open(file_path, "wb") as f:
                f.write(decrypted_data)
                
        except Exception as e:
            logger.error(f"Error decrypting file {file_path}: {e}")
            raise
    
    async def validate_compliance(
        self,
        content: str,
        user_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        with performance_monitor.track_request("compliance_validation"):
            try:
                # Run all compliance checks
                content_moderation = await self.moderate_content(content, user_context)
                learning_moderation = await self.moderate_learning_content(
                    content,
                    user_context.get("learning_profile", {})
                )
                
                # Check data retention compliance
                retention_compliant = await self._check_data_retention(user_context)
                
                # Calculate risk score
                risk_score = self._calculate_risk_score(
                    content_moderation,
                    learning_moderation,
                    retention_compliant
                )
                
                return {
                    "content_moderation": content_moderation.dict(),
                    "learning_moderation": learning_moderation.dict(),
                    "retention_compliant": retention_compliant,
                    "risk_score": risk_score,
                    "timestamp": datetime.utcnow().isoformat(),
                    "compliance_version": settings.API_VERSION
                }
            
            except Exception as e:
                logger.error(f"Compliance validation error: {e}")
                await self._alert_security_team("compliance_validation_failure", str(e))
                raise
    
    def _calculate_risk_score(
        self,
        content_moderation: ContentModerationResult,
        learning_moderation: LearningModerationResult,
        retention_compliant: bool
    ) -> float:
        # Implement risk scoring logic
        risk_score = 0.0
        
        if not content_moderation.is_safe:
            risk_score += 0.5
        
        if not learning_moderation.is_appropriate:
            risk_score += 0.3
        
        if not retention_compliant:
            risk_score += 0.2
        
        return min(risk_score, 1.0)

# Initialize compliance guard
compliance_guard = ComplianceGuard() 