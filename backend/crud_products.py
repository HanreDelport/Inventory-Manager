from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models import Product, BillOfMaterials, Component
from schemas import ProductCreate, ProductUpdate, BOMItemDetailResponse, ProductDetailResponse, ProductBOMItemResponse, ProductBOMItemCreate
from decimal import Decimal
import math
from crud_orders import calculate_total_components_recursive;

def check_circular_reference(db: Session, parent_id: int, child_id: int, visited=None):
    if visited is None:
        visited = set()
    
    if child_id in visited:
        return True
    
    if parent_id == child_id:
        return True
    
    visited.add(parent_id)
    
    from models import ProductBOM
    child_boms = db.query(ProductBOM).filter(
        ProductBOM.parent_product_id == child_id
    ).all()
    
    for bom in child_boms:
        if check_circular_reference(db, parent_id, bom.child_product_id, visited):
            return True
    
    return False

def get_all_products(db: Session):
    return db.query(Product).all()


def get_product_by_id(db: Session, product_id: int):
    return db.query(Product).filter(Product.id == product_id).first()


def get_product_with_bom(db: Session, product_id: int):
    from models import ProductBOM
    
    product = get_product_by_id(db, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    
    # Get component BOM entries
    bom_entries = db.query(BillOfMaterials).filter(BillOfMaterials.product_id == product_id).all()
    
    component_bom_details = []
    for bom in bom_entries:
        component = bom.component
        spillage_multiplier = Decimal("1") + component.spillage_coefficient
        quantity_with_spillage = Decimal(str(bom.quantity_required)) * spillage_multiplier
        
        component_bom_details.append(BOMItemDetailResponse(
            id=bom.id,
            component_id=component.id,
            component_name=component.name,
            quantity_required=bom.quantity_required,
            spillage_coefficient=component.spillage_coefficient,
            quantity_with_spillage=quantity_with_spillage
        ))
    
    # Get product BOM entries (nested products)
    product_bom_entries = db.query(ProductBOM).filter(ProductBOM.parent_product_id == product_id).all()
    
    product_bom_details = []
    for pbom in product_bom_entries:
        child_product = pbom.child_product
        product_bom_details.append(ProductBOMItemResponse(
            id=pbom.id,
            child_product_id=child_product.id,
            child_product_name=child_product.name,
            quantity_required=pbom.quantity_required
        ))
    
    return ProductDetailResponse(
        id=product.id,
        name=product.name,
        in_progress=product.in_progress,
        shipped=product.shipped,
        created_at=product.created_at,
        updated_at=product.updated_at,
        component_bom=component_bom_details,
        product_bom=product_bom_details
    )

def create_product(db: Session, product: ProductCreate):
    from models import ProductBOM
    
    # Validate all components exist
    component_ids = [item.component_id for item in product.component_bom]
    
    for component_id in component_ids:
        component = db.query(Component).filter(Component.id == component_id).first()
        if not component:
            raise HTTPException(
                status_code=404,
                detail=f"Component with id {component_id} does not exist"
            )
    
    # Validate all child products exist
    child_product_ids = [item.child_product_id for item in product.product_bom]
    
    for child_id in child_product_ids:
        child = db.query(Product).filter(Product.id == child_id).first()
        if not child:
            raise HTTPException(
                status_code=404,
                detail=f"Product with id {child_id} does not exist"
            )
    
    # Check for duplicate component_ids
    if len(component_ids) != len(set(component_ids)):
        duplicates = [cid for cid in component_ids if component_ids.count(cid) > 1]
        raise HTTPException(
            status_code=400,
            detail=f"Component BOM contains duplicate component_id(s): {list(set(duplicates))}"
        )
    
    # Check for duplicate child_product_ids
    if len(child_product_ids) != len(set(child_product_ids)):
        duplicates = [pid for pid in child_product_ids if child_product_ids.count(pid) > 1]
        raise HTTPException(
            status_code=400,
            detail=f"Product BOM contains duplicate product_id(s): {list(set(duplicates))}"
        )
    
    # Create the product
    new_product = Product(
        name=product.name,
        in_progress=0,
        shipped=0
    )
    
    try:
        db.add(new_product)
        db.flush()
        
        # Create component BOM entries
        for bom_item in product.component_bom:
            bom_entry = BillOfMaterials(
                product_id=new_product.id,
                component_id=bom_item.component_id,
                quantity_required=bom_item.quantity_required
            )
            db.add(bom_entry)
        
        # Create product BOM entries (nested products)
        for pbom_item in product.product_bom:
            # Check for circular reference
            if check_circular_reference(db, new_product.id, pbom_item.child_product_id):
                raise HTTPException(
                    status_code=400,
                    detail=f"Adding product {pbom_item.child_product_id} would create a circular reference"
                )
            
            pbom_entry = ProductBOM(
                parent_product_id=new_product.id,
                child_product_id=pbom_item.child_product_id,
                quantity_required=pbom_item.quantity_required
            )
            db.add(pbom_entry)
        
        db.commit()
        db.refresh(new_product)
        
        return get_product_with_bom(db, new_product.id)
        
    except IntegrityError as e:
        db.rollback()
        
        if "Duplicate entry" in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"Product with name '{product.name}' already exists"
            )
        
        raise HTTPException(status_code=400, detail=f"Database error: {str(e.orig)}")
    
    except HTTPException:
        db.rollback()
        raise
    
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


