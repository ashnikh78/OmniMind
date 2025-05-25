import time
import jwt
import bcrypt
import hashlib
import pyotp
import qrcode
import json
import geoip2.database
import uuid
from typing import Dict, Any, Optional, List, Tuple, Set
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr, Field
from fastapi import HTTPException, Security, Depends, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert, and_, or_, func
from app.core.config import settings
from app.core.monitoring import performance_monitor
from app.core.database import get_db
from app.core.notifications import NotificationManager

class DeviceInfo(BaseModel):
    device_id: str
    user_agent: str
    ip_address: str
    location: Optional[Dict[str, Any]] = None
    last_active: datetime
    is_current: bool = False
    risk_score: float = 0.0

class Session(BaseModel):
    id: str
    user_id: str
    device_id: str
    access_token: str
    refresh_token: str
    created_at: datetime
    expires_at: datetime
    last_active: datetime
    is_active: bool = True

class AuditLog(BaseModel):
    id: str
    user_id: str
    action: str
    resource: str
    status: str
    ip_address: str
    device_id: Optional[str] = None
    details: Dict[str, Any] = {}
    created_at: datetime

class UserActivity(BaseModel):
    id: str
    user_id: str
    action: str
    resource: str
    ip_address: str
    device_id: Optional[str] = None
    location: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    risk_score: float = 0.0

class SecurityPolicy(BaseModel):
    id: str
    name: str
    description: str
    rules: List[Dict[str, Any]]
    severity: str
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ComplianceReport(BaseModel):
    id: str
    report_type: str
    period_start: datetime
    period_end: datetime
    data: Dict[str, Any]
    status: str
    created_at: datetime
    created_by: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SecurityDashboard(BaseModel):
    id: str
    name: str
    description: str
    widgets: List[Dict[str, Any]]
    filters: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    created_by: str
    is_public: bool = False

class ThreatPattern(BaseModel):
    id: str
    name: str
    description: str
    pattern_type: str
    conditions: List[Dict[str, Any]]
    severity: str
    response_actions: List[str]
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = 0.0
    false_positive_rate: float = 0.0
    detection_threshold: float = 0.0
    attack_vector: str = ""
    mitigation_strategy: str = ""
    ioc_patterns: List[str] = Field(default_factory=list)
    cve_references: List[str] = Field(default_factory=list)
    mitre_attack_tactics: List[str] = Field(default_factory=list)
    kill_chain_phase: str = ""
    attack_complexity: str = ""
    required_privileges: str = ""
    impact_scope: List[str] = Field(default_factory=list)
    ml_confidence_score: float = 0.0
    attack_signature: str = ""
    detection_method: str = ""
    remediation_steps: List[str] = Field(default_factory=list)
    threat_intelligence: Dict[str, Any] = Field(default_factory=dict)
    zero_day_indicators: List[str] = Field(default_factory=list)
    supply_chain_indicators: List[str] = Field(default_factory=list)
    attack_chain: List[str] = Field(default_factory=list)
    vulnerability_chain: List[str] = Field(default_factory=list)
    ml_features: Dict[str, Any] = Field(default_factory=dict)

class DashboardWidget(BaseModel):
    id: str
    type: str
    title: str
    description: str
    config: Dict[str, Any]
    refresh_interval: int
    data_source: str
    visualization_type: str
    filters: Dict[str, Any] = Field(default_factory=dict)

class ComplianceRequirement(BaseModel):
    id: str
    standard: str
    requirement_id: str
    description: str
    controls: List[Dict[str, Any]]
    evidence_requirements: List[Dict[str, Any]]
    status: str
    last_assessment: datetime
    next_assessment: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SecurityMetrics:
    def __init__(self):
        self.failed_attempts = {}
        self.blocked_ips = {}
        self.last_cleanup = time.time()
        self.cleanup_interval = 3600  # 1 hour
    
    def record_failed_attempt(self, identifier: str):
        if identifier not in self.failed_attempts:
            self.failed_attempts[identifier] = []
        self.failed_attempts[identifier].append(time.time())
        self._cleanup_old_attempts()
    
    def is_blocked(self, identifier: str) -> bool:
        if identifier in self.blocked_ips:
            if time.time() - self.blocked_ips[identifier] < settings.security.BLOCK_DURATION:
                return True
            del self.blocked_ips[identifier]
        return False
    
    def _cleanup_old_attempts(self):
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return
        
        for identifier in list(self.failed_attempts.keys()):
            self.failed_attempts[identifier] = [
                t for t in self.failed_attempts[identifier]
                if current_time - t < settings.security.ATTEMPT_WINDOW
            ]
            if not self.failed_attempts[identifier]:
                del self.failed_attempts[identifier]
        
        self.last_cleanup = current_time

class User(BaseModel):
    id: str
    email: EmailStr
    hashed_password: str
    role: str
    permissions: List[str]
    is_active: bool = True
    last_login: Optional[datetime] = None
    failed_attempts: int = 0
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    password_reset_token: Optional[str] = None
    password_reset_expires: Optional[datetime] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class APIKey(BaseModel):
    id: str
    user_id: str
    name: str
    key: str
    scopes: List[str]
    rate_limit: int
    expires_at: Optional[datetime] = None
    last_used: Optional[datetime] = None
    is_active: bool = True
    created_at: datetime
    created_by: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SecurityAlert(BaseModel):
    id: str
    type: str
    severity: str
    message: str
    details: Dict[str, Any]
    user_id: Optional[str] = None
    ip_address: Optional[str] = None
    device_id: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None
    status: str = "active"

