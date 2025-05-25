from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import boto3
import azure.storage.blob
import google.cloud.storage
import hashlib
import json
import os
import tarfile
import tempfile

from .models import Base
from .config import settings
from .security import SecurityManager

class Backup(Base):
    """Backup model."""
    __tablename__ = "backups"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # full, incremental, differential
    status = Column(String, nullable=False)  # pending, in_progress, completed, failed
    storage_type = Column(String, nullable=False)  # s3, azure, gcs
    storage_path = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=True)
    checksum = Column(String, nullable=True)
    metadata = Column(JSON, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error = Column(String, nullable=True)

class BackupManager:
    """Manages backup and recovery operations."""
    
    def __init__(
        self,
        db_session,
        security_manager: SecurityManager,
        audit_logger
    ):
        self.db = db_session
        self.security_manager = security_manager
        self.audit_logger = audit_logger
        self._initialize_storage()
    
    def _initialize_storage(self):
        """Initialize storage clients."""
        if settings.BACKUP_STORAGE_TYPE == "s3":
            self.storage = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
        elif settings.BACKUP_STORAGE_TYPE == "azure":
            self.storage = azure.storage.blob.BlobServiceClient(
                account_url=settings.AZURE_STORAGE_URL,
                credential=settings.AZURE_STORAGE_KEY
            )
        elif settings.BACKUP_STORAGE_TYPE == "gcs":
            self.storage = google.cloud.storage.Client(
                project=settings.GCP_PROJECT_ID,
                credentials=settings.GCP_CREDENTIALS
            )
        else:
            raise ValueError(f"Unsupported storage type: {settings.BACKUP_STORAGE_TYPE}")
    
    async def create_backup(
        self,
        tenant_id: str,
        backup_type: str = "full",
        metadata: Optional[Dict] = None
    ) -> Backup:
        """Create a new backup."""
        backup = Backup(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            type=backup_type,
            status="pending",
            storage_type=settings.BACKUP_STORAGE_TYPE,
            storage_path=f"backups/{tenant_id}/{backup_type}/{datetime.utcnow().isoformat()}",
            metadata=metadata
        )
        
        self.db.add(backup)
        await self.db.commit()
        
        # Log backup creation
        await self.audit_logger.log(
            tenant_id=tenant_id,
            action="create_backup",
            resource_type="backup",
            resource_id=backup.id,
            details={
                "type": backup_type,
                "storage_type": settings.BACKUP_STORAGE_TYPE
            }
        )
        
        # Start backup process
        await self._process_backup(backup)
        
        return backup
    
    async def _process_backup(self, backup: Backup):
        """Process backup operation."""
        try:
            backup.status = "in_progress"
            backup.started_at = datetime.utcnow()
            await self.db.commit()
            
            # Get encryption key
            key = await self.security_manager.get_active_key(
                backup.tenant_id,
                "backup"
            )
            
            # Create backup archive
            with tempfile.NamedTemporaryFile() as temp_file:
                # Create tar archive
                with tarfile.open(temp_file.name, "w:gz") as tar:
                    # Add database dump
                    await self._backup_database(backup.tenant_id, tar)
                    
                    # Add file storage
                    await self._backup_files(backup.tenant_id, tar)
                    
                    # Add configuration
                    await self._backup_config(backup.tenant_id, tar)
                
                # Encrypt backup
                with open(temp_file.name, "rb") as f:
                    data = f.read()
                    encrypted_data = self.security_manager.encrypt_data(data, key)
                
                # Calculate checksum
                backup.checksum = hashlib.sha256(encrypted_data).hexdigest()
                backup.size_bytes = len(encrypted_data)
                
                # Upload to storage
                await self._upload_backup(backup, encrypted_data)
            
            backup.status = "completed"
            backup.completed_at = datetime.utcnow()
            
        except Exception as e:
            backup.status = "failed"
            backup.error = str(e)
        
        await self.db.commit()
    
    async def _backup_database(self, tenant_id: str, tar: tarfile.TarFile):
        """Backup database data."""
        # Implement database backup logic
        # This could use pg_dump for PostgreSQL
        pass
    
    async def _backup_files(self, tenant_id: str, tar: tarfile.TarFile):
        """Backup file storage."""
        # Implement file backup logic
        pass
    
    async def _backup_config(self, tenant_id: str, tar: tarfile.TarFile):
        """Backup configuration."""
        # Implement configuration backup logic
        pass
    
    async def _upload_backup(self, backup: Backup, data: bytes):
        """Upload backup to storage."""
        if settings.BACKUP_STORAGE_TYPE == "s3":
            self.storage.put_object(
                Bucket=settings.AWS_BACKUP_BUCKET,
                Key=backup.storage_path,
                Body=data
            )
        elif settings.BACKUP_STORAGE_TYPE == "azure":
            container = self.storage.get_container_client(
                settings.AZURE_BACKUP_CONTAINER
            )
            container.upload_blob(
                backup.storage_path,
                data
            )
        elif settings.BACKUP_STORAGE_TYPE == "gcs":
            bucket = self.storage.bucket(settings.GCP_BACKUP_BUCKET)
            blob = bucket.blob(backup.storage_path)
            blob.upload_from_string(data)
    
    async def restore_backup(
        self,
        backup_id: str,
        tenant_id: str,
        target_path: Optional[str] = None
    ) -> bool:
        """Restore from backup."""
        backup = await self.db.query(Backup).filter(
            Backup.id == backup_id,
            Backup.tenant_id == tenant_id
        ).first()
        
        if not backup:
            raise ValueError("Backup not found")
        
        if backup.status != "completed":
            raise ValueError("Backup is not in completed state")
        
        try:
            # Download backup
            data = await self._download_backup(backup)
            
            # Verify checksum
            if hashlib.sha256(data).hexdigest() != backup.checksum:
                raise ValueError("Backup checksum verification failed")
            
            # Get encryption key
            key = await self.security_manager.get_active_key(
                backup.tenant_id,
                "backup"
            )
            
            # Decrypt backup
            decrypted_data = self.security_manager.decrypt_data(data, key)
            
            # Restore from backup
            with tempfile.NamedTemporaryFile() as temp_file:
                temp_file.write(decrypted_data)
                temp_file.flush()
                
                with tarfile.open(temp_file.name, "r:gz") as tar:
                    # Restore database
                    await self._restore_database(backup.tenant_id, tar)
                    
                    # Restore files
                    await self._restore_files(backup.tenant_id, tar, target_path)
                    
                    # Restore configuration
                    await self._restore_config(backup.tenant_id, tar)
            
            # Log restore operation
            await self.audit_logger.log(
                tenant_id=tenant_id,
                action="restore_backup",
                resource_type="backup",
                resource_id=backup_id,
                details={
                    "type": backup.type,
                    "target_path": target_path
                }
            )
            
            return True
            
        except Exception as e:
            # Log restore failure
            await self.audit_logger.log(
                tenant_id=tenant_id,
                action="restore_backup_failed",
                resource_type="backup",
                resource_id=backup_id,
                details={
                    "error": str(e)
                }
            )
            raise
    
    async def _download_backup(self, backup: Backup) -> bytes:
        """Download backup from storage."""
        if settings.BACKUP_STORAGE_TYPE == "s3":
            response = self.storage.get_object(
                Bucket=settings.AWS_BACKUP_BUCKET,
                Key=backup.storage_path
            )
            return response["Body"].read()
        elif settings.BACKUP_STORAGE_TYPE == "azure":
            container = self.storage.get_container_client(
                settings.AZURE_BACKUP_CONTAINER
            )
            blob = container.get_blob_client(backup.storage_path)
            return blob.download_blob().readall()
        elif settings.BACKUP_STORAGE_TYPE == "gcs":
            bucket = self.storage.bucket(settings.GCP_BACKUP_BUCKET)
            blob = bucket.blob(backup.storage_path)
            return blob.download_as_bytes()
    
    async def _restore_database(self, tenant_id: str, tar: tarfile.TarFile):
        """Restore database from backup."""
        # Implement database restore logic
        pass
    
    async def _restore_files(
        self,
        tenant_id: str,
        tar: tarfile.TarFile,
        target_path: Optional[str]
    ):
        """Restore files from backup."""
        # Implement file restore logic
        pass
    
    async def _restore_config(self, tenant_id: str, tar: tarfile.TarFile):
        """Restore configuration from backup."""
        # Implement configuration restore logic
        pass
    
    async def list_backups(
        self,
        tenant_id: str,
        backup_type: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Backup]:
        """List backups with filtering."""
        query = self.db.query(Backup).filter(Backup.tenant_id == tenant_id)
        
        if backup_type:
            query = query.filter(Backup.type == backup_type)
        if status:
            query = query.filter(Backup.status == status)
        if start_date:
            query = query.filter(Backup.created_at >= start_date)
        if end_date:
            query = query.filter(Backup.created_at <= end_date)
        
        return await query.order_by(Backup.created_at.desc()).all()
    
    async def delete_backup(
        self,
        backup_id: str,
        tenant_id: str
    ) -> bool:
        """Delete backup."""
        backup = await self.db.query(Backup).filter(
            Backup.id == backup_id,
            Backup.tenant_id == tenant_id
        ).first()
        
        if not backup:
            return False
        
        try:
            # Delete from storage
            if settings.BACKUP_STORAGE_TYPE == "s3":
                self.storage.delete_object(
                    Bucket=settings.AWS_BACKUP_BUCKET,
                    Key=backup.storage_path
                )
            elif settings.BACKUP_STORAGE_TYPE == "azure":
                container = self.storage.get_container_client(
                    settings.AZURE_BACKUP_CONTAINER
                )
                container.delete_blob(backup.storage_path)
            elif settings.BACKUP_STORAGE_TYPE == "gcs":
                bucket = self.storage.bucket(settings.GCP_BACKUP_BUCKET)
                bucket.blob(backup.storage_path).delete()
            
            # Delete from database
            await self.db.delete(backup)
            await self.db.commit()
            
            # Log deletion
            await self.audit_logger.log(
                tenant_id=tenant_id,
                action="delete_backup",
                resource_type="backup",
                resource_id=backup_id,
                details={
                    "type": backup.type,
                    "storage_path": backup.storage_path
                }
            )
            
            return True
            
        except Exception as e:
            # Log deletion failure
            await self.audit_logger.log(
                tenant_id=tenant_id,
                action="delete_backup_failed",
                resource_type="backup",
                resource_id=backup_id,
                details={
                    "error": str(e)
                }
            )
            raise
    
    async def schedule_backup(
        self,
        tenant_id: str,
        schedule: Dict[str, Any]
    ):
        """Schedule automatic backups."""
        # Implement backup scheduling
        # This could use a task queue like Celery
        pass
    
    async def get_backup_status(
        self,
        backup_id: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Get backup status and details."""
        backup = await self.db.query(Backup).filter(
            Backup.id == backup_id,
            Backup.tenant_id == tenant_id
        ).first()
        
        if not backup:
            raise ValueError("Backup not found")
        
        return {
            "id": backup.id,
            "type": backup.type,
            "status": backup.status,
            "size_bytes": backup.size_bytes,
            "checksum": backup.checksum,
            "started_at": backup.started_at,
            "completed_at": backup.completed_at,
            "error": backup.error,
            "metadata": backup.metadata
        } 