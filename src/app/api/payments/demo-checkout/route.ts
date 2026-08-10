'use client'

import { NextRequest, NextResponse } from 'next/server'

/*
  Demo WiPay Checkout Page
  
  In production, users would be redirected to the real WiPay checkout at checkout.wipay.tt
  This simulates the WiPay payment flow for development and demo purposes.
*/

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orderId = url.searchParams.get('order_id') || ''
  const amount = url.searchParams.get('amount') || '0'
  const plan = url.searchParams.get('plan') || 'Professional'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WiPay Secure Checkout — AssetHub</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .checkout { max-width: 440px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a56db, #1e40af); padding: 24px; color: white; }
    .header h1 { font-size: 20px; font-weight: 700; }
    .header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }
    .content { padding: 24px; }
    .amount-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; border-bottom: 1px solid #e2e8f0; }
    .amount-label { font-size: 14px; color: #64748b; }
    .amount-value { font-size: 28px; font-weight: 800; color: #0f172a; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; font-size: 14px; color: #475569; }
    .info-label { color: #94a3b8; }
    .card-form { margin-top: 20px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 6px; }
    .field input { width: 100%; height: 44px; border: 1px solid #d1d5db; border-radius: 10px; padding: 0 14px; font-size: 15px; transition: border-color 0.2s; outline: none; }
    .field input:focus { border-color: #1a56db; box-shadow: 0 0 0 3px rgba(26,86,219,0.1); }
    .card-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .pay-btn { width: 100%; height: 52px; background: linear-gradient(135deg, #1a56db, #1e40af); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 20px; transition: all 0.3s; }
    .pay-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 25px rgba(26,86,219,0.3); }
    .pay-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
    .pay-btn .spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .secure { text-align: center; margin-top: 16px; font-size: 12px; color: #94a3b8; display: flex; align-items: center; justify-content: center; gap: 4px; }
    .secure svg { width: 14px; height: 14px; }
    .badge { display: inline-flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 20px; font-size: 11px; margin-top: 8px; }
    .success-screen { text-align: center; padding: 40px 24px; }
    .success-screen .check { width: 64px; height: 64px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .success-screen .check svg { width: 32px; height: 32px; color: #16a34a; }
    .success-screen h2 { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .success-screen p { font-size: 14px; color: #64748b; }
    .back-btn { display: inline-block; margin-top: 24px; padding: 12px 32px; background: #0f766e; color: white; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="checkout" id="checkout">
    <div class="header">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h1>WiPay Secure Checkout</h1>
          <p>Powered by WiPay — Caribbean Payment Gateway</p>
        </div>
        <div class="badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Secure
        </div>
      </div>
    </div>

    <div id="form-screen" class="content">
      <div class="amount-row">
        <span class="amount-label">Total Amount</span>
        <span class="amount-value">TTD $${parseFloat(amount).toLocaleString('en-TT', { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="info-row"><span class="info-label">Order ID</span><span>${orderId}</span></div>
      <div class="info-row"><span class="info-label">Plan</span><span>${plan}</span></div>
      <div class="info-row"><span class="info-label">Merchant</span><span>Zeitgeist Business Solution</span></div>

      <div class="card-form">
        <div class="field">
          <label>Card Number</label>
          <input type="text" id="card" placeholder="1234 5678 9012 3456" maxlength="19" value="4242 4242 4242 4242">
        </div>
        <div class="card-row">
          <div class="field">
            <label>Expiry Date</label>
            <input type="text" id="expiry" placeholder="MM/YY" maxlength="5" value="12/28">
          </div>
          <div class="field">
            <label>CVV</label>
            <input type="text" id="cvv" placeholder="123" maxlength="4" value="123">
          </div>
        </div>
        <div class="field">
          <label>Name on Card</label>
          <input type="text" id="name" placeholder="John Doe" value="Demo User">
        </div>
      </div>

      <button class="pay-btn" id="pay-btn" onclick="processPayment()">
        Pay TTD $${parseFloat(amount).toLocaleString('en-TT', { minimumFractionDigits: 2 })}
      </button>

      <div class="secure">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        Your payment is secured by WiPay SSL encryption
      </div>
    </div>

    <div id="success-screen" class="success-screen" style="display:none;">
      <div class="check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h2>Payment Successful!</h2>
      <p>Your AssetHub subscription is now active.</p>
      <p style="margin-top:8px;font-size:13px;color:#94a3b8;">Order: ${orderId}</p>
      <a href="/?payment_success=true" class="back-btn">Go to AssetHub</a>
    </div>
  </div>

  <script>
    async function processPayment() {
      const btn = document.getElementById('pay-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Processing...';

      // Simulate processing delay
      await new Promise(r => setTimeout(r, 2000));

      // Notify webhook
      try {
        await fetch('/api/payments/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: '${orderId}',
            status: 'success',
            transaction_id: 'WIPAY-' + Date.now(),
            fee: ${(parseFloat(amount) * 0.0275).toFixed(2)}
          })
        });
      } catch(e) {
        console.error('Webhook notification failed:', e);
      }

      document.getElementById('form-screen').style.display = 'none';
      document.getElementById('success-screen').style.display = 'block';
    }

    // Format card number
    document.getElementById('card')?.addEventListener('input', function(e) {
      let v = e.target.value.replace(/[^0-9]/g, '').substring(0, 16);
      e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
    });

    // Format expiry
    document.getElementById('expiry')?.addEventListener('input', function(e) {
      let v = e.target.value.replace(/[^0-9]/g, '').substring(0, 4);
      if (v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2);
      e.target.value = v;
    });
  </script>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}