from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


# Component Schemas
class ComponentBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    spillage_coefficient: Decimal = Field(default=Decimal("0.0000"), ge=0, le=9.9999)

class ComponentCreate(ComponentBase):
    in_stock: int = Field(default=0, ge=0)

class ComponentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    spillage_coefficient: Optional[Decimal] = Field(None, ge=0, le=9.9999)
    in_stock: Optional[int] = Field(None, ge=0)

class ComponentResponse(ComponentBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    in_stock: int
    in_progress: int
    shipped: int
    created_at: datetime
    updated_at: datetime

# BOM Schemas

class BOMItemCreate(BaseModel):
    component_id: int = Field(..., gt=0)
    quantity_required: int = Field(..., gt=0)

class BOMItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    component_id: int
    quantity_required: int
    component_name: str  # We'll populate this manually
    component_spillage: Decimal  # Include spillage for calculations

class BOMItemDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    component_id: int
    component_name: str
    quantity_required: int
    spillage_coefficient: Decimal
    quantity_with_spillage: Decimal 

# Product Schemas

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class ProductCreate(ProductBase):
    bom: List[BOMItemCreate] = Field(..., min_length=1)  # At least 1 component required
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Toy Car",
                "bom": [
                    {"component_id": 1, "quantity_required": 4},
                    {"component_id": 2, "quantity_required": 1},
                    {"component_id": 3, "quantity_required": 2}
                ]
            }
        }

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)

class ProductResponse(ProductBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    in_progress: int
    shipped: int
    created_at: datetime
    updated_at: datetime

class ProductDetailResponse(ProductResponse):
    bom: List[BOMItemDetailResponse]

class ProductCapacityResponse(BaseModel):
    id: int
    name: str
    in_progress: int
    shipped: int
    max_producible: int  # Calculated based on component availability
    limiting_component: Optional[str]  # Which component limits production


# ===== ORDER SCHEMAS =====

class OrderCreate(BaseModel):
    """Create a new order"""
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., gt=0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "product_id": 1,
                "quantity": 100
            }
        }

class OrderAllocationResponse(BaseModel):
    """Allocation details for an order"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    component_id: int
    component_name: str
    quantity_allocated: int

class OrderResponse(BaseModel):
    """Basic order response"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    product_id: int
    product_name: str
    quantity: int
    status: str
    created_at: datetime
    completed_at: Optional[datetime]

class OrderDetailResponse(OrderResponse):
    """Detailed order response with allocations"""
    allocations: List[OrderAllocationResponse]

class OrderSummaryResponse(BaseModel):
    """Summary of all orders"""
    total_orders: int
    pending: int
    in_progress: int
    completed: int
    orders: List[OrderResponse]

class ComponentRequirementResponse(BaseModel):
    component_id: int
    component_name: str
    needed: int
    available: int
    shortage: int
    has_enough: bool

class OrderRequirementsResponse(BaseModel):
    order_id: int
    product_name: str
    quantity: int
    status: str
    requirements: List[ComponentRequirementResponse]
    can_allocate: bool


# ===== ORDER SCHEMAS =====

class ProcurementItemResponse(BaseModel):
    component_id: int
    component_name: str
    in_stock: int
    total_needed: int
    shortage: int
    orders_affected: int

class ProcurementResponse(BaseModel):
    components_to_order: List[ProcurementItemResponse]
    total_items: int

# Health Check Schema
class HealthResponse(BaseModel):
    status: str
    database: str
    message: str