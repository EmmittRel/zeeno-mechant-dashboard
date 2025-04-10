import React, { useState, useEffect, useCallback } from 'react';
import { apiService, getIntentIdFromNQR, DEFAULT_AVATAR } from './apiService';
import { calculateVotes } from '../AmountCalculator';
import styles from '../../assets/Contestant.module.css';

// Ranking badge images
const RANKING_BADGES = {
  1: 'https://i.ibb.co/KckrTSDz/IMG-3894.png',
  2: 'https://i.ibb.co/8LNjCJMd/IMG-3895.png',
  3: 'https://i.ibb.co/0R0LqWzg/IMG-3896.png',
  4: 'https://i.ibb.co/6J0qH987/IMG-3897.png',
  5: 'https://i.ibb.co/fTCCwKg/IMG-3898.png'
};

const Contestant = ({ event_id, token }) => {
  const [state, setState] = useState({
    candidates: [],
    error: null,
    isLoading: true
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

      return { 
        ...contestant, 
        votes: totalVotes,
        formattedVotes: totalVotes.toLocaleString()
      };
    });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const [contestants, payments] = await Promise.all([
        apiService.getContestants(event_id, token),
        fetchAllPayments()
      ]);

      setState({
        candidates: processCandidates(contestants, payments)
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 5),
        error: null,
        isLoading: false
      });
    } catch (error) {
      console.error('Error fetching contestant data:', error);
      setState({
        candidates: [],
        error: "Failed to fetch data. Please try again.",
        isLoading: false
      });
    }
  }, [event_id, token, fetchAllPayments, processCandidates]);

  useEffect(() => {
    const abortController = new AbortController();
    
    fetchData();
    
    return () => {
      abortController.abort();
    };
  }, [fetchData]);

  if (state.isLoading) {
    return (
      <div className={styles.candidateCard}>
        <h3 className={styles.topH3}>Top Performing Candidates</h3>
        <ul className={styles.candidateList}>
          {[...Array(5)].map((_, index) => (
            <li key={index} className={styles.candidateItem}>
              <div className={styles.candidateInfo}>
                <div className={`${styles.rankBadge} ${styles.skeleton}`}></div>
                <div className={`${styles.candidateImage} ${styles.skeleton}`}></div>
                <div className={styles.nameContainer}>
                  <div className={`${styles.candidateName} ${styles.skeleton}`} style={{ width: `${Math.random() * 100 + 50}px` }}></div>
                  <div className={`${styles.mobileVotes} ${styles.skeleton}`} style={{ width: '60px' }}></div>
                </div>
              </div>
              <div className={`${styles.desktopVotes} ${styles.skeleton}`} style={{ width: '80px' }}></div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className={styles.errorMessage} role="alert">
        {state.error}
        <button 
          onClick={fetchData} 
          className={styles.retryButton}
          aria-label="Retry loading data"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.candidates.length === 0) {
    return (
      <div className={styles.candidateCard}>
        <h3 className={styles.topH3}>Top Performing Candidates</h3>
        <div className={styles.emptyState}>
          No candidates available at the moment.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.candidateCard}>
      <h3 className={styles.topH3}>Top Performing Candidates</h3>
      <ul className={styles.candidateList}>
        {state.candidates.map((candidate, index) => {
          const rank = index + 1;
          return (
            <li 
              key={candidate.id} 
              className={`${styles.candidateItem} ${styles[`rank${rank}`]}`}
              aria-label={`Rank ${rank}: ${candidate.name} with ${candidate.votes} votes`}
            >
              <div className={styles.candidateInfo}>
                <div className={styles.rankBadge} aria-hidden="true">
                  <img 
                    src={RANKING_BADGES[rank]} 
                    alt={`Rank ${rank}`} 
                    className={styles.rankImage}
                    width="24"
                    height="24"
                  />
                </div>
                <img
                  src={candidate.avatar || DEFAULT_AVATAR}
                  alt={`${candidate.name}'s profile`}
                  className={styles.candidateImage}
                  loading="lazy"
                  width="40"
                  height="40"
                  onError={(e) => {
                    e.target.src = DEFAULT_AVATAR;
                  }}
                />
                <div className={styles.nameContainer}>
                  <span className={styles.candidateName} title={candidate.name}>
                    {candidate.name}
                  </span>
                  <span className={styles.mobileVotes}>
                    {candidate.formattedVotes} Votes
                  </span>
                </div>
              </div>
              <span className={styles.desktopVotes}>
                {candidate.formattedVotes} Votes
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default React.memo(Contestant);