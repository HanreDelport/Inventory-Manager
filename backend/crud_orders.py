from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models import Order, OrderAllocation, Product, BillOfMaterials, Component, OrderStatus
from schemas import OrderCreate, OrderDetailResponse, OrderAllocationResponse, OrderResponse
from decimal import Decimal
import math
from datetime import datetime

def get_all_orders(db: Session):
    return db.query(Order).all()


def get_order_by_id(db: Session, order_id: int):
    return db.query(Order).filter(Order.id == order_id).first()


def get_order_with_details(db: Session, order_id: int):
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with id {order_id} not found")
    
    # Get allocations with component details
    allocations = []
    for allocation in order.allocations:
        allocations.append(OrderAllocationResponse(
            id=allocation.id,
            component_id=allocation.component_id,
            component_name=allocation.component.name,
            quantity_allocated=allocation.quantity_allocated
        ))
    
    return OrderDetailResponse(
        id=order.id,
        product_id=order.product_id,
        product_name=order.product.name,
        quantity=order.quantity,
        status=order.status,
        created_at=order.created_at,
        completed_at=order.completed_at,
        allocations=allocations
    )


def create_order(db: Session, order_data: OrderCreate):
    # Validate product exists
    product = db.query(Product).filter(Product.id == order_data.product_id).first()
    
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with id {order_data.product_id} not found"
        )
    
    # Get product's BOM
    bom_entries = db.query(BillOfMaterials).filter(
        BillOfMaterials.product_id == order_data.product_id
    ).all()
    
    if not bom_entries:
        raise HTTPException(
            status_code=400,
            detail=f"Product '{product.name}' has no Bill of Materials defined"
        )
    
    # Calculate required components with spillage
    component_requirements = []
    
    for bom in bom_entries:
        component = bom.component
        
        # Calculate exact quantity needed (per unit with spillage)
        spillage_multiplier = Decimal("1") + component.spillage_coefficient
        exact_per_unit = Decimal(str(bom.quantity_required)) * spillage_multiplier
        
        # Calculate total for order quantity
        exact_total = exact_per_unit * Decimal(str(order_data.quantity))
        
        # Round UP to whole units (can't allocate partial components)
        allocated_quantity = math.ceil(float(exact_total))
        
        component_requirements.append({
            "component": component,
            "bom_quantity": bom.quantity_required,
            "spillage_coefficient": component.spillage_coefficient,
            "exact_per_unit": exact_per_unit,
            "exact_total": exact_total,
            "allocated_quantity": allocated_quantity
        })
    
    # Validate sufficient inventory for ALL components
    insufficient_components = []
    
    for req in component_requirements:
        component = req["component"]
        needed = req["allocated_quantity"]
        available = component.in_stock
        
        if available < needed:
            insufficient_components.append({
                "component_name": component.name,
                "needed": needed,
                "available": available,
                "shortage": needed - available
            })
    
    if insufficient_components:
        # Build detailed error message
        shortage_details = []
        for item in insufficient_components:
            shortage_details.append(
                f"{item['component_name']}: need {item['needed']}, have {item['available']} (short {item['shortage']})"
            )
        
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient inventory for order. Shortages: {'; '.join(shortage_details)}"
        )
    
    # BEGIN TRANSACTION - Create order and allocate inventory
    try:
        # Create order record
        new_order = Order(
            product_id=order_data.product_id,
            quantity=order_data.quantity,
            status='in_progress'  # Directly to in_progress
        )
        
        db.add(new_order)
        db.flush()  # Get order ID without committing
        
        # Allocate each component
        for req in component_requirements:
            component = req["component"]
            allocated_qty = req["allocated_quantity"]
            
            # Update component inventory
            component.in_stock -= allocated_qty
            component.in_progress += allocated_qty
            
            # Create allocation record
            allocation = OrderAllocation(
                order_id=new_order.id,
                component_id=component.id,
                quantity_allocated=allocated_qty
            )
            db.add(allocation)
        
        # Update product inventory
        product.in_progress += order_data.quantity
        
        # Commit everything
        db.commit()
        db.refresh(new_order)
        
        # Return detailed response
        return get_order_with_details(db, new_order.id)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create order: {str(e)}"
        )


def complete_order(db: Session, order_id: int):
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(
            status_code=404,
            detail=f"Order with id {order_id} not found"
        )
    
    if order.status == 'completed':
        raise HTTPException(
            status_code=400,
            detail=f"Order {order_id} is already completed"
        )
    
    try:
        # Move component inventory: from in_progress to shipped
        for allocation in order.allocations:
            component = allocation.component
            qty = allocation.quantity_allocated
            
            # Validate we have enough in_progress (should always be true)
            if component.in_progress < qty:
                raise HTTPException(
                    status_code=500,
                    detail=f"Data inconsistency: Component '{component.name}' has insufficient in_progress inventory"
                )
            
            component.in_progress -= qty
            component.shipped += qty
        
        # Move product inventory: from in_progress to shipped
        product = order.product
        
        if product.in_progress < order.quantity:
            raise HTTPException(
                status_code=500,
                detail=f"Data inconsistency: Product '{product.name}' has insufficient in_progress inventory"
            )
        
        product.in_progress -= order.quantity
        product.shipped += order.quantity
        
        # Update order status
        order.status = 'completed'
        order.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(order)
        
        return get_order_with_details(db, order_id)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete order: {str(e)}"
        )


def get_order_summary(db: Session):
    orders = get_all_orders(db)
    
    # Count by status
    pending_count = sum(1 for o in orders if o.status == 'pending')
    in_progress_count = sum(1 for o in orders if o.status == 'in_progress')
    completed_count = sum(1 for o in orders if o.status == 'completed')
    
    # Build order list with product names
    order_list = []
    for order in orders:
        order_list.append(OrderResponse(
            id=order.id,
            product_id=order.product_id,
            product_name=order.product.name,
            quantity=order.quantity,
            status=order.status,
            created_at=order.created_at,
            completed_at=order.completed_at
        ))
    
    return {
        "total_orders": len(orders),
        "pending": pending_count,
        "in_progress": in_progress_count,
        "completed": completed_count,
        "orders": order_list
    }