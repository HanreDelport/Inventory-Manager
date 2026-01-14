from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from models import Component
from schemas import ComponentCreate, ComponentUpdate

def get_all_components(db: Session):
    return db.query(Component).all()


def get_component_by_id(db: Session, component_id: int):
    return db.query(Component).filter(Component.id == component_id).first()


def create_component(db: Session, component: ComponentCreate):
    # Create new Component model instance
    new_component = Component(
        name=component.name,
        spillage_coefficient=component.spillage_coefficient,
        in_stock=component.in_stock,
        in_progress=0,  # Always start at 0
        shipped=0       # Always start at 0
    )
    
    try:
        db.add(new_component)       # Stage for insert
        db.commit()                 # Write to database
        db.refresh(new_component)   # Get auto-generated values
        return new_component
    except IntegrityError as e:
        db.rollback()  # Undo staged changes
        
        # Check if it's a duplicate name error
        if "Duplicate entry" in str(e.orig) or "UNIQUE constraint" in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"Component with name '{component.name}' already exists"
            )
        
        # Other integrity errors (e.g., check constraints)
        raise HTTPException(status_code=400, detail=f"Database error: {str(e.orig)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def update_component(db: Session, component_id: int, component_update: ComponentUpdate):
    # Find existing component
    existing_component = get_component_by_id(db, component_id)
    
    if not existing_component:
        raise HTTPException(status_code=404, detail=f"Component with id {component_id} not found")
    
    # Update only provided fields (exclude_unset=True ignores None values)
    update_data = component_update.model_dump(exclude_unset=True)
    
    # Apply updates
    for field, value in update_data.items():
        setattr(existing_component, field, value)
    
    try:
        db.commit()
        db.refresh(existing_component)
        return existing_component
    except IntegrityError as e:
        db.rollback()
        
        if "Duplicate entry" in str(e.orig):
            raise HTTPException(
                status_code=409,
                detail=f"Component with name '{component_update.name}' already exists"
            )
        
        raise HTTPException(status_code=400, detail=f"Database error: {str(e.orig)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def delete_component(db: Session, component_id: int):
    component = get_component_by_id(db, component_id)
    
    if not component:
        raise HTTPException(status_code=404, detail=f"Component with id {component_id} not found")
    
    # Check if component is used in any BOMs before attempting delete
    from models import BillOfMaterials
    bom_count = db.query(BillOfMaterials).filter(BillOfMaterials.component_id == component_id).count()
    
    if bom_count > 0:
        # Get product names that use this component
        boms = db.query(BillOfMaterials).filter(BillOfMaterials.component_id == component_id).all()
        product_names = [bom.product.name for bom in boms]
        
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete component '{component.name}' because it is used in {bom_count} product BOM(s): {', '.join(product_names)}"
        )
    
    # Check if component has inventory in progress or shipped
    if component.in_progress > 0 or component.shipped > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete component '{component.name}' because it has inventory in progress ({component.in_progress}) or shipped ({component.shipped}). Only components with zero in_progress and shipped can be deleted."
        )
    
    try:
        db.delete(component)
        db.commit()
        return {"message": f"Component '{component.name}' deleted successfully"}
    except IntegrityError as e:
        db.rollback()
        
        # This is a fallback in case we missed something above
        error_msg = str(e.orig)
        
        if "foreign key constraint" in error_msg.lower() or "cannot delete" in error_msg.lower():
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete component '{component.name}' due to existing references in the database"
            )
        
        raise HTTPException(status_code=400, detail=f"Database error: {error_msg}")
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")



def adjust_component_stock(db: Session, component_id: int, adjustment: int):
    component = get_component_by_id(db, component_id)
    
    if not component:
        raise HTTPException(status_code=404, detail=f"Component with id {component_id} not found")
    
    new_stock = component.in_stock + adjustment
    
    if new_stock < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid adjustment. Current stock: {component.in_stock}, Adjustment: {adjustment}, Result: {new_stock} (cannot be negative)"
        )
    
    component.in_stock = new_stock
    
    try:
        db.commit()
        db.refresh(component)
        return component
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")