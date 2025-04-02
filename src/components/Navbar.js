import React, { useState, useEffect, useRef } from "react";
import { FaSignOutAlt, FaBars, FaChevronDown, FaBell } from "react-icons/fa";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NotificationDropdown from "./NotificationDropdown";
import { useToken } from "../context/TokenContext";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import "../assets/navbar.css";

const Navbar = ({ toggleSidebar }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState(null);
  const [profileImage, setProfileImage] = useState("https://i.ibb.co/gMVX9tq4/Screenshot-2025-04-03-000218.png");
  const [showTooltip, setShowTooltip] = useState(false);
  const location = useLocation();
  const { updateToken } = useToken();
  const navigate = useNavigate();
  const tooltipRef = useRef(null); 

  const pageTitleMap = {
    "/": "Dashboard Analytics",
    "/kyc-verification": "KYC Verification",
    "/profile": "Your Merchant Profile",
    "/create-registration-event": "Create Registration Event",
    "/view-registration": "View Registration",
    "/view-registration-reports": "View Registration Reports",
    "/create-voting-event": "Create Voting Event",
    "/view-voting-dashboard": "View Voting Dashboard",
    "/view-voting-report": "View Voting Report",
    "/create-ticket-event": "Create Ticket Event",
    "/view-ticket-dashboard": "View Ticket Dashboard",
    "/view-ticket-report": "View Ticket Report",
    "/event-description": "Voice of Nepal - Season 6",
  };
  const pageTitle = pageTitleMap[location.pathname] || "Dashboard";

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Fetch user data from auth endpoint
        const authResponse = await fetch("https://auth.zeenopay.com/users/me/", {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        });
        
        if (authResponse.ok) {
          const userData = await authResponse.json();
          setUsername(userData.username);
          setUserId(userData.id);
          sessionStorage.setItem("username", userData.username);
          
          // Now fetch KYC data
          const kycResponse = await fetch("https://auth.zeenopay.com/users/kyc/", {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem("token")}`,
            },
          });
          
          if (kycResponse.ok) {
            const kycData = await kycResponse.json();
            // Find the user with matching ID
            const userKyc = kycData.find(item => item.user === userData.id);
            if (userKyc && userKyc.registration_certificate_url) {
              setProfileImage(userKyc.registration_certificate_url);
            }
          }
        } else {
          setUsername("Guest");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setUsername("Guest");
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const navbar = document.querySelector('.navbar');
      if (window.scrollY > 50) { 
        navbar.classList.add('sticky');
      } else {
        navbar.classList.remove('sticky');
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle clicks outside the tooltip
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setShowTooltip(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    toggleSidebar();
  };

  const handleLogout = () => {
    updateToken(null);
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    toast.success("You have logged out successfully!", {
      position: "top-right",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
    });
    setTimeout(() => {
      navigate("/login");
    }, 2000);
  };

  const handleVerifiedClick = () => {
    setShowTooltip(!showTooltip); 
  };

  return (
    <nav className="navbar">
      {/* Image for Mobile View */}
      <div className="navbar-mobile-image">
        <span className="merchant-text">&nbsp; Merchant Dashboard</span>
      </div>
      {/* Left Section */}
      <div className="navbar-left">
        <div
          className={`page-title ${isDropdownOpen ? "open" : ""}`}
          onClick={toggleDropdown}
        >
          {location.pathname === "/view-registration" && events.length === 0
            ? "View Registration"
            : pageTitle}
          {location.pathname === "/view-voting-dashboard" && events.length > 0 && (
            <>
              <FaChevronDown />
              {isDropdownOpen && (
                <ul className="dropdown-menu">
                  {events.map((event, index) => (
                    <li key={index}>{event.title}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
      {/* Right Section (For Desktop and Mobile) */}
      <div className={`navbar-right ${isMobileMenuOpen ? "show" : ""}`}>
        <div className="user-info-container">
          <Link to="/profile">
            <img
              src={profileImage}
              alt="Profile"
              className="profile-image"
            />
          </Link>
         
          <Link to="/profile">
            <span className="user-greeting">
              Hello, <span className="user-name">{username}</span>
            </span>
          </Link>
          <div className="verified-tick" onClick={handleVerifiedClick} ref={tooltipRef}>
            <img
              src="https://i.ibb.co/JwfxtgPv/IMG-2703.png" 
              alt="Verified"
              className="verified-tick-image"
            />
            {showTooltip && (
              <div className="tooltip">
                <div className="tooltip-header">
                  <img
                    src="https://i.ibb.co/JwfxtgPv/IMG-2703.png" 
                    alt="Verified"
                    className="tooltip-icon"
                  />
                  <span className="tooltip-title">Verified</span>
                </div>
                <div className="tooltip-body">
                  You are verified as a GOLD member of zeenoPay Merchant Account. Our support team is available for you 24/7. :)
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="notification-container">
          <FaBell style={{ fontSize: "20px" }} className="notification-icon" />
        </div>
        <button className="logout-button" onClick={handleLogout}>
          <FaSignOutAlt className="logout-icon" />
          Logout
        </button>
        <button className="hamburger-menu" onClick={toggleMobileMenu}>
          <FaBars style={{ fontSize: "20px" }} />
        </button>
      </div>
      <ToastContainer position="top-right" autoClose={5000} />
      <style jsx>{`
        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 1000; /* Ensure navbar stays on top */
        }
        .navbar-left {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .page-title {
          position: relative;
          font-size: 18px;
          font-weight: 500;
          color: #000;
          flex: 1;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
        }
        .page-title:hover .dropdown-menu,
        .page-title.open .dropdown-menu,
        .dropdown-menu:hover {
          display: block;
        }
        .dropdown-menu {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background-color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          list-style: none;
          padding: 10px 0;
          min-width: 200px;
          z-index: 10;
        }
        .dropdown-menu li {
          padding: 10px 15px;
          font-size: 14px;
          color: #555;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .dropdown-menu li:hover {
          background-color: #f5f5f5;
          color: #000;
        }
        .navbar-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .user-info-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .user-greeting {
          font-size: 14px;
          color: #555;
          white-space: nowrap;
        }
        .user-name {
          font-weight: 600;
          color: #000;
        }
        .profile-image {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
        }
        .verified-tick {
          position: relative;
          cursor: pointer;
        }
        .verified-tick-image {
          width: 16px;
          height: 16px;
          margin-top: 7px;
        }
        .tooltip {
          position: absolute;
          top: 30px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #fff;
          color: #000;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          width: 220px;
          z-index: 1000;
          border: 1px solid #e0e0e0;
        }
        .tooltip-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .tooltip-icon {
          width: 16px;
          height: 16px;
        }
        .tooltip-title {
          font-weight: 600;
          font-size: 14px;
          color: #000;
        }
        .tooltip-body {
          font-size: 12px;
          color: #555;
          line-height: 1.4;
        }
        .hamburger-menu {
          display: none;
          color: #028248;
          background-color: #f0f0f0;
          padding-bottom: 2px;
          padding-top: 4px;
          padding-left: 10px;
          padding-right: 10px;
          border-radius: 50%;
        }
        .notification-container {
          color: #028248;
          background-color: #f0f0f0;
          padding-bottom: 6px;
          padding-top: 8px;
          padding-left: 10px;
          padding-right: 10px;
          border-radius: 50%;
        }
        .navbar-mobile-image {
          display: none;
        }
        .mobile-logo {
          width: 100px;
          margin: 0 auto;
          display: block;
        }
        .logout-button {
          display: flex;
          align-items: center;
          gap: 5px;
          background-color: #028248;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.3s ease;
        }
        .logout-button:hover {
          background-color: #026437;
        }
        .logout-icon {
          font-size: 16px;
        }
        /* Mobile-Responsive Navbar */
        @media (max-width: 768px) {
          .navbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            padding: 10px 15px;
            flex-direction: column; 
            align-items: stretch;
          }
          .navbar-mobile-image {
            display: flex;
            align-items: center;
            justify-content: center;
           
          }
          .merchant-text {
            font-size: 14px;
            font-weight: 600;
            color: #000;
          }
          .navbar-left {
            display: none; 
          }
          .navbar-right {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            gap: 10px;
          }
          .user-info-container {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .profile-image {
            width: 35px;
            height: 35px;
            border-radius: 50%;
          }
          .notification-container {
            margin-left: auto; 
          }
          .hamburger-menu {
            display: block; 
          }
          .logout-button {
            display: none; 
          }
       
          body {
            padding-top: 90px;
          }
        }
      `}</style>
    </nav>
  );
};

export default Navbar;