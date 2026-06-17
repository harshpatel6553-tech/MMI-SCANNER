import { useAuth } from '../../context/AuthContext';
import './Paywall.css';

export function Paywall() {
  const { signOut, user } = useAuth();

  return (
    <div className="paywall-container">
      <div className="paywall-card glass-card">
        <div className="paywall-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="56" height="56" className="paywall-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h2>Your 14-Day Free Trial Has Expired</h2>
          <p>Unlock lifetime access to the Market Minds Scanner to continue getting real-time breakouts and volume spikes.</p>
        </div>

        <div className="payment-box">
          <div className="subscription-tiers">
            <div className="tier-card">
              <h3>Monthly</h3>
              <div className="price-tag">₹499<span>/mo</span></div>
            </div>
            <div className="tier-card recommended">
              <div className="recommended-badge">Most Popular</div>
              <h3>Yearly</h3>
              <div className="price-tag">₹2,999<span>/yr</span></div>
            </div>
            <div className="tier-card">
              <h3>Lifetime</h3>
              <div className="price-tag">₹5,999<span>/one-time</span></div>
            </div>
          </div>
          
          <div className="payment-instructions">
            <div className="step">
              <div className="step-number">1</div>
              <p>Scan the QR code below using Google Pay, PhonePe, or Paytm to pay for your chosen plan.</p>
            </div>
            
            <div className="qr-placeholder">
              {/* Replace this with an actual image of the UPI QR code */}
              <div className="qr-fake">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
                <span>UPI QR CODE HERE</span>
              </div>
              <div className="upi-id">UPI ID: your-upi-id@bank</div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <p>Send a screenshot of the successful payment via Email to: <strong>support@marketmindsscanner.com</strong></p>
            </div>
            
            <div className="step">
              <div className="step-number">3</div>
              <p>Include your account email (<strong>{user?.email}</strong>) and your chosen plan in the message. Your account will be activated manually upon verification.</p>
            </div>
          </div>
        </div>

        <div className="paywall-footer">
          <button className="signout-btn" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
