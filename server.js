const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { db, initDb } = require('./db.js');

// Ensure DB is initialized
initDb();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// -------------------------------------------------------------
// AUTO-LEARN MASTER DATA HELPERS
// Automatically finds or creates entities so new entries are
// stored permanently in the database for future dropdowns.
// -------------------------------------------------------------
function getOrCreateClient(clientName, addedList = []) {
  if (!clientName || !clientName.trim()) return null;
  const name = clientName.trim();
  const existing = db.prepare('SELECT id FROM clients WHERE LOWER(TRIM(name)) = LOWER(?)').get(name);
  if (existing) return existing.id;

  const result = db.prepare('INSERT INTO clients (name) VALUES (?)').run(name);
  const newId = Number(result.lastInsertRowid);
  addedList.push({ type: 'client', id: newId, name });
  return newId;
}

function getOrCreateProject(projectName, clientName, location, addedList = []) {
  if (!projectName || !projectName.trim()) return null;
  const name = projectName.trim();
  const existing = db.prepare('SELECT id FROM projects WHERE LOWER(TRIM(name)) = LOWER(?)').get(name);
  if (existing) return existing.id;

  let clientId = null;
  if (clientName && clientName.trim()) {
    clientId = getOrCreateClient(clientName, addedList);
  }

  const loc = (location && location.trim()) ? location.trim() : 'Site Location';
  const result = db.prepare('INSERT INTO projects (client_id, name, location, status) VALUES (?, ?, ?, ?)').run(
    clientId,
    name,
    loc,
    'Active'
  );
  const newId = Number(result.lastInsertRowid);
  addedList.push({ type: 'project', id: newId, name, location: loc });
  return newId;
}

function getOrCreateEmployee(fullName, role = 'Field Technician', addedList = []) {
  if (!fullName || !fullName.trim()) return null;
  const name = fullName.trim();
  const existing = db.prepare('SELECT id FROM employees WHERE LOWER(TRIM(full_name)) = LOWER(?)').get(name);
  if (existing) return existing.id;

  const result = db.prepare('INSERT INTO employees (full_name, role, is_active) VALUES (?, ?, 1)').run(name, role || 'Field Technician');
  const newId = Number(result.lastInsertRowid);
  addedList.push({ type: 'employee', id: newId, name, role });
  return newId;
}

