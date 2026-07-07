"""
SokoPrice FastAPI Backend
AI Grocery Price Forecasting for Kigali Informal Markets
Best model: XGBoost (tuned) - MAPE 8.27%, R2 0.9845
Author: Nice Eva Karabaranga | ALU Capstone 2026
Run   : python -m uvicorn main:app --reload
Docs  : http://127.0.0.1:8000/docs
"""

import warnings
warnings.filterwarnings('ignore')

import csv
import io
import os
import numpy as np
import joblib
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import init_db, get_db
from auth import (hash_password, verify_password, create_token,
                  get_current_user, require_admin, require_seller)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="SokoPrice API",
    description=(
        "AI-powered grocery price forecasting and market recommendation "
        "for informal markets in Kigali, Rwanda.\n\n"
        "**Best model:** XGBoost (tuned) - MAPE 8.27%, R2 0.9845\n\n"
        "**Prices in:** RWF (Rwandan Francs)"
    ),
    version="2.0.0",
    contact={"name": "Nice Eva Karabaranga", "email": "n.karabaranga@alustudent.com"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    load_model()


# ── Constants ─────────────────────────────────────────────────────────────────
KES_TO_RWF = 10.0

COMMODITIES = [
    "Maize", "Maize Flour", "Potatoes", "Rice",
    "Beans (Dry)", "Sorghum", "Bananas", "Spinach", "Cabbage", "Flour"
]

MARKETS = [
    "Kimironko", "Nyabugogo", "Kicukiro",
    "Kimisagara", "Kigali City"
]

FEATURE_COLS = [
    'year', 'month_sin', 'month_cos', 'quarter', 'day_of_year',
    'price_lag_1', 'price_lag_2', 'price_lag_3', 'price_lag_6',
    'rolling_mean_3', 'rolling_mean_6', 'rolling_mean_12',
    'rolling_std_3', 'rolling_std_6',
    'price_pct_change_1m', 'price_pct_change_3m',
    'commodity_enc', 'market_enc'
]

COMMODITY_MEDIANS_RWF = {
    "Maize": 520.0, "Maize Flour": 3850.0, "Potatoes": 1450.0,
    "Rice": 12500.0, "Beans (Dry)": 3100.0, "Sorghum": 600.0,
    "Bananas": 3100.0, "Spinach": 800.0, "Cabbage": 2200.0, "Flour": 3800.0
}

# ── Model loading ─────────────────────────────────────────────────────────────
model = scaler_X = scaler_y = None
COMMODITY_ENC = {}
MARKET_ENC    = {}
MODELS_OK     = False


def load_model():
    global model, scaler_X, scaler_y, COMMODITY_ENC, MARKET_ENC, MODELS_OK
    try:
        model     = joblib.load("Best_model/model_xgb_tuned.pkl")
        le_comm   = joblib.load("encoders/le_commodity.pkl")
        le_market = joblib.load("encoders/le_market.pkl")
        COMMODITY_ENC = dict(zip(le_comm.classes_,   range(len(le_comm.classes_))))
        MARKET_ENC    = dict(zip(le_market.classes_, range(len(le_market.classes_))))
        MODELS_OK     = True
        print("Model and encoders loaded")
    except Exception as e:
        MODELS_OK = False
        print(f"Warning: model not loaded - {e}")


# ── Prediction helpers ────────────────────────────────────────────────────────
def get_recent_prices(commodity: str, market: str, n: int = 12) -> list:
    """Fetch recent real prices from all available sources:
    1. Admin-uploaded price_records (highest priority)
    2. Approved seller submissions (also in price_records with source='seller_submission')
    3. Active seller product listings
    Falls back to commodity median with small noise if insufficient data."""
    conn = get_db()

    # 1. Price records (includes both admin uploads and approved seller submissions)
    rows = conn.execute(
        """SELECT price_rwf, price_date FROM price_records
           WHERE commodity=? AND market=?
           ORDER BY price_date DESC LIMIT ?""",
        (commodity, market, n)
    ).fetchall()

    # 2. Also pull from active seller product listings for additional recency
    seller_rows = conn.execute(
        """SELECT price_rwf, updated_at as price_date FROM products
           WHERE commodity=? AND market=? AND status='active'
           ORDER BY updated_at DESC LIMIT ?""",
        (commodity, market, n)
    ).fetchall()

    # 3. Recently approved submissions not yet in price_records (edge case safety net)
    approved_rows = conn.execute(
        """SELECT price_rwf, created_at as price_date FROM pending_price_submissions
           WHERE commodity=? AND market=? AND status='approved'
           ORDER BY created_at DESC LIMIT ?""",
        (commodity, market, n)
    ).fetchall()

    conn.close()

    # Combine all sources, sort by date descending, take newest n (deduplicated by price_date)
    combined = list(rows) + list(seller_rows) + list(approved_rows)
    combined.sort(key=lambda r: r["price_date"], reverse=True)

    # Deduplicate by date (keep first occurrence = highest priority source)
    seen_dates = set()
    unique = []
    for r in combined:
        if r["price_date"] not in seen_dates:
            seen_dates.add(r["price_date"])
            unique.append(r)
    unique = unique[:n]

    if len(unique) >= 6:
        return [r["price_rwf"] for r in reversed(unique)]

    # Fallback: use commodity median with small noise
    base = COMMODITY_MEDIANS_RWF.get(commodity, 2000.0)
    np.random.seed(42)
    return [base * (1 + np.random.uniform(-0.05, 0.05)) for _ in range(12)]


def build_features(commodity, market, forecast_date, price_history=None):
    year        = forecast_date.year
    month       = forecast_date.month
    quarter     = (month - 1) // 3 + 1
    day_of_year = forecast_date.timetuple().tm_yday
    month_sin   = np.sin(2 * np.pi * month / 12)
    month_cos   = np.cos(2 * np.pi * month / 12)
    ce = COMMODITY_ENC.get(commodity, 0)
    me = MARKET_ENC.get(market, 0)

    ph = price_history or get_recent_prices(commodity, market)

    lag1 = ph[-1] if len(ph) >= 1 else COMMODITY_MEDIANS_RWF.get(commodity, 2000)
    lag2 = ph[-2] if len(ph) >= 2 else lag1
    lag3 = ph[-3] if len(ph) >= 3 else lag1
    lag6 = ph[-6] if len(ph) >= 6 else lag1

    rm3  = np.mean(ph[-3:])  if len(ph) >= 3  else lag1
    rm6  = np.mean(ph[-6:])  if len(ph) >= 6  else lag1
    rm12 = np.mean(ph[-12:]) if len(ph) >= 12 else lag1
    rs3  = np.std(ph[-3:])   if len(ph) >= 3  else 0.0
    rs6  = np.std(ph[-6:])   if len(ph) >= 6  else 0.0
    p1m  = (ph[-1]-ph[-2])/ph[-2] if len(ph) >= 2 and ph[-2] else 0.0
    p3m  = (ph[-1]-ph[-4])/ph[-4] if len(ph) >= 4 and ph[-4] else 0.0

    return np.array([[year, month_sin, month_cos, quarter, day_of_year,
                      lag1, lag2, lag3, lag6,
                      rm3, rm6, rm12, rs3, rs6, p1m, p3m, ce, me]])


# ── Prediction cache ───────────────────────────────────────────────────────────
_PRED_CACHE: dict = {}        # key: (commodity, market, forecast_date) -> (timestamp, price)


def run_prediction(commodity, market, forecast_date):
    cache_key = (commodity, market, str(forecast_date))
    now_ts = datetime.utcnow().timestamp()
    if cache_key in _PRED_CACHE:
        cached_ts, cached_price = _PRED_CACHE[cache_key]
        if now_ts - cached_ts < 300:  # 5-minute cache
            return cached_price
    if not MODELS_OK:
        return COMMODITY_MEDIANS_RWF.get(commodity, 2000.0)
    features = build_features(commodity, market, forecast_date)
    pred_rwf = model.predict(features)[0]
    # Model was trained on RWF data — output is already in RWF.
    # Clamp negative predictions to 0 and fall back to median if unreasonable.
    price = round(max(float(pred_rwf), 0.0), 2)
    median = COMMODITY_MEDIANS_RWF.get(commodity, 2000.0)
    if price < median * 0.1 or price > median * 10:
        price = median
    _PRED_CACHE[cache_key] = (now_ts, price)
    return price


def get_trend(commodity, market, forecast_date):
    today_price = run_prediction(commodity, market, forecast_date)
    past_price  = run_prediction(commodity, market, forecast_date - timedelta(days=30))
    diff = (today_price - past_price) / past_price * 100 if past_price else 0
    if diff > 3:  return "rising"
    if diff < -3: return "falling"
    return "stable"


# ── Schemas ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name    : str
    email   : str
    password: str
    role    : str = "consumer"
    market  : Optional[str] = None

class LoginRequest(BaseModel):
    email   : str
    password: str

class PredictRequest(BaseModel):
    model_config  = {"protected_namespaces": ()}
    commodity     : str  = Field(..., example="Maize")
    market        : str  = Field(..., example="Kimironko")
    forecast_date : date = Field(..., example="2026-07-10")

class PredictResponse(BaseModel):
    model_config        = {"protected_namespaces": ()}
    commodity           : str
    market              : str
    forecast_date       : str
    predicted_price_kes : float
    confidence_lower    : float
    confidence_upper    : float
    trend               : str
    model_used          : str
    data_source         : str

class RecommendRequest(BaseModel):
    commodity     : str            = Field(..., example="Beans (Dry)")
    forecast_date : date           = Field(..., example="2026-07-10")
    budget_kes    : Optional[float]= Field(None, example=5000.0)

class MarketRec(BaseModel):
    market                   : str
    predicted_price_kes      : float
    saving_vs_most_expensive : float

class BasketItem(BaseModel):
    commodity   : str   = Field(..., example="Maize")
    quantity_kg : float = Field(..., example=2.0)

class BasketRequest(BaseModel):
    market        : str          = Field(..., example="Kimironko")
    items         : List[BasketItem]
    forecast_date : date         = Field(..., example="2026-07-10")

class ProductCreate(BaseModel):
    commodity   : str
    market      : str
    price_rwf   : float
    quantity_kg : float = 1.0
    unit        : str   = "kg"

class ProductUpdate(BaseModel):
    price_rwf   : Optional[float] = None
    quantity_kg : Optional[float] = None
    status      : Optional[str]   = None


class SendMessageRequest(BaseModel):
    receiver_id: int
    message    : str
    product_id : Optional[int] = None


class SubmitPriceRequest(BaseModel):
    commodity : str
    market    : str
    price_rwf : float
    price_date: str  # YYYY-MM-DD


# ── Auth endpoints ────────────────────────────────────────────────────────────
@app.post("/auth/register", tags=["Auth"])
def register(req: RegisterRequest):
    """Register a new user (consumer or seller)."""
    conn = get_db()
    existing = conn.execute(
        "SELECT id FROM users WHERE email=?", (req.email,)
    ).fetchone()
    if existing:
        conn.close()
        raise HTTPException(400, "Email already registered")
    if req.role not in ("consumer", "seller"):
        conn.close()
        raise HTTPException(400, "Role must be consumer or seller")
    conn.execute(
        "INSERT INTO users(name,email,password,role,market,created_at) VALUES(?,?,?,?,?,?)",
        (req.name, req.email, hash_password(req.password),
         req.role, req.market, datetime.utcnow().isoformat())
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE email=?", (req.email,)).fetchone()
    conn.close()
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": {
        "id": user["id"], "name": user["name"],
        "email": user["email"], "role": user["role"],
        "market": user["market"]
    }}


