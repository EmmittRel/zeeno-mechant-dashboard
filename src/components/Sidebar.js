import React, { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaChartBar,
  FaRegClipboard,
  FaRegFileAlt,
  FaCogs,
  FaVoteYea,
  FaCalendarPlus,
  FaSignOutAlt, 
} from "react-icons/fa";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useToken } from "../context/TokenContext"; 
import "../assets/sidebar.css";

const Sidebar = ({ collapsed, toggleCollapse, open, toggleSidebar }) => {
  const location = useLocation();
  const sidebarRef = useRef(null);
  const { updateToken } = useToken();
  const navigate = useNavigate(); 

  const menuItems = [
    { title: "Dashboard", icon: <FaChartBar />, section: "Home", path: "/" },
    {
      title: "Create Event",
      icon: <FaCalendarPlus />,
      section: "Registration Management",
      path: "/create-registration-event",
    },
    {
      title: "View Registration",
      icon: <FaRegClipboard />,
      section: "Registration Management",
      path: "/view-registration",
    },
    {
      title: "View Reports",
      icon: <FaRegFileAlt />,
      section: "Registration Management",
      path: "/view-registration-reports",
    },
    {
      title: "Create Voting Event",
      icon: <FaVoteYea />,
      section: "Voting Management",
      path: "/create-voting-event",
    },
    {
      title: "View Dashboard",
      icon: <FaCogs />,
      section: "Voting Management",
      path: "/view-voting-dashboard",
    },
    {
      title: "View Voting Reports",
      icon: <FaRegFileAlt />,
      section: "Voting Management",
      path: "/view-voting-report",
    },
    {
      title: "Customize Website",
      icon: <FaRegFileAlt />,
      section: "CMS",
      path: "/customize-website",
    },
  ];

  // Handle logout
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

  // Handle click outside the sidebar to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        if (open) {
          toggleSidebar();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, toggleSidebar]);

  return (
    <div
      ref={sidebarRef}
      className={`sidebar ${collapsed ? "collapsed" : ""} ${open ? "open" : ""}`}
    >
      <div className="sidebar-header">
        {/* Hide logo-container on mobile devices */}
        <div className="logo-container mobile-hide">
          {collapsed ? (
            <>
              <img
                src="https://i.ibb.co/KxWNMdg/IMG-0654.png"
                alt="ZeenoPay"
                className="sidebar-logo"
              />
            </>
          ) : (
            <>
              <img
                src="https://i.ibb.co/HdffZky/zeenopay-logo-removebg-preview.png"
                alt="ZeenoPay"
                className="sidebar-logo"
              />
              <span className="merchant-name">| &nbsp; Merchant</span>
            </>
          )}
        </div>
        <button className="collapse-button" onClick={toggleCollapse}>
          {collapsed ? "→" : "←"}
        </button>
      </div>
      <div className="menu">
        {menuItems.map((item, index) => (
          <div key={index}>
            {index === 0 || menuItems[index - 1].section !== item.section ? (
              <h4 className={`menu-section ${collapsed ? "hidden" : ""}`}>
                {item.section}
              </h4>
            ) : null}
            <Link to={item.path}>
              <button
                className={`menu-item ${
                  location.pathname === item.path ? "active" : ""
                }`}
              >
                <span className="menu-icon">{item.icon}</span>
                {!collapsed && <span className="menu-text">{item.title}</span>}
              </button>
            </Link>
          </div>
        ))}

        {/* Logout Button for Mobile Screens */}
        <div className="mobile-logout">
          <button className="log"  onClick={handleLogout}>
            <FaSignOutAlt className="menu-ico" />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </div>
      {/* Toast Container for Notifications */}
      <ToastContainer position="top-right" autoClose={5000} />

      {/* Add CSS for mobile hide */}
      <style jsx>{`
        .mobile-hide {
          display: block; /* Show by default */
        }

        @media (max-width: 768px) {
          .mobile-hide {
            display: none; /* Hide on mobile devices */
          }
            .sidebar-header {
            display: none; /* Hide on mobile devices */
          }
        }
      `}</style>
    </div>
  );
};

export default Sidebar;