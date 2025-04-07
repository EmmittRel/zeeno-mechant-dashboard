import React, { useState, useEffect } from "react";
import { useToken } from "../../context/TokenContext";

const RegistrationCardComponent = () => {
  const [averageAge, setAverageAge] = useState(0);
  const [ageDistributionData, setAgeDistributionData] = useState([]);
  const [feesCollected, setFeesCollected] = useState(0);
  const [feesCollectedToday, setFeesCollectedToday] = useState(0);
  const [error, setError] = useState(null);
  const [eventId, setEventId] = useState(null);
  const { token } = useToken();

  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];

    if (id && !isNaN(id)) {
      setEventId(Number(id));
      setError(null);
    } else {
      setError("Invalid eventId in URL");
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!eventId) return;

      try {
        const response = await fetch(
          `https://auth.zeenopay.com/events/form/responses/${eventId}/`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          const filteredData = data.filter((item) => item.form === eventId);

          const ageCounts = {};
          let totalAge = 0;
          let totalParticipants = 0;

          filteredData.forEach((participant) => {
            const responseData = participant.response;
            const age = Math.floor(parseFloat(responseData.additionalProp6));

            if (!isNaN(age)) {
              ageCounts[age] = (ageCounts[age] || 0) + 1;
              totalAge += age;
              totalParticipants++;
            }
          });

          const ageArray = Object.keys(ageCounts).map((age) => ({
            age: parseInt(age),
            count: ageCounts[age],
          }));

          ageArray.sort((a, b) => a.age - b.age);
          setAgeDistributionData(ageArray);

          if (totalParticipants > 0) {
            const avgAge = Math.floor(totalAge / totalParticipants);
            setAverageAge(avgAge);
          }
        }
      } catch (error) {
        console.error("Error fetching participant data:", error);
        setError("Failed to fetch participant data");
      }
    };

    fetchData();
  }, [eventId, token]);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!eventId) return;

      try {
        const response = await fetch("https://auth.zeenopay.com/payments/intents/", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Error: ${response.statusText}`);
        }

        const data = await response.json();
        const today = new Date().toISOString().split("T")[0];

        // Filter payments by:
        // 1. event_id matches
        // 2. intent is "F" (payment)
        // 3. status is "S" (successful)
        // 4. processor is one of the specified ones
        const allSuccessfulPayments = data.filter(
          (item) => 
            item.event_id === eventId && 
            item.intent === "F" && 
            item.status === "S" &&
            ["ESEWA", "KHALTI", "PHONEPE", "FONEPAY", "QR"].includes(item.processor)
        );

        // Filter today's payments
        const todayPayments = allSuccessfulPayments.filter((item) => {
          const updatedDate = new Date(item.updated_at).toISOString().split("T")[0];
          return updatedDate === today;
        });

        // Calculate totals
        const totalFeesToday = todayPayments.reduce(
          (sum, item) => sum + parseFloat(item.amount), 0
        );
        const totalFees = allSuccessfulPayments.reduce(
          (sum, item) => sum + parseFloat(item.amount), 0
        );

        // Remove decimal places
        setFeesCollectedToday(Math.floor(totalFeesToday));
        setFeesCollected(Math.floor(totalFees));
      } catch (error) {
        console.error("Error fetching payment data:", error);
        setError("Failed to fetch payment data");
      }
    };

    fetchPayments();
  }, [eventId, token]);

  const cards = [
    {
      image: "https://i.ibb.co/1G76zF91/IMG-2042.png",
      title: "Fees Collected",
      value: `Rs. ${feesCollected}`,
      subtextColor: "green",
    },
    {
      image: "https://i.ibb.co/m5tv29nV/IMG-2043.png",
      title: "Today's Collection",
      value: `Rs. ${feesCollectedToday}`,
      subtextColor: "red",
    },
    {
      image: "https://i.ibb.co/j9zFzftJ/IMG-2044.png",
      title: "Average Age",
      value: averageAge.toString(),
      subtextColor: "green",
    },
  ];

  return (
    <div className="cards-container">
      {cards.map((card, index) => (
        <div key={index} className="card">
          <div className="card-row">
            <div className="card-icon">
              <img src={card.image} alt={card.title} className="icon-img" />
            </div>
            <div className="card-content">
              <h4 className="card-titlee">{card.title}</h4>
              <h2 className="card-value">{card.value}</h2>
            </div>
          </div>
        </div>
      ))}
      <hr className="horizontal-line" />

      <style>{`
        .cards-container {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          justify-content: flex-start;
          margin-bottom: 20px;
          animation: fadeIn 0.6s ease-in-out;
        }

        .horizontal-line {
          width: 100%;
          border: 0;
          border-top: 2px solid #f4f4f4;
          margin-top: 10px;
          margin-bottom: 20px;
        }

        .card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 100%;
          max-width: 310px;
          padding: 20px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          background-color: #ffffff;
          // box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
          transform: translateY(20px);
          opacity: 0;
          animation: cardAppear 0.6s ease-in-out forwards;
        }

        .card:hover {
          transform: translateY(-5px);
        }

        .card-row {
          display: flex;
          align-items: center;
        }

        .card-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #f0f4ff;
          margin-right: 15px;
        }

        .icon-img {
          width: 30px;
          height: 30px;
        }

        .card-content {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 5px;
        }

        .card-titlee {
          font-size: 16px;
          font-weight: 600;
          color: #4f4f4f;
          margin: 0;
        }

        .card-value {
          font-size: 30px;
          font-weight: 700;
          margin: 0;
        }

        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes cardAppear {
          0% { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .cards-container {
            justify-content: space-between;
          }
          .card {
            flex: 1 1 calc(50% - 10px);
            max-width: calc(50% - 10px);
            padding: 15px;
          }
          .card-titlee { font-size: 12px; }
          .card-value { font-size: 20px; }
        }

        @media (max-width: 480px) {
          .cards-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            padding: 0 10px; 
            margin-top: 100px;
          }
          .card {
            flex: 1 1 calc(50% - 5px);
            max-width: calc(50% - 5px);
            padding: 10px; 
            padding-right: 35px; 
            padding-left: 30px; 
          }
          .card-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .card-icon { 
            margin-bottom: 10px; 
            width: 40px; 
            height: 40px;
          }
          .icon-img {
            width: 20px; 
            height: 20px;
          }
          .card-content { align-items: flex-start; }
        }

        .card-value{
          font-size: 14px;
        }
         

        /* Styles for screens below 300px */
        @media (max-width: 300px) {
          .cards-container {
            gap: 5px; 
            padding: 0 5px; 
          }
          .card {
            flex: 1 1 calc(50% - 2.5px);
            max-width: calc(50% - 2.5px); 
            padding: 8px; 
          }
          .card-title {
            white-space: pre-line;
          }
        }
      `}</style>
    </div>
  );
};

export default RegistrationCardComponent;