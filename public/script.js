let currentToken = null;
let currentEmail = null;
let editingTodoId = null;

function showError(msg) {
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    setTimeout(() => errorDiv.style.display = 'none', 3000);
}

function showSuccess(msg) {
    const successDiv = document.getElementById('successMsg');
    successDiv.textContent = msg;
    successDiv.style.display = 'block';
    setTimeout(() => successDiv.style.display = 'none', 3000);
}

async function register() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Wypełnij wszystkie pola');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            showSuccess('Rejestracja udana! Możesz się zalogować.');
            document.getElementById('showRegister').click();
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError('Błąd połączenia');
    }
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError('Wypełnij wszystkie pola');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (data.success) {
            currentToken = data.token;
            currentEmail = data.email;
            localStorage.setItem('token', currentToken);
            localStorage.setItem('email', currentEmail);
            showTodoApp();
            loadTodos();
        } else {
            showError(data.error);
        }
    } catch (err) {
        showError('Błąd połączenia');
    }
}


function validateTaskForm(task, dueDate, sendReminder) {
    const taskText = (task !== undefined ? task : document.getElementById('newTask').value).trim();

    if (taskText === "") { 
        showError('Treść zadania nie może być pusta');
        return false;
    }

    const dateVal = dueDate !== undefined ? dueDate : document.getElementById('taskDate').value;
    const reminder = sendReminder !== undefined ? sendReminder : document.getElementById('sendReminder').checked;

    const errorDiv = document.getElementById('errorMsg');
    const modalError = document.getElementById('modalError');

    const currentError = (modalError && modalError.offsetParent !== null) ? modalError : errorDiv;

    if (!taskText) {
        if (currentError) {
            currentError.textContent = 'Treść zadania nie może być pusta';
            currentError.style.display = 'block';
        }
        return false;
    }
    
    if (dateVal) {
        const selectedDate = new Date(dateVal);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            if (currentError) {
                currentError.textContent = 'Data nie może być z przeszłości';
                currentError.style.display = 'block';
            }
            return false;
        }
    } else if (reminder) {
        if (currentError) {
            currentError.textContent = 'Ustaw termin, aby otrzymać przypomnienie';
            currentError.style.display = 'block';
        }
        return false;
    }

    return true;
}

async function loadTodos() {
    try {
        const response = await fetch('/api/todos', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        const todos = await response.json();
        displayTodos(todos);
    } catch (err) {
        showError('Błąd ładowania zadań');
    }
}

async function addTodo() {
    const task = document.getElementById('newTask').value;
    const date = document.getElementById('taskDate').value;
    const sendReminder = document.getElementById('sendReminder').checked;

    if (!validateTaskForm(task, date, sendReminder)) return;

    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ 
                task, 
                dueDate: date || null, 
                sendReminder 
            })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('newTask').value = '';
            document.getElementById('taskDate').value = '';
            document.getElementById('sendReminder').checked = false;
            showSuccess('Zadanie dodane!');
            await loadTodos();
        }
    } catch (err) {
        showError('Błąd dodawania');
    }
}

async function toggleTodo(id, completed) {
    try {
        await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ completed: !completed })
        });
        loadTodos();
    } catch (err) {
        showError('Błąd aktualizacji');
    }
}

