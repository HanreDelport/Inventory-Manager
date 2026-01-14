from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models import Product, BillOfMaterials, Component
from schemas import ProductCreate, ProductUpdate, BOMItemDetailResponse, ProductDetailResponse
from decimal import Decimal
import math

def get_all_products(db: Session):
    return db.query(Product).all()


def get_product_by_id(db: Session, product_id: int):
    return db.query(Product).filter(Product.id == product_id).first()


def get_product_with_bom(db: Session, product_id: int):
    product = get_product_by_id(db, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    
    # Get BOM entries with component details
    bom_entries = db.query(BillOfMaterials).filter(BillOfMaterials.product_id == product_id).all()
    
    # Build detailed BOM response
    bom_details = []
    for bom in bom_entries:
        component = bom.component  # SQLAlchemy relationship
        
        # Calculate EXACT quantity with spillage 
        spillage_multiplier = Decimal("1") + component.spillage_coefficient
        quantity_with_spillage = Decimal(str(bom.quantity_required)) * spillage_multiplier
        
        bom_details.append(BOMItemDetailResponse(
            id=bom.id,
            component_id=component.id,
            component_name=component.name,
            quantity_required=bom.quantity_required,
            spillage_coefficient=component.spillage_coefficient,
            quantity_with_spillage=quantity_with_spillage
        ))
    
    # Return product with BOM
    return ProductDetailResponse(
        id=product.id,
        name=product.name,
        in_progress=product.in_progress,
        shipped=product.shipped,
        created_at=product.created_at,
        updated_at=product.updated_at,
        bom=bom_details
    )

def create_product(db: Session, product: ProductCreate):
    # Validate all components exist
    component_ids = [item.component_id for item in product.bom]
    
    for component_id in component_ids:
        component = db.query(Component).filter(Component.id == component_id).first()
        if not component:
            raise HTTPException(
                status_code=404,
                detail=f"Component with id {component_id} does not exist"
            )
    
    # Check for duplicate component_ids in BOM
    if len(component_ids) != len(set(component_ids)):
        duplicates = [cid for cid in component_ids if component_ids.count(cid) > 1]
        raise HTTPException(
            status_code=400,
            detail=f"BOM contains duplicate component_id(s): {list(set(duplicates))}"
        )
    
    # Create the product
    new_product = Product(
        name=product.name,
        in_progress=0,
        shipped=0
    )
    
    try:
        db.add(new_product)
        db.flush()  # Get the product.id without committing yet
        
        # Create BOM entries
        for bom_item in product.bom:
            bom_entry = BillOfMaterials(
                product_id=new_product.id,
                component_id=bom_item.component_id,
                quantity_required=bom_item.quantity_required
            )
            db.add(bom_entry)
        
        # Commit everything
        db.commit()
        db.refresh(new_product)
        
        # Return detailed response with BOM
        return get_product_with_bom(db, new_product.id)
        
    except IntegrityError as e:
        db.rollback()
        
        if "Duplicate entry" in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"Product with name '{product.name}' already exists"
            )
        
        raise HTTPException(status_code=400, detail=f"Database error: {str(e.orig)}")
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def update_product(db: Session, product_id: int, product_update: ProductUpdate):
    product = get_product_by_id(db, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    
    update_data = product_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(product, field, value)
    
    try:
        db.commit()
        db.refresh(product)
        return product
    
    except IntegrityError as e:
        db.rollback()
        
        if "Duplicate entry" in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"Product with name '{product_update.name}' already exists"
            )
        
        raise HTTPException(status_code=400, detail=f"Database error: {str(e.orig)}")
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def delete_product(db: Session, product_id: int):
    product = get_product_by_id(db, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    
    # Check if product has inventory
    if product.in_progress > 0 or product.shipped > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete product '{product.name}' because it has inventory in progress ({product.in_progress}) or shipped ({product.shipped})"
        )
    
    # Check if product has active orders
    from models import Order
    order_count = db.query(Order).filter(Order.product_id == product_id).count()
    
    if order_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete product '{product.name}' because it has {order_count} order(s) in the system"
        )
    
    try:
        db.delete(product)  # CASCADE will delete BOM entries automatically
        db.commit()
        return {"message": f"Product '{product.name}' and its BOM deleted successfully"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def update_product_bom(db: Session, product_id: int, bom_items: list):
    product = get_product_by_id(db, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    
    # Validate all components exist
    component_ids = [item.component_id for item in bom_items]
    
    for component_id in component_ids:
        component = db.query(Component).filter(Component.id == component_id).first()
        if not component:
            raise HTTPException(
                status_code=404,
                detail=f"Component with id {component_id} does not exist"
            )
    
    # Check for duplicates
    if len(component_ids) != len(set(component_ids)):
        duplicates = [cid for cid in component_ids if component_ids.count(cid) > 1]
        raise HTTPException(
            status_code=400,
            detail=f"BOM contains duplicate component_id(s): {list(set(duplicates))}"
        )
    
    try:
        # Delete existing BOM entries
        db.query(BillOfMaterials).filter(BillOfMaterials.product_id == product_id).delete()
        
        # Create new BOM entries
        for bom_item in bom_items:
            new_bom = BillOfMaterials(
                product_id=product_id,
                component_id=bom_item.component_id,
                quantity_required=bom_item.quantity_required
            )
            db.add(new_bom)
        
        db.commit()
        
        return get_product_with_bom(db, product_id)
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def calculate_production_capacity(db: Session):
    products = get_all_products(db)
    capacity_list = []
    
    for product in products:
        bom_entries = db.query(BillOfMaterials).filter(
            BillOfMaterials.product_id == product.id
        ).all()
        
        if not bom_entries:
            # Product has no BOM (shouldn't happen, but handle it)
            capacity_list.append({
                "id": product.id,
                "name": product.name,
                "in_progress": product.in_progress,
                "shipped": product.shipped,
                "max_producible": 0,
                "limiting_component": "No BOM defined"
            })
            continue
        
        # Calculate max producible for each component
        max_quantities = []
        
        for bom in bom_entries:
            component = bom.component
            
            # Calculate required quantity per product unit (with spillage)
            spillage_multiplier = 1 + float(component.spillage_coefficient)
            required_per_unit = bom.quantity_required * spillage_multiplier
            
            # How many products can we make with available stock?
            if required_per_unit > 0:
                max_from_this_component = int(component.in_stock / required_per_unit)
            else:
                max_from_this_component = 0
            
            max_quantities.append({
                "component_name": component.name,
                "max_units": max_from_this_component
            })
        
        # The limiting factor is the component with the LOWEST max
        limiting = min(max_quantities, key=lambda x: x["max_units"])
        
        capacity_list.append({
            "id": product.id,
            "name": product.name,
            "in_progress": product.in_progress,
            "shipped": product.shipped,
            "max_producible": limiting["max_units"],
            "limiting_component": limiting["component_name"]
        })
    
    return capacity_list