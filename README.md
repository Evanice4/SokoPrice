# SokoPrice

AI-powered grocery price forecasting and market recommendation for informal markets in Kigali, Rwanda.

**Author:** Nice Eva Karabaranga | ALU Capstone 2026

**Model:** XGBoost (tuned) -- MAPE 8.27%, R2 0.9845

---

## Description

SokoPrice forecasts short-term grocery prices for informal markets in Kigali and helps consumers find the cheapest market for their shopping basket. It covers five Kigali markets: Kimironko, Nyabugogo, Kicukiro, Kimisagara, and Kigali City Market, and ten staple commodities: Maize, Maize Flour, Potatoes, Rice, Beans (Dry), Sorghum, Bananas, Spinach, Cabbage, and Flour.

The prototype is trained on the WFP VAM Kenya food price dataset as proxy data. Kenya and Rwanda share comparable informal market structures and staple food baskets. All 226 Kenyan market names are remapped cyclically to the five Kigali market names so the model trains on Kigali labels directly. Prices are converted from KES to RWF at a rate of 1 KES = 10 RWF. The admin dashboard allows uploading real Kigali price CSVs at any time, after which the model immediately uses the real price history as lag features instead of the proxy fallback.

## App Features

### Pricing

Select a commodity and market to get a 7-day AI price forecast with confidence interval and trend direction. The recommendation endpoint ranks all five markets by predicted price and shows how much you save at the cheapest market.

### Markets

Interactive Leaflet map showing all five Kigali markets with GPS pins. Clicking a market pin loads that market's current seller listings. Distance from the user's location is shown on each market card when location access is granted.

### Cost Estimator

Build a shopping basket, set an optional budget threshold, and get AI-predicted total costs. A compare button runs the basket across all five markets simultaneously and shows which market keeps you within budget. A map highlights the cheapest market in orange.

### Alerts

Set a budget threshold per commodity and market. The AI model predicts today's price and flags whether it exceeds your threshold. A live price watch table shows the current status of five key commodities automatically.

### Sellers

Sellers log in to add, edit, and delete product listings. Each listing shows the seller's price alongside the AI forecast price with a status of above, at, or below market. A real-time price submission form lets sellers submit actual prices directly to the model to improve predictions. A bar chart compares AI forecasts vs the seller's prices across all markets.

### Admin

Accessible only via `/#admin` hash while logged in as admin. Shows platform statistics, recent forecast requests, user management with suspend or reactivate, all seller products, CSV price data upload, and a market prices tab that shows AI predictions for all commodities at a selected market.

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm

## Installation

### Backend

```bash
pip install -r requirements.txt
```

Dependencies: FastAPI, Uvicorn, scikit-learn, XGBoost, NumPy, Joblib, PyJWT, python-multipart, Pydantic.

### Frontend

```bash
cd frontend
npm install
```

Dependencies: React, Vite, Recharts, Lucide React, Leaflet.

### Database

The database is created automatically on first run. An admin user is seeded with the credentials below.

## Running the App

### Start the Backend

```bash
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

| URL | Description |
|-----|-------------|
| http://127.0.0.1:8000 | API health check |
| http://127.0.0.1:8000/docs | Interactive Swagger documentation |

### Start the Frontend

```bash
cd frontend
npm run dev
```

| URL | Description |
|-----|-------------|
| http://127.0.0.1:5173 | Main application |
| http://127.0.0.1:5173/#admin | Admin dashboard (requires admin login) |

### Default Admin Account

| Field    | Value                  |
|----------|------------------------|
| Email    | admin@sokoprice.rw     |
| Password | admin123               |

## Environment Variables

| Variable       | Default                 | Description            |
|----------------|-------------------------|------------------------|
| `DB_PATH`      | `sokoprice.db`          | SQLite database path   |
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL        |

## API Endpoints

### Authentication

| Method | Path             | Description              |
|--------|------------------|--------------------------|
| POST   | `/auth/register` | Register a new user      |
| POST   | `/auth/login`    | Login and receive JWT    |
| GET    | `/auth/me`       | Get current user profile |

### Forecasting

| Method | Path        | Description                                    |
|--------|-------------|------------------------------------------------|
| POST   | `/predict`  | Predict price for a commodity, market, and date |
| POST   | `/recommend`| Recommend the cheapest market for a commodity   |

### Shopping

| Method | Path                  | Description                                 |
|--------|-----------------------|---------------------------------------------|
| POST   | `/basket`             | Estimate total cost for a basket of items   |
| GET    | `/alerts/{commodity}` | Check if predicted price exceeds a threshold |

### Catalog

| Method | Path           | Description                    |
|--------|----------------|--------------------------------|
| GET    | `/commodities` | List available commodities     |
| GET    | `/markets`     | List available markets         |
| GET    | `/products`    | List active seller listings    |

### Seller

| Method | Path                          | Description                              |
|--------|-------------------------------|------------------------------------------|
| GET    | `/seller/products`            | List seller's own products               |
| POST   | `/seller/products`            | Add a new product listing                |
| PUT    | `/seller/products/{id}`       | Update a product listing                 |
| DELETE | `/seller/products/{id}`       | Delete a product listing                 |
| POST   | `/seller/submit-price`        | Submit a real market price for approval  |
| GET    | `/seller/submissions`         | View own price submissions and status    |
| GET    | `/seller/insights/{commodity}`| AI price comparison across markets       |

### Messages

| Method | Path                       | Description                          |
|--------|----------------------------|--------------------------------------|
| POST   | `/messages/send`           | Send a message to another user       |
| GET    | `/messages/conversations`  | List conversation partners           |
| GET    | `/messages/{partner_id}`   | Get conversation with a user         |
| POST   | `/messages/{id}/read`      | Mark a message as read               |
| GET    | `/messages/unread-count`   | Get total unread message count       |

### Admin

| Method | Path                              | Description                                |
|--------|-----------------------------------|--------------------------------------------|
| GET    | `/admin/stats`                    | Platform statistics                        |
| GET    | `/admin/users`                    | List all users                             |
| PUT    | `/admin/users/{id}/suspend`       | Suspend or reactivate a user               |
| GET    | `/admin/products`                 | List all seller products                   |
| POST   | `/admin/upload-prices`            | Upload CSV of real market prices           |
| POST   | `/admin/retrain`                  | Retrain the XGBoost model on uploaded data |
| GET    | `/admin/price-records`            | View all uploaded price records            |
| POST   | `/admin/approve-submission/{id}`  | Approve a seller price submission          |
| POST   | `/admin/reject-submission/{id}`   | Reject a seller price submission           |
| GET    | `/admin/pending-submissions`      | List submissions awaiting review           |

## Model Retraining

After uploading real price data via the admin panel (CSV format), the model can be retrained.

1. Go to Admin > Data Upload
2. Upload a CSV file with columns: `commodity,market,price_rwf,price_date`
3. Click "Retrain Model on Uploaded Data"
4. New MAPE, R2, and RMSE metrics are displayed

Alternatively, call the endpoint directly:

```bash
curl -X POST http://127.0.0.1:8000/admin/retrain \
  -H "Authorization: Bearer <admin_token>"
