import React, { useState, useEffect } from "react";
import { calculateVotes } from '../AmountCalculator'; 

const Contestant = ({ event_id, token }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);

  // Helper function to extract intent_id from NQR transaction
  const getIntentIdFromNQR = (addenda1, addenda2) => {
    try {
      const combined = `${addenda1}-${addenda2}`;
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      return hexMatch?.[1] ? parseInt(hexMatch[1], 16) : null;
    } catch (error) {
      console.error('Error extracting intent_id from NQR:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch event data
        const eventResponse = await fetch(`https://auth.zeenopay.com/events/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!eventResponse.ok) {
          throw new Error("Failed to fetch event data");
        }

        const eventData = await eventResponse.json();
        const event = eventData.find((event) => event.id === parseInt(event_id));
        if (!event) {
          throw new Error("Event not found");
        }

        setPaymentInfo(event.payment_info);

        // Fetch contestants data
        const contestantsResponse = await fetch(
          `https://auth.zeenopay.com/events/contestants/?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!contestantsResponse.ok) {
          throw new Error("Failed to fetch contestants data");
        }

        const contestants = await contestantsResponse.json();

        // Fetch regular payment intents
        const paymentsResponse = await fetch(
          `https://auth.zeenopay.com/payments/intents/?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!paymentsResponse.ok) {
          throw new Error("Failed to fetch payment intents data");
        }

        const paymentIntents = await paymentsResponse.json();

        // Fetch QR payment intents (excluding NQR)
        const qrPaymentsResponse = await fetch(
          `https://auth.zeenopay.com/payments/qr/intents?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        if (!qrPaymentsResponse.ok) {
          throw new Error("Failed to fetch QR payment intents data");
        }

        const qrPaymentIntents = await qrPaymentsResponse.json();
        const filteredQrPaymentIntents = qrPaymentIntents.filter(
          (intent) => intent.processor?.toUpperCase() === "QR"
        );

        // Fetch NQR transactions
        const today = new Date().toISOString().split('T')[0];
        const nqrResponse = await fetch('https://auth.zeenopay.com/payments/qr/transactions/static', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            'start_date': "2025-03-21",
            'end_date': today
          })
        });

        if (!nqrResponse.ok) {
          throw new Error("Failed to fetch NQR transactions");
        }

        const nqrData = await nqrResponse.json();
        const successfulNqrTransactions = nqrData.transactions?.responseBody?.filter(
          txn => txn.debitStatus === '000'
        ) || [];

        // Combine all payment sources
        const allPaymentIntents = [
          ...paymentIntents,
          ...filteredQrPaymentIntents,
          ...successfulNqrTransactions.map(txn => ({
            intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
            amount: txn.amount,
            currency: 'NPR',
            processor: 'NQR',
            status: 'S'
          }))
        ];

        // Filter successful transactions
        const successfulPaymentIntents = allPaymentIntents.filter(
          (intent) => intent.status === 'S'
        );

        // Calculate votes for each contestant
        const candidatesWithVotes = contestants.map((contestant) => {
          let totalVotes = 0;

          successfulPaymentIntents.forEach((intent) => {
            if (intent.intent_id?.toString() === contestant.id.toString()) {
              let currency = 'USD';
              const processor = intent.processor?.toUpperCase();

              if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
                currency = 'NPR';
              } else if (["PHONEPE", "PAYU"].includes(processor)) {
                currency = 'INR';
              } else if (processor === "STRIPE") {
                currency = intent.currency?.toUpperCase() || 'USD';
              }

              totalVotes += calculateVotes(intent.amount, currency);
            }
          });

          return {
            ...contestant,
            votes: totalVotes,
          };
        });

        // Sort candidates by votes in descending order and take top 6
        const sortedCandidates = candidatesWithVotes
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 6); 

        setCandidates(sortedCandidates);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data.");
        setLoading(false);
      }
    };

    fetchData();
  }, [event_id, token]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="candidate-card">
      <h3 className="top-h3">Top - Performing Candidates</h3>
      <ul className="candidate-list">
        {candidates.map((candidate, index) => (
          <li key={index} className="candidate-item">
            <div style={{ display: "flex", alignItems: "center" }}>
              <img
                src={candidate.avatar}
                alt="candidate"
                className="candidate-image"
              />
              {candidate.name}
            </div>
            <span>{candidate.votes.toLocaleString()} Votes</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Contestant;