import React, { useState, useEffect, useCallback } from 'react';
import { apiService, getIntentIdFromNQR, DEFAULT_AVATAR } from './apiService';
import { calculateVotes } from '../AmountCalculator';
import styles from '../../assets/Contestant.module.css';

const Contestant = ({ event_id, token }) => {
  const [state, setState] = useState({
    candidates: [],
    error: null
  });

  const fetchAllPayments = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    try {
      const [regularPayments, qrPayments, nqrData] = await Promise.all([
        apiService.getPaymentIntents(event_id, token),
        apiService.getQrIntents(event_id, token),
        apiService.getNqrTransactions(token, today)
      ]);

      return [
        ...regularPayments.filter(p => p.status === 'S'),
        ...qrPayments.filter(p => p.status === 'S' && p.processor?.toUpperCase() === "QR"),
        ...(nqrData.transactions?.responseBody?.filter(txn => txn.debitStatus === '000') || []).map(txn => ({
          intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
          amount: txn.amount,
          currency: 'NPR',
          processor: 'NQR',
          status: 'S'
        }))
      ];
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }, [event_id, token]);

  const processCandidates = useCallback((contestants, payments) => {
    return contestants.map(contestant => {
      const totalVotes = payments
        .filter(p => p.intent_id?.toString() === contestant.id.toString())
        .reduce((sum, payment) => {
          const processor = payment.processor?.toUpperCase();
          let currency = payment.currency?.toUpperCase() || 'USD';

          if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
            currency = 'NPR';
          } else if (["PHONEPE", "PAYU"].includes(processor)) {
            currency = 'INR';
          }

          return sum + calculateVotes(payment.amount, currency);
        }, 0);

      return { ...contestant, votes: totalVotes };
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [contestants, payments] = await Promise.all([
        apiService.getContestants(event_id, token),
        fetchAllPayments()
      ]);

      setState({
        candidates: processCandidates(contestants, payments)
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 5),
        error: null
      });
    } catch (error) {
      console.error('Error fetching contestant data:', error);
      setState({
        candidates: [],
        error: "Failed to fetch data. Please try again."
      });
    }
  }, [event_id, token, fetchAllPayments, processCandidates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (state.error) {
    return (
      <div className={styles.errorMessage}>
        {state.error}
        <button onClick={fetchData} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.candidateCard}>
      <h3 className={styles.topH3}>Top Performing Candidates</h3>
      <ul className={styles.candidateList}>
        {state.candidates.map((candidate, index) => (
          <li key={candidate.id} className={`${styles.candidateItem} ${styles[`rank${index + 1}`]}`}>
            <div className={styles.candidateInfo}>
              <div className={styles.rankBadge}>{index + 1}</div>
              <img
                src={candidate.avatar || DEFAULT_AVATAR}
                alt={candidate.name}
                className={styles.candidateImage}
                loading="lazy"
                width="40"
                height="40"
              />
              <div className={styles.nameContainer}>
                <span className={styles.candidateName}>{candidate.name}</span>
                <span className={styles.mobileVotes}>{candidate.votes.toLocaleString()} Votes</span>
              </div>
            </div>
            <span className={styles.desktopVotes}>{candidate.votes.toLocaleString()} Votes</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default React.memo(Contestant);