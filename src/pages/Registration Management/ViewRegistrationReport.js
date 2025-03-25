import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useToken } from '../../context/TokenContext';
import Modal from '../../components/modal';
import { MdDelete, MdEdit, MdVisibility } from 'react-icons/md';
import useS3Upload from '../../hooks/useS3Upload';

const ViewRegistrationReport = () => {
  const [events, setEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]); // Filtered events for current user
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null); // To store current user's ID
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); 
  const [uploadProgress, setUploadProgress] = useState(0); 
  const { token } = useToken();

  const { uploadFile } = useS3Upload();

  useEffect(() => {
    const fetchUserAndEvents = async () => {
      try {
        // First fetch the current user's data
        const userResponse = await fetch('https://auth.zeenopay.com/users/me/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!userResponse.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        const userData = await userResponse.json();
        setUserId(userData.id);

        // Then fetch all events
        const eventsResponse = await fetch('https://auth.zeenopay.com/events/forms/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!eventsResponse.ok) {
          throw new Error('Failed to fetch events');
        }
        
        const eventsData = await eventsResponse.json();
        setEvents(eventsData);
        
        // Filter events where owner matches current user ID
        const filteredEvents = eventsData.filter(event => event.owner === userData.id);
        setUserEvents(filteredEvents);
        
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchUserAndEvents();
  }, [token]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  const deleteEvent = async () => {
    try {
      const response = await fetch(`https://auth.zeenopay.com/events/forms/${eventToDelete}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      // Update both events and userEvents state
      setEvents(events.filter((event) => event.id !== eventToDelete));
      setUserEvents(userEvents.filter((event) => event.id !== eventToDelete));
      
      setMessage({ type: 'success', text: 'Event deleted successfully' });
      setShowDeleteConfirmation(false);
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${err.message}` });
      setShowDeleteConfirmation(false);
    }
  };

  const handleEditClick = (event) => {
    setSelectedEvent(event);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedEvent(null);
    setSelectedFile(null); 
    setUploadProgress(0); 
  };

  const handleUpdateEvent = async (updatedEvent) => {
    try {
      let imgUrl = updatedEvent.img;

      // If a new file is selected, upload it to S3
      if (selectedFile) {
        imgUrl = await new Promise((resolve, reject) => {
          uploadFile(
            selectedFile,
            (progress) => setUploadProgress(progress),
            () => {
              const url = `https://${process.env.REACT_APP_AWS_S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${selectedFile.name}`;
              resolve(url);
            },
            (err) => reject(err)
          );
        });
      }

      // Update the event with the new image URL
      const response = await fetch(`https://auth.zeenopay.com/events/forms/${updatedEvent.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...updatedEvent, img: imgUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      const data = await response.json();
      
      // Update both events and userEvents state
      setEvents(events.map((event) => (event.id === updatedEvent.id ? data : event)));
      setUserEvents(userEvents.map((event) => (event.id === updatedEvent.id ? data : event)));
      
      setMessage({ type: 'success', text: '🎉 Event updated successfully' });
      handleCloseModal();
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <p>Loading...</p>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <p>Error: {error}</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h3 style={styles.header}>My Voting Events</h3>
      {message && (
        <div style={{ ...styles.message, backgroundColor: message.type === 'success' ? '#d4edda' : '#f44336' }}>
          {message.text}
        </div>
      )}
      <div style={styles.cardContainer}>
        {userEvents.length > 0 ? (
          userEvents.map((event) => {
            // Safely parse the `fields` property
            const parsedFields = typeof event.fields === 'string' ? JSON.parse(event.fields) : event.fields || {};
            return (
              <div
                key={event.id}
                style={styles.cardLink}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={styles.card}>
                  <div style={styles.imageWrapper}>
                    {event.img ? (
                      <img src={event.img} alt={event.title || 'Event Image'} style={styles.image} />
                    ) : (
                      <div style={styles.noImage}>No Image Available</div>
                    )}
                  </div>
                  <div style={styles.cardContent}>
                    <h2 style={styles.cardTitle}>{event.title}</h2>
                    <div style={styles.buttonContainer}>
                      <Link to={`/viewreport/${event.id}`} style={styles.viewButton}>
                        <MdVisibility style={styles.icon} /> View Report
                      </Link>
                      <button onClick={() => handleEditClick(event)} style={styles.editButton}>
                        <MdEdit style={styles.icon} /> Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p>No events found. Create your first event!</p>
        )}
      </div>

      {showModal && selectedEvent && (
        <Modal onClose={handleCloseModal}>
          <h2>Edit Event</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdateEvent(selectedEvent);
            }}
          >
            <div>
              <label>Title</label>
              <input
                type="text"
                value={selectedEvent.title}
                onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
              />
            </div>
            <div>
              <label>Description</label>
              <textarea
                value={selectedEvent.desc}
                onChange={(e) => setSelectedEvent({ ...selectedEvent, desc: e.target.value })}
              />
            </div>
            <div>
              <label>Current Image</label>
              <div style={styles.imageUploadContainer}>
                <img src={selectedEvent.img} alt="Current" style={{ width: '100%', height: '100%', borderRadius: '1%' }} />
                <label htmlFor="file-upload" style={styles.editIcon}>
                  <MdEdit style={{ fontSize: '16px' }}/>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      setSelectedFile(file); 
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setSelectedEvent({ ...selectedEvent, img: reader.result }); 
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>
              {uploadProgress > 0 && <p>Upload Progress: {uploadProgress}%</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button type="submit" style={styles.updateButton}>
                Update Event
              </button>
              <button
                type="button"
                onClick={() => {
                  setEventToDelete(selectedEvent.id);
                  setShowDeleteConfirmation(true);
                }}
                style={styles.deleteButton}
              >
                Delete Event
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDeleteConfirmation && (
        <Modal onClose={() => setShowDeleteConfirmation(false)}>
          <h2>Are you sure you want to delete this event?</h2>
          <div>
            <button onClick={deleteEvent} style={styles.confirmDeleteButton}>
              Yes, Delete
            </button>
            <button onClick={() => setShowDeleteConfirmation(false)} style={styles.cancelDeleteButton}>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

const styles = {
  cardContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    justifyContent: 'center',
    margin: '20px 0',
  },
  cardLink: {
    textDecoration: 'none',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  },
  header: {
    marginLeft: '15px',
  },
  card: {
    width: '320px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#fff',
    position: 'relative',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    cursor: 'pointer',
    padding: '20px',
    textAlign: 'center',
    opacity: 0,
    animation: 'fadeIn 1s forwards',
  },
  imageWrapper: {
    width: '100%',
    height: '200px',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  image: {
    width: '100%',
    height: 'auto',
    objectFit: 'cover',
  },
  noImage: {
    color: '#7a7a7a',
    fontSize: '14px',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#333',
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px',
  },
  viewButton: {
    padding: '10px 20px',
    backgroundColor: '#028248',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    transition: 'background-color 0.3s ease',
    fontWeight: '600',
  },
  editButton: {
    padding: '10px 50px',
    backgroundColor: '#f1c40f',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'background-color 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    fontWeight: '600',
  },
  icon: {
    marginRight: '10px',
  },
  updateButton: {
    padding: '12px 30px',
    backgroundColor: '#028248',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  deleteButton: {
    padding: '12px 30px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  confirmDeleteButton: {
    padding: '12px 30px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  cancelDeleteButton: {
    padding: '12px 30px',
    backgroundColor: '#7f8c8d',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  message: {
    padding: '15px',
    margin: '15px 0',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
  },
  imageUploadContainer: {
    position: 'relative',
    display: 'inline-block',
  },
  editIcon: {
    position: 'absolute',
    top: '-10px',
    right: '-10px',
    cursor: 'pointer',
    backgroundColor: 'white',
    borderRadius: '50%',
    padding: '15px',
    boxShadow: '0 0 5px rgba(0,0,0,0.5)',
    fontSize: "10px"
  },
};

export default ViewRegistrationReport;