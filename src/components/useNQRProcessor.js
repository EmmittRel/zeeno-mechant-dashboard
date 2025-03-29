import { useState, useEffect } from 'react';
import { calculateVotes } from './AmountCalculator'; 

const useNQRProcessor = (token, event_id, contestants) => {
  const [nqrData, setNqrData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to extract intent_id from NQR transaction
  const getIntentIdFromNQR = (addenda1, addenda2) => {
    try {
      const combined = `${addenda1}-${addenda2}`;
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      if (hexMatch && hexMatch[1]) {
        return parseInt(hexMatch[1], 16);
      }
      return null;
    } catch (error) {
      console.error('Error extracting intent_id from NQR:', error);
      return null;
    }
  };

  // Format date function
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;

    const ordinalSuffix = (d) => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };

    return `${day}${ordinalSuffix(day)} ${month} ${year}, ${formattedHours}:${minutes} ${period}`;
  };

  // Fetch NQR transactions
  const fetchNQRTransactions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const response = await fetch('https://auth.zeenopay.com/payments/qr/transactions/static', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          'start_date': "2025-03-20",
          'end_date': today
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch NQR data');
      }

      const result = await response.json();
      return result.transactions?.responseBody || [];
    } catch (error) {
      console.error('Error fetching NQR transactions:', error);
      return [];
    }
  };

  // Process NQR data
  const processNQRData = async () => {
    if (!contestants.length) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const nqrTransactions = await fetchNQRTransactions();
      
      const processedData = nqrTransactions
        .filter(txn => txn.debitStatus === '000') 
        .map(txn => {
          const intentId = getIntentIdFromNQR(txn.addenda1, txn.addenda2);
          const contestant = contestants.find(c => c.id === intentId);
          const contestantName = contestant ? contestant.name : 'Unknown';
          
          return {
            name: txn.payerName,
            email: 'N/A',
            phone: txn.payerMobileNumber,
            createdAt: txn.localTransactionDateTime,
            formattedCreatedAt: formatDate(txn.localTransactionDateTime),
            amount: txn.amount,
            status: { label: 'Success', color: '#28A745' },
            paymentType: 'NepalPayQR',
            votes: calculateVotes(txn.amount, 'NPR'),
            currency: 'NPR',
            contestantName: contestantName,
          };
        });

      setNqrData(processedData);
    } catch (err) {
      setError(err.message || 'Failed to process NQR data');
      console.error('Error processing NQR data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    processNQRData();
  }, [token, event_id, contestants]);

  return { nqrData, loading, error, refresh: processNQRData };
};

export default useNQRProcessor;