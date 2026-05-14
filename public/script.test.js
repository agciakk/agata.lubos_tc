/**
 * Testy jednostkowe dla script.js
 * Uruchomienie: npm test
 * Wymagania:  npm install --save-dev jest jest-environment-jsdom
 */

const { deleteTodo, saveEdit, addTodo, loadTodos, validateTaskForm, openEditModal, displayTodos, closeModal, showAuthForm, showTodoApp, login, register, toggleTodo} = require('./script');

// Setup – minimalny DOM wymagany przez script.js

function buildDOM() {
    document.body.innerHTML = `
        <!-- Komunikaty -->
        <div id="errorMsg"   style="display:none"></div>
        <div id="successMsg" style="display:none"></div>

        <!-- Auth -->
        <div id="authForm">
            <input id="email"    type="email" />
            <input id="password" type="password" />
            <button id="loginBtn">Zaloguj się</button>
            <div id="showRegister">Nie masz konta? Zarejestruj się</div>
        </div>

        <!-- Aplikacja -->
        <div id="todoApp" style="display:none">
            <span id="userEmail"></span>
            <button id="logoutBtn">Wyloguj</button>
            <input id="newTask" />
            <input id="taskDate" type="date" />
            <input id="sendReminder" type="checkbox" />
            <div   id="todoList"></div>
        </div>

        <!-- Modal edycji -->
        <div id="editModal" style="display:none">
            <textarea id="editTaskText"></textarea>
            <input    id="editTaskDate"     type="date" />
            <input    id="editSendReminder" type="checkbox" />
            <div      id="modalError" style="display:none"></div>
        </div>
    `;
}

// Ładujemy script.js po zbudowaniu DOM
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    localStorage.clear();

    buildDOM();

    // Blokujemy globalny fetch – każdy test mockuje go sam
    global.fetch = jest.fn();

    // Wczytujemy moduł na świeżo przy każdym teście
    require('./script.js');
});


// validateTaskForm

describe('validateTaskForm', () => {
    test('zwraca false i pokazuje błąd gdy task jest pusty', () => {
        const result = validateTaskForm('   ', '', false);
        expect(result).toBe(false);
        expect(document.getElementById('errorMsg').style.display).toBe('block');
    });

    test('zwraca false gdy data jest w przeszłości', () => {
        const result = validateTaskForm('Zadanie', '2000-01-01', false);
        expect(result).toBe(false);
        expect(document.getElementById('errorMsg').textContent).toMatch(/przeszłości/);
    });

    test('zwraca false gdy reminder=true ale brak daty', () => {
        const result = validateTaskForm('Zadanie', '', true);
        expect(result).toBe(false);
        expect(document.getElementById('errorMsg').textContent).toMatch(/termin/i);
    });

    test('zwraca true dla poprawnych danych bez daty', () => {
        expect(validateTaskForm('Zadanie', '', false)).toBe(true);
    });

    test('zwraca true dla poprawnych danych z datą w przyszłości', () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        const dateStr = future.toISOString().split('T')[0];
        expect(validateTaskForm('Zadanie', dateStr, false)).toBe(true);
    });

    test('zwraca true gdy reminder=true i jest data w przyszłości', () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        const dateStr = future.toISOString().split('T')[0];
        expect(validateTaskForm('Zadanie', dateStr, true)).toBe(true);
    });

    test('akceptuje datę dzisiejszą (nie jest w przeszłości)', () => {
        const today = new Date().toISOString().split('T')[0];
        expect(validateTaskForm('Zadanie', today, false)).toBe(true);
    });
});

// showTodoApp / showAuthForm

describe('showTodoApp', () => {
    test('chowa formularz auth i pokazuje todoApp', async () => {
        document.getElementById('email').value    = 'jan@example.com';
        document.getElementById('password').value = 'haslo';
 
        fetch.mockResolvedValueOnce({
            json: async () => ({ success: true, token: 'tok', email: 'jan@example.com' })
        });
        fetch.mockResolvedValueOnce({ json: async () => [] }); // loadTodos
 
        await login();
 
        expect(document.getElementById('authForm').style.display).toBe('none');
        expect(document.getElementById('todoApp').style.display).toBe('block');
        expect(document.getElementById('userEmail').textContent).toBe('jan@example.com');
    });
});

