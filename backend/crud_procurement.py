from sqlalchemy.orm import Session
from models import Component, Order, BillOfMaterials
from decimal import Decimal
import math

def calculate_procurement_needs(db: Session):
    # Get both pending AND in_progress orders
    open_orders = db.query(Order).filter(Order.status.in_(['pending', 'in_progress'])).all()
    
    if not open_orders:
        return {
            "components_to_order": [],
            "total_items": 0
        }
    
    component_needs = {}
    
    for order in open_orders:
        bom_entries = db.query(BillOfMaterials).filter(
            BillOfMaterials.product_id == order.product_id
        ).all()
        
        for bom in bom_entries:
            component = bom.component
            
            spillage_multiplier = Decimal("1") + component.spillage_coefficient
            exact_per_unit = Decimal(str(bom.quantity_required)) * spillage_multiplier
            exact_total = exact_per_unit * Decimal(str(order.quantity))
            needed_qty = math.ceil(float(exact_total))
            
            # For pending orders, use full amount; for in_progress, they're already allocated
            if order.status == 'pending':
                actual_need = needed_qty
            else:
                # in_progress orders already have allocations, so need = 0
                actual_need = 0
            
            if component.id not in component_needs:
                component_needs[component.id] = {
                    "component": component,
                    "total_needed": 0,
                    "orders_count": 0
                }
            
            component_needs[component.id]["total_needed"] += actual_need
            if actual_need > 0:
                component_needs[component.id]["orders_count"] += 1
    
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