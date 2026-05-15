/**
 * Testy E2E frontendu – Cypress
 */

// Helpery 

const API = {
    register: '/api/register',
    login:    '/api/login',
    todos:    '/api/todos',
    todo:     (id) => `/api/todos/${id}`,
};

const FUTURE_DATE = '2099-12-31';

const SAMPLE_TODO = {
    _id:          'abc123',
    task:         'Kupić mleko',
    completed:    false,
    dueDate:      '2099-06-15T00:00:00.000Z',
    sendReminder: false,
};

/** Loguje przez UI i czeka na widok aplikacji.
 *  @param {string} email
 *  @param {Array}  todos  – lista zadań
 */
function loginViaUI(email = 'test@example.com', todos = []) {
    cy.intercept('POST', API.login, {
        success: true, token: 'tok_test', email
    }).as('loginReq');
    
    cy.intercept('GET', API.todos, todos).as('getTodos');

    cy.get('#email').should('be.visible').type(email);
    cy.get('#password').should('be.visible').type('haslo123');
    cy.get('#loginBtn').click();

    cy.wait('@loginReq');
    cy.wait('@getTodos');
}

beforeEach(() => {
    // Czyścimy localStorage przed każdym testem, żeby wymusić formularz logowania
    cy.window().then((win) => {
        win.localStorage.clear();
    });
    cy.visit('/');
});

// Auth

describe('Logowanie', () => {
    beforeEach(() => cy.visit('/'));

    it('pokazuje formularz logowania po wejściu na stronę', () => {
        cy.get('#authForm').should('be.visible');
        cy.get('#todoApp').should('not.be.visible');
    });

    it('pokazuje błąd gdy pola są puste', () => {
        cy.get('#loginBtn').click();
        cy.get('#errorMsg').should('be.visible').and('contain', 'Wypełnij wszystkie pola');
    });

    it('pokazuje błąd serwera przy złych danych', () => {
        cy.intercept('POST', API.login, {
            statusCode: 401,
            body: { success: false, error: 'Nieprawidłowe dane' }
        }).as('login');

        cy.get('#email').type('zly@example.com');
        cy.get('#password').type('zle');
        cy.get('#loginBtn').click();

        cy.wait('@login');
        cy.get('#errorMsg').should('be.visible').and('contain', 'Nieprawidłowe dane');
        cy.get('#todoApp').should('not.be.visible');
    });

    it('udane logowanie pokazuje aplikację i email użytkownika', () => {
        loginViaUI('jan@example.com');
        cy.get('#userEmail').should('contain', 'jan@example.com');
    });

    it('zapisuje token i email w localStorage', () => {
        loginViaUI('jan@example.com');
        cy.window().then(win => {
            expect(win.localStorage.getItem('token')).to.equal('tok_test');
            expect(win.localStorage.getItem('email')).to.equal('jan@example.com');
        });
    });
});

describe('Rejestracja', () => {
    beforeEach(() => {
        cy.visit('/');
        cy.get('#showRegister').click();
    });

    it('przełącza przycisk na "Zarejestruj się"', () => {
        cy.get('#loginBtn').should('contain', 'Zarejestruj się');
    });

    it('pokazuje błąd gdy pola są puste', () => {
        cy.get('#loginBtn').click();
        cy.get('#errorMsg').should('be.visible').and('contain', 'Wypełnij wszystkie pola');
    });

    it('udana rejestracja pokazuje komunikat sukcesu', () => {
        cy.intercept('POST', API.register, {
            body: { success: true, message: 'Rejestracja udana!' }
        }).as('register');

        cy.get('#email').type('nowy@example.com');
        cy.get('#password').type('haslo123');
        cy.get('#loginBtn').click();

        cy.wait('@register');
        cy.get('#successMsg').should('be.visible').and('contain', 'Rejestracja udana');
    });

    it('nieudana rejestracja pokazuje błąd z serwera', () => {
        cy.intercept('POST', API.register, {
            statusCode: 400,
            body: { success: false, error: 'Email już istnieje lub błąd bazy' }
        }).as('register');

        cy.get('#email').type('dup@example.com');
        cy.get('#password').type('haslo');
        cy.get('#loginBtn').click();

        cy.wait('@register');
        cy.get('#errorMsg').should('be.visible').and('contain', 'Email już istnieje');
    });
});

