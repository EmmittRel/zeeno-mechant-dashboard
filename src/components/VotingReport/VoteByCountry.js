import React, { useState, useEffect, useMemo, useCallback } from "react";
import Chart from "react-apexcharts";
import { FaDownload } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { useToken } from "../../context/TokenContext";
import { calculateVotes } from "../AmountCalculator";
import styles from "../../assets/VoteByCountry.module.css";

// Constants
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    EVENTS: "/events/",
    CONTESTANTS: "/events/contestants/",
    PAYMENT_INTENTS: "/payments/intents/",
    QR_INTENTS: "/payments/qr/intents",
    NQR_TRANSACTIONS: "/payments/qr/transactions/static"
  },
  DEFAULT_DATES: {
    START_DATE: "2025-03-20"
  }
};

const NEPAL_PROCESSORS = ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"];
const INDIA_PROCESSORS = ["PHONEPE"];
const INTERNATIONAL_PROCESSORS = ["PAYU", "STRIPE"];

// Memoized processor labels
const nepalLabels = NEPAL_PROCESSORS.map((processor) => {
  if (processor === "NQR") return "NepalPayQR";
  if (processor === "QR") return "FonePayQR";
  if (processor === "FONEPAY") return "iMobile Banking";
  return processor;
});

// API Service
const apiService = {
  get: async (endpoint, token, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_CONFIG.BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  },

  post: async (endpoint, token, data = {}) => {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    return response.json();
  }
};

const VoteByCountry = () => {
  const { event_id } = useParams();
  const { token } = useToken();
  const [nepalVotes, setNepalVotes] = useState([]);
  const [globalVotes, setGlobalVotes] = useState([]);
  const [totalVotesNepal, setTotalVotesNepal] = useState(0);
  const [totalVotesGlobal, setTotalVotesGlobal] = useState(0);
  const [paymentInfo, setPaymentInfo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const getIntentIdFromNQR = useCallback((addenda1, addenda2) => {
    try {
      const combined = `${addenda1 || ''}-${addenda2 || ''}`;
      const hexMatch = combined.match(/vnpr-([a-f0-9]+)/i);
      if (hexMatch?.[1]) {
        return parseInt(hexMatch[1], 16);
      }
      const altMatch = combined.match(/(\d+)/);
      if (altMatch?.[1]) {
        return parseInt(altMatch[1], 10);
      }
      return null;
    } catch (error) {
      console.error('Error extracting intent_id from NQR:', error);
      return null;
    }
  }, []);

  const processVotingData = useCallback((paymentIntents, contestantMap) => {
    // Filter successful transactions only
    const successfulPaymentIntents = paymentIntents.filter(
      (item) => item.status === 'S'
    );

    const nepalData = successfulPaymentIntents.filter((item) => {
      if (!NEPAL_PROCESSORS.includes(item.processor?.toUpperCase())) return false;
      
      const votes = calculateVotes(item.amount, item.currency);
      return votes >= 10; // Only include if 10+ votes
    });

    const nepalVotesData = NEPAL_PROCESSORS.map((processor) => {
      const processorData = nepalData.filter(
        (item) => item.processor?.toUpperCase() === processor
      );
      return processorData.reduce(
        (sum, item) => sum + calculateVotes(item.amount, item.currency), 
        0
      );
    });

    const indiaData = successfulPaymentIntents.filter((item) => {
      if (!INDIA_PROCESSORS.includes(item.processor?.toUpperCase())) return false;
      
      const votes = calculateVotes(item.amount, "INR");
      return votes >= 10; 
    });

    const internationalData = successfulPaymentIntents.filter((item) => {
      if (!INTERNATIONAL_PROCESSORS.includes(item.processor?.toUpperCase())) return false;
      
      const currency = item.currency || 'USD';
      const votes = calculateVotes(item.amount, currency);
      return votes >= 10; // Only include if 10+ votes
    });

    const indiaVotes = indiaData.reduce(
      (sum, item) => sum + calculateVotes(item.amount, "INR"), 
      0
    );

    const internationalVotes = internationalData.reduce(
      (sum, item) => {
        const currency = item.currency || 'USD';
        return sum + calculateVotes(item.amount, currency);
      }, 0
    );

    // Update state
    setNepalVotes(nepalVotesData);
    setTotalVotesNepal(nepalVotesData.reduce((a, b) => a + b, 0));
    setGlobalVotes([indiaVotes, internationalVotes]);
    setTotalVotesGlobal(indiaVotes + internationalVotes);
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        const [events, contestants, regularPayments, qrPayments] = await Promise.all([
          apiService.get(API_CONFIG.ENDPOINTS.EVENTS, token),
          apiService.get(API_CONFIG.ENDPOINTS.CONTESTANTS, token, { event_id }),
          apiService.get(API_CONFIG.ENDPOINTS.PAYMENT_INTENTS, token, { event_id }),
          apiService.get(API_CONFIG.ENDPOINTS.QR_INTENTS, token, { event_id })
        ]);

        const event = events.find(e => e.id === parseInt(event_id));
        if (event) setPaymentInfo(event.payment_info);

        const contestantMap = contestants.reduce((map, contestant) => {
          map[contestant.id] = contestant;
          return map;
        }, {});

        const filteredRegularPayments = regularPayments
          .filter(payment => payment.intent_id && contestantMap[payment.intent_id])
          .map(payment => ({
            ...payment,
            currency: payment.currency || 'USD'
          }));

        const filteredQRPayments = qrPayments
          .filter(payment => 
            payment.processor?.toUpperCase() === "QR" && 
            payment.intent_id && 
            contestantMap[payment.intent_id]
          )
          .map(payment => ({
            ...payment,
            currency: 'NPR'
          }));

        let nqrTransactions = [];
        try {
          const today = new Date().toISOString().split('T')[0];
          const nqrData = await apiService.post(
            API_CONFIG.ENDPOINTS.NQR_TRANSACTIONS, 
            token, 
            {
              'start_date': API_CONFIG.DEFAULT_DATES.START_DATE,
              'end_date': today
            }
          );

          nqrTransactions = (nqrData.transactions?.responseBody || [])
            .filter(txn => txn.debitStatus === '000')
            .map(txn => {
              const intent_id = getIntentIdFromNQR(txn.addenda1, txn.addenda2);
              return {
                ...txn,
                intent_id,
                contestant: intent_id ? contestantMap[intent_id] : null
              };
            })
            .filter(txn => txn.intent_id && txn.contestant)
            .map(txn => ({
              intent_id: txn.intent_id,
              amount: txn.amount,
              processor: 'NQR',
              status: 'S',
              currency: 'NPR'
            }));
        } catch (error) {
          console.error("Error fetching NQR transactions:", error);
        }

        const allPaymentIntents = [
          ...filteredRegularPayments,
          ...filteredQRPayments,
          ...nqrTransactions
        ];

        processVotingData(allPaymentIntents, contestantMap);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [event_id, token, getIntentIdFromNQR, processVotingData]);

  // Memoized chart options
  const pieOptionsNepal = useMemo(() => ({
    chart: {
      type: "pie",
      height: 350,
    },
    labels: nepalLabels,
    colors: ["green", "#200a69", "red", "orange", "skyblue", "blue"],
    legend: { position: "bottom" },
    tooltip: {
      y: {
        formatter: (value) => value.toLocaleString()
      }
    }
  }), []);

  const pieOptionsGlobal = useMemo(() => ({
    chart: {
      type: "pie",
      height: 350,
    },
    labels: ["Votes by Residents Within India", "International Votes"],
    colors: ["#5F259F", "#FF5722"],
    legend: { position: "bottom" },
    tooltip: {
      y: {
        formatter: (value) => value.toLocaleString()
      }
    }
  }), []);

  // Check if there is no data
  const hasNoData = totalVotesNepal === 0 && totalVotesGlobal === 0;
  const hasNoNepalVotes = totalVotesNepal === 0;
  const hasNoGlobalVotes = totalVotesGlobal === 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Vote Breakdown</h3>
        <button className={styles.exportBtn}>
          <FaDownload className={styles.exportIcon} /> Export
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading...</div>
      ) : hasNoData ? (
        <div className={styles.noData}>No qualifying vote data</div>
      ) : (
        <div className={styles.charts}>
          <div className={styles.report}>
            <div className={styles.chartHeader}>
              <h3>Votes from Nepal</h3>
            </div>
            {hasNoNepalVotes ? (
              <div className={styles.noNepalVotes}>No qualifying votes from Nepal</div>
            ) : (
              <>
                <Chart
                  options={pieOptionsNepal}
                  series={nepalVotes}
                  type="pie"
                  height={350}
                />
                <div className={styles.totalVotes}>Total Votes: {totalVotesNepal.toLocaleString()}</div>
              </>
            )}
          </div>

          <div className={styles.report}>
            <div className={styles.chartHeader}>
              <h3>Votes from Global</h3>
            </div>
            {hasNoGlobalVotes ? (
              <div className={styles.noGlobalVotes}>No qualifying global votes</div>
            ) : (
              <>
                <Chart
                  options={pieOptionsGlobal}
                  series={globalVotes}
                  type="pie"
                  height={350}
                />
                <div className={styles.totalVotes}>Total Votes: {totalVotesGlobal.toLocaleString()}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoteByCountry;