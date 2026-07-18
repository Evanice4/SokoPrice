# SokoPrice

**SokoPrice** is an AI-powered grocery price forecasting and shopping assistant for Kigali's informal markets. It helps consumers compare food prices across markets, estimate basket costs, identify affordable markets, and communicate with sellers. The system supports seller listings, real price submissions, admin review, and AI-based price forecasting using a trained XGBoost machine learning model.

---

## Live Deployment

| Service | Link |
|---|---|
| Frontend Web App | https://soko-price-forecasting.web.app |
| Backend API | https://sokoprice.onrender.com |
| API Documentation | https://sokoprice.onrender.com/docs |
| Demo | https://drive.google.com/drive/folders/1zx5COrJJdiu6-C2jY8XAhW6i_9dej-gp?usp=sharing |

---

## Default Admin Account

| Field | Value |
|---|---|
| Email | `admin@sokoprice.rw` |
| Password | `admin123` |

Admin dashboard is accessible at `https://soko-price-forecasting.web.app/#admin` while logged in as admin. It is not linked in the navigation and is not visible to regular users.

---

## Project Description

SokoPrice forecasts short-term grocery prices for informal markets in Kigali and helps consumers find the cheapest market for their shopping basket. It covers five Kigali markets and ten staple commodities.

The model is trained on the WFP VAM Kenya food price dataset as proxy data. Kenya and Rwanda share comparable informal market structures and staple food baskets. All 226 Kenyan market names are remapped cyclically to five Kigali market labels so the model trains on Kigali names directly. Prices are converted from KES to RWF at a rate of 1 KES = 10 RWF.

The admin dashboard allows uploading real Kigali price CSVs at any time. Once uploaded, the model immediately uses the real price history as lag features instead of the median proxy fallback, improving prediction accuracy progressively as more real data accumulates.

### Markets and Commodities

| Category | Values |
|---|---|
| Markets | Kimironko, Nyabugogo, Kicukiro, Kimisagara, Kigali City Market |
| Commodities | Maize, Maize Flour, Potatoes, Rice, Beans (Dry), Sorghum, Bananas, Spinach, Cabbage, Flour |
| Price Unit | RWF (Rwandan Francs) |

### User Types

| User | Main Functions |
|---|---|
| Consumer | Forecast prices, compare markets, estimate basket costs, set alerts, chat with sellers |
| Seller | List products, submit real market prices, compare prices with AI estimates, chat with consumers |
| Admin | Manage users, review submissions, upload price data, retrain the model, monitor platform stats |

---

## Key Features

**AI Price Forecasting** - Select a commodity, market, and forecast date to receive an estimated price in RWF. The system uses a trained XGBoost model with 18 engineered features including lag prices, rolling statistics, cyclical month encoding, and label encodings for commodity and market.

**Market Comparison** - Ranks all five markets by predicted price for a selected commodity. Shows how much you save at the cheapest market. Distance from the user's GPS location is shown on each market card when location access is granted.

**Cost Estimator** - Build a basket of multiple commodities and quantities. The app estimates the total cost at a selected market, compares the basket across all five markets simultaneously, and shows which market keeps you within your budget threshold. A map highlights the cheapest market in orange.

**Price Alerts** - Set a budget threshold per commodity and market. The model predicts the current price and flags whether it exceeds the threshold. A live price watch table shows the status of five key commodities automatically on page load.

**Seller Dashboard** - Sellers add, edit, and delete product listings. Each listing shows the seller's price alongside the AI forecast price with a status of above, at, or below market. A price submission form lets sellers submit actual prices to improve model predictions. A bar chart compares AI forecasts vs seller prices across all markets.

**Admin Dashboard** - Shows platform statistics, recent forecast requests, user management with suspend or reactivate, all seller products, CSV price data upload with immediate model effect, and a market prices tab showing AI predictions for all commodities at a selected market.

**In-App Messaging** - Consumers and sellers can send messages to each other. Conversations are linked to authenticated users and stored in the database.

**Interactive Map** - Leaflet and OpenStreetMap map showing all five Kigali markets with clickable pins. Clicking a pin loads that market's current seller listings. The user's GPS location is shown as a separate pin when location access is granted.

---

## System Architecture

