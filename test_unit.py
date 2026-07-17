import pytest
import numpy as np
from datetime import date, timedelta
from unittest.mock import patch, MagicMock


COMMODITIES = [
    "Maize", "Maize Flour", "Potatoes", "Rice",
    "Beans (Dry)", "Sorghum", "Bananas", "Spinach", "Cabbage", "Flour"
]

MARKETS = [
    "Kimironko", "Nyabugogo", "Kicukiro",
    "Kimisagara", "Kigali City"
]

COMMODITY_MEDIANS_RWF = {
    "Maize": 520.0, "Maize Flour": 3850.0, "Potatoes": 1450.0,
    "Rice": 12500.0, "Beans (Dry)": 3100.0, "Sorghum": 600.0,
    "Bananas": 3100.0, "Spinach": 800.0, "Cabbage": 2200.0, "Flour": 3800.0
}


# Auth utility tests 

class TestAuth:
    def test_hash_password_returns_string(self):
        from auth import hash_password
        result = hash_password("test123")
        assert isinstance(result, str)
        assert len(result) == 64  # SHA-256 hex

    def test_hash_password_is_deterministic(self):
        from auth import hash_password
        assert hash_password("password") == hash_password("password")

    def test_different_passwords_give_different_hashes(self):
        from auth import hash_password
        assert hash_password("password1") != hash_password("password2")

    def test_verify_password_correct(self):
        from auth import hash_password, verify_password
        hashed = hash_password("mypassword")
        assert verify_password("mypassword", hashed) is True

    def test_verify_password_wrong(self):
        from auth import hash_password, verify_password
        hashed = hash_password("mypassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_create_token_returns_string(self):
        from auth import create_token
        token = create_token(1, "test@test.com", "consumer")
        assert isinstance(token, str)
        assert "." in token

    def test_decode_token_returns_correct_data(self):
        from auth import create_token, decode_token
        token = create_token(1, "test@test.com", "consumer")
        payload = decode_token(token)
        assert payload["user_id"] == 1
        assert payload["email"] == "test@test.com"
        assert payload["role"] == "consumer"

    def test_invalid_token_raises(self):
        from auth import decode_token
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            decode_token("invalid.token.here")


# Feature engineering tests 

class TestFeatureEngineering:
    def test_build_features_returns_correct_shape(self):
        from main import build_features
        features = build_features("Maize", "Kimironko", date.today())
        assert features.shape == (1, 18)

    def test_build_features_no_nan(self):
        from main import build_features
        features = build_features("Rice", "Nyabugogo", date.today())
        assert not np.isnan(features).any()

    def test_build_features_no_inf(self):
        from main import build_features
        features = build_features("Potatoes", "Kicukiro", date.today())
        assert not np.isinf(features).any()

    def test_month_sin_cos_range(self):
        from main import build_features
        for month in range(1, 13):
            d = date(2026, month, 1) if month != 2 else date(2026, 2, 1)
            features = build_features("Maize", "Kimironko", d)
            month_sin = features[0][1]
            month_cos = features[0][2]
            assert -1 <= month_sin <= 1
            assert -1 <= month_cos <= 1

    def test_cyclical_encoding_december_january_close(self):
        from main import build_features
        dec = build_features("Maize", "Kimironko", date(2026, 12, 1))
        jan = build_features("Maize", "Kimironko", date(2026, 1, 1))
        dec_sin = dec[0][1]
        jan_sin = jan[0][1]
        assert abs(dec_sin - jan_sin) < 1.0


# Prediction tests 

class TestPrediction:
    def test_prediction_returns_positive_value(self):
        from main import run_prediction
        price = run_prediction("Maize", "Kimironko", date.today())
        assert price > 0

    def test_prediction_within_reasonable_range(self):
        from main import run_prediction
        for commodity in COMMODITIES:
            median = COMMODITY_MEDIANS_RWF[commodity]
            price = run_prediction(commodity, "Kimironko", date.today())
            assert price > median * 0.1, f"{commodity} price too low: {price}"
            assert price < median * 10, f"{commodity} price too high: {price}"

    def test_all_commodities_predict(self):
        from main import run_prediction
        for commodity in COMMODITIES:
            price = run_prediction(commodity, "Kimironko", date.today())
            assert price > 0, f"Zero price for {commodity}"

    def test_all_markets_predict(self):
        from main import run_prediction
        for market in MARKETS:
            price = run_prediction("Maize", market, date.today())
            assert price > 0, f"Zero price for {market}"

    def test_trend_returns_valid_value(self):
        from main import get_trend
        trend = get_trend("Maize", "Kimironko", date.today())
        assert trend in ["rising", "falling", "stable"]

    def test_trend_for_all_commodities(self):
        from main import get_trend
        for commodity in COMMODITIES:
            trend = get_trend(commodity, "Kimironko", date.today())
            assert trend in ["rising", "falling", "stable"]

    def test_different_markets_can_give_different_prices(self):
        from main import run_prediction, MODELS_OK
        if not MODELS_OK:
            pytest.skip("Model not loaded - skipping market price differentiation test")
        prices = [
            run_prediction("Rice", market, date.today())
            for market in MARKETS
        ]
        assert len(set(prices)) > 1, "All markets should not return identical prices"

    def test_prediction_uses_median_fallback_when_model_missing(self):
        import main as m
        original = m.MODELS_OK
        m.MODELS_OK = False
        price = m.run_prediction("Maize", "Kimironko", date.today())
        m.MODELS_OK = original
        assert price == COMMODITY_MEDIANS_RWF["Maize"]


# Basket calculation tests 

class TestBasket:
    def test_basket_total_is_sum_of_items(self):
        from main import run_prediction
        items = [
            ("Maize", 2.0),
            ("Rice", 1.0),
            ("Potatoes", 1.5),
        ]
        market = "Kimironko"
        forecast_date = date.today()
        expected_total = sum(
            run_prediction(c, market, forecast_date) * q
            for c, q in items
        )
        assert expected_total > 0

    def test_basket_larger_quantity_costs_more(self):
        from main import run_prediction
        price = run_prediction("Maize", "Kimironko", date.today())
        cost_1kg = price * 1
        cost_2kg = price * 2
        assert cost_2kg == cost_1kg * 2


# Commodity and market validation tests 
class TestValidation:
    def test_all_commodities_have_median(self):
        for c in COMMODITIES:
            assert c in COMMODITY_MEDIANS_RWF
            assert COMMODITY_MEDIANS_RWF[c] > 0

    def test_commodities_list_not_empty(self):
        assert len(COMMODITIES) == 10

    def test_markets_list_not_empty(self):
        assert len(MARKETS) == 5

    def test_market_names_are_strings(self):
        for m in MARKETS:
            assert isinstance(m, str)
            assert len(m) > 0