def update_product_full_bom(db: Session, product_id: int, component_bom: list, product_bom: list):
    from models import ProductBOM
    
    product = get_product_by_id(db, product_id)
    
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    
    # Validate all components exist
    component_ids = [item.component_id for item in component_bom]
    for component_id in component_ids:
        component = db.query(Component).filter(Component.id == component_id).first()
        if not component:
            raise HTTPException(404, f"Component with id {component_id} does not exist")
    
    # Validate all child products exist
    child_product_ids = [item.child_product_id for item in product_bom]
    for child_id in child_product_ids:
        child = db.query(Product).filter(Product.id == child_id).first()
        if not child:
            raise HTTPException(404, f"Product with id {child_id} does not exist")
    
    # Check for duplicates
    if len(component_ids) != len(set(component_ids)):
        duplicates = [cid for cid in component_ids if component_ids.count(cid) > 1]
        raise HTTPException(400, f"Component BOM contains duplicates: {list(set(duplicates))}")
    
    if len(child_product_ids) != len(set(child_product_ids)):
        duplicates = [pid for pid in child_product_ids if child_product_ids.count(pid) > 1]
        raise HTTPException(400, f"Product BOM contains duplicates: {list(set(duplicates))}")
    
    try:
        # Delete existing component BOMs
        db.query(BillOfMaterials).filter(BillOfMaterials.product_id == product_id).delete()
        
        # Delete existing product BOMs
        db.query(ProductBOM).filter(ProductBOM.parent_product_id == product_id).delete()
        
        # Create new component BOMs
        for bom_item in component_bom:
            new_bom = BillOfMaterials(
                product_id=product_id,
                component_id=bom_item.component_id,
                quantity_required=bom_item.quantity_required
            )
            db.add(new_bom)
        
        # Create new product BOMs
        for pbom_item in product_bom:
            if check_circular_reference(db, product_id, pbom_item.child_product_id):
                raise HTTPException(400, f"Adding product {pbom_item.child_product_id} creates circular reference")
            
            new_pbom = ProductBOM(
                parent_product_id=product_id,
                child_product_id=pbom_item.child_product_id,
                quantity_required=pbom_item.quantity_required
            )
            db.add(new_pbom)
        
        db.commit()
        
        return get_product_with_bom(db, product_id)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Unexpected error: {str(e)}")

def calculate_production_capacity(db: Session):
    from models import ProductBOM
    
    def calculate_max_producible_recursive(product_id, depth=0):
        """
        Recursively calculate max producible units for a product,
        considering both component constraints and nested product constraints.
        
        Returns: (max_units, limiting_factor_name)
        """
        if depth > 10:
            return (0, "Nesting too deep")
        
        # Get component BOM entries
        component_boms = db.query(BillOfMaterials).filter(
            BillOfMaterials.product_id == product_id
        ).all()
        
        # Get product BOM entries (nested products)
        product_boms = db.query(ProductBOM).filter(
            ProductBOM.parent_product_id == product_id
        ).all()
        
        # If no BOM at all, can't produce
        if not component_boms and not product_boms:
            return (0, "No BOM defined")
        
        max_quantities = []
        
        # Calculate max from component constraints
        for bom in component_boms:
            component = bom.component
            spillage_multiplier = Decimal("1") + component.spillage_coefficient
            required_per_unit = Decimal(str(bom.quantity_required)) * spillage_multiplier
            
            if required_per_unit > 0:
                max_from_this_component = int(Decimal(str(component.in_stock)) / required_per_unit)
            else:
                max_from_this_component = 0
            
            max_quantities.append({
                "name": component.name,
                "max_units": max_from_this_component
            })
        
        # Calculate max from nested product constraints
        for product_bom in product_boms:
            child_product = product_bom.child_product
            
            # Recursively get max producible for the nested product
            child_max, _ = calculate_max_producible_recursive(
                product_bom.child_product_id,
                depth + 1
            )
            
            # How many parent units can we make based on this child?
            # If we need 2 child products per parent, and we can make 10 children,
            # then we can make 10 / 2 = 5 parents
            if product_bom.quantity_required > 0:
                max_from_this_child = child_max // product_bom.quantity_required
            else:
                max_from_this_child = 0
            
            max_quantities.append({
                "name": f"{child_product.name} (nested product)",
                "max_units": max_from_this_child
            })
        
        # The limiting factor is the minimum
        if max_quantities:
            limiting = min(max_quantities, key=lambda x: x["max_units"])
            return (limiting["max_units"], limiting["name"])
        else:
            return (0, "No constraints found")
    
    # Calculate for all products
    products = get_all_products(db)
    capacity_list = []
    
    for product in products:
        max_producible, limiting_component = calculate_max_producible_recursive(product.id)
        
        capacity_list.append({
            "id": product.id,
            "name": product.name,
            "in_progress": product.in_progress,
            "shipped": product.shipped,
            "max_producible": max_producible,
            "limiting_component": limiting_component
        })
    
    return capacity_list
