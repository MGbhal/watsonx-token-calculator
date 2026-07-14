# Token Budget Tracker

A lightweight, self-hosted web app to track a token budget — add tokens, spend them, set a budget cap, and review a full transaction history. Data is persisted in a local SQLite database.

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Server   | Node.js + Express 4               |
| Database | SQLite via `better-sqlite3`       |
| Frontend | Vanilla HTML / CSS / JavaScript   |

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9

## Getting Started

```bash
# 1. Navigate to the project directory
cd token-tracker

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

The app will be available at **http://127.0.0.1:3000**

> For development with auto-reload:
> ```bash
> npm run dev
> ```

## Project Structure

```
token-tracker/
├── server.js          # Express server + SQLite API
├── package.json
├── .gitignore
├── tracker.db         # Auto-created on first run (gitignored)
└── public/
    ├── index.html     # App shell
    ├── style.css      # All styles
    └── app.js         # Frontend logic + API calls
```

## API Reference

| Method   | Endpoint        | Body                          | Description                  |
|----------|-----------------|-------------------------------|------------------------------|
| GET      | `/api/state`    | —                             | Get balance, totals, history |
| POST     | `/api/add`      | `{ amount, note? }`           | Add tokens                   |
| POST     | `/api/spend`    | `{ amount, note? }`           | Spend tokens                 |
| POST     | `/api/reset`    | `{ note? }`                   | Reset balance to zero        |
| POST     | `/api/budget`   | `{ budget }`                  | Set a budget cap             |
| DELETE   | `/api/history`  | —                             | Clear all history entries    |

## Features

- **Live balance** with colour coding (green / amber / red based on budget %)
- **Budget cap** with an animated progress bar
- **Transaction history** — timestamped, with type badges and running balance
- **Persistent storage** — SQLite database survives server restarts
- **Secure binding** — server listens on `127.0.0.1` only (not `0.0.0.0`)
