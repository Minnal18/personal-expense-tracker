# 👤 Personal Expense Tracker — Complete Setup Guide

## What is this project?
A full-stack personal expense tracker where you can:
- Add and delete personal expenses
- Set a monthly budget — get popup alerts when you exceed or approach it
- See which expenses are unnecessary (waste detector)
- View auto-updated monthly summaries (powered by DB triggers)
- See audit logs of high-value expenses and deletions
- View charts of your spending by category

---

## Files in this project
```
personal-expense-tracker/
  index.html     ← The app — open this in Chrome (frontend)
  server.js      ← Backend API server (Node.js + Express)
  database.sql   ← Run this once in MySQL Workbench (database)
  package.json   ← Lists Node.js packages needed
  README.md      ← This file — setup instructions
```

---

## What you need to install (do this once ever)

### 1. Node.js
- Go to: https://nodejs.org
- Download the **LTS** version
- Install it (keep clicking Next)
- To verify: open Command Prompt → type `node --version` → should show a number like v20.x.x

### 2. MySQL
- Go to: https://dev.mysql.com/downloads/installer
- Download **MySQL Community Installer**
- During setup:
  - Choose "Developer Default"
  - Set a **root password** — write it down, you will need it!
  - This also installs **MySQL Workbench** (a visual tool to manage DB)
- To verify: open MySQL Workbench → you should see a local connection

### 3. VS Code (code editor)
- Go to: https://code.visualstudio.com
- Download and install
- Open your project folder in VS Code for easy editing

---

## Step 1 — Set up the database

1. Open **MySQL Workbench**
2. Click your local connection (usually says "Local instance MySQL 8.0")
3. Enter your root password when asked
4. Click **File → Open SQL Script**
5. Select the `database.sql` file from this project folder
6. Click the **lightning bolt ⚡ button** (Execute) to run it
7. You should see green checkmarks — database is ready!

**What database.sql creates:**
- Database: `personal_expense_tracker`
- Table: `categories` (12 expense categories)
- Table: `expenses` (your main expense data)
- Table: `budget` (your monthly budget limits)
- Table: `monthly_summary` (auto-updated by triggers)
- Table: `budget_alerts` (logs when you exceed budget)
- Table: `expense_audit_log` (logs high-value and deleted expenses)
- Trigger: `after_expense_insert` (auto-updates summary + logs big expenses)
- Trigger: `after_expense_delete` (auto-updates summary + logs deletions)

---

## Step 2 — Install Node packages

1. Open **Command Prompt** (Windows) or **Terminal** (Mac/Linux)
2. Navigate to your project folder:
   ```
   cd C:\Users\YourName\personal-expense-tracker
   ```
   (change the path to wherever you saved the folder)
3. Run this command:
   ```
   npm install
   ```
4. Wait for it to finish — it will create a `node_modules` folder
5. This installs: **express**, **mysql2**, and **cors**

---

## Step 3 — Add your MySQL password to server.js

1. Open `server.js` in VS Code
2. Find this section near the top:
   ```javascript
   const db = mysql.createConnection({
     host:     'localhost',
     user:     'root',
     password: 'YOUR_PASSWORD',   // ← Change this
     database: 'personal_expense_tracker'
   });
   ```
3. Replace `root` with your actual MySQL root password
4. Save the file (Ctrl+S)

---

## Step 4 — Start the backend server

In Command Prompt (inside your project folder), run:
```
node server.js
```

You should see:
```
✅ Connected to MySQL — Personal Expense Tracker
🚀 Server running at http://localhost:3000
```

**Important: Keep this Command Prompt window open while using the app.**
If you close it, the app stops working.

---

## Step 5 — Open the app

Double-click `index.html` to open it in Chrome.

The app will load categories from your database and you are ready to go!

---

## How to use the app

### Setting your budget
- Click the **⚙ Set Budget** button at the top
- Enter your monthly spending limit (e.g. 30000 for ₹30,000)
- Click Save Budget

### Adding expenses
1. Go to **Add Expense** tab
2. Fill in name, amount, date, category
3. Select whether it is necessary, unnecessary, or reducible
4. Click **+ Add Expense**

### Budget alerts
- If your total spending goes **above** your budget → a red popup appears showing how much you exceeded
- If your spending reaches **80% or more** of budget → an orange warning popup appears
- These alerts are also saved to the `budget_alerts` table in MySQL

### Waste Detector tab
- Shows all expenses you marked as unnecessary or reducible
- Shows how much you would save per year if you cut them
- Shows personalised tips based on your actual spending categories

### Monthly Summary tab
- Auto-updated by database triggers — no manual calculation
- Shows total, essential, waste amounts per month
- Shows your budget for each month and percentage used

### Audit Log tab
- Any expense above ₹5,000 is automatically logged here by a DB trigger
- Every deleted expense is also logged here automatically

---

## Database design summary

| Feature | Where it is used |
|---|---|
| Tables with relationships | expenses → categories (foreign key) |
| CHECK constraints | amount > 0, is_needed only 3 values, budget > 0 |
| ON DELETE CASCADE | Delete category → its expenses auto-deleted |
| ON UPDATE CASCADE | Update category code → expenses auto-updated |
| TRIGGER after INSERT | Updates monthly_summary, logs high-value expenses |
| TRIGGER after DELETE | Updates monthly_summary, logs deletion |
| Budget alert logic | Handled in server.js after expense insert |
| JOIN queries | expenses joined with categories for display |
| Aggregate SQL | SUM, CASE WHEN used in summary queries |

---

## API routes in server.js

| Method | Route | What it does |
|---|---|---|
| GET | /categories | Get all expense categories |
| GET | /expenses | Get all expenses (optional ?month=2025-05) |
| POST | /expenses | Add new expense + check budget |
| DELETE | /expenses/:id | Delete one expense |
| GET | /budget/:month | Get budget for a specific month |
| POST | /budget | Set or update monthly budget |
| GET | /summary | Get monthly summary with budget info |
| GET | /waste | Get only unnecessary/reducible expenses |
| GET | /audit | Get audit log |
| GET | /alerts | Get budget alert history |

---

## Common errors and how to fix them

**"Cannot connect to server" in the app**
→ Make sure `node server.js` is running in Command Prompt
→ Do not close that Command Prompt window

**"ER_ACCESS_DENIED_ERROR" in Command Prompt**
→ Wrong MySQL password in server.js
→ Open server.js, check the password field, save and restart

**"Cannot find module 'express'"**
→ You did not run npm install
→ Run `npm install` in your project folder

**"ER_NO_SUCH_TABLE" or database not found**
→ You did not run database.sql yet
→ Open MySQL Workbench, open database.sql, run it with ⚡

**Page loads but categories dropdown is empty**
→ Server is not running or database.sql was not run
→ Check both

---

## How to stop and restart the server

- To stop: press **Ctrl+C** in the Command Prompt running the server
- To restart: run `node server.js` again

---

## Folder structure after setup
```
personal-expense-tracker/
  node_modules/      ← Created by npm install (do not edit)
  index.html         ← Frontend
  server.js          ← Backend
  database.sql       ← Database setup
  package.json       ← Project config
  package-lock.json  ← Created by npm install (do not edit)
  README.md          ← This file
```
