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
        status=order.status.value,
        created_at=order.created_at,
        completed_at=order.completed_at,
        allocations=allocations
    )


def create_order(db: Session, order_data: OrderCreate):
    product = db.query(Product).filter(Product.id == order_data.product_id).first()
    
    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with id {order_data.product_id} not found"
        )
    
    # Calculate required components with spillage (RECURSIVE for nested products)
    total_component_requirements = calculate_total_components_recursive(db, order_data.product_id, order_data.quantity)

    if not total_component_requirements:
        raise HTTPException(
            status_code=400,
            detail=f"Product '{product.name}' has no Bill of Materials defined"
        )
    
    component_requirements = []
    
    for component_id, needed_qty in total_component_requirements.items():
        component = db.query(Component).filter(Component.id == component_id).first()
        
        component_requirements.append({
            "component": component,
            "allocated_quantity": needed_qty
        })

    
    
    # Check if we have enough inventory
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
    
    # Decide status based on inventory availability
    if insufficient_components:
        order_status = OrderStatus.PENDING  # Not enough inventory - wait for procurement
        allocate_inventory = False
    else:
        order_status = OrderStatus.IN_PROGRESS  # Enough inventory - allocate immediately
        allocate_inventory = True
    
    try:
        new_order = Order(
            product_id=order_data.product_id,
            quantity=order_data.quantity,
            status=order_status
        )
        
        db.add(new_order)
        db.flush()
        
        # Only allocate if we have enough inventory
        if allocate_inventory:
            for req in component_requirements:
                component = req["component"]
                allocated_qty = req["allocated_quantity"]
                
                component.in_stock -= allocated_qty
                component.in_progress += allocated_qty
                
                allocation = OrderAllocation(
                    order_id=new_order.id,
                    component_id=component.id,
                    quantity_allocated=allocated_qty
                )
                db.add(allocation)
            
            product.in_progress += order_data.quantity
        
        db.commit()
        db.refresh(new_order)
        
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
    
    if order.status == OrderStatus.COMPLETED:
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
        order.status = OrderStatus.COMPLETED
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
    pending_count = sum(1 for o in orders if o.status == OrderStatus.PENDING)
    in_progress_count = sum(1 for o in orders if o.status == OrderStatus.IN_PROGRESS)
    completed_count = sum(1 for o in orders if o.status == OrderStatus.COMPLETED)
    
    # Build order list with product names
    order_list = []
    for order in orders:
        order_list.append(OrderResponse(
            id=order.id,
            product_id=order.product_id,
            product_name=order.product.name,
            quantity=order.quantity,
            status=order.status.value,
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


def allocate_pending_order(db: Session, order_id: int):
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with id {order_id} not found")
    
    if order.status != OrderStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Order {order_id} is not pending (current status: {order.status})"
        )
    
    product = order.product
    bom_entries = db.query(BillOfMaterials).filter(
        BillOfMaterials.product_id == order.product_id
    ).all()
    
    component_requirements = []
    
    for bom in bom_entries:
        component = bom.component
        spillage_multiplier = Decimal("1") + component.spillage_coefficient
        exact_per_unit = Decimal(str(bom.quantity_required)) * spillage_multiplier
        exact_total = exact_per_unit * Decimal(str(order.quantity))
        allocated_quantity = math.ceil(float(exact_total))
        
        component_requirements.append({
            "component": component,
            "allocated_quantity": allocated_quantity
        })
    
    # Check if we NOW have enough inventory
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
        shortage_details = []
        for item in insufficient_components:
            shortage_details.append(
                f"{item['component_name']}: need {item['needed']}, have {item['available']} (short {item['shortage']})"
            )
        
        raise HTTPException(
            status_code=400,
            detail=f"Still insufficient inventory. Shortages: {'; '.join(shortage_details)}"
        )
    
    try:
        # Allocate components
        for req in component_requirements:
            component = req["component"]
            allocated_qty = req["allocated_quantity"]
            
            component.in_stock -= allocated_qty
            component.in_progress += allocated_qty
            
            allocation = OrderAllocation(
                order_id=order.id,
                component_id=component.id,
                quantity_allocated=allocated_qty
            )
            db.add(allocation)
        
        # Update product
        product.in_progress += order.quantity
        
        # Update order status
        order.status = OrderStatus.IN_PROGRESS
        
        db.commit()
        db.refresh(order)
        
        return get_order_with_details(db, order_id)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to allocate order: {str(e)}")
 
    
def get_order_requirements(db: Session, order_id: int):
    """
    Get component requirements for an order (for allocation preview).
    
    Shows what components are needed, available, and short.
    """
    order = get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=404, detail=f"Order with id {order_id} not found")
    
    product = order.product
     # Use recursive calculation for nested products
    total_component_requirements = calculate_total_components_recursive(
        db, 
        order.product_id, 
        order.quantity
    )
    
    requirements = []
    
    for component_id, needed_qty in total_component_requirements.items():
        component = db.query(Component).filter(Component.id == component_id).first()
        
        available = component.in_stock
        shortage = max(0, needed_qty - available)
        
        requirements.append({
            "component_id": component.id,
            "component_name": component.name,
            "needed": needed_qty,
            "available": available,
            "shortage": shortage,
            "has_enough": shortage == 0
        })
    
    can_allocate = all(req["has_enough"] for req in requirements)
    
    return {
        "order_id": order.id,
        "product_name": product.name,
        "quantity": order.quantity,
        "status": order.status,
        "requirements": requirements,
        "can_allocate": can_allocate
    }

def calculate_total_components_recursive(db: Session, product_id: int, quantity: int, depth=0):
    """
    Recursively calculate all component requirements for a product,
    including components from nested sub-products.
    """
    from models import ProductBOM
    
    if depth > 10:
        raise HTTPException(400, "BOM nesting too deep (max 10 levels)")
    
    total_components = {}
    
    # Get direct component requirements
    component_boms = db.query(BillOfMaterials).filter(
        BillOfMaterials.product_id == product_id
    ).all()
    
    for bom in component_boms:
        component = bom.component
        spillage_multiplier = Decimal("1") + component.spillage_coefficient
        exact_per_unit = Decimal(str(bom.quantity_required)) * spillage_multiplier
        exact_total = exact_per_unit * Decimal(str(quantity))
        needed = math.ceil(float(exact_total))
        
        if component.id in total_components:
            total_components[component.id] += needed
        else:
            total_components[component.id] = needed
    
    # Get sub-product requirements (nested products)
    product_boms = db.query(ProductBOM).filter(
        ProductBOM.parent_product_id == product_id
    ).all()
    
    for product_bom in product_boms:
        # Recursively get components for sub-product
        sub_quantity = product_bom.quantity_required * quantity
        sub_components = calculate_total_components_recursive(
            db, 
            product_bom.child_product_id, 
            sub_quantity,
            depth + 1
        )
        
        # Merge sub-product components into total
        for comp_id, comp_qty in sub_components.items():
            if comp_id in total_components:
                total_components[comp_id] += comp_qty
            else:
                total_components[comp_id] = comp_qty
    
    return total_components