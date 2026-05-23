-- Comprehensive Database Schema for Terrific Travel Booking System
-- Database Engine: MySQL / MariaDB (Adminer Compatible)
-- Features: SaaS Billing, Multi-Tenancy, 20+ Modules, RBAC Permissions Matrix, Explicit Foreign Keys, Performance Indexes
-- Generated: 2026-03-30
-- Framework compatibility: Ruby on Rails (Active Admin defaults) - plural snake_case with created_at/updated_at

-- ========================================================
-- 0. SAAS PLATFORM & MULTI-TENANCY
-- ========================================================
CREATE TABLE platform_admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    encrypted_password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- e.g., 'Starter', 'Pro', 'Enterprise'
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    billing_interval VARCHAR(50) DEFAULT 'month', -- 'month' or 'year'
    max_users INT, -- NULL for unlimited
    features JSON, -- JSON config for toggleable modules
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    trial_ends_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE tenant_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    plan_id INT NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'trialing', 'active', 'past_due', 'canceled'
    stripe_subscription_id VARCHAR(255),
    current_period_start DATETIME,
    current_period_end DATETIME,
    canceled_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
);

CREATE TABLE tenant_invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    subscription_id INT,
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'paid', 'void', 'uncollectible'
    stripe_invoice_id VARCHAR(255),
    hosted_invoice_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (subscription_id) REFERENCES tenant_subscriptions(id) ON DELETE SET NULL
);

-- ========================================================
-- 1. IDENTITIES, ROLES & PERMISSIONS (RBAC)
-- ========================================================
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL, -- e.g., 'Super Admin', 'Company Admin', 'HR', 'Accounts', 'Agent'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY role_tenant_unique (tenant_id, name)
);

CREATE TABLE permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- e.g., 'create_booking', 'delete_user'
    module VARCHAR(255) NOT NULL, -- e.g., 'bookings', 'users', 'hr'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    encrypted_password VARCHAR(255) NOT NULL,
    reset_password_token VARCHAR(255) UNIQUE,
    reset_password_sent_at DATETIME,
    remember_created_at DATETIME,
    admin_user_name VARCHAR(255),
    role_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL,
    UNIQUE KEY admin_user_tenant_email_unique (tenant_id, email)
);

CREATE TABLE agents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50),
    gds_system VARCHAR(100),
    client_id VARCHAR(100),
    pcc VARCHAR(50),
    sign_in_count INT DEFAULT 0,
    current_sign_in_at TIMESTAMP NULL,
    last_sign_in_at TIMESTAMP NULL,
    current_sign_in_ip VARCHAR(45),
    last_sign_in_ip VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    UNIQUE KEY agent_tenant_email_unique (tenant_id, email)
);

-- ========================================================
-- 2. CORE ENTITIES
-- ========================================================
CREATE TABLE vendors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    title VARCHAR(10),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    age_category VARCHAR(50), -- Adult, Child, Infant
    email VARCHAR(255),
    phone_number VARCHAR(50),
    passport_number VARCHAR(255),
    passport_expiry_date DATE,
    agent_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- ========================================================
-- 3. BOOKINGS & PASSENGERS
-- ========================================================
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_reference VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    departure_date DATE,
    agent_id INT,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    card_payment_charges DECIMAL(10,2) DEFAULT 0.00,
    cancellation_charges DECIMAL(10,2) DEFAULT 0.00,
    remaining_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'confirmed',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    locked_status VARCHAR(50) DEFAULT 'unlocked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    UNIQUE KEY booking_tenant_reference_unique (tenant_id, booking_reference)
);

CREATE TABLE booking_customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    customer_id INT NOT NULL,
    role VARCHAR(50), -- e.g., 'Leader', 'Family Member'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE KEY booking_customer_unique (booking_id, customer_id)
);

-- ========================================================
-- 4. FINANCIAL TRANSACTIONS
-- ========================================================
CREATE TABLE booking_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(100), -- e.g. bank_transfer
    transaction_type VARCHAR(100), -- e.g. instalment
    paid_on DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE vendor_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    vendor_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    paid_on DATE,
    flight_pnr VARCHAR(100),
    issue_date DATE,
    reservation_number VARCHAR(100),
    notes TEXT,
    total_paid DECIMAL(10,2) DEFAULT 0.00,
    total_refunded DECIMAL(10,2) DEFAULT 0.00,
    remaining_due DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE TABLE invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(10),
    paid_amount DECIMAL(10,2) DEFAULT 0.00,
    remaining_amount DECIMAL(10,2) DEFAULT 0.00,
    issued_at DATETIME,
    status VARCHAR(50) DEFAULT 'unpaid',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ========================================================
