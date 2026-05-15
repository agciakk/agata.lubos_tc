// server.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Import aplikacji (serwera)
const app = require('./server'); 

let mongoServer;
let authToken;
let testUser = {
  email: 'test@example.com',
  password: 'password123'
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();

  // Zarejestruj użytkownika przez API
  const hashedPassword = await bcrypt.hash(testUser.password, 10);
  await mongoose.connection.db.collection('users').insertOne({
    email: testUser.email,
    password: hashedPassword
  });

  const loginRes = await request(app)
    .post('/api/login')
    .send({
      email: testUser.email,
      password: testUser.password
    });
  
  authToken = loginRes.body.token;
  console.log('Token generated:', authToken);
});

describe('API endpointy', () => {
  describe('POST /api/register', () => {
    it('powinien zarejestrować nowego użytkownika', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'newpass123'
      };

      const res = await request(app)
        .post('/api/register')
        .send(newUser);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Rejestracja udana!');

      // Sprawdź czy użytkownik istnieje w bazie
      const userInDb = await mongoose.connection.db.collection('users').findOne({ email: newUser.email });
      expect(userInDb).toBeTruthy();
      expect(userInDb.password).not.toBe(newUser.password);
    });

    it('powinien zwrócić błąd gdy email już istnieje', async () => {
      const existingUser = {
        email: testUser.email,
        password: 'anypass'
      };

      const res = await request(app)
        .post('/api/register')
        .send(existingUser);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Email już istnieje');
    });
  });

  describe('POST /api/login', () => {
    it('powinien zalogować użytkownika i zwrócić token', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      console.log('Login response:', res.body); 
      
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.email).toBe(testUser.email);

      authToken = res.body.token;
    });
  });

    it('powinien zwrócić 401 przy złych danych', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Nieprawidłowe dane');
    });
  });

  describe('Zadania (todos)', () => {
    let todoId;

    it('GET /api/todos - brak zadań dla nowego użytkownika', async () => {
      const res = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('POST /api/todos - dodanie nowego zadania', async () => {
      const newTodo = {
        task: 'Napisać testy',
        dueDate: new Date().toISOString(),
        sendReminder: false
      };

      const res = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newTodo);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.todo.task).toBe(newTodo.task);
      expect(res.body.todo.email).toBe(testUser.email);
      expect(res.body.todo.completed).toBe(false);

      todoId = res.body.todo._id;
    });

    it('PUT /api/todos/:id - aktualizacja zadania', async () => {
      // Najpierw dodaj zadanie
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task: 'Do zaktualizowania', dueDate: null, sendReminder: false });

      const id = createRes.body.todo._id;

      const updateRes = await request(app)
        .put(`/api/todos/${id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ completed: true, task: 'Zaktualizowane zadanie' });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.todo.completed).toBe(true);
      expect(updateRes.body.todo.task).toBe('Zaktualizowane zadanie');
    });

    it('DELETE /api/todos/:id - usuwanie zadania', async () => {
      // Dodaj zadanie
      const createRes = await request(app)
        .post('/api/todos')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ task: 'Do usunięcia', dueDate: null, sendReminder: false });

      const id = createRes.body.todo._id;

      const deleteRes = await request(app)
        .delete(`/api/todos/${id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Sprawdź czy zadanie zniknęło
      const getRes = await request(app)
        .get('/api/todos')
        .set('Authorization', `Bearer ${authToken}`);

      const deletedTodo = getRes.body.find(t => t._id === id);
      expect(deletedTodo).toBeUndefined();
    });

    it('powinien zwrócić 401 dla niezautoryzowanego dostępu do /todos', async () => {
      const res = await request(app).get('/api/todos');
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Brak tokena');
    });
  });
