import React, { useState, useEffect, useMemo, useCallback } from "react";
import Chart from "react-apexcharts";
import { useToken } from "../../context/TokenContext";
import { useParams } from "react-router-dom";
import { apiService, formatDisplayDate, getIntentIdFromNQR } from "./apiService";
import { calculateVotes } from '../AmountCalculator';
import LoadingSpinner from './LoadingSpinner';
import Contestant from './Contestant';
import styles from '../../assets/VotingData.module.css';

const VotingData = () => {
  const { token } = useToken();
  const { event_id } = useParams();
  const [state, setState] = useState({
    currentDate: "",
    isMobile: false,
    error: null,
    loading: true,
    series: [],
    categories: ["12:00 am", "6:00 am", "12:00 pm", "6:00 pm"]
  });

  const chartOptions = useMemo(() => ({
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    xaxis: {
      categories: state.categories,
      labels: {
        style: {
          colors: "#333333",
          fontWeight: "bold",
        },
      },
    },
    yaxis: {
      title: { text: "Votes" },
      labels: { style: { fontWeight: "bold" } },
    },
    stroke: { 
      curve: "smooth",
      width: 3
    },
    colors: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "vertical",
        gradientToColors: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
        stops: [0, 100],
      },
    },
    grid: { borderColor: "#ECEFF1" },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
      markers: {
        radius: 12
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5
      }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: function (value) {
          return value.toLocaleString() + " votes";
        }
      }
    }
  }), [state.categories]);

  const processPayments = useCallback((payments) => {
    return payments
      .map(payment => {
        const processor = payment.processor?.toUpperCase();
        let currency = payment.currency?.toUpperCase() || 'USD';
        
        if (["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "QR", "NQR"].includes(processor)) {
          currency = 'NPR';
        } else if (["PHONEPE", "PAYU"].includes(processor)) {
          currency = 'INR';
        }
        
        const votes = calculateVotes(payment.amount, currency);
        
        // Only include payments with 10+ votes
        if (votes >= 10) {
          return {
            ...payment,
            currency,
            votes,
            date: new Date(payment.updated_at || payment.localTransactionDateTime)
          };
        }
        return null;
      })
      .filter(Boolean); // Remove null entries (payments with <10 votes)
  }, []);

  const processVotingData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const today = new Date();
      const last5Days = Array.from({ length: 5 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      });

      const [nqrData, regularPayments, qrPayments] = await Promise.all([
        apiService.getNqrTransactions(token, today.toISOString().split('T')[0]),
        apiService.getPaymentIntents(event_id, token),
        apiService.getQrIntents(event_id, token)
      ]);

      const allPayments = [
        ...regularPayments,
        ...qrPayments.filter(intent => intent.processor?.toUpperCase() === "QR"),
        ...(nqrData.transactions?.responseBody?.map(txn => ({
          intent_id: getIntentIdFromNQR(txn.addenda1, txn.addenda2),
          amount: txn.amount,
          processor: 'NQR',
          status: 'S',
          currency: 'NPR',
          localTransactionDateTime: txn.localTransactionDateTime
        })) || []
  )];

      const successfulPayments = processPayments(allPayments.filter(p => p.status === 'S'));

      const dailyVotes = {};
      last5Days.forEach(date => (dailyVotes[date] = [0, 0, 0, 0]));

      successfulPayments.forEach(payment => {
        const dateKey = payment.date.toISOString().split("T")[0];
        const hours = payment.date.getHours();
        const timeSlot = Math.floor(hours / 6);
        
        if (dailyVotes[dateKey] && timeSlot >= 0 && timeSlot < 4) {
          dailyVotes[dateKey][timeSlot] += payment.votes;
        }
      });

      // Filter out dates that have no votes at all
      const seriesData = last5Days
        .filter(date => dailyVotes[date] && dailyVotes[date].some(votes => votes > 0))
        .map(date => ({
          name: formatDisplayDate(date),
          data: dailyVotes[date]
        }))
        .reverse();

      setState(prev => ({
        ...prev,
        series: seriesData,
        loading: false,
        currentDate: today.toLocaleDateString("en-US", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })
      }));
    } catch (err) {
      console.error("Error processing voting data:", err);
      setState(prev => ({
        ...prev,
        error: "Failed to process voting data.",
        loading: false
      }));
    }
  }, [event_id, token, processPayments]);

  useEffect(() => {
    const handleResize = () => {
      setState(prev => ({
        ...prev,
        isMobile: window.innerWidth <= 768
      }));
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    
    processVotingData();
    const interval = setInterval(processVotingData, 300000);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      clearInterval(interval);
    };
  }, [processVotingData]);

  const hasVotingData = useMemo(() => 
    state.series.some(s => s.data.some(vote => vote > 0)), 
    [state.series]
  );

  if (state.error) {
    return (
      <div className={styles.errorMessage}>
        {state.error}
        <button onClick={processVotingData} className={styles.retryButton}>
          Retry
        </button>
      </div>
    );
  }

  if (state.loading) {
    return <LoadingSpinner message="Loading voting data..." />;
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.chartCard}>
        <h3 className={styles.votingH3}>Voting Activity Comparison (Last 5 Days)</h3>
        <div className={styles.chartHeader}>
          <h3 className={styles.h3Real}>Daily Votes by Time Intervals</h3>
          <div className={styles.dateDisplay}>{state.currentDate}</div>
        </div>
        {hasVotingData ? (
          <Chart
            options={chartOptions}
            series={state.series}
            type="line"
            height={state.isMobile ? 240 : 300}
            className="chart"
          />
        ) : (
          <div className={styles.noDataMessage}>
            No qualifying voting data (10+ votes per transaction) available for the last 5 days.
          </div>
        )}
      </div>

      <Contestant event_id={event_id} token={token} />
    </div>
  );
};

export default React.memo(VotingData);