@app.post("/auth/login", tags=["Auth"])
def login(req: LoginRequest):
    """Login and receive a JWT token."""
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email=?", (req.email,)
    ).fetchone()
    conn.close()
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(401, "Invalid email or password")
    if not user["active"]:
        raise HTTPException(403, "Account suspended")
    token = create_token(user["id"], user["email"], user["role"])
    return {"token": token, "user": {
        "id": user["id"], "name": user["name"],
        "email": user["email"], "role": user["role"],
        "market": user["market"]
    }}


@app.get("/auth/me", tags=["Auth"])
def me(current_user: dict = Depends(get_current_user)):
    """Get current user info from token."""
    conn = get_db()
    user = conn.execute(
        "SELECT id,name,email,role,market,created_at FROM users WHERE id=?",
        (current_user["user_id"],)
    ).fetchone()
    conn.close()
    if not user:
        raise HTTPException(404, "User not found")
    return dict(user)


# ── Core endpoints ────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    """Health check."""
    return {
        "status"       : "SokoPrice API is running",
        "version"      : "2.0.0",
        "models_loaded": MODELS_OK,
        "best_model"   : "XGBoost (tuned)",
        "model_mape"   : "8.27%",
        "model_r2"     : "0.9845",
        "price_unit"   : "RWF",
    }