```
User Browser
    |
Firebase Hosting
React / Vite Frontend
    | API calls
Render Backend
FastAPI + JWT Auth + PostgreSQL + XGBoost Model
    |
Best_model/model_xgb_tuned.pkl
encoders/le_commodity.pkl
encoders/le_market.pkl
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python, Uvicorn |
| ML Model | XGBoost, scikit-learn, joblib |
| Database | PostgreSQL (production), SQLite (local development) |
| Auth | JWT tokens, SHA-256 password hashing |
| Frontend | React 18, Vite |
| Charts | Recharts |
| Maps | Leaflet, OpenStreetMap |
| Deployment | Render (backend), Firebase Hosting (frontend) |

---

## Machine Learning Pipeline

The model was trained following the CRISP-DM methodology across ten phases documented in the notebook at `notebook/SokoPrice_V2_Notebook.ipynb`.

### Dataset

```
Data/wfp_food_prices_ken.csv
```

WFP VAM Kenya food price dataset used as proxy data for Kigali. After applying a retail-only filter, 9,584 rows remain covering 2006 to 2026 across 226 Kenyan markets remapped to five Kigali market names.

### Feature Engineering

18 features were engineered per record:

| Feature Group | Features |
|---|---|
| Temporal | year, month_sin, month_cos, quarter, day_of_year |
| Lag prices | price_lag_1, price_lag_2, price_lag_3, price_lag_6 |
| Rolling statistics | rolling_mean_3, rolling_mean_6, rolling_mean_12, rolling_std_3, rolling_std_6 |
| Momentum | price_pct_change_1m, price_pct_change_3m |
| Encodings | commodity_enc, market_enc |

Cyclical encoding (sin/cos) is used for month to avoid the discontinuity between December and January. Label encoders are saved separately and loaded at inference time.

### Validation Strategy

Rolling window validation replaces a single train/test split. The model trains on three years of data and predicts the fourth year. The window shifts forward one year per fold producing 18 independent evaluation folds. This directly replicates how the model is used in production and provides a more reliable accuracy estimate than a single split.

### Hyperparameter Tuning

XGBoost and LightGBM were tuned using `RandomizedSearchCV` with `cv=3` cross-validation within each training fold, covering `n_estimators`, `learning_rate`, `max_depth`, `subsample`, and `colsample_bytree`.

Best XGBoost parameters: `n_estimators=500, learning_rate=0.1, max_depth=6, subsample=0.8, colsample_bytree=1.0`

### Model Comparison Results

Results averaged across all 18 rolling window folds. Primary metric is MAPE. All prices in RWF.

| Model | MAE (RWF) | RMSE (RWF) | R2 | MAPE (%) | Directional Accuracy (%) |
|---|---|---|---|---|---|
| XGBoost (tuned) | 45.90 | 69.84 | 0.886 | 8.75 | 92.81 |
| Linear Regression | 48.17 | 70.53 | 0.921 | 8.78 | 93.26 |
| LightGBM (tuned) | 48.66 | 72.67 | 0.863 | 9.13 | 92.00 |
| Ridge Regression | 55.94 | 77.59 | 0.894 | 10.43 | 92.84 |
| Random Forest | 62.98 | 89.98 | 0.839 | 11.69 | 91.17 |

**Best model: XGBoost (tuned)** - MAPE 8.75%, MAE 45.90 RWF, Directional Accuracy 92.81%.

XGBoost narrowly outperforms Linear Regression on MAPE (8.75% vs 8.78%) and is the model wired into `main.py`. Linear Regression has a slightly higher R2 (0.921 vs 0.886), suggesting the lag and rolling features capture most of the temporal signal linearly. All five models achieve directional accuracy above 91%, correctly predicting whether prices go up or down more than 9 times out of 10.

### Model Files

```
Best_model/model_xgb_tuned.pkl
encoders/le_commodity.pkl
encoders/le_market.pkl
```

### Model Retraining

After uploading real price data through the admin panel the model can be retrained:

1. Go to Admin then Data Upload
2. Upload a CSV file with columns: `commodity, market, price_rwf, price_date`
3. Click Retrain Model on Uploaded Data
4. The retrained model replaces the previous one immediately
5. All subsequent predictions use the updated model

Via API:

```bash
curl -X POST https://sokoprice.onrender.com/admin/retrain \
  -H "Authorization: Bearer <admin_token>"
```

---

## API Endpoints

### Authentication

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register a new user | None |
| POST | `/auth/login` | Login and receive JWT token | None |
| GET | `/auth/me` | Get current user profile | User |

### Forecasting and Catalog

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/` | Health check and model status | None |
| GET | `/commodities` | List supported commodities | None |
| GET | `/markets` | List supported markets | None |
| POST | `/predict` | 7-day price forecast | None |
| POST | `/recommend` | Cheapest market ranking | None |

### Shopping

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/basket` | Estimate basket cost | None |
| GET | `/alerts/{commodity}` | Price threshold check | None |
| GET | `/products` | Public seller listings | None |

### Seller

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/seller/products` | Get own listings | Seller |
| POST | `/seller/products` | Add a listing | Seller |
| PUT | `/seller/products/{id}` | Update a listing | Seller |
| DELETE | `/seller/products/{id}` | Delete a listing | Seller |
| POST | `/seller/submit-price` | Submit a real market price | Seller |
| GET | `/seller/submissions` | View own submissions | Seller |
| GET | `/seller/insights/{commodity}` | AI price comparison | Seller |

### Messages

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/messages/send` | Send a message | User |
| GET | `/messages/conversations` | List conversations | User |
| GET | `/messages/unread-count` | Unread message count | User |
| GET | `/messages/{partner_id}` | Get conversation | User |
| POST | `/messages/{id}/read` | Mark as read | User |

### Admin

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/admin/stats` | Platform statistics | Admin |
| GET | `/admin/users` | List all users | Admin |
| PUT | `/admin/users/{id}/suspend` | Suspend or reactivate | Admin |
| GET | `/admin/products` | All seller products | Admin |
| POST | `/admin/upload-prices` | Upload price CSV | Admin |
| POST | `/admin/retrain` | Retrain the model | Admin |
| GET | `/admin/price-records` | View uploaded prices | Admin |
| POST | `/admin/approve-submission/{id}` | Approve seller submission | Admin |
| POST | `/admin/reject-submission/{id}` | Reject seller submission | Admin |
| GET | `/admin/pending-submissions` | Pending submissions | Admin |

---

## Installation and Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Evanice4/SokoPrice.git
cd SokoPrice
```

### 2. Install backend dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the backend

```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API at `http://127.0.0.1:8000` | Swagger UI at `http://127.0.0.1:8000/docs`

### 4. Install and start the frontend

```bash
cd frontend
npm install
npm run dev
```

App at `http://localhost:5173`

### 5. Create frontend environment file

Create a file at `frontend/.env` with this content:

```env
VITE_API_URL=http://127.0.0.1:8000
```

For the deployed backend:

```env
VITE_API_URL=https://sokoprice.onrender.com
```

### Admin access (local)

Go to `http://localhost:5173/#admin` while logged in as admin.

---

## Testing

Three levels of testing were performed: unit testing, integration testing, and system testing.

### Unit Testing

Unit tests verify individual functions in isolation including auth utilities, feature engineering, prediction logic, basket calculations, and validation. Tests are in `test_unit.py`.

```bash
python -m pytest test_unit.py -v
```

**Results: 26 passed, 1 skipped**

The skipped test requires the model file to be present locally. All other tests pass.

![Unit test results](assets/testing/unit%20test.PNG)

### Integration Testing

Integration tests verify all API endpoints end to end using FastAPI's test client. Tests cover health check, catalog, auth, forecasting, recommendations, basket, alerts, seller management, and admin endpoints. Tests are in `test_integration.py`.

```bash
python -m pytest test_integration.py -v
```

**Results: 46 passed, 0 failed**

![Integration test results](assets/testing/integration%20test.PNG)

### System Testing

System testing validates the full application from the user's perspective across all features, roles, and devices. Full test cases are documented in `assets/testing/test_system.md`.

#### Android Testing

Market maps, seller listings, market cards, and navigation render correctly on a mobile browser.

![Android market and seller testing](assets/test%20android.jpeg)

![Android testing 2](assets/test%20android%202.jpeg)

#### iOS Testing - Cost Estimator

