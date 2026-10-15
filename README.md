# Daily Site Field Report System (Webappz)

A database-backed field reporting web application designed to speed up daily site reports using reusable master data (Clients, Projects/Sites, Employees/Crew, and Trade Categories) with dropdown selectors, quick crew tagging, and print/PDF export.

---

## 🚀 Quick Start

### 1. Run the Application
In your terminal, navigate to this directory and run:
```bash
node server.js
```
*(Or simply double-click `start.bat` on Windows)*

### 2. Open in Your Browser
Visit: **[http://localhost:3000](http://localhost:3000)**

---

## 🌟 Key Features

1. **✨ "Auto-Learn As You Type" (Self-Growing Master Database):**
   - Whenever you enter a new **Client**, **Project/Site**, **Employee / Crew Member**, or **Work Category** directly while filling out a report, the system automatically detects it and permanently saves it into the database.
   - You can also click `[ ➕ Add New... ]` directly in any dropdown (Project, Technician, Crew, or Trade) for instant creation on the spot.
   - The moment you save the report, all new entries are instantly available in all future dropdowns across the application!

2. **Auto-Populating Project & Client Info:**
   - Select an existing project from the dropdown to automatically fill in the client name and site location address.
   - Or choose `➕ Type / Add New Project...` to define a new project and client inline.

3. **Speedy Crew Tagging (No Repetitive Typing):**
   - Click to add crew members from your database to any work activity. Crew members appear as tags `[Name ✕]`.
   - To add a new technician who isn't in the database yet, select `➕ Add New Technician...`, type their name, and they are immediately added to the database and tagged to the task.

4. **⚡ Auto-Generate Manpower Deployment:**
   - One-click **"⚡ Auto-fill from Work Summary"** button computes headcount and copies tasks and shift times directly into Section 2.

5. **Exact Document Layout Matching & PDF Export:**
   - Includes Section 1 (Work Summary), Section 2 (Manpower Deployment), Section 5 (Site Observations & Notes), Section 6 (Attachments Checklist), Section 7 (Issues & Action Points), and Section 8 (Sign-Off).
   - *Sections 3 (Materials) and 4 (Plant & Equipment) were excluded as requested.*
   - Clean, professional print preview and 1-click **"🖨️ Print / Save as PDF"** matching the exact table format of your document.

6. **Built-in Database Master Manager:**
   - Review or edit all your reusable **Clients**, **Projects / Sites**, **Employees & Crew**, and **Work Categories** through the dedicated UI tab.

---

## 🗄️ Database Architecture (SQLite)

The system uses a clean, normalized SQLite database located at `data/reports.db`:

### Master / Reference Tables:
- `clients`: ID, Name, Contact Person, Phone, Email
- `projects`: ID, Client ID (FK), Name, Location, Status
- `employees`: ID, Full Name, Role, Phone, Active Status
- `categories`: ID, Name (Trade/Category), Description

### Transaction / Report Tables:
- `daily_reports`: ID, Report Number (e.g. `DSR-2026-0817`), Project ID (FK), Date, Prepared By (FK), Weather, Temperature, Progress Notes, Challenges, Safety, Quality, Other Remarks, Attachments (JSON).
- `report_work_summaries`: ID, Report ID (FK), Category ID (FK), Activity Name, Location, Description, Crew (JSON array of employee names), Time (Hours), Status.
- `report_manpower`: ID, Report ID (FK), Team Name, Headcount, Trade/Task, Start Time, End Time, Remarks.
- `report_issues`: ID, Report ID (FK), Issue Description, Recommended Action, Responsible Person, Target Date, Status.
- `report_signoffs`: ID, Report ID (FK), Role Title, Employee Name, Digital Signature, Sign Date.

---

## 📁 Project Structure

```text
field-report-app/
├── data/
│   └── reports.db          # SQLite database (auto-created & pre-seeded)
├── public/
│   ├── index.html          # Web UI & Print/PDF report template
│   ├── app.js              # Frontend logic, dynamic rows, API integration
│   └── styles.css          # Modern UI and print styling (@media print)
├── db.js                   # SQLite connection & seed script (Node.js standard library)
├── package.json            # Project definition
├── README.md               # Documentation
├── schema.sql              # SQL DDL schema definitions
├── server.js               # Zero-dependency Node.js REST API server
└── start.bat               # Windows batch launcher
```
