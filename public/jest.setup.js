/**
 * jest.setup.js
 * Eksponuje zmienne globalne z script.js do środowiska testowego.
 * Jest uruchamiany przed każdym plikiem testowym (setupFiles w package.json).
 */

// Zmienne stanu aplikacji – script.js modyfikuje je bezpośrednio na window
global.currentToken  = null;
global.currentEmail  = null;
global.editingTodoId = null;

global.localStorage = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};