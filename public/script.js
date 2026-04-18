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
    if (!task.trim()) return;

    try {
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ task })
        });
        const data = await response.json();
        if (data.success) {
            document.getElementById('newTask').value = '';
            loadTodos();
            showSuccess('Zadanie dodane!');
        }
    } catch (err) {
        showError('Błąd dodawania zadania');
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

function openEditModal(id, currentText) {
    editingTodoId = id;
    document.getElementById('editTaskText').value = currentText;
    document.getElementById('editModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
    editingTodoId = null;
}

async function saveEdit() {
    const newText = document.getElementById('editTaskText').value;
    if (!newText.trim()) {
        showError('Treść zadania nie może być pusta');
        return;
    }

    try {
        await fetch(`/api/todos/${editingTodoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({ task: newText })
        });
        closeModal();
        loadTodos();
        showSuccess('Zadanie zaktualizowane!');
    } catch (err) {
        showError('Błąd edycji');
    }
}

function displayTodos(todos) {
    const todoList = document.getElementById('todoList');
    if (todos.length === 0) {
        todoList.innerHTML = '<p style="text-align:center; color:#999;">Brak zadań. Dodaj pierwsze zadanie!</p>';
        return;
    }

    todoList.innerHTML = todos.map(todo => `
        <div class="todo-item ${todo.completed ? 'completed' : ''}">
            <input type="checkbox" class="checkbox" ${todo.completed ? 'checked' : ''} onchange="toggleTodo('${todo._id}', ${todo.completed})">
            <span class="task-text">${escapeHtml(todo.task)}</span>
            <button class="edit-btn" onclick="openEditModal('${todo._id}', '${escapeHtml(todo.task)}')">✏️ Edytuj</button>
            <button class="delete-btn" onclick="deleteTodo('${todo._id}')">🗑 Usuń</button>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTodoApp() {
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('todoApp').style.display = 'block';
    document.getElementById('userEmail').textContent = currentEmail;
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

// Event listeners
document.getElementById('loginBtn').onclick = login;
document.getElementById('logoutBtn').onclick = logout;
document.getElementById('showRegister').onclick = () => {
    const btn = document.getElementById('loginBtn');
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

// Sprawdź czy użytkownik był zalogowany
const savedToken = localStorage.getItem('token');
const savedEmail = localStorage.getItem('email');
if (savedToken && savedEmail) {
    currentToken = savedToken;
    currentEmail = savedEmail;
    showTodoApp();
    loadTodos();
}

// Zamknij modal klikając poza nim
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeModal();
    }
}