describe('showAuthForm', () => {
    test('chowa todoApp, pokazuje auth i czyści pola', () => {
        document.getElementById('email').value    = 'jan@example.com';
        document.getElementById('password').value = 'secret';
        currentToken = 'abc';
        currentEmail = 'jan@example.com';

        showAuthForm();

        expect(document.getElementById('todoApp').style.display).toBe('none');
        expect(document.getElementById('authForm').style.display).toBe('block');
        expect(document.getElementById('email').value).toBe('');
        expect(document.getElementById('password').value).toBe('');
    });

    test('usuwa token z localStorage', () => {
        localStorage.setItem('token', 'abc');
        localStorage.setItem('email', 'jan@example.com');

        showAuthForm();

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('email')).toBeNull();
    });
});

// openEditModal / closeModal

describe('openEditModal', () => {
    test('wypełnia pola modalu i go pokazuje', () => {
        openEditModal('id123', 'Moje zadanie', '2030-06-15T00:00:00Z', true);

        expect(document.getElementById('editModal').style.display).toBe('block');
        expect(document.getElementById('editTaskText').value).toBe('Moje zadanie');
        expect(document.getElementById('editTaskDate').value).toBe('2030-06-15');
        expect(document.getElementById('editSendReminder').checked).toBe(true);
        expect(editingTodoId).toBe('id123');
    });

    test('ustawia pustą datę gdy dueDate jest false', () => {
        openEditModal('id456', 'Zadanie bez daty', '', false);
        expect(document.getElementById('editTaskDate').value).toBe('');
    });
});

describe('closeModal', () => {
    test('ukrywa modal i czyści editingTodoId', () => {
        openEditModal('id123', 'Zadanie', '', false);
        closeModal();

        expect(document.getElementById('editModal').style.display).toBe('none');
        expect(editingTodoId).toBeNull();
    });

    test('chowa modalError', () => {
        document.getElementById('modalError').style.display = 'block';
        closeModal();
        expect(document.getElementById('modalError').style.display).toBe('none');
    });
});

// displayTodos

describe('displayTodos', () => {
    test('pokazuje komunikat gdy lista jest pusta', () => {
        displayTodos([]);
        expect(document.getElementById('todoList').innerHTML).toMatch(/Brak zadań/);
    });
 
    test('renderuje pojedyncze zadanie', () => {
        displayTodos([{
            _id: 'abc1',
            task: 'Kupić mleko',
            completed: false,
            dueDate: '2030-01-01T00:00:00Z',
            sendReminder: false
        }]);
        const html = document.getElementById('todoList').innerHTML;
        expect(html).toContain('Kupić mleko');
        expect(html).toContain('abc1');
    });
 
    test('zadanie ukończone ma klasę "completed"', () => {
        displayTodos([{
            _id: 'abc2',
            task: 'Stare zadanie',
            completed: true,
            dueDate: null,
            sendReminder: false
        }]);
        expect(document.getElementById('todoList').innerHTML).toContain('completed');
    });
 
    test('escapuje HTML w treści zadania', () => {
        displayTodos([{
            _id: 'abc3',
            task: '<script>alert(1)</script>',
            completed: false,
            dueDate: null,
            sendReminder: false
        }]);
        const taskSpan = document.querySelector('.task-text');
        expect(taskSpan.textContent).toBe('<script>alert(1)</script>');
        expect(taskSpan.innerHTML).not.toContain('<script>');
        expect(taskSpan.innerHTML).toContain('&lt;script&gt;');
    });
 
    test('renderuje wiele zadań', () => {
        const todos = [
            { _id: '1', task: 'Zadanie A', completed: false, dueDate: null, sendReminder: false },
            { _id: '2', task: 'Zadanie B', completed: false, dueDate: null, sendReminder: false },
        ];
        displayTodos(todos);
        const items = document.querySelectorAll('.todo-item');
        expect(items.length).toBe(2);
    });
 
    test('wyświetla "Brak daty" gdy dueDate jest null', () => {
        displayTodos([{
            _id: 'abc4', task: 'Test', completed: false, dueDate: null, sendReminder: false
        }]);
        expect(document.getElementById('todoList').innerHTML).toContain('Brak daty');
    });
});

