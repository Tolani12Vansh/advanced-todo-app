// ---- State ----
let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentFilter  = 'all';
let currentCat     = 'all';
let currentSearch  = '';
let currentSort    = 'newest';
let dragSrcIndex   = null;

// ---- DOM ----
const taskInput      = document.getElementById('taskInput');
const addBtn         = document.getElementById('addBtn');
const taskList       = document.getElementById('taskList');
const taskCount      = document.getElementById('taskCount');
const filterBtns     = document.querySelectorAll('.filter-btn');
const prioritySelect = document.getElementById('prioritySelect');
const categorySelect = document.getElementById('categorySelect');
const dueDateInput   = document.getElementById('dueDateInput');
const searchInput    = document.getElementById('searchInput');
const sortSelect     = document.getElementById('sortSelect');
const themeToggle    = document.getElementById('themeToggle');
const pillBtns       = document.querySelectorAll('.pill');

// ---- Save ----
function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

// ---- Theme ----
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('theme', next);
});

// ---- Due Date Label ----
function getDueDateLabel(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr); due.setHours(0,0,0,0);
  const diff  = (due - today) / 86400000;
  if (diff < 0)   return { label: '⚠️ Overdue',  cls: 'overdue' };
  if (diff === 0) return { label: '🔥 Today',     cls: 'today' };
  if (diff === 1) return { label: '📅 Tomorrow',  cls: '' };
  return { label: '📅 ' + due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), cls: '' };
}

// ---- Priority Sort Value ----
function priorityVal(p) { return p === 'high' ? 3 : p === 'medium' ? 2 : 1; }

// ---- Filter + Sort + Search ----
function getFilteredTasks() {
  let list = [...tasks];

  if (currentCat !== 'all')
    list = list.filter(t => t.category === currentCat);

  if (currentFilter === 'active')
    list = list.filter(t => !t.completed);
  else if (currentFilter === 'completed')
    list = list.filter(t => t.completed);

  if (currentSearch)
    list = list.filter(t => t.text.toLowerCase().includes(currentSearch.toLowerCase()));

  if (currentSort === 'oldest')
    list.sort((a,b) => a.id - b.id);
  else if (currentSort === 'priority')
    list.sort((a,b) => priorityVal(b.priority) - priorityVal(a.priority));
  else if (currentSort === 'duedate')
    list.sort((a,b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  else if (currentSort === 'az')
    list.sort((a,b) => a.text.localeCompare(b.text));
  else
    list.sort((a,b) => b.id - a.id);

  return list;
}

// ---- Render ----
function renderTasks() {
  taskList.innerHTML = '';
  const filtered = getFilteredTasks();

  if (filtered.length === 0) {
    taskList.innerHTML = '<li class="empty-state">✨ No tasks here!</li>';
  }

  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.draggable = true;
    li.dataset.id = task.id;

    const dueInfo = getDueDateLabel(task.dueDate);
    const dueDateHTML = dueInfo
      ? `<span class="due-date ${dueInfo.cls}">${dueInfo.label}</span>` : '';

    const subtaskCount = task.subtasks ? task.subtasks.length : 0;
    const subtaskDone  = task.subtasks ? task.subtasks.filter(s => s.done).length : 0;
    const subtaskLabel = subtaskCount > 0 ? `${subtaskDone}/${subtaskCount}` : '+';

    // Main row
    const mainDiv = document.createElement('div');
    mainDiv.className = 'task-main';
    mainDiv.innerHTML = `
      <span class="drag-handle">⠿</span>
      <input type="checkbox" ${task.completed ? 'checked' : ''} data-id="${task.id}" />
      <span class="priority-badge priority-${task.priority}">${task.priority}</span>
      <span class="cat-badge">${categoryLabel(task.category)}</span>
      <span class="task-text" data-id="${task.id}">${task.text}</span>
      ${dueDateHTML}
      <div class="task-actions">
        <button class="subtask-toggle" data-id="${task.id}" title="Subtasks">📋 ${subtaskLabel}</button>
        <button class="delete-btn" data-id="${task.id}">×</button>
      </div>
    `;

    // Double click to edit
    mainDiv.querySelector('.task-text').addEventListener('dblclick', () => startEdit(task.id, mainDiv));

    // Subtask section
    const subSection = document.createElement('div');
    subSection.className = 'subtask-section';
    subSection.dataset.id = task.id;
    subSection.innerHTML = `
      <div class="subtask-input-row">
        <input type="text" class="subtask-input" placeholder="Add subtask..." data-id="${task.id}" />
        <button class="subtask-add-btn" data-id="${task.id}">Add</button>
      </div>
      ${(task.subtasks || []).map((s, si) => `
        <div class="subtask-item ${s.done ? 'done' : ''}" data-taskid="${task.id}" data-si="${si}">
          <input type="checkbox" ${s.done ? 'checked' : ''} class="subtask-check" data-taskid="${task.id}" data-si="${si}" />
          <span>${s.text}</span>
          <button class="subtask-del" data-taskid="${task.id}" data-si="${si}">×</button>
        </div>
      `).join('')}
    `;

    // Drag events
    li.addEventListener('dragstart', (e) => {
      dragSrcIndex = tasks.findIndex(t => t.id === task.id);
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      document.querySelectorAll('.task-item').forEach(el => el.classList.remove('drag-over'));
    });
    li.addEventListener('dragover', (e) => { e.preventDefault(); li.classList.add('drag-over'); });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      li.classList.remove('drag-over');
      const dropIndex = tasks.findIndex(t => t.id === task.id);
      if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;
      const moved = tasks.splice(dragSrcIndex, 1)[0];
      tasks.splice(dropIndex, 0, moved);
      dragSrcIndex = null;
      saveTasks(); renderTasks();
    });

    li.appendChild(mainDiv);
    li.appendChild(subSection);
    taskList.appendChild(li);
  });

  updateStats();
}

