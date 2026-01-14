from sqlalchemy import Column, Integer, String, DECIMAL, TIMESTAMP, Enum, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

# Enum for order status
class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class Component(Base):
    __tablename__ = "components"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    spillage_coefficient = Column(DECIMAL(5, 4), default=0.0000)
    in_stock = Column(Integer, default=0)
    in_progress = Column(Integer, default=0)
    shipped = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    bom_entries = relationship("BillOfMaterials", back_populates="component")
    allocations = relationship("OrderAllocation", back_populates="component")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('spillage_coefficient >= 0 AND spillage_coefficient <= 9.9999', name='check_spillage_range'),
        CheckConstraint('in_stock >= 0 AND in_progress >= 0 AND shipped >= 0', name='check_component_quantities'),
    )


class Product(Base):
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    in_progress = Column(Integer, default=0)
    shipped = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    bom_entries = relationship("BillOfMaterials", back_populates="product", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="product")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('in_progress >= 0 AND shipped >= 0', name='check_product_quantities'),
    )


class BillOfMaterials(Base):
    __tablename__ = "bill_of_materials"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="RESTRICT"), nullable=False)
    quantity_required = Column(Integer, nullable=False)
    
    # Relationships
    product = relationship("Product", back_populates="bom_entries")
    component = relationship("Component", back_populates="bom_entries")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('quantity_required > 0', name='check_quantity_positive'),
    )


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(Enum('pending', 'in_progress', 'completed', name='orderstatus'), default='in_progress')
    created_at = Column(TIMESTAMP, server_default=func.now())
    completed_at = Column(TIMESTAMP, nullable=True)
    
    # Relationships
    product = relationship("Product", back_populates="orders")
    allocations = relationship("OrderAllocation", back_populates="order", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('quantity > 0', name='check_order_quantity_positive'),
    )


class OrderAllocation(Base):
    __tablename__ = "order_allocations"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id"), nullable=False)
    quantity_allocated = Column(Integer, nullable=False)
    
    # Relationships
    order = relationship("Order", back_populates="allocations")
    component = relationship("Component", back_populates="allocations")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('quantity_allocated > 0', name='check_allocation_positive'),
    )