describe('Wylogowanie', () => {
    beforeEach(() => {
        cy.visit('/');
        loginViaUI();
    });

    it('wraca do formularza i czyści localStorage', () => {
        cy.get('#logoutBtn').click();

        cy.get('#authForm').should('be.visible');
        cy.get('#todoApp').should('not.be.visible');
        cy.window().then(win => {
            expect(win.localStorage.getItem('token')).to.be.null;
        });
    });
});


// Lista zadań

describe('Wyświetlanie zadań', () => {
    it('renderuje zadanie z treścią i datą', () => {
        loginViaUI('test@example.com', [SAMPLE_TODO]); 
        
        cy.get('.todo-item').should('be.visible');
        cy.get('.task-text').should('contain', 'Kupić mleko');
    });

    it('renderuje wiele zadań', () => {
        const tasks = [
            { ...SAMPLE_TODO, _id: '1', task: 'Zadanie 1' },
            { ...SAMPLE_TODO, _id: '2', task: 'Zadanie 2' }
        ];
        loginViaUI('test@example.com', tasks);

        cy.get('.todo-item').should('have.length', 2);
    });

    it('zadanie ukończone ma klasę completed i zaznaczony checkbox', () => {
        const completedTodo = { ...SAMPLE_TODO, completed: true };
		loginViaUI('test@example.com', [completedTodo]);

		cy.get('.todo-item').should('have.class', 'completed');
		cy.get('.checkbox').should('be.checked');
	});
});


// Dodawanie zadań

describe('Dodawanie zadań', () => {
    beforeEach(() => {
        cy.visit('/');
        loginViaUI();
    });

    it('pokazuje błąd gdy pole zadania jest puste', () => {
        cy.get('button').contains('Dodaj').click();
        cy.get('#errorMsg').should('be.visible').and('contain', 'pusta');
    });

    it('pokazuje błąd gdy data jest w przeszłości', () => {
        cy.get('#newTask').type('Zadanie');
        cy.get('#taskDate').type('2000-01-01');
        cy.get('button').contains('Dodaj').click();
        cy.get('#errorMsg').should('be.visible').and('contain', 'przeszłości');
    });

    it('pokazuje błąd gdy reminder zaznaczony bez daty', () => {
        cy.get('#newTask').type('Zadanie');
        cy.get('#sendReminder').check();
        cy.get('button').contains('Dodaj').click();
        cy.get('#errorMsg').should('be.visible').and('contain', 'termin');
    });

    it('dodaje zadanie, czyści formularz i pokazuje sukces', () => {
        cy.intercept('POST', API.todos, {
            body: { success: true, todo: { ...SAMPLE_TODO, task: 'Nowe zadanie' } }
        }).as('addTodo');
        cy.intercept('GET', API.todos, [{ ...SAMPLE_TODO, task: 'Nowe zadanie' }]).as('reload');

        cy.get('#newTask').type('Nowe zadanie');
        cy.get('button').contains('Dodaj').click();

        cy.wait('@addTodo');
        cy.get('#newTask').should('have.value', '');
        cy.get('#sendReminder').should('not.be.checked');
        cy.get('#successMsg').should('be.visible').and('contain', 'dodane');
    });

    it('wysyła poprawny payload z datą i reminderem', () => {
        cy.intercept('POST', API.todos, (req) => {
            expect(req.body.task).to.equal('Zadanie z przypomnieniem');
            expect(req.body.sendReminder).to.be.true;
            expect(req.body.dueDate).to.equal(FUTURE_DATE);
            req.reply({ success: true, todo: SAMPLE_TODO });
        }).as('addTodo');
        cy.intercept('GET', API.todos, []).as('reload');

        cy.get('#newTask').type('Zadanie z przypomnieniem');
        cy.get('#taskDate').type(FUTURE_DATE);
        cy.get('#sendReminder').check();
        cy.get('button').contains('Dodaj').click();

        cy.wait('@addTodo');
    });
});