@app.get("/commodities", tags=["Catalog"])
def list_commodities():
    return {"commodities": sorted(COMMODITIES)}


@app.get("/markets", tags=["Catalog"])
def list_markets():
    return {"markets": MARKETS}


@app.post("/predict", response_model=PredictResponse, tags=["Forecasting"])
def predict(req: PredictRequest):
    """Forecast price for a commodity at a Kigali market."""
    if req.commodity not in COMMODITIES:
        raise HTTPException(400, f"Unsupported commodity: {req.commodity}")
    if req.market not in MARKETS:
        raise HTTPException(400, f"Unsupported market: {req.market}")
    days_ahead = (req.forecast_date - date.today()).days
    if days_ahead > 7:
        raise HTTPException(400, "Forecast date must be within 7 days")
    if days_ahead < 0:
        raise HTTPException(400, "Forecast date cannot be in the past")

    price = run_prediction(req.commodity, req.market, req.forecast_date)
    trend = get_trend(req.commodity, req.market, req.forecast_date)

    conn = get_db()
    has_real_data = conn.execute(
        "SELECT COUNT(*) as c FROM price_records WHERE commodity=? AND market=?",
        (req.commodity, req.market)
    ).fetchone()["c"] > 5
    conn.execute(
        "INSERT INTO forecast_log(commodity,market,forecast_date,predicted_rwf,created_at) VALUES(?,?,?,?,?)",
        (req.commodity, req.market, str(req.forecast_date), price, datetime.utcnow().isoformat())
    )
    conn.commit()
    conn.close()

    return PredictResponse(
        commodity           = req.commodity,
        market              = req.market,
        forecast_date       = str(req.forecast_date),
        predicted_price_kes = price,
        confidence_lower    = round(price * 0.90, 2),
        confidence_upper    = round(price * 1.10, 2),
        trend               = trend,
        model_used          = "XGBoost (tuned)",
        data_source         = "real_prices" if has_real_data else "proxy_data"
    )


