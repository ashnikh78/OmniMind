from typing import Dict, Optional, Any, List
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import json
import os

from .models import Base
from .config import settings

class Theme(Base):
    """Theme model for storing UI theme configurations."""
    __tablename__ = "themes"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    colors = Column(JSON, nullable=False)
    typography = Column(JSON, nullable=False)
    spacing = Column(JSON, nullable=False)
    components = Column(JSON, nullable=False)
    animations = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

class Layout(Base):
    """Layout model for storing UI layout configurations."""
    __tablename__ = "layouts"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    template = Column(JSON, nullable=False)
    sections = Column(JSON, nullable=False)
    widgets = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

class UserInterface(Base):
    """User interface preferences model."""
    __tablename__ = "user_interfaces"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    tenant_id = Column(String, nullable=False)
    theme_id = Column(String, nullable=True)
    layout_id = Column(String, nullable=True)
    preferences = Column(JSON, nullable=False)
    accessibility = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UIManager:
    """Manages UI/UX configurations and preferences."""
    
    def __init__(self, db_session, audit_logger):
        self.db = db_session
        self.audit_logger = audit_logger
        self._load_themes()
        self._load_layouts()
    
    def _load_themes(self):
        """Load themes from database into memory."""
        self.themes = {}
        themes = self.db.query(Theme).filter(
            Theme.is_active == True
        ).all()
        
        for theme in themes:
            if theme.tenant_id not in self.themes:
                self.themes[theme.tenant_id] = {}
            self.themes[theme.tenant_id][theme.id] = theme
    
    def _load_layouts(self):
        """Load layouts from database into memory."""
        self.layouts = {}
        layouts = self.db.query(Layout).filter(
            Layout.is_active == True
        ).all()
        
        for layout in layouts:
            if layout.tenant_id not in self.layouts:
                self.layouts[layout.tenant_id] = {}
            self.layouts[layout.tenant_id][layout.id] = layout
    
    async def get_default_theme(self) -> Dict[str, Any]:
        """Get default theme configuration."""
        return {
            "colors": {
                "primary": {
                    "main": "#2196F3",
                    "light": "#64B5F6",
                    "dark": "#1976D2",
                    "contrast": "#FFFFFF"
                },
                "secondary": {
                    "main": "#FF4081",
                    "light": "#FF80AB",
                    "dark": "#F50057",
                    "contrast": "#FFFFFF"
                },
                "background": {
                    "default": "#FFFFFF",
                    "paper": "#F5F5F5",
                    "contrast": "#000000"
                },
                "text": {
                    "primary": "#212121",
                    "secondary": "#757575",
                    "disabled": "#9E9E9E"
                },
                "error": {
                    "main": "#F44336",
                    "light": "#E57373",
                    "dark": "#D32F2F",
                    "contrast": "#FFFFFF"
                },
                "warning": {
                    "main": "#FF9800",
                    "light": "#FFB74D",
                    "dark": "#F57C00",
                    "contrast": "#000000"
                },
                "info": {
                    "main": "#2196F3",
                    "light": "#64B5F6",
                    "dark": "#1976D2",
                    "contrast": "#FFFFFF"
                },
                "success": {
                    "main": "#4CAF50",
                    "light": "#81C784",
                    "dark": "#388E3C",
                    "contrast": "#FFFFFF"
                }
            },
            "typography": {
                "fontFamily": "'Roboto', 'Helvetica', 'Arial', sans-serif",
                "fontSize": 14,
                "fontWeightLight": 300,
                "fontWeightRegular": 400,
                "fontWeightMedium": 500,
                "fontWeightBold": 700,
                "h1": {
                    "fontSize": "6rem",
                    "fontWeight": 300,
                    "lineHeight": 1.167,
                    "letterSpacing": "-0.01562em"
                },
                "h2": {
                    "fontSize": "3.75rem",
                    "fontWeight": 300,
                    "lineHeight": 1.2,
                    "letterSpacing": "-0.00833em"
                },
                "h3": {
                    "fontSize": "3rem",
                    "fontWeight": 400,
                    "lineHeight": 1.167,
                    "letterSpacing": "0em"
                },
                "h4": {
                    "fontSize": "2.125rem",
                    "fontWeight": 400,
                    "lineHeight": 1.235,
                    "letterSpacing": "0.00735em"
                },
                "h5": {
                    "fontSize": "1.5rem",
                    "fontWeight": 400,
                    "lineHeight": 1.334,
                    "letterSpacing": "0em"
                },
                "h6": {
                    "fontSize": "1.25rem",
                    "fontWeight": 500,
                    "lineHeight": 1.6,
                    "letterSpacing": "0.0075em"
                },
                "subtitle1": {
                    "fontSize": "1rem",
                    "fontWeight": 400,
                    "lineHeight": 1.75,
                    "letterSpacing": "0.00938em"
                },
                "subtitle2": {
                    "fontSize": "0.875rem",
                    "fontWeight": 500,
                    "lineHeight": 1.57,
                    "letterSpacing": "0.00714em"
                },
                "body1": {
                    "fontSize": "1rem",
                    "fontWeight": 400,
                    "lineHeight": 1.5,
                    "letterSpacing": "0.00938em"
                },
                "body2": {
                    "fontSize": "0.875rem",
                    "fontWeight": 400,
                    "lineHeight": 1.43,
                    "letterSpacing": "0.01071em"
                },
                "button": {
                    "fontSize": "0.875rem",
                    "fontWeight": 500,
                    "lineHeight": 1.75,
                    "letterSpacing": "0.02857em",
                    "textTransform": "uppercase"
                }
            },
            "spacing": {
                "unit": 8,
                "xs": 4,
                "sm": 8,
                "md": 16,
                "lg": 24,
                "xl": 32
            },
            "components": {
                "button": {
                    "borderRadius": 4,
                    "padding": "6px 16px",
                    "transition": "background-color 0.2s, box-shadow 0.2s"
                },
                "card": {
                    "borderRadius": 8,
                    "padding": 16,
                    "boxShadow": "0 2px 4px rgba(0,0,0,0.1)"
                },
                "input": {
                    "borderRadius": 4,
                    "padding": "8px 12px",
                    "transition": "border-color 0.2s"
                }
            },
            "animations": {
                "duration": {
                    "shortest": 150,
                    "shorter": 200,
                    "short": 250,
                    "standard": 300,
                    "complex": 375,
                    "enteringScreen": 225,
                    "leavingScreen": 195
                },
                "easing": {
                    "easeInOut": "cubic-bezier(0.4, 0, 0.2, 1)",
                    "easeOut": "cubic-bezier(0.0, 0, 0.2, 1)",
                    "easeIn": "cubic-bezier(0.4, 0, 1, 1)",
                    "sharp": "cubic-bezier(0.4, 0, 0.6, 1)"
                }
            }
        }
    
    async def get_default_layout(self) -> Dict[str, Any]:
        """Get default layout configuration."""
        return {
            "template": {
                "type": "grid",
                "columns": 12,
                "spacing": 2,
                "container": {
                    "maxWidth": "lg",
                    "padding": 2
                }
            },
            "sections": {
                "header": {
                    "type": "appBar",
                    "position": "fixed",
                    "elevation": 4,
                    "components": [
                        {
                            "type": "logo",
                            "position": "left",
                            "width": 200
                        },
                        {
                            "type": "navigation",
                            "position": "left",
                            "items": []
                        },
                        {
                            "type": "userMenu",
                            "position": "right"
                        }
                    ]
                },
                "sidebar": {
                    "type": "drawer",
                    "variant": "permanent",
                    "width": 240,
                    "components": [
                        {
                            "type": "navigation",
                            "variant": "vertical",
                            "items": []
                        }
                    ]
                },
                "main": {
                    "type": "container",
                    "padding": 3,
                    "components": []
                },
                "footer": {
                    "type": "container",
                    "padding": 2,
                    "components": []
                }
            },
            "widgets": {
                "dashboard": {
                    "type": "grid",
                    "columns": 3,
                    "spacing": 2,
                    "components": [
                        {
                            "type": "card",
                            "title": "Overview",
                            "span": 3
                        },
                        {
                            "type": "chart",
                            "title": "Analytics",
                            "span": 2
                        },
                        {
                            "type": "list",
                            "title": "Recent Activity",
                            "span": 1
                        }
                    ]
                },
                "profile": {
                    "type": "grid",
                    "columns": 2,
                    "spacing": 2,
                    "components": [
                        {
                            "type": "card",
                            "title": "User Information",
                            "span": 1
                        },
                        {
                            "type": "card",
                            "title": "Preferences",
                            "span": 1
                        }
                    ]
                }
            }
        }
    
    async def get_default_accessibility(self) -> Dict[str, Any]:
        """Get default accessibility settings."""
        return {
            "highContrast": False,
            "reducedMotion": False,
            "fontSize": "medium",
            "lineHeight": "normal",
            "letterSpacing": "normal",
            "colorBlindMode": "none",
            "screenReader": False,
            "keyboardNavigation": True,
            "focusVisible": True,
            "skipLinks": True,
            "ariaLabels": True,
            "altText": True
        }
    
    async def create_theme(
        self,
        tenant_id: str,
        name: str,
        colors: Dict[str, Any],
        typography: Dict[str, Any],
        spacing: Dict[str, Any],
        components: Dict[str, Any],
        animations: Dict[str, Any],
        is_system: bool = False,
        metadata: Optional[Dict] = None
    ) -> Theme:
        """Create a new theme."""
        theme = Theme(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name=name,
            is_system=is_system,
            colors=colors,
            typography=typography,
            spacing=spacing,
            components=components,
            animations=animations,
            metadata=metadata
        )
        
        self.db.add(theme)
        await self.db.commit()
        self._load_themes()
        
        return theme
    
    async def create_layout(
        self,
        tenant_id: str,
        name: str,
        template: Dict[str, Any],
        sections: Dict[str, Any],
        widgets: Dict[str, Any],
        is_system: bool = False,
        metadata: Optional[Dict] = None
    ) -> Layout:
        """Create a new layout."""
        layout = Layout(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name=name,
            is_system=is_system,
            template=template,
            sections=sections,
            widgets=widgets,
            metadata=metadata
        )
        
        self.db.add(layout)
        await self.db.commit()
        self._load_layouts()
        
        return layout
    
    async def get_user_interface(
        self,
        user_id: str,
        tenant_id: str
    ) -> Optional[UserInterface]:
        """Get user interface preferences."""
        return await self.db.query(UserInterface).filter(
            UserInterface.user_id == user_id,
            UserInterface.tenant_id == tenant_id
        ).first()
    
    async def update_user_interface(
        self,
        user_id: str,
        tenant_id: str,
        theme_id: Optional[str] = None,
        layout_id: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
        accessibility: Optional[Dict[str, Any]] = None
    ) -> UserInterface:
        """Update user interface preferences."""
        ui = await self.get_user_interface(user_id, tenant_id)
        
        if not ui:
            ui = UserInterface(
                id=str(uuid.uuid4()),
                user_id=user_id,
                tenant_id=tenant_id,
                theme_id=theme_id,
                layout_id=layout_id,
                preferences=preferences or {},
                accessibility=accessibility or await self.get_default_accessibility()
            )
            self.db.add(ui)
        else:
            if theme_id:
                ui.theme_id = theme_id
            if layout_id:
                ui.layout_id = layout_id
            if preferences:
                ui.preferences.update(preferences)
            if accessibility:
                ui.accessibility.update(accessibility)
        
        await self.db.commit()
        return ui
    
    async def get_theme(
        self,
        tenant_id: str,
        theme_id: str
    ) -> Optional[Theme]:
        """Get theme by ID."""
        return self.themes.get(tenant_id, {}).get(theme_id)
    
    async def get_layout(
        self,
        tenant_id: str,
        layout_id: str
    ) -> Optional[Layout]:
        """Get layout by ID."""
        return self.layouts.get(tenant_id, {}).get(layout_id)
    
    async def get_available_themes(
        self,
        tenant_id: str
    ) -> List[Dict[str, Any]]:
        """Get list of available themes."""
        themes = await self.db.query(Theme).filter(
            Theme.tenant_id == tenant_id,
            Theme.is_active == True
        ).all()
        
        return [
            {
                "id": theme.id,
                "name": theme.name,
                "is_system": theme.is_system,
                "colors": theme.colors,
                "typography": theme.typography,
                "metadata": theme.metadata
            }
            for theme in themes
        ]
    
    async def get_available_layouts(
        self,
        tenant_id: str
    ) -> List[Dict[str, Any]]:
        """Get list of available layouts."""
        layouts = await self.db.query(Layout).filter(
            Layout.tenant_id == tenant_id,
            Layout.is_active == True
        ).all()
        
        return [
            {
                "id": layout.id,
                "name": layout.name,
                "is_system": layout.is_system,
                "template": layout.template,
                "sections": layout.sections,
                "metadata": layout.metadata
            }
            for layout in layouts
        ]
    
    async def generate_theme_css(
        self,
        theme: Theme
    ) -> str:
        """Generate CSS for a theme."""
        css = []
        
        # Colors
        for color_name, color_value in theme.colors.items():
            if isinstance(color_value, dict):
                for variant, value in color_value.items():
                    css.append(f"--color-{color_name}-{variant}: {value};")
            else:
                css.append(f"--color-{color_name}: {color_value};")
        
        # Typography
        for typo_name, typo_value in theme.typography.items():
            if isinstance(typo_value, dict):
                for prop, value in typo_value.items():
                    css.append(f"--typography-{typo_name}-{prop}: {value};")
            else:
                css.append(f"--typography-{typo_name}: {typo_value};")
        
        # Spacing
        for space_name, space_value in theme.spacing.items():
            css.append(f"--spacing-{space_name}: {space_value}px;")
        
        # Components
        for comp_name, comp_value in theme.components.items():
            for prop, value in comp_value.items():
                css.append(f"--component-{comp_name}-{prop}: {value};")
        
        return "\n".join(css)
    
    async def generate_layout_html(
        self,
        layout: Layout,
        theme: Theme
    ) -> str:
        """Generate HTML for a layout."""
        # This would be implemented based on your frontend framework
        # (e.g., React, Vue, Angular)
        pass
    
    async def get_ui_analytics(
        self,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Get UI usage analytics."""
        users = await self.db.query(UserInterface).filter(
            UserInterface.tenant_id == tenant_id
        ).all()
        
        theme_usage = {}
        layout_usage = {}
        accessibility_usage = {
            "highContrast": 0,
            "reducedMotion": 0,
            "fontSize": {},
            "colorBlindMode": {}
        }
        
        for ui in users:
            # Theme usage
            if ui.theme_id:
                theme_usage[ui.theme_id] = theme_usage.get(ui.theme_id, 0) + 1
            
            # Layout usage
            if ui.layout_id:
                layout_usage[ui.layout_id] = layout_usage.get(ui.layout_id, 0) + 1
            
            # Accessibility usage
            if ui.accessibility:
                if ui.accessibility.get("highContrast"):
                    accessibility_usage["highContrast"] += 1
                if ui.accessibility.get("reducedMotion"):
                    accessibility_usage["reducedMotion"] += 1
                
                font_size = ui.accessibility.get("fontSize", "medium")
                accessibility_usage["fontSize"][font_size] = (
                    accessibility_usage["fontSize"].get(font_size, 0) + 1
                )
                
                color_blind = ui.accessibility.get("colorBlindMode", "none")
                accessibility_usage["colorBlindMode"][color_blind] = (
                    accessibility_usage["colorBlindMode"].get(color_blind, 0) + 1
                )
        
        return {
            "total_users": len(users),
            "theme_usage": theme_usage,
            "layout_usage": layout_usage,
            "accessibility_usage": accessibility_usage
        } 