# SokoPrice System Testing

System testing validates the full application from the user's perspective across all features, roles, and devices. All tests were performed on the live deployed system at https://soko-price-forecasting.web.app with the backend at https://sokoprice.onrender.com.

---

## Test Environment

| Item | Details |
|---|---|
| Frontend URL | https://soko-price-forecasting.web.app |
| Backend URL | https://sokoprice.onrender.com |
| Database | PostgreSQL on Render |
| ML Model | XGBoost (tuned), MAPE 8.75% |
| Desktop Browser | Chrome 126, Windows 11 |
| Mobile Browser | Chrome Mobile, Android |
| Mobile Browser | Safari, iOS |
| Test Date | July 2026 |

---

## ST-01 User Registration and Login

**Objective:** Verify consumers and sellers can register and log in permanently.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Open Firebase URL | Home page loads | Pass |
| 2 | Click Get Started | Register page opens | Pass |
| 3 | Fill name, email, password, select Consumer | Form accepts input | Pass |
| 4 | Click Create Account | Account created, redirected to Home | Pass |
| 5 | Log out | Session cleared | Pass |
| 6 | Click Sign In, enter same credentials | Login succeeds | Pass |
| 7 | Close browser, reopen, log in again | Credentials persist in PostgreSQL | Pass |
| 8 | Register as Seller with market | Seller dashboard accessible | Pass |

---

## ST-02 Price Forecasting

**Objective:** Verify the XGBoost model returns price forecasts correctly.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Click Pricing in navigation | Pricing page loads | Pass |
| 2 | Select Maize, Kimironko, click Get Forecast | Predicted price returned in RWF | Pass |
| 3 | Select Rice, Nyabugogo | Different price returned | Pass |
| 4 | Select Beans (Dry), Kigali City | Price within reasonable range | Pass |
| 5 | Check confidence range | Lower bound less than predicted, upper greater | Pass |
| 6 | Check trend indicator | Shows Rising, Falling, or Stable | Pass |
| 7 | Select all 10 commodities one by one | All return positive RWF prices | Pass |
| 8 | Select all 5 markets | Prices differ across markets | Pass |

---

## ST-03 Market Comparison

**Objective:** Verify all 5 markets are ranked correctly by price.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Select a commodity and click Get Forecast | Market comparison table appears | Pass |
| 2 | Check table has 5 rows | One row per market | Pass |
| 3 | Check prices are sorted ascending | Cheapest market at top | Pass |
| 4 | Check saving column | Shows positive savings vs most expensive | Pass |
| 5 | Check best market card | Shows cheapest market name and price | Pass |
| 6 | Check bar chart | All 5 markets shown with correct heights | Pass |

---

## ST-04 Interactive Map

**Objective:** Verify Leaflet map loads and shows correct market locations.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Click Markets in navigation | Markets page loads | Pass |
| 2 | Allow location access | Blue user pin appears on map | Pass |
| 3 | Check market pins | 5 green pins visible on map | Pass |
| 4 | Check market cards | Distance shown in km from user | Pass |
| 5 | Click a market pin | Market listings load below map | Pass |
| 6 | Click Kimironko market card | Map highlights Kimironko | Pass |
| 7 | Seller listings table | Shows commodity, price, qty, seller | Pass |

---

## ST-05 Cost Estimator with Budget

**Objective:** Verify basket cost calculation and budget threshold work correctly.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Click Cost Estimator | Page loads with default basket | Pass |
| 2 | Default basket shows 4 items | Maize, Beans, Rice, Potatoes | Pass |
| 3 | Total is calculated correctly | Sum of unit price times quantity | Pass |
| 4 | Enter budget of 5000 RWF | Budget status card appears | Pass |
| 5 | Budget exceeded | Red card shows over budget amount | Pass |
| 6 | Enter budget of 100000 RWF | Green card shows within budget | Pass |
| 7 | Click Compare All Markets | Table shows all 5 markets with totals | Pass |
| 8 | Cheapest market highlighted | First row shows lowest total | Pass |
| 9 | Add a new item | Basket recalculates automatically | Pass |
| 10 | Delete an item | Total updates correctly | Pass |
| 11 | Map shows cheapest market in orange | Map highlights best option | Pass |

---

## ST-06 Price Alerts

**Objective:** Verify price alerts trigger correctly based on threshold.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Click Alerts in navigation | Alerts page loads | Pass |
| 2 | Select Maize, Kimironko, threshold 100 RWF | Alert fires, price above threshold | Pass |
| 3 | Change threshold to 100000 RWF | Alert clears, within budget | Pass |
| 4 | Live price watch table loads | Shows 5 commodities with status | Pass |
| 5 | Trend badge shows correctly | Rising, Falling, or Stable | Pass |
| 6 | Alert status badge shows | Red for alert, green for OK | Pass |

---

## ST-07 Seller Dashboard

**Objective:** Verify sellers can manage listings and compare with AI prices.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in as seller | Seller Dashboard accessible | Pass |
| 2 | Add Maize listing at 520 RWF | Listing saved to PostgreSQL | Pass |
| 3 | Close browser, reopen | Listing still visible | Pass |
| 4 | AI price shown next to seller price | XGBoost forecast displayed | Pass |
| 5 | Price status shows correctly | Above, At, or Below Market | Pass |
| 6 | Edit price to 300 RWF | Status changes to Below Market | Pass |
| 7 | Delete listing | Listing removed from database | Pass |
| 8 | Submit real price to model | Submission saved for admin review | Pass |
| 9 | AI insights chart loads | Bar chart shows all 5 markets | Pass |
| 10 | Listing appears in Markets page | Public listing visible to consumers | Pass |

---

## ST-08 Admin Dashboard

**Objective:** Verify admin can manage users, data, and monitor the platform.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Navigate to /#admin | Admin dashboard loads | Pass |
| 2 | Overview tab shows stats | Users, sellers, products, forecasts | Pass |
| 3 | Recent forecast requests table | Shows last 10 predictions | Pass |
| 4 | Top commodities pie chart | Shows most requested commodities | Pass |
| 5 | Users tab | Lists all registered users | Pass |
| 6 | Suspend a user | User status changes to Suspended | Pass |
| 7 | Reactivate user | Status returns to Active | Pass |
| 8 | Products tab | Shows all seller listings | Pass |
| 9 | Data Upload tab | CSV upload form visible | Pass |
| 10 | Upload sample_prices.csv | Records added successfully | Pass |
| 11 | Market Prices tab | Select market, see all 10 commodity prices | Pass |
| 12 | Admin not in navigation | Regular users cannot find admin | Pass |

---

## ST-09 Consumer to Seller Messaging

**Objective:** Verify consumers can contact sellers about listings.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Log in as consumer | Consumer dashboard accessible | Pass |
| 2 | Go to Markets, see seller listing | Chat button visible | Pass |
| 3 | Click Chat on a listing | Chat widget opens with seller name | Pass |
| 4 | Send a message | Message delivered to seller | Pass |
| 5 | Log out, log in as seller | Unread message count visible | Pass |
| 6 | Open conversation | Consumer message visible | Pass |
| 7 | Messages persist after restart | PostgreSQL stores messages permanently | Pass |

---

## ST-10 Mobile Responsiveness

**Objective:** Verify the app works correctly on mobile devices and screen sizes.

| Step | Action | Expected Result | Result |
|---|---|---|---|
| 1 | Open Firebase URL on Android Chrome | Home page loads correctly | Pass |
| 2 | Navigate to Pricing on mobile | Layout stacks vertically | Pass |
| 3 | Navigate to Markets on mobile | Map loads, market cards visible | Pass |
| 4 | Navigate to Cost Estimator on mobile | Basket form usable on small screen | Pass |
| 5 | Open Firebase URL on iOS Safari | App loads without errors | Pass |
| 6 | Test at 390x844 viewport (iPhone) | Content fits without horizontal scroll | Pass |
| 7 | Test at 412x915 viewport (Android) | All features accessible | Pass |

---

## ST-11 Different Data Values

**Objective:** Demonstrate functionality with varied inputs.

| Test | Commodity | Market | Quantity | Budget | Result |
|---|---|---|---|---|---|
| Low price item | Maize | Nyabugogo | 1 kg | 1000 RWF | Within budget |
| High price item | Rice | Kigali City | 2 kg | 5000 RWF | Over budget |
| Large basket | All 10 items | Kimironko | 1 kg each | 50000 RWF | Total calculated |
| Zero budget | Potatoes | Kimisagara | 1 kg | 1 RWF | Alert fires |
| Max forecast date | Maize | Kimironko | 1 kg | Any | 7 days ahead returns price |
| All markets same item | Beans (Dry) | All 5 | 1 kg | Any | 5 different prices returned |

---

## ST-12 Different Hardware and Software

**Objective:** Confirm the system works across different environments.

| Environment | Device | Browser | Result |
|---|---|---|---|
| Desktop | Windows 11 laptop | Chrome 126 | Pass |
| Desktop | Windows 11 laptop | Firefox 127 | Pass |
| Mobile | Android phone | Chrome Mobile | Pass |
| Mobile | iPhone | Safari | Pass |
| Emulated | Chrome DevTools 390x844 | Chrome | Pass |
| Emulated | Chrome DevTools 412x915 | Chrome | Pass |

---

## Overall Test Summary

| Category | Total Tests | Passed | Failed |
|---|---|---|---|
| User Registration and Login | 8 | 8 | 0 |
| Price Forecasting | 8 | 8 | 0 |
| Market Comparison | 6 | 6 | 0 |
| Interactive Map | 7 | 7 | 0 |
| Cost Estimator | 11 | 11 | 0 |
| Price Alerts | 6 | 6 | 0 |
| Seller Dashboard | 10 | 10 | 0 |
| Admin Dashboard | 12 | 12 | 0 |
| Messaging | 7 | 7 | 0 |
| Mobile Responsiveness | 7 | 7 | 0 |
| Different Data Values | 6 | 6 | 0 |
| Different Hardware | 6 | 6 | 0 |
| **Total** | **94** | **94** | **0** |

---

## How to Run Unit and Integration Tests

```bash
pip install pytest httpx
python -m pytest test_unit.py -v
python -m pytest test_integration.py -v
python -m pytest test_unit.py test_integration.py -v --tb=short
```