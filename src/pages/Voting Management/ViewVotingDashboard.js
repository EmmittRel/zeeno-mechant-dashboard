import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { useToken } from '../../context/TokenContext';
import Modal from '../../components/modal';
import { MdDelete, MdEdit, MdVisibility } from 'react-icons/md';
import AddCandidateModal from '../../components/ViewRegistration/AddCandidate';
import useS3Upload from '../../hooks/useS3Upload'; 

const ViewRegistration = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userEvents, setUserEvents] = useState([]); 
  const [userId, setUserId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [message, setMessage] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null); 
  const [uploadProgress, setUploadProgress] = useState(0);
  const { token } = useToken();

  // Call the hook at the top level
  const { uploadFile } = useS3Upload();

  useEffect(() => {
    const fetchUserAndEvents = async () => {
      try {
        // First, fetch the user data to get the user ID
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
        const eventsResponse = await fetch('https://auth.zeenopay.com/events/');
        if (!eventsResponse.ok) {
          throw new Error('Failed to fetch events');
        }
        
        const eventsData = await eventsResponse.json();
        setEvents(eventsData);
        
        // Filter events where owner matches user ID
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

  const deleteEvent = async () => {
    try {
      const response = await fetch(`https://auth.zeenopay.com/events/${eventToDelete}/`, {
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
      setShowEditModal(false);
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${err.message}` });
      setShowDeleteConfirmation(false);
    }
  };

  const handleEditClick = (event) => {
    setSelectedEvent(event);
    setShowEditModal(true);
    setSelectedFile(null);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedEvent(null);
    setSelectedFile(null); 
    setUploadProgress(0); 
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file); 
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
            (err) => reject(err) // Handle upload errors
          );
        });
      }

      // Update the event with the new image URL
      const response = await fetch(`https://auth.zeenopay.com/events/${updatedEvent.id}/`, {
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
      handleCloseEditModal();
    } catch (err) {
      setMessage({ type: 'error', text: `Error: ${err.message}` });
    }
  };

  const handleAddCandidateClick = () => {
    setShowEditModal(false); 
    setShowAddCandidateModal(true); 
  };

  const handleCloseAddCandidateModal = () => {
    setShowAddCandidateModal(false); 
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
          userEvents.map((event) => (
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
                  <h2 style={styles.cardTitle}>{`${event.title || 'No Title'}`}</h2>
                  <div style={styles.buttonContainer}>
                    <Link to={`/event/${event.id}`} style={styles.viewButton}>
                      <MdVisibility style={styles.icon} /> View Dashboard
                    </Link>
                    <button onClick={() => handleEditClick(event)} style={styles.editButton}>
                      <MdEdit style={styles.icon} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p>No events found. Create your first event!</p>
        )}
      </div>

      {/* Edit Event Modal */}
      {showEditModal && selectedEvent && (
        <Modal onClose={handleCloseEditModal}>
          <div style={styles.modalContent}>
            <h2>Edit Event</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateEvent(selectedEvent);
              }}
            >
              <div style={styles.formGroup}>
                <label>Title</label>
                <input
                  type="text"
                  value={selectedEvent.title}
                  onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label>Description</label>
                <textarea
                  value={selectedEvent.desc}
                  onChange={(e) => setSelectedEvent({ ...selectedEvent, desc: e.target.value })}
                  style={styles.textarea}
                />
              </div>
              <div style={styles.formGroup}>
                <label>Organiser</label>
                <input
                  type="text"
                  value={selectedEvent.org}
                  onChange={(e) => setSelectedEvent({ ...selectedEvent, org: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label>{selectedFile ? 'Updated Image' : 'Current Image'}</label>
                <div style={{ position: 'relative', width: '100%' }}>
                  {selectedEvent.img || selectedFile ? (
                    <img
                      src={selectedFile ? URL.createObjectURL(selectedFile) : selectedEvent.img}
                      alt="Event Image"
                      style={styles.currentImage}
                    />
                  ) : (
                    <p>No image available</p>
                  )}
                  {/* Edit Button on Image */}
                  <button
                    type="button"
                    onClick={() => document.getElementById('imageUpload').click()}
                    style={styles.editImageButton}
                  >
                    <MdEdit style={styles.editIcon} />
                  </button>
                  {/* Hidden File Input */}
                  <input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
                {uploadProgress > 0 && <p>Upload Progress: {uploadProgress}%</p>}
              </div>
              <div style={styles.formGroup}>
                <label>Final Date</label>
                <input
                  type="datetime-local"
                  value={selectedEvent.finaldate}
                  onChange={(e) => setSelectedEvent({ ...selectedEvent, finaldate: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.buttonGroup}>
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
                <button
                  type="button"
                  onClick={handleAddCandidateClick}
                  style={styles.addCandidateButton}
                >
                  Add Contestant
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Add Candidate Modal */}
      {showAddCandidateModal && (
        <AddCandidateModal
          events={userEvents} // Only pass user's events
          onClose={handleCloseAddCandidateModal}
          onSubmit={(candidate) => {
            // Handle the submission of the candidate
            handleCloseAddCandidateModal();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <Modal onClose={() => setShowDeleteConfirmation(false)}>
          <h4>Are you sure you want to delete this event?</h4>
          <div style={styles.confirmationButtons}>
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
    padding: '12px 20px',
    backgroundColor: '#028248',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    flex: 1,
    minWidth: '120px',
  },
  deleteButton: {
    padding: '12px 20px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    flex: 1,
    minWidth: '120px',
  },
  addCandidateButton: {
    padding: '12px 20px',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    flex: 1,
    minWidth: '120px',
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
  modalContent: {
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: '20px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  input: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '14px',
    minHeight: '100px',
  },
  currentImage: {
    width: '100%',
    height: 'auto',
    borderRadius: '8px',
    marginBottom: '10px',
  },
  editImageButton: {
    position: 'absolute',
    top: '-10px',
    right: '-10px',
    backgroundColor: '#fff',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '2px 2px 4px rgba(17, 185, 87, 0.2)',
  },
  editIcon: {
    fontSize: '20px',
    color: '#333',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    marginTop: '20px',
    flexWrap: 'wrap',
  },
  confirmationButtons: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'left',
    marginTop: '20px',
  },
};

export default ViewRegistration;