Basket total, cost breakdown chart, commodity colour legend, and recalculate button display correctly on a mobile browser.

![iOS cost estimator testing](assets/test%20ios.jpeg)

#### iOS Testing - Price Forecast

Forecast results, confidence range, best market recommendation, and market comparison table display correctly on a mobile browser.

![iOS price forecast testing](assets/test%20ios%202.jpeg)

### Test Summary

| Test Type | Tests | Passed | Failed |
|---|---|---|---|
| Unit tests | 27 | 26 | 0 (1 skipped) |
| Integration tests | 46 | 46 | 0 |
| System tests | 94 | 94 | 0 |
| **Total** | **167** | **166** | **0** |

---

## Errors Encountered and Fixes

| Issue | Cause | Fix |
|---|---|---|
| pip dependency conflict warnings | Kaggle pre-installed packages have version mismatches | Ignored, warnings only, no impact on output |
| AttributeError numpy has no attribute _no_nep50_warning | scipy incompatible with numpy 2.x | Upgraded scipy with --no-deps flag |
| Model predicting 0 for all commodities | dill module missing, model failed to load silently | pip install dill, added to requirements.txt |
| Model predicting same price for all markets | Lag features built from median fallback not real price history | Upload real price CSV via admin dashboard |
| Model predicting negative or very large values | XGBoost trained on unscaled y_train but prediction applied scaler_y inverse transform | Removed scaler_y from inference pipeline |
| Database resetting on every restart | SQLite path resolved relative to working directory | Set absolute path using os.path.abspath in database.py |
| Users losing login after browser refresh | JWT payload lacks name field, re-parsing token lost user object | Store full user object in localStorage as sp_user |
| PostgreSQL queries failing on Render | SQLite uses ? placeholders, PostgreSQL uses %s | Added q() helper function to convert placeholders at runtime |
| LSTM and GRU MAPE above 2700% | Scaler mismatch on inverse transform for sequence predictions | Excluded from production, documented as known issue |
| Free Render instance delay | Free Render services sleep after 15 minutes of inactivity | First request after inactivity takes 30 to 60 seconds then resumes normally |

---

## Future Work

Transport costs are not factored into the market recommendation. A future version should incorporate estimated moto-taxi fares based on GPS distance so the recommendation reflects total trip cost not just food price.

The KES to RWF conversion uses a fixed multiplier of 10. Production should use a live exchange rate API.

Seasonal patterns learned from Kenya data may not transfer directly to Kigali. Seasonal features should be re-validated once real Kigali data is available.

Real Kigali price data should be collected from the five markets at regular intervals recording commodity, market, price, and date consistently.

Other planned improvements include migrating chat to Firebase Realtime Database for true real-time bidirectional messaging, adding automated CI/CD from GitHub, and adding model version tracking alongside retraining workflows.

A future version will include proactive price alerts that notify users automatically when predicted prices spike above historical averages, without requiring a manual threshold entry. 

The system will also incorporate a nutrition-aware shopping assistant chatbot that recommends the most nutritious commodity options available at the cheapest market, helping households make food choices that balance both cost and nutritional value.

---

## Project Structure

```
SokoPrice/
├── main.py
├── database.py
├── auth.py
├── requirements.txt
├── pytest.ini
├── conftest.py
├── test_unit.py
├── test_integration.py
├── Best_model/
│   └── model_xgb_tuned.pkl
├── encoders/
│   ├── le_commodity.pkl
│   └── le_market.pkl
├── Data/
│   └── wfp_food_prices_ken.csv
├── notebook/
│   └── SokoPrice_V2_Notebook.ipynb
├── visualizations/
│   └── (viz1 to viz17 png files)
├── sample-data/
│   ├── kigali_prices_2024.csv
│   ├── kigali_prices_2025.csv
│   └── kigali_prices_2026.csv
├── assets/
│   ├── test android.jpeg
│   ├── test android 2.jpeg
│   ├── test ios.jpeg
│   ├── test ios 2.jpeg
│   └── testing/
│       ├── test_system.md
│       ├── unit test.PNG
│       └── integration test.PNG
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── firebase.json
└── .firebaserc
```

**Author:** Nice Eva Karabaranga | July 2026