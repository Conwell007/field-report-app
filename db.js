const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'data', 'reports.db');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Initialize schema
function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Check if we need to seed initial data
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM clients');
  const clientCount = checkStmt.get().count;

  if (clientCount === 0) {
    seedData();
  }
}

function seedData() {
  console.log('Seeding initial data...');

  // Clients
  const insertClient = db.prepare('INSERT INTO clients (name, contact_person, phone, email) VALUES (?, ?, ?, ?)');
  insertClient.run('Carol Wahome Projects', 'Carol Wahome', '+254 700 111 222', 'info@carolwahome.co.ke');
  insertClient.run('Pam Golding Properties', 'Property Manager', '+254 700 333 444', 'management@pamgolding.co.ke');

  // Projects
  const insertProject = db.prepare('INSERT INTO projects (client_id, name, location, status) VALUES (?, ?, ?, ?)');
  insertProject.run(1, 'Carol Wahome - Eagle Park Residence', 'Eagle Park, Runda', 'Active');
  insertProject.run(2, 'Pam Golding - Fadaq Park Tech Hub', 'Fadaq Park 277 Brookside', 'Active');

  // Employees (Technicians, Crew, Engineers)
  const insertEmployee = db.prepare('INSERT INTO employees (full_name, role, phone, is_active) VALUES (?, ?, ?, 1)');
  const employees = [
    ['Conwell Mutai', 'Technical Product Founder', '+254 781 492 671'],
    ['Samuel Amukoa', 'Lead Electrician', '+254 711 000 002'],
    ['Ibrahim Mate', 'Equipment Operator', '+254 711 000 003'],
    ['Gerald Ouma', 'Field Technician', '+254 711 000 004'],
    ['Joseph Mutuga', 'Field Technician', '+254 711 000 005'],
    ['Dennis Mwangi', 'Field Technician', '+254 711 000 006'],
    ['Jackson Maina', 'Welding Specialist', '+254 711 000 007'],
    ['Cavin Musolo', 'Field Technician', '+254 711 000 008'],
    ['Stephen Amayo', 'Network Engineer', '+254 711 000 009'],
    ['Martin Watta', 'Network Technician', '+254 711 000 010'],
    ['Dennis Katiku', 'Cabling Technician', '+254 711 000 011'],
    ['James Mulla', 'Network Technician', '+254 711 000 012'],
    ['Alex Kiprono', 'Project Engineer', '+254 711 000 013'],
    ['Grace Wanjiru', 'Site Agent / PM', '+254 711 000 014']
  ];

  for (const emp of employees) {
    insertEmployee.run(emp[0], emp[1], emp[2]);
  }

  // Work Categories / Trades
  const insertCategory = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
  const categories = [
    ['Electrical fence', 'Perimeter security, energizers, posts and wiring'],
    ['Networking', 'Structured cabling, switch patching, rack dressing, and distribution'],
    ['CCTV & Surveillance', 'Camera mounting, DVR/NVR configuration and testing'],
    ['Access Control', 'Biometrics, maglocks, door strikes and controllers'],
    ['Civil Works', 'Trenching, concrete bases, pole planting and restoration'],
    ['Power & Solar Backup', 'Inverters, battery banks and UPS deployment']
  ];

  for (const cat of categories) {
    insertCategory.run(cat[0], cat[1]);
  }

  // Seed the sample report from 17th August 2026
  const insertReport = db.prepare(`
    INSERT INTO daily_reports (
      report_number, project_id, report_date, prepared_by_id,
      weather_condition, temperature,
      progress_notes, challenges_delays, safety_housekeeping,
      quality_observations, other_remarks, attachments_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const reportResult = insertReport.run(
    'DSR-2026-0817',
    1, // Eagle Park / Carol Wahome
    '2026-08-17',
    1, // Conwell Mutai
    'Sunny ☀️',
    '24',
    'Both tasks are approaching completion steadily.',
    'None observed',
    'All safety precautions followed, no incidents reported.',
    'Work carried out with the utmost focus on quality delivery.',
    'None',
    JSON.stringify(['Site Photos'])
  );

  const reportId = Number(reportResult.lastInsertRowid);

  // Work Summary Items
  const insertWork = db.prepare(`
    INSERT INTO report_work_summaries (
      report_id, category_id, activity_name, location_area, description,
      crew_json, time_hours, status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertWork.run(
    reportId,
    1, // Electrical fence
    'Electrical fence',
    'Eagle Park',
    'Putting up Electrical fence WC posts',
    JSON.stringify(['Samuel Amukoa', 'Ibrahim Mate', 'Gerald Ouma', 'Joseph Mutuga', 'Dennis Mwangi', 'Jackson Maina', 'Cavin Musolo']),
    'Full day',
    'Ongoing',
    1
  );

  insertWork.run(
    reportId,
    2, // Networking
    'Networking',
    'Fadaq Park',
    'Structured cabling termination and Local Network Distribution',
    JSON.stringify(['Stephen Amayo', 'Martin Watta', 'Dennis Katiku', 'James Mulla', 'Conwell Mutai']),
    'Full day',
    'Ongoing',
    2
  );

  // Manpower Deployment
  const insertManpower = db.prepare(`
    INSERT INTO report_manpower (
      report_id, team_name, num_persons, trade_task, start_time, end_time, remarks, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertManpower.run(
    reportId,
    'Electrical crew',
    7,
    'Electric fence pole installation',
    '08:00 AM',
    '05:00 PM',
    'Work steadily progressing',
    1
  );

  insertManpower.run(
    reportId,
    'Networking crew',
    5,
    'Structured cabling termination and Local network distribution',
    '09:00 AM',
    '05:00 PM',
    'Work nearing completion',
    2
  );

  // Issues & Action Points
  const insertIssue = db.prepare(`
    INSERT INTO report_issues (
      report_id, issue_description, recommended_action, responsible_name, target_date, status, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertIssue.run(
    reportId,
    `On the patch panel, the patched order was set as follows:
Ports 1-5: Infrastructure
Ports 5-9: Access Points
Ports 9-13: CCTV Cameras
Ports 14-17: Extra Cables
Ports 37-48: Desktops
Required Material: 16 modules, 14 single face plates, 1 double face plate.
Observation: Two cables (9 & 10 on PGP Office Phones plan) had not been drawn to their designated locations. Two cables were at the server room that weren't traced to any of the designated drawn cables.`,
    'Find out if the two cables could be traced or drawn. Await power source installation in the server room so as to power the rack and all necessary devices.',
    'Conwell Mutai',
    '2026-08-19',
    'Open',
    1
  );

  // Sign-Off
  const insertSignoff = db.prepare(`
    INSERT INTO report_signoffs (
      report_id, role_title, employee_name, signature_text, signed_date, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSignoff.run(reportId, 'General Field Technician', 'Conwell Mutai', 'Conwell Mutai', '2026-08-17', 1);
  insertSignoff.run(reportId, 'Project Engineer', 'Alex Kiprono', '', '', 2);
  insertSignoff.run(reportId, 'Site Agent / PM', 'Grace Wanjiru', '', '', 3);

  console.log('Database initialized and seeded successfully.');
}

module.exports = {
  db,
  initDb
};
