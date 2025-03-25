import React, { useEffect, useState } from "react";
import axios from "axios";
import { useToken } from "../context/TokenContext";

const DashboardCard = () => {
  const [data, setData] = useState({
    totalEvents: 0,
    completedEvents: 0,
    ongoingEvents: 0,
    registrationEvents: 0,
    votingEvents: 0,
    ticketingEvents: 0,
  });
  const [userId, setUserId] = useState(null);
  const { token } = useToken();

  useEffect(() => {
    const fetchUserAndEvents = async () => {
      try {
        //fetch the current user's data
        const userResponse = await axios.get("https://auth.zeenopay.com/users/me/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        setUserId(userResponse.data.id);

        //fetch all events
        const [registrationRes, votingRes, ticketingRes] = await Promise.all([
          axios.get("https://auth.zeenopay.com/events/forms/", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          axios.get("https://auth.zeenopay.com/events", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          axios.get("https://auth.zeenopay.com/events/ticket-categories/", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        // Filter events by owner id
        const filterByOwner = (events) => events.filter(event => event.owner === userResponse.data.id);

        const registrationEvents = filterByOwner(registrationRes.data).length;
        const votingEvents = filterByOwner(votingRes.data).length;
        const ticketingEvents = filterByOwner(ticketingRes.data).length;
        const totalEvents = registrationEvents + votingEvents + ticketingEvents;

        const completedEvents = filterByOwner(votingRes.data).filter(
          (event) => event.status === "completed"
        ).length;

        const ongoingEvents = totalEvents - completedEvents;

        setData({
          totalEvents,
          completedEvents,
          ongoingEvents,
          registrationEvents,
          votingEvents,
          ticketingEvents,
        });
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchUserAndEvents();
  }, [token]);

  const cards = [
    { image: "https://i.ibb.co/gFcnBhR0/IMG-2035.png", title: "My Events", value: data.totalEvents },
    { image: "https://i.ibb.co/WNMZ72j7/IMG-2037.png", title: "Completed Events", value: data.completedEvents },
    { image: "https://i.ibb.co/bjhM75JQ/IMG-2038.png", title: "Ongoing Events", value: data.ongoingEvents },
    { image: "https://i.ibb.co/Zz89ZtHD/IMG-2044.png", title: "Registration Events", value: data.registrationEvents },
    { image: "https://i.ibb.co/NdrtMFcC/IMG-2034.png", title: "Voting Events", value: data.votingEvents },
    { image: "https://i.ibb.co/6JDmR2q4/IMG-2036.png", title: "Ticketing Events", value: data.ticketingEvents },
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
          max-width: 320px; 
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
          width: 40px;
          height: 40px;
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
          line-height: 1.4;
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
          }
          .card {
            flex: 1 1 calc(50% - 10px); 
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

export default DashboardCard;