@app.post("/recommend", response_model=List[MarketRec], tags=["Recommendations"])
def recommend(req: RecommendRequest):
    """Rank all markets by predicted price for a commodity."""
    if req.commodity not in COMMODITIES:
        raise HTTPException(400, f"Unsupported commodity: {req.commodity}")
    prices = []
    for m in MARKETS:
        p = run_prediction(req.commodity, m, req.forecast_date)
        prices.append({"market": m, "price": p})
    prices.sort(key=lambda x: x["price"])
    most_exp = prices[-1]["price"]
    recs = []
    for mp in prices:
        if req.budget_kes and mp["price"] > req.budget_kes:
            continue
        recs.append(MarketRec(
            market=mp["market"],
            predicted_price_kes=mp["price"],
            saving_vs_most_expensive=round(most_exp - mp["price"], 2)
        ))
    return recs


@app.post("/basket", tags=["Shopping"])
def basket(req: BasketRequest):
    """Estimate total cost of a grocery basket."""
    if req.market not in MARKETS:
        raise HTTPException(400, f"Unsupported market: {req.market}")
    items, total = [], 0.0
    for item in req.items:
        if item.commodity not in COMMODITIES:
            raise HTTPException(400, f"Unsupported commodity: {item.commodity}")
        up = run_prediction(item.commodity, req.market, req.forecast_date)
        lt = round(up * item.quantity_kg, 2)
        total += lt
        items.append({"commodity": item.commodity, "quantity_kg": item.quantity_kg,
                      "unit_price_kes": up, "line_total_kes": lt})
    return {"market": req.market, "forecast_date": str(req.forecast_date),
            "items": items, "total_kes": round(total, 2),
            "model_used": "XGBoost (tuned)"}


@app.get("/alerts/{commodity}", tags=["Alerts"])
def alerts(commodity: str, threshold_kes: float = 1000.0, market: str = "Kimironko"):
    """Check if predicted price exceeds budget threshold."""
    if commodity not in COMMODITIES:
        raise HTTPException(400, f"Unsupported commodity: {commodity}")
    if market not in MARKETS:
        raise HTTPException(400, f"Unsupported market: {market}")
    predicted = run_prediction(commodity, market, date.today())
    alert     = predicted > threshold_kes
    trend     = get_trend(commodity, market, date.today())
    return {
        "commodity": commodity, "market": market,
        "predicted_price_kes": predicted, "threshold_kes": threshold_kes,
        "alert": alert, "trend": trend,
        "message": (
            f"Price above your {threshold_kes} RWF threshold."
            if alert else f"Price within your {threshold_kes} RWF budget."
        ),
        "model_used": "XGBoost (tuned)"
    }


# ── Chat / Messaging ──────────────────────────────────────────────────────────
@app.post("/messages/send", tags=["Messages"])
def send_message(req: SendMessageRequest,
                 current_user: dict = Depends(get_current_user)):
    """Send a message to another user (buyer ↔ seller chat)."""
    if current_user["role"] == "admin":
        raise HTTPException(403, "Admins cannot send messages")
    if req.receiver_id == current_user["user_id"]:
        raise HTTPException(400, "Cannot message yourself")
    conn = get_db()
    receiver = conn.execute(
        "SELECT id FROM users WHERE id=?", (req.receiver_id,)
    ).fetchone()
    if not receiver:
        conn.close()
        raise HTTPException(404, "Receiver not found")
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """INSERT INTO messages(sender_id, receiver_id, product_id, message, read, created_at)
           VALUES(?,?,?,?,0,?)""",
        (current_user["user_id"], req.receiver_id, req.product_id, req.message, now)
    )
    conn.commit()
    msg_id = cursor.lastrowid
    msg = conn.execute(
        """SELECT m.*, u.name as sender_name
           FROM messages m JOIN users u ON m.sender_id = u.id
           WHERE m.id=?""", (msg_id,)
    ).fetchone()
    conn.close()
    return dict(msg)


@app.get("/messages/conversations", tags=["Messages"])
def list_conversations(current_user: dict = Depends(get_current_user)):
    """List users you've exchanged messages with, with last message + unread count."""
    if current_user["role"] == "admin":
        raise HTTPException(403, "Admins cannot access messages")
    conn = get_db()
    uid = current_user["user_id"]
    # Get distinct conversation partners with last message and unread count
    rows = conn.execute(
        """SELECT
             CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as partner_id,
             u.name as partner_name,
             u.role as partner_role,
             (SELECT message FROM messages m2
              WHERE (m2.sender_id = ? AND m2.receiver_id = partner_id)
                 OR (m2.sender_id = partner_id AND m2.receiver_id = ?)
              ORDER BY m2.created_at DESC LIMIT 1) as last_message,
             (SELECT created_at FROM messages m3
              WHERE (m3.sender_id = ? AND m3.receiver_id = partner_id)
                 OR (m3.sender_id = partner_id AND m3.receiver_id = ?)
              ORDER BY m3.created_at DESC LIMIT 1) as last_time,
             (SELECT COUNT(*) FROM messages m4
              WHERE m4.sender_id = partner_id AND m4.receiver_id = ? AND m4.read = 0) as unread
           FROM messages m
           JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
           WHERE m.sender_id = ? OR m.receiver_id = ?
           GROUP BY partner_id
           ORDER BY last_time DESC""",
        (uid, uid, uid, uid, uid, uid, uid, uid)
    ).fetchall()
    conn.close()
    return {"conversations": [dict(r) for r in rows]}