-- 5. SERVICES (FLIGHT, HOTEL, VISA, TRANSPORT)
-- ========================================================
CREATE TABLE accommodation_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    vendor_id INT NOT NULL,
    hotel_name VARCHAR(255) NOT NULL,
    room_type VARCHAR(100),
    check_in_date DATE,
    check_out_date DATE,
    meal_type VARCHAR(100),
    reservation_number VARCHAR(100),
    qty INT DEFAULT 1,
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(10),
    other_currency VARCHAR(10),
    conversion_rate DECIMAL(10,4),
    issue_date DATE,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    hotel_confirmation_number VARCHAR(100),
    hotel_address TEXT,
    last_cancellation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE TABLE flight_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    vendor_id INT NOT NULL,
    customer_id INT NULL,
    date DATE,
    flight_no VARCHAR(100) NOT NULL,
    pnr VARCHAR(50),
    departed_from VARCHAR(255),
    arrived_at VARCHAR(255),
    depart_time VARCHAR(50),
    arrival_time VARCHAR(50),
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(10),
    issue_date DATE,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    baggage VARCHAR(50),
    carry_on_baggage VARCHAR(50),
    checked_baggage VARCHAR(50),
    flight_class VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE transport_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    vendor_id INT NOT NULL,
    vehicle_type VARCHAR(100),
    departure_destination VARCHAR(255),
    arrival_destination VARCHAR(255),
    date DATE,
    departure_time VARCHAR(50),
    arrival_time VARCHAR(50),
    flight_no VARCHAR(100),
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(10),
    other_currency VARCHAR(10),
    conversion_rate DECIMAL(10,4),
    issue_date DATE,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE TABLE visa_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    booking_id INT NOT NULL,
    vendor_id INT NOT NULL,
    passport_number VARCHAR(100),
    visa_type VARCHAR(100),
    visa_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    price DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(10),
    other_currency VARCHAR(10),
    conversion_rate DECIMAL(10,4),
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    fine_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

-- ========================================================
-- 6. COMPANY ACCOUNTS & AGENT MANAGEMENT (MORE MODULES)
-- ========================================================
CREATE TABLE expense_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    expense_report_id INT, -- if needed for expense_reports group
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100), -- 'salaries', 'rent', 'misc', 'utilities', 'travel', 'tax'
    payment DECIMAL(10,2) NOT NULL, -- Active Admin sorts explicitly by 'payment_desc'
    status VARCHAR(50) DEFAULT 'unpaid',
    payment_method VARCHAR(50), -- 'cash', 'bank_transfer', 'cheque'
    date DATE NOT NULL,
    created_by_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_id) REFERENCES admin_users(id) ON DELETE SET NULL,
    FOREIGN KEY (expense_report_id) REFERENCES expense_reports(id) ON DELETE SET NULL
);


CREATE TABLE agent_margins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    agent_id INT NOT NULL,
    booking_id INT NOT NULL,
    total_paid DECIMAL(10,2) DEFAULT 0.00,
    total_vendor_cost DECIMAL(10,2) DEFAULT 0.00,
    margin_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'due', -- 'paid', 'due', 'no_commission'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE agent_attendances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    agent_id INT NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(50), -- e.g., 'present', 'absent', 'leave'
    notes TEXT,
    check_in_time DATETIME,
    check_out_time DATETIME,
    total_working_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- ========================================================
-- 7. MISCELLANEOUS SUPPORTING MODULES
-- ========================================================
CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    commentable_type VARCHAR(255) NOT NULL, -- Polmorphic (e.g. Booking, Customer)
    commentable_id INT NOT NULL,
    author_id INT,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

CREATE TABLE tracking_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    agent_id INT, -- Associates tracking to Agent models
    name TEXT, -- Event name or page URL visited
    action_name VARCHAR(255), -- Action (e.g., index, check_in, show)
    ip_address VARCHAR(45),
    browser VARCHAR(255),
    os VARCHAR(255),
    device_type VARCHAR(255),
    visitor_token VARCHAR(255),
    time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE TABLE quotations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    customer_id INT, -- Optional if customer isn't created yet
    agent_id INT,
    total_price DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

CREATE TABLE daily_quotes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    reference VARCHAR(255),
    quote_content LONGTEXT, -- Stores rich text or maps to ActionText
    status TINYINT DEFAULT 1, -- e.g., 0 for Inactive, 1 for Active (Enum)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE vendor_clearances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    vendor_id INT NOT NULL,
    clearance_date DATE NOT NULL,
    total_cleared DECIMAL(10,2),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- ========================================================
-- 8. INDEXING & QUERY OPTIMIZATION
-- ========================================================
CREATE INDEX idx_booking_reference ON bookings(tenant_id, booking_reference);
CREATE INDEX idx_customers_email ON customers(tenant_id, email);
CREATE INDEX idx_admin_users_email ON admin_users(tenant_id, email);
CREATE INDEX idx_flight_pnr ON flight_services(tenant_id, pnr);
CREATE INDEX idx_tracking_visitor ON tracking_events(tenant_id, visitor_token);
CREATE INDEX idx_comments_commentable ON comments(tenant_id, commentable_type, commentable_id);
