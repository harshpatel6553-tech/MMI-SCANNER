import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import './Paywall.css';

export function Paywall() {
  const { signOut, user, isTrialExpired, loading } = useAuth();

  if (loading) return null;
  if (!isTrialExpired) return <Navigate to="/" replace />;

  return (
    <div className="paywall-container">
      <div className="paywall-card glass-card">
        <div className="paywall-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="56" height="56" className="paywall-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h2>Your 14-Day Free Trial Has Expired</h2>
          <p>Unlock premium access to the Market Minds Scanner to continue getting real-time breakouts and volume spikes.</p>
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
              <div className="price-tag">₹6,000<span>/yr</span></div>
            </div>
            <div className="tier-card">
              <h3>3 Years</h3>
              <div className="price-tag">₹15,000<span>/3 yrs</span></div>
            </div>
          </div>
          
          <div className="payment-instructions">
            <div className="step">
              <div className="step-number">1</div>
              <p>Scan the QR code below using Google Pay, PhonePe, or Paytm to pay for your chosen plan.</p>
            </div>
            
            <div className="high-tech-qr-container">
              <div className="qr-scanner-frame">
                <div className="qr-corner top-left"></div>
                <div className="qr-corner top-right"></div>
                <div className="qr-corner bottom-left"></div>
                <div className="qr-corner bottom-right"></div>
                <div className="scanner-laser"></div>
                
                {/* Dynamically generated crisp QR code for the UPI ID */}
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi%3A%2F%2Fpay%3Fpa%3Dharshpatel6553-2%40oksbi%26pn%3DMarket%2520Minds%2520Scanner%26cu%3DINR" 
                  alt="UPI QR Code" 
                  className="qr-code-img"
                />
              </div>
              <div className="upi-id-box" onClick={() => navigator.clipboard.writeText('harshpatel6553-2@oksbi')}>
                <span className="upi-label">UPI ID</span>
                <span className="upi-value">harshpatel6553-2@oksbi</span>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="copy-icon">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            </div>

            <div className="step">
              <div className="step-number">2</div>
              <p>Send a screenshot of the successful payment via Email to: <strong>marketmindsinvestment25@gmail.com</strong></p>
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