@app.get("/messages/{partner_id}", tags=["Messages"])
def get_conversation(partner_id: int,
                     current_user: dict = Depends(get_current_user)):
    """Get full conversation history with a specific user."""
    if current_user["role"] == "admin":
        raise HTTPException(403, "Admins cannot access messages")
    conn = get_db()
    uid = current_user["user_id"]
    # Mark unread messages from this partner as read
    conn.execute(
        "UPDATE messages SET read=1 WHERE sender_id=? AND receiver_id=? AND read=0",
        (partner_id, uid)
    )
    conn.commit()
    rows = conn.execute(
        """SELECT m.*, u.name as sender_name
           FROM messages m JOIN users u ON m.sender_id = u.id
           WHERE (m.sender_id=? AND m.receiver_id=?)
              OR (m.sender_id=? AND m.receiver_id=?)
           ORDER BY m.created_at ASC""",
        (uid, partner_id, partner_id, uid)
    ).fetchall()
    conn.close()
    return {"messages": [dict(r) for r in rows]}


@app.post("/messages/{message_id}/read", tags=["Messages"])
def mark_read(message_id: int,
              current_user: dict = Depends(get_current_user)):
    """Mark a specific message as read."""
    if current_user["role"] == "admin":
        raise HTTPException(403, "Admins cannot access messages")
    conn = get_db()
    conn.execute(
        "UPDATE messages SET read=1 WHERE id=? AND receiver_id=?",
        (message_id, current_user["user_id"])
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.get("/messages/unread-count", tags=["Messages"])
def unread_count(current_user: dict = Depends(get_current_user)):
    """Get total unread message count for badge display."""
    if current_user["role"] == "admin":
        raise HTTPException(403, "Admins cannot access messages")
    conn = get_db()
    row = conn.execute(
        "SELECT COUNT(*) as c FROM messages WHERE receiver_id=? AND read=0",
        (current_user["user_id"],)
    ).fetchone()
    conn.close()
    return {"count": row["c"]}


# ── Seller endpoints ──────────────────────────────────────────────────────────
@app.get("/seller/products", tags=["Seller"])
def seller_products(current_user: dict = Depends(require_seller)):
    """Get all products listed by the logged-in seller."""
    conn = get_db()
    rows = conn.execute(
        """SELECT p.*, u.name as seller_name
           FROM products p JOIN users u ON p.seller_id = u.id
           WHERE p.seller_id=? ORDER BY p.created_at DESC""",
        (current_user["user_id"],)
    ).fetchall()
    conn.close()
    products = [dict(r) for r in rows]
    # Enrich with AI price comparison
    today = date.today()
    for p in products:
        ai_price = run_prediction(p["commodity"], p["market"], today)
        p["ai_price_rwf"]  = ai_price
        p["price_vs_ai"]   = round(p["price_rwf"] - ai_price, 2)
        p["price_status"]  = (
            "above_market" if p["price_rwf"] > ai_price * 1.05
            else "below_market" if p["price_rwf"] < ai_price * 0.95
            else "at_market"
        )
    return {"products": products}


@app.post("/seller/products", tags=["Seller"])
def create_product(req: ProductCreate,
                   current_user: dict = Depends(require_seller)):
    """List a new product."""
    if req.commodity not in COMMODITIES:
        raise HTTPException(400, f"Unsupported commodity: {req.commodity}")
    if req.market not in MARKETS:
        raise HTTPException(400, f"Unsupported market: {req.market}")
    now = datetime.utcnow().isoformat()
    conn = get_db()
    cursor = conn.execute(
        """INSERT INTO products(seller_id,commodity,market,price_rwf,unit,
           quantity_kg,status,created_at,updated_at)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        (current_user["user_id"], req.commodity, req.market, req.price_rwf,
         req.unit, req.quantity_kg, "active", now, now)
    )
    product_id = cursor.lastrowid
    conn.commit()
    product = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    conn.close()
    return dict(product)


@app.put("/seller/products/{product_id}", tags=["Seller"])
def update_product(product_id: int, req: ProductUpdate,
                   current_user: dict = Depends(require_seller)):
    """Update a product price or status. Price changes also feed into the AI model."""
    conn = get_db()
    product = conn.execute(
        "SELECT * FROM products WHERE id=? AND seller_id=?",
        (product_id, current_user["user_id"])
    ).fetchone()
    if not product:
        conn.close()
        raise HTTPException(404, "Product not found or not yours")
    updates = []
    values  = []
    price_changed = False
    if req.price_rwf is not None:
        updates.append("price_rwf=?"); values.append(req.price_rwf)
        price_changed = True
    if req.quantity_kg is not None:
        updates.append("quantity_kg=?"); values.append(req.quantity_kg)
    if req.status is not None:
        updates.append("status=?"); values.append(req.status)
    updates.append("updated_at=?"); values.append(datetime.utcnow().isoformat())
    values.append(product_id)
    conn.execute(f"UPDATE products SET {','.join(updates)} WHERE id=?", values)

    # When price changes, also create a pending price submission for admin review
    # so the new price feeds into the AI model after approval
    if price_changed:
        now = datetime.utcnow().isoformat()
        conn.execute(
            """INSERT INTO pending_price_submissions
               (seller_id, commodity, market, price_rwf, price_date, status, created_at)
               VALUES(?,?,?,?,?,'pending',?)""",
            (current_user["user_id"], product["commodity"], product["market"],
             req.price_rwf, datetime.utcnow().strftime("%Y-%m-%d"), now)
        )
    conn.commit()
    updated = conn.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
    conn.close()
    # Invalidate prediction cache so model picks up new data
    _PRED_CACHE.clear()
    return dict(updated)


@app.delete("/seller/products/{product_id}", tags=["Seller"])
def delete_product(product_id: int,
                   current_user: dict = Depends(require_seller)):
    """Delete a product listing."""
    conn = get_db()
    product = conn.execute(
        "SELECT id FROM products WHERE id=? AND seller_id=?",
        (product_id, current_user["user_id"])
    ).fetchone()
    if not product:
        conn.close()
        raise HTTPException(404, "Product not found or not yours")
    conn.execute("DELETE FROM products WHERE id=?", (product_id,))
    conn.commit()
    conn.close()
    return {"message": "Product deleted"}


@app.post("/seller/submit-price", tags=["Seller"])
def seller_submit_price(req: SubmitPriceRequest,
                        current_user: dict = Depends(require_seller)):
    """Submit a real market price for admin approval. Once approved, it feeds into the AI model."""
    if req.commodity not in COMMODITIES:
        raise HTTPException(400, f"Unsupported commodity: {req.commodity}")
    if req.market not in MARKETS:
        raise HTTPException(400, f"Unsupported market: {req.market}")
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        """INSERT INTO pending_price_submissions
           (seller_id, commodity, market, price_rwf, price_date, status, created_at)
           VALUES(?,?,?,?,?,'pending',?)""",
        (current_user["user_id"], req.commodity, req.market,
         req.price_rwf, req.price_date, now)
    )
    conn.commit()
    conn.close()
    # Invalidate prediction cache so next forecast picks up new data
    _PRED_CACHE.clear()
    return {"message": "Price submitted for admin review. It will feed into the AI model once approved."}


@app.get("/seller/submissions", tags=["Seller"])
def seller_submissions(current_user: dict = Depends(require_seller)):
    """Get all price submissions by the logged-in seller with their approval status."""
    conn = get_db()
    rows = conn.execute(
        """SELECT ps.*, u.name as reviewer_name
           FROM pending_price_submissions ps
           LEFT JOIN users u ON ps.reviewed_by = u.id
           WHERE ps.seller_id = ?
           ORDER BY ps.created_at DESC""",
        (current_user["user_id"],)
    ).fetchall()
    conn.close()
    return {"submissions": [dict(r) for r in rows]}


@app.get("/seller/insights/{commodity}", tags=["Seller"])
def seller_insights(commodity: str,
                    current_user: dict = Depends(require_seller)):
    """Get AI price insight and market comparison for a commodity."""
    if commodity not in COMMODITIES:
        raise HTTPException(400, f"Unsupported commodity: {commodity}")
    today = date.today()
    market_prices = []
    for m in MARKETS:
        p     = run_prediction(commodity, m, today)
        trend = get_trend(commodity, m, today)
        market_prices.append({"market": m, "ai_price": p, "trend": trend})
    market_prices.sort(key=lambda x: x["ai_price"])
    return {
        "commodity"    : commodity,
        "market_prices": market_prices,
        "cheapest"     : market_prices[0]["market"],
        "most_expensive": market_prices[-1]["market"],
        "price_spread" : round(
            market_prices[-1]["ai_price"] - market_prices[0]["ai_price"], 2
        )
    }


# ── Public products ────────────────────────────────────────────────────────────
@app.get("/products", tags=["Catalog"])
def public_products(market: Optional[str] = None, commodity: Optional[str] = None):
    """Get all active seller listings, optionally filtered."""
    conn = get_db()
    query  = "SELECT p.*, u.name as seller_name FROM products p JOIN users u ON p.seller_id=u.id WHERE p.status='active'"
    params = []
    if market:
        query += " AND p.market=?"; params.append(market)
    if commodity:
        query += " AND p.commodity=?"; params.append(commodity)
    query += " ORDER BY p.price_rwf ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return {"products": [dict(r) for r in rows]}


# ── Admin endpoints ───────────────────────────────────────────────────────────
@app.get("/admin/stats", tags=["Admin"])
def admin_stats(current_user: dict = Depends(require_admin)):
    """Platform-wide statistics."""
    conn = get_db()
    total_users     = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    total_sellers   = conn.execute("SELECT COUNT(*) as c FROM users WHERE role='seller'").fetchone()["c"]
    total_products  = conn.execute("SELECT COUNT(*) as c FROM products WHERE status='active'").fetchone()["c"]
    total_forecasts = conn.execute("SELECT COUNT(*) as c FROM forecast_log").fetchone()["c"]
    total_prices    = conn.execute("SELECT COUNT(*) as c FROM price_records").fetchone()["c"]
    recent_forecasts = conn.execute(
        "SELECT commodity, market, predicted_rwf, created_at FROM forecast_log ORDER BY created_at DESC LIMIT 10"
    ).fetchall()
    top_commodities  = conn.execute(
        "SELECT commodity, COUNT(*) as requests FROM forecast_log GROUP BY commodity ORDER BY requests DESC LIMIT 5"
    ).fetchall()
    conn.close()
    return {
        "total_users"     : total_users,
        "total_sellers"   : total_sellers,
        "total_products"  : total_products,
        "total_forecasts" : total_forecasts,
        "total_price_records": total_prices,
        "recent_forecasts": [dict(r) for r in recent_forecasts],
        "top_commodities" : [dict(r) for r in top_commodities],
    }


@app.get("/admin/users", tags=["Admin"])
def admin_users(current_user: dict = Depends(require_admin)):
    """List all users."""
    conn = get_db()
    users = conn.execute(
        "SELECT id,name,email,role,market,active,created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return {"users": [dict(u) for u in users]}


@app.put("/admin/users/{user_id}/suspend", tags=["Admin"])
def suspend_user(user_id: int, current_user: dict = Depends(require_admin)):
    """Suspend or reactivate a user."""
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    if not user:
        conn.close()
        raise HTTPException(404, "User not found")
    new_status = 0 if user["active"] else 1
    conn.execute("UPDATE users SET active=? WHERE id=?", (new_status, user_id))
    conn.commit()
    conn.close()
    return {"message": "User suspended" if new_status == 0 else "User reactivated",
            "active": bool(new_status)}


@app.get("/admin/products", tags=["Admin"])
def admin_products(current_user: dict = Depends(require_admin)):
    """List all seller products."""
    conn = get_db()
    rows = conn.execute(
        """SELECT p.*, u.name as seller_name, u.email as seller_email
           FROM products p JOIN users u ON p.seller_id=u.id
           ORDER BY p.created_at DESC"""
    ).fetchall()
    conn.close()
    return {"products": [dict(r) for r in rows]}


@app.post("/admin/upload-prices", tags=["Admin"])
async def upload_prices(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin)
):
    """
    Upload a CSV file of real market prices to improve predictions.

    CSV format: commodity, market, price_rwf, price_date (YYYY-MM-DD)
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files accepted")
    content = await file.read()
    reader  = csv.DictReader(io.StringIO(content.decode()))
    required = {"commodity", "market", "price_rwf", "price_date"}
    rows_added = 0
    errors     = []
    now = datetime.utcnow().isoformat()
    conn = get_db()
    for i, row in enumerate(reader, 1):
        if not required.issubset(row.keys()):
            errors.append(f"Row {i}: missing columns")
            continue
        if row["commodity"] not in COMMODITIES:
            errors.append(f"Row {i}: unknown commodity {row['commodity']}")
            continue
        if row["market"] not in MARKETS:
            errors.append(f"Row {i}: unknown market {row['market']}")
            continue
        try:
            price = float(row["price_rwf"])
            conn.execute(
                """INSERT INTO price_records
                   (commodity,market,price_rwf,price_date,source,uploaded_by,created_at)
                   VALUES(?,?,?,?,?,?,?)""",
                (row["commodity"], row["market"], price,
                 row["price_date"], "upload", current_user["user_id"], now)
            )
            rows_added += 1
        except Exception as e:
            errors.append(f"Row {i}: {e}")
    conn.commit()
    conn.close()
    # Invalidate prediction cache so model uses new data immediately
    _PRED_CACHE.clear()
    return {
        "rows_added": rows_added,
        "errors"    : errors[:10],
        "message"   : f"Successfully added {rows_added} price records. Model predictions will now use real data."
    }


@app.post("/admin/retrain", tags=["Admin"])
def retrain_model(current_user: dict = Depends(require_admin)):
    """
    Retrain the XGBoost model on all real price data in the database.
    Returns new model metrics (MAPE, R², RMSE, samples used).
    The model is saved and immediately used for all future predictions.
    """
    try:
        import xgboost as xgb
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import mean_absolute_percentage_error, r2_score, mean_squared_error
    except ImportError as e:
        raise HTTPException(500, f"ML dependency missing: {e}")

    conn = get_db()
    rows = conn.execute(
        """SELECT commodity, market, price_rwf, price_date FROM price_records
           ORDER BY commodity, market, price_date ASC"""
    ).fetchall()
    conn.close()

    if len(rows) < 30:
        raise HTTPException(
            400,
            f"Need at least 30 price records to retrain. Currently have {len(rows)}. "
            "Upload more data via CSV or approve more seller submissions."
        )

    # Group by (commodity, market) to build per-series price histories
    from collections import defaultdict
    series = defaultdict(list)
    for r in rows:
        series[(r["commodity"], r["market"])].append({
            "price": r["price_rwf"],
            "date": r["price_date"]
        })

    # Build training samples: for each date with enough history, compute features → target
    X_list, y_list = [], []
    for (commodity, market), prices in series.items():
        prices.sort(key=lambda p: p["date"])
        for i in range(12, len(prices)):
            # Use prior 12 months of prices as history for this prediction point
            hist = [p["price"] for p in prices[:i]]
            target = prices[i]["price"]
            target_date_str = prices[i]["date"]
            try:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
            except ValueError:
                continue

            # Build features from the history available BEFORE the target date
            features = build_features(commodity, market, target_date, hist)
            if features is not None and target > 0:
                X_list.append(features[0])
                y_list.append(target)

    if len(X_list) < 20:
        raise HTTPException(
            400,
            f"Only {len(X_list)} training samples could be built (need ≥20). "
            "Upload more price data spanning more dates per commodity-market pair."
        )

    X = np.array(X_list)
    y = np.array(y_list)

    # Train / test split (chronological, so no shuffle to avoid leakage)
    split_idx = int(len(X) * 0.85)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    # Train XGBoost with same hyperparameters as the original tuned model
    new_model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1
    )
    new_model.fit(X_train, y_train)

    # Evaluate
    y_pred = new_model.predict(X_test)
    mape = mean_absolute_percentage_error(y_test, y_pred) * 100
    r2 = r2_score(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    # Save new model
    global model, MODELS_OK
    joblib.dump(new_model, "Best_model/model_xgb_tuned.pkl")
    model = new_model
    MODELS_OK = True

    # Clear prediction cache so all predictions use the retrained model
    _PRED_CACHE.clear()

    return {
        "message": "Model retrained successfully",
        "samples_used": len(X_train),
        "test_samples": len(X_test),
        "mape_percent": round(mape, 2),
        "r2_score": round(r2, 4),
        "rmse_rwf": round(rmse, 2),
        "total_price_records": len(rows),
        "commodity_market_pairs": len(series),
    }


@app.get("/admin/price-records", tags=["Admin"])
def admin_price_records(
    commodity: Optional[str] = None,
    market   : Optional[str] = None,
    current_user: dict = Depends(require_admin)
):
    """View uploaded price records."""
    conn  = get_db()
    query = "SELECT * FROM price_records WHERE 1=1"
    params = []
    if commodity:
        query += " AND commodity=?"; params.append(commodity)
    if market:
        query += " AND market=?"; params.append(market)
    query += " ORDER BY price_date DESC LIMIT 100"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return {"records": [dict(r) for r in rows]}


@app.get("/admin/pending-submissions", tags=["Admin"])
def admin_pending_submissions(current_user: dict = Depends(require_admin)):
    """List all pending price submissions from sellers awaiting review."""
    conn = get_db()
    rows = conn.execute(
        """SELECT ps.*, u.name as seller_name, u.email as seller_email
           FROM pending_price_submissions ps
           JOIN users u ON ps.seller_id = u.id
           WHERE ps.status = 'pending'
           ORDER BY ps.created_at DESC"""
    ).fetchall()
    conn.close()
    return {"submissions": [dict(r) for r in rows]}


@app.post("/admin/approve-submission/{submission_id}", tags=["Admin"])
def admin_approve_submission(submission_id: int,
                              current_user: dict = Depends(require_admin)):
    """Approve a seller's price submission → inserts into price_records for model use."""
    conn = get_db()
    sub = conn.execute(
        "SELECT * FROM pending_price_submissions WHERE id=? AND status='pending'",
        (submission_id,)
    ).fetchone()
    if not sub:
        conn.close()
        raise HTTPException(404, "Submission not found or already processed")
    now = datetime.utcnow().isoformat()
    # Insert into price_records so the model uses this data
    conn.execute(
        """INSERT INTO price_records
           (commodity, market, price_rwf, price_date, source, uploaded_by, created_at)
           VALUES(?,?,?,?,?,?,?)""",
        (sub["commodity"], sub["market"], sub["price_rwf"],
         sub["price_date"], "seller_submission", sub["seller_id"], now)
    )
    # Mark submission as approved
    conn.execute(
        "UPDATE pending_price_submissions SET status='approved', reviewed_by=? WHERE id=?",
        (current_user["user_id"], submission_id)
    )
    conn.commit()
    conn.close()
    # Invalidate prediction cache so model uses new data immediately
    _PRED_CACHE.clear()
    return {"message": "Submission approved. Price record added — model will use this data."}


@app.post("/admin/reject-submission/{submission_id}", tags=["Admin"])
def admin_reject_submission(submission_id: int,
                             current_user: dict = Depends(require_admin)):
    """Reject a seller's price submission."""
    conn = get_db()
    sub = conn.execute(
        "SELECT * FROM pending_price_submissions WHERE id=? AND status='pending'",
        (submission_id,)
    ).fetchone()
    if not sub:
        conn.close()
        raise HTTPException(404, "Submission not found or already processed")
    conn.execute(
        "UPDATE pending_price_submissions SET status='rejected', reviewed_by=? WHERE id=?",
        (current_user["user_id"], submission_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Submission rejected"}
