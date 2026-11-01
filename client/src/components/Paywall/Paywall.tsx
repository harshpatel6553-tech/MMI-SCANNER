import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDashboard } from '../../contexts/DashboardContext';
import { 
  ShieldCheck, 
  Zap, 
  Check, 
  Copy, 
  CheckCircle2, 
  Sparkles, 
  LogOut, 
  Mail, 
  QrCode,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
import './Paywall.css';

interface PlanTier {
  id: string;
  name: string;
  tagline: string;
  price: number;
  period: string;
  billedAs: string;
  savings?: string;
  popular?: boolean;
}

const TIERS: PlanTier[] = [
  {
    id: 'monthly',
    name: 'Starter Monthly',
    tagline: 'Agile trading flexibility',
    price: 499,
    period: '/mo',
    billedAs: 'Billed monthly at ₹499',
  },
  {
    id: 'yearly',
    name: 'Pro Trader Annual',
    tagline: 'Complete institutional suite',
    price: 4799,
    period: '/yr',
    billedAs: 'Effective ₹399/mo (Save 20%)',
    savings: 'Save 20%',
    popular: true,
  },
  {
    id: 'triennial',
    name: 'Institutional 3-Year',
    tagline: 'Maximum alpha & priority desk',
    price: 9999,
    period: '/3 yrs',
    billedAs: 'Effective ₹277/mo (Save 44%)',
    savings: 'Best Value',
  },
];

const FEATURES = [
  { title: 'Real-time F&O Command Center', desc: 'NSE Option Chain, Greeks, Max Pain & Range telemetry' },
  { title: 'Overlaid OI Profile Bars', desc: 'Direct on-chart horizontal open interest strike visualization' },
  { title: '5-Minute Smart Money Alerts', desc: 'Institutional delta spike detector for 50K+ contract moves' },
  { title: '500+ NSE Stock Screener', desc: 'Day High/Low breakouts, volume pressure & relative volume' },
  { title: 'Real-time News Alpha Wire', desc: 'Corporate filings, block deals & algorithmic sentiment scoring' },
  { title: 'Zero Broker Credentials Needed', desc: 'Direct exchange telemetry with 100% data privacy' },
];

export function Paywall() {
  const navigate = useNavigate();
  const { signOut, user, isTrialExpired, loading } = useAuth();
  const { setActiveTab } = useDashboard();

  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(TIERS[1]);
  const [copied, setCopied] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      setActiveTab('Overview');
      navigate('/');
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText('harshpatel6553-2@oksbi');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) return null;
  if (!isTrialExpired) return <Navigate to="/" replace />;

  const upiPayload = `upi://pay?pa=harshpatel6553-2@oksbi&pn=Market%20Minds%20Scanner&am=${selectedPlan.price}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiPayload)}`;

  const emailSubject = encodeURIComponent(`Subscription Activation: ${selectedPlan.name} (${user?.email || ''})`);
  const emailBody = encodeURIComponent(
    `Hello Market Minds Team,\n\nI have completed the payment of ₹${selectedPlan.price.toLocaleString('en-IN')} for the ${selectedPlan.name} plan.\n\nAccount Email: ${user?.email || ''}\nAttached: Payment Screenshot\n\nPlease activate my subscription.\n\nThank you!`
  );
  const mailtoLink = `mailto:marketmindsinvestment25@gmail.com?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="paywall-wrapper">
      {/* Precision Ambient Glow */}
      <div className="paywall-ambient-glow" />

      <div className="paywall-content-container">
        {/* Top Header */}
        <div className="paywall-hero-header">
          <div className="vanguard-eyebrow-badge">
            <Sparkles size={12} strokeWidth={1.5} className="text-cyan-400" />
            <span>SUBSCRIPTION PORTAL</span>
          </div>
          <h1 className="paywall-title">Unlock Institutional Market Telemetry</h1>
          <p className="paywall-subtitle">
            Your 14-day trial has concluded. Select a dedicated plan to restore real-time F&O signals, algorithmic breakouts, and big money alerts.
          </p>
        </div>

        {/* Pricing Tiers Grid with Double-Bezel Architecture */}
        <div className="paywall-tiers-grid">
          {TIERS.map((tier) => {
            const isSelected = selectedPlan.id === tier.id;
            return (
              <div
                key={tier.id}
                className={`paywall-tier-shell ${isSelected ? 'is-selected' : ''} ${tier.popular ? 'is-popular' : ''}`}
                onClick={() => setSelectedPlan(tier)}
              >
                <div className="paywall-tier-core">
                  {tier.savings && (
                    <div className="tier-ribbon">
                      <span>{tier.savings}</span>
                    </div>
                  )}

                  <div className="tier-header">
                    <div className="tier-name">{tier.name}</div>
                    <div className="tier-tagline">{tier.tagline}</div>
                  </div>

                  <div className="tier-price-wrap">
                    <span className="currency">₹</span>
                    <span className="amount">{tier.price.toLocaleString('en-IN')}</span>
                    <span className="period">{tier.period}</span>
                  </div>

                  <div className="tier-billed-note">{tier.billedAs}</div>

                  <button
                    type="button"
                    className={`tier-select-btn group ${isSelected ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPlan(tier);
                    }}
                  >
                    <span>{isSelected ? 'Active Plan' : 'Select Plan'}</span>
                    <div className="tier-btn-nest">
                      <Check size={13} strokeWidth={1.5} />
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Two-Column Activation & Features Layout */}
        <div className="paywall-details-split">
          {/* Left: What's Included */}
          <div className="paywall-features-card">
            <div className="section-label">
              <Layers size={15} className="text-cyan-400" />
              <span>Everything Included In Your Access</span>
            </div>

            <div className="features-list">
              {FEATURES.map((feat, idx) => (
                <div key={idx} className="feature-item">
                  <div className="feature-check">
                    <Check size={13} className="text-emerald-400" />
                  </div>
                  <div className="feature-text">
                    <div className="feature-title">{feat.title}</div>
                    <div className="feature-desc">{feat.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="security-guarantee-box">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
              <div>
                <b>100% Client Privacy Guarantee</b>
                <p>No broker API keys or account credentials required. We connect directly to official exchange market feeds.</p>
              </div>
            </div>
          </div>

          {/* Right: Instant UPI Checkout & Activation */}
          <div className="paywall-checkout-card">
            <div className="section-label">
              <QrCode size={15} className="text-cyan-400" />
              <span>Instant UPI Activation (₹{selectedPlan.price.toLocaleString('en-IN')})</span>
            </div>

            <div className="checkout-body">
              {/* High-Tech QR Box */}
              <div className="qr-terminal-box">
                <div className="qr-frame">
                  <span className="qr-corner tl" />
                  <span className="qr-corner tr" />
                  <span className="qr-corner bl" />
                  <span className="qr-corner br" />
                  <img src={qrUrl} alt="UPI QR Code" className="qr-image" />
                </div>
                <div className="qr-caption">
                  Scan with GPay, PhonePe, Paytm, or any UPI App
                </div>
              </div>

              {/* UPI ID Copy Field */}
              <div className="upi-copy-field" onClick={handleCopyUpi}>
                <div className="upi-id-left">
                  <span className="upi-tag">UPI ID</span>
                  <span className="upi-address">harshpatel6553-2@oksbi</span>
                </div>
                <button type="button" className={`upi-copy-btn ${copied ? 'copied' : ''}`} title="Copy UPI ID">
                  {copied ? (
                    <>
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* 2-Step Instant Activation Protocol */}
              <div className="activation-steps">
                <div className="act-step">
                  <div className="step-num">1</div>
                  <div className="step-body">
                    Complete payment of <b>₹{selectedPlan.price.toLocaleString('en-IN')}</b> using your preferred UPI app.
                  </div>
                </div>

                <div className="act-step">
                  <div className="step-num">2</div>
                  <div className="step-body">
                    Send screenshot along with registered email <b>({user?.email})</b> for instant verification.
                  </div>
                </div>
              </div>

              {/* One-Click Direct Verification Link with Button-in-Button Architecture */}
              <a href={mailtoLink} className="dispatch-proof-btn group">
                <span className="dispatch-btn-label">Email Payment Screenshot for Instant Activation</span>
                <div className="dispatch-btn-nest">
                  <Mail size={15} strokeWidth={1.5} />
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="paywall-bottom-bar">
          <button type="button" className="paywall-signout-btn" onClick={handleSignOut}>
            <LogOut size={14} />
            <span>Sign Out of Terminal</span>
          </button>
          <span className="footer-support-text">
            Need desk assistance? Contact: <b>marketmindsinvestment25@gmail.com</b>
          </span>
        </div>
      </div>
    </div>
  );
}
export default Paywall;