// ---- Category Label ----
function categoryLabel(cat) {
  const map = { personal:'👤', work:'💼', study:'📚', health:'❤️', other:'📌' };
  return (map[cat] || '📌') + ' ' + (cat || 'other');
}

// ---- Update Stats ----
function updateStats() {
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.completed) return false;
    return new Date(t.dueDate) < today;
  }).length;

  document.getElementById('statTotal').textContent   = tasks.length;
  document.getElementById('statActive').textContent  = tasks.filter(t => !t.completed).length;
  document.getElementById('statDone').textContent    = tasks.filter(t => t.completed).length;
  document.getElementById('statOverdue').textContent = overdue;

  const remaining = tasks.filter(t => !t.completed).length;
  taskCount.textContent = `${remaining} task${remaining !== 1 ? 's' : ''} remaining`;
}

// ---- Inline Edit ----
function startEdit(id, mainDiv) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const textSpan = mainDiv.querySelector('.task-text');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'edit-input';
  input.value = task.text;
  textSpan.replaceWith(input);
  input.focus();
  function saveEdit() {
    const newText = input.value.trim();
    if (newText) task.text = newText;
    saveTasks(); renderTasks();
  }
  input.addEventListener('blur', saveEdit);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') saveEdit(); });
}

// ---- Add Task ----
function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;
  tasks.unshift({
    id: Date.now(),
    text,
    completed: false,
    priority: prioritySelect.value,
    category: categorySelect.value,
    dueDate: dueDateInput.value || null,
    subtasks: []
  });
  saveTasks(); renderTasks();
  taskInput.value = '';
  dueDateInput.value = '';
  prioritySelect.value = 'medium';
  taskInput.focus();
}

// ---- Toggle Task ----
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed) launchConfetti();
  saveTasks(); renderTasks();
}

// ---- Delete Task ----
function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(); renderTasks();
}

// ---- Subtask Logic ----
function addSubtask(taskId, text) {
  const task = tasks.find(t => t.id === taskId);
  if (!task || !text.trim()) return;
  task.subtasks = task.subtasks || [];
  task.subtasks.push({ text: text.trim(), done: false });
  saveTasks(); renderTasks();
  // Reopen subtask panel
  setTimeout(() => {
    const section = document.querySelector(`.subtask-section[data-id="${taskId}"]`);
    if (section) section.classList.add('open');
  }, 10);
}

