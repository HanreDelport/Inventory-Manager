from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, get_db, Base
import models
from typing import List
from schemas import (ComponentResponse, ComponentCreate, ComponentUpdate,
    ProductResponse, ProductCreate, ProductUpdate, ProductDetailResponse,
    ProductCapacityResponse,HealthResponse, BOMItemCreate, OrderResponse, OrderCreate, 
    OrderDetailResponse, OrderSummaryResponse,ProcurementResponse, OrderRequirementsResponse,
    ProductBOMItemCreate  
)
import crud_components
import crud_products
import crud_orders
import crud_procurement

# Create FastAPI app
app = FastAPI(
    title="Stock Management System API",
    description="Production-ready API for managing components, products, and orders",
    version="1.0.0"
)

# CORS middleware (allows frontend to call backend)
# Replace the CORS middleware section with:
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*" 
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables (in production, use Alembic migrations instead)
# Base.metadata.create_all(bind=engine)  # Commented out - we use schema.sql

@app.get("/")
def read_root():
    return {
        "message": "Stock Management System API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        
        # Count tables
        component_count = db.query(models.Component).count()
        product_count = db.query(models.Product).count()
        
        return HealthResponse(
            status="healthy",
            database="connected",
            message=f"Database connected. Found {component_count} components and {product_count} products."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# ===COMPONENTS ENDPOINTS===
@app.get("/components", response_model=List[ComponentResponse])
def get_components(db: Session = Depends(get_db)):
    return crud_components.get_all_components(db)


@app.get("/components/{component_id}", response_model=ComponentResponse)
def get_component(component_id: int, db: Session = Depends(get_db)):
    component = crud_components.get_component_by_id(db, component_id)
    
    if not component:
        raise HTTPException(status_code=404, detail=f"Component with id {component_id} not found")
    
    return component


@app.post("/components", response_model=ComponentResponse, status_code=201)
def create_component(component: ComponentCreate, db: Session = Depends(get_db)):
    return crud_components.create_component(db, component)


@app.put("/components/{component_id}", response_model=ComponentResponse)
def update_component(component_id: int, component: ComponentUpdate, db: Session = Depends(get_db)):
    return crud_components.update_component(db, component_id, component)


@app.delete("/components/{component_id}")
def delete_component(component_id: int, db: Session = Depends(get_db)):
    return crud_components.delete_component(db, component_id)


@app.patch("/components/{component_id}/adjust-stock")
def adjust_stock(component_id: int, adjustment: int, db: Session = Depends(get_db)):
    return crud_components.adjust_component_stock(db, component_id, adjustment)

# ===== PRODUCT ENDPOINTS =====

@app.get("/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    """
    Get all products (without BOM details).
    
    Returns:
        List of products with basic info
    """
    return crud_products.get_all_products(db)


@app.get("/products/{product_id}", response_model=ProductDetailResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """
    Get a single product with complete BOM details.
    
    Returns:
        Product with BOM entries including component names, spillage, and calculated quantities
    """
    return crud_products.get_product_with_bom(db, product_id)


@app.post("/products", response_model=ProductDetailResponse, status_code=201)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """
    Create a new product with its Bill of Materials.
    
    The BOM must include at least one component.
    All component_ids must exist in the components table.
    No duplicate component_ids allowed in the BOM.
    
    Example request body:
    {
      "name": "Toy Car",
      "bom": [
        {"component_id": 1, "quantity_required": 4},
        {"component_id": 2, "quantity_required": 1}
      ]
    }
    """
    return crud_products.create_product(db, product)


@app.put("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: int, product: ProductUpdate, db: Session = Depends(get_db)):
    """
    Update a product's name.
    
    To update the BOM, use PUT /products/{product_id}/bom
    """
    return crud_products.update_product(db, product_id, product)


@app.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """
    Delete a product and its BOM.
    
    Cannot delete if:
    - Product has inventory in_progress or shipped
    - Product has orders in the system
    """
    return crud_products.delete_product(db, product_id)


@app.put("/products/{product_id}/bom", response_model=ProductDetailResponse)
def update_product_full_bom(
    product_id: int,
    component_bom: List[BOMItemCreate],
    product_bom: List[ProductBOMItemCreate],
    db: Session = Depends(get_db)
):
    """
    Replace a product's complete BOM (both components and nested products).
    
    This deletes all existing BOM entries and creates new ones.
    """
    return crud_products.update_product_full_bom(db, product_id, component_bom, product_bom)


@app.get("/products/capacity/calculate", response_model=List[ProductCapacityResponse])
def calculate_capacity(db: Session = Depends(get_db)):
    """
    Calculate production capacity for all products.
    
    Returns how many units of each product can be manufactured
    with current component inventory, considering spillage.
    
    Also shows which component is the limiting factor for each product.
    """
    return crud_products.calculate_production_capacity(db)



# ===== ORDER ENDPOINTS =====

@app.get("/orders", response_model=OrderSummaryResponse)
def get_orders(db: Session = Depends(get_db)):
    """
    Get all orders with summary statistics.
    
    Returns:
        Summary with counts by status and list of all orders
    """
    return crud_orders.get_order_summary(db)


@app.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """
    Get a single order with full allocation details.
    
    Shows which components were allocated and in what quantities.
    """
    return crud_orders.get_order_with_details(db, order_id)


@app.post("/orders", response_model=OrderDetailResponse, status_code=201)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """
    Create a new order with automatic inventory allocation.
    
    This will:
    1. Calculate required components from product BOM
    2. Apply spillage to each component
    3. Check if sufficient inventory exists
    4. Allocate components (in_stock → in_progress)
    5. Update product inventory (in_progress++)
    6. Create allocation records
    
    The entire operation is atomic - either all steps succeed or none do.
    
    Example request:
    {
      "product_id": 1,
      "quantity": 100
    }
    
    Raises:
        404: Product not found or has no BOM
        400: Insufficient inventory
    """
    return crud_orders.create_order(db, order)


@app.post("/orders/{order_id}/complete", response_model=OrderDetailResponse)
def complete_order(order_id: int, db: Session = Depends(get_db)):
    """
    Mark an order as completed.
    
    This moves inventory from in_progress → shipped for:
    - All allocated components
    - The product
    
    Raises:
        404: Order not found
        400: Order already completed
    """
    return crud_orders.complete_order(db, order_id)

@app.post("/orders/{order_id}/allocate", response_model=OrderDetailResponse)
def allocate_order(order_id: int, db: Session = Depends(get_db)):
    """
    Allocate inventory to a pending order (after components arrive).
    
    Checks if sufficient inventory now exists and allocates if so.
    """
    return crud_orders.allocate_pending_order(db, order_id)

@app.get("/orders/{order_id}/requirements", response_model=OrderRequirementsResponse)
def get_order_requirements(order_id: int, db: Session = Depends(get_db)):
    """
    Get component requirements for an order (for allocation preview).
    
    Shows what's needed, available, and short for each component.
    """
    return crud_orders.get_order_requirements(db, order_id)

# ==== PROCUREMENT ENDPOINTS ====

@app.get("/procurement/needs", response_model=ProcurementResponse)
def get_procurement_needs(db: Session = Depends(get_db)):
    """
    Calculate what components need to be ordered to fulfill all in_progress orders.
    
    Returns list of components with shortages and how much to order.
    """
    return crud_procurement.calculate_procurement_needs(db)



if __name__ == "__main__":
    import uvicorn
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    
    #Use uvicorn main:app --workers 4 --host 0.0.0.0 in prod
    uvicorn.run("main:app", host=host, port=port, reload=True)
