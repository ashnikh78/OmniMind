from typing import Dict, Optional, Any, List, Union
from datetime import datetime
from sqlalchemy import Column, String, DateTime, JSON, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from pydantic import BaseModel
import json
import os

from .models import Base
from .config import settings

class Component(Base):
    """Component model for storing UI component configurations."""
    __tablename__ = "components"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # button, card, input, etc.
    variant = Column(String, nullable=False)  # primary, secondary, etc.
    props = Column(JSON, nullable=False)
    styles = Column(JSON, nullable=False)
    behaviors = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    metadata = Column(JSON, nullable=True)

class ComponentLibrary:
    """Manages UI component library and configurations."""
    
    def __init__(self, db_session, audit_logger):
        self.db = db_session
        self.audit_logger = audit_logger
        self._load_components()
    
    def _load_components(self):
        """Load components from database into memory."""
        self.components = {}
        components = self.db.query(Component).filter(
            Component.is_active == True
        ).all()
        
        for component in components:
            if component.tenant_id not in self.components:
                self.components[component.tenant_id] = {}
            if component.type not in self.components[component.tenant_id]:
                self.components[component.tenant_id][component.type] = {}
            self.components[component.tenant_id][component.type][component.variant] = component
    
    async def get_default_components(self) -> Dict[str, Dict[str, Any]]:
        """Get default component configurations."""
        return {
            "button": {
                "primary": {
                    "props": {
                        "variant": "contained",
                        "color": "primary",
                        "size": "medium",
                        "disableElevation": False,
                        "disableRipple": False,
                        "fullWidth": False
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "padding": "6px 16px",
                        "fontWeight": 500,
                        "textTransform": "uppercase",
                        "transition": "background-color 0.2s, box-shadow 0.2s"
                    },
                    "behaviors": {
                        "hover": {
                            "elevation": 4,
                            "backgroundColor": "primary.dark"
                        },
                        "focus": {
                            "outline": "none",
                            "boxShadow": "0 0 0 2px rgba(33, 150, 243, 0.3)"
                        },
                        "active": {
                            "transform": "scale(0.98)"
                        },
                        "disabled": {
                            "opacity": 0.5,
                            "cursor": "not-allowed"
                        }
                    }
                },
                "secondary": {
                    "props": {
                        "variant": "outlined",
                        "color": "secondary",
                        "size": "medium",
                        "disableElevation": True,
                        "disableRipple": False,
                        "fullWidth": False
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "padding": "6px 16px",
                        "fontWeight": 500,
                        "textTransform": "uppercase",
                        "transition": "border-color 0.2s, color 0.2s"
                    },
                    "behaviors": {
                        "hover": {
                            "backgroundColor": "rgba(255, 64, 129, 0.04)",
                            "borderColor": "secondary.main"
                        },
                        "focus": {
                            "outline": "none",
                            "boxShadow": "0 0 0 2px rgba(255, 64, 129, 0.3)"
                        },
                        "active": {
                            "transform": "scale(0.98)"
                        },
                        "disabled": {
                            "opacity": 0.5,
                            "cursor": "not-allowed"
                        }
                    }
                }
            },
            "card": {
                "default": {
                    "props": {
                        "variant": "elevation",
                        "elevation": 1,
                        "square": False
                    },
                    "styles": {
                        "borderRadius": "8px",
                        "padding": "16px",
                        "backgroundColor": "background.paper",
                        "transition": "box-shadow 0.2s"
                    },
                    "behaviors": {
                        "hover": {
                            "elevation": 4
                        }
                    }
                },
                "interactive": {
                    "props": {
                        "variant": "elevation",
                        "elevation": 1,
                        "square": False,
                        "clickable": True
                    },
                    "styles": {
                        "borderRadius": "8px",
                        "padding": "16px",
                        "backgroundColor": "background.paper",
                        "transition": "all 0.2s",
                        "cursor": "pointer"
                    },
                    "behaviors": {
                        "hover": {
                            "elevation": 4,
                            "transform": "translateY(-2px)"
                        },
                        "active": {
                            "transform": "translateY(0)"
                        }
                    }
                }
            },
            "input": {
                "default": {
                    "props": {
                        "variant": "outlined",
                        "size": "medium",
                        "fullWidth": False,
                        "required": False,
                        "disabled": False
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "padding": "8px 12px",
                        "transition": "border-color 0.2s, box-shadow 0.2s"
                    },
                    "behaviors": {
                        "focus": {
                            "borderColor": "primary.main",
                            "boxShadow": "0 0 0 2px rgba(33, 150, 243, 0.3)"
                        },
                        "error": {
                            "borderColor": "error.main",
                            "boxShadow": "0 0 0 2px rgba(244, 67, 54, 0.3)"
                        },
                        "disabled": {
                            "backgroundColor": "action.disabledBackground",
                            "cursor": "not-allowed"
                        }
                    }
                },
                "search": {
                    "props": {
                        "variant": "outlined",
                        "size": "medium",
                        "fullWidth": True,
                        "startAdornment": {
                            "type": "icon",
                            "icon": "search"
                        }
                    },
                    "styles": {
                        "borderRadius": "24px",
                        "padding": "8px 16px",
                        "transition": "all 0.2s"
                    },
                    "behaviors": {
                        "focus": {
                            "borderColor": "primary.main",
                            "boxShadow": "0 0 0 2px rgba(33, 150, 243, 0.3)"
                        },
                        "hover": {
                            "borderColor": "primary.light"
                        }
                    }
                }
            },
            "table": {
                "default": {
                    "props": {
                        "variant": "outlined",
                        "size": "medium",
                        "stickyHeader": False,
                        "dense": False
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "overflow": "hidden"
                    },
                    "behaviors": {
                        "rowHover": {
                            "backgroundColor": "action.hover"
                        },
                        "rowSelected": {
                            "backgroundColor": "action.selected"
                        }
                    }
                },
                "interactive": {
                    "props": {
                        "variant": "outlined",
                        "size": "medium",
                        "stickyHeader": True,
                        "dense": False,
                        "selectable": True,
                        "sortable": True
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "overflow": "hidden"
                    },
                    "behaviors": {
                        "rowHover": {
                            "backgroundColor": "action.hover",
                            "cursor": "pointer"
                        },
                        "rowSelected": {
                            "backgroundColor": "action.selected"
                        },
                        "headerHover": {
                            "backgroundColor": "action.hover"
                        }
                    }
                }
            },
            "chart": {
                "default": {
                    "props": {
                        "responsive": True,
                        "maintainAspectRatio": False,
                        "animation": True
                    },
                    "styles": {
                        "borderRadius": "8px",
                        "padding": "16px",
                        "backgroundColor": "background.paper"
                    },
                    "behaviors": {
                        "hover": {
                            "mode": "nearest",
                            "intersect": True
                        },
                        "legend": {
                            "position": "bottom",
                            "align": "center"
                        }
                    }
                },
                "interactive": {
                    "props": {
                        "responsive": True,
                        "maintainAspectRatio": False,
                        "animation": True,
                        "interactive": True
                    },
                    "styles": {
                        "borderRadius": "8px",
                        "padding": "16px",
                        "backgroundColor": "background.paper"
                    },
                    "behaviors": {
                        "hover": {
                            "mode": "nearest",
                            "intersect": True,
                            "animationDuration": 200
                        },
                        "legend": {
                            "position": "bottom",
                            "align": "center",
                            "onClick": "toggle"
                        },
                        "tooltip": {
                            "enabled": True,
                            "mode": "index",
                            "intersect": False
                        }
                    }
                }
            },
            "modal": {
                "default": {
                    "props": {
                        "variant": "dialog",
                        "fullScreen": False,
                        "maxWidth": "sm"
                    },
                    "styles": {
                        "borderRadius": "8px",
                        "overflow": "hidden"
                    },
                    "behaviors": {
                        "enter": {
                            "animation": "fadeIn",
                            "duration": 225
                        },
                        "exit": {
                            "animation": "fadeOut",
                            "duration": 195
                        }
                    }
                },
                "fullscreen": {
                    "props": {
                        "variant": "dialog",
                        "fullScreen": True
                    },
                    "styles": {
                        "overflow": "hidden"
                    },
                    "behaviors": {
                        "enter": {
                            "animation": "slideUp",
                            "duration": 225
                        },
                        "exit": {
                            "animation": "slideDown",
                            "duration": 195
                        }
                    }
                }
            },
            "navigation": {
                "default": {
                    "props": {
                        "variant": "horizontal",
                        "color": "primary",
                        "showLabels": True
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "overflow": "hidden"
                    },
                    "behaviors": {
                        "itemHover": {
                            "backgroundColor": "action.hover"
                        },
                        "itemActive": {
                            "backgroundColor": "action.selected"
                        }
                    }
                },
                "vertical": {
                    "props": {
                        "variant": "vertical",
                        "color": "primary",
                        "showLabels": True
                    },
                    "styles": {
                        "borderRadius": "4px",
                        "overflow": "hidden"
                    },
                    "behaviors": {
                        "itemHover": {
                            "backgroundColor": "action.hover"
                        },
                        "itemActive": {
                            "backgroundColor": "action.selected"
                        }
                    }
                }
            }
        }
    
    async def create_component(
        self,
        tenant_id: str,
        name: str,
        type: str,
        variant: str,
        props: Dict[str, Any],
        styles: Dict[str, Any],
        behaviors: Dict[str, Any],
        is_system: bool = False,
        metadata: Optional[Dict] = None
    ) -> Component:
        """Create a new component."""
        component = Component(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name=name,
            type=type,
            variant=variant,
            props=props,
            styles=styles,
            behaviors=behaviors,
            is_system=is_system,
            metadata=metadata
        )
        
        self.db.add(component)
        await self.db.commit()
        self._load_components()
        
        return component
    
    async def get_component(
        self,
        tenant_id: str,
        type: str,
        variant: str
    ) -> Optional[Component]:
        """Get component by type and variant."""
        return self.components.get(tenant_id, {}).get(type, {}).get(variant)
    
    async def get_available_components(
        self,
        tenant_id: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Get list of available components."""
        components = await self.db.query(Component).filter(
            Component.tenant_id == tenant_id,
            Component.is_active == True
        ).all()
        
        result = {}
        for component in components:
            if component.type not in result:
                result[component.type] = []
            
            result[component.type].append({
                "id": component.id,
                "name": component.name,
                "variant": component.variant,
                "is_system": component.is_system,
                "props": component.props,
                "styles": component.styles,
                "behaviors": component.behaviors,
                "metadata": component.metadata
            })
        
        return result
    
    async def generate_component_css(
        self,
        component: Component
    ) -> str:
        """Generate CSS for a component."""
        css = []
        
        # Base styles
        for prop, value in component.styles.items():
            css.append(f".{component.type}-{component.variant} {{")
            css.append(f"  {prop}: {value};")
            css.append("}")
        
        # Behaviors
        for behavior, rules in component.behaviors.items():
            if behavior == "hover":
                css.append(f".{component.type}-{component.variant}:hover {{")
                for prop, value in rules.items():
                    css.append(f"  {prop}: {value};")
                css.append("}")
            elif behavior == "focus":
                css.append(f".{component.type}-{component.variant}:focus {{")
                for prop, value in rules.items():
                    css.append(f"  {prop}: {value};")
                css.append("}")
            elif behavior == "active":
                css.append(f".{component.type}-{component.variant}:active {{")
                for prop, value in rules.items():
                    css.append(f"  {prop}: {value};")
                css.append("}")
            elif behavior == "disabled":
                css.append(f".{component.type}-{component.variant}:disabled {{")
                for prop, value in rules.items():
                    css.append(f"  {prop}: {value};")
                css.append("}")
        
        return "\n".join(css)
    
    async def get_component_analytics(
        self,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Get component usage analytics."""
        components = await self.db.query(Component).filter(
            Component.tenant_id == tenant_id,
            Component.is_active == True
        ).all()
        
        usage = {}
        for component in components:
            if component.type not in usage:
                usage[component.type] = {}
            usage[component.type][component.variant] = {
                "name": component.name,
                "is_system": component.is_system,
                "created_at": component.created_at,
                "updated_at": component.updated_at
            }
        
        return usage 