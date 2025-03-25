import React, { useEffect } from 'react';
import { useToken } from '../context/TokenContext';
import { calculateVotes } from './AmountCalculator';

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  const hours = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';

  const getOrdinal = (n) => {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${day}${getOrdinal(day)} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
};

const NQRPayments = ({ event_id, setNqrData }) => {
  const { token } = useToken();

  useEffect(() => {
    let intervalId;

    const fetchNQRData = async () => {
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
            'start_date': '2025-03-17',
            'end_date': today,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch NQR data');
        }

        const result = await response.json();
        let transactions = result.transactions.responseBody || [];

        transactions.sort((a, b) => new Date(a.localTransactionDateTime) - new Date(b.localTransactionDateTime));

        let lastTimestamp = 0;
        const filteredData = transactions.filter((txn) => {
          const txnTime = new Date(txn.localTransactionDateTime).getTime();
          if (txnTime - lastTimestamp >= 15 * 60 * 1000) {
            lastTimestamp = txnTime;
            return true;
          }
          return false;
        });

        const processedData = filteredData.map((txn) => {
          const intentIdHex = txn.addenda1.split('-')[2];
          const intentId = parseInt(intentIdHex, 16);
          const votes = calculateVotes(txn.amount, 'NPR');

          return {
            name: txn.payerName,
            email: 'N/A',
            phone: txn.payerMobileNumber,
            createdAt: txn.localTransactionDateTime,
            formattedCreatedAt: formatDate(txn.localTransactionDateTime),
            amount: txn.amount,
            status: { label: 'Success', color: '#28A745' },
            paymentType: 'NepalQRPay',
            votes: votes,
            currency: 'NPR',
            contestantName: 'Unknown',
            intent_id: intentId,
          };
        });

        setNqrData(processedData);
      } catch (error) {
        console.error('Error fetching NQR data:', error);
      }
    };

    fetchNQRData(); // Fetch data immediately on mount
    intervalId = setInterval(fetchNQRData, 15 * 60 * 1000); // Fetch data every 15 minutes

    return () => {
      clearInterval(intervalId); // Cleanup interval on unmount
    };
  }, [token, event_id, setNqrData]);

  return null;
};

export default NQRPayments;