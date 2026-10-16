// State
let metaData = {
  clients: [],
  projects: [],
  employees: [],
  categories: []
};

let currentReport = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  await loadMetadata();
  await loadReportsList();
  setDefaultDate();
});

function setDefaultDate() {
  const dateInput = document.getElementById('form-date');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// -------------------------------------------------------------
// METADATA & DROPDOWN POPULATION
// -------------------------------------------------------------
async function loadMetadata() {
  try {
    const res = await fetch('/api/meta');
    if (!res.ok) throw new Error('Failed to load metadata');
    metaData = await res.json();

    populateProjectDropdown();
    populateEmployeeDropdowns();
    populateMasterTables();
    populateDatalists();
  } catch (err) {
    console.error('Metadata load error:', err);
  }
}

function populateDatalists() {
  // Clients datalist
  const clientsDl = document.getElementById('clients-datalist');
  if (clientsDl) {
    clientsDl.innerHTML = metaData.clients.map(c => `<option value="${escapeHtml(c.name)}"></option>`).join('');
  }
}

function populateProjectDropdown() {
  const select = document.getElementById('form-project');
  const masterSelect = document.getElementById('m-project-client');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `
    <option value="">-- Select Project / Site --</option>
    <option value="__NEW__" style="color: #2563eb; font-weight: bold;">➕ Type / Add New Project...</option>
  `;

  metaData.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.name} (${p.client_name || 'No Client'})`;
    select.appendChild(opt);
  });

  if (currentVal && (currentVal === '__NEW__' || metaData.projects.some(p => String(p.id) === String(currentVal)))) {
    select.value = currentVal;
  }

  // Master modal client selector
  if (masterSelect) {
    masterSelect.innerHTML = '<option value="">-- Select Client --</option>';
    metaData.clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      masterSelect.appendChild(opt);
    });
  }
}

function onProjectSelect() {
  const select = document.getElementById('form-project');
  const inlineBox = document.getElementById('new-project-inline-box');
  const clientInput = document.getElementById('form-client-display');
  const locInput = document.getElementById('form-location-display');

  if (select.value === '__NEW__') {
    if (inlineBox) inlineBox.style.display = 'block';
    clientInput.readOnly = false;
    locInput.readOnly = false;
    clientInput.placeholder = 'Type client name...';
    locInput.placeholder = 'Type site address / location...';
    document.getElementById('inline-project-name').focus();
    return;
  }

  if (inlineBox) inlineBox.style.display = 'none';

  const projId = Number(select.value);
  const proj = metaData.projects.find(p => p.id === projId);

  if (proj) {
    clientInput.value = proj.client_name || '';
    locInput.value = proj.location || '';
  } else {
    clientInput.value = '';
    locInput.value = '';
  }
}

function onCustomClientInput() {
  // If user is typing in client input while a new project is being added, keep inline in sync
  const clientVal = document.getElementById('form-client-display').value;
  const inlineClient = document.getElementById('inline-client-name');
  if (inlineClient && inlineClient.value !== clientVal) {
    inlineClient.value = clientVal;
  }
}

function populateEmployeeDropdowns() {
  const prepSelect = document.getElementById('form-prepared-by');
  if (prepSelect) {
    const currentVal = prepSelect.value;
    prepSelect.innerHTML = `
      <option value="">-- Select Employee / Technician --</option>
      <option value="__NEW__" style="color: #2563eb; font-weight: bold;">➕ Add New Employee...</option>
    `;
    metaData.employees.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = `${e.full_name} (${e.role || 'Staff'})`;
      prepSelect.appendChild(opt);
    });
    if (currentVal) prepSelect.value = currentVal;
  }

  // Signoff dropdowns
  document.querySelectorAll('.sign-name-select').forEach(sel => {
    const val = sel.value;
    sel.innerHTML = `
      <option value="">-- Select Person --</option>
      <option value="__NEW__" style="color: #2563eb; font-weight: bold;">➕ Add New Person...</option>
    `;
    metaData.employees.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.full_name;
      opt.textContent = `${e.full_name} (${e.role || 'Staff'})`;
      sel.appendChild(opt);
    });
    if (val) sel.value = val;
  });
}

async function onPreparedByChange(selectElem) {
  if (selectElem.value === '__NEW__') {
    const name = prompt('Enter new technician / employee full name:');
    if (name && name.trim()) {
      const role = prompt('Enter their role (or press Enter for General Field Technician):', 'General Field Technician') || 'General Field Technician';
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name.trim(), role: role.trim() })
        });
        const emp = await res.json();
        await loadMetadata();
        selectElem.value = emp.id;
      } catch (err) {
        alert('Error adding employee: ' + err.message);
        selectElem.value = '';
      }
    } else {
      selectElem.value = '';
    }
  }
}

async function syncSignature(selectElem) {
  if (selectElem.value === '__NEW__') {
    const name = prompt('Enter person full name:');
    if (name && name.trim()) {
      const row = selectElem.closest('tr');
      const role = row.querySelector('.sign-role').value;
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name.trim(), role: role })
        });
        await loadMetadata();
        selectElem.value = name.trim();
      } catch {
        selectElem.value = '';
        return;
      }
    } else {
      selectElem.value = '';
      return;
    }
  }

  const row = selectElem.closest('tr');
  const signInput = row.querySelector('.sign-text');
  const dateInput = row.querySelector('.sign-date');

  if (selectElem.value && !signInput.value) {
    signInput.value = selectElem.value;
  }
  if (!dateInput.value) {
    const repDate = document.getElementById('form-date').value;
    dateInput.value = repDate || new Date().toISOString().split('T')[0];
  }
}

// -------------------------------------------------------------
// NAVIGATION & VIEW SWITCHING
// -------------------------------------------------------------
function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
  }

  const printView = document.getElementById('print-view');
  if (viewId === 'print-view') {
    printView.style.display = 'block';
  } else {
    printView.style.display = 'none';
  }

  if (viewId === 'reports-view') {
    document.getElementById('tab-reports').classList.add('active');
    loadReportsList();
  } else if (viewId === 'form-view') {
    document.getElementById('tab-form').classList.add('active');
  } else if (viewId === 'master-view') {
    document.getElementById('tab-master').classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showMasterTab(tabName) {
  document.querySelectorAll('.master-pane').forEach(el => el.style.display = 'none');
  document.querySelectorAll('[id^="mtab-"]').forEach(btn => btn.classList.remove('btn-primary'));

  const pane = document.getElementById(`mcontent-${tabName}`);
  const btn = document.getElementById(`mtab-${tabName}`);
  if (pane) pane.style.display = 'block';
  if (btn) btn.classList.add('btn-primary');
}

// -------------------------------------------------------------
// REPORTS LIST
// -------------------------------------------------------------
async function loadReportsList() {
  const tbody = document.getElementById('reports-list-body');
  try {
    const res = await fetch('/api/reports');
    const reports = await res.json();

    if (!reports.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 32px; color: #64748b;">
            No reports created yet. Click <strong>"➕ Create New Field Report"</strong> to start.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = reports.map(r => `
      <tr>
        <td><strong>${r.report_number || 'REP-' + r.id}</strong></td>
        <td>${r.report_date}</td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(r.project_name || 'N/A')}</div>
          <div style="font-size: 0.8rem; color: #64748b;">${escapeHtml(r.client_name || '')}</div>
        </td>
        <td>${escapeHtml(r.project_location || 'N/A')}</td>
        <td>${escapeHtml(r.prepared_by_name || 'Unassigned')}</td>
        <td><span class="badge badge-primary">${r.work_items_count} tasks</span></td>
        <td>${r.issues_count > 0 ? `<span class="badge badge-warning">${r.issues_count} open</span>` : '<span style="color:#94a3b8;">None</span>'}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="viewPrintReport(${r.id})">🖨️ Print</button>
          <button class="btn btn-secondary btn-sm" onclick="editReport(${r.id})">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteReport(${r.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center;">Failed to load reports: ${err.message}</td></tr>`;
  }
}

