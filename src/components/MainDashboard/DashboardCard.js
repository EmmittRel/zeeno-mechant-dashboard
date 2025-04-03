import React, { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import { useToken } from "../../context/TokenContext";
import styles from "../../assets/DashboardCard.module.css";

// API Configuration
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    USER: "/users/me/",
    REGISTRATION_EVENTS: "/events/forms/",
    VOTING_EVENTS: "/events",
    TICKETING_EVENTS: "/events/ticket-categories/"
  }
};

// Image Configuration
const IMAGE_CONFIG = {
  MY_EVENTS: "https://i.ibb.co/gFcnBhR0/IMG-2035.png",
  COMPLETED_EVENTS: "https://i.ibb.co/WNMZ72j7/IMG-2037.png",
  ONGOING_EVENTS: "https://i.ibb.co/bjhM75JQ/IMG-2038.png",
  REGISTRATION_EVENTS: "https://i.ibb.co/Zz89ZtHD/IMG-2044.png",
  VOTING_EVENTS: "https://i.ibb.co/NdrtMFcC/IMG-2034.png",
  TICKETING_EVENTS: "https://i.ibb.co/6JDmR2q4/IMG-2036.png"
};

// Reusable Axios Instance
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL
});

const DashboardCard = () => {
  const [data, setData] = useState({
    totalEvents: 0,
    completedEvents: 0,
    ongoingEvents: 0,
    registrationEvents: 0,
    votingEvents: 0,
    ticketingEvents: 0
  });
  
  const { token } = useToken();

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch all data in parallel
      const [userRes, regRes, voteRes, ticketRes] = await Promise.all([
        api.get(API_CONFIG.ENDPOINTS.USER, { headers }),
        api.get(API_CONFIG.ENDPOINTS.REGISTRATION_EVENTS, { headers }),
        api.get(API_CONFIG.ENDPOINTS.VOTING_EVENTS, { headers }),
        api.get(API_CONFIG.ENDPOINTS.TICKETING_EVENTS, { headers })
      ]);

      const userId = userRes.data.id;
      const filterByOwner = (events) => events.filter(event => event.owner === userId);

      // Process data efficiently
      const registrationEvents = filterByOwner(regRes.data).length;
      const votingEvents = filterByOwner(voteRes.data).length;
      const ticketingEvents = filterByOwner(ticketRes.data).length;
      const totalEvents = registrationEvents + votingEvents + ticketingEvents;

      const completedEvents = filterByOwner(voteRes.data).filter(event => event.status === "completed").length;
      const ongoingEvents = totalEvents - completedEvents;

      setData({ totalEvents, completedEvents, ongoingEvents, registrationEvents, votingEvents, ticketingEvents });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoized Card Data
  const cards = useMemo(() => [
    { image: IMAGE_CONFIG.MY_EVENTS, title: "My Events", value: data.totalEvents },
    { image: IMAGE_CONFIG.COMPLETED_EVENTS, title: "Completed Events", value: data.completedEvents },
    { image: IMAGE_CONFIG.ONGOING_EVENTS, title: "Ongoing Events", value: data.ongoingEvents },
    { image: IMAGE_CONFIG.REGISTRATION_EVENTS, title: "Registration Events", value: data.registrationEvents },
    { image: IMAGE_CONFIG.VOTING_EVENTS, title: "Voting Events", value: data.votingEvents },
    { image: IMAGE_CONFIG.TICKETING_EVENTS, title: "Ticketing Events", value: data.ticketingEvents }
  ], [data]);

  return (
    <div className={styles.cardsContainer}>
      {cards.map((card, index) => (
        <div 
          key={card.title} 
          className={styles.card}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <div className={styles.cardRow}>
            <div className={styles.cardIcon}>
              <img 
                src={card.image} 
                alt={card.title} 
                className={styles.iconImg} 
                loading="lazy"
              />
            </div>
            <div className={styles.cardContent}>
              <h4 className={styles.cardTitle}>{card.title}</h4>
              <h2 className={styles.cardValue}>{card.value}</h2>
            </div>
          </div>
        </div>
      ))}
      <hr className={styles.horizontalLine} />
    </div>
  );
};

export default DashboardCard;
