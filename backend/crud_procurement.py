from sqlalchemy.orm import Session
from models import Component, Order, BillOfMaterials
from decimal import Decimal
import math

def calculate_procurement_needs(db: Session):
    from crud_orders import calculate_total_components_recursive
    
    open_orders = db.query(Order).filter(Order.status.in_(['pending', 'in_progress'])).all()
    
    if not open_orders:
        return {
            "components_to_order": [],
            "total_items": 0
        }
    
    component_needs = {}
    
    for order in open_orders:
        if order.status == 'pending':
            total_components = calculate_total_components_recursive(
                db, 
                order.product_id, 
                order.quantity
            )
            
            for component_id, needed_qty in total_components.items():
                if component_id not in component_needs:
                    component_needs[component_id] = {
                        "component": db.query(Component).filter(Component.id == component_id).first(),
                        "total_needed": 0,
                        "orders_count": 0
                    }
                
                component_needs[component_id]["total_needed"] += needed_qty
                component_needs[component_id]["orders_count"] += 1  # This now increments for EVERY component in the order
    
    procurement_list = []
    
    for component_id, data in component_needs.items():
        component = data["component"]
        total_needed = data["total_needed"]
        available = component.in_stock
        shortage = total_needed - available
        
        if shortage > 0:
            procurement_list.append({
                "component_id": component.id,
                "component_name": component.name,
                "in_stock": available,
                "total_needed": total_needed,
                "shortage": shortage,
                "orders_affected": data["orders_count"]
            })
    
    return {
        "components_to_order": procurement_list,
        "total_items": len(procurement_list)
    }