// -------------------------------------------------------------
// DYNAMIC ROWS: SECTION 1 (WORK SUMMARY)
// -------------------------------------------------------------
function addWorkSummaryRow(data = {}) {
  const tbody = document.getElementById('work-summary-tbody');
  const tr = document.createElement('tr');

  const defaultCategory = data.activity_name || data.trade || '';
  const defaultLoc = data.location_area || document.getElementById('form-location-display').value || '';
  const defaultDesc = data.description || '';
  const defaultHours = data.time_hours || 'Full day';
  const defaultStatus = data.status || 'Ongoing';
  const assignedCrew = Array.isArray(data.crew) ? data.crew : [];

  // Build Category Options
  let catOptions = `
    <option value="">-- Trade / Category --</option>
    <option value="__NEW__" style="color: #2563eb; font-weight: bold;">➕ Add New Trade / Category...</option>
  `;
  metaData.categories.forEach(c => {
    const selected = c.name.toLowerCase() === defaultCategory.toLowerCase() ? 'selected' : '';
    catOptions += `<option value="${escapeHtml(c.name)}" ${selected}>${escapeHtml(c.name)}</option>`;
  });
  if (defaultCategory && !metaData.categories.some(c => c.name.toLowerCase() === defaultCategory.toLowerCase())) {
    catOptions += `<option value="${escapeHtml(defaultCategory)}" selected>${escapeHtml(defaultCategory)}</option>`;
  }

  // Build Crew Options
  let empOptions = `
    <option value="">+ Add Crew Member</option>
    <option value="__NEW__" style="color: #2563eb; font-weight: bold;">➕ Add New Technician...</option>
  `;
  metaData.employees.forEach(e => {
    empOptions += `<option value="${escapeHtml(e.full_name)}">${escapeHtml(e.full_name)}</option>`;
  });

  tr.innerHTML = `
    <td>
      <select class="form-control ws-activity" required onchange="onCategorySelect(this)">${catOptions}</select>
    </td>
    <td>
      <input type="text" class="form-control ws-location" value="${escapeHtml(defaultLoc)}" placeholder="e.g. Eagle Park">
    </td>
    <td>
      <textarea class="form-control ws-desc" rows="2" placeholder="Description of work done...">${escapeHtml(defaultDesc)}</textarea>
    </td>
    <td>
      <select class="form-control ws-crew-select" onchange="handleCrewSelect(this)">
        ${empOptions}
      </select>
      <div class="crew-tags-container"></div>
    </td>
    <td>
      <select class="form-control ws-time">
        <option value="Full day" ${defaultHours === 'Full day' ? 'selected' : ''}>Full day</option>
        <option value="Half day" ${defaultHours === 'Half day' ? 'selected' : ''}>Half day</option>
        <option value="8 hrs" ${defaultHours === '8 hrs' ? 'selected' : ''}>8 hrs</option>
        <option value="6 hrs" ${defaultHours === '6 hrs' ? 'selected' : ''}>6 hrs</option>
        <option value="4 hrs" ${defaultHours === '4 hrs' ? 'selected' : ''}>4 hrs</option>
        <option value="2 hrs" ${defaultHours === '2 hrs' ? 'selected' : ''}>2 hrs</option>
      </select>
    </td>
    <td>
      <select class="form-control ws-status">
        <option value="Ongoing" ${defaultStatus === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
        <option value="Completed" ${defaultStatus === 'Completed' ? 'selected' : ''}>Completed</option>
        <option value="Delayed" ${defaultStatus === 'Delayed' ? 'selected' : ''}>Delayed</option>
        <option value="Pending" ${defaultStatus === 'Pending' ? 'selected' : ''}>Pending</option>
      </select>
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove()" title="Remove row">✕</button>
    </td>
  `;

  tbody.appendChild(tr);

  // Render initial crew chips
  const container = tr.querySelector('.crew-tags-container');
  assignedCrew.forEach(name => {
    renderCrewChip(container, name);
  });
}

