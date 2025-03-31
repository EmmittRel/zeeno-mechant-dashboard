import React, { useState, useEffect } from "react";
import { calculateVotes } from '../AmountCalculator';

// API configuration
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    CONTESTANTS: "/events/contestants/",
    PAYMENT_INTENTS: "/payments/intents/",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  DEFAULT_AVATAR: "https://via.placeholder.com/40",
  REFRESH_INTERVAL: 30000 
};

const Contestant = ({ event_id, token }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function for API calls
  const apiCall = async (endpoint, method = 'GET', body = null, signal) => {
    try {
      const url = `${API_CONFIG.BASE_URL}${endpoint}${method === 'GET' ? `?event_id=${event_id}` : ''}`;
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        signal
      };
      if (body) options.body = JSON.stringify(body);

      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      return await response.json();
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`Error fetching ${endpoint}:`, err);
      throw err;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const { signal } = controller;

    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [contestants, paymentIntents, qrPaymentIntents, nqrData] = await Promise.all([
          apiCall(API_CONFIG.ENDPOINTS.CONTESTANTS, 'GET', null, signal),
          apiCall(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, 'GET', null, signal),
          apiCall(API_CONFIG.ENDPOINTS.QR_INTENTS, 'GET', null, signal),
          apiCall(API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 'POST', { start_date: "2025-03-20", end_date: today }, signal)
        ]);

        if (!isMounted) return;

        // Process NQR transactions
        const extractIntentId = (addenda1, addenda2) => {
          const match = `${addenda1}-${addenda2}`.match(/vnpr-([a-f0-9]+)/i);
          return match?.[1] ? parseInt(match[1], 16) : null;
        };

        const successfulNqrTransactions = nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || [];

        // Combine all successful payments
        const successfulPayments = [
          ...paymentIntents.filter(intent => intent.status === 'S'),
          ...qrPaymentIntents.filter(intent => intent.status === 'S' && intent.processor?.toUpperCase() === "QR"),
          ...successfulNqrTransactions.map(txn => ({
            intent_id: extractIntentId(txn.addenda1, txn.addenda2),
            amount: txn.amount,
            currency: 'NPR',
            processor: 'NQR',
            status: 'S'
          }))
        ];

        // Calculate votes for each contestant
        const updatedCandidates = contestants.map(contestant => {
          const totalVotes = successfulPayments
            .filter(intent => intent.intent_id?.toString() === contestant.id.toString())
            .reduce((sum, intent) => {
              let currency = intent.currency?.toUpperCase() || 'USD';
              const processor = intent.processor?.toUpperCase();

              if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
                currency = 'NPR';
              } else if (["PHONEPE", "PAYU"].includes(processor)) {
                currency = 'INR';
              }

              return sum + calculateVotes(intent.amount, currency);
            }, 0);

          return { ...contestant, votes: totalVotes };
        });

        // Sort and take top 6
        setCandidates(updatedCandidates.sort((a, b) => b.votes - a.votes).slice(0, 6));
      } catch (err) {
        if (isMounted && err.name !== 'AbortError') {
          setError("Failed to fetch data. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, API_CONFIG.REFRESH_INTERVAL);

    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [event_id, token]);

  if (loading) return <div className="loading">Loading top candidates...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="candidate-card">
      <h3 className="top-h3">Top Performing Candidates</h3>
      <ul className="candidate-list">
        {candidates.map(candidate => (
          <li key={candidate.id} className="candidate-item">
            <div className="candidate-info" style={{ display: "flex", alignItems: "center" }}>
              <img
                src={candidate.avatar || API_CONFIG.DEFAULT_AVATAR}
                alt={candidate.name}
                className="candidate-image"
                loading="lazy"
                width="40"
                height="40"
              />
              <span className="candidate-name">{candidate.name}</span>
            </div>
            <span className="candidate-votes">{candidate.votes.toLocaleString()} Votes</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Contestant;