function getOrCreateCategory(categoryName, addedList = []) {
  if (!categoryName || !categoryName.trim()) return null;
  const name = categoryName.trim();
  const existing = db.prepare('SELECT id FROM categories WHERE LOWER(TRIM(name)) = LOWER(?)').get(name);
  if (existing) return existing.id;

  const result = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, 'Added from site report');
  const newId = Number(result.lastInsertRowid);
  addedList.push({ type: 'category', id: newId, name });
  return newId;
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // -------------------------------------------------------------
    // MASTER DATA API ROUTES
    // -------------------------------------------------------------
    if (req.method === 'GET' && pathname === '/api/meta') {
      const clients = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
      const projects = db.prepare(`
        SELECT p.*, c.name as client_name 
        FROM projects p 
        LEFT JOIN clients c ON p.client_id = c.id 
        ORDER BY p.name ASC
      `).all();
      const employees = db.prepare('SELECT * FROM employees WHERE is_active = 1 ORDER BY full_name ASC').all();
      const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();

      return sendJson(res, 200, {
        clients,
        projects,
        employees,
        categories
      });
    }

    // Clients
    if (pathname === '/api/clients') {
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
        return sendJson(res, 200, rows);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendJson(res, 400, { error: 'Client name is required' });
        const name = body.name.trim();
        const existing = db.prepare('SELECT * FROM clients WHERE LOWER(TRIM(name)) = LOWER(?)').get(name);
        if (existing) {
          return sendJson(res, 200, existing);
        }
        const stmt = db.prepare('INSERT INTO clients (name, contact_person, phone, email) VALUES (?, ?, ?, ?)');
        const result = stmt.run(name, body.contact_person || '', body.phone || '', body.email || '');
        return sendJson(res, 201, { id: Number(result.lastInsertRowid), name, ...body });
      }
    }

    // Projects
    if (pathname === '/api/projects') {
      if (req.method === 'GET') {
        const rows = db.prepare(`
          SELECT p.*, c.name as client_name 
          FROM projects p 
          LEFT JOIN clients c ON p.client_id = c.id 
          ORDER BY p.name ASC
        `).all();
        return sendJson(res, 200, rows);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendJson(res, 400, { error: 'Project name is required' });
        let clientId = body.client_id;
        if (!clientId && body.client_name) {
          clientId = getOrCreateClient(body.client_name);
        }
        const stmt = db.prepare('INSERT INTO projects (client_id, name, location, status) VALUES (?, ?, ?, ?)');
        const loc = body.location || 'Site Location';
        const result = stmt.run(clientId || null, body.name.trim(), loc, body.status || 'Active');
        return sendJson(res, 201, { id: Number(result.lastInsertRowid), ...body });
      }
    }

    // Employees
    if (pathname === '/api/employees') {
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM employees ORDER BY full_name ASC').all();
        return sendJson(res, 200, rows);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.full_name || !body.full_name.trim()) return sendJson(res, 400, { error: 'Employee name is required' });
        const name = body.full_name.trim();
        const existing = db.prepare('SELECT * FROM employees WHERE LOWER(TRIM(full_name)) = LOWER(?)').get(name);
        if (existing) {
          return sendJson(res, 200, existing);
        }
        const stmt = db.prepare('INSERT INTO employees (full_name, role, phone, is_active) VALUES (?, ?, ?, 1)');
        const result = stmt.run(name, body.role || 'Field Technician', body.phone || '');
        return sendJson(res, 201, { id: Number(result.lastInsertRowid), full_name: name, role: body.role || 'Field Technician' });
      }
    }

    const empMatch = pathname.match(/^\/api\/employees\/(\d+)$/);
    if (empMatch) {
      const empId = Number(empMatch[1]);
      if (req.method === 'PUT') {
        const body = await parseBody(req);
        if (!body.full_name || !body.full_name.trim()) return sendJson(res, 400, { error: 'Employee name is required' });
        const stmt = db.prepare('UPDATE employees SET full_name = ?, role = ?, phone = ? WHERE id = ?');
        stmt.run(body.full_name.trim(), body.role || 'Field Technician', body.phone || '', empId);
        return sendJson(res, 200, { id: empId, full_name: body.full_name.trim(), role: body.role || 'Field Technician', phone: body.phone || '' });
      }
      if (req.method === 'DELETE') {
        db.prepare('DELETE FROM employees WHERE id = ?').run(empId);
        return sendJson(res, 200, { success: true });
      }
    }

    // Categories
    if (pathname === '/api/categories') {
      if (req.method === 'GET') {
        const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
        return sendJson(res, 200, rows);
      }
      if (req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) return sendJson(res, 400, { error: 'Category name is required' });
        const name = body.name.trim();
        const existing = db.prepare('SELECT * FROM categories WHERE LOWER(TRIM(name)) = LOWER(?)').get(name);
        if (existing) {
          return sendJson(res, 200, existing);
        }
        const stmt = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
        const result = stmt.run(name, body.description || '');
        return sendJson(res, 201, { id: Number(result.lastInsertRowid), name });
      }
    }

    // -------------------------------------------------------------
    // REPORTS API ROUTES
    // -------------------------------------------------------------
    if (pathname === '/api/reports' && req.method === 'GET') {
      const rows = db.prepare(`
        SELECT 
          r.id,
          r.report_number,
          r.report_date,
          r.weather_condition,
          r.temperature,
          r.created_at,
          p.name as project_name,
          p.location as project_location,
          c.name as client_name,
          e.full_name as prepared_by_name,
          (SELECT COUNT(*) FROM report_work_summaries WHERE report_id = r.id) as work_items_count,
          (SELECT COUNT(*) FROM report_issues WHERE report_id = r.id) as issues_count
        FROM daily_reports r
        LEFT JOIN projects p ON r.project_id = p.id
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN employees e ON r.prepared_by_id = e.id
        ORDER BY r.report_date DESC, r.id DESC
      `).all();
      return sendJson(res, 200, rows);
    }

    // Single Report (GET /api/reports/:id or DELETE)
    const reportMatch = pathname.match(/^\/api\/reports\/(\d+)$/);
    if (reportMatch) {
      const reportId = Number(reportMatch[1]);

      if (req.method === 'GET') {
        const report = db.prepare(`
          SELECT 
            r.*,
            p.name as project_name,
            p.location as project_location,
            c.name as client_name,
            e.full_name as prepared_by_name,
            e.role as prepared_by_role
          FROM daily_reports r
          LEFT JOIN projects p ON r.project_id = p.id
          LEFT JOIN clients c ON p.client_id = c.id
          LEFT JOIN employees e ON r.prepared_by_id = e.id
          WHERE r.id = ?
        `).get(reportId);

        if (!report) {
          return sendJson(res, 404, { error: 'Report not found' });
        }

        const workSummaries = db.prepare('SELECT * FROM report_work_summaries WHERE report_id = ? ORDER BY sort_order ASC, id ASC').all(reportId);
        const manpower = db.prepare('SELECT * FROM report_manpower WHERE report_id = ? ORDER BY sort_order ASC, id ASC').all(reportId);
        const issues = db.prepare('SELECT * FROM report_issues WHERE report_id = ? ORDER BY sort_order ASC, id ASC').all(reportId);
        const signoffs = db.prepare('SELECT * FROM report_signoffs WHERE report_id = ? ORDER BY sort_order ASC, id ASC').all(reportId);

        try {
          report.attachments = JSON.parse(report.attachments_json || '[]');
        } catch {
          report.attachments = [];
        }

        workSummaries.forEach(w => {
          try {
            w.crew = JSON.parse(w.crew_json || '[]');
          } catch {
            w.crew = [];
          }
        });

        return sendJson(res, 200, {
          ...report,
          workSummaries,
          manpower,
          issues,
          signoffs
        });
      }

      if (req.method === 'DELETE') {
        db.exec('BEGIN TRANSACTION');
        try {
          db.prepare('DELETE FROM daily_reports WHERE id = ?').run(reportId);
          db.exec('COMMIT');
          return sendJson(res, 200, { success: true });
        } catch (err) {
          db.exec('ROLLBACK');
          return sendJson(res, 500, { error: err.message });
        }
      }
    }

    // -------------------------------------------------------------
    // CREATE / UPDATE REPORT WITH AUTO-LEARNING MASTER DATA
    // -------------------------------------------------------------
    if ((req.method === 'POST' && pathname === '/api/reports') || (req.method === 'PUT' && reportMatch)) {
      const body = await parseBody(req);
      const isUpdate = req.method === 'PUT';
      const targetId = isUpdate ? Number(reportMatch[1]) : null;

      if (!body.report_date) {
        return sendJson(res, 400, { error: 'Report Date is required.' });
      }

      const newlyAddedMaster = [];

      db.exec('BEGIN TRANSACTION');
      try {
        // 1. Auto-discover or resolve Project & Client
        let projectId = Number(body.project_id);
        if (!projectId || isNaN(projectId)) {
          if (body.project_name && body.project_name.trim()) {
            projectId = getOrCreateProject(body.project_name, body.client_name, body.project_location, newlyAddedMaster);
          } else {
            db.exec('ROLLBACK');
            return sendJson(res, 400, { error: 'Project name or selection is required.' });
          }
        }

        // 2. Auto-discover or resolve Prepared By Employee
        let preparedById = Number(body.prepared_by_id);
        if ((!preparedById || isNaN(preparedById)) && body.prepared_by_name && body.prepared_by_name.trim()) {
          preparedById = getOrCreateEmployee(body.prepared_by_name, 'General Field Technician', newlyAddedMaster);
        }

        let finalReportId = targetId;

        if (isUpdate) {
          const updateStmt = db.prepare(`
            UPDATE daily_reports SET
              project_id = ?,
              report_date = ?,
              prepared_by_id = ?,
              weather_condition = ?,
              temperature = ?,
              progress_notes = ?,
              challenges_delays = ?,
              safety_housekeeping = ?,
              quality_observations = ?,
              other_remarks = ?,
              attachments_json = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);

          updateStmt.run(
            projectId,
            body.report_date,
            preparedById || null,
            body.weather_condition || 'Sunny ☀️',
            body.temperature || '',
            body.progress_notes || '',
            body.challenges_delays || '',
            body.safety_housekeeping || '',
            body.quality_observations || '',
            body.other_remarks || '',
            JSON.stringify(body.attachments || []),
            finalReportId
          );

          // Clear child tables for clean rewrite
          db.prepare('DELETE FROM report_work_summaries WHERE report_id = ?').run(finalReportId);
          db.prepare('DELETE FROM report_manpower WHERE report_id = ?').run(finalReportId);
          db.prepare('DELETE FROM report_issues WHERE report_id = ?').run(finalReportId);
          db.prepare('DELETE FROM report_signoffs WHERE report_id = ?').run(finalReportId);
        } else {
          // Generate unique report number: DSR-YYYY-MMDD-NN
          const cleanDate = (body.report_date || '').replace(/-/g, '');
          const countStmt = db.prepare("SELECT COUNT(*) as count FROM daily_reports WHERE report_date = ?");
          const count = countStmt.get(body.report_date).count + 1;
          const reportNumber = body.report_number || `DSR-${cleanDate || 'REP'}-${String(count).padStart(2, '0')}`;

          const insertStmt = db.prepare(`
            INSERT INTO daily_reports (
              report_number, project_id, report_date, prepared_by_id,
              weather_condition, temperature,
              progress_notes, challenges_delays, safety_housekeeping,
              quality_observations, other_remarks, attachments_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const result = insertStmt.run(
            reportNumber,
            projectId,
            body.report_date,
            preparedById || null,
            body.weather_condition || 'Sunny ☀️',
            body.temperature || '',
            body.progress_notes || '',
            body.challenges_delays || '',
            body.safety_housekeeping || '',
            body.quality_observations || '',
            body.other_remarks || '',
            JSON.stringify(body.attachments || [])
          );

          finalReportId = Number(result.lastInsertRowid);
        }

        // 3. Process Work Summaries & auto-register new Categories and Crew members
        if (Array.isArray(body.workSummaries)) {
          const insertWork = db.prepare(`
            INSERT INTO report_work_summaries (
              report_id, category_id, activity_name, location_area, description, crew_json, time_hours, status, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          body.workSummaries.forEach((item, idx) => {
            const activityName = (item.activity_name || item.trade || '').trim();
            let catId = null;
            if (activityName) {
              catId = getOrCreateCategory(activityName, newlyAddedMaster);
            }

            // Ensure all crew members in this row exist in employees database
            const crewList = Array.isArray(item.crew) ? item.crew : [];
            const sanitizedCrew = [];
            crewList.forEach(member => {
              if (member && member.trim()) {
                const memberName = member.trim();
                getOrCreateEmployee(memberName, 'Field Technician', newlyAddedMaster);
                sanitizedCrew.push(memberName);
              }
            });

            insertWork.run(
              finalReportId,
              catId,
              activityName,
              item.location_area || '',
              item.description || '',
              JSON.stringify(sanitizedCrew),
              item.time_hours || 'Full day',
              item.status || 'Ongoing',
              idx + 1
            );
          });
        }

        // 4. Process Manpower Deployment
        if (Array.isArray(body.manpower)) {
          const insertManpower = db.prepare(`
            INSERT INTO report_manpower (
              report_id, team_name, num_persons, trade_task, start_time, end_time, remarks, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          body.manpower.forEach((item, idx) => {
            insertManpower.run(
              finalReportId,
              item.team_name || 'Crew',
              Number(item.num_persons) || 1,
              item.trade_task || '',
              item.start_time || '08:00 AM',
              item.end_time || '05:00 PM',
              item.remarks || '',
              idx + 1
            );
          });
        }

        // 5. Process Issues & auto-register responsible employees
        if (Array.isArray(body.issues)) {
          const insertIssue = db.prepare(`
            INSERT INTO report_issues (
              report_id, issue_description, recommended_action, responsible_name, target_date, status, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          body.issues.forEach((item, idx) => {
            if (item.issue_description && item.issue_description.trim()) {
              const respName = (item.responsible_name || '').trim();
              if (respName) {
                getOrCreateEmployee(respName, 'Field Technician', newlyAddedMaster);
              }

              insertIssue.run(
                finalReportId,
                item.issue_description.trim(),
                item.recommended_action || '',
                respName,
                item.target_date || '',
                item.status || 'Open',
                idx + 1
              );
            }
          });
        }

        // 6. Process Sign-Offs & auto-register signers
        if (Array.isArray(body.signoffs)) {
          const insertSignoff = db.prepare(`
            INSERT INTO report_signoffs (
              report_id, role_title, employee_name, signature_text, signed_date, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?)
          `);
          body.signoffs.forEach((item, idx) => {
            const empName = (item.employee_name || '').trim();
            if (empName) {
              getOrCreateEmployee(empName, item.role_title || 'Field Staff', newlyAddedMaster);
            }

            insertSignoff.run(
              finalReportId,
              item.role_title || '',
              empName,
              item.signature_text || '',
              item.signed_date || '',
              idx + 1
            );
          });
        }

        db.exec('COMMIT');
        return sendJson(res, isUpdate ? 200 : 201, {
          id: finalReportId,
          success: true,
          newlyAddedMaster
        });
      } catch (err) {
        db.exec('ROLLBACK');
        console.error('Error saving report:', err);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // -------------------------------------------------------------
    // STATIC FILE SERVING
    // -------------------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    filePath = path.normalize(filePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access Denied');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { error: 'Internal Server Error: ' + error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Daily Field Report System running at http://localhost:${PORT}`);
});
