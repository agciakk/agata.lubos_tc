from flask import Flask, request, jsonify, send_from_directory
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pymongo import MongoClient
import os
from bson import ObjectId
import threading
import schedule
import time
from datetime import datetime, timezone
import werkzeug.security

app = Flask(__name__, static_folder='.', static_url_path='')

# Konfiguracja środowiskowa
GMAIL_USER = os.environ.get('GMAIL_USER')
GMAIL_PASSWORD = os.environ.get('GMAIL_PASSWORD')
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://mongodb:27017/todoapp')

client = MongoClient(MONGO_URL)
db = client['todoapp']

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# --- AUTH API ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if db.users.find_one({'email': email}):
        return jsonify({'success': False, 'error': 'Email już istnieje'}), 400
    
    hashed_pw = werkzeug.security.generate_password_hash(password)
    db.users.insert_one({'email': email, 'password': hashed_pw})
    return jsonify({'success': True})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = db.users.find_one({'email': data.get('email')})
    
    if user and werkzeug.security.check_password_hash(user['password'], data.get('password')):
        return jsonify({'success': True, 'token': 'fake-jwt-token', 'email': user['email']})
    
    return jsonify({'success': False, 'error': 'Nieprawidłowe dane logowania'}), 401

# --- TODOS API ---

@app.route('/api/todos', methods=['GET'])
def get_todos():
    todos = list(db.todos.find())
    for t in todos:
        t['_id'] = str(t['_id'])
    return jsonify(todos)

@app.route('/api/todos', methods=['POST'])
def add_todo():
    data = request.json
    new_todo = {
        'task': data.get('task'),
        'dueDate': data.get('dueDate'),
        'sendReminder': data.get('sendReminder'),
        'completed': False,
        'email': 'test@gmail.com'
    }
    result = db.todos.insert_one(new_todo)
    return jsonify({'success': True, 'id': str(result.inserted_id)})

@app.route('/api/todos/<id>', methods=['PUT'])
def update_todo(id):
    data = request.json
    db.todos.update_one({'_id': ObjectId(id)}, {'$set': data})
    return jsonify({'success': True})

@app.route('/api/todos/<id>', methods=['DELETE'])
def delete_todo(id):
    db.todos.delete_one({'_id': ObjectId(id)})
    return jsonify({'success': True})
    
def send_bulk_mail(to, subject, body):
    try:
        msg = MIMEMultipart()
        msg['From'] = GMAIL_USER
        msg['To'] = to
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_PASSWORD)
            server.sendmail(GMAIL_USER, to, msg.as_string())
        return True
    except Exception as e:
        print(f'Błąd maila: {e}')
        return False

def check_and_send_reminders():
    print(f'[{datetime.now()}] Sprawdzam przypomnienia zbiorcze...')
    try:
        client = MongoClient(MONGO_URL)
        db = client['todoapp']
        
        # Definicja dzisiejszego okna czasowego (UTC)
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow = today.replace(hour=23, minute=59, second=59)

        print(f"DEBUG: Szukam zadań z datą od {today} do {tomorrow}")

        total_reminders = db.todos.count_documents({'sendReminder': True})
        print(f"DEBUG: Wszystkich zadań z sendReminder=True w bazie: {total_reminders}")

        # 1. Pobranie zadań na dziś
        todos = list(db.todos.find({
            'sendReminder': True,
            'completed': False,
            'dueDate': {'$gte': today, '$lte': tomorrow}
        }))

        print(f"DEBUG: Znaleziono zadań spełniających wszystkie kryteria: {len(todos)}")

        if not todos:
            print("Brak przypomnień do wysłania.")
            client.close()
            return

        # 2. Grupowanie zadań według e-maila
        user_tasks = {}
        for todo in todos:
            email = todo['email']
            if email not in user_tasks:
                user_tasks[email] = []
            user_tasks[email].append(todo['task'])

        # 3. Wysyłka zbiorcza i aktualizacja bazy
        for email, tasks in user_tasks.items():
            task_list_str = "\n".join([f"• {t}" for t in tasks])
            count = len(tasks)
            
            subject = f"Lista To-Do: Zadania, których termin dziś upływa"
            body = f"""Dzień dobry!

Dziś upływa termin następujących zadań:
{task_list_str}

Termin: {today.strftime('%d.%m.%Y')}

Powodzenia w realizacji!
Wiadomość automatyczna systemu To-Do."""
            
            if send_bulk_mail(email, subject, body):
                # Wyłączenie przypomnień po wysłaniu 
                db.todos.update_many(
                    {'email': email, 'dueDate': {'$gte': today, '$lte': tomorrow}},
                    {'$set': {'sendReminder': False}}
                )
        
        client.close()
    except Exception as e:
        print(f'Błąd podczas cyklu przypomnień: {e}')

def run_scheduler():
    # Uruchamia sprawdzanie codziennie o 08:00 rano
    schedule.every().day.at("08:00").do(check_and_send_reminders)
    while True:
        schedule.run_pending()
        time.sleep(60)

@app.route('/send', methods=['POST'])
def api_send_email():
    data = request.json
    to = data.get('to')
    task = data.get('task')
    due_date = data.get('dueDate')

    if not all([to, task, due_date]):
        return jsonify({'success': False, 'error': 'Brak danych'}), 400

    subject = f"Nowe przypomnienie: {task}"
    body = f"Przypominamy o zadaniu: {task}\nTermin: {due_date}"
    
    success = send_bulk_mail(to, subject, body)
    return jsonify({'success': success})

# Ręczne wywołane raportu dziennego
@app.route('/test-reminders', methods=['GET'])
def force_test_reminders():
    try:
        check_and_send_reminders()
        return jsonify({
            'success': True, 
            'message': 'Proces sprawdzania przypomnień został uruchomiony ręcznie.'
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
if __name__ == '__main__':
    # Uruchomienie harmonogramu w tle
    t = threading.Thread(target=run_scheduler, daemon=True)
    t.start()
    
    # Uruchomienie serwera Flask
    app.run(host='0.0.0.0', port=5000)

