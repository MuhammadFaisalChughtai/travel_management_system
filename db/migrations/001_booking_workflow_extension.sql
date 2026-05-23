-- ============================================================
-- Migration: Advanced Booking Management Module Extensions
-- Run this against your MySQL database BEFORE restarting the backend
-- ============================================================

-- 1. Extend bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS workflow_status   VARCHAR(50)    DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS supplier_cost     DECIMAL(10,2)  DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS gross_profit      DECIMAL(10,2)  DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS net_profit        DECIMAL(10,2)  DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2)  DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS payment_due_date  DATE           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at      TIMESTAMP      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refunded_at       TIMESTAMP      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMP      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notes             TEXT           DEFAULT NULL;

ALTER TABLE bookings ADD INDEX idx_workflow_status (workflow_status);
ALTER TABLE bookings ADD INDEX idx_payment_due_date (payment_due_date);

-- 2. Extend customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS nationality       VARCHAR(100)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gender            VARCHAR(20)    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255)   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emergency_phone   VARCHAR(50)    DEFAULT NULL;

ALTER TABLE customers ADD INDEX IF NOT EXISTS idx_passport_number (passport_number);

-- 3. Create booking_status_histories table
CREATE TABLE IF NOT EXISTS booking_status_histories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT NOT NULL,
  booking_id  INT NOT NULL,
  from_status VARCHAR(50)  DEFAULT NULL,
  to_status   VARCHAR(50)  NOT NULL,
  changed_by  VARCHAR(255) DEFAULT NULL,
  reason      TEXT         DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX bsh_booking_id (booking_id),
  INDEX bsh_tenant_id  (tenant_id),
  CONSTRAINT bsh_tenant_fk  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
  CONSTRAINT bsh_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 4. Create booking_activity_logs table
CREATE TABLE IF NOT EXISTS booking_activity_logs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id    INT          NOT NULL,
  booking_id   INT          NOT NULL,
  action       VARCHAR(100) NOT NULL,
  description  TEXT         DEFAULT NULL,
  performed_by VARCHAR(255) DEFAULT NULL,
  metadata     JSON         DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX bal_booking_id (booking_id),
  INDEX bal_tenant_id  (tenant_id),
  CONSTRAINT bal_tenant_fk  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
  CONSTRAINT bal_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 5. Create booking_financial_summaries table
CREATE TABLE IF NOT EXISTS booking_financial_summaries (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id           INT           NOT NULL,
  booking_id          INT           NOT NULL UNIQUE,
  total_revenue       DECIMAL(12,2) DEFAULT 0.00,
  total_paid          DECIMAL(12,2) DEFAULT 0.00,
  total_supplier_cost DECIMAL(12,2) DEFAULT 0.00,
  gross_profit        DECIMAL(12,2) DEFAULT 0.00,
  net_profit          DECIMAL(12,2) DEFAULT 0.00,
  commission_amount   DECIMAL(12,2) DEFAULT 0.00,
  refund_total        DECIMAL(12,2) DEFAULT 0.00,
  profit_margin_pct   DECIMAL(6,2)  DEFAULT 0.00,
  currency            VARCHAR(10)   DEFAULT 'GBP',
  recalculated_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX bfs_tenant_id (tenant_id),
  CONSTRAINT bfs_tenant_fk  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
  CONSTRAINT bfs_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 6. Create refund_transactions table
CREATE TABLE IF NOT EXISTS refund_transactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT           NOT NULL,
  booking_id    INT           NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  currency      VARCHAR(10)   DEFAULT 'GBP',
  reason        TEXT          DEFAULT NULL,
  refund_method VARCHAR(100)  DEFAULT NULL,
  processed_by  VARCHAR(255)  DEFAULT NULL,
  processed_at  DATE          DEFAULT NULL,
  status        VARCHAR(50)   DEFAULT 'pending',
  notes         TEXT          DEFAULT NULL,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX rt_booking_id (booking_id),
  INDEX rt_tenant_id  (tenant_id),
  CONSTRAINT rt_tenant_fk  FOREIGN KEY (tenant_id)  REFERENCES tenants(id)  ON DELETE CASCADE,
  CONSTRAINT rt_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- 7. Create passenger_documents table
CREATE TABLE IF NOT EXISTS passenger_documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id       INT          NOT NULL,
  booking_id      INT          NOT NULL,
  customer_id     INT          NOT NULL,
  document_type   VARCHAR(100) NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  file_path       VARCHAR(500) DEFAULT NULL,
  file_size       INT          DEFAULT NULL,
  mime_type       VARCHAR(100) DEFAULT NULL,
  expiry_date     DATE         DEFAULT NULL,
  document_number VARCHAR(100) DEFAULT NULL,
  notes           TEXT         DEFAULT NULL,
  uploaded_by     VARCHAR(255) DEFAULT NULL,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX pd_booking_id  (booking_id),
  INDEX pd_customer_id (customer_id),
  INDEX pd_tenant_id   (tenant_id),
  CONSTRAINT pd_tenant_fk   FOREIGN KEY (tenant_id)   REFERENCES tenants(id)    ON DELETE CASCADE,
  CONSTRAINT pd_booking_fk  FOREIGN KEY (booking_id)  REFERENCES bookings(id)   ON DELETE CASCADE,
  CONSTRAINT pd_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE CASCADE
);

-- 8. Create passenger_alerts table
CREATE TABLE IF NOT EXISTS passenger_alerts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT       NOT NULL,
  booking_id  INT       NOT NULL,
  customer_id INT       NOT NULL,
  alert_type  VARCHAR(100) NOT NULL,
  severity    VARCHAR(50)  DEFAULT 'warning',
  message     TEXT         NOT NULL,
  resolved    TINYINT(1)   DEFAULT 0,
  resolved_at TIMESTAMP    DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX pa_booking_id (booking_id),
  INDEX pa_tenant_id  (tenant_id),
  CONSTRAINT pa_tenant_fk   FOREIGN KEY (tenant_id)   REFERENCES tenants(id)    ON DELETE CASCADE,
  CONSTRAINT pa_booking_fk  FOREIGN KEY (booking_id)  REFERENCES bookings(id)   ON DELETE CASCADE,
  CONSTRAINT pa_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE CASCADE
);
