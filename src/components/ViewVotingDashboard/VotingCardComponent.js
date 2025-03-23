import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useToken } from "../../context/TokenContext";
import { calculateVotes } from '../AmountCalculator'; 

const VotingCardComponent = () => {
  const { token } = useToken();
  const { event_id } = useParams();
  const [totalVotes, setTotalVotes] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [topPerformer, setTopPerformer] = useState(null);

  // Card schema for displaying total votes and top performer
  const cardSchema = {
    totalVotes: {
      image: "https://i.ibb.co/SwHs5b7g/IMG-2417.png",
      title: "Total Votes",
      value: totalVotes !== null ? `${totalVotes}` : "Loading...",
      subtext: (
        <div className="live-container">
          <span className="live-dot"></span>
          <span className="live-text">Live</span>
        </div>
      ),
      subtextColor: totalVotes !== null && totalVotes > 0 ? "green" : "red",
    },
    topPerformer: {
      image: "https://i.ibb.co/by04tPM/IMG-2418.png",
      title: "Top Performer",
      value: topPerformer ? topPerformer.name : "Loading...",
      subtext: topPerformer?.votes !== undefined ? `${topPerformer.votes} Votes` : "Data will be available soon",
      subtextColor: "green",
    },
  };

  const cards = Object.values(cardSchema);

  // Fetch event data
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const response = await fetch(`https://auth.zeenopay.com/events/${event_id}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch event data");
        }

        const result = await response.json();
        setEventData(result);
      } catch (error) {
        console.error("Error fetching event data:", error);
      }
    };

    fetchEventData();
  }, [token, event_id]);

  // Fetch payment intents and calculate total votes and top performer
  const fetchVotes = async () => {
    if (!eventData) return;

    try {
      // Fetch regular payment intents
      const paymentsResponse = await fetch(
        `https://auth.zeenopay.com/payments/intents/?event_id=${event_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!paymentsResponse.ok) {
        throw new Error("Failed to fetch payment intents");
      }

      const paymentIntents = await paymentsResponse.json();

      // Fetch QR/NQR payment intents
      const qrPaymentsResponse = await fetch(
        `https://auth.zeenopay.com/payments/qr/intents?event_id=${event_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!qrPaymentsResponse.ok) {
        throw new Error("Failed to fetch QR/NQR payment intents");
      }

      const qrPaymentIntents = await qrPaymentsResponse.json();

      // Combine regular and QR/NQR payment intents
      const allPaymentIntents = [...paymentIntents, ...qrPaymentIntents];

      // Filter payment intents to include only successful transactions (status === 'S')
      const successfulPaymentIntents = allPaymentIntents.filter(
        (intent) => intent.status === 'S'
      );

      // Fetch contestants
      const contestantsResponse = await fetch(
        `https://auth.zeenopay.com/events/contestants/?event_id=${event_id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!contestantsResponse.ok) {
        throw new Error("Failed to fetch contestants");
      }

      const contestants = await contestantsResponse.json();

      // Calculate votes for each contestant
      const candidatesWithVotes = contestants.map((contestant) => {
        let totalVotes = 0;

        successfulPaymentIntents.forEach((intent) => {
          if (intent.intent_id.toString() === contestant.id.toString()) {
            let currency = 'USD';
            const processor = intent.processor?.toUpperCase();

            // Determine the currency based on the processor
            if (
              ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"].includes(
                processor
              )
            ) {
              currency = 'NPR';
            } else if (["PHONEPE", "PAYU"].includes(processor)) {
              currency = 'INR';
            } else if (processor === "STRIPE") {
              currency = intent.currency?.toUpperCase() || 'USD';
            }

            // Use the imported utility function to calculate votes
            const votes = calculateVotes(intent.amount, currency);
            totalVotes += votes;
          }
        });

        return {
          ...contestant,
          votes: totalVotes,
        };
      });

      // Calculate total votes
      const totalVotesCalculated = candidatesWithVotes.reduce(
        (sum, candidate) => sum + candidate.votes,
        0
      );

      // Sort candidates by votes and get the top performer
      const sortedCandidates = candidatesWithVotes.sort((a, b) => b.votes - a.votes);
      const topPerformer = sortedCandidates[0];

      // Update state
      setTotalVotes(totalVotesCalculated);
      setTopPerformer(topPerformer);
    } catch (error) {
      console.error("Error fetching data:", error);
      setTotalVotes("Error");
      setTopPerformer(null);
    }
  };

  // Fetch votes every 30 seconds
  useEffect(() => {
    fetchVotes(); 

    const interval = setInterval(() => {
      fetchVotes(); 
    }, 30000); 

    return () => clearInterval(interval); 
  }, [event_id, token, eventData]);

  return (
    <div className="cards-container">
      <link
        href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
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
          <p
            className={`card-subtext ${
              card.subtextColor === "green" ? "green" : "red"
            }`}
          >
            {card.subtext}
          </p>
        </div>
      ))}
      <hr className="horizontal-line" />

      <style>{`
        .cards-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: space-between;
          margin: 0px 0;
          animation: fadeIn 0.6s ease-in-out;
          font-family: 'Poppins', sans-serif;
        }

        .live-container {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background-color: red;
          border-radius: 50%;
          animation: blink 1s infinite;
        }

        .live-text {
          font-size: 12px;
          font-weight: bold;
          color: red;
        }

        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }

        .card-subtext {
          font-size: 12px;
          margin-top: 8px;
          font-weight: bold;
        }

        .card-subtext.green {
          color: #28a745;
        }

        .card-subtext.red {
          color: #dc3545;
        }

        .card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          width: 100%;
          max-width: 400px;
          padding: 15px;
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

        .horizontal-line {
          width: 100%;
          border: 0;
          border-top: 2px solid #f4f4f4;
          margin: 20px 0 25px;
        }

        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes cardAppear {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @media (max-width: 768px) {
          .cards-container {
            justify-content: space-between;
            margin-top: 70px;
          }
          .card {
            flex: 1 1 calc(40% - 10px);
            max-width: calc(40% - 10px);
            padding: 15px;
          }
          .card-title { font-size: 12px; }
          .card-value { font-size: 20px; }
        }

        @media (max-width: 480px) {
          .card {
            flex: 1 1 calc(40% - 10px);
            max-width: calc(40% - 10px);
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
      `}</style>
    </div>
  );
};

export default VotingCardComponent;