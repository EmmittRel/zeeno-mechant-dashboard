// AmountCalculator.js
export const calculateVotes = (amount, currency) => {
    // Currency mapping
    const currencyValues = {
      USD: 10,
      AUD: 5,
      GBP: 10,
      CAD: 5,
      EUR: 10,
      AED: 2,
      QAR: 2,
      MYR: 2,
      KWD: 2,
      HKD: 1, 
      CNY: 1,
      SAR: 2,
      OMR: 20,
      SGD: 8,
      NOK: 1,
      KRW: 200, 
      JPY: 20,
      THB: 4,
      INR: 10,
      NPR: 10,
    };
  
    const currencyValue = currencyValues[currency] || 1;
  
    let votes;
    if (currency === 'HKD') {
      votes = Math.floor(amount); 
    } else if (['JPY', 'THB', 'INR', 'NPR'].includes(currency)) {
      votes = Math.floor(amount / currencyValue);
    } else if (currency === 'KRW') {
      votes = Math.floor(amount / 200); 
    } else {
      votes = Math.floor(amount * currencyValue);
    }
  
    return votes;
  };