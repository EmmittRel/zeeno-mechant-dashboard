import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useToken } from '../../context/TokenContext';
import Modal from '../../components/modal';
import { MdDelete, MdEdit, MdVisibility, MdClose } from 'react-icons/md';
import useS3Upload from '../../hooks/useS3Upload';

const ViewRegistrationReport = () => {
  const [events, setEvents] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userId, setUserId] = useState(null);
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

  const handleCloseDeleteModal = () => {
    setShowDeleteConfirmation(false);
    setEventToDelete(null);
  };

  const handleUpdateEvent = async (updatedEvent) => {
    try {
      let imgUrl = updatedEvent.img;

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
      
      setEvents(events.map((event) => (event.id === updatedEvent.id ? data : event)));
      setUserEvents(userEvents.map((event) => (event.id === updatedEvent.id ? data : event)));
      
      setMessage({ type: 'success', text: '🎉 Event updated successfully' });
      handleCloseModal();
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (showModal) handleCloseModal();
      if (showDeleteConfirmation) handleCloseDeleteModal();
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

  // Styles
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
      transition: 'transform 0.3s ease',
    },
    header: {
      marginLeft: '15px',
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#333',
    },
    card: {
      width: '320px',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
      backgroundColor: '#fff',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      cursor: 'pointer',
      padding: '20px',
      textAlign: 'center',
    },
    imageWrapper: {
      width: '100%',
      height: '180px',
      overflow: 'hidden',
      backgroundColor: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '8px',
      marginBottom: '16px',
    },
    image: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    },
    noImage: {
      color: '#999',
      fontSize: '14px',
      textAlign: 'center',
      fontStyle: 'italic',
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '12px',
      color: '#333',
    },
    buttonContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '10px',
      marginTop: '16px',
    },
    viewButton: {
      flex: 1,
      padding: '10px',
      backgroundColor: '#028248',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '500',
      transition: 'background-color 0.2s ease',
    },
    editButton: {
      flex: 1,
      padding: '10px',
      backgroundColor: '#f1c40f',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '500',
      transition: 'background-color 0.2s ease',
    },
    icon: {
      marginRight: '8px',
    },
    message: {
      padding: '12px 16px',
      margin: '0 16px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      textAlign: 'center',
    },
    imageUploadContainer: {
      position: 'relative',
      width: '100%',
      marginBottom: '16px',
    },
    editIcon: {
      position: 'absolute',
      top: '8px',
      right: '8px',
      cursor: 'pointer',
      backgroundColor: 'white',
      borderRadius: '50%',
      padding: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Modal styles
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
    },
    modalContent: {
      width: '100%',
      maxWidth: '420px',
      maxHeight: '90vh',
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    },
    modalScrollContent: {
      padding: '24px',
      overflowY: 'auto',
    },
    modalHeader: {
      fontSize: '1.25rem',
      fontWeight: '600',
      marginBottom: '20px',
      color: '#333',
      paddingRight: '32px',
    },
    modalFormGroup: {
      marginBottom: '20px',
    },
    modalLabel: {
      display: 'block',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: '500',
      color: '#555',
    },
    modalInput: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      fontSize: '14px',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s ease',
    },
    modalTextarea: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '8px',
      border: '1px solid #ddd',
      minHeight: '120px',
      resize: 'vertical',
      fontSize: '14px',
      boxSizing: 'border-box',
      transition: 'border-color 0.2s ease',
    },
    modalImageContainer: {
      position: 'relative',
      width: '100%',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px dashed #ddd',
      marginBottom: '12px',
    },
    modalImage: {
      width: '100%',
      height: 'auto',
      display: 'block',
    },
    modalFooter: {
      padding: '16px 24px',
      borderTop: '1px solid #eee',
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
    },
    modalButton: {
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      fontWeight: '500',
      cursor: 'pointer',
      fontSize: '14px',
      transition: 'all 0.2s ease',
    },
    modalPrimaryButton: {
      backgroundColor: '#028248',
      color: '#fff',
      '&:hover': {
        backgroundColor: '#026c3d',
      },
    },
    modalDangerButton: {
      backgroundColor: '#e74c3c',
      color: '#fff',
      '&:hover': {
        backgroundColor: '#c0392b',
      },
    },
    modalSecondaryButton: {
      backgroundColor: '#f0f0f0',
      color: '#333',
      '&:hover': {
        backgroundColor: '#e0e0e0',
      },
    },
    modalCloseButton: {
      position: 'absolute',
      top: '16px',
      right: '16px',
      background: 'transparent',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer',
      color: '#666',
      padding: '4px',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: 'rgba(0,0,0,0.05)',
      },
    },
    progressText: {
      fontSize: '14px',
      color: '#666',
      marginTop: '8px',
      textAlign: 'center',
    },
  };

  return (
    <DashboardLayout>
      <h3 style={styles.header}>My Voting Events</h3>
      {message && (
        <div style={{ 
          ...styles.message, 
          backgroundColor: message.type === 'success' ? '#e6f7ed' : '#ffebee',
          color: message.type === 'success' ? '#028248' : '#e74c3c'
        }}>
          {message.text}
        </div>
      )}
      <div style={styles.cardContainer}>
        {userEvents.length > 0 ? (
          userEvents.map((event) => {
            const parsedFields = typeof event.fields === 'string' ? JSON.parse(event.fields) : event.fields || {};
            return (
              <div
                key={event.id}
                style={styles.cardLink}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
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
          <p style={{ textAlign: 'center', width: '100%', color: '#666' }}>
            No events found. Create your first event!
          </p>
        )}
      </div>

      {/* Edit Event Modal */}
      {showModal && selectedEvent && (
        <Modal onClose={handleCloseModal}>
          <div style={styles.modalOverlay} onClick={handleOverlayClick}>
            <div style={styles.modalContent}>
              <button 
                onClick={handleCloseModal}
                style={styles.modalCloseButton}
                aria-label="Close modal"
              >
                <MdClose />
              </button>
              <div style={styles.modalScrollContent}>
                <h2 style={styles.modalHeader}>Edit Event</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleUpdateEvent(selectedEvent); }}>
                  <div style={styles.modalFormGroup}>
                    <label style={styles.modalLabel}>Title</label>
                    <input
                      type="text"
                      value={selectedEvent.title}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                      style={styles.modalInput}
                      required
                    />
                  </div>

                  <div style={styles.modalFormGroup}>
                    <label style={styles.modalLabel}>Description</label>
                    <textarea
                      value={selectedEvent.desc}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, desc: e.target.value })}
                      style={styles.modalTextarea}
                      required
                    />
                  </div>

                  <div style={styles.modalFormGroup}>
                    <label style={styles.modalLabel}>Event Image</label>
                    <div style={styles.modalImageContainer}>
                      {selectedEvent.img && (
                        <img src={selectedEvent.img} alt="Event" style={styles.modalImage} />
                      )}
                      <label htmlFor="file-upload" style={styles.editIcon}>
                        <MdEdit style={{ fontSize: '16px' }}/>
                      </label>
                      <input
                        id="file-upload"
                        type="file"
                        accept="image/*"
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
                    {uploadProgress > 0 && (
                      <div style={styles.progressText}>
                        Uploading: {uploadProgress}%
                      </div>
                    )}
                  </div>
                </form>
              </div>
              <div style={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => {
                    setEventToDelete(selectedEvent.id);
                    setShowDeleteConfirmation(true);
                  }}
                  style={{ ...styles.modalButton, ...styles.modalDangerButton }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateEvent(selectedEvent)}
                  style={{ ...styles.modalButton, ...styles.modalPrimaryButton }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <Modal onClose={handleCloseDeleteModal}>
          <div style={styles.modalOverlay} onClick={handleOverlayClick}>
            <div style={styles.modalContent}>
              <button 
                onClick={handleCloseDeleteModal}
                style={styles.modalCloseButton}
                aria-label="Close modal"
              >
                <MdClose />
              </button>
              <div style={styles.modalScrollContent}>
                <h2 style={styles.modalHeader}>Confirm Deletion</h2>
                <p style={{ marginBottom: '24px', color: '#666', lineHeight: '1.5' }}>
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
              </div>
              <div style={styles.modalFooter}>
                <button
                  onClick={handleCloseDeleteModal}
                  style={{ ...styles.modalButton, ...styles.modalSecondaryButton }}
                >
                  Cancel
                </button>
                <button
                  onClick={deleteEvent}
                  style={{ ...styles.modalButton, ...styles.modalDangerButton }}
                >
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

export default ViewRegistrationReport;