// Edycja zadań

describe('Edycja zadań', () => {
    beforeEach(() => {
        cy.visit('/');
        loginViaUI('test@example.com', [SAMPLE_TODO]);
        cy.get('.edit-btn').click();
        cy.get('#editModal').should('be.visible');
    });

    it('modal wypełnia się danymi zadania', () => {
        cy.get('#editTaskText').should('have.value', 'Kupić mleko');
        cy.get('#editTaskDate').should('have.value', '2099-06-15');
    });

    it('Anuluj zamyka modal', () => {
        cy.get('.cancel-btn').click();
        cy.get('#editModal').should('not.be.visible');
    });

    it('kliknięcie poza modalem zamyka go', () => {
        cy.get('#editModal').click('topLeft');
        cy.get('#editModal').should('not.be.visible');
    });

    it('zapisuje zmiany — wysyła PUT i zamyka modal', () => {
        cy.intercept('PUT', API.todo('abc123'), {
            body: { success: true, todo: { ...SAMPLE_TODO, task: 'Zaktualizowane' } }
        }).as('saveEdit');
        cy.intercept('GET', API.todos, [{ ...SAMPLE_TODO, task: 'Zaktualizowane' }]).as('reload');

        cy.get('#editTaskText').clear().type('Zaktualizowane');
        cy.get('button').contains('Zapisz').click();

        cy.wait('@saveEdit');
        cy.get('#editModal').should('not.be.visible');
    });
});


// Ukończenie i usuwanie

describe('Ukończenie zadania', () => {
    beforeEach(() => {
        cy.visit('/');
        loginViaUI('test@example.com', [SAMPLE_TODO]);
    });

    it('kliknięcie checkboxa wysyła PUT z completed: true', () => {
        cy.intercept('PUT', API.todo('abc123'), (req) => {
            expect(req.body.completed).to.be.true;
            req.reply({ success: true, todo: { ...SAMPLE_TODO, completed: true } });
        }).as('toggle');
        cy.intercept('GET', API.todos, [{ ...SAMPLE_TODO, completed: true }]).as('reload');

        cy.get('.checkbox').click();
        cy.wait('@toggle');
    });
});

describe('Usuwanie zadania', () => {
    beforeEach(() => {
        cy.visit('/');
        loginViaUI('test@example.com', [SAMPLE_TODO]);
    });

    it('anulowanie confirma nie usuwa zadania', () => {
        cy.on('window:confirm', () => false);
        cy.get('.delete-btn').click();
        cy.get('.todo-item').should('have.length', 1);
    });

    it('potwierdzenie usuwa zadanie i pokazuje sukces', () => {
        cy.on('window:confirm', () => true);
        cy.intercept('DELETE', API.todo('abc123'), { body: { success: true } }).as('delete');
        cy.intercept('GET', API.todos, []).as('reload');

        cy.get('.delete-btn').click();
        cy.wait('@delete');
        cy.get('#successMsg').should('be.visible').and('contain', 'usunięte');
    });
});


// Trwałość sesji

describe('Trwałość sesji', () => {
    it('użytkownik pozostaje zalogowany po odświeżeniu strony', () => {
        cy.intercept('GET', API.todos, []).as('todos');
        cy.visit('/');
        loginViaUI('jan@example.com');

        cy.intercept('GET', API.todos, []).as('todos2');
        cy.reload();

        cy.get('#todoApp').should('be.visible');
        cy.get('#userEmail').should('contain', 'jan@example.com');
    });
});