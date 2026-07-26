import { Shield } from 'lucide-react';

export default function EulaModal({
  accepted,
  setAccepted,
  onClose,
  onConfirm,
  loading,
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="eula-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          background: 'white',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e5e9ef',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: '#e8f5ec',
              color: '#087a3a',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Shield size={22} />
          </div>

          <div>
            <h2 id="eula-title" style={{ margin: 0, fontSize: 20 }}>
              SokoPrice End User License Agreement
            </h2>

            <small style={{ color: '#667085' }}>
              Effective July 26, 2026
            </small>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '20px 24px',
            color: '#344054',
            fontSize: 13.5,
            lineHeight: 1.65,
          }}
        >
          <p style={{ marginTop: 0 }}>
            This agreement governs your use of SokoPrice, an AI-powered
            grocery price forecasting and market recommendation platform
            for Kigali markets.
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            1. Permission to Use SokoPrice
          </h3>
          <p style={{ marginTop: 0 }}>
            You may use SokoPrice for lawful price forecasting, market
            comparison, basket-cost estimation, seller listings and
            communication between consumers and sellers.
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            2. Forecasts and Recommendations
          </h3>
          <p style={{ marginTop: 0 }}>
            SokoPrice uses machine learning, historical data and submitted
            market prices to generate estimates. Forecasts, savings and
            market recommendations are not guaranteed. Actual prices may
            change because of location, availability, supply, demand and
            seasonal conditions. Users remain responsible for confirming
            prices before making purchasing or selling decisions.
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            3. User Responsibilities
          </h3>
          <p style={{ marginTop: 0 }}>
            You must provide accurate account information, protect your
            password and use the platform responsibly. Sellers must make
            reasonable efforts to provide accurate product and price
            information. False information, impersonation, harassment,
            unlawful activity and attempts to disrupt the platform are
            prohibited.
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            4. Data and Location
          </h3>
          <p style={{ marginTop: 0 }}>
            SokoPrice may process account details, searches, seller
            listings, price submissions and messages to provide and improve
            its services. GPS location is accessed only when permission is
            granted through the user's device.
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            5. Ownership and Availability
          </h3>
          <p style={{ marginTop: 0 }}>
            The SokoPrice software, interface, forecasting model and
            original content remain protected project resources. The
            service may occasionally contain errors, experience
            interruptions or produce inaccurate results. Access may be
            restricted when the platform is misused.
          </p>

          <p style={{ marginBottom: 0 }}>
            By agreeing below, you confirm that you have read and accepted
            these conditions.
          </p>
        </div>

        <div
          style={{
            padding: '18px 24px 22px',
            borderTop: '1px solid #e5e9ef',
            background: '#fafcfa',
            flexShrink: 0,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 13.5,
              color: '#344054',
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={accepted}
              disabled={loading}
              onChange={(event) => setAccepted(event.target.checked)}
              style={{
                width: 17,
                height: 17,
                marginTop: 2,
                accentColor: '#087a3a',
              }}
            />

            <span>
              I have read and agree to the SokoPrice User Agreement.
            </span>
          </label>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 18,
            }}
          >
            <button
              type="button"
              className="ghost"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '11px 18px' }}
            >
              Decline
            </button>

            <button
              type="button"
              className="primary"
              onClick={onConfirm}
              disabled={!accepted || loading}
              style={{
                padding: '11px 18px',
                opacity: !accepted || loading ? 0.55 : 1,
                cursor:
                  !accepted || loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? 'Creating account...'
                : 'I Agree & Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}