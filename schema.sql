-- Disable FK checks for clean reset
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_allocations;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS bill_of_materials;
DROP TABLE IF EXISTS product_bom;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS components;

SET FOREIGN_KEY_CHECKS = 1;


-- Components Table
CREATE TABLE components (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    spillage_coefficient DECIMAL(5,4) DEFAULT 0.0000,
    in_stock INT DEFAULT 0,
    in_progress INT DEFAULT 0,
    shipped INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (spillage_coefficient >= 0 AND spillage_coefficient <= 9.9999),
    CHECK (in_stock >= 0 AND in_progress >= 0 AND shipped >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products Table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    in_progress INT DEFAULT 0,
    shipped INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (in_progress >= 0 AND shipped >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Product_bom table for nested products
CREATE TABLE product_bom (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_product_id INT NOT NULL,
    child_product_id INT NOT NULL,
    quantity_required INT NOT NULL,
    UNIQUE KEY unique_parent_child (parent_product_id, child_product_id),
    FOREIGN KEY (parent_product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (child_product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CHECK (quantity_required > 0),
    CHECK (parent_product_id != child_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bill of Materials Table
CREATE TABLE bill_of_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    component_id INT NOT NULL,
    quantity_required INT NOT NULL,
    UNIQUE KEY unique_product_component (product_id, component_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE RESTRICT,
    CHECK (quantity_required > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders Table
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order Allocations Table
CREATE TABLE order_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    component_id INT NOT NULL,
    quantity_allocated INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES components(id),
    CHECK (quantity_allocated > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Data: Components
INSERT INTO components (name, spillage_coefficient, in_stock) VALUES
('Wheels', 0.1000, 5000),           -- 10% spillage, 5000 in stock
('Body Panel', 0.0500, 1000),       -- 5% spillage, 1000 in stock
('Axle', 0.0200, 2000),             -- 2% spillage, 2000 in stock
('Windshield', 0.1500, 800);        -- 15% spillage, 800 in stock

-- Seed Data: Products
INSERT INTO products (name) VALUES
('Toy Car'),
('Toy Truck');

-- Seed Data: Bill of Materials
-- Toy Car BOM
INSERT INTO bill_of_materials (product_id, component_id, quantity_required) VALUES
(1, 1, 4),   -- Toy Car needs 4 Wheels
(1, 2, 1),   -- Toy Car needs 1 Body Panel
(1, 3, 2),   -- Toy Car needs 2 Axles
(1, 4, 1);   -- Toy Car needs 1 Windshield

-- Toy Truck BOM
INSERT INTO bill_of_materials (product_id, component_id, quantity_required) VALUES
(2, 1, 6),   -- Toy Truck needs 6 Wheels
(2, 2, 2),   -- Toy Truck needs 2 Body Panels
(2, 3, 3);   -- Toy Truck needs 3 Axles (no windshield)