function toggleSubtask(taskId, si) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks[si].done = !task.subtasks[si].done;
  saveTasks(); renderTasks();
  setTimeout(() => {
    const section = document.querySelector(`.subtask-section[data-id="${taskId}"]`);
    if (section) section.classList.add('open');
  }, 10);
}

function deleteSubtask(taskId, si) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  task.subtasks.splice(si, 1);
  saveTasks(); renderTasks();
}

// ---- Confetti ----
function launchConfetti() {
  const canvas  = document.getElementById('confettiCanvas');
  const ctx     = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 8 + 4,
    d: Math.random() * 120 + 20,
    color: ['#a78bfa','#f472b6','#34d399','#fbbf24','#60a5fa','#f87171'][Math.floor(Math.random()*6)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.tiltAngle += p.tiltSpeed;
      p.y += (Math.cos(frame / 30) + p.d / 30) * 1.5;
      p.tilt = Math.sin(p.tiltAngle) * 12;
      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });
    frame++;
    if (frame < 150) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

// ---- Export CSV ----
document.getElementById('exportCSV').addEventListener('click', () => {
  const rows = [['Task','Priority','Category','Due Date','Status']];
  tasks.forEach(t => rows.push([
    t.text, t.priority, t.category || 'other',
    t.dueDate || '-', t.completed ? 'Done' : 'Active'
  ]));
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  a.download = 'tasks.csv';
  a.click();
});

// ---- Export PDF ----
document.getElementById('exportPDF').addEventListener('click', () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('TaskMaster Pro — My Tasks', 14, 20);
  doc.setFontSize(11);
  let y = 32;
  tasks.forEach((t, i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const status = t.completed ? '✓' : '○';
    doc.text(`${status}  ${t.text}  [${t.priority}] [${t.category || 'other'}] ${t.dueDate || ''}`, 14, y);
    y += 8;
  });
  doc.save('tasks.pdf');
});

// ---- Clear Completed ----
document.getElementById('clearCompleted').addEventListener('click', () => {
  tasks = tasks.filter(t => !t.completed);
  saveTasks(); renderTasks();
});

// ---- Event Delegation ----
addBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

taskList.addEventListener('click', e => {
  const id    = Number(e.target.dataset.id);
  const taskId = Number(e.target.dataset.taskid);
  const si    = Number(e.target.dataset.si);

  if (e.target.type === 'checkbox' && id)     toggleTask(id);
  if (e.target.classList.contains('delete-btn') && id) deleteTask(id);

  // Subtask toggle panel
  if (e.target.classList.contains('subtask-toggle') && id) {
    const section = document.querySelector(`.subtask-section[data-id="${id}"]`);
    if (section) section.classList.toggle('open');
  }

  // Subtask add
  if (e.target.classList.contains('subtask-add-btn') && taskId) {
    const inp = document.querySelector(`.subtask-input[data-id="${taskId}"]`);
    if (inp) { addSubtask(taskId, inp.value); inp.value = ''; }
  }

  // Subtask checkbox
  if (e.target.classList.contains('subtask-check')) toggleSubtask(taskId, si);

  // Subtask delete
  if (e.target.classList.contains('subtask-del')) deleteSubtask(taskId, si);
});

// Subtask input Enter key
taskList.addEventListener('keypress', e => {
  if (e.key === 'Enter' && e.target.classList.contains('subtask-input')) {
    const taskId = Number(e.target.dataset.id);
    addSubtask(taskId, e.target.value);
    e.target.value = '';
  }
});

filterBtns.forEach(btn => btn.addEventListener('click', () => {
  filterBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderTasks();
}));

pillBtns.forEach(btn => btn.addEventListener('click', () => {
  pillBtns.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCat = btn.dataset.cat;
  renderTasks();
}));

searchInput.addEventListener('input', e => {
  currentSearch = e.target.value;
  renderTasks();
});

sortSelect.addEventListener('change', e => {
  currentSort = e.target.value;
  renderTasks();
});

// ---- Init ----
renderTasks();