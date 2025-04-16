import React, { useState, useEffect } from "react";
import { useToken } from '../../context/TokenContext';

const CardComponent = () => {
  const [data, setData] = useState([]);
  const [eventId, setFormId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useToken();

  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1]; 
    setFormId(id);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!eventId) {
          throw new Error("Form ID is required");
        }
  
        const response = await fetch(
          `https://auth.zeenopay.com/events/form/responses/${eventId}/`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );
  
        if (!response.ok) {
          throw new Error(`Network error: ${response.statusText}`);
        }
  
        const apiData = await response.json();
        console.log("apiData: ", apiData);
  
        // Convert eventId to a number for comparison
        const eventIdNumber = Number(eventId);
  
        // Filter data based on matching form ID
        const filteredData = apiData.filter(item => item.form === eventIdNumber);
  
        const transformedData = filteredData.map(item => ({
          ...item,
          createdAt: item.created_at,
          payment: item.payment,
        }));
  
        setData(transformedData);
        setError(null);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError(error.message);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
  
    fetchData();
  }, [eventId, token]);
  

  // Calculate metrics
  const totalRegistrations = data.length;
  const registrationsToday = data.filter(item => {
    const today = new Date().toISOString().split('T')[0];
    return item.createdAt.split('T')[0] === today;
  }).length;
  const pendingPayments = data.filter(item => item.payment === null).length;

  console.log("totalRegistrations:", totalRegistrations, "registrationsToday:", registrationsToday, "pendingPayments:", pendingPayments);

  const cards = [
    {
      image: "https://i.ibb.co/r2cKTTHW/IMG-2040.png",
      title: "Total Registrations",
      value: totalRegistrations,
      subtextColor: "green",
    },
    {
      image: "https://i.ibb.co/XxQCCJmn/IMG-2039.png",
      title: "Registrations Today",
      value: registrationsToday,
      subtextColor: "red",
    },
    {
      image: "https://i.ibb.co/qQ15RmJ/IMG-2041.png",
      title: "Pending Payments",
      value: pendingPayments,
      subtextColor: "red",
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
              <h4 className="card-title">{card.title}</h4>
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
          margin: 0px 0;
          animation: fadeIn 0.6s ease-in-out;
        }

        .horizontal-line {
          width: 100%;
          border: 0;
          border-top: 2px solid #f4f4f4;
          margin-top: 10px;
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
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
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

        .card-title {
          font-size: 16px;
          font-weight: 600;
          color: #4f4f4f;
          margin: 0;
        }

        .card-value {
          font-size: 36px;
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
            padding-top: 90px;
          }
          .card {
            flex: 1 1 calc(0% - 10px);
            max-width: calc(40% - 10px);
            padding: 15px;
          }
          .card-title { font-size: 12px; }
          .card-value { font-size: 20px; }
        }

         @media (max-width: 480px) {
          .cards-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            // gap: 10px;
            padding: 0 20px; 
            margin-top: 100px;
          }
          .card {
            flex: 1 1 calc(50% - 5px);
            max-width: calc(50% - 5px);
            padding: 10px; 
            padding-right: 40px; 
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

export default CardComponent;