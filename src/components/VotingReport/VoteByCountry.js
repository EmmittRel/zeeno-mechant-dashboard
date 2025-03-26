import React, { useState, useEffect } from "react";
import Chart from "react-apexcharts";
import { useToken } from "../../context/TokenContext";

const RegistrationSalesChart = () => {
  // Define processor categories
  const nepalProcessors = ["ESEWA", "KHALTI", "FONEPAY", "PRABHUPAY", "NQR", "QR"];
  const indiaProcessors = ["PHONEPE"];
  const internationalProcessors = ["PAYU", "STRIPE"];

  const [registrationData, setRegistrationData] = useState([]);
  const [paymentData, setPaymentData] = useState({});
  const [eventId, setEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useToken();

  // Fetch eventId from URL
  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];
    setEventId(id && !isNaN(id) ? Number(id) : null);
  }, []);

  // Fetch registration data
  const fetchRegistrationData = async () => {
    if (!eventId) return;

    try {
      const response = await fetch(
        `https://auth.zeenopay.com/events/form/responses/${eventId}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );
      const data = await response.json();
      setRegistrationData(data.filter(item => item.form === eventId));
    } catch (error) {
      console.error("Registration data error:", error);
      setError("Failed to load registration data");
    }
  };

  // Enhanced payment data fetching
  const fetchPaymentData = async () => {
    try {
      // Fetch from both endpoints
      const [regularPayments, qrPayments] = await Promise.all([
        fetch(`https://auth.zeenopay.com/payments/intents/?event_id=${eventId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : []),
        
        fetch(`https://auth.zeenopay.com/payments/qr/intents?event_id=${eventId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : [])
      ]);

      // Combine and filter successful payments
      const allPayments = [...regularPayments, ...qrPayments];
      const successfulPayments = allPayments.filter(
        payment => payment.status === 'S' && payment.intent === 'F'
      );

      // Initialize payment amounts by category
      const paymentAmounts = {
        eSewa: 0,
        Nepal: 0,
        India: 0,
        International: 0,
        // Individual processors for detailed breakdown
        KHALTI: 0,
        FONEPAY: 0,
        PRABHUPAY: 0,
        NQR: 0,
        QR: 0,
        PHONEPE: 0,
        PAYU: 0,
        STRIPE: 0
      };

      // Process each payment
      successfulPayments.forEach(payment => {
        const processor = payment.processor?.toUpperCase();
        const amount = parseFloat(payment.amount) || 0;

        // Add to individual processor
        if (paymentAmounts.hasOwnProperty(processor)) {
          paymentAmounts[processor] += amount;
        }

        // Categorize payment
        if (nepalProcessors.includes(processor)) {
          paymentAmounts.Nepal += amount;
          if (processor === "ESEWA") {
            paymentAmounts.eSewa += amount;
          }
        } else if (indiaProcessors.includes(processor)) {
          paymentAmounts.India += amount;
        } else if (internationalProcessors.includes(processor)) {
          paymentAmounts.International += amount;
        }
      });

      setPaymentData(paymentAmounts);
    } catch (error) {
      console.error("Payment data error:", error);
      setError("Failed to load payment data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId && token) {
      Promise.all([fetchRegistrationData(), fetchPaymentData()])
        .catch(error => {
          console.error("Initialization error:", error);
          setError("Failed to initialize data");
          setLoading(false);
        });
    }
  }, [eventId, token]);

  // Process registration data for chart
  const processRegistrationData = () => {
    const counts = {};
    registrationData.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short"
      });
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Prepare chart data
  const registrationCounts = processRegistrationData();
  const activePaymentCategories = Object.entries(paymentData)
    .filter(([key, value]) => 
      ["eSewa", "Nepal", "India", "International"].includes(key) && value > 0
    );

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h2>Registration & Sales Analytics</h2>
        <button className="export-button">Export Report</button>
      </div>

      {/* Charts Section */}
      {loading ? (
        <div className="loading-indicator">Loading data...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="charts-grid">
          {/* Registration Chart */}
          <div className="chart-card">
            <h3>Daily Registrations</h3>
            {registrationCounts.length > 0 ? (
              <Chart
                options={{
                  chart: { type: "bar", toolbar: { show: false } },
                  xaxis: { categories: registrationCounts.map(item => item.date) },
                  colors: ["#028248"],
                  plotOptions: { bar: { columnWidth: "60%" } }
                }}
                series={[{
                  name: "Registrations",
                  data: registrationCounts.map(item => item.count)
                }]}
                type="bar"
                height={350}
              />
            ) : (
              <div className="no-data">No registration data available</div>
            )}
          </div>

          {/* Payment Chart */}
          <div className="chart-card">
            <h3>Payment Distribution</h3>
            {activePaymentCategories.length > 0 ? (
              <>
                <Chart
                  options={{
                    chart: { type: "pie" },
                    labels: activePaymentCategories.map(([key]) => key),
                    colors: ["#028248", "#36a2eb", "#ff6384", "#ffcd56"],
                    legend: { position: "bottom" },
                    dataLabels: {
                      formatter: (val, { seriesIndex }) => {
                        return `Rs. ${Math.floor(activePaymentCategories[seriesIndex][1])}`;
                      }
                    }
                  }}
                  series={activePaymentCategories.map(([, value]) => value)}
                  type="pie"
                  height={350}
                />
                <div className="payment-details">
                  {Object.entries(paymentData)
                    .filter(([key, value]) => 
                      !["eSewa", "Nepal", "India", "International"].includes(key) && value > 0
                    )
                    .map(([processor, amount]) => (
                      <div key={processor} className="payment-item">
                        <span>{processor}:</span>
                        <span>Rs. {Math.floor(amount)}</span>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div className="no-data">No payment data available</div>
            )}
          </div>
        </div>
      )}

      {/* Styles */}
      <style jsx>{`
        .dashboard-container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        .export-button {
          background: #028248;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .chart-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .payment-details {
          margin-top: 20px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }
        .payment-item {
          display: flex;
          justify-content: space-between;
          padding: 8px;
          background: #f5f5f5;
          border-radius: 4px;
        }
        .no-data, .loading-indicator, .error-message {
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }
        .error-message {
          color: #d32f2f;
        }

        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default RegistrationSalesChart;