import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToken } from '../../context/TokenContext';
import { motion } from 'framer-motion';
import 'react-calendar/dist/Calendar.css';
import styles from '../../assets/DashboardCalender.module.css';

const Calendar = React.lazy(() => import('react-calendar'));

// API Configuration
const API_CONFIG = {
  BASE_URL: "https://auth.zeenopay.com",
  ENDPOINTS: {
    USER: "/users/me/",
    FORMS: "/events/forms/",
    EVENTS: "/events/",
    TICKETS: "/events/ticket-categories/"
  },
  DEFAULT_IMAGE: "https://via.placeholder.com/60"
};

function DashboardCalender() {
  const [date, setDate] = useState(new Date());
  const [ongoingEvents, setOngoingEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const eventsPerPage = 2;
  const navigate = useNavigate();
  const { token } = useToken();

  const handleDateChange = useCallback((newDate) => {
    setDate(newDate);
  }, []);

  const handleViewEvent = useCallback((event) => {
    if (event.category === 'Registration Event') {
      navigate(`/viewreport/${event.id}`);
    } else if (event.category === 'Voting Event') {
      navigate(`/eventreport/${event.id}`);
    }
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [userRes, formsRes, eventsRes, ticketsRes] = await Promise.all([
          fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.FORMS}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.EVENTS}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TICKETS}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        // Check for errors
        if (!userRes.ok) throw new Error('Failed to fetch user data');
        
        // Process responses
        const userData = await userRes.json();
        const forms = await formsRes.json();
        const events = await eventsRes.json();
        const tickets = await ticketsRes.json();

        // Format events data
        const formatEvent = (item, category) => ({
          id: item.id,
          title: item.title || item.name,
          category,
          img: item.img || API_CONFIG.DEFAULT_IMAGE,
          owner: item.owner
        });

        // Combine all events
        const allEvents = [
          ...forms.map(item => formatEvent(item, 'Registration Event')),
          ...events.map(item => formatEvent(item, 'Voting Event')),
          ...tickets.map(item => formatEvent(item, 'Ticket Event'))
        ];

        setOngoingEvents(allEvents);
        setUserEvents(allEvents.filter(event => event.owner === userData.id));
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
        console.error('Error:', err);
      }
    };

    fetchData();
  }, [token]);

  // Calculate pagination
  const totalPages = Math.ceil(userEvents.length / eventsPerPage);
  const currentEvents = userEvents.slice(
    currentPage * eventsPerPage,
    (currentPage + 1) * eventsPerPage
  );

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboardContainer}>
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <motion.div 
      className={styles.dashboardContainer}
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      transition={{ duration: 0.8 }}
    >
      {/* Calendar Section */}
      <motion.div 
        className={styles.calendarSection}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h4>Zeeno Calendar</h4>
        <div className={styles.calendarContainer}>
          {/* Lazy load the Calendar component */}
          <Suspense fallback={<div>Loading Calendar...</div>}>
            <Calendar onChange={handleDateChange} value={date} />
          </Suspense>
        </div>
      </motion.div>

      {/* Events Section */}
      <div className={styles.ongoingEventsSection}>
        <div className={styles.eventsHeader}>
          <h4>My Ongoing Events</h4>
          <div className={styles.paginationControls}>
            <button 
              disabled={currentPage === 0} 
              onClick={() => setCurrentPage(p => p - 1)}
            >
              &#8592;
            </button>
            <button 
              disabled={currentPage === totalPages - 1 || userEvents.length === 0} 
              onClick={() => setCurrentPage(p => p + 1)}
            >
              &#8594;
            </button>
          </div>
        </div>
        <motion.div 
          className={styles.ongoingCards}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          key={currentPage}
        >
          {userEvents.length > 0 ? (
            currentEvents.map((event, index) => (
              <motion.div 
                key={index} 
                className={styles.ongoingCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <img 
                  src={event.img} 
                  alt={event.title} 
                  className={styles.eventsImage} 
                  loading="lazy" 
                />
                <div className={styles.eventDetails}>
                  <h3>{event.title}</h3>
                  <p className={styles.category}>{event.category}</p>
                </div>
                <button 
                  className={styles.viewEventButton} 
                  onClick={() => handleViewEvent(event)}
                >
                  View Event <span className={styles.arrow}>→</span>
                </button>
              </motion.div>
            ))
          ) : (
            <p>No events found. Create your first event!</p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default DashboardCalender;