async function onCategorySelect(selectElem) {
  if (selectElem.value === '__NEW__') {
    const newCat = prompt('Enter new Trade / Work Category name:');
    if (newCat && newCat.trim()) {
      try {
        const res = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newCat.trim() })
        });
        const cat = await res.json();
        await loadMetadata();

        // Update all activity selectors to include this category
        document.querySelectorAll('.ws-activity').forEach(sel => {
          if (!Array.from(sel.options).some(o => o.value.toLowerCase() === cat.name.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            sel.appendChild(opt);
          }
        });
        selectElem.value = cat.name;
      } catch (err) {
        alert('Error adding category: ' + err.message);
        selectElem.value = '';
      }
    } else {
      selectElem.value = '';
    }
  }
}

async function handleCrewSelect(selectElem) {
  const value = selectElem.value;
  if (!value) return;

  if (value === '__NEW__') {
    const name = prompt('Enter new technician / crew member full name:');
    if (name && name.trim()) {
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name.trim(), role: 'Field Technician' })
        });
        const emp = await res.json();
        await loadMetadata();

        // Add to all crew dropdowns
        document.querySelectorAll('.ws-crew-select').forEach(sel => {
          if (!Array.from(sel.options).some(o => o.value.toLowerCase() === emp.full_name.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = emp.full_name;
            opt.textContent = emp.full_name;
            sel.appendChild(opt);
          }
        });

        // Add chip to current row
        const container = selectElem.parentElement.querySelector('.crew-tags-container');
        renderCrewChip(container, emp.full_name);
      } catch (err) {
        alert('Error adding technician: ' + err.message);
      }
    }
    selectElem.value = '';
    return;
  }

  // Regular existing employee selected
  const container = selectElem.parentElement.querySelector('.crew-tags-container');
  const existing = Array.from(container.querySelectorAll('.crew-chip')).map(c => c.dataset.name);
  if (!existing.includes(value)) {
    renderCrewChip(container, value);
  }
  selectElem.value = '';
}

function renderCrewChip(container, name) {
  const chip = document.createElement('div');
  chip.className = 'crew-chip';
  chip.dataset.name = name;
  chip.innerHTML = `
    <span>${escapeHtml(name)}</span>
    <span class="remove" onclick="this.parentElement.remove()">✕</span>
  `;
  container.appendChild(chip);
}

// -------------------------------------------------------------
// DYNAMIC ROWS: SECTION 2 (MANPOWER DEPLOYMENT)
// -------------------------------------------------------------
function addManpowerRow(data = {}) {
  const tbody = document.getElementById('manpower-tbody');
  const tr = document.createElement('tr');

  const defaultTeam = data.team_name || 'Technical Crew';
  const defaultCount = data.num_persons || 1;
  const defaultTask = data.trade_task || '';
  const defaultStart = data.start_time || '08:00 AM';
  const defaultEnd = data.end_time || '05:00 PM';
  const defaultRemarks = data.remarks || 'Work steadily progressing';

  tr.innerHTML = `
    <td>
      <input type="text" class="form-control mp-team" value="${escapeHtml(defaultTeam)}" placeholder="e.g. Electrical crew">
    </td>
    <td>
      <input type="number" class="form-control mp-count" min="1" max="100" value="${defaultCount}">
    </td>
    <td>
      <input type="text" class="form-control mp-task" value="${escapeHtml(defaultTask)}" placeholder="e.g. Installation / Cabling">
    </td>
    <td>
      <input type="text" class="form-control mp-start" value="${escapeHtml(defaultStart)}" placeholder="08:00 AM">
    </td>
    <td>
      <input type="text" class="form-control mp-end" value="${escapeHtml(defaultEnd)}" placeholder="05:00 PM">
    </td>
    <td>
      <input type="text" class="form-control mp-remarks" value="${escapeHtml(defaultRemarks)}" placeholder="Remarks">
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove()" title="Remove row">✕</button>
    </td>
  `;

  tbody.appendChild(tr);
}

function autoGenerateManpower() {
  const wsRows = document.querySelectorAll('#work-summary-tbody tr');
  if (!wsRows.length) {
    alert('Please add at least one Work Summary row first.');
    return;
  }

  const tbody = document.getElementById('manpower-tbody');
  tbody.innerHTML = '';

  wsRows.forEach(row => {
    const activity = row.querySelector('.ws-activity').value || 'Crew';
    const chips = row.querySelectorAll('.crew-chip');
    const crewCount = chips.length || 1;
    const desc = row.querySelector('.ws-desc').value || (activity + ' tasks');

    addManpowerRow({
      team_name: `${activity} crew`,
      num_persons: crewCount,
      trade_task: desc.slice(0, 70),
      start_time: '08:00 AM',
      end_time: '05:00 PM',
      remarks: 'Work steadily progressing'
    });
  });
}

// -------------------------------------------------------------
// DYNAMIC ROWS: SECTION 7 (ISSUES & ACTION POINTS)
// -------------------------------------------------------------
function addIssueRow(data = {}) {
  const tbody = document.getElementById('issues-tbody');
  const tr = document.createElement('tr');

  const defaultDesc = data.issue_description || '';
  const defaultAction = data.recommended_action || '';
  const defaultResp = data.responsible_name || '';
  const defaultTarget = data.target_date || '';
  const defaultStatus = data.status || 'Open';

  let empOptions = `
    <option value="">-- Select Person --</option>
    <option value="__NEW__" style="color: #2563eb; font-weight: bold;">➕ Add New Person...</option>
  `;
  metaData.employees.forEach(e => {
    const selected = e.full_name === defaultResp ? 'selected' : '';
    empOptions += `<option value="${escapeHtml(e.full_name)}" ${selected}>${escapeHtml(e.full_name)}</option>`;
  });
  if (defaultResp && !metaData.employees.some(e => e.full_name === defaultResp)) {
    empOptions += `<option value="${escapeHtml(defaultResp)}" selected>${escapeHtml(defaultResp)}</option>`;
  }

  tr.innerHTML = `
    <td>
      <textarea class="form-control iss-desc" rows="3" placeholder="Describe the issue / cabling observation...">${escapeHtml(defaultDesc)}</textarea>
    </td>
    <td>
      <textarea class="form-control iss-action" rows="3" placeholder="Recommended mitigation or next step...">${escapeHtml(defaultAction)}</textarea>
    </td>
    <td>
      <select class="form-control iss-resp" onchange="handleIssueRespChange(this)">${empOptions}</select>
    </td>
    <td>
      <input type="date" class="form-control iss-target" value="${escapeHtml(defaultTarget)}">
    </td>
    <td>
      <select class="form-control iss-status">
        <option value="Open" ${defaultStatus === 'Open' ? 'selected' : ''}>Open</option>
        <option value="In Progress" ${defaultStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option value="Resolved" ${defaultStatus === 'Resolved' ? 'selected' : ''}>Resolved</option>
      </select>
    </td>
    <td style="text-align: center;">
      <button type="button" class="btn btn-secondary btn-sm" onclick="this.closest('tr').remove()" title="Remove row">✕</button>
    </td>
  `;

  tbody.appendChild(tr);
}

async function handleIssueRespChange(selectElem) {
  if (selectElem.value === '__NEW__') {
    const name = prompt('Enter responsible person full name:');
    if (name && name.trim()) {
      try {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ full_name: name.trim(), role: 'Field Staff' })
        });
        await loadMetadata();
        selectElem.value = name.trim();
      } catch {
        selectElem.value = '';
      }
    } else {
      selectElem.value = '';
    }
  }
}

// -------------------------------------------------------------
// CREATE / EDIT REPORT
// -------------------------------------------------------------
function createNewReport() {
  currentReport = null;
  document.getElementById('report-id').value = '';
  document.getElementById('form-heading').textContent = 'New Daily Site Report';
  document.getElementById('report-form').reset();

  const inlineBox = document.getElementById('new-project-inline-box');
  if (inlineBox) inlineBox.style.display = 'none';

  setDefaultDate();
  document.getElementById('form-client-display').value = '';
  document.getElementById('form-location-display').value = '';

  document.getElementById('work-summary-tbody').innerHTML = '';
  document.getElementById('manpower-tbody').innerHTML = '';
  document.getElementById('issues-tbody').innerHTML = '';

  addWorkSummaryRow();
  addManpowerRow();
  addIssueRow();

  document.querySelectorAll('input[name="attachments"]').forEach(cb => cb.checked = false);

  switchView('form-view');
}

async function editReport(id) {
  try {
    const res = await fetch(`/api/reports/${id}`);
    if (!res.ok) throw new Error('Report not found');
    const data = await res.json();

    currentReport = data;
    document.getElementById('report-id').value = data.id;
    document.getElementById('form-heading').textContent = `Edit Daily Site Report (${data.report_number})`;

    document.getElementById('form-project').value = data.project_id || '';
    onProjectSelect();

    document.getElementById('form-date').value = data.report_date || '';
    document.getElementById('form-prepared-by').value = data.prepared_by_id || '';
    document.getElementById('form-weather').value = data.weather_condition || 'Sunny ☀️';
    document.getElementById('form-temp').value = data.temperature || '';

    // Observations
    document.getElementById('obs-progress').value = data.progress_notes || '';
    document.getElementById('obs-challenges').value = data.challenges_delays || '';
    document.getElementById('obs-safety').value = data.safety_housekeeping || '';
    document.getElementById('obs-quality').value = data.quality_observations || '';
    document.getElementById('obs-other').value = data.other_remarks || '';

    // Attachments
    const atts = Array.isArray(data.attachments) ? data.attachments : [];
    document.querySelectorAll('input[name="attachments"]').forEach(cb => {
      cb.checked = atts.includes(cb.value);
    });

    // Work Summaries
    const wsTbody = document.getElementById('work-summary-tbody');
    wsTbody.innerHTML = '';
    if (data.workSummaries && data.workSummaries.length) {
      data.workSummaries.forEach(ws => addWorkSummaryRow(ws));
    } else {
      addWorkSummaryRow();
    }

    // Manpower
    const mpTbody = document.getElementById('manpower-tbody');
    mpTbody.innerHTML = '';
    if (data.manpower && data.manpower.length) {
      data.manpower.forEach(mp => addManpowerRow(mp));
    } else {
      addManpowerRow();
    }

    // Issues
    const issTbody = document.getElementById('issues-tbody');
    issTbody.innerHTML = '';
    if (data.issues && data.issues.length) {
      data.issues.forEach(iss => addIssueRow(iss));
    } else {
      addIssueRow();
    }

    // Signoffs
    if (data.signoffs && data.signoffs.length) {
      const signRows = document.querySelectorAll('#signoff-tbody tr');
      data.signoffs.forEach(s => {
        signRows.forEach(row => {
          const role = row.querySelector('.sign-role').value;
          if (role.toLowerCase() === (s.role_title || '').toLowerCase()) {
            row.querySelector('.sign-name-select').value = s.employee_name || '';
            row.querySelector('.sign-text').value = s.signature_text || '';
            row.querySelector('.sign-date').value = s.signed_date || '';
          }
        });
      });
    }

    switchView('form-view');
  } catch (err) {
    alert('Error loading report: ' + err.message);
  }
}

