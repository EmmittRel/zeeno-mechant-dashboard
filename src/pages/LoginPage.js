import React, { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { FaEye, FaEyeSlash, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useToken } from '../context/TokenContext';
import DOMPurify from 'dompurify';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { token, updateToken } = useToken();
  const navigate = useNavigate();

  if (token) {
    return <Navigate to="/" replace />;
  }

  const sanitizeInput = (input) => {
    return DOMPurify.sanitize(input); 
  };

  const handleChange = (e) => {
    const sanitizedValue = sanitizeInput(e.target.value);
    setFormData({
      ...formData,
      [e.target.name]: sanitizedValue,
    });
  };

  const showSuccessToast = (message) => {
    toast.success(
      <div className="flex items-center">
        <FaCheckCircle className="text-green-500 mr-2 text-xl" />
        <span>{message}</span>
      </div>,
      {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        className: "bg-white shadow-lg rounded-lg",
        bodyClassName: "text-gray-800 font-medium",
        progressClassName: "bg-green-500",
      }
    );
  };

  const showErrorToast = (message) => {
    toast.error(
      <div className="flex items-center">
        <FaExclamationCircle className="text-red-500 mr-2 text-xl" />
        <span>{message}</span>
      </div>,
      {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        className: "bg-white shadow-lg rounded-lg",
        bodyClassName: "text-gray-800 font-medium",
        progressClassName: "bg-red-500",
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      showErrorToast("Please fill in both fields");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("https://auth.zeenopay.com/users/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        sessionStorage.setItem("token", data.access_token);
        sessionStorage.setItem("refresh_token", data.refresh_token);
        sessionStorage.setItem("username", formData.username);
        updateToken(data.access_token);
        showSuccessToast("Login successful! Redirecting...");
        setTimeout(() => navigate("/"), 1500);
      } else {
        showErrorToast(data.message);
      }
    } catch (error) {
      showErrorToast("An error occurred while logging in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prevState) => !prevState);
  };

  return (
    <div className="login-container">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        limit={3}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <div className="login-box">
        <img
          className="login-logo"
          src="https://i.ibb.co/HdffZky/zeenopay-logo-removebg-preview.png"
          alt="Logo"
        />
        <h2>Merchant Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              className="focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            />
          </div>
          <div className="form-group password-container">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className="focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
              />
              <button
                type="button"
                className="show-password-btn"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <div className="form-group remember-forget">
            <Link to="/forget-password" className="forget-password">
              Forget Password?
            </Link>
          </div>
          <button 
            type="submit" 
            className="btn"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        <div className="signup-container">
          <p>
            New to the platform? <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </div>
      <style jsx>{`
        .login-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background: #f7f9fc;
          animation: fadeIn 1s ease-in-out;
        }

        .login-box {
          background-color: white;
          padding: 40px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          width: 100%;
          max-width: 400px;
          animation: scaleUp 0.5s ease-in-out;
        }

        .login-logo {
          display: block;
          margin: 0 auto 24px;
          width: 100%;
          max-width: 200px;
          height: auto;
        }

        h2 {
          text-align: center;
          margin-bottom: 24px;
          font-size: 1.5em;
          color: #1a1a1a;
          font-weight: 600;
        }

        .form-group {
          margin-bottom: 24px;
        }

        label {
          font-size: 0.95em;
          color: #4a5568;
          margin-bottom: 8px;
          display: block;
          font-weight: 500;
        }

        input {
          width: 100%;
          padding: 12px 16px;
          font-size: 1em;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          box-sizing: border-box;
          transition: all 0.2s ease;
          outline: none;
        }

        input:focus {
          border-color: #028248;
          box-shadow: 0 0 0 3px rgba(2, 130, 72, 0.1);
        }

        .password-input-container {
          position: relative;
        }

        .show-password-btn {
          background: none;
          border: none;
          color: #4a5568;
          font-size: 1.2em;
          cursor: pointer;
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          transition: color 0.2s ease;
        }

        .show-password-btn:hover {
          color: #028248;
        }

        .btn {
          width: 100%;
          padding: 14px;
          font-size: 1em;
          background-color: #028248;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 600;
          position: relative;
          overflow: hidden;
        }

        .btn:hover {
          background-color: #026d3d;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 130, 72, 0.15);
        }

        .btn:disabled {
          background-color: #93c5b1;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .signup-container {
          text-align: center;
          margin-top: 24px;
        }

        .signup-container a {
          color: #028248;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .signup-container a:hover {
          color: #026d3d;
        }

        .forget-password {
          font-size: 0.9em;
          color: #028248;
          text-decoration: none;
          transition: color 0.2s ease;
          font-weight: 500;
        }

        .forget-password:hover {
          color: #026d3d;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleUp {
          from {
            transform: scale(0.98);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @media (max-width: 600px) {
          .login-box {
            padding: 24px;
          }

          .btn {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;