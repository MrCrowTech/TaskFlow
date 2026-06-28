

(function () {
  "use strict";

  // constants
  const STORAGE_KEY = "taskflow.tasks.v1";
  const THEME_KEY = "taskflow.theme.v1";
  const STATUSES = ["todo", "doing", "done"];
  const STATUS_LABELS = { todo: "To do", doing: "In progress", done: "Done" };

  // state
  let tasks = [];
  let filter = "all";
  let searchQuery = "";
  let editingId = null;
  let pendingStatus = "todo";

  // dom
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const els = {
    board: $("#board"),
    lists: {
      todo: $("#listTodo"),
      doing: $("#listDoing"),
      done: $("#listDone"),
    },
    counts: {
      todo: $("#countTodo"),
      doing: $("#countDoing"),
      done: $("#countDone"),
    },
    stats: {
      total: $("#statTotal"),
      todo: $("#statTodo"),
      doing: $("#statDoing"),
      done: $("#statDone"),
      progress: $("#statProgress"),
    },
    searchInput: $("#searchInput"),
    filterChips: $$(".chip"),
    themeToggle: $("#themeToggle"),
    newTaskBtn: $("#newTaskBtn"),
    clearDoneBtn: $("#clearDoneBtn"),
    modal: $("#taskModal"),
    modalTitle: $("#modalTitle"),
    form: $("#taskForm"),
    inputId: $("#taskId"),
    inputTitle: $("#taskTitle"),
    inputDesc: $("#taskDesc"),
    inputPriority: $("#taskPriority"),
    inputDue: $("#taskDue"),
    inputStatus: $("#taskStatus"),
    deleteBtn: $("#deleteTaskBtn"),
    saveBtn: $("#saveTaskBtn"),
    toast: $("#toast"),
  };

  // storage
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedDefaults();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return seedDefaults();
      return parsed.map(normalizeTask).filter(Boolean);
    } catch (err) {
      console.warn("Failed to load tasks:", err);
      return seedDefaults();
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.warn("Failed to save tasks:", err);
    }
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (_) {}
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
  }

  function normalizeTask(t) {
    if (!t || typeof t !== "object") return null;
    if (!t.id || typeof t.id !== "string") return null;
    if (!STATUSES.includes(t.status)) t.status = "todo";
    if (!["low", "medium", "high"].includes(t.priority)) t.priority = "medium";
    return {
      id: t.id,
      title: String(t.title || "").trim() || "Untitled",
      description: String(t.description || ""),
      priority: t.priority,
      due: t.due || "",
      status: t.status,
      createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
      order: typeof t.order === "number" ? t.order : 0,
    };
  }

  function seedDefaults() {
    const now = Date.now();
    return [
      {
        id: makeId(),
        title: "Welcome to TaskFlow 👋",
        description: "Drag this card between columns to organize your work. Click to edit, or use the + button to add a new task.",
        priority: "high",
        due: "",
        status: "todo",
        createdAt: now,
        order: 0,
      },
      {
        id: makeId(),
        title: "Try the dark mode toggle",
        description: "Tap the sun/moon icon in the header to switch themes. Your preference is remembered.",
        priority: "medium",
        due: "",
        status: "doing",
        createdAt: now + 1,
        order: 0,
      },
      {
        id: makeId(),
        title: "Everything saves automatically",
        description: "All your tasks are stored in your browser via localStorage. No account needed.",
        priority: "low",
        due: "",
        status: "done",
        createdAt: now + 2,
        order: 0,
      },
    ];
  }

  function makeId() {
    return "t_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }

  // theme
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    els.themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    saveTheme(next);
  }

  // render
  function render() {
    STATUSES.forEach((status) => {
      const list = els.lists[status];
      const filtered = tasks
        .filter((t) => t.status === status)
        .filter(matchesFilter)
        .filter(matchesSearch)
        .sort(sortByOrder);

      list.innerHTML = "";

      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 4v4M16 4v4" />
          </svg>
          <div>${hasAnyTaskInStatus(status) ? "No matches" : "No tasks yet"}</div>
        `;
        list.appendChild(empty);
      } else {
        filtered.forEach((task) => list.appendChild(renderTask(task)));
      }

      els.counts[status].textContent = filtered.length;
    });

    updateStats();
  }

  function hasAnyTaskInStatus(status) {
    return tasks.some((t) => t.status === status);
  }

  function matchesFilter(task) {
    if (filter === "all") return true;
    return task.priority === filter;
  }

  function matchesSearch(task) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(q) ||
      task.description.toLowerCase().includes(q)
    );
  }

  function sortByOrder(a, b) {
    if (a.order !== b.order) return a.order - b.order;
    return a.createdAt - b.createdAt;
  }

  function renderTask(task) {
    const card = document.createElement("article");
    card.className = "task" + (task.status === "done" ? " completed" : "");
    card.draggable = true;
    card.dataset.id = task.id;

    const dueHtml = task.due ? renderDue(task.due) : "";

    card.innerHTML = `
      <div class="task-head">
        <div class="task-title"></div>
        <span class="priority-tag priority-${task.priority}">${task.priority}</span>
      </div>
      ${task.description ? `<p class="task-desc"></p>` : ""}
      <div class="task-foot">
        <div class="task-meta">${dueHtml}</div>
        <div class="task-actions">
          <button class="task-action" data-action="edit" title="Edit task" aria-label="Edit task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <button class="task-action danger" data-action="delete" title="Delete task" aria-label="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector(".task-title").textContent = task.title;
    const descEl = card.querySelector(".task-desc");
    if (descEl) descEl.textContent = task.description;

    card.addEventListener("click", (e) => {
      const action = e.target.closest("[data-action]")?.dataset.action;
      if (action === "edit") openModalEdit(task.id);
      else if (action === "delete") deleteTask(task.id);
      else openModalEdit(task.id);
    });

    card.addEventListener("dragstart", onDragStart);
    card.addEventListener("dragend", onDragEnd);

    return card;
  }

  function renderDue(dueStr) {
    const date = new Date(dueStr + "T00:00:00");
    if (isNaN(date.getTime())) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

    let cls = "";
    if (diffDays < 0) cls = "is-overdue";
    else if (diffDays === 0) cls = "is-today";

    const label = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `
      <span class="due ${cls}" title="Due ${label}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        ${label}
      </span>
    `;
  }

  function updateStats() {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const doing = tasks.filter((t) => t.status === "doing").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    els.stats.total.textContent = total;
    els.stats.todo.textContent = todo;
    els.stats.doing.textContent = doing;
    els.stats.done.textContent = done;
    els.stats.progress.textContent = progress;
  }

  // drag and drop
  let draggedId = null;

  function onDragStart(e) {
    const card = e.currentTarget;
    draggedId = card.dataset.id;
    card.classList.add("is-dragging");
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", draggedId); } catch (_) {}
  }

  function onDragEnd(e) {
    e.currentTarget.classList.remove("is-dragging");
    $$(".column").forEach((c) => c.classList.remove("is-drag-over"));
    $$(".task-list").forEach((l) => l.classList.remove("drag-over-empty"));
    draggedId = null;
  }

  function onColumnDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const column = e.currentTarget.closest(".column") || e.currentTarget;
    if (column) column.classList.add("is-drag-over");

    const list = e.currentTarget.classList.contains("task-list")
      ? e.currentTarget
      : e.currentTarget.querySelector(".task-list");
    if (list && list.children.length === 0) list.classList.add("drag-over-empty");
  }

  function onColumnDragLeave(e) {
    const related = e.relatedTarget;
    const column = e.currentTarget.closest ? e.currentTarget.closest(".column") : null;
    if (!column) return;
    if (!related || !column.contains(related)) {
      column.classList.remove("is-drag-over");
      const list = column.querySelector(".task-list");
      if (list) list.classList.remove("drag-over-empty");
    }
  }

  function onColumnDrop(e) {
    e.preventDefault();
    const column = e.currentTarget.closest(".column") || e.currentTarget;
    if (!column) return;
    const status = column.dataset.status;
    column.classList.remove("is-drag-over");
    const list = column.querySelector(".task-list");
    if (list) list.classList.remove("drag-over-empty");

    const id = draggedId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
    if (!id) return;

    moveTaskTo(id, status, e.clientY, list);
  }

  function moveTaskTo(id, status, clientY, listEl) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    let insertIndex = null;
    if (listEl && clientY != null) {
      const cards = Array.from(listEl.querySelectorAll(".task:not(.is-dragging)"));
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          insertIndex = i;
          break;
        }
      }
      if (insertIndex === null) insertIndex = cards.length;
    }

    const sameColumn = task.status === status;
    task.status = status;

    const destTasks = tasks
      .filter((t) => t.status === status && t.id !== id)
      .sort(sortByOrder);

    if (insertIndex === null || insertIndex > destTasks.length) {
      destTasks.push(task);
    } else {
      destTasks.splice(insertIndex, 0, task);
    }

    destTasks.forEach((t, idx) => { t.order = idx; });

    STATUSES.forEach((s) => {
      if (s === status) return;
      tasks
        .filter((t) => t.status === s)
        .sort(sortByOrder)
        .forEach((t, idx) => (t.order = idx));
    });

    saveTasks();
    render();

    if (!sameColumn) {
      toast(`Moved to ${STATUS_LABELS[status]}`);
    }
  }

  // modal
  function openModalNew(status = "todo") {
    editingId = null;
    pendingStatus = status;
    els.modalTitle.textContent = "New task";
    els.inputId.value = "";
    els.inputTitle.value = "";
    els.inputDesc.value = "";
    els.inputPriority.value = "medium";
    els.inputDue.value = "";
    els.inputStatus.value = status;
    els.deleteBtn.hidden = true;
    els.saveBtn.textContent = "Create task";
    showModal();
    setTimeout(() => els.inputTitle.focus(), 50);
  }

  function openModalEdit(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    editingId = id;
    els.modalTitle.textContent = "Edit task";
    els.inputId.value = task.id;
    els.inputTitle.value = task.title;
    els.inputDesc.value = task.description;
    els.inputPriority.value = task.priority;
    els.inputDue.value = task.due || "";
    els.inputStatus.value = task.status;
    els.deleteBtn.hidden = false;
    els.saveBtn.textContent = "Save changes";
    showModal();
    setTimeout(() => els.inputTitle.focus(), 50);
  }

  function showModal() {
    els.modal.hidden = false;
    els.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function hideModal() {
    els.modal.hidden = true;
    els.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    editingId = null;
  }

  function submitForm(e) {
    e.preventDefault();
    const title = els.inputTitle.value.trim();
    if (!title) {
      els.inputTitle.focus();
      return;
    }
    const data = {
      title,
      description: els.inputDesc.value.trim(),
      priority: els.inputPriority.value,
      due: els.inputDue.value || "",
      status: els.inputStatus.value,
    };

    if (editingId) {
      const task = tasks.find((t) => t.id === editingId);
      if (task) Object.assign(task, data);
      toast("Task updated");
    } else {
      const maxOrder = tasks
        .filter((t) => t.status === data.status)
        .reduce((m, t) => Math.max(m, t.order), -1);
      tasks.push({
        id: makeId(),
        ...data,
        createdAt: Date.now(),
        order: maxOrder + 1,
      });
      toast("Task created");
    }

    saveTasks();
    render();
    hideModal();
  }

  function deleteTask(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const ok = confirm(`Delete "${task.title}"? This cannot be undone.`);
    if (!ok) return;
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks();
    render();
    toast("Task deleted");
    if (editingId === id) hideModal();
  }

  function clearDone() {
    const count = tasks.filter((t) => t.status === "done").length;
    if (count === 0) {
      toast("Done column is empty");
      return;
    }
    const ok = confirm(`Remove all ${count} completed task${count > 1 ? "s" : ""}?`);
    if (!ok) return;
    tasks = tasks.filter((t) => t.status !== "done");
    saveTasks();
    render();
    toast(`Cleared ${count} task${count > 1 ? "s" : ""}`);
  }

  // toast
  let toastTimer = null;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add("is-show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("is-show");
      setTimeout(() => (els.toast.hidden = true), 250);
    }, 1800);
  }

  // rire up
  function attachEvents() {
    els.searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      render();
    });

    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        els.filterChips.forEach((c) => {
          c.classList.remove("is-active");
          c.setAttribute("aria-selected", "false");
        });
        chip.classList.add("is-active");
        chip.setAttribute("aria-selected", "true");
        filter = chip.dataset.filter;
        render();
      });
    });

    els.themeToggle.addEventListener("click", toggleTheme);

    els.newTaskBtn.addEventListener("click", () => openModalNew("todo"));

    $$(".column-add").forEach((btn) => {
      btn.addEventListener("click", () => openModalNew(btn.dataset.add));
    });

    els.clearDoneBtn.addEventListener("click", clearDone);

    $$("[data-close]").forEach((el) => el.addEventListener("click", hideModal));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.modal.hidden) hideModal();
    });

    els.form.addEventListener("submit", submitForm);
    els.deleteBtn.addEventListener("click", () => {
      if (editingId) deleteTask(editingId);
    });

    $$(".column").forEach((column) => {
      column.addEventListener("dragover", onColumnDragOver);
      column.addEventListener("dragleave", onColumnDragLeave);
      column.addEventListener("drop", onColumnDrop);
    });
    $$(".task-list").forEach((list) => {
      list.addEventListener("dragover", onColumnDragOver);
      list.addEventListener("drop", onColumnDrop);
    });
  }

  // init
  function init() {
    applyTheme(loadTheme());
    tasks = loadTasks();
    attachEvents();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();