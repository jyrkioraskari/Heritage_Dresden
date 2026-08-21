# Dresden, Germany Heritage Database Viewer

A read-only React interface for the PocketBase database in `09_Pocketbase-2D-3D/pb_data`. The small Node server reads SQLite directly and serves stored PocketBase files without changing the database.

## Run locally

```bash
npm install
npm run dev:api
```

In another terminal:

```bash
npm run dev
```

Open http://localhost:5173.

## Production

```bash
npm run build
npm start
```

Open http://localhost:3001. Set `PORT` to use another port.

Requires Node.js 22.5 or newer because the read-only API uses the built-in `node:sqlite` module.
