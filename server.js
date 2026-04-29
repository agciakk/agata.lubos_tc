const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'twojTajnyKlucz123';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/todoapp';

// Schematy
const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }
});

const TodoSchema = new mongoose.Schema({
  email: String,
  task: String,
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Todo = mongoose.model('Todo', TodoSchema);

// Middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Brak tokena' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Nieprawidłowy token' });
  }
}

// API - Rejestracja
app.post('/api/register', async (req, res) => {
  console.log('Rejestracja:', req.body);
  try {
    const { email, password } = req.body;
    console.log('1. Hashowanie hasła...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('2. Hasło zahashowane');
    const user = new User({ email, password: hashedPassword });
    console.log('3. Próba zapisu do bazy...');
    await user.save();
    console.log('4. Zapisz się udał!');
    res.json({ success: true, message: 'Rejestracja udana!' });
  } catch (err) {
    console.error('Błąd rejestracji:', err);
    res.status(400).json({ success: false, error: 'Email już istnieje lub błąd bazy' });
  }
});

// API - Logowanie
app.post('/api/login', async (req, res) => {
  console.log('Logowanie:', req.body);
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ success: false, error: 'Nieprawidłowe dane' });
  }
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, token, email });
});

// API - Pobierz zadania
app.get('/api/todos', authMiddleware, async (req, res) => {
  const todos = await Todo.find({ email: req.user.email }).sort({ createdAt: -1 });
  res.json(todos);
});

// API - Dodaj zadanie
app.post('/api/todos', authMiddleware, async (req, res) => {
  const { task } = req.body;
  const todo = new Todo({ email: req.user.email, task });
  await todo.save();
  res.json({ success: true, todo });
});

// API - Aktualizuj zadanie
app.put('/api/todos/:id', authMiddleware, async (req, res) => {
  const { completed, task } = req.body;
  const updateData = {};
  if (completed !== undefined) updateData.completed = completed;
  if (task !== undefined) updateData.task = task;
  
  await Todo.findOneAndUpdate(
    { _id: req.params.id, email: req.user.email },
    updateData
  );
  res.json({ success: true });
});

// API - Usuń zadanie
app.delete('/api/todos/:id', authMiddleware, async (req, res) => {
  await Todo.findOneAndDelete({ _id: req.params.id, email: req.user.email });
  res.json({ success: true });
});

// Uruchom serwer
mongoose.connect(MONGO_URL).then(() => {
  console.log('Połączono z MongoDB');
  app.listen(3000, '0.0.0.0', () => {
    console.log('Serwer działa na http://localhost:3000');
  });
}).catch(err => {
  console.error('Błąd MongoDB:', err);
});