// login

describe('login', () => {
    test('pokazuje błąd gdy pola są puste', async () => {
        document.getElementById('email').value    = '';
        document.getElementById('password').value = '';

        await login();

        expect(fetch).not.toHaveBeenCalled();
        expect(document.getElementById('errorMsg').style.display).toBe('block');
    });

    test('udane logowanie zapisuje token w localStorage i pokazuje app', async () => {
        document.getElementById('email').value    = 'jan@example.com';
        document.getElementById('password').value = 'haslo123';

        fetch.mockResolvedValueOnce({
            json: async () => ({ success: true, token: 'tok_abc', email: 'jan@example.com' })
        });
        // loadTodos wywołuje drugi fetch
        fetch.mockResolvedValueOnce({ json: async () => [] });

        await login();

        expect(localStorage.getItem('token')).toBe('tok_abc');
        expect(localStorage.getItem('email')).toBe('jan@example.com');
        expect(document.getElementById('todoApp').style.display).toBe('block');
    });

    test('nieudane logowanie pokazuje błąd z serwera', async () => {
        document.getElementById('email').value    = 'x@x.com';
        document.getElementById('password').value = 'zle';

        fetch.mockResolvedValueOnce({
            json: async () => ({ success: false, error: 'Nieprawidłowe hasło' })
        });

        await login();

        expect(document.getElementById('errorMsg').textContent).toBe('Nieprawidłowe hasło');
    });
});

// register

describe('register', () => {
    test('pokazuje błąd gdy pola są puste', async () => {
        document.getElementById('email').value    = '';
        document.getElementById('password').value = '';

        await register();

        expect(fetch).not.toHaveBeenCalled();
    });

    test('udana rejestracja pokazuje sukces', async () => {
        document.getElementById('email').value    = 'new@example.com';
        document.getElementById('password').value = 'haslo123';

        fetch.mockResolvedValueOnce({
            json: async () => ({ success: true })
        });

        await register();

        expect(document.getElementById('successMsg').textContent).toMatch(/Rejestracja udana/);
    });

    test('nieudana rejestracja pokazuje błąd z serwera', async () => {
        document.getElementById('email').value    = 'dup@example.com';
        document.getElementById('password').value = 'pass';

        fetch.mockResolvedValueOnce({
            json: async () => ({ success: false, error: 'Email już istnieje' })
        });

        await register();

        expect(document.getElementById('errorMsg').textContent).toBe('Email już istnieje');
    });
});

// addTodo

describe('addTodo', () => {
    beforeEach(() => {
        currentToken = 'tok_test';
    });
 
    test('nie wywołuje fetch gdy walidacja nie przechodzi', async () => {
        document.getElementById('newTask').value = ''; 
 
        await addTodo();
 
        expect(fetch).not.toHaveBeenCalled();
    });
 
    test('wysyła POST /api/todos z poprawnymi danymi', async () => {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        const dateStr = future.toISOString().split('T')[0];
 
        document.getElementById('newTask').value        = 'Nowe zadanie';
        document.getElementById('taskDate').value       = dateStr;
        document.getElementById('sendReminder').checked = true;
 
        fetch.mockResolvedValueOnce({
            json: async () => ({ success: true })
        });
        fetch.mockResolvedValueOnce({ json: async () => [] });
 
        await addTodo();
 
        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe('/api/todos');
        expect(opts.method).toBe('POST');
        const body = JSON.parse(opts.body);
        expect(body.task).toBe('Nowe zadanie');
        expect(body.sendReminder).toBe(true);
    });
 
    test('czyści pola po udanym dodaniu', async () => {
    document.getElementById('newTask').value = 'Zadanie do wyczyszczenia';
    document.getElementById('taskDate').value = '2030-01-01';
    document.getElementById('sendReminder').checked = true;

    fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
    });

    fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [] 
    });

    await addTodo();

    expect(document.getElementById('newTask').value).toBe('');
    expect(document.getElementById('taskDate').value).toBe('');
    expect(document.getElementById('sendReminder').checked).toBe(false);
});
});