async function deleteTodo(id) {
    if (!confirm('Usunąć to zadanie?')) return;
    try {
        await fetch(`/api/todos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });
        loadTodos();
        showSuccess('Zadanie usunięte!');
    } catch (err) {
        showError('Błąd usuwania');
    }
}

function openEditModal(id, text, date, reminder) {
    editingTodoId = id;
    if (typeof global !== 'undefined') global.editingTodoId = id;

    document.getElementById('editTaskText').value = text;
    document.getElementById('editTaskDate').value = date ? date.split('T')[0] : '';
    document.getElementById('editSendReminder').checked = !!reminder;
    document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
    editingTodoId = null;
    if (typeof global !== 'undefined') global.editingTodoId = null; 
    
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('modalError').style.display = 'none';
}

function showModalError(msg) {
    const el = document.getElementById('modalError');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

async function saveEdit() {
    const id = editingTodoId || (typeof global !== 'undefined' ? global.editingTodoId : null);
    
    const task = document.getElementById('editTaskText').value;
    const date = document.getElementById('editTaskDate').value;
    const sendReminder = document.getElementById('editSendReminder').checked;
	
    if (!validateTaskForm(task, date, sendReminder)) return;

    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ task, dueDate: date || null, sendReminder })
        });

        if (response.ok) {
            closeModal();
            await loadTodos();
        }
    } catch (err) {
        showError('Błąd zapisu');
    }
}

function displayTodos(todos) {
    const todoList = document.getElementById('todoList');
    todoList.innerHTML = '';

    if (todos.length === 0) {
        todoList.innerHTML = '<p style="text-align:center; color:#666;">Brak zadań do wyświetlenia.</p>';
        return;
    }

    todos.forEach(todo => {
        const safeTaskForDisplay = todo.task.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeTaskForAttribute = todo.task.replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        const div = document.createElement('div');
        div.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        
        div.innerHTML = `
            <input type="checkbox" class="checkbox" 
                ${todo.completed ? 'checked' : ''} 
                onchange="toggleTodo('${todo._id}', ${todo.completed})">
            <div class="task-info" style="flex: 1; margin-left: 10px;">
                <span class="task-text">${safeTaskForDisplay}</span>
                <small style="display:block; color:#666; font-size: 11px; margin-top: 4px;">
                    📅 Termin: ${todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : 'Brak daty'}
                </small>
            </div>
            <div class="todo-actions">
                <button class="edit-btn" 
                    onclick="openEditModal('${todo._id}', '${safeTaskForAttribute}', '${todo.dueDate || ''}', ${todo.sendReminder})">✏️</button>
                <button class="delete-btn" onclick="deleteTodo('${todo._id}')">🗑</button>
            </div>
        `;
        todoList.appendChild(div);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTodoApp() {
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('todoApp').style.display = 'block';
    document.getElementById('userEmail').textContent = currentEmail || '';
}

function showAuthForm() {
    document.getElementById('authForm').style.display = 'block';
    document.getElementById('todoApp').style.display = 'none';
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
    currentToken = null;
    currentEmail = null;
    localStorage.removeItem('token');
    localStorage.removeItem('email');
}

function logout() {
    showAuthForm();
}

if (typeof module === 'undefined') {
	// Event listeners
    document.getElementById('loginBtn').onclick  = login;
    document.getElementById('logoutBtn').onclick = logout;
    document.getElementById('showRegister').onclick = () => {
        const btn    = document.getElementById('loginBtn');
        const toggle = document.getElementById('showRegister');
        if (btn.textContent === 'Zaloguj się') {
            btn.textContent = 'Zarejestruj się';
            btn.onclick = register;
            toggle.textContent = 'Masz już konto? Zaloguj się';
            toggle.onclick = () => {
                btn.textContent = 'Zaloguj się';
                btn.onclick = login;
                toggle.textContent = 'Nie masz konta? Zarejestruj się';
                toggle.onclick = () => location.reload();
            };
        }
    };

    const savedToken = localStorage.getItem('token');
    const savedEmail = localStorage.getItem('email');
    if (savedToken && savedEmail) {
        currentToken = savedToken;
        currentEmail = savedEmail;
        showTodoApp();
        loadTodos();
    }

    window.onclick = function(event) {
        const modal = document.getElementById('editModal');
        if (event.target === modal) closeModal();
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showError, showSuccess, register, login, addTodo,
        loadTodos, deleteTodo, openEditModal, saveEdit,
        closeModal, displayTodos, showTodoApp, showAuthForm,
        validateTaskForm, toggleTodo
    };
}