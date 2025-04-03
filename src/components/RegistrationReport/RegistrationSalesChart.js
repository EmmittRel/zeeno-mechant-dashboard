import React, { useState, useEffect, useCallback, useMemo } from "react";
import Chart from "react-apexcharts";
import { useToken } from "../../context/TokenContext";
import { FaFileExport, FaSpinner } from "react-icons/fa";

const RegistrationSalesChart = () => {
  const [registrationData, setRegistrationData] = useState([]);
  const [paymentIntents, setPaymentIntents] = useState([]);
  const [eventId, setEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { token } = useToken();

  // Fetch eventId from the URL
  useEffect(() => {
    const pathSegments = window.location.pathname.split("/");
    const id = pathSegments[pathSegments.length - 1];

    if (id && !isNaN(id)) {
      setEventId(Number(id));
      setError(null);
    } else {
      setError("Invalid event ID in URL");
      setLoading(false);
    }
  }, []);

  // Combined data fetching function
  const fetchAllData = useCallback(async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [regularPaymentsResponse, qrPaymentsResponse, registrationsResponse] = await Promise.all([
        fetch(`https://auth.zeenopay.com/payments/intents/?event_id=${eventId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`https://auth.zeenopay.com/payments/qr/intents?event_id=${eventId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`https://auth.zeenopay.com/events/form/responses/${eventId}/`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const [regularPayments, qrPayments, registrations] = await Promise.all([
        regularPaymentsResponse.ok ? regularPaymentsResponse.json() : [],
        qrPaymentsResponse.ok ? qrPaymentsResponse.json() : [],
        registrationsResponse.ok ? registrationsResponse.json() : []
      ]);

      // Combine all payment intents
      const allPaymentIntents = [
        ...regularPayments,
        ...qrPayments.map(payment => ({ ...payment, processor: "QR" }))
      ];
      setPaymentIntents(allPaymentIntents);

      // Filter registrations for this event
      const filteredRegistrations = registrations.filter(item => item.form === eventId);
      setRegistrationData(filteredRegistrations);

    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch data. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [eventId, token]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Process registration data for successful payments only
  const processRegistrationData = useMemo(() => {
    const registrationCounts = {};

    registrationData.forEach((registration) => {
      // Check if payment was successful
      const matchingPayment = paymentIntents.find(
        intent => intent.action_id === registration.action_id
      );
      
      let paymentSuccess = false;
      if (matchingPayment) {
        if (matchingPayment.processor === 'ESEWA' && matchingPayment.status === 'S') {
          paymentSuccess = true;
        } else if (matchingPayment.status === 'success') {
          paymentSuccess = true;
        }
      }

      // Only count if payment was successful
      if (paymentSuccess) {
        const date = new Date(registration.created_at).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });
        registrationCounts[date] = (registrationCounts[date] || 0) + 1;
      }
    });

    return Object.keys(registrationCounts)
      .map((date) => ({ date, count: registrationCounts[date] }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [registrationData, paymentIntents]);

  // Process payment data for pie chart
  const { pieSeries, paymentProcessors, totalSales } = useMemo(() => {
    const paymentAmounts = {};
    
    paymentIntents.forEach((payment) => {
      if (
        (payment.processor === 'ESEWA' && payment.status === 'S') ||
        (payment.status === 'success' && ["KHALTI", "PHONEPE", "FONEPAY", "QR"].includes(payment.processor))
      ) {
        const processor = payment.processor;
        const amount = parseFloat(payment.amount) || 0;
        paymentAmounts[processor] = (paymentAmounts[processor] || 0) + amount;
      }
    });

    const processors = Object.keys(paymentAmounts);
    const series = processors.map(processor => paymentAmounts[processor]);
    const total = series.reduce((sum, amount) => sum + amount, 0);

    return {
      pieSeries: series,
      paymentProcessors: processors,
      totalSales: total
    };
  }, [paymentIntents]);

  // Define specific colors for each processor
  const processorColors = {
    ESEWA: "#028248",  
    KHALTI: "#6a0dad", 
    PHONEPE: "#4E79A7", 
    FONEPAY: "#F28E2B",
    QR: "#59A14F"    
  };

  // Chart configurations
  const barOptions = useMemo(() => ({
    chart: {
      type: "bar",
      height: 350,
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
      fontFamily: 'Poppins, sans-serif'
    },
    plotOptions: {
      bar: {
        columnWidth: "50%",
        borderRadius: 4,
      }
    },
    dataLabels: {
      enabled: false
    },
    xaxis: {
      categories: processRegistrationData.map((item) => item.date),
      labels: {
        style: {
          colors: '#6B7280',
          fontSize: '12px',
          fontWeight: 500
        },
      },
    },
    yaxis: {
      labels: {
        formatter: (value) => Math.floor(value),
        style: {
          colors: '#6B7280',
          fontSize: '12px',
          fontWeight: 500
        },
      },
      grid: {
        borderColor: '#E5E7EB',
        strokeDashArray: 4
      }
    },
    colors: ["#028248"],
    fill: {
      opacity: 1,
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: "vertical",
        shadeIntensity: 0.25,
        gradientToColors: ["#02a958"],
        inverseColors: false,
        opacityFrom: 0.85,
        opacityTo: 0.85,
        stops: [0, 100]
      }
    },
    tooltip: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
      },
      y: {
        formatter: function(val) {
          return `${val} paid registration${val !== 1 ? 's' : ''}`;
        }
      }
    },
    grid: {
      borderColor: '#E5E7EB',
      strokeDashArray: 4,
      padding: {
        top: 0,
        right: 20,
        bottom: 0,
        left: 20
      }
    }
  }), [processRegistrationData]);

  const barSeries = useMemo(() => [{
    name: "Paid Registrations",
    data: processRegistrationData.map((item) => Math.floor(item.count)),
  }], [processRegistrationData]);

  const pieOptions = useMemo(() => ({
    chart: { 
      type: "pie", 
      height: 350,
      fontFamily: 'Poppins, sans-serif',
      toolbar: {
        show: false
      }
    },
    labels: paymentProcessors,
    colors: paymentProcessors.map(processor => processorColors[processor] || "#8884d8"),
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontSize: '12px',
      fontFamily: 'Poppins, sans-serif',
      fontWeight: 500,
      labels: {
        colors: '#6B7280'
      },
      markers: {
        width: 12,
        height: 12,
        radius: 6
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '12px',
        fontWeight: 500,
        colors: ['#fff']
      },
      dropShadow: {
        enabled: false
      },
      formatter: function (val, { seriesIndex }) {
        const amount = pieSeries[seriesIndex];
        return `Rs. ${Math.floor(amount)}`;
      },
    },
    responsive: [{
      breakpoint: 768,
      options: {
        chart: {
          height: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }]
  }), [paymentProcessors, pieSeries]);

  // Loading and error states
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner">
          <FaSpinner className="animate-spin" size={32} />
        </div>
        <p className="loading-text">Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <svg className="error-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <h3 className="error-title">Error Loading Data</h3>
          <p className="error-message">{error}</p>
          <button 
            onClick={fetchAllData}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-content">
          <h1 className="dashboard-title">Registration & Sales Analytics</h1>
          {/* <p className="dashboard-subtitle">Event ID: {eventId}</p> */}
        </div>
        {/* <button 
          className="export-button"
          disabled={processRegistrationData.length === 0 && paymentProcessors.length === 0}
        >
          <FaFileExport className="export-icon" />
          Export Report
        </button> */}
      </div>

      <div className="charts-grid">
        {/* Registration Report Card */}
        <div className="chart-card">
          <div className="card-header">
            <h2 className="card-title">Paid Registrations</h2>
            <div className="total-count">
              Total: {processRegistrationData.reduce((sum, item) => sum + item.count, 0)}
            </div>
          </div>
          <div className="chart-wrapper">
            {processRegistrationData.length > 0 ? (
              <Chart 
                options={barOptions} 
                series={barSeries} 
                type="bar" 
                height={350} 
                className="chart"
              />
            ) : (
              <div className="empty-state">
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/4076/4076478.png" 
                  alt="No data" 
                  className="empty-image"
                />
                <p className="empty-text">No paid registrations found</p>
              </div>
            )}
          </div>
        </div>

        {/* Sales Report Card */}
        <div className="chart-card">
          <div className="card-header">
            <h2 className="card-title">Payment Distribution</h2>
            <div className="total-amount">
              Total: Rs. {Math.floor(totalSales)}
            </div>
          </div>
          <div className="chart-wrapper">
            {paymentProcessors.length > 0 ? (
              <>
                <Chart 
                  options={pieOptions} 
                  series={pieSeries} 
                  type="pie" 
                  height={350} 
                  className="chart"
                />
                {window.innerWidth <= 768 && (
                  <div className="payment-legend-mobile">
                    {paymentProcessors.map((processor) => (
                      <div key={processor} className="legend-item">
                        <span 
                          className="color-indicator" 
                          style={{ backgroundColor: processorColors[processor] || "#8884d8" }}
                        />
                        <span className="processor-name">{processor}</span>
                        <span className="processor-amount">
                          Rs. {Math.floor(pieSeries[paymentProcessors.indexOf(processor)])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <img 
                  src="https://cdn-icons-png.flaticon.com/512/4076/4076478.png" 
                  alt="No data" 
                  className="empty-image"
                />
                <p className="empty-text">No payment data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-container {
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 1.5rem;
          font-family: 'Poppins', sans-serif;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .header-content {
          flex: 1;
          min-width: 200px;
        }

        .dashboard-title {
          font-size: 1.75rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.25rem 0;
          line-height: 1.2;
        }

        .dashboard-subtitle {
          font-size: 0.875rem;
          color: #6B7280;
          margin: 0;
        }

        .export-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background-color: #028248;
          color: white;
          border: none;
          padding: 0.75rem 1.25rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .export-button:hover:not(:disabled) {
          background-color: #026c3d;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .export-button:disabled {
          background-color: #9CA3AF;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .export-icon {
          font-size: 1rem;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 1.5rem;
          width: 100%;
        }

        .chart-card {
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .chart-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #E5E7EB;
        }

        .card-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .total-count, .total-amount {
          font-size: 0.875rem;
          font-weight: 500;
          color: #028248;
          background-color: #F0FDF4;
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
        }

        .total-amount {
          color: #4F46E5;
          background-color: #EEF2FF;
        }

        .chart-wrapper {
          padding: 1rem;
          height: 400px;
          display: flex;
          flex-direction: column;
        }

        .chart {
          flex: 1;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
          text-align: center;
        }

        .empty-image {
          width: 120px;
          height: 120px;
          opacity: 0.6;
          margin-bottom: 1rem;
        }

        .empty-text {
          font-size: 0.875rem;
          color: #6B7280;
          margin: 0;
        }

        .payment-legend-mobile {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: center;
          margin-top: 1rem;
          padding: 0.5rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          background-color: #F9FAFB;
          border-radius: 0.375rem;
          font-size: 0.75rem;
        }

        .color-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .processor-name {
          font-weight: 500;
          color: #111827;
        }

        .processor-amount {
          color: #6B7280;
        }

        /* Loading state */
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          gap: 1rem;
        }

        .spinner {
          animation: spin 1s linear infinite;
          color: #028248;
        }

        .loading-text {
          font-size: 0.875rem;
          color: #6B7280;
        }

        /* Error state */
        .error-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 400px;
        }

        .error-content {
          text-align: center;
          max-width: 400px;
          padding: 2rem;
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .error-icon {
          width: 3rem;
          height: 3rem;
          color: #EF4444;
          margin-bottom: 1rem;
        }

        .error-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0 0 0.5rem 0;
        }

        .error-message {
          font-size: 0.875rem;
          color: #6B7280;
          margin: 0 0 1.5rem 0;
        }

        .retry-button {
          background-color: #028248;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .retry-button:hover {
          background-color: #026c3d;
        }

        /* Animations */
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Responsive adjustments */
        @media (max-width: 1024px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard-container {
            padding: 1rem;
          }

          .dashboard-title {
            font-size: 1.5rem;
          }

          .card-header {
            padding: 1rem;
          }

          .chart-wrapper {
            height: 350px;
            padding: 0.5rem;
          }

          .empty-image {
            width: 80px;
            height: 80px;
          }
        }
      `}</style>
    </div>
  );
};

export default RegistrationSalesChart;