```

The retrained model replaces the previous one immediately. All subsequent predictions use the updated model.

## Technology Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Backend    | FastAPI (Python), Uvicorn         |
| ML Model   | XGBoost, scikit-learn             |
| Database   | SQLite (WAL mode)                 |
| Auth       | JWT (python-jose), bcrypt hashing |
| Frontend   | React 18, Vite                    |
| Charts     | Recharts                          |
| Maps       | Leaflet, OpenStreetMap            |
| Styling    | Inline styles, custom CSS         |

## Markets and Commodities

**Markets:** Kimironko, Nyabugogo, Kicukiro, Kimisagara, Kigali City

**Commodities:** Maize, Maize Flour, Potatoes, Rice, Beans (Dry), Sorghum, Bananas, Spinach, Cabbage, Flour

**Price unit:** RWF (Rwandan Francs)

## Known Issues and Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| LSTM and GRU MAPE above 2700% | Scaler mismatch on inverse transform for sequence predictions | Documented as known issue, excluded from production |
| Model predicting negative or very large values | XGBoost trained on unscaled y_train but prediction was applying scaler_y inverse transform | Removed scaler_y from inference; model predicts raw RWF directly |
| Model predicting 0 for all commodities | `dill` module missing, model failed to load silently | `pip install dill` |
| Model predicting same price for all markets | Lag features built from median fallback, not real price history | Upload real price CSV via admin dashboard |

## Deploying to Vercel

### Frontend

The frontend is a standard Vite + React application. A `vercel.json` is already included in the `frontend/` directory.

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. From the `frontend/` directory, deploy:
   ```bash
   cd frontend
   vercel
   ```

3. Follow the prompts. Vercel auto-detects the Vite framework.

4. Set the environment variable in the Vercel dashboard or via CLI:
   ```bash
   vercel env add VITE_API_URL
   ```
   Set it to your deployed backend URL (e.g., `https://sokoprice-api.vercel.app`).

Alternatively, deploy directly from the Vercel dashboard:

1. Go to [vercel.com](https://vercel.com) and import the repository
2. Set the root directory to `frontend`
3. Vercel auto-detects Vite and applies the build settings
4. Add the `VITE_API_URL` environment variable pointing to your backend

### Backend

The backend FastAPI app includes a `vercel.json` at the project root and an `api/index.py` entry point for Vercel serverless Python.

1. From the project root, deploy:
   ```bash
   vercel
   ```

2. Vercel detects the `@vercel/python` builder and deploys the API.

Important notes for backend deployment:

- The SQLite database file is not suitable for Vercel serverless (ephemeral filesystem). For production, migrate to a cloud database such as Turso, Neon, or Supabase.
- The trained model file (`Best_model/model_xgb_tuned.pkl`, 2.8 MB) and encoders are loaded at cold start. They are within Vercel's 250 MB deployment limit.
- Set `DB_PATH` to a persistent storage path or switch to a cloud database URL.
- Admin seeding runs on first request if no admin user exists.

### Connecting Frontend to Backend

After deploying both, set the frontend's `VITE_API_URL` to the backend's Vercel URL:

```bash
# Example
VITE_API_URL=https://sokoprice-api.vercel.app
```

Rebuild and redeploy the frontend after changing this variable.

## Links

- [Main project drive](https://drive.google.com/drive/folders/1zx5COrJJdiu6-C2jY8XAhW6i_9dej-gp?usp=sharing)
- [Additional drive](https://drive.google.com/drive/folders/1s72nWteOMvkTcjruaI62MG0iwHTsSj87?usp=sharing)

## Project Structure

```
SokoPrice-main-2/
  main.py                  FastAPI backend (all routes and ML logic)
  database.py              SQLite schema, initialization, admin seed
  auth.py                  Password hashing, JWT creation and verification
  requirements.txt         Python dependencies
  sokoprice.db             SQLite database (auto-created)
  Best_model/
    model_xgb_tuned.pkl    Trained XGBoost model
  encoders/
    le_commodity.pkl       Commodity label encoder
    le_market.pkl           Market label encoder
  Data/                    Training data directory
  notebook/
    SokoPrice_model_training.ipynb   Model training notebook
  frontend/
    public/                Static assets (logos, market images)
    src/
      main.jsx             React application (all components)
      styles.css           Global styles
    package.json           Node dependencies
    vite.config.js         Vite configuration
```
