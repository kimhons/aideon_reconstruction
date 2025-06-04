console.log('BASIC TEST: Script starting');

try {
  // Minimal test with no imports or complex logic
  console.log('BASIC TEST: Creating simple object');
  const testObj = {
    name: 'test',
    method: function() {
      console.log('BASIC TEST: Method called');
      return true;
    }
  };
  
  console.log('BASIC TEST: Calling method');
  const result = testObj.method();
  console.log('BASIC TEST: Method result:', result);
  
  // Try a simple timeout
  console.log('BASIC TEST: Setting timeout');
  setTimeout(() => {
    console.log('BASIC TEST: Timeout executed');
  }, 100);
  
  console.log('BASIC TEST: Script completed main execution');
} catch (error) {
  console.error('BASIC TEST: Error occurred:', error);
}
