import React from 'react'
import "../assets/dashboardmain.css"


function OngoingCard() {
    const ongoingEvents = [
        { id: 1, title: "Event 1", date: "2023-10-15" },
        { id: 2, title: "Event 2", date: "2023-10-20" },
        { id: 3, title: "Event 3", date: "2023-10-25" },
      ];
    
      return (
        <div className="ongoing-cards">
          <h2>Ongoing Events</h2>
          {ongoingEvents.map((event) => (
            <div key={event.id} className="ongoing-card">
              <h3>{event.title}</h3>
              <p>Date: {event.date}</p>
            </div>
          ))}
        </div>
      );
}

export default OngoingCard