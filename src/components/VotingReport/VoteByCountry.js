import React, { useState, useEffect } from "react";
import Chart from "react-apexcharts";
import { FaDownload } from "react-icons/fa";
import { useParams } from "react-router-dom";
import { useToken } from "../../context/TokenContext";
import { calculateVotes } from "../AmountCalculator";

const VoteByCountry = () => {
  const { event_id } = useParams();
  const { token } = useToken();
  const [nepalVotes, setNepalVotes] = useState([]);
  const [globalVotes, setGlobalVotes] = useState([]);
  const [totalVotesNepal, setTotalVotesNepal] = useState(0);
  const [totalVotesGlobal, setTotalVotesGlobal] = useState(0);
  const [paymentInfo, setPaymentInfo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const nepalProcessors = ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"];
  const indiaProcessors = ["PHONEPE"];
  const internationalProcessors = ["PAYU", "STRIPE"];

  useEffect(() => {
    const fetchEventsData = async () => {
      try {
        const response = await fetch(`https://auth.zeenopay.com/events/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch events data");
        }

        const data = await response.json();
        const event = data.find((event) => event.id === parseInt(event_id));

        if (event) {
          setPaymentInfo(event.payment_info);
        }
      } catch (error) {
        console.error("Error fetching events data:", error);
      }
    };

    const fetchPaymentIntentsData = async () => {
      try {
        // Fetch regular payment intents
        const response = await fetch(
          `https://auth.zeenopay.com/payments/intents/?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch payment intents data");
        }

        const data = await response.json();

        // Fetch QR/NQR payment intents
        const qrResponse = await fetch(
          `https://auth.zeenopay.com/payments/qr/intents?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!qrResponse.ok) {
          throw new Error("Failed to fetch QR/NQR payment intents data");
        }

        const qrData = await qrResponse.json();

        // Combine regular and QR/NQR payment intents
        const allPaymentIntents = [...data, ...qrData];

        // Filter payment intents to include only successful transactions (status === 'S')
        const successfulPaymentIntents = allPaymentIntents.filter(
          (item) => item.status === 'S'
        );

        // Process data for Nepal
        const nepalData = successfulPaymentIntents.filter((item) =>
          nepalProcessors.includes(item.processor)
        );

        // Calculate votes for each Nepal processor
        const nepalVotesData = nepalProcessors.map((processor) => {
          const processorData = nepalData.filter((item) => item.processor === processor);
          const totalVotes = processorData.reduce((sum, item) => {
            return sum + calculateVotes(item.amount, "NPR");
          }, 0);
          return totalVotes;
        });

        const totalNepalVotes = nepalVotesData.reduce((a, b) => a + b, 0);
        setNepalVotes(nepalVotesData);
        setTotalVotesNepal(totalNepalVotes);

        // Process data for Global
        const indiaData = successfulPaymentIntents.filter((item) =>
          indiaProcessors.includes(item.processor)
        );
        const internationalData = successfulPaymentIntents.filter((item) =>
          internationalProcessors.includes(item.processor)
        );

        // Calculate votes for India (INR currency)
        const indiaVotes = indiaData
          .map((item) => calculateVotes(item.amount, "INR"))
          .reduce((a, b) => a + b, 0);

        // Calculate votes for International (other currencies)
        const internationalVotes = internationalData
          .map((item) => {
            let currency = "USD";
            const processor = item.processor?.toUpperCase();

            // Determine the currency based on the processor
            if (processor === "STRIPE") {
              currency = item.currency?.toUpperCase() || "USD";
            } else if (processor === "PAYU") {
              currency = "INR"; // PAYU uses INR
            }

            return calculateVotes(item.amount, currency);
          })
          .reduce((a, b) => a + b, 0);

        setGlobalVotes([indiaVotes, internationalVotes]);
        setTotalVotesGlobal(indiaVotes + internationalVotes);
      } catch (error) {
        console.error("Error fetching payment intents data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchEventsData().then(() => fetchPaymentIntentsData());
    }
  }, [event_id, token, paymentInfo]);

  // Update labels for Nepal chart
  const nepalLabels = nepalProcessors.map((processor) => {
    if (processor === "NQR") return "NepalPayQR";
    if (processor === "QR") return "FonePayQR";
    if (processor === "FONEPAY") return "iMobile Banking";
    return processor;
  });

  const pieOptionsNepal = {
    chart: {
      type: "pie",
      height: 350,
    },
    labels: nepalLabels,
    colors: ["green", "#200a69", "red", "orange", "skyblue", "blue"],
    legend: { position: "bottom" },
  };

  const pieOptionsGlobal = {
    chart: {
      type: "pie",
      height: 350,
    },
    labels: ["Votes by Residents Within India", "International Votes"],
    colors: ["#5F259F", "#FF5722"],
    legend: { position: "bottom" },
  };

  // Check if there is no data
  const hasNoData = nepalVotes.length === 0 && globalVotes.length === 0;
  const hasNoNepalVotes = nepalVotes.length === 0 || nepalVotes.every((vote) => vote === 0);
  const hasNoGlobalVotes = globalVotes.length === 0 || globalVotes.every((vote) => vote === 0);

  return (
    <div className="chart-container">
      <div className="header">
        <h3>Vote Breakdown</h3>
        <button className="export-btn">
          <FaDownload className="export-icon" /> Export
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : hasNoData ? (
        <div className="no-data">No any vote data</div>
      ) : (
        <div className="charts">
          <div className="report">
            <div className="chart-header">
              <h3>Votes from Nepal</h3>
            </div>
            {hasNoNepalVotes ? (
              <div className="no-nepal-votes">No any Votes from Nepal</div>
            ) : (
              <>
                <Chart
                  options={pieOptionsNepal}
                  series={nepalVotes}
                  type="pie"
                  height={350}
                />
                <div className="total-votes">Total Votes: {totalVotesNepal.toLocaleString()}</div>
              </>
            )}
          </div>

          <div className="report">
            <div className="chart-header">
              <h3>Votes from Global</h3>
            </div>
            {hasNoGlobalVotes ? (
              <div className="no-global-votes">No any Global Votes</div>
            ) : (
              <>
                <Chart
                  options={pieOptionsGlobal}
                  series={globalVotes}
                  type="pie"
                  height={350}
                />
                <div className="total-votes">Total Votes: {totalVotesGlobal.toLocaleString()}</div>
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .chart-container {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          width: 100%;
          padding-bottom: 20px;
        }

        .header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          margin-top: 30px;
        }

        .header h2 {
          margin: 0;
          font-size: 24px;
        }

        .export-btn {
          background-color: #028248;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
        }

        .export-btn:hover {
          background-color: #028248;
        }

        .charts {
          display: flex;
          justify-content: space-between;
          width: 100%;
          gap: 20px;
        }

        .report {
          background-color: white;
          padding: 20px;
          border-radius: 8px;
          width: 48%;
          box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }

        .total-votes {
          text-align: center;
          font-size: 18px;
          margin-top: 20px;
          padding: 10px;
          width: 100%;
          box-sizing: border-box;
        }

        .loading,
        .no-data,
        .no-nepal-votes,
        .no-global-votes {
          text-align: center;
          font-size: 18px;
          margin-top: 20px;
          width: 100%;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }

          .header h2 {
            font-size: 20px;
          }

          .export-btn {
            display: none;
          }

          .charts {
            flex-direction: column;
            gap: 20px;
          }

          .report {
            width: 85%;
            margin-bottom: 20px;
          }

          .total-votes {
            font-size: 16px;
          }

          .report .apexcharts-canvas {
            height: 250px !important;
          }
        }

        @media (max-width: 480px) {
          .header h2 {
            font-size: 18px;
          }

          .total-votes {
            font-size: 14px;
          }

          .report .apexcharts-canvas {
            height: 200px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default VoteByCountry;