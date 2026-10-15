-- Daily Site Field Report Database Schema (SQLite)

PRAGMA foreign_keys = ON;

-- Master Table: Clients
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Master Table: Projects / Sites
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Master Table: Employees (Crew / Technicians / Supervisors)
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Master Table: Work Categories / Trades
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Main Reports Table
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_number TEXT UNIQUE NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE RESTRICT,
    report_date TEXT NOT NULL,
    prepared_by_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    weather_condition TEXT DEFAULT 'Sunny ☀️',
    temperature TEXT,
    
    -- Section 5: Site Observations & Notes
    progress_notes TEXT,
    challenges_delays TEXT,
    safety_housekeeping TEXT,
    quality_observations TEXT,
    other_remarks TEXT,
    
    -- Section 6: Attachments Checklist (stored as JSON array)
    attachments_json TEXT DEFAULT '[]',
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Section 1: Work Summary
CREATE TABLE IF NOT EXISTS report_work_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    activity_name TEXT NOT NULL,
    location_area TEXT,
    description TEXT,
    crew_json TEXT DEFAULT '[]', -- JSON array of employee names or IDs
    time_hours TEXT DEFAULT 'Full day',
    status TEXT DEFAULT 'Ongoing',
    sort_order INTEGER DEFAULT 0
);

-- Section 2: Manpower Deployment
CREATE TABLE IF NOT EXISTS report_manpower (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    num_persons INTEGER NOT NULL DEFAULT 1,
    trade_task TEXT,
    start_time TEXT DEFAULT '08:00 AM',
    end_time TEXT DEFAULT '05:00 PM',
    remarks TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Section 7: Issues & Action Points
CREATE TABLE IF NOT EXISTS report_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    issue_description TEXT NOT NULL,
    recommended_action TEXT,
    responsible_name TEXT,
    target_date TEXT,
    status TEXT DEFAULT 'Open',
    sort_order INTEGER DEFAULT 0
);

-- Section 8: Sign-Off
CREATE TABLE IF NOT EXISTS report_signoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    role_title TEXT NOT NULL,
    employee_name TEXT,
    signature_text TEXT,
    signed_date TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_project ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_work_summary_report ON report_work_summaries(report_id);
CREATE INDEX IF NOT EXISTS idx_manpower_report ON report_manpower(report_id);
CREATE INDEX IF NOT EXISTS idx_issues_report ON report_issues(report_id);
CREATE INDEX IF NOT EXISTS idx_signoffs_report ON report_signoffs(report_id);
