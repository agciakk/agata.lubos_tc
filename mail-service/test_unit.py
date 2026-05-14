import pytest
from unittest.mock import patch, MagicMock, call
from datetime import datetime, timezone

@pytest.fixture(autouse=True)
def env_vars(monkeypatch):
    """Ustawia zmienne środowiskowe przed każdym testem."""
    monkeypatch.setenv("GMAIL_USER", "test@gmail.com")
    monkeypatch.setenv("GMAIL_PASSWORD", "secret")
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017/testdb")


@pytest.fixture
def import_app():
    """Importuje moduł app po ustawieniu env vars."""
    import importlib
    import app as app_module
    importlib.reload(app_module)
    return app_module

class TestSendBulkMail:

    @patch("smtplib.SMTP_SSL")
    def test_wyslanie_maila_sukces(self, mock_smtp, import_app):
        """Sprawdza, czy mail jest wysyłany z poprawnymi parametrami."""
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server

        result = import_app.send_bulk_mail("odbiorca@example.com", "Temat", "Treść")

        assert result is True
        mock_server.login.assert_called_once_with("test@gmail.com", "secret")
        mock_server.sendmail.assert_called_once()
        args = mock_server.sendmail.call_args[0]
        assert args[0] == "test@gmail.com"
        assert args[1] == "odbiorca@example.com"

    @patch("smtplib.SMTP_SSL", side_effect=Exception("Brak połączenia"))
    def test_wyslanie_maila_blad_zwraca_false(self, mock_smtp, import_app):
        """Sprawdza, że wyjątek SMTP jest obsługiwany i zwracane jest False."""
        result = import_app.send_bulk_mail("x@example.com", "Temat", "Treść")
        assert result is False

    @patch("smtplib.SMTP_SSL")
    def test_naglowki_wiadomosci(self, mock_smtp, import_app):
        """Sprawdza, że nagłówki From/To/Subject są poprawnie ustawione."""
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__.return_value = mock_server

        import_app.send_bulk_mail("cel@example.com", "Moj temat", "Treść wiadomości")

        raw_msg = mock_server.sendmail.call_args[0][2]
        assert "Moj temat" in raw_msg
        assert "test@gmail.com" in raw_msg
        assert "cel@example.com" in raw_msg

class TestCheckAndSendReminders:

    def _make_todo(self, email, task):
        return {
            "_id": MagicMock(),
            "email": email,
            "task": task,
            "sendReminder": True,
            "completed": False,
            "dueDate": datetime.now(timezone.utc),
        }

    @patch("app.send_bulk_mail", return_value=True)
    @patch("app.MongoClient")
    def test_grupowanie_zadan_per_email(self, mock_client, mock_mail, import_app):
        """Jeden mail zbiorczy na użytkownika, nawet przy wielu zadaniach."""
        todos = [
            self._make_todo("jan@example.com", "Zadanie A"),
            self._make_todo("jan@example.com", "Zadanie B"),
            self._make_todo("ewa@example.com", "Zadanie C"),
        ]
        db = mock_client.return_value.__getitem__.return_value
        db.todos.find.return_value = todos
        db.todos.count_documents.return_value = len(todos)

        import_app.check_and_send_reminders()

        assert mock_mail.call_count == 2
        recipients = {c[0][0] for c in mock_mail.call_args_list}
        assert recipients == {"jan@example.com", "ewa@example.com"}

    @patch("app.send_bulk_mail", return_value=True)
    @patch("app.MongoClient")
    def test_tresc_maila_zawiera_zadania(self, mock_client, mock_mail, import_app):
        """Treść wiadomości zbiorczej zawiera wszystkie zadania użytkownika."""
        todos = [
            self._make_todo("user@example.com", "Kupić mleko"),
            self._make_todo("user@example.com", "Zadzwonić do lekarza"),
        ]
        db = mock_client.return_value.__getitem__.return_value
        db.todos.find.return_value = todos
        db.todos.count_documents.return_value = 2

        import_app.check_and_send_reminders()

        body = mock_mail.call_args[0][2]
        assert "Kupić mleko" in body
        assert "Zadzwonić do lekarza" in body

    @patch("app.send_bulk_mail", return_value=True)
    @patch("app.MongoClient")
    def test_send_reminder_wylaczane_po_wyslaniu(self, mock_client, mock_mail, import_app):
        """Po wysłaniu maila sendReminder jest ustawiany na False."""
        db = mock_client.return_value.__getitem__.return_value
        db.todos.find.return_value = [self._make_todo("a@b.com", "Zadanie")]
        db.todos.count_documents.return_value = 1

        import_app.check_and_send_reminders()

        db.todos.update_many.assert_called_once()
        update_arg = db.todos.update_many.call_args[0][1]
        assert update_arg == {"$set": {"sendReminder": False}}

    @patch("app.send_bulk_mail")
    @patch("app.MongoClient")
    def test_brak_zadan_nie_wysyla_maila(self, mock_client, mock_mail, import_app):
        """Gdy brak zadań na dziś, żaden mail nie jest wysyłany."""
        db = mock_client.return_value.__getitem__.return_value
        db.todos.find.return_value = []
        db.todos.count_documents.return_value = 0

        import_app.check_and_send_reminders()

        mock_mail.assert_not_called()

    @patch("app.send_bulk_mail", return_value=False)
    @patch("app.MongoClient")
    def test_nieudana_wyslka_nie_aktualizuje_bazy(self, mock_client, mock_mail, import_app):
        """Gdy wysyłka się nie powiedzie, baza danych nie jest aktualizowana."""
        db = mock_client.return_value.__getitem__.return_value
        db.todos.find.return_value = [self._make_todo("x@y.com", "Zadanie")]
        db.todos.count_documents.return_value = 1

        import_app.check_and_send_reminders()

        db.todos.update_many.assert_not_called()

    @patch("app.MongoClient", side_effect=Exception("Brak MongoDB"))
    def test_blad_mongo_nie_crashuje_aplikacji(self, mock_client, import_app):
        """Wyjątek MongoDB jest obsługiwany bez propagacji."""
        # Nie powinien rzucić wyjątku
        import_app.check_and_send_reminders()