class SecurityManager:
    def __init__(self):
        self.redis_client = redis.Redis(
            host=settings.redis.HOST,
            port=settings.redis.PORT,
            password=settings.redis.PASSWORD,
            decode_responses=True
        )
        self.metrics = SecurityMetrics()
        self.oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
        
        # Initialize GeoIP database
        self.geoip_reader = geoip2.database.Reader('data/GeoLite2-City.mmdb')
        
        # Initialize API key header
        self.api_key_header = APIKeyHeader(name="X-API-Key")
        
        # Initialize notification manager
        self.notification_manager = NotificationManager()
        
        # Enhanced security checks
        self.security_checks = {
            "ip_reputation": self._check_ip_reputation,
            "behavioral_analysis": self._analyze_user_behavior,
            "anomaly_detection": self._detect_anomalies,
            "vulnerability_scan": self._scan_vulnerabilities,
            "malware_detection": self._detect_malware,
            "data_leak_prevention": self._prevent_data_leaks,
            "access_pattern_analysis": self._analyze_access_patterns,
            "session_security": self._check_session_security,
            "api_security": self._check_api_security,
            "network_security": self._check_network_security
        }
        
        # Initialize performance monitoring
        performance_monitor.register_metric("auth_attempts", "counter")
        performance_monitor.register_metric("auth_latency", "histogram")
        performance_monitor.register_metric("security_violations", "counter")
        performance_monitor.register_metric("mfa_attempts", "counter")
        performance_monitor.register_metric("session_events", "counter")
        performance_monitor.register_metric("audit_events", "counter")
        performance_monitor.register_metric("api_key_usage", "counter")
        performance_monitor.register_metric("security_alerts", "counter")
        performance_monitor.register_metric("user_activity", "counter")
        performance_monitor.register_metric("policy_violations", "counter")
        performance_monitor.register_metric("threat_detections", "counter")
        performance_monitor.register_metric("automated_responses", "counter")
        performance_monitor.register_metric("compliance_checks", "counter")
        
        # New security metrics
        performance_monitor.register_metric("ip_reputation_checks", "counter")
        performance_monitor.register_metric("behavioral_analysis_events", "counter")
        performance_monitor.register_metric("anomaly_detections", "counter")
        performance_monitor.register_metric("vulnerability_scans", "counter")
        performance_monitor.register_metric("malware_detections", "counter")
        performance_monitor.register_metric("data_leak_attempts", "counter")
        performance_monitor.register_metric("access_pattern_violations", "counter")
        performance_monitor.register_metric("session_security_events", "counter")
        performance_monitor.register_metric("api_security_events", "counter")
        performance_monitor.register_metric("network_security_events", "counter")

    async def _check_ip_reputation(self, ip_address: str) -> Dict[str, Any]:
        """Check IP reputation using threat intelligence"""
        try:
            # Implement IP reputation check
            reputation_data = await self._query_threat_intelligence(ip_address)
            performance_monitor.increment_counter("ip_reputation_checks", {"ip": ip_address})
            return reputation_data
        except Exception as e:
            logger.error(f"Error checking IP reputation: {e}")
            return {"error": str(e)}

    async def _analyze_user_behavior(self, user_id: str) -> Dict[str, Any]:
        """Analyze user behavior patterns"""
        try:
            # Implement behavioral analysis
            behavior_data = await self._get_user_behavior_data(user_id)
            performance_monitor.increment_counter("behavioral_analysis_events", {"user_id": user_id})
            return behavior_data
        except Exception as e:
            logger.error(f"Error analyzing user behavior: {e}")
            return {"error": str(e)}

    async def _detect_anomalies(self, activity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Detect anomalies in system activity"""
        try:
            # Implement anomaly detection
            anomalies = await self._analyze_activity_patterns(activity_data)
            performance_monitor.increment_counter("anomaly_detections", {"type": "activity"})
            return anomalies
        except Exception as e:
            logger.error(f"Error detecting anomalies: {e}")
            return {"error": str(e)}

    async def _scan_vulnerabilities(self) -> Dict[str, Any]:
        """Scan for system vulnerabilities"""
        try:
            # Implement vulnerability scanning
            vulnerabilities = await self._run_vulnerability_scan()
            performance_monitor.increment_counter("vulnerability_scans", {"status": "completed"})
            return vulnerabilities
        except Exception as e:
            logger.error(f"Error scanning vulnerabilities: {e}")
            return {"error": str(e)}

    async def _detect_malware(self, file_path: str) -> Dict[str, Any]:
        """Detect malware in files"""
        try:
            # Implement malware detection
            malware_data = await self._scan_file_for_malware(file_path)
            performance_monitor.increment_counter("malware_detections", {"file": file_path})
            return malware_data
        except Exception as e:
            logger.error(f"Error detecting malware: {e}")
            return {"error": str(e)}

    async def _prevent_data_leaks(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Prevent data leaks"""
        try:
            # Implement data leak prevention
            leak_prevention = await self._check_data_leak_risks(data)
            performance_monitor.increment_counter("data_leak_attempts", {"status": "prevented"})
            return leak_prevention
        except Exception as e:
            logger.error(f"Error preventing data leaks: {e}")
            return {"error": str(e)}

    async def _analyze_access_patterns(self, access_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze access patterns"""
        try:
            # Implement access pattern analysis
            patterns = await self._analyze_access_data(access_data)
            performance_monitor.increment_counter("access_pattern_violations", {"type": "access"})
            return patterns
        except Exception as e:
            logger.error(f"Error analyzing access patterns: {e}")
            return {"error": str(e)}

    async def _check_session_security(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check session security"""
        try:
            # Implement session security checks
            security_data = await self._validate_session_security(session_data)
            performance_monitor.increment_counter("session_security_events", {"type": "check"})
            return security_data
        except Exception as e:
            logger.error(f"Error checking session security: {e}")
            return {"error": str(e)}

    async def _check_api_security(self, api_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check API security"""
        try:
            # Implement API security checks
            security_data = await self._validate_api_security(api_data)
            performance_monitor.increment_counter("api_security_events", {"type": "check"})
            return security_data
        except Exception as e:
            logger.error(f"Error checking API security: {e}")
            return {"error": str(e)}

    async def _check_network_security(self) -> Dict[str, Any]:
        """Check network security"""
        try:
            # Implement network security checks
            security_data = await self._validate_network_security()
            performance_monitor.increment_counter("network_security_events", {"type": "check"})
            return security_data
        except Exception as e:
            logger.error(f"Error checking network security: {e}")
            return {"error": str(e)}
    
    async def authenticate_user(
        self,
        email: str,
        password: str,
        ip_address: str,
        mfa_code: Optional[str] = None
    ) -> Tuple[User, Token]:
        start_time = time.time()
        
        # Check if IP is blocked
        if self.metrics.is_blocked(ip_address):
            raise HTTPException(
                status_code=403,
                detail="Too many failed attempts. Please try again later."
            )
        
        # Get user from database
        user = await self._get_user_by_email(email)
        if not user:
            self.metrics.record_failed_attempt(ip_address)
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )
        
        # Verify password
        if not self._verify_password(password, user.hashed_password):
            user.failed_attempts += 1
            await self._update_user(user)
            self.metrics.record_failed_attempt(ip_address)
            
            if user.failed_attempts >= settings.security.MAX_FAILED_ATTEMPTS:
                self.metrics.blocked_ips[ip_address] = time.time()
            
            raise HTTPException(
                status_code=401,
                detail="Incorrect email or password"
            )
        
        # Verify MFA if enabled
        if user.mfa_enabled:
            if not mfa_code:
                raise HTTPException(
                    status_code=400,
                    detail="MFA code required"
                )
            if not await self.verify_mfa(user, mfa_code):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid MFA code"
                )
        
        # Reset failed attempts on successful login
        user.failed_attempts = 0
        user.last_login = datetime.utcnow()
        await self._update_user(user)
        
        # Generate tokens
        tokens = self._create_tokens(user)
        
        # Store token in Redis for tracking
        token_key = f"user_tokens:{user.id}:{tokens.access_token}"
        self.redis_client.setex(
            token_key,
            settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "active"
        )
        
        # Record metrics
        latency = time.time() - start_time
        performance_monitor.record_latency("auth", latency)
        performance_monitor.increment_counter("auth_attempts", {"status": "success"})
        
        return user, tokens
    
    def _verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(
            plain_password.encode(),
            hashed_password.encode()
        )
    
    def _create_tokens(self, user: User) -> Token:
        access_token_expires = timedelta(
            minutes=settings.security.ACCESS_TOKEN_EXPIRE_MINUTES
        )
        refresh_token_expires = timedelta(
            days=settings.security.REFRESH_TOKEN_EXPIRE_DAYS
        )
        
        access_token = self._create_token(
            data={"sub": user.id, "role": user.role},
            expires_delta=access_token_expires
        )
        refresh_token = self._create_token(
            data={"sub": user.id},
            expires_delta=refresh_token_expires
        )
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )
    
    def _create_token(
        self,
        data: Dict[str, Any],
        expires_delta: timedelta
    ) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + expires_delta
        to_encode.update({"exp": expire})
        return jwt.encode(
            to_encode,
            settings.security.SECRET_KEY,
            algorithm=settings.security.ALGORITHM
        )
    
    async def verify_token(
        self,
        token: str = Depends(oauth2_scheme)
    ) -> User:
        try:
            payload = jwt.decode(
                token,
                settings.security.SECRET_KEY,
                algorithms=[settings.security.ALGORITHM]
            )
            user_id = payload.get("sub")
            if user_id is None:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid authentication credentials"
                )
            
            # Check token blacklist
            if await self._is_token_blacklisted(token):
                raise HTTPException(
                    status_code=401,
                    detail="Token has been revoked"
                )
            
            user = await self._get_user_by_id(user_id)
            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="User not found"
                )
            
            return user
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials"
            )
    
    async def check_permission(
        self,
        user: User,
        required_permission: str
    ) -> bool:
        return required_permission in user.permissions
    
    async def rate_limit(
        self,
        identifier: str,
        limit: int,
        window: int
    ) -> bool:
        key = f"rate_limit:{identifier}"
        current = int(time.time())
        window_start = current - window
        
        # Clean up old entries
        self.redis_client.zremrangebyscore(key, 0, window_start)
        
        # Count requests in current window
        request_count = self.redis_client.zcard(key)
        
        if request_count >= limit:
            return False
        
        # Add current request
        self.redis_client.zadd(key, {str(current): current})
        self.redis_client.expire(key, window)
        
        return True
    
    async def _is_token_blacklisted(self, token: str) -> bool:
        return bool(self.redis_client.sismember("token_blacklist", token))
    
    async def blacklist_token(self, token: str):
        self.redis_client.sadd("token_blacklist", token)
        # Set expiration for blacklisted token
        self.redis_client.expire(
            "token_blacklist",
            settings.security.REFRESH_TOKEN_EXPIRE_DAYS * 86400
        )
    
    async def _get_user_by_email(self, email: str) -> Optional[User]:
        async with get_db() as db:
            query = select(User).where(User.email == email)
            result = await db.execute(query)
            user = result.scalar_one_or_none()
            return user
    
    async def _get_user_by_id(self, user_id: str) -> Optional[User]:
        async with get_db() as db:
            query = select(User).where(User.id == user_id)
            result = await db.execute(query)
            user = result.scalar_one_or_none()
            return user
    
    async def _update_user(self, user: User):
        async with get_db() as db:
            query = update(User).where(User.id == user.id).values(
                failed_attempts=user.failed_attempts,
                last_login=user.last_login,
                mfa_enabled=user.mfa_enabled,
                mfa_secret=user.mfa_secret,
                password_reset_token=user.password_reset_token,
                password_reset_expires=user.password_reset_expires
            )
            await db.execute(query)
            await db.commit()
    
    async def setup_mfa(self, user: User) -> Dict[str, str]:
        """Setup MFA for a user"""
        if user.mfa_enabled:
            raise HTTPException(
                status_code=400,
                detail="MFA is already enabled"
            )
        
        # Generate new MFA secret
        mfa_secret = pyotp.random_base32()
        totp = pyotp.TOTP(mfa_secret)
        
        # Generate QR code
        provisioning_uri = totp.provisioning_uri(
            user.email,
            issuer_name="OmniMind AI"
        )
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        qr_image = qr.make_image(fill_color="black", back_color="white")
        
        # Save QR code to file
        qr_path = f"static/mfa/{user.id}_qr.png"
        qr_image.save(qr_path)
        
        # Update user with MFA secret
        user.mfa_secret = mfa_secret
        await self._update_user(user)
        
        return {
            "secret": mfa_secret,
            "qr_code": qr_path
        }
    
    async def verify_mfa(self, user: User, mfa_code: str) -> bool:
        """Verify MFA code for a user"""
        if not user.mfa_enabled or not user.mfa_secret:
            raise HTTPException(
                status_code=400,
                detail="MFA is not enabled"
            )
        
        totp = pyotp.TOTP(user.mfa_secret)
        is_valid = totp.verify(mfa_code)
        
        # Record MFA attempt
        performance_monitor.increment_counter(
            "mfa_attempts",
            {"status": "success" if is_valid else "failed"}
        )
        
        return is_valid
    
    async def disable_mfa(self, user: User, mfa_code: str):
        """Disable MFA for a user"""
        if not user.mfa_enabled:
            raise HTTPException(
                status_code=400,
                detail="MFA is not enabled"
            )
        
        # Verify current MFA code
        if not await self.verify_mfa(user, mfa_code):
            raise HTTPException(
                status_code=401,
                detail="Invalid MFA code"
            )
        
        # Disable MFA
        user.mfa_enabled = False
        user.mfa_secret = None
        await self._update_user(user)
    
    async def generate_password_reset_token(self, email: str) -> str:
        """Generate a password reset token"""
        user = await self._get_user_by_email(email)
        if not user:
            # Don't reveal if user exists
            return None
        
        # Generate token
        token = hashlib.sha256(f"{user.id}{time.time()}".encode()).hexdigest()
        expires = datetime.utcnow() + timedelta(hours=1)
        
        # Update user
        user.password_reset_token = token
        user.password_reset_expires = expires
        await self._update_user(user)
        
        return token
    
    async def reset_password(
        self,
        token: str,
        new_password: str
    ) -> bool:
        """Reset password using token"""
        async with get_db() as db:
            query = select(User).where(
                User.password_reset_token == token,
                User.password_reset_expires > datetime.utcnow()
            )
            result = await db.execute(query)
            user = result.scalar_one_or_none()
            
            if not user:
                return False
            
            # Update password
            hashed_password = bcrypt.hashpw(
                new_password.encode(),
                bcrypt.gensalt()
            ).decode()
            
            # Clear reset token
            user.hashed_password = hashed_password
            user.password_reset_token = None
            user.password_reset_expires = None
            await self._update_user(user)
            
            # Blacklist all existing tokens
            await self.blacklist_all_user_tokens(user.id)
            
            return True
    
    async def blacklist_all_user_tokens(self, user_id: str):
        """Blacklist all tokens for a user"""
        # Get all active tokens for user from Redis
        pattern = f"user_tokens:{user_id}:*"
        keys = self.redis_client.keys(pattern)
        
        if keys:
            # Add to blacklist
            self.redis_client.sadd("token_blacklist", *keys)
            # Delete from active tokens
            self.redis_client.delete(*keys)
    
    async def create_session(
        self,
        user: User,
        request: Request,
        tokens: Token
    ) -> Session:
        """Create a new session for a user"""
        # Get device info
        device_id = self._generate_device_id(request)
        device_info = await self._get_or_create_device(user.id, device_id, request)
        
        # Create session
        session = Session(
            id=hashlib.sha256(f"{user.id}{time.time()}".encode()).hexdigest(),
            user_id=user.id,
            device_id=device_id,
            access_token=tokens.access_token,
            refresh_token=tokens.refresh_token,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(
                minutes=settings.security.ACCESS_TOKEN_EXPIRE_MINUTES
            ),
            last_active=datetime.utcnow(),
            is_active=True
        )
        
        # Store session in Redis
        session_key = f"session:{session.id}"
        self.redis_client.setex(
            session_key,
            settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            json.dumps(session.dict())
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(Session).values(**session.dict())
            )
            await db.commit()
        
        # Log session creation
        await self.log_audit(
            user.id,
            "session_create",
            "session",
            "success",
            request.client.host,
            device_id,
            {"session_id": session.id}
        )
        
        return session
    
    async def _get_or_create_device(
        self,
        user_id: str,
        device_id: str,
        request: Request
    ) -> DeviceInfo:
        """Get or create device info for a user"""
        # Get existing device
        device_key = f"device:{user_id}:{device_id}"
        device_data = self.redis_client.get(device_key)
        
        if device_data:
            device = DeviceInfo(**json.loads(device_data))
            device.last_active = datetime.utcnow()
        else:
            # Create new device
            location = self._get_location(request.client.host)
            device = DeviceInfo(
                device_id=device_id,
                user_agent=request.headers.get("user-agent", ""),
                ip_address=request.client.host,
                location=location,
                last_active=datetime.utcnow(),
                risk_score=self._calculate_risk_score(location)
            )
        
        # Update device info
        self.redis_client.setex(
            device_key,
            30 * 24 * 3600,  # 30 days
            json.dumps(device.dict())
        )
        
        return device
    
    def _generate_device_id(self, request: Request) -> str:
        """Generate a unique device ID"""
        user_agent = request.headers.get("user-agent", "")
        ip = request.client.host
        return hashlib.sha256(f"{user_agent}{ip}".encode()).hexdigest()
    
    def _get_location(self, ip_address: str) -> Optional[Dict[str, Any]]:
        """Get location information for an IP address"""
        try:
            response = self.geoip_reader.city(ip_address)
            return {
                "country": response.country.name,
                "city": response.city.name,
                "latitude": response.location.latitude,
                "longitude": response.location.longitude,
                "timezone": response.location.time_zone
            }
        except:
            return None
    
    def _calculate_risk_score(self, location: Optional[Dict[str, Any]]) -> float:
        """Calculate risk score based on location and other factors"""
        if not location:
            return 0.5  # Default risk score for unknown locations
        
        # Implement risk scoring logic based on:
        # - Country risk level
        # - Distance from usual locations
        # - Time zone difference
        # - Known VPN/Tor exit nodes
        # etc.
        return 0.0  # Placeholder
    
    async def get_active_sessions(self, user_id: str) -> List[Session]:
        """Get all active sessions for a user"""
        async with get_db() as db:
            query = select(Session).where(
                Session.user_id == user_id,
                Session.is_active == True
            )
            result = await db.execute(query)
            return result.scalars().all()
    
    async def revoke_session(self, session_id: str, user_id: str):
        """Revoke a specific session"""
        async with get_db() as db:
            # Update database
            query = update(Session).where(
                Session.id == session_id,
                Session.user_id == user_id
            ).values(is_active=False)
            await db.execute(query)
            await db.commit()
        
        # Remove from Redis
        session_key = f"session:{session_id}"
        self.redis_client.delete(session_key)
        
        # Blacklist token
        session_data = self.redis_client.get(session_key)
        if session_data:
            session = Session(**json.loads(session_data))
            await self.blacklist_token(session.access_token)
    
    async def revoke_all_sessions(self, user_id: str):
        """Revoke all sessions for a user"""
        async with get_db() as db:
            # Update database
            query = update(Session).where(
                Session.user_id == user_id
            ).values(is_active=False)
            await db.execute(query)
            await db.commit()
        
        # Remove from Redis
        pattern = f"session:*"
        keys = self.redis_client.keys(pattern)
        for key in keys:
            session_data = self.redis_client.get(key)
            if session_data:
                session = Session(**json.loads(session_data))
                if session.user_id == user_id:
                    self.redis_client.delete(key)
                    await self.blacklist_token(session.access_token)
    
    async def log_audit(
        self,
        user_id: str,
        action: str,
        resource: str,
        status: str,
        ip_address: str,
        device_id: Optional[str] = None,
        details: Dict[str, Any] = {}
    ):
        """Log an audit event"""
        log = AuditLog(
            id=hashlib.sha256(f"{user_id}{time.time()}".encode()).hexdigest(),
            user_id=user_id,
            action=action,
            resource=resource,
            status=status,
            ip_address=ip_address,
            device_id=device_id,
            details=details,
            created_at=datetime.utcnow()
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(AuditLog).values(**log.dict())
            )
            await db.commit()
        
        # Record metric
        performance_monitor.increment_counter(
            "audit_events",
            {
                "action": action,
                "status": status,
                "resource": resource
            }
        )
    
    async def get_audit_logs(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        resource: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[AuditLog]:
        """Get audit logs with filtering"""
        async with get_db() as db:
            query = select(AuditLog)
            
            if user_id:
                query = query.where(AuditLog.user_id == user_id)
            if action:
                query = query.where(AuditLog.action == action)
            if resource:
                query = query.where(AuditLog.resource == resource)
            if start_date:
                query = query.where(AuditLog.created_at >= start_date)
            if end_date:
                query = query.where(AuditLog.created_at <= end_date)
            
            query = query.order_by(AuditLog.created_at.desc()).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
    
    async def create_api_key(
        self,
        user_id: str,
        name: str,
        scopes: List[str],
        rate_limit: int,
        expires_at: Optional[datetime] = None,
        metadata: Dict[str, Any] = None
    ) -> APIKey:
        """Create a new API key"""
        # Generate API key
        key = f"omni_{uuid.uuid4().hex}"
        
        api_key = APIKey(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            key=key,
            scopes=scopes,
            rate_limit=rate_limit,
            expires_at=expires_at,
            created_at=datetime.utcnow(),
            created_by=user_id,
            metadata=metadata or {}
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(APIKey).values(**api_key.dict())
            )
            await db.commit()
        
        # Store in Redis for quick access
        key_data = {
            "user_id": user_id,
            "scopes": scopes,
            "rate_limit": rate_limit,
            "expires_at": expires_at.isoformat() if expires_at else None
        }
        self.redis_client.setex(
            f"api_key:{key}",
            30 * 24 * 3600,  # 30 days
            json.dumps(key_data)
        )
        
        # Log creation
        await self.log_audit(
            user_id,
            "api_key_create",
            "api_key",
            "success",
            "system",
            None,
            {"key_id": api_key.id, "name": name}
        )
        
        return api_key
    
    async def verify_api_key(
        self,
        key: str = Depends(api_key_header)
    ) -> Tuple[str, List[str]]:
        """Verify API key and return user_id and scopes"""
        # Check Redis first
        key_data = self.redis_client.get(f"api_key:{key}")
        if not key_data:
            # Check database
            async with get_db() as db:
                query = select(APIKey).where(
                    and_(
                        APIKey.key == key,
                        APIKey.is_active == True,
                        or_(
                            APIKey.expires_at == None,
                            APIKey.expires_at > datetime.utcnow()
                        )
                    )
                )
                result = await db.execute(query)
                api_key = result.scalar_one_or_none()
                
                if not api_key:
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid API key"
                    )
                
                # Cache in Redis
                key_data = {
                    "user_id": api_key.user_id,
                    "scopes": api_key.scopes,
                    "rate_limit": api_key.rate_limit,
                    "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None
                }
                self.redis_client.setex(
                    f"api_key:{key}",
                    30 * 24 * 3600,
                    json.dumps(key_data)
                )
        else:
            key_data = json.loads(key_data)
        
        # Update last used
        await self._update_api_key_usage(key)
        
        return key_data["user_id"], key_data["scopes"]
    
    async def _update_api_key_usage(self, key: str):
        """Update API key usage statistics"""
        async with get_db() as db:
            query = update(APIKey).where(
                APIKey.key == key
            ).values(
                last_used=datetime.utcnow()
            )
            await db.execute(query)
            await db.commit()
        
        # Record metric
        performance_monitor.increment_counter(
            "api_key_usage",
            {"key": key}
        )
    
    async def revoke_api_key(self, key_id: str, user_id: str):
        """Revoke an API key"""
        async with get_db() as db:
            # Update database
            query = update(APIKey).where(
                and_(
                    APIKey.id == key_id,
                    APIKey.user_id == user_id
                )
            ).values(is_active=False)
            await db.execute(query)
            await db.commit()
        
        # Remove from Redis
        pattern = f"api_key:*"
        keys = self.redis_client.keys(pattern)
        for key in keys:
            key_data = self.redis_client.get(key)
            if key_data:
                data = json.loads(key_data)
                if data.get("key_id") == key_id:
                    self.redis_client.delete(key)
                    break
        
        # Log revocation
        await self.log_audit(
            user_id,
            "api_key_revoke",
            "api_key",
            "success",
            "system",
            None,
            {"key_id": key_id}
        )
    
    async def create_security_alert(
        self,
        alert_type: str,
        severity: str,
        message: str,
        details: Dict[str, Any],
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        device_id: Optional[str] = None,
        background_tasks: Optional[BackgroundTasks] = None
    ) -> SecurityAlert:
        """Create a new security alert"""
        alert = SecurityAlert(
            id=str(uuid.uuid4()),
            type=alert_type,
            severity=severity,
            message=message,
            details=details,
            user_id=user_id,
            ip_address=ip_address,
            device_id=device_id,
            created_at=datetime.utcnow()
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(SecurityAlert).values(**alert.dict())
            )
            await db.commit()
        
        # Record metric
        performance_monitor.increment_counter(
            "security_alerts",
            {
                "type": alert_type,
                "severity": severity
            }
        )
        
        # Send notifications if high severity
        if severity in ["high", "critical"] and background_tasks:
            background_tasks.add_task(
                self._send_security_notifications,
                alert
            )
        
        return alert
    
    async def _send_security_notifications(self, alert: SecurityAlert):
        """Send security notifications"""
        # Notify security team
        await self.notification_manager.send_notification(
            "security_team",
            "Security Alert",
            f"{alert.severity.upper()}: {alert.message}",
            alert.details
        )
        
        # Notify user if applicable
        if alert.user_id:
            await self.notification_manager.send_notification(
                alert.user_id,
                "Security Alert",
                f"Security alert: {alert.message}",
                alert.details
            )
    
    async def get_active_alerts(
        self,
        severity: Optional[str] = None,
        alert_type: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100
    ) -> List[SecurityAlert]:
        """Get active security alerts"""
        async with get_db() as db:
            query = select(SecurityAlert).where(
                SecurityAlert.status == "active"
            )
            
            if severity:
                query = query.where(SecurityAlert.severity == severity)
            if alert_type:
                query = query.where(SecurityAlert.type == alert_type)
            if user_id:
                query = query.where(SecurityAlert.user_id == user_id)
            
            query = query.order_by(SecurityAlert.created_at.desc()).limit(limit)
            result = await db.execute(query)
            return result.scalars().all()
    
    async def resolve_alert(
        self,
        alert_id: str,
        resolution_details: Dict[str, Any]
    ):
        """Resolve a security alert"""
        async with get_db() as db:
            query = update(SecurityAlert).where(
                SecurityAlert.id == alert_id
            ).values(
                status="resolved",
                resolved_at=datetime.utcnow(),
                details={**resolution_details}
            )
            await db.execute(query)
            await db.commit()
        
        # Log resolution
        await self.log_audit(
            "system",
            "alert_resolve",
            "security_alert",
            "success",
            "system",
            None,
            {"alert_id": alert_id, "resolution": resolution_details}
        )
    
    async def track_user_activity(
        self,
        user_id: str,
        action: str,
        resource: str,
        request: Request,
        metadata: Dict[str, Any] = None
    ) -> UserActivity:
        """Track user activity and detect potential threats"""
        # Get device info
        device_id = self._generate_device_id(request)
        location = self._get_location(request.client.host)
        
        # Calculate risk score
        risk_score = await self._calculate_activity_risk(
            user_id,
            action,
            resource,
            request.client.host,
            device_id,
            location
        )
        
        activity = UserActivity(
            id=str(uuid.uuid4()),
            user_id=user_id,
            action=action,
            resource=resource,
            ip_address=request.client.host,
            device_id=device_id,
            location=location,
            metadata=metadata or {},
            created_at=datetime.utcnow(),
            risk_score=risk_score
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(UserActivity).values(**activity.dict())
            )
            await db.commit()
        
        # Store in Redis for quick access
        activity_key = f"user_activity:{user_id}:{activity.id}"
        self.redis_client.setex(
            activity_key,
            24 * 3600,  # 24 hours
            json.dumps(activity.dict())
        )
        
        # Record metric
        performance_monitor.increment_counter(
            "user_activity",
            {
                "action": action,
                "resource": resource,
                "risk_level": "high" if risk_score > 0.7 else "medium" if risk_score > 0.3 else "low"
            }
        )
        
        # Check for threats
        if risk_score > 0.7:
            await self._handle_high_risk_activity(activity)
        
        return activity
    
    async def _calculate_activity_risk(
        self,
        user_id: str,
        action: str,
        resource: str,
        ip_address: str,
        device_id: str,
        location: Optional[Dict[str, Any]]
    ) -> float:
        """Calculate risk score for user activity"""
        risk_score = 0.0
        
        # Check for suspicious IP
        if await self._is_suspicious_ip(ip_address):
            risk_score += 0.3
        
        # Check for unusual location
        if location and await self._is_unusual_location(user_id, location):
            risk_score += 0.2
        
        # Check for unusual time
        if await self._is_unusual_time(user_id):
            risk_score += 0.1
        
        # Check for sensitive resource access
        if resource in settings.security.SENSITIVE_RESOURCES:
            risk_score += 0.2
        
        # Check for unusual action pattern
        if await self._is_unusual_action_pattern(user_id, action):
            risk_score += 0.2
        
        return min(risk_score, 1.0)
    
    async def _handle_high_risk_activity(self, activity: UserActivity):
        """Handle high-risk user activity"""
        # Create security alert
        await self.create_security_alert(
            alert_type="high_risk_activity",
            severity="high",
            message=f"High-risk activity detected for user {activity.user_id}",
            details={
                "activity": activity.dict(),
                "risk_score": activity.risk_score
            },
            user_id=activity.user_id,
            ip_address=activity.ip_address,
            device_id=activity.device_id
        )
        
        # Check security policies
        await self._check_security_policies(activity)
    
    async def _check_security_policies(self, activity: UserActivity):
        """Check activity against security policies"""
        async with get_db() as db:
            query = select(SecurityPolicy).where(
                SecurityPolicy.is_active == True
            )
            result = await db.execute(query)
            policies = result.scalars().all()
        
        for policy in policies:
            if await self._evaluate_policy(policy, activity):
                await self._handle_policy_violation(policy, activity)
    
    async def _evaluate_policy(
        self,
        policy: SecurityPolicy,
        activity: UserActivity
    ) -> bool:
        """Evaluate activity against policy rules"""
        for rule in policy.rules:
            if rule["type"] == "ip_whitelist":
                if activity.ip_address not in rule["allowed_ips"]:
                    return True
            elif rule["type"] == "location_restriction":
                if activity.location and activity.location["country"] not in rule["allowed_countries"]:
                    return True
            elif rule["type"] == "time_restriction":
                if not self._is_within_time_window(activity.created_at, rule["time_window"]):
                    return True
            elif rule["type"] == "resource_access":
                if activity.resource in rule["restricted_resources"]:
                    return True
        
        return False
    
    async def _handle_policy_violation(
        self,
        policy: SecurityPolicy,
        activity: UserActivity
    ):
        """Handle security policy violation"""
        # Create security alert
        await self.create_security_alert(
            alert_type="policy_violation",
            severity=policy.severity,
            message=f"Security policy violation: {policy.name}",
            details={
                "policy": policy.dict(),
                "activity": activity.dict()
            },
            user_id=activity.user_id,
            ip_address=activity.ip_address,
            device_id=activity.device_id
        )
        
        # Record metric
        performance_monitor.increment_counter(
            "policy_violations",
            {
                "policy": policy.name,
                "severity": policy.severity
            }
        )
        
        # Take action based on policy severity
        if policy.severity == "critical":
            await self._handle_critical_violation(activity)
    
    async def generate_compliance_report(
        self,
        report_type: str,
        period_start: datetime,
        period_end: datetime,
        user_id: str
    ) -> ComplianceReport:
        """Generate compliance report"""
        # Collect report data
        data = await self._collect_compliance_data(
            report_type,
            period_start,
            period_end
        )
        
        report = ComplianceReport(
            id=str(uuid.uuid4()),
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            data=data,
            status="completed",
            created_at=datetime.utcnow(),
            created_by=user_id
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(ComplianceReport).values(**report.dict())
            )
            await db.commit()
        
        # Record metric
        performance_monitor.increment_counter(
            "compliance_checks",
            {"type": report_type}
        )
        
        return report
    
    async def _collect_compliance_data(
        self,
        report_type: str,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Collect data for compliance report"""
        async with get_db() as db:
            data = {
                "user_activities": await self._get_activity_stats(db, period_start, period_end),
                "security_alerts": await self._get_alert_stats(db, period_start, period_end),
                "policy_violations": await self._get_violation_stats(db, period_start, period_end),
                "authentication_events": await self._get_auth_stats(db, period_start, period_end)
            }
        
        return data
    
    async def create_security_dashboard(
        self,
        name: str,
        description: str,
        widgets: List[Dict[str, Any]],
        filters: Dict[str, Any],
        user_id: str,
        is_public: bool = False
    ) -> SecurityDashboard:
        """Create security dashboard"""
        dashboard = SecurityDashboard(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            widgets=widgets,
            filters=filters,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            created_by=user_id,
            is_public=is_public
        )
        
        # Store in database
        async with get_db() as db:
            await db.execute(
                insert(SecurityDashboard).values(**dashboard.dict())
            )
            await db.commit()
        
        return dashboard
    
    async def get_dashboard_data(
        self,
        dashboard_id: str,
        filters: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Get data for security dashboard"""
        async with get_db() as db:
            # Get dashboard
            query = select(SecurityDashboard).where(
                SecurityDashboard.id == dashboard_id
            )
            result = await db.execute(query)
            dashboard = result.scalar_one_or_none()
            
            if not dashboard:
                raise HTTPException(
                    status_code=404,
                    detail="Dashboard not found"
                )
            
            # Get data for each widget
            data = {}
            for widget in dashboard.widgets:
                widget_data = await self._get_widget_data(
                    db,
                    widget,
                    filters or dashboard.filters
                )
                data[widget["id"]] = widget_data
            
            return data
    
    async def _get_widget_data(
        self,
        db: AsyncSession,
        widget: Dict[str, Any],
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get data for dashboard widget"""
        if widget["type"] == "activity_timeline":
            return await self._get_activity_timeline(db, filters)
        elif widget["type"] == "alert_summary":
            return await self._get_alert_summary(db, filters)
        elif widget["type"] == "policy_violations":
            return await self._get_violation_summary(db, filters)
        elif widget["type"] == "user_risk":
            return await self._get_user_risk_summary(db, filters)
        elif widget["type"] == "threat_map":
            return await self._get_threat_map_data(db, filters)
        elif widget["type"] == "compliance_status":
            return await self._get_compliance_status(db, filters)
        elif widget["type"] == "resource_usage":
            return await self._get_resource_usage_data(db, filters)
        elif widget["type"] == "security_metrics":
            return await self._get_security_metrics_data(db, filters)
        elif widget["type"] == "network_graph":
            return await self._get_network_graph_data(db, filters)
        elif widget["type"] == "heat_map":
            return await self._get_heat_map_data(db, filters)
        elif widget["type"] == "threat_timeline":
            return await self._get_threat_timeline_data(db, filters)
        elif widget["type"] == "attack_surface":
            return await self._get_attack_surface_data(db, filters)
        elif widget["type"] == "3d_network_graph":
            return await self._get_3d_network_graph_data(db, filters)
        elif widget["type"] == "real_time_threat_feed":
            return await self._get_real_time_threat_feed_data(db, filters)
        elif widget["type"] == "behavioral_analytics":
            return await self._get_behavioral_analytics_data(db, filters)
        elif widget["type"] == "anomaly_detection":
            return await self._get_anomaly_detection_data(db, filters)
        elif widget["type"] == "threat_intelligence_map":
            return await self._get_threat_intelligence_map_data(db, filters)
        elif widget["type"] == "vulnerability_heat_map":
            return await self._get_vulnerability_heat_map_data(db, filters)
        elif widget["type"] == "attack_surface_analysis":
            return await self._get_attack_surface_analysis_data(db, filters)
        elif widget["type"] == "security_posture":
            return await self._get_security_posture_data(db, filters)
        elif widget["type"] == "threat_hunting":
            return await self._get_threat_hunting_data(db, filters)
        elif widget["type"] == "network_traffic_analysis":
            return await self._get_network_traffic_data(db, filters)
        elif widget["type"] == "malware_analysis":
            return await self._get_malware_analysis_data(db, filters)
        elif widget["type"] == "threat_intelligence_feed":
            return await self._get_threat_intelligence_feed_data(db, filters)
        elif widget["type"] == "ml_insights":
            return await self._get_ml_insights_data(db, filters)
        elif widget["type"] == "attack_graph":
            return await self._get_attack_graph_data(db, filters)
        elif widget["type"] == "vulnerability_chain":
            return await self._get_vulnerability_chain_data(db, filters)
        elif widget["type"] == "ml_analysis":
            return await self._get_ml_analysis_data(db, filters)
        else:
            return {}
    
    async def _is_suspicious_ip(self, ip_address: str) -> bool:
        """Check if IP address is suspicious"""
        # Check Redis cache first
        cache_key = f"suspicious_ip:{ip_address}"
        cached = self.redis_client.get(cache_key)
        if cached is not None:
            return cached == "true"
        
        # Check against known malicious IPs
        if ip_address in settings.security.BLACKLISTED_IPS:
            self.redis_client.setex(cache_key, 3600, "true")
            return True
        
        # Check for recent failed attempts
        failed_attempts = self.metrics.failed_attempts.get(ip_address, [])
        if len(failed_attempts) >= settings.security.MAX_FAILED_ATTEMPTS:
            self.redis_client.setex(cache_key, 3600, "true")
            return True
        
        # Check for unusual access patterns
        async with get_db() as db:
            query = select(func.count(UserActivity.id)).where(
                and_(
                    UserActivity.ip_address == ip_address,
                    UserActivity.created_at >= datetime.utcnow() - timedelta(hours=1)
                )
            )
            result = await db.execute(query)
            activity_count = result.scalar_one()
            
            if activity_count > settings.security.MAX_ACTIVITY_PER_HOUR:
                self.redis_client.setex(cache_key, 3600, "true")
                return True
        
        self.redis_client.setex(cache_key, 3600, "false")
        return False
    
    async def _is_unusual_location(self, user_id: str, location: Dict[str, Any]) -> bool:
        """Check if user's location is unusual"""
        # Get user's usual locations
        async with get_db() as db:
            query = select(UserActivity).where(
                and_(
                    UserActivity.user_id == user_id,
                    UserActivity.created_at >= datetime.utcnow() - timedelta(days=30)
                )
            )
            result = await db.execute(query)
            activities = result.scalars().all()
        
        if not activities:
            return False
        
        # Calculate location frequency
        location_freq = {}
        for activity in activities:
            if activity.location:
                country = activity.location.get("country")
                if country:
                    location_freq[country] = location_freq.get(country, 0) + 1
        
        # Check if current location is unusual
        current_country = location.get("country")
        if not current_country:
            return True
        
        total_activities = sum(location_freq.values())
        if total_activities == 0:
            return False
        
        country_frequency = location_freq.get(current_country, 0) / total_activities
        return country_frequency < settings.security.MIN_LOCATION_FREQUENCY
    
    async def _is_unusual_time(self, user_id: str) -> bool:
        """Check if activity time is unusual for the user"""
        async with get_db() as db:
            query = select(UserActivity).where(
                and_(
                    UserActivity.user_id == user_id,
                    UserActivity.created_at >= datetime.utcnow() - timedelta(days=30)
                )
            )
            result = await db.execute(query)
            activities = result.scalars().all()
        
        if not activities:
            return False
        
        # Calculate usual activity hours
        activity_hours = [a.created_at.hour for a in activities]
        current_hour = datetime.utcnow().hour
        
        # Check if current hour is within usual activity range
        hour_freq = {}
        for hour in activity_hours:
            hour_freq[hour] = hour_freq.get(hour, 0) + 1
        
        total_activities = sum(hour_freq.values())
        if total_activities == 0:
            return False
        
        current_hour_freq = hour_freq.get(current_hour, 0) / total_activities
        return current_hour_freq < settings.security.MIN_HOUR_FREQUENCY
    
    async def _is_unusual_action_pattern(self, user_id: str, action: str) -> bool:
        """Check if action pattern is unusual for the user"""
        async with get_db() as db:
            query = select(UserActivity).where(
                and_(
                    UserActivity.user_id == user_id,
                    UserActivity.created_at >= datetime.utcnow() - timedelta(days=30)
                )
            )
            result = await db.execute(query)
            activities = result.scalars().all()
        
        if not activities:
            return False
        
        # Calculate action frequency
        action_freq = {}
        for activity in activities:
            action_freq[activity.action] = action_freq.get(activity.action, 0) + 1
        
        total_actions = sum(action_freq.values())
        if total_actions == 0:
            return False
        
        action_frequency = action_freq.get(action, 0) / total_actions
        return action_frequency < settings.security.MIN_ACTION_FREQUENCY
    
    async def _is_within_time_window(self, timestamp: datetime, time_window: Dict[str, Any]) -> bool:
        """Check if timestamp is within allowed time window"""
        current_time = timestamp.time()
        start_time = datetime.strptime(time_window["start"], "%H:%M").time()
        end_time = datetime.strptime(time_window["end"], "%H:%M").time()
        
        if start_time <= end_time:
            return start_time <= current_time <= end_time
        else:
            # Handle overnight time windows
            return current_time >= start_time or current_time <= end_time
    
    async def _handle_critical_violation(self, activity: UserActivity):
        """Handle critical security policy violation"""
        # Block user
        await self._block_user(activity.user_id)
        
        # Revoke all sessions
        await self.revoke_all_sessions(activity.user_id)
        
        # Notify security team
        await self.notification_manager.send_notification(
            "security_team",
            "Critical Security Violation",
            f"User {activity.user_id} has been blocked due to critical policy violation",
            {
                "activity": activity.dict(),
                "action_taken": "User blocked and sessions revoked"
            }
        )
    
    async def _block_user(self, user_id: str):
        """Block a user account"""
        async with get_db() as db:
            query = update(User).where(
                User.id == user_id
            ).values(
                is_active=False,
                blocked_at=datetime.utcnow()
            )
            await db.execute(query)
            await db.commit()
        
        # Log blocking
        await self.log_audit(
            "system",
            "user_block",
            "user",
            "success",
            "system",
            None,
            {"user_id": user_id}
        )
    
    async def _get_activity_stats(
        self,
        db: AsyncSession,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Get user activity statistics"""
        # Get total activities
        query = select(func.count(UserActivity.id)).where(
            and_(
                UserActivity.created_at >= period_start,
                UserActivity.created_at <= period_end
            )
        )
        result = await db.execute(query)
        total_activities = result.scalar_one()
        
        # Get activities by risk level
        query = select(
            func.count(UserActivity.id),
            UserActivity.risk_score
        ).where(
            and_(
                UserActivity.created_at >= period_start,
                UserActivity.created_at <= period_end
            )
        ).group_by(UserActivity.risk_score)
        result = await db.execute(query)
        risk_distribution = {
            "low": 0,
            "medium": 0,
            "high": 0
        }
        for count, risk in result:
            if risk < 0.3:
                risk_distribution["low"] += count
            elif risk < 0.7:
                risk_distribution["medium"] += count
            else:
                risk_distribution["high"] += count
        
        return {
            "total_activities": total_activities,
            "risk_distribution": risk_distribution
        }
    
    async def _get_alert_stats(
        self,
        db: AsyncSession,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Get security alert statistics"""
        # Get total alerts
        query = select(func.count(SecurityAlert.id)).where(
            and_(
                SecurityAlert.created_at >= period_start,
                SecurityAlert.created_at <= period_end
            )
        )
        result = await db.execute(query)
        total_alerts = result.scalar_one()
        
        # Get alerts by severity
        query = select(
            func.count(SecurityAlert.id),
            SecurityAlert.severity
        ).where(
            and_(
                SecurityAlert.created_at >= period_start,
                SecurityAlert.created_at <= period_end
            )
        ).group_by(SecurityAlert.severity)
        result = await db.execute(query)
        severity_distribution = {
            "low": 0,
            "medium": 0,
            "high": 0,
            "critical": 0
        }
        for count, severity in result:
            severity_distribution[severity] = count
        
        return {
            "total_alerts": total_alerts,
            "severity_distribution": severity_distribution
        }
    
    async def _get_violation_stats(
        self,
        db: AsyncSession,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Get policy violation statistics"""
        # Get total violations
        query = select(func.count(SecurityAlert.id)).where(
            and_(
                SecurityAlert.created_at >= period_start,
                SecurityAlert.created_at <= period_end,
                SecurityAlert.type == "policy_violation"
            )
        )
        result = await db.execute(query)
        total_violations = result.scalar_one()
        
        # Get violations by policy
        query = select(
            func.count(SecurityAlert.id),
            SecurityAlert.details["policy"]["name"].astext
        ).where(
            and_(
                SecurityAlert.created_at >= period_start,
                SecurityAlert.created_at <= period_end,
                SecurityAlert.type == "policy_violation"
            )
        ).group_by(SecurityAlert.details["policy"]["name"].astext)
        result = await db.execute(query)
        policy_violations = {name: count for count, name in result}
        
        return {
            "total_violations": total_violations,
            "policy_violations": policy_violations
        }
    
    async def _get_auth_stats(
        self,
        db: AsyncSession,
        period_start: datetime,
        period_end: datetime
    ) -> Dict[str, Any]:
        """Get authentication statistics"""
        # Get total auth attempts
        query = select(func.count(UserActivity.id)).where(
            and_(
                UserActivity.created_at >= period_start,
                UserActivity.created_at <= period_end,
                UserActivity.action == "login"
            )
        )
        result = await db.execute(query)
        total_attempts = result.scalar_one()
        
        # Get failed attempts
        query = select(func.count(UserActivity.id)).where(
            and_(
                UserActivity.created_at >= period_start,
                UserActivity.created_at <= period_end,
                UserActivity.action == "login_failed"
            )
        )
        result = await db.execute(query)
        failed_attempts = result.scalar_one()
        
        return {
            "total_attempts": total_attempts,
            "failed_attempts": failed_attempts,
            "success_rate": (total_attempts - failed_attempts) / total_attempts if total_attempts > 0 else 0
        }
    
    async def _get_activity_timeline(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get activity timeline data for dashboard"""
        query = select(UserActivity).where(
            UserActivity.created_at >= datetime.utcnow() - timedelta(days=7)
        )
        
        if "user_id" in filters:
            query = query.where(UserActivity.user_id == filters["user_id"])
        if "action" in filters:
            query = query.where(UserActivity.action == filters["action"])
        
        query = query.order_by(UserActivity.created_at)
        result = await db.execute(query)
        activities = result.scalars().all()
        
        return {
            "timeline": [
                {
                    "timestamp": activity.created_at.isoformat(),
                    "action": activity.action,
                    "resource": activity.resource,
                    "risk_score": activity.risk_score
                }
                for activity in activities
            ]
        }
    
    async def _get_alert_summary(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get alert summary data for dashboard"""
        query = select(SecurityAlert).where(
            and_(
                SecurityAlert.created_at >= datetime.utcnow() - timedelta(days=7),
                SecurityAlert.status == "active"
            )
        )
        
        if "severity" in filters:
            query = query.where(SecurityAlert.severity == filters["severity"])
        if "type" in filters:
            query = query.where(SecurityAlert.type == filters["type"])
        
        result = await db.execute(query)
        alerts = result.scalars().all()
        
        return {
            "alerts": [
                {
                    "id": alert.id,
                    "type": alert.type,
                    "severity": alert.severity,
                    "message": alert.message,
                    "created_at": alert.created_at.isoformat()
                }
                for alert in alerts
            ]
        }
    
    async def _get_violation_summary(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get policy violation summary data for dashboard"""
        query = select(SecurityAlert).where(
            and_(
                SecurityAlert.created_at >= datetime.utcnow() - timedelta(days=7),
                SecurityAlert.type == "policy_violation"
            )
        )
        
        if "severity" in filters:
            query = query.where(SecurityAlert.severity == filters["severity"])
        
        result = await db.execute(query)
        violations = result.scalars().all()
        
        return {
            "violations": [
                {
                    "id": violation.id,
                    "policy": violation.details["policy"]["name"],
                    "severity": violation.severity,
                    "created_at": violation.created_at.isoformat()
                }
                for violation in violations
            ]
        }
    
    async def _get_user_risk_summary(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get user risk summary data for dashboard"""
        query = select(
            UserActivity.user_id,
            func.avg(UserActivity.risk_score).label("avg_risk"),
            func.count(UserActivity.id).label("activity_count")
        ).where(
            UserActivity.created_at >= datetime.utcnow() - timedelta(days=7)
        )
        
        if "min_risk" in filters:
            query = query.having(func.avg(UserActivity.risk_score) >= filters["min_risk"])
        
        query = query.group_by(UserActivity.user_id)
        result = await db.execute(query)
        user_risks = result.all()
        
        return {
            "user_risks": [
                {
                    "user_id": user_id,
                    "average_risk": float(avg_risk),
                    "activity_count": activity_count
                }
                for user_id, avg_risk, activity_count in user_risks
            ]
        }

    async def detect_threats(self, activity: UserActivity) -> List[ThreatPattern]:
        """Detect threats based on activity patterns"""
        detected_threats = []
        
        # Existing threat checks
        if await self._detect_brute_force(activity):
            detected_threats.append(await self._get_threat_pattern("brute_force"))
        
        if await self._detect_data_exfiltration(activity):
            detected_threats.append(await self._get_threat_pattern("data_exfiltration"))
        
        if await self._detect_privilege_escalation(activity):
            detected_threats.append(await self._get_threat_pattern("privilege_escalation"))
        
        if await self._detect_suspicious_file_access(activity):
            detected_threats.append(await self._get_threat_pattern("suspicious_file_access"))
        
        if await self._detect_unusual_api_usage(activity):
            detected_threats.append(await self._get_threat_pattern("unusual_api_usage"))
        
        if await self._detect_credential_stuffing(activity):
            detected_threats.append(await self._get_threat_pattern("credential_stuffing"))
        
        if await self._detect_session_hijacking(activity):
            detected_threats.append(await self._get_threat_pattern("session_hijacking"))
        
        if await self._detect_insider_threat(activity):
            detected_threats.append(await self._get_threat_pattern("insider_threat"))
        
        if await self._detect_ransomware_activity(activity):
            detected_threats.append(await self._get_threat_pattern("ransomware_activity"))
        
        if await self._detect_crypto_mining(activity):
            detected_threats.append(await self._get_threat_pattern("crypto_mining"))
        
        if await self._detect_ddos_attack(activity):
            detected_threats.append(await self._get_threat_pattern("ddos_attack"))
        
        if await self._detect_sql_injection(activity):
            detected_threats.append(await self._get_threat_pattern("sql_injection"))
        
        if await self._detect_xss_attack(activity):
            detected_threats.append(await self._get_threat_pattern("xss_attack"))
        
        if await self._detect_csrf_attack(activity):
            detected_threats.append(await self._get_threat_pattern("csrf_attack"))
        
        if await self._detect_man_in_middle(activity):
            detected_threats.append(await self._get_threat_pattern("man_in_middle"))
        
        # New threat checks
        if await self._detect_file_inclusion(activity):
            detected_threats.append(await self._get_threat_pattern("file_inclusion"))
        
        if await self._detect_command_injection(activity):
            detected_threats.append(await self._get_threat_pattern("command_injection"))
        
        if await self._detect_ssrf_attack(activity):
            detected_threats.append(await self._get_threat_pattern("ssrf_attack"))
        
        if await self._detect_xxe_attack(activity):
            detected_threats.append(await self._get_threat_pattern("xxe_attack"))
        
        if await self._detect_deserialization_attack(activity):
            detected_threats.append(await self._get_threat_pattern("deserialization_attack"))
        
        # New threat checks
        if await self._detect_buffer_overflow(activity):
            detected_threats.append(await self._get_threat_pattern("buffer_overflow"))
        
        if await self._detect_race_condition(activity):
            detected_threats.append(await self._get_threat_pattern("race_condition"))
        
        if await self._detect_integer_overflow(activity):
            detected_threats.append(await self._get_threat_pattern("integer_overflow"))
        
        if await self._detect_format_string(activity):
            detected_threats.append(await self._get_threat_pattern("format_string"))
        
        if await self._detect_heap_overflow(activity):
            detected_threats.append(await self._get_threat_pattern("heap_overflow"))
        
        # New threat checks
        if await self._detect_side_channel_attack(activity):
            detected_threats.append(await self._get_threat_pattern("side_channel_attack"))
        
        if await self._detect_timing_attack(activity):
            detected_threats.append(await self._get_threat_pattern("timing_attack"))
        
        if await self._detect_power_analysis(activity):
            detected_threats.append(await self._get_threat_pattern("power_analysis"))
        
        if await self._detect_cache_attack(activity):
            detected_threats.append(await self._get_threat_pattern("cache_attack"))
        
        if await self._detect_spectre_meltdown(activity):
            detected_threats.append(await self._get_threat_pattern("spectre_meltdown"))
        
        # New threat checks
        if await self._detect_zero_day_exploit(activity):
            detected_threats.append(await self._get_threat_pattern("zero_day_exploit"))
        
        if await self._detect_supply_chain_attack(activity):
            detected_threats.append(await self._get_threat_pattern("supply_chain_attack"))
        
        if await self._detect_advanced_persistent_threat(activity):
            detected_threats.append(await self._get_threat_pattern("advanced_persistent_threat"))
        
        if await self._detect_watering_hole_attack(activity):
            detected_threats.append(await self._get_threat_pattern("watering_hole_attack"))
        
        if await self._detect_island_hopping_attack(activity):
            detected_threats.append(await self._get_threat_pattern("island_hopping_attack"))
        
        # ML-based threat detection
        ml_threats = await self._detect_threats_ml(activity)
        detected_threats.extend(ml_threats)
        
        # Handle detected threats
        for threat in detected_threats:
            await self._handle_threat_detection(threat, activity)
        
        return detected_threats
    
    async def _detect_brute_force(self, activity: UserActivity) -> bool:
        """Detect brute force attempts"""
        if activity.action != "login_failed":
            return False
        
        async with get_db() as db:
            # Check recent failed attempts
            query = select(func.count(UserActivity.id)).where(
                and_(
                    UserActivity.user_id == activity.user_id,
                    UserActivity.action == "login_failed",
                    UserActivity.created_at >= datetime.utcnow() - timedelta(minutes=15)
                )
            )
            result = await db.execute(query)
            failed_attempts = result.scalar_one()
            
            return failed_attempts >= settings.security.MAX_FAILED_ATTEMPTS
    
    async def _detect_data_exfiltration(self, activity: UserActivity) -> bool:
        """Detect potential data exfiltration"""
        if activity.action not in ["download", "export", "api_request"]:
            return False
        
        # Check for large data transfers
        if activity.metadata.get("size", 0) > settings.security.MAX_DATA_TRANSFER:
            return True
        
        # Check for sensitive data patterns
        if activity.metadata.get("contains_sensitive_data", False):
            return True
        
        # Check for unusual export patterns
        if await self._is_unusual_export_pattern(activity):
            return True
        
        return False
    
    async def _detect_privilege_escalation(self, activity: UserActivity) -> bool:
        """Detect privilege escalation attempts"""
        if activity.action not in ["role_change", "permission_change"]:
            return False
        
        # Check for self-promotion
        if activity.metadata.get("self_promotion", False):
            return True
        
        # Check for unusual permission changes
        if await self._is_unusual_permission_change(activity):
            return True
        
        return False
    
    async def _detect_suspicious_file_access(self, activity: UserActivity) -> bool:
        """Detect suspicious file access patterns"""
        if activity.action != "file_access":
            return False
        
        # Check for sensitive file access
        if activity.resource in settings.security.SENSITIVE_FILES:
            return True
        
        # Check for unusual access patterns
        if await self._is_unusual_file_access(activity):
            return True
        
        return False
    
    async def _detect_unusual_api_usage(self, activity: UserActivity) -> bool:
        """Detect unusual API usage patterns"""
        if activity.action != "api_request":
            return False
        
        # Check for unusual endpoint access
        if activity.resource in settings.security.RESTRICTED_ENDPOINTS:
            return True
        
        # Check for unusual request patterns
        if await self._is_unusual_request_pattern(activity):
            return True
        
        return False
    
    async def _handle_threat_detection(self, threat: ThreatPattern, activity: UserActivity):
        """Handle detected threat"""
        # Create security alert
        await self.create_security_alert(
            alert_type="threat_detection",
            severity=threat.severity,
            message=f"Threat detected: {threat.name}",
            details={
                "threat": threat.dict(),
                "activity": activity.dict()
            },
            user_id=activity.user_id,
            ip_address=activity.ip_address,
            device_id=activity.device_id
        )
        
        # Execute response actions
        for action in threat.response_actions:
            await self._execute_response_action(action, activity)
        
        # Record metric
        performance_monitor.increment_counter(
            "threat_detections",
            {
                "threat_type": threat.pattern_type,
                "severity": threat.severity
            }
        )
    
    async def _execute_response_action(self, action: str, activity: UserActivity):
        """Execute automated response action"""
        # Existing actions
        if action == "block_user":
            await self._block_user(activity.user_id)
        elif action == "revoke_sessions":
            await self.revoke_all_sessions(activity.user_id)
        elif action == "disable_mfa":
            await self._disable_user_mfa(activity.user_id)
        elif action == "notify_security":
            await self._notify_security_team(activity)
        elif action == "log_incident":
            await self._log_security_incident(activity)
        elif action == "quarantine_device":
            await self._quarantine_device(activity.device_id)
        elif action == "block_ip":
            await self._block_ip_address(activity.ip_address)
        elif action == "enable_enhanced_monitoring":
            await self._enable_enhanced_monitoring(activity.user_id)
        elif action == "initiate_incident_response":
            await self._initiate_incident_response(activity)
        elif action == "backup_critical_data":
            await self._backup_critical_data()
        elif action == "rate_limit_ip":
            await self._rate_limit_ip(activity.ip_address)
        elif action == "enable_waf":
            await self._enable_waf_protection()
        elif action == "isolate_network":
            await self._isolate_network_segment()
        elif action == "deploy_honeypot":
            await self._deploy_honeypot(activity)
        elif action == "update_firewall_rules":
            await self._update_firewall_rules(activity)
        
        # New actions
        elif action == "apply_security_patch":
            await self._apply_security_patch(activity)
        elif action == "initiate_threat_hunting":
            await self._initiate_threat_hunting(activity)
        elif action == "update_ips_rules":
            await self._update_ips_rules(activity)
        elif action == "enable_behavioral_analytics":
            await self._enable_behavioral_analytics(activity)
        elif action == "deploy_decoy_data":
            await self._deploy_decoy_data(activity)
        elif action == "execute_incident_playbook":
            await self._execute_incident_playbook(activity)
        elif action == "update_threat_intelligence":
            await self._update_threat_intelligence(activity)
        elif action == "deploy_honeypot":
            await self._deploy_honeypot(activity)
        elif action == "enable_advanced_monitoring":
            await self._enable_advanced_monitoring(activity)
        elif action == "initiate_forensic_analysis":
            await self._initiate_forensic_analysis(activity)
        elif action == "apply_security_patch":
            await self._apply_security_patch(activity)
        elif action == "initiate_threat_hunting":
            await self._initiate_threat_hunting(activity)
        elif action == "update_threat_intelligence":
            await self._update_threat_intelligence(activity)
        elif action == "enable_ml_monitoring":
            await self._enable_ml_monitoring(activity)
        elif action == "deploy_network_controls":
            await self._deploy_network_controls(activity)
        elif action == "analyze_attack_chain":
            await self._analyze_attack_chain(activity)
        elif action == "mitigate_vulnerability_chain":
            await self._mitigate_vulnerability_chain(activity)
        
        # Record metric
        performance_monitor.increment_counter(
            "automated_responses",
            {"action": action}
        )
    
    async def _get_threat_pattern(self, pattern_type: str) -> ThreatPattern:
        """Get threat pattern by type"""
        async with get_db() as db:
            query = select(ThreatPattern).where(
                ThreatPattern.pattern_type == pattern_type
            )
            result = await db.execute(query)
            pattern = result.scalar_one_or_none()
            
            if not pattern:
                raise HTTPException(
                    status_code=404,
                    detail="Threat pattern not found"
                )
            
            return pattern

    async def _detect_credential_stuffing(self, activity: UserActivity) -> bool:
        """Detect credential stuffing attempts"""
        if activity.action != "login_failed":
            return False
        
        async with get_db() as db:
            # Check for multiple failed logins from same IP
            query = select(func.count(UserActivity.id)).where(
                and_(
                    UserActivity.ip_address == activity.ip_address,
                    UserActivity.action == "login_failed",
                    UserActivity.created_at >= datetime.utcnow() - timedelta(minutes=5)
                )
            )
            result = await db.execute(query)
            failed_attempts = result.scalar_one()
            
            # Check for known credential stuffing patterns
            if activity.metadata.get("known_credential_pattern", False):
                return True
            
            return failed_attempts >= settings.security.MAX_CREDENTIAL_STUFFING_ATTEMPTS

    async def _detect_session_hijacking(self, activity: UserActivity) -> bool:
        """Detect potential session hijacking"""
        if activity.action != "session_access":
            return False
        
        # Check for session token reuse
        if activity.metadata.get("token_reuse", False):
            return True
        
        # Check for unusual session access patterns
        if await self._is_unusual_session_access(activity):
            return True
        
        # Check for session fixation attempts
        if activity.metadata.get("session_fixation", False):
            return True
        
        return False

    async def _detect_insider_threat(self, activity: UserActivity) -> bool:
        """Detect potential insider threats"""
        # Check for unusual data access patterns
        if activity.action in ["data_access", "data_export"]:
            if await self._is_unusual_data_access(activity):
                return True
        
        # Check for unauthorized privilege use
        if activity.action in ["privilege_use", "role_change"]:
            if await self._is_unauthorized_privilege_use(activity):
                return True
        
        # Check for unusual working hours
        if await self._is_unusual_working_hours(activity):
            return True
        
        return False

    async def _detect_ransomware_activity(self, activity: UserActivity) -> bool:
        """Detect potential ransomware activity"""
        if activity.action != "file_access":
            return False
        
        # Check for mass file encryption patterns
        if activity.metadata.get("mass_encryption", False):
            return True
        
        # Check for suspicious file extensions
        if activity.metadata.get("suspicious_extensions", False):
            return True
        
        # Check for rapid file modifications
        if await self._is_rapid_file_modification(activity):
            return True
        
        return False

    async def _detect_crypto_mining(self, activity: UserActivity) -> bool:
        """Detect cryptocurrency mining activity"""
        if activity.action != "process_execution":
            return False
        
        # Check for known mining process patterns
        if activity.metadata.get("mining_process", False):
            return True
        
        # Check for unusual CPU/GPU usage
        if activity.metadata.get("high_resource_usage", False):
            return True
        
        # Check for mining pool connections
        if activity.metadata.get("mining_pool_connection", False):
            return True
        
        return False

    async def _quarantine_device(self, device_id: str):
        """Quarantine a potentially compromised device"""
        # Update device status
        device_key = f"device:{device_id}"
        self.redis_client.setex(
            device_key,
            24 * 3600,  # 24 hours
            "quarantined"
        )
        
        # Log quarantine action
        await self.log_audit(
            "system",
            "device_quarantine",
            "device",
            "success",
            "system",
            device_id,
            {"reason": "potential_compromise"}
        )

    async def _block_ip_address(self, ip_address: str):
        """Block a suspicious IP address"""
        # Add to blocked IPs
        self.redis_client.sadd("blocked_ips", ip_address)
        self.redis_client.setex(
            f"blocked_ip:{ip_address}",
            24 * 3600,  # 24 hours
            "blocked"
        )
        
        # Log blocking action
        await self.log_audit(
            "system",
            "ip_block",
            "ip_address",
            "success",
            "system",
            None,
            {"ip_address": ip_address}
        )

    async def _enable_enhanced_monitoring(self, user_id: str):
        """Enable enhanced monitoring for a user"""
        # Set enhanced monitoring flag
        self.redis_client.setex(
            f"enhanced_monitoring:{user_id}",
            7 * 24 * 3600,  # 7 days
            "enabled"
        )
        
        # Log monitoring action
        await self.log_audit(
            "system",
            "enable_monitoring",
            "user",
            "success",
            "system",
            None,
            {"user_id": user_id}
        )

    async def _initiate_incident_response(self, activity: UserActivity):
        """Initiate incident response procedures"""
        # Create incident record
        incident = {
            "id": str(uuid.uuid4()),
            "type": "security_incident",
            "severity": "high",
            "status": "active",
            "created_at": datetime.utcnow(),
            "activity": activity.dict()
        }
        
        # Store incident
        self.redis_client.setex(
            f"incident:{incident['id']}",
            30 * 24 * 3600,  # 30 days
            json.dumps(incident)
        )
        
        # Notify incident response team
        await self.notification_manager.send_notification(
            "incident_response_team",
            "Security Incident",
            f"New security incident detected: {incident['id']}",
            incident
        )

    async def _backup_critical_data(self):
        """Backup critical data in response to potential threat"""
        # Implement backup logic here
        pass

    async def _apply_security_patch(self, activity: UserActivity):
        """Apply security patch based on detected vulnerability"""
        # Implement patch application logic
        pass

    async def _initiate_threat_hunting(self, activity: UserActivity):
        """Initiate threat hunting based on detected threat"""
        # Implement threat hunting logic
        pass

    async def _update_ips_rules(self, activity: UserActivity):
        """Update Intrusion Prevention System rules"""
        # Implement IPS rule updates
        pass

    async def _enable_behavioral_analytics(self, activity: UserActivity):
        """Enable behavioral analytics for detected threat"""
        # Implement behavioral analytics
        pass

    async def _deploy_decoy_data(self, activity: UserActivity):
        """Deploy decoy data to track attacker movement"""
        # Implement decoy data deployment
        pass

    async def _get_3d_network_graph_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get 3D network graph data for dashboard"""
        # Implement 3D network graph data collection
        return {
            "nodes": [],
            "edges": [],
            "metadata": {}
        }

    async def _get_real_time_threat_feed_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get real-time threat feed data for dashboard"""
        # Implement real-time threat feed data collection
        return {
            "threats": [],
            "metadata": {}
        }

    async def _get_behavioral_analytics_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get behavioral analytics data for dashboard"""
        # Implement behavioral analytics data collection
        return {
            "behaviors": [],
            "metadata": {}
        }

    async def _get_anomaly_detection_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get anomaly detection data for dashboard"""
        # Implement anomaly detection data collection
        return {
            "anomalies": [],
            "metadata": {}
        }

    async def _get_threat_intelligence_map_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get threat intelligence map data"""
        return {
            "threats": [],
            "indicators": [],
            "sources": [],
            "metadata": {}
        }

    async def _get_vulnerability_heat_map_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get vulnerability heat map data"""
        return {
            "vulnerabilities": [],
            "risk_levels": [],
            "affected_systems": [],
            "metadata": {}
        }

    async def _get_attack_surface_analysis_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get attack surface analysis data"""
        return {
            "attack_vectors": [],
            "exposed_services": [],
            "risk_assessment": {},
            "metadata": {}
        }

    async def _get_security_posture_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get security posture data"""
        return {
            "controls": [],
            "compliance": {},
            "risk_score": 0.0,
            "metadata": {}
        }

    async def _get_threat_hunting_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get threat hunting data"""
        return {
            "hunts": [],
            "findings": [],
            "indicators": [],
            "metadata": {}
        }

    async def _execute_incident_playbook(self, activity: UserActivity):
        """Execute incident response playbook"""
        # Implement playbook execution logic
        pass

    async def _update_threat_intelligence(self, activity: UserActivity):
        """Update threat intelligence feeds"""
        # Implement threat intelligence update logic
        pass

    async def _enable_advanced_monitoring(self, activity: UserActivity):
        """Enable advanced security monitoring"""
        # Implement advanced monitoring logic
        pass

    async def _initiate_forensic_analysis(self, activity: UserActivity):
        """Initiate forensic analysis of security incident"""
        # Implement forensic analysis logic
        pass

    async def _detect_side_channel_attack(self, activity: UserActivity) -> bool:
        """Detect side-channel attacks"""
        if activity.action != "api_request":
            return False
        
        # Check for timing patterns
        if await self._analyze_timing_patterns(activity):
            return True
        
        # Check for power consumption patterns
        if await self._analyze_power_patterns(activity):
            return True
        
        # Check for electromagnetic patterns
        if await self._analyze_em_patterns(activity):
            return True
        
        return False

    async def _detect_timing_attack(self, activity: UserActivity) -> bool:
        """Detect timing attacks"""
        if activity.action != "api_request":
            return False
        
        # Analyze response time patterns
        response_times = activity.metadata.get("response_times", [])
        if len(response_times) > 0:
            # Check for timing variations
            if self._detect_timing_variations(response_times):
                return True
        
        # Check for timing-based authentication bypass
        if activity.metadata.get("timing_based_auth", False):
            return True
        
        return False

    async def _detect_power_analysis(self, activity: UserActivity) -> bool:
        """Detect power analysis attacks"""
        if activity.action != "api_request":
            return False
        
        # Check power consumption patterns
        power_patterns = activity.metadata.get("power_patterns", {})
        if power_patterns:
            # Analyze power consumption variations
            if self._analyze_power_variations(power_patterns):
                return True
        
        return False

    async def _detect_cache_attack(self, activity: UserActivity) -> bool:
        """Detect cache-based attacks"""
        if activity.action != "api_request":
            return False
        
        # Check cache access patterns
        cache_patterns = activity.metadata.get("cache_patterns", {})
        if cache_patterns:
            # Analyze cache timing variations
            if self._analyze_cache_timing(cache_patterns):
                return True
        
        return False

    async def _detect_spectre_meltdown(self, activity: UserActivity) -> bool:
        """Detect Spectre/Meltdown attacks"""
        if activity.action != "api_request":
            return False
        
        # Check for speculative execution patterns
        if activity.metadata.get("speculative_execution", False):
            return True
        
        # Check for cache timing patterns
        if await self._analyze_cache_timing_patterns(activity):
            return True
        
        return False

    async def _detect_threats_ml(self, activity: UserActivity) -> List[ThreatPattern]:
        """Detect threats using machine learning models"""
        threats = []
        
        # Anomaly detection
        anomaly_score = await self._detect_anomalies_ml(activity)
        if anomaly_score > settings.security.ML_ANOMALY_THRESHOLD:
            threats.append(await self._get_threat_pattern("ml_anomaly"))
        
        # Behavior analysis
        behavior_score = await self._analyze_behavior_ml(activity)
        if behavior_score > settings.security.ML_BEHAVIOR_THRESHOLD:
            threats.append(await self._get_threat_pattern("suspicious_behavior"))
        
        # Network analysis
        network_score = await self._analyze_network_ml(activity)
        if network_score > settings.security.ML_NETWORK_THRESHOLD:
            threats.append(await self._get_threat_pattern("network_anomaly"))
        
        return threats

    async def _get_network_traffic_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get network traffic analysis data"""
        return {
            "traffic_patterns": [],
            "protocol_analysis": {},
            "bandwidth_usage": {},
            "suspicious_flows": [],
            "metadata": {}
        }

    async def _get_malware_analysis_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get malware analysis data"""
        return {
            "samples": [],
            "behavior_analysis": {},
            "signatures": [],
            "threat_level": "",
            "metadata": {}
        }

    async def _get_threat_intelligence_feed_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get real-time threat intelligence feed data"""
        return {
            "threats": [],
            "indicators": [],
            "sources": [],
            "last_updated": datetime.utcnow().isoformat(),
            "metadata": {}
        }

    async def _get_ml_insights_data(
        self,
        db: AsyncSession,
        filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get machine learning insights data"""
        return {
            "predictions": [],
            "anomalies": [],
            "confidence_scores": {},
            "model_metrics": {},
            "metadata": {}
        }

    async def _enable_ml_monitoring(self, activity: UserActivity):
        """Enable machine learning-based monitoring"""
        # Implement ML monitoring logic
        pass

    async def _deploy_network_controls(self, activity: UserActivity):
        """Deploy network security controls"""
        # Implement network controls deployment
        pass

    def _load_ml_model(self, model_type: str):
        """Load machine learning model"""
        # Implement model loading logic
        pass

    def _init_threat_feed(self, feed_type: str):
        """Initialize threat intelligence feed"""
        # Implement feed initialization logic
        pass

    async def _detect_zero_day_exploit(self, activity: UserActivity) -> bool:
        """Detect zero-day exploits"""
        if activity.action != "api_request":
            return False
        
        # Check for unknown vulnerability patterns
        if await self._analyze_unknown_vulnerability_patterns(activity):
            return True
        
        # Check for unusual system behavior
        if await self._analyze_system_behavior(activity):
            return True
        
        # Check for exploit-like patterns
        if await self._analyze_exploit_patterns(activity):
            return True
        
        return False

    async def _detect_supply_chain_attack(self, activity: UserActivity) -> bool:
        """Detect supply chain attacks"""
        if activity.action not in ["package_install", "dependency_update", "build_process"]:
            return False
        
        # Check for compromised dependencies
        if await self._analyze_dependencies(activity):
            return True
        
        # Check for malicious package patterns
        if await self._analyze_package_patterns(activity):
            return True
        
        # Check for build process anomalies
        if await self._analyze_build_process(activity):
            return True
        
        return False

    async def _detect_advanced_persistent_threat(self, activity: UserActivity) -> bool:
        """Detect advanced persistent threats"""
        # Check for long-term persistence
        if await self._analyze_persistence_patterns(activity):
            return True
        
        # Check for lateral movement
        if await self._analyze_lateral_movement(activity):
            return True
        
        # Check for data exfiltration patterns
        if await self._analyze_data_exfiltration(activity):
            return True
        
        return False

    async def _detect_watering_hole_attack(self, activity: UserActivity) -> bool:
        """Detect watering hole attacks"""
        if activity.action != "web_access":
            return False
        
        # Check for compromised websites
        if await self._analyze_website_compromise(activity):
            return True
        
        # Check for malicious content
        if await self._analyze_malicious_content(activity):
            return True
        
        return False

    async def _detect_island_hopping_attack(self, activity: UserActivity) -> bool:
        """Detect island hopping attacks"""
        # Check for partner network access
        if await self._analyze_partner_network_access(activity):
            return True
        
        # Check for supply chain access
        if await self._analyze_supply_chain_access(activity):
            return True
        
        return False

    async def _analyze_unknown_vulnerability_patterns(self, activity: UserActivity) -> bool:
        """Analyze unknown vulnerability patterns"""
        # Implement vulnerability analysis logic
        return False

    async def _analyze_system_behavior(self, activity: UserActivity) -> bool:
        """Analyze unusual system behavior"""
        # Implement system behavior analysis logic
        return False

    async def _analyze_exploit_patterns(self, activity: UserActivity) -> bool:
        """Analyze exploit-like patterns"""
        # Implement exploit pattern analysis logic
        return False

    async def _analyze_dependencies(self, activity: UserActivity) -> bool:
        """Analyze compromised dependencies"""
        # Implement dependency analysis logic
        return False

    async def _analyze_package_patterns(self, activity: UserActivity) -> bool:
        """Analyze malicious package patterns"""
        # Implement package pattern analysis logic
        return False

    async def _analyze_build_process(self, activity: UserActivity) -> bool:
        """Analyze build process anomalies"""
        # Implement build process analysis logic
        return False

    async def _analyze_website_compromise(self, activity: UserActivity) -> bool:
        """Analyze compromised websites"""
        # Implement website compromise analysis logic
        return False

    async def _analyze_malicious_content(self, activity: UserActivity) -> bool:
        """Analyze malicious content"""
        # Implement malicious content analysis logic
        return False

    async def _analyze_partner_network_access(self, activity: UserActivity) -> bool:
        """Analyze partner network access"""
        # Implement partner network access analysis logic
        return False

    async def _analyze_supply_chain_access(self, activity: UserActivity) -> bool:
        """Analyze supply chain access"""
        # Implement supply chain access analysis logic
        return False

    async def _analyze_persistence_patterns(self, activity: UserActivity) -> bool:
        """Analyze long-term persistence"""
        # Implement persistence pattern analysis logic
        return False

    async def _analyze_lateral_movement(self, activity: UserActivity) -> bool:
        """Analyze lateral movement"""
        # Implement lateral movement analysis logic
        return False

    async def _analyze_data_exfiltration(self, activity: UserActivity) -> bool:
        """Analyze data exfiltration patterns"""
        # Implement data exfiltration analysis logic
        return False

    async def _analyze_timing_patterns(self, activity: UserActivity) -> bool:
        """Analyze timing patterns"""
        # Implement timing pattern analysis logic
        return False

    async def _analyze_power_patterns(self, activity: UserActivity) -> bool:
        """Analyze power consumption patterns"""
        # Implement power pattern analysis logic
        return False

    async def _analyze_em_patterns(self, activity: UserActivity) -> bool:
        """Analyze electromagnetic patterns"""
        # Implement electromagnetic pattern analysis logic
        return False

    async def _analyze_cache_timing(self, cache_patterns: Dict[str, Any]) -> bool:
        """Analyze cache timing variations"""
        # Implement cache timing analysis logic
        return False

    async def _analyze_cache_timing_patterns(self, activity: UserActivity) -> bool:
        """Analyze cache timing patterns"""
        # Implement cache timing pattern analysis logic
        return False

    async def _analyze_power_variations(self, power_patterns: Dict[str, Any]) -> bool:
        """Analyze power consumption variations"""
        # Implement power variation analysis logic
        return False

    async def _analyze_timing_variations(self, response_times: List[float]) -> bool:
        """Analyze response time variations"""
        # Implement timing variation analysis logic
        return False

# Initialize security manager
security_manager = SecurityManager()

# Dependency for getting current user
async def get_current_user(
    user: User = Depends(security_manager.verify_token)
) -> User:
    return user

# Dependency for checking permissions
async def check_permissions(
    required_permission: str,
    current_user: User = Depends(get_current_user)
) -> bool:
    if not await security_manager.check_permission(
        current_user,
        required_permission
    ):
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions"
        )
    return True 