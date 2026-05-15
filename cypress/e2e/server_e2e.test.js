/**
 * Testy E2E backendu 
 *
 * Uruchomienie:
 *   npm test
 *
 */

const request  = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;

const TEST_EMAIL    = `e2e_${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestHaslo123!';
let   authToken     = null;
let   createdTodoId = null;

// Setup / Teardown

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    const uri = mongoServer.getUri();

    process.env.NODE_ENV = 'test';
    process.env.MONGO_URL = uri;
    process.env.JWT_SECRET = 'test_secret_key';

    await mongoose.connect(uri);

    app = require('../../server');
}, 30000);

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});


// POST /api/register

describe('POST /api/register', () => {

    it('rejestruje nowego użytkownika i zwraca success: true', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('zwraca 400 przy próbie rejestracji z tym samym emailem', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/istnieje|błąd/i);
    });

    it('zwraca błąd gdy brak emaila', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ password: TEST_PASSWORD });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('zwraca błąd gdy brak hasła', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ email: 'nowy@example.com' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});


// POST /api/login

describe('POST /api/login', () => {

    it('loguje użytkownika i zwraca token JWT oraz email', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.email).toBe(TEST_EMAIL);

        authToken = res.body.token; // zapisz dla kolejnych testów
    });

    it('zwraca 401 przy złym haśle', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: TEST_EMAIL, password: 'zle_haslo' });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('zwraca 401 gdy email nie istnieje', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ email: 'nie@istnieje.pl', password: TEST_PASSWORD });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });
});

// GET /api/todos – autoryzacja

describe('GET /api/todos – autoryzacja', () => {

    it('zwraca 401 bez tokena', async () => {
        const res = await request(app).get('/api/todos');
        expect(res.status).toBe(401);
    });

    it('zwraca 401 z nieprawidłowym tokenem', async () => {
        const res = await request(app)
            .get('/api/todos')
            .set('Authorization', 'Bearer zly_token');
        expect(res.status).toBe(401);
    });

    it('zwraca pustą tablicę dla nowego użytkownika', async () => {
        const res = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(0);
    });
});


// POST /api/todos – dodawanie

describe('POST /api/todos', () => {

    it('dodaje zadanie bez daty i zwraca success: true', async () => {
        const res = await request(app)
            .post('/api/todos')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ task: 'Zadanie testowe', dueDate: null, sendReminder: false });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.todo).toBeDefined();
        expect(res.body.todo.task).toBe('Zadanie testowe');
        expect(res.body.todo.completed).toBe(false);

        createdTodoId = res.body.todo._id;
    });

    it('dodaje zadanie z datą w przyszłości', async () => {
        const res = await request(app)
            .post('/api/todos')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ task: 'Zadanie z datą', dueDate: '2099-12-31', sendReminder: false });

        expect(res.status).toBe(200);
        expect(res.body.todo.dueDate).toBeDefined();
    });

    it('dodane zadanie pojawia się na liście GET /api/todos', async () => {
        const res = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${authToken}`);

        const tasks = res.body.map(t => t.task);
        expect(tasks).toContain('Zadanie testowe');
    });

    it('zwraca 401 bez tokena', async () => {
        const res = await request(app)
            .post('/api/todos')
            .send({ task: 'Bez auth' });
        expect(res.status).toBe(401);
    });
});

// PUT /api/todos/:id – edycja

describe('PUT /api/todos/:id', () => {

    it('aktualizuje treść zadania', async () => {
        const res = await request(app)
            .put(`/api/todos/${createdTodoId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ task: 'Zadanie zaktualizowane' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.todo.task).toBe('Zadanie zaktualizowane');
    });

    it('oznacza zadanie jako ukończone', async () => {
        const res = await request(app)
            .put(`/api/todos/${createdTodoId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ completed: true });

        expect(res.status).toBe(200);
        expect(res.body.todo.completed).toBe(true);
    });

    it('zaktualizowane zadanie widoczne na liście z nowym stanem', async () => {
        const res = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${authToken}`);

        const todo = res.body.find(t => t._id === createdTodoId);
        expect(todo).toBeDefined();
        expect(todo.completed).toBe(true);
        expect(todo.task).toBe('Zadanie zaktualizowane');
    });

    it('zwraca 401 bez tokena', async () => {
        const res = await request(app)
            .put(`/api/todos/${createdTodoId}`)
            .send({ completed: false });
        expect(res.status).toBe(401);
    });

    it('zwraca 500 dla nieistniejącego ID', async () => {
        const res = await request(app)
            .put('/api/todos/000000000000000000000000')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ completed: true });
        expect(res.status).toBe(500);
    });
});

// DELETE /api/todos/:id – usuwanie

describe('DELETE /api/todos/:id', () => {

    it('usuwa zadanie i zwraca success: true', async () => {
        const res = await request(app)
            .delete(`/api/todos/${createdTodoId}`)
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('usunięte zadanie znika z listy', async () => {
        const res = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${authToken}`);

        const ids = res.body.map(t => t._id);
        expect(ids).not.toContain(createdTodoId);
    });

    it('zwraca 401 bez tokena', async () => {
        const res = await request(app)
            .delete(`/api/todos/${createdTodoId}`);
        expect(res.status).toBe(401);
    });
});


// Izolacja danych między użytkownikami

describe('Izolacja danych między użytkownikami', () => {

    let token2;

    beforeAll(async () => {
        const email2 = `user2_${Date.now()}@example.com`;

        await request(app)
            .post('/api/register')
            .send({ email: email2, password: TEST_PASSWORD });

        const res = await request(app)
            .post('/api/login')
            .send({ email: email2, password: TEST_PASSWORD });

        token2 = res.body.token;
    });

    it('user1 dodaje zadanie, user2 go nie widzi', async () => {
        // Dodaj zadanie jako user1
        await request(app)
            .post('/api/todos')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ task: 'Prywatne zadanie usera 1', dueDate: null, sendReminder: false });

        // Pobierz jako user2
        const res = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${token2}`);

        const tasks = res.body.map(t => t.task);
        expect(tasks).not.toContain('Prywatne zadanie usera 1');
    });

    it('user2 nie może usunąć zadania usera 1', async () => {
        // Pobierz ID zadania usera 1
        const listRes = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${authToken}`);

        const todo = listRes.body.find(t => t.task === 'Prywatne zadanie usera 1');
        expect(todo).toBeDefined();

        // Próba usunięcia przez usera 2
        const delRes = await request(app)
            .delete(`/api/todos/${todo._id}`)
            .set('Authorization', `Bearer ${token2}`);

        // Zadanie nadal istnieje dla usera 1
        const checkRes = await request(app)
            .get('/api/todos')
            .set('Authorization', `Bearer ${authToken}`);

        const still = checkRes.body.find(t => t._id === todo._id);
        expect(still).toBeDefined();
    });
});