async function saveReport(event) {
  event.preventDefault();

  const reportId = document.getElementById('report-id').value;
  const isUpdate = Boolean(reportId);

  // Extract Work Summary
  const workSummaries = [];
  document.querySelectorAll('#work-summary-tbody tr').forEach(tr => {
    const activity = tr.querySelector('.ws-activity').value;
    const location = tr.querySelector('.ws-location').value;
    const desc = tr.querySelector('.ws-desc').value;
    const time = tr.querySelector('.ws-time').value;
    const status = tr.querySelector('.ws-status').value;
    const crew = Array.from(tr.querySelectorAll('.crew-chip')).map(c => c.dataset.name);

    if (activity || desc) {
      workSummaries.push({
        activity_name: activity,
        location_area: location,
        description: desc,
        time_hours: time,
        status: status,
        crew: crew
      });
    }
  });

  // Extract Manpower
  const manpower = [];
  document.querySelectorAll('#manpower-tbody tr').forEach(tr => {
    const team = tr.querySelector('.mp-team').value;
    const count = tr.querySelector('.mp-count').value;
    const task = tr.querySelector('.mp-task').value;
    const start = tr.querySelector('.mp-start').value;
    const end = tr.querySelector('.mp-end').value;
    const remarks = tr.querySelector('.mp-remarks').value;

    if (team) {
      manpower.push({
        team_name: team,
        num_persons: Number(count) || 1,
        trade_task: task,
        start_time: start,
        end_time: end,
        remarks: remarks
      });
    }
  });

  // Extract Issues
  const issues = [];
  document.querySelectorAll('#issues-tbody tr').forEach(tr => {
    const desc = tr.querySelector('.iss-desc').value;
    const action = tr.querySelector('.iss-action').value;
    const resp = tr.querySelector('.iss-resp').value;
    const target = tr.querySelector('.iss-target').value;
    const status = tr.querySelector('.iss-status').value;

    if (desc.trim()) {
      issues.push({
        issue_description: desc,
        recommended_action: action,
        responsible_name: resp,
        target_date: target,
        status: status
      });
    }
  });

  // Extract Sign-Offs
  const signoffs = [];
  document.querySelectorAll('#signoff-tbody tr').forEach(tr => {
    const role = tr.querySelector('.sign-role').value;
    const name = tr.querySelector('.sign-name-select').value;
    const sign = tr.querySelector('.sign-text').value;
    const date = tr.querySelector('.sign-date').value;

    signoffs.push({
      role_title: role,
      employee_name: name,
      signature_text: sign,
      signed_date: date
    });
  });

  const attachments = Array.from(document.querySelectorAll('input[name="attachments"]:checked')).map(cb => cb.value);

  // Check if project is existing or custom
  const projSelect = document.getElementById('form-project');
  let projectId = null;
  let projectName = null;
  let clientName = document.getElementById('form-client-display').value;
  let location = document.getElementById('form-location-display').value;

  if (projSelect.value === '__NEW__') {
    projectName = document.getElementById('inline-project-name').value;
    if (!projectName || !projectName.trim()) {
      alert('Please enter a name for the new project.');
      document.getElementById('inline-project-name').focus();
      return;
    }
    const inlineClient = document.getElementById('inline-client-name').value;
    if (inlineClient) clientName = inlineClient;
  } else {
    projectId = Number(projSelect.value);
  }

  const payload = {
    project_id: projectId,
    project_name: projectName,
    client_name: clientName,
    project_location: location,
    report_date: document.getElementById('form-date').value,
    prepared_by_id: Number(document.getElementById('form-prepared-by').value) || null,
    weather_condition: document.getElementById('form-weather').value,
    temperature: document.getElementById('form-temp').value,
    progress_notes: document.getElementById('obs-progress').value,
    challenges_delays: document.getElementById('obs-challenges').value,
    safety_housekeeping: document.getElementById('obs-safety').value,
    quality_observations: document.getElementById('obs-quality').value,
    other_remarks: document.getElementById('obs-other').value,
    attachments: attachments,
    workSummaries: workSummaries,
    manpower: manpower,
    issues: issues,
    signoffs: signoffs
  };

  try {
    const url = isUpdate ? `/api/reports/${reportId}` : '/api/reports';
    const method = isUpdate ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save report');

    // Reload master data so any auto-learned records immediately appear in all dropdowns
    await loadMetadata();

    let successMsg = `Daily Site Report ${isUpdate ? 'updated' : 'created'} successfully!`;
    if (result.newlyAddedMaster && result.newlyAddedMaster.length > 0) {
      const addedDetails = result.newlyAddedMaster.map(item => `• [${item.type.toUpperCase()}] ${item.name}`).join('\n');
      successMsg += `\n\n✨ Newly entered records were automatically saved to your database and are now available for all future dropdowns:\n${addedDetails}`;
    }

    alert(successMsg);
    switchView('reports-view');
  } catch (err) {
    alert('Save error: ' + err.message);
  }
}

async function deleteReport(id) {
  if (!confirm('Are you sure you want to delete this daily site report?')) return;
  try {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    loadReportsList();
  } catch (err) {
    alert('Delete error: ' + err.message);
  }
}

// -------------------------------------------------------------
// PRINT & PDF PREVIEW
// -------------------------------------------------------------
async function viewPrintReport(id) {
  try {
    const res = await fetch(`/api/reports/${id}`);
    const data = await res.json();
    renderPrintDocument(data);
    switchView('print-view');
  } catch (err) {
    alert('Error loading print view: ' + err.message);
  }
}

function previewCurrentForm() {
  const projSelect = document.getElementById('form-project');
  let projName = '';
  let clientName = document.getElementById('form-client-display').value || '';
  let location = document.getElementById('form-location-display').value || '';

  if (projSelect.value === '__NEW__') {
    projName = document.getElementById('inline-project-name').value || 'New Project';
  } else {
    const proj = metaData.projects.find(p => p.id === Number(projSelect.value)) || {};
    projName = proj.name || 'Site Project';
    if (!clientName) clientName = proj.client_name || '';
    if (!location) location = proj.location || '';
  }

  const prepSelect = document.getElementById('form-prepared-by');
  const prepEmp = metaData.employees.find(e => e.id === Number(prepSelect.value)) || {};

  const workSummaries = [];
  document.querySelectorAll('#work-summary-tbody tr').forEach(tr => {
    workSummaries.push({
      activity_name: tr.querySelector('.ws-activity').value,
      location_area: tr.querySelector('.ws-location').value,
      description: tr.querySelector('.ws-desc').value,
      crew: Array.from(tr.querySelectorAll('.crew-chip')).map(c => c.dataset.name),
      time_hours: tr.querySelector('.ws-time').value,
      status: tr.querySelector('.ws-status').value
    });
  });

  const manpower = [];
  document.querySelectorAll('#manpower-tbody tr').forEach(tr => {
    manpower.push({
      team_name: tr.querySelector('.mp-team').value,
      num_persons: tr.querySelector('.mp-count').value,
      trade_task: tr.querySelector('.mp-task').value,
      start_time: tr.querySelector('.mp-start').value,
      end_time: tr.querySelector('.mp-end').value,
      remarks: tr.querySelector('.mp-remarks').value
    });
  });

  const issues = [];
  document.querySelectorAll('#issues-tbody tr').forEach(tr => {
    issues.push({
      issue_description: tr.querySelector('.iss-desc').value,
      recommended_action: tr.querySelector('.iss-action').value,
      responsible_name: tr.querySelector('.iss-resp').value,
      target_date: tr.querySelector('.iss-target').value
    });
  });

  const signoffs = [];
  document.querySelectorAll('#signoff-tbody tr').forEach(tr => {
    signoffs.push({
      role_title: tr.querySelector('.sign-role').value,
      employee_name: tr.querySelector('.sign-name-select').value,
      signature_text: tr.querySelector('.sign-text').value,
      signed_date: tr.querySelector('.sign-date').value
    });
  });

  const data = {
    project_name: projName,
    client_name: clientName,
    project_location: location,
    report_date: document.getElementById('form-date').value,
    prepared_by_name: prepEmp.full_name || 'Staff',
    weather_condition: document.getElementById('form-weather').value,
    temperature: document.getElementById('form-temp').value,
    progress_notes: document.getElementById('obs-progress').value,
    challenges_delays: document.getElementById('obs-challenges').value,
    safety_housekeeping: document.getElementById('obs-safety').value,
    quality_observations: document.getElementById('obs-quality').value,
    other_remarks: document.getElementById('obs-other').value,
    attachments: Array.from(document.querySelectorAll('input[name="attachments"]:checked')).map(cb => cb.value),
    workSummaries,
    manpower,
    issues,
    signoffs
  };

  renderPrintDocument(data);
  switchView('print-view');
}

function renderPrintDocument(data) {
  document.getElementById('pv-project-client').textContent = `${data.project_name || ''} ${data.client_name ? '(' + data.client_name + ')' : ''}`;
  document.getElementById('pv-date').textContent = formatDateDisplay(data.report_date);
  document.getElementById('pv-location').textContent = data.project_location || 'N/A';
  document.getElementById('pv-prepared-by').textContent = data.prepared_by_name || 'N/A';
  document.getElementById('pv-weather').textContent = `${data.weather_condition || 'Sunny ☀️'} ${data.temperature ? '(Temp: ' + data.temperature + ' °C)' : ''}`;

  const wsBody = document.getElementById('pv-work-summary-body');
  if (data.workSummaries && data.workSummaries.length) {
    wsBody.innerHTML = data.workSummaries.map(w => `
      <tr>
        <td><strong>${escapeHtml(w.activity_name || '')}</strong></td>
        <td>${escapeHtml(w.location_area || '')}</td>
        <td>${escapeHtml(w.description || '')}</td>
        <td>${Array.isArray(w.crew) ? w.crew.map(c => escapeHtml(c)).join(', ') : ''}</td>
        <td>${escapeHtml(w.time_hours || '')}</td>
        <td>${escapeHtml(w.status || '')}</td>
      </tr>
    `).join('');
  } else {
    wsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">No work activities recorded</td></tr>';
  }

  const mpBody = document.getElementById('pv-manpower-body');
  if (data.manpower && data.manpower.length) {
    mpBody.innerHTML = data.manpower.map(m => `
      <tr>
        <td><strong>${escapeHtml(m.team_name || '')}</strong></td>
        <td style="text-align: center;">${m.num_persons || 1}</td>
        <td>${escapeHtml(m.trade_task || '')}</td>
        <td>${escapeHtml(m.start_time || '')}</td>
        <td>${escapeHtml(m.end_time || '')}</td>
        <td>${escapeHtml(m.remarks || '')}</td>
      </tr>
    `).join('');
  } else {
    mpBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #888;">No manpower records</td></tr>';
  }

  document.getElementById('pv-obs-progress').textContent = data.progress_notes || 'None observed';
  document.getElementById('pv-obs-challenges').textContent = data.challenges_delays || 'None observed';
  document.getElementById('pv-obs-safety').textContent = data.safety_housekeeping || 'All safety precautions followed, no incidents reported.';
  document.getElementById('pv-obs-quality').textContent = data.quality_observations || 'Work carried out with the utmost focus on quality delivery.';
  document.getElementById('pv-obs-other').textContent = data.other_remarks || 'None';

  const attContainer = document.getElementById('pv-attachments');
  const allAttTypes = [
    'Site Photos',
    'Delivery Notes',
    'Inspection Checklists',
    'Test Reports / Cube Results',
    'NCRs / Observations'
  ];
  const activeAtts = Array.isArray(data.attachments) ? data.attachments : [];
  attContainer.innerHTML = allAttTypes.map(att => {
    const isChecked = activeAtts.includes(att);
    return `<span><strong>[ ${isChecked ? '✔' : ' '} ]</strong> ${escapeHtml(att)}</span>`;
  }).join('');

  const issBody = document.getElementById('pv-issues-body');
  if (data.issues && data.issues.length) {
    issBody.innerHTML = data.issues.map(i => `
      <tr>
        <td>${escapeHtml(i.issue_description || '').replace(/\n/g, '<br>')}</td>
        <td>${escapeHtml(i.recommended_action || '').replace(/\n/g, '<br>')}</td>
        <td>${escapeHtml(i.responsible_name || '')}</td>
        <td>${escapeHtml(i.target_date || '')}</td>
      </tr>
    `).join('');
  } else {
    issBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #888;">No outstanding issues</td></tr>';
  }

  const signBody = document.getElementById('pv-signoffs-body');
  if (data.signoffs && data.signoffs.length) {
    signBody.innerHTML = data.signoffs.map(s => `
      <tr>
        <td><strong>${escapeHtml(s.role_title || '')}</strong></td>
        <td>${escapeHtml(s.signature_text || s.employee_name || '')}</td>
        <td>${escapeHtml(s.signed_date || '')}</td>
      </tr>
    `).join('');
  } else {
    signBody.innerHTML = `
      <tr>
        <td><strong>General Field Technician</strong></td>
        <td>${escapeHtml(data.prepared_by_name || '')}</td>
        <td>${formatDateDisplay(data.report_date)}</td>
      </tr>
      <tr>
        <td><strong>Project Engineer</strong></td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td><strong>Site Agent / PM</strong></td>
        <td></td>
        <td></td>
      </tr>
    `;
  }
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const suffix = (day % 10 === 1 && day !== 11) ? 'st' :
                   (day % 10 === 2 && day !== 12) ? 'nd' :
                   (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
    return `${day}${suffix} ${month}, ${year}`;
  } catch {
    return dateStr;
  }
}

// -------------------------------------------------------------
// MASTER DATA MANAGEMENT
// -------------------------------------------------------------
function populateMasterTables() {
  const clientsTbody = document.getElementById('master-clients-tbody');
  if (clientsTbody) {
    clientsTbody.innerHTML = metaData.clients.map(c => `
      <tr>
        <td>${c.id}</td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.contact_person || '-')}</td>
        <td>${escapeHtml(c.phone || '-')}</td>
      </tr>
    `).join('');
  }

  const projectsTbody = document.getElementById('master-projects-tbody');
  if (projectsTbody) {
    projectsTbody.innerHTML = metaData.projects.map(p => `
      <tr>
        <td>${p.id}</td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(p.client_name || '-')}</td>
        <td>${escapeHtml(p.location || '-')}</td>
      </tr>
    `).join('');
  }

  const empTbody = document.getElementById('master-employees-tbody');
  if (empTbody) {
    empTbody.innerHTML = metaData.employees.map(e => `
      <tr>
        <td>${e.id}</td>
        <td><strong>${escapeHtml(e.full_name)}</strong></td>
        <td><span class="badge badge-primary">${escapeHtml(e.role || 'Field Technician')}</span></td>
        <td>${escapeHtml(e.phone || '-')}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="editEmployeeRole(${e.id})" title="Edit Name & Role">✏️ Edit Role</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${e.id})" title="Remove">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  const catTbody = document.getElementById('master-categories-tbody');
  if (catTbody) {
    catTbody.innerHTML = metaData.categories.map(c => `
      <tr>
        <td>${c.id}</td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.description || '-')}</td>
      </tr>
    `).join('');
  }
}

async function handleMasterSubmit(event, type) {
  event.preventDefault();
  let payload = {};
  let endpoint = `/api/${type}`;

  if (type === 'clients') {
    payload = {
      name: document.getElementById('m-client-name').value,
      contact_person: document.getElementById('m-client-contact').value,
      phone: document.getElementById('m-client-phone').value
    };
  } else if (type === 'projects') {
    payload = {
      client_id: Number(document.getElementById('m-project-client').value),
      name: document.getElementById('m-project-name').value,
      location: document.getElementById('m-project-location').value
    };
  } else if (type === 'employees') {
    payload = {
      full_name: document.getElementById('m-emp-name').value,
      role: document.getElementById('m-emp-role').value,
      phone: document.getElementById('m-emp-phone').value
    };
  } else if (type === 'categories') {
    payload = {
      name: document.getElementById('m-cat-name').value,
      description: document.getElementById('m-cat-desc').value
    };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add record');
    }
    event.target.reset();
    await loadMetadata();
    alert('Record added successfully!');
  } catch (err) {
    alert('Error adding record: ' + err.message);
  }
}

async function editEmployeeRole(id) {
  const emp = metaData.employees.find(e => e.id === id);
  if (!emp) return;

  const newName = prompt('Edit Employee Full Name:', emp.full_name);
  if (!newName || !newName.trim()) return;

  const newRole = prompt(`Edit Role for ${newName.trim()} (e.g. Lead Electrician, Senior Network Engineer, Project Manager, Site Supervisor):`, emp.role || 'Field Technician');
  if (newRole === null) return;

  const newPhone = prompt(`Edit Phone Number for ${newName.trim()}:`, emp.phone || '');
  if (newPhone === null) return;

  try {
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: newName.trim(),
        role: newRole.trim(),
        phone: newPhone.trim()
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update employee');
    }
    await loadMetadata();
    alert(`Successfully updated ${newName.trim()}'s role to "${newRole.trim()}"!`);
  } catch (err) {
    alert('Error updating employee: ' + err.message);
  }
}

async function deleteEmployee(id) {
  const emp = metaData.employees.find(e => e.id === id);
  if (!emp) return;
  if (!confirm(`Are you sure you want to remove "${emp.full_name}" from the employees list?`)) return;

  try {
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete employee');
    await loadMetadata();
    alert(`Removed ${emp.full_name} from employees.`);
  } catch (err) {
    alert('Error deleting employee: ' + err.message);
  }
}

// -------------------------------------------------------------
// QUICK MODALS (In-form rapid master additions)
// -------------------------------------------------------------
let quickModalType = null;

function openQuickModal(type) {
  quickModalType = type;
  const overlay = document.getElementById('quick-modal');
  const title = document.getElementById('quick-modal-title');
  const body = document.getElementById('quick-modal-body');

  if (type === 'project') {
    title.textContent = 'Quick Add Project / Site';
    let clientOpts = '<option value="">-- Select Client --</option>';
    metaData.clients.forEach(c => {
      clientOpts += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });

    body.innerHTML = `
      <div class="form-group" style="margin-bottom: 12px;">
        <label>Client *</label>
        <select id="qm-client" class="form-control" required>${clientOpts}</select>
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label>Project / Site Name *</label>
        <input type="text" id="qm-name" class="form-control" required placeholder="e.g. Carol Wahome Projects - Eagle Park">
      </div>
      <div class="form-group">
        <label>Location *</label>
        <input type="text" id="qm-loc" class="form-control" required placeholder="e.g. Eagle Park, Runda">
      </div>
    `;
  } else if (type === 'employee') {
    title.textContent = 'Quick Add Employee / Crew Member';
    body.innerHTML = `
      <div class="form-group" style="margin-bottom: 12px;">
        <label>Full Name *</label>
        <input type="text" id="qm-emp-name" class="form-control" required placeholder="e.g. Samuel Amukoa">
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label>Role / Position</label>
        <input type="text" id="qm-emp-role" class="form-control" placeholder="e.g. Electrician / Network Technician">
      </div>
      <div class="form-group">
        <label>Phone Number</label>
        <input type="text" id="qm-emp-phone" class="form-control" placeholder="e.g. +254 700 000 000">
      </div>
    `;
  }

  overlay.classList.add('active');
}

function closeQuickModal() {
  document.getElementById('quick-modal').classList.remove('active');
  quickModalType = null;
}

async function handleQuickModalSubmit(event) {
  event.preventDefault();
  if (!quickModalType) return;

  try {
    if (quickModalType === 'project') {
      const payload = {
        client_id: Number(document.getElementById('qm-client').value),
        name: document.getElementById('qm-name').value,
        location: document.getElementById('qm-loc').value
      };
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const created = await res.json();
      await loadMetadata();
      document.getElementById('form-project').value = created.id;
      onProjectSelect();
    } else if (quickModalType === 'employee') {
      const payload = {
        full_name: document.getElementById('qm-emp-name').value,
        role: document.getElementById('qm-emp-role').value,
        phone: document.getElementById('qm-emp-phone').value
      };
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const created = await res.json();
      await loadMetadata();
      document.getElementById('form-prepared-by').value = created.id;
    }

    closeQuickModal();
  } catch (err) {
    alert('Error saving record: ' + err.message);
  }
}

// Utility
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