// toggleTodo

describe('toggleTodo', () => {
    beforeEach(() => { currentToken = 'tok_test'; });

    test('wysyła PUT z odwróconym stanem completed', async () => {
        fetch.mockResolvedValueOnce({ json: async () => ({}) });
        fetch.mockResolvedValueOnce({ json: async () => [] }); // loadTodos

        await toggleTodo('id_xyz', false);

        const [url, opts] = fetch.mock.calls[0];
        expect(url).toBe('/api/todos/id_xyz');
        expect(opts.method).toBe('PUT');
        expect(JSON.parse(opts.body).completed).toBe(true);
    });

    test('odwraca true → false', async () => {
        fetch.mockResolvedValueOnce({ json: async () => ({}) });
        fetch.mockResolvedValueOnce({ json: async () => [] });

        await toggleTodo('id_xyz', true);

        expect(JSON.parse(fetch.mock.calls[0][1].body).completed).toBe(false);
    });
});

// deleteTodo

describe('deleteTodo', () => {
    beforeEach(() => {
        currentToken = 'tok_test';
        global.confirm = jest.fn(() => true);
    });

    test('wysyła DELETE do poprawnego URL', async () => {
        fetch.mockResolvedValueOnce({});
        fetch.mockResolvedValueOnce({ json: async () => [] });

        await deleteTodo('del_id');

        expect(fetch.mock.calls[0][0]).toBe('/api/todos/del_id');
        expect(fetch.mock.calls[0][1].method).toBe('DELETE');
    });

    test('nie wysyła żądania gdy user anuluje confirm', async () => {
        global.confirm = jest.fn(() => false);

        await deleteTodo('del_id');

        expect(fetch).not.toHaveBeenCalled();
    });

    test('pokazuje sukces po usunięciu', async () => {
        fetch.mockResolvedValueOnce({});
        fetch.mockResolvedValueOnce({ json: async () => [] });

        await deleteTodo('del_id');

        expect(document.getElementById('successMsg').textContent).toMatch(/usunięte/i);
    });
});

// saveEdit (walidacja modalu)

describe('saveEdit – walidacja', () => {
    beforeEach(() => {
        currentToken = 'tok_test';
        openEditModal('edit_id', 'Placeholder', '', false);
        buildDOM();
        Object.defineProperty(document.getElementById('modalError'), 'offsetParent', {
            get: () => document.getElementById('editModal')
        });
    });
    test('pokazuje błąd gdy data w przeszłości', async () => {
        document.getElementById('editTaskText').value = 'Zadanie';
        document.getElementById('editTaskDate').value = '2000-01-01';
 
        await saveEdit();
 
        expect(fetch).not.toHaveBeenCalled();
        expect(document.getElementById('modalError').textContent).toMatch(/przeszłości/);
    });
 
    test('pokazuje błąd gdy reminder bez daty', async () => {
        document.getElementById('editTaskText').value       = 'Zadanie';
        document.getElementById('editTaskDate').value       = '';
        document.getElementById('editSendReminder').checked = true;
 
        await saveEdit();
 
        expect(fetch).not.toHaveBeenCalled();
        expect(document.getElementById('modalError').textContent).toMatch(/termin/i);
    });
 
    test('wysyła PUT i zamyka modal przy poprawnych danych', async () => {
        global.editingTodoId = 'edit_id';
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        const dateStr = future.toISOString().split('T')[0];
 
        document.getElementById('editTaskText').value       = 'Zaktualizowane zadanie';
        document.getElementById('editTaskDate').value       = dateStr;
        document.getElementById('editSendReminder').checked = false;
 
        fetch.mockResolvedValueOnce({ ok: true }); // PUT
        fetch.mockResolvedValueOnce({ ok: true, json: async () => [] }); // loadTodos

        await saveEdit();

        expect(fetch.mock.calls[0][0]).toBe('/api/todos/edit_id');
    });
});
