import React, { useState, useEffect } from 'react';
import { MdEdit, MdDelete, MdClose, MdCloudUpload } from 'react-icons/md';
import Modal from '../../components/modal';
import { useToken } from '../../context/TokenContext';
import useS3Upload from '../../hooks/useS3Upload';

const ContestantListModal = ({ eventId, onClose }) => {
  const [contestants, setContestants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [editingContestant, setEditingContestant] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    avatar: '',
    bio: '',
    misc_kv: '',
    shareable_link: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { token } = useToken();
  const { uploadFile } = useS3Upload();

  useEffect(() => {
    const fetchContestants = async () => {
      try {
        const response = await fetch('https://auth.zeenopay.com/events/contestants/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch contestants');
        }

        const data = await response.json();
        const filteredContestants = data.filter(contestant => contestant.event === eventId);
        setContestants(filteredContestants);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchContestants();
  }, [eventId, token]);

  const handleDeleteContestant = async (contestantId) => {
    try {
      const response = await fetch(`https://auth.zeenopay.com/events/contestants/${contestantId}/`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete contestant');
      }

      setContestants(contestants.filter(c => c.id !== contestantId));
      setDeleteConfirmation(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditClick = (contestant) => {
    setEditingContestant(contestant);
    setEditFormData({
      name: contestant.name,
      avatar: contestant.avatar,
      bio: contestant.bio,
      misc_kv: contestant.misc_kv,
      shareable_link: contestant.shareable_link
    });
    setSelectedImage(null);
    setUploadProgress(0);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      // Create a preview URL for the image
      const previewUrl = URL.createObjectURL(file);
      setEditFormData(prev => ({ ...prev, avatar: previewUrl }));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      let avatarUrl = editFormData.avatar;

      // Upload new image if selected
      if (selectedImage) {
        avatarUrl = await new Promise((resolve, reject) => {
          uploadFile(
            selectedImage,
            (progress) => setUploadProgress(progress),
            () => {
              const url = `https://${process.env.REACT_APP_AWS_S3_BUCKET}.s3.${process.env.REACT_APP_AWS_REGION}.amazonaws.com/${selectedImage.name}`;
              resolve(url);
            },
            (err) => reject(err)
          );
        });
      }

      const response = await fetch(`https://auth.zeenopay.com/events/contestants/${editingContestant.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editFormData,
          avatar: avatarUrl
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update contestant');
      }

      const updatedContestant = await response.json();
      setContestants(contestants.map(c => 
        c.id === editingContestant.id ? updatedContestant : c
      ));
      setEditingContestant(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <Modal onClose={onClose}>
        <div style={styles.modalContent}>
          <h2 style={styles.modalTitle}>Contestants</h2>
          <p>Loading contestants...</p>
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal onClose={onClose}>
        <div style={styles.modalContent}>
          <h2 style={styles.modalTitle}>Contestants</h2>
          <p style={styles.errorText}>Error: {error}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <div style={styles.modalContent}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Contestants</h2>
          <button onClick={onClose} style={styles.closeButton}>
            <MdClose size={20} />
          </button>
        </div>
        
        {contestants.length > 0 ? (
          <div style={styles.contestantsGrid}>
            {contestants.map((contestant) => (
              <div key={contestant.id} style={styles.contestantCard}>
                <div style={styles.contestantImageContainer}>
                  {contestant.avatar ? (
                    <img 
                      src={contestant.avatar} 
                      alt={contestant.name} 
                      style={styles.contestantImage}
                    />
                  ) : (
                    <div style={styles.noImage}>No Image</div>
                  )}
                </div>
                <div style={styles.contestantInfo}>
                  <h3 style={styles.contestantName}>{contestant.name}</h3>
                 
                </div>
                <div style={styles.contestantActions}>
                  <button 
                    onClick={() => handleEditClick(contestant)}
                    style={styles.editButton}
                  >
                    <MdEdit style={styles.buttonIcon} /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmation(contestant.id)}
                    style={styles.deleteButton}
                  >
                    <MdDelete style={styles.buttonIcon} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.noContestants}>No contestants found for this event.</p>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmation && (
          <div style={styles.confirmationOverlay}>
            <div style={styles.confirmationModal}>
              <h3 style={styles.confirmationTitle}>Confirm Delete</h3>
              <p style={styles.confirmationText}>Are you sure you want to delete this contestant?</p>
              <div style={styles.confirmationButtons}>
                <button
                  onClick={() => setDeleteConfirmation(null)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteContestant(deleteConfirmation)}
                  style={styles.confirmDeleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Contestant Modal */}
        {editingContestant && (
          <div style={styles.confirmationOverlay}>
            <div style={styles.editModal}>
              <div style={styles.modalHeader}>
                <h3 style={styles.confirmationTitle}>Edit Contestant</h3>
                <button 
                  onClick={() => setEditingContestant(null)}
                  style={styles.closeButton}
                >
                  <MdClose size={20} />
                </button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Name*</label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleInputChange}
                    style={styles.formInput}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Avatar</label>
                  <div style={styles.imageUploadContainer}>
                    {editFormData.avatar ? (
                      <img 
                        src={editFormData.avatar} 
                        alt="Preview" 
                        style={styles.imagePreview}
                      />
                    ) : (
                      <div style={styles.noImage}>No Image</div>
                    )}
                    <label style={styles.uploadButton}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        style={{ display: 'none' }}
                      />
                      <MdCloudUpload style={styles.uploadIcon} />
                      {selectedImage ? 'Change Image' : 'Upload Image'}
                    </label>
                    {uploadProgress > 0 && (
                      <div style={styles.progressBar}>
                        <div 
                          style={{
                            ...styles.progressFill,
                            width: `${uploadProgress}%`
                          }}
                        ></div>
                        <span style={styles.progressText}>{uploadProgress}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Bio</label>
                  <textarea
                    name="bio"
                    value={editFormData.bio}
                    onChange={handleInputChange}
                    style={{...styles.formInput, minHeight: '80px'}}
                    placeholder="Enter contestant bio"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Custom ID (misc_kv)</label>
                  <input
                    type="text"
                    name="misc_kv"
                    value={editFormData.misc_kv}
                    onChange={handleInputChange}
                    style={styles.formInput}
                    placeholder="Enter custom identifier"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Shareable Link</label>
                  <input
                    type="text"
                    name="shareable_link"
                    value={editFormData.shareable_link}
                    onChange={handleInputChange}
                    style={styles.formInput}
                    placeholder="Enter shareable link"
                  />
                </div>

                <div style={styles.formButtons}>
                  <button
                    type="button"
                    onClick={() => setEditingContestant(null)}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={styles.updateButton}
                    disabled={uploadProgress > 0 && uploadProgress < 100}
                  >
                    {uploadProgress > 0 && uploadProgress < 100 ? (
                      `Uploading... ${uploadProgress}%`
                    ) : (
                      'Update Contestant'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

const styles = {
  modalContent: {
    position: 'relative',
    maxHeight: '80vh',
    overflowY: 'auto',
    padding: '20px',
    width: '100%',
    maxWidth: '900px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '15px',
    borderBottom: '1px solid #eee',
  },
  modalTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#333',
    margin: '0',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '5px',
    borderRadius: '50%',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: '#f5f5f5',
      color: '#333',
    },
  },
  errorText: {
    color: '#e74c3c',
    margin: '10px 0',
  },
  contestantsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
    marginTop: '15px',
  },
  contestantCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    border: '1px solid #eee',
    ':hover': {
      transform: 'translateY(-5px)',
      boxShadow: '0 5px 15px rgba(0, 0, 0, 0.1)',
    },
  },
  contestantImageContainer: {
    width: '100%',
    height: '180px',
    overflow: 'hidden',
    backgroundColor: '#f7f7f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contestantImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  noImage: {
    color: '#999',
    fontSize: '14px',
  },
  contestantInfo: {
    padding: '15px',
  },
  contestantName: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 5px 0',
    color: '#333',
  },
  infoRow: {
    display: 'flex',
    margin: '3px 0',
    fontSize: '14px',
  },
  infoLabel: {
    fontWeight: '500',
    color: '#555',
    marginRight: '5px',
    minWidth: '70px',
  },
  infoValue: {
    color: '#333',
  },
  contestantActions: {
    display: 'flex',
    padding: '0 15px 15px 15px',
    gap: '10px',
  },
  editButton: {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    backgroundColor: '#f1c40f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#e2b607',
    },
  },
  deleteButton: {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#d62c1a',
    },
  },
  buttonIcon: {
    marginRight: '5px',
    fontSize: '16px',
  },
  noContestants: {
    textAlign: 'center',
    color: '#666',
    padding: '20px',
  },
  confirmationOverlay: {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1000',
  },
  confirmationModal: {
    backgroundColor: '#fff',
    padding: '25px',
    borderRadius: '8px',
    maxWidth: '400px',
    width: '100%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  editModal: {
    backgroundColor: '#fff',
    padding: '25px',
    borderRadius: '8px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
    maxHeight: '90vh',
    overflowY: 'auto',
  },
  confirmationTitle: {
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 15px 0',
    color: '#333',
  },
  confirmationText: {
    fontSize: '16px',
    color: '#555',
    margin: '0 0 25px 0',
  },
  confirmationButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  formGroup: {
    marginBottom: '15px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '5px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#555',
  },
  formInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    ':focus': {
      outline: 'none',
      borderColor: '#3498db',
    },
  },
  imageUploadContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  imagePreview: {
    width: '150px',
    height: '150px',
    objectFit: 'cover',
    borderRadius: '8px',
    border: '1px solid #eee',
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 16px',
    backgroundColor: '#3498db',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#2980b9',
    },
  },
  uploadIcon: {
    marginRight: '5px',
    fontSize: '18px',
  },
  progressBar: {
    width: '100%',
    height: '20px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2ecc71',
    transition: 'width 0.3s ease',
  },
  progressText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  formButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    color: '#333',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#e5e5e5',
    },
  },
  confirmDeleteButton: {
    padding: '8px 16px',
    backgroundColor: '#e74c3c',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#d62c1a',
    },
  },
  updateButton: {
    padding: '8px 16px',
    backgroundColor: '#028248',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#27ae60',
    },
    ':disabled': {
      backgroundColor: '#95a5a6',
      cursor: 'not-allowed',
    },
  },
};

export default ContestantListModal;