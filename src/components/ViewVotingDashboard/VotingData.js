import React, { useState, useEffect } from "react";
import Chart from "react-apexcharts";
import axios from "axios";
import { useToken } from "../../context/TokenContext";
import { useParams } from "react-router-dom";
import CandidateList from "./Contestant";
import { calculateVotes } from '../AmountCalculator'; 

const VotingData = () => {
  const { token } = useToken();
  const { event_id } = useParams();
  const [chartOptions, setChartOptions] = useState({
    chart: {
      type: "line",
      toolbar: { show: false },
      zoom: {
        enabled: false,
      },
      events: {
        mouseMove: (event, chartContext, config) => {
          // Removed event.preventDefault() as it's unnecessary and causes an error
        },
      },
    },
    xaxis: {
      categories: ["12:00 am", "6:00 am", "12:00 pm", "6:00 pm"],
      labels: {
        style: {
          colors: "#333333",
          fontWeight: "bold",
        },
      },
    },
    yaxis: {
      title: { text: "Votes" },
      labels: {
        style: {
          fontWeight: "bold",
        },
      },
    },
    stroke: {
      curve: "smooth",
    },
    colors: ["rgb(133, 219, 80)"],
    fill: {
      type: "gradient",
      gradient: {
        shade: "light",
        type: "vertical",
        gradientToColors: ["rgb(133, 219, 80)"],
        stops: [0, 100],
      },
    },
    grid: { borderColor: "#ECEFF1" },
  });

  const [series, setSeries] = useState([
    {
      name: "Votes",
      data: [0, 0, 0, 0],
    },
  ]);

  const [currentDate, setCurrentDate] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(0);
  const [error, setError] = useState(null);

  // Fetch event data to get payment_info
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const response = await axios.get(`https://auth.zeenopay.com/events/`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const event = response.data.find((event) => event.id === parseInt(event_id));
        if (event) {
          setPaymentInfo(event.payment_info);
        }
      } catch (err) {
        console.error("Error fetching event data:", err);
        setError("Failed to fetch event data.");
      }
    };

    fetchEventData();
  }, [event_id, token]);

  // Fetch payment intents and calculate votes
  useEffect(() => {
    const fetchPaymentIntents = async () => {
      try {
        // Fetch regular payment intents
        const response = await axios.get(
          `https://auth.zeenopay.com/payments/intents/?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        // Fetch QR/NQR payment intents
        const qrResponse = await axios.get(
          `https://auth.zeenopay.com/payments/qr/intents?event_id=${event_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          }
        );

        // Combine both responses
        const paymentIntents = [...response.data, ...qrResponse.data];

        // Filter payment intents to include only successful transactions (status === 'S')
        const successfulPaymentIntents = paymentIntents.filter(
          (intent) => intent.status === 'S'
        );

        const timeIntervals = ["12:00 am", "6:00 am", "12:00 pm", "6:00 pm"];
        const dailyVotes = {};

        successfulPaymentIntents.forEach((intent) => {
          let currency = "USD";
          const processor = intent.processor?.toUpperCase();

          // Determine the currency based on the processor
          if (
            ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"].includes(
              processor
            )
          ) {
            currency = "NPR";
          } else if (["PHONEPE", "PAYU"].includes(processor)) {
            currency = "INR";
          } else if (processor === "STRIPE") {
            currency = intent.currency?.toUpperCase() || "USD";
          }

          // Use the imported utility function to calculate votes
          const votes = calculateVotes(intent.amount, currency);

          const updatedAt = new Date(intent.updated_at);
          const dateKey = updatedAt.toISOString().split("T")[0];
          const hours = updatedAt.getHours();

          if (!dailyVotes[dateKey]) {
            dailyVotes[dateKey] = [0, 0, 0, 0];
          }

          if (hours >= 0 && hours < 6) {
            dailyVotes[dateKey][0] += votes;
          } else if (hours >= 6 && hours < 12) {
            dailyVotes[dateKey][1] += votes;
          } else if (hours >= 12 && hours < 18) {
            dailyVotes[dateKey][2] += votes;
          } else {
            dailyVotes[dateKey][3] += votes;
          }
        });

        // Sort dates in descending order
        const sortedDates = Object.keys(dailyVotes).sort((a, b) => new Date(b) - new Date(a));

        const seriesData = sortedDates.map((date) => ({
          name: date,
          data: dailyVotes[date],
        }));

        setSeries(seriesData);
      } catch (err) {
        console.error("Error fetching payment intents:", err);
        setError("Failed to fetch payment intents data.");
      }
    };

    if (paymentInfo > 0) {
      fetchPaymentIntents();
    }
  }, [event_id, token, paymentInfo]);

  // Set current date and handle mobile view
  useEffect(() => {
    const date = new Date();
    const options = { year: "numeric", month: "long", day: "numeric" };
    setCurrentDate(date.toLocaleDateString("en-US", options));

    const handleResize = () => {
      if (window.innerWidth <= 768) {
        setIsMobile(true);
      } else {
        setIsMobile(false);
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Check if there is any voting data available
  const hasVotingData = series.some((s) => s.data.some((vote) => vote > 0));

  if (error) return <p>{error}</p>;

  return (
    <div className="dashboard-container">
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');
          
          .dashboard-container {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 0 30px;
            gap: 30px;
            margin-bottom: 20px;
            font-family: 'Poppins', sans-serif;
            box-sizing: border-box;
          }
          .chart-card {
            background-color: #f7f9fc;
            border-radius: 10px;
            padding: 20px;
            flex: 2;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: 'Poppins', sans-serif;
          }
          .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            font-family: 'Poppins', sans-serif;
          }
          .total-votes {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 20px;
            color: #333333;
            font-family: 'Poppins', sans-serif;
          }
          .candidate-card {
            background-color: #f7f9fc;
            border-radius: 10px;
            padding: 30px;
            flex: 2;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: 'Poppins', sans-serif;
          }
          .candidate-list {
            list-style-type: none;
            padding: 0;
            margin: 0;
            font-family: 'Poppins', sans-serif;
          }
          .candidate-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: rgb(52, 107, 18);
            border: 1px solid #E0E0E0;
            color: #fff;
            font-weight: 600;
            border-radius: 8px;
            padding: 10px 15px;
            margin-bottom: 10px;
            font-family: 'Poppins', sans-serif;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .candidate-item:hover {
            transform: translateY(-3px);
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.1);
          }
          .candidate-image {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 10px;
            border: 2px solid #90CAF9;
          }
          .candidate-button {
            background-color: #1E88E5;
            color: #FFFFFF;
            padding: 10px 15px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 20px;
            font-weight: bold;
            font-family: 'Poppins', sans-serif;
          }
          .candidate-button:hover {
            background-color: #1565C0;
          }
          @media (max-width: 768px) {
            .dashboard-container {
              flex-direction: column;
              padding: 0 5px;
            }
            .chart-card,
            .candidate-card {
              width: 100%;
              padding: 10px;
              box-sizing: border-box;
            }
            .chart-card {
              padding-top: 10px;
              padding-bottom: 0;
            }
            .chart-header h1 {
              font-size: 18px;
            }
            .date-display {
              display: none;
            }
            .total-votes {
              font-size: 1.5rem;
            }
            .voting-h3 {
              display: none;
            }
            .top-h3 {
              font-size: 16px;
            }
              
            .chart {
              height: ${isMobile ? "250px" : "300px"};
            }
          }
        `}
      </style>
      <div className="chart-card">
        <h3 className="voting-h3">Voting Activity by Time Intervals</h3>
        <div className="chart-header">
          <h3>Today's Votes</h3>
          <div className="date-display">{currentDate}</div>
        </div>
        {hasVotingData ? (
          <Chart
            options={chartOptions}
            series={series}
            type="line"
            height={isMobile ? 240 : 300}
            className="chart"
          />
        ) : (
          <p>No Votes available for now.</p>
        )}
      </div>

      {/* Pass event_id and token as props to CandidateList */}
      <CandidateList event_id={event_id} token={token} />
    </div>
  );
};

export default VotingData;