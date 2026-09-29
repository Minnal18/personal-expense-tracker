-- ============================================================
--  PERSONAL EXPENSE TRACKER — Full Database Setup
--  Run this entire file in MySQL Workbench once
-- ============================================================

DROP DATABASE IF EXISTS personal_expense_tracker;
CREATE DATABASE personal_expense_tracker;
USE personal_expense_tracker;


-- ============================================================
--  TABLE 1: categories
-- ============================================================
CREATE TABLE categories (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  code  VARCHAR(50)  NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  emoji VARCHAR(10)  NOT NULL,
  color VARCHAR(20)  NOT NULL
);

INSERT INTO categories (code, label, emoji, color) VALUES
  ('food',          'Food & Groceries',    '', '#1D9E75'),
  ('rent',          'Rent / EMI',          '', '#185FA5'),
  ('utils',         'Electricity & Water', '', '#BA7517'),
  ('transport',     'Transport',           '', '#3B6D11'),
  ('health',        'Health & Medicine',   '', '#D85A30'),
  ('entertainment', 'Entertainment',       '', '#7F77DD'),
  ('dining',        'Dining Out',          '', '#D4537E'),
  ('shopping',      'Shopping / Clothes',  '', '#E24B4A'),
  ('subs',          'Subscriptions',       '', '#534AB7'),
  ('education',     'Education',           '', '#0F6E56'),
  ('travel',        'Travel',              '', '#378ADD'),
  ('misc',          'Miscellaneous',       '', '#888780');


-- ============================================================
--  TABLE 2: budget
--  Stores the user's monthly budget per month
--  One row per month — user can set/update it anytime
-- ============================================================
CREATE TABLE budget (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  month_year   VARCHAR(7)     NOT NULL UNIQUE,  -- e.g. '2025-05'
  monthly_limit DECIMAL(10,2) NOT NULL,

  -- Budget must be a positive amount
  CONSTRAINT chk_budget_positive CHECK (monthly_limit > 0),

  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================
--  TABLE 3: expenses
--  Main table — personal expenses
-- ============================================================
CREATE TABLE expenses (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255)   NOT NULL,
  amount        DECIMAL(10,2)  NOT NULL,

  -- Amount must be positive
  CONSTRAINT chk_amount_positive CHECK (amount > 0),

  category_code VARCHAR(50)    NOT NULL,
  is_needed     VARCHAR(10)    NOT NULL DEFAULT 'yes',

  -- Only 3 allowed values
  CONSTRAINT chk_is_needed CHECK (is_needed IN ('yes', 'no', 'maybe')),

  note          VARCHAR(500),
  expense_date  DATE           NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign key to categories — cascade on delete/update
  CONSTRAINT fk_category
    FOREIGN KEY (category_code)
    REFERENCES categories(code)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);


-- ============================================================
--  TABLE 4: monthly_summary
--  Auto-maintained by triggers
-- ============================================================
CREATE TABLE monthly_summary (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  month_year       VARCHAR(7)     NOT NULL UNIQUE,
  total_amount     DECIMAL(10,2)  DEFAULT 0,
  essential_amount DECIMAL(10,2)  DEFAULT 0,
  waste_amount     DECIMAL(10,2)  DEFAULT 0,
  reducible_amount DECIMAL(10,2)  DEFAULT 0,
  last_updated     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);


-- ============================================================
--  TABLE 5: budget_alerts
--  Stores every time the user exceeded their budget
--  so they can look back at their alert history
-- ============================================================
CREATE TABLE budget_alerts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  month_year      VARCHAR(7)     NOT NULL,
  expense_name    VARCHAR(255)   NOT NULL,
  expense_amount  DECIMAL(10,2)  NOT NULL,
  total_after     DECIMAL(10,2)  NOT NULL,   -- total spending after this expense
  budget_limit    DECIMAL(10,2)  NOT NULL,   -- what the budget was at that time
  exceeded_by     DECIMAL(10,2)  NOT NULL,   -- how much over budget
  alert_time      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
--  TABLE 6: expense_audit_log
--  Auto-maintained by triggers
-- ============================================================
CREATE TABLE expense_audit_log (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  expense_id   INT,
  expense_name VARCHAR(255),
  amount       DECIMAL(10,2),
  action       VARCHAR(20),
  action_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note         VARCHAR(500)
);


-- ============================================================
--  TRIGGER 1: after_expense_insert
--  Fires after every new expense is added:
--    1. Updates monthly_summary
--    2. Logs high-value expenses (> ₹5000) to audit log
-- ============================================================
DELIMITER $$

CREATE TRIGGER after_expense_insert
AFTER INSERT ON expenses
FOR EACH ROW
BEGIN
  DECLARE v_month VARCHAR(7);
  SET v_month = DATE_FORMAT(NEW.expense_date, '%Y-%m');

  -- Update or insert monthly summary row
  INSERT INTO monthly_summary (month_year, total_amount, essential_amount, waste_amount, reducible_amount)
  VALUES (
    v_month,
    NEW.amount,
    IF(NEW.is_needed = 'yes',   NEW.amount, 0),
    IF(NEW.is_needed = 'no',    NEW.amount, 0),
    IF(NEW.is_needed = 'maybe', NEW.amount, 0)
  )
  ON DUPLICATE KEY UPDATE
    total_amount     = total_amount     + NEW.amount,
    essential_amount = essential_amount + IF(NEW.is_needed = 'yes',   NEW.amount, 0),
    waste_amount     = waste_amount     + IF(NEW.is_needed = 'no',    NEW.amount, 0),
    reducible_amount = reducible_amount + IF(NEW.is_needed = 'maybe', NEW.amount, 0);

  -- Audit log for high-value expenses
  IF NEW.amount > 5000 THEN
    INSERT INTO expense_audit_log (expense_id, expense_name, amount, action, note)
    VALUES (NEW.id, NEW.name, NEW.amount, 'INSERTED', 'High-value expense flagged automatically');
  END IF;

END$$


-- ============================================================
--  TRIGGER 2: after_expense_delete
--  Fires after every expense deletion:
--    1. Subtracts from monthly_summary
--    2. Logs deletion to audit log
-- ============================================================
CREATE TRIGGER after_expense_delete
AFTER DELETE ON expenses
FOR EACH ROW
BEGIN
  DECLARE v_month VARCHAR(7);
  SET v_month = DATE_FORMAT(OLD.expense_date, '%Y-%m');

  UPDATE monthly_summary
  SET
    total_amount     = total_amount     - OLD.amount,
    essential_amount = essential_amount - IF(OLD.is_needed = 'yes',   OLD.amount, 0),
    waste_amount     = waste_amount     - IF(OLD.is_needed = 'no',    OLD.amount, 0),
    reducible_amount = reducible_amount - IF(OLD.is_needed = 'maybe', OLD.amount, 0)
  WHERE month_year = v_month;

  INSERT INTO expense_audit_log (expense_id, expense_name, amount, action, note)
  VALUES (OLD.id, OLD.name, OLD.amount, 'DELETED', 'Expense removed by user');

END$$

DELIMITER ;


-- ============================================================
--  USEFUL QUERIES TO CHECK YOUR DATA
-- ============================================================

-- See all expenses with category info
-- SELECT e.*, c.label, c.emoji FROM expenses e JOIN categories c ON e.category_code = c.code ORDER BY e.created_at DESC;

-- See current budget for each month
-- SELECT * FROM budget ORDER BY month_year DESC;

-- See monthly summary (auto-updated by triggers)
-- SELECT ms.*, b.monthly_limit, (ms.total_amount / b.monthly_limit * 100) AS pct_used
-- FROM monthly_summary ms LEFT JOIN budget b ON ms.month_year = b.month_year ORDER BY ms.month_year DESC;

-- See budget alert history
-- SELECT * FROM budget_alerts ORDER BY alert_time DESC;

-- See audit log
-- SELECT * FROM expense_audit_log ORDER BY action_time DESC;
