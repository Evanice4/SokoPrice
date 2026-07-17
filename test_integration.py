"""
SokoPrice Integration Tests
Tests API endpoints end to end using FastAPI test client.
Run: pytest test_integration.py -v
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Test user credentials
TEST_CONSUMER = {
    "name": "Test Consumer",
    "email": "testconsumer_integration@sokoprice.rw",
    "password": "test123",
    "role": "consumer"
}

TEST_SELLER = {
    "name": "Test Seller",
    "email": "testseller_integration@sokoprice.rw",
    "password": "test123",
    "role": "seller",
    "market": "Kimironko"
}

ADMIN_CREDENTIALS = {
    "email": "admin@sokoprice.rw",
    "password": "admin123"
}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def consumer_token():
    # Try register first
    client.post("/auth/register", json=TEST_CONSUMER)
    r = client.post("/auth/login", json={
        "email": TEST_CONSUMER["email"],
        "password": TEST_CONSUMER["password"]
    })
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def seller_token():
    client.post("/auth/register", json=TEST_SELLER)
    r = client.post("/auth/login", json={
        "email": TEST_SELLER["email"],
        "password": TEST_SELLER["password"]
    })
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = client.post("/auth/login", json=ADMIN_CREDENTIALS)
    assert r.status_code == 200
    return r.json()["token"]


# ── Health check tests ────────────────────────────────────────────────────────

class TestHealth:
    def test_root_returns_200(self):
        r = client.get("/")
        assert r.status_code == 200

    def test_root_returns_status(self):
        r = client.get("/")
        data = r.json()
        assert data["status"] == "SokoPrice API is running"

    def test_root_returns_version(self):
        r = client.get("/")
        assert "version" in r.json()

    def test_root_returns_model_info(self):
        r = client.get("/")
        data = r.json()
        assert "best_model" in data
        assert "model_mape" in data
        assert data["price_unit"] == "RWF"


# ── Catalog tests ─────────────────────────────────────────────────────────────

class TestCatalog:
    def test_commodities_endpoint(self):
        r = client.get("/commodities")
        assert r.status_code == 200
        assert "commodities" in r.json()

    def test_commodities_returns_10(self):
        r = client.get("/commodities")
        assert len(r.json()["commodities"]) == 10

    def test_markets_endpoint(self):
        r = client.get("/markets")
        assert r.status_code == 200
        assert "markets" in r.json()

    def test_markets_returns_5(self):
        r = client.get("/markets")
        assert len(r.json()["markets"]) == 5


# ── Auth tests ────────────────────────────────────────────────────────────────

class TestAuth:
    def test_register_new_user(self):
        import uuid
        unique_email = f"test_{uuid.uuid4().hex[:8]}@sokoprice.rw"
        r = client.post("/auth/register", json={
            "name": "Unique Test",
            "email": unique_email,
            "password": "test123",
            "role": "consumer"
        })
        assert r.status_code == 200
        assert "token" in r.json()
        assert "user" in r.json()

    def test_register_duplicate_email_fails(self):
        import uuid
        email = f"dup_{uuid.uuid4().hex[:8]}@sokoprice.rw"
        client.post("/auth/register", json={
            "name": "First User", "email": email,
            "password": "test123", "role": "consumer"
        })
        r = client.post("/auth/register", json={
            "name": "Second User", "email": email,
            "password": "test456", "role": "consumer"
        })
        assert r.status_code == 400

    def test_login_valid_credentials(self, admin_token):
        assert admin_token is not None
        assert len(admin_token) > 10

    def test_login_invalid_password(self):
        r = client.post("/auth/login", json={
            "email": "admin@sokoprice.rw",
            "password": "wrongpassword"
        })
        assert r.status_code == 401

    def test_login_nonexistent_email(self):
        r = client.post("/auth/login", json={
            "email": "nobody@sokoprice.rw",
            "password": "test123"
        })
        assert r.status_code == 401

    def test_me_endpoint_with_valid_token(self, consumer_token):
        r = client.get("/auth/me", headers={
            "Authorization": f"Bearer {consumer_token}"
        })
        assert r.status_code == 200
        assert "email" in r.json()

    def test_me_endpoint_without_token(self):
        r = client.get("/auth/me")
        assert r.status_code == 401


# ── Forecasting tests ─────────────────────────────────────────────────────────

class TestForecasting:
    def test_predict_valid_request(self):
        from datetime import date, timedelta
        r = client.post("/predict", json={
            "commodity": "Maize",
            "market": "Kimironko",
            "forecast_date": str(date.today())
        })
        assert r.status_code == 200
        data = r.json()
        assert "predicted_price_kes" in data
        assert data["predicted_price_kes"] > 0

    def test_predict_returns_confidence_range(self):
        from datetime import date
        r = client.post("/predict", json={
            "commodity": "Rice",
            "market": "Nyabugogo",
            "forecast_date": str(date.today())
        })
        assert r.status_code == 200
        data = r.json()
        assert data["confidence_lower"] < data["predicted_price_kes"]
        assert data["confidence_upper"] > data["predicted_price_kes"]

    def test_predict_returns_trend(self):
        from datetime import date
        r = client.post("/predict", json={
            "commodity": "Potatoes",
            "market": "Kicukiro",
            "forecast_date": str(date.today())
        })
        assert r.status_code == 200
        assert r.json()["trend"] in ["rising", "falling", "stable"]

    def test_predict_invalid_commodity(self):
        from datetime import date
        r = client.post("/predict", json={
            "commodity": "Avocado",
            "market": "Kimironko",
            "forecast_date": str(date.today())
        })
        assert r.status_code == 400

    def test_predict_invalid_market(self):
        from datetime import date
        r = client.post("/predict", json={
            "commodity": "Maize",
            "market": "Nairobi",
            "forecast_date": str(date.today())
        })
        assert r.status_code == 400

    def test_predict_future_date_within_7_days(self):
        from datetime import date, timedelta
        r = client.post("/predict", json={
            "commodity": "Maize",
            "market": "Kimironko",
            "forecast_date": str(date.today() + timedelta(days=6))
        })
        assert r.status_code == 200

    def test_predict_date_too_far_ahead_fails(self):
        from datetime import date, timedelta
        r = client.post("/predict", json={
            "commodity": "Maize",
            "market": "Kimironko",
            "forecast_date": str(date.today() + timedelta(days=10))
        })
        assert r.status_code == 400

    def test_predict_past_date_fails(self):
        from datetime import date, timedelta
        r = client.post("/predict", json={
            "commodity": "Maize",
            "market": "Kimironko",
            "forecast_date": str(date.today() - timedelta(days=1))
        })
        assert r.status_code == 400

    def test_all_commodities_predict_successfully(self):
        from datetime import date
        commodities = [
            "Maize", "Maize Flour", "Potatoes", "Rice",
            "Beans (Dry)", "Sorghum", "Bananas", "Spinach", "Cabbage", "Flour"
        ]
        for commodity in commodities:
            r = client.post("/predict", json={
                "commodity": commodity,
                "market": "Kimironko",
                "forecast_date": str(date.today())
            })
            assert r.status_code == 200, f"Failed for {commodity}"
            assert r.json()["predicted_price_kes"] > 0


# ── Recommendation tests ──────────────────────────────────────────────────────

class TestRecommendations:
    def test_recommend_returns_5_markets(self):
        from datetime import date
        r = client.post("/recommend", json={
            "commodity": "Maize",
            "forecast_date": str(date.today())
        })
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_recommend_sorted_by_price(self):
        from datetime import date
        r = client.post("/recommend", json={
            "commodity": "Rice",
            "forecast_date": str(date.today())
        })
        prices = [m["predicted_price_kes"] for m in r.json()]
        assert prices == sorted(prices)

    def test_recommend_with_budget_filter(self):
        from datetime import date
        r = client.post("/recommend", json={
            "commodity": "Maize",
            "forecast_date": str(date.today()),
            "budget_kes": 1000
        })
        assert r.status_code == 200
        for market in r.json():
            assert market["predicted_price_kes"] <= 1000

    def test_recommend_saving_is_non_negative(self):
        from datetime import date
        r = client.post("/recommend", json={
            "commodity": "Maize",
            "forecast_date": str(date.today())
        })
        for market in r.json():
            assert market["saving_vs_most_expensive"] >= 0


# ── Basket tests ──────────────────────────────────────────────────────────────

class TestBasket:
    def test_basket_returns_total(self):
        from datetime import date
        r = client.post("/basket", json={
            "market": "Kimironko",
            "forecast_date": str(date.today()),
            "items": [
                {"commodity": "Maize", "quantity_kg": 2},
                {"commodity": "Rice", "quantity_kg": 1}
            ]
        })
        assert r.status_code == 200
        assert r.json()["total_kes"] > 0

    def test_basket_total_equals_sum_of_items(self):
        from datetime import date
        r = client.post("/basket", json={
            "market": "Kimironko",
            "forecast_date": str(date.today()),
            "items": [
                {"commodity": "Maize", "quantity_kg": 2},
                {"commodity": "Potatoes", "quantity_kg": 1.5}
            ]
        })
        data = r.json()
        calculated = sum(item["line_total_kes"] for item in data["items"])
        assert abs(data["total_kes"] - calculated) < 0.01

    def test_basket_invalid_commodity_fails(self):
        from datetime import date
        r = client.post("/basket", json={
            "market": "Kimironko",
            "forecast_date": str(date.today()),
            "items": [{"commodity": "Avocado", "quantity_kg": 1}]
        })
        assert r.status_code == 400

    def test_basket_invalid_market_fails(self):
        from datetime import date
        r = client.post("/basket", json={
            "market": "Nairobi",
            "forecast_date": str(date.today()),
            "items": [{"commodity": "Maize", "quantity_kg": 1}]
        })
        assert r.status_code == 400


# ── Alerts tests ──────────────────────────────────────────────────────────────

class TestAlerts:
    def test_alert_within_budget(self):
        r = client.get("/alerts/Maize?threshold_kes=100000&market=Kimironko")
        assert r.status_code == 200
        assert r.json()["alert"] is False

    def test_alert_over_budget(self):
        r = client.get("/alerts/Maize?threshold_kes=1&market=Kimironko")
        assert r.status_code == 200
        assert r.json()["alert"] is True

    def test_alert_returns_prediction(self):
        r = client.get("/alerts/Rice?threshold_kes=5000&market=Nyabugogo")
        assert r.status_code == 200
        assert r.json()["predicted_price_kes"] > 0

    def test_alert_invalid_commodity(self):
        r = client.get("/alerts/Avocado?threshold_kes=1000&market=Kimironko")
        assert r.status_code == 400


#  Seller tests 

class TestSeller:
    def test_seller_can_add_product(self, seller_token):
        r = client.post("/seller/products",
            json={"commodity": "Maize", "market": "Kimironko",
                  "price_rwf": 520.0, "quantity_kg": 5.0},
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert r.status_code == 200
        assert r.json()["commodity"] == "Maize"

    def test_seller_can_get_products(self, seller_token):
        r = client.get("/seller/products",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert r.status_code == 200
        assert "products" in r.json()

    def test_consumer_cannot_add_product(self, consumer_token):
        r = client.post("/seller/products",
            json={"commodity": "Maize", "market": "Kimironko",
                  "price_rwf": 520.0, "quantity_kg": 5.0},
            headers={"Authorization": f"Bearer {consumer_token}"}
        )
        assert r.status_code == 403

    def test_public_products_accessible(self):
        r = client.get("/products")
        assert r.status_code == 200
        assert "products" in r.json()

    def test_seller_insights_returns_market_prices(self, seller_token):
        r = client.get("/seller/insights/Maize",
            headers={"Authorization": f"Bearer {seller_token}"}
        )
        assert r.status_code == 200
        data = r.json()
        assert "cheapest" in data
        assert "most_expensive" in data
        assert len(data["market_prices"]) == 5


# Admin tests 

class TestAdmin:
    def test_admin_can_get_stats(self, admin_token):
        r = client.get("/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        data = r.json()
        assert "total_users" in data
        assert "total_forecasts" in data

    def test_admin_can_get_users(self, admin_token):
        r = client.get("/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        assert "users" in r.json()

    def test_consumer_cannot_access_admin(self, consumer_token):
        r = client.get("/admin/stats",
            headers={"Authorization": f"Bearer {consumer_token}"}
        )
        assert r.status_code == 403

    def test_admin_can_get_products(self, admin_token):
        r = client.get("/admin/products",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200

    def test_admin_can_upload_prices(self, admin_token):
        import io
        csv_content = (
            "commodity,market,price_rwf,price_date\n"
            "Maize,Kimironko,520,2026-07-01\n"
            "Rice,Nyabugogo,10500,2026-07-01\n"
        )
        r = client.post("/admin/upload-prices",
            files={"file": ("prices.csv", io.BytesIO(csv_content.encode()), "text/csv")},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        assert r.json()